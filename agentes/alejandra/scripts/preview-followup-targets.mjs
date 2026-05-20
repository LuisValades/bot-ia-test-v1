import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

const MAX_FOLLOWUPS = parseInt(process.env.MAX_FOLLOWUPS || '3', 10);
const NUDGE_DELAYS_MIN = [
  parseInt(process.env.FOLLOWUP_DELAY_MIN || '90', 10),
  parseInt(process.env.FOLLOWUP_2_DELAY_MIN || '90', 10),
  parseInt(process.env.FOLLOWUP_3_DELAY_MIN || '1440', 10)
];

const minimumCutoff = new Date(Date.now() - Math.min(...NUDGE_DELAYS_MIN) * 60 * 1000).toISOString();
const nudgeStages = ['inicio', 'calificando', 'proponiendo_horario'];

const { data, error } = await supabase
  .from('leads')
  .select('contact_id, bot_full_name, nombre, telefono, bot_stage, bot_followup_count, bot_last_msg_at, ultima_actividad, ghl_updated_at, synced_at, tags, stage_name, pipeline_name, bot_appointment_at, bot_retake_scheduled_at')
  .in('bot_stage', nudgeStages)
  .lt('bot_followup_count', MAX_FOLLOWUPS)
  .is('bot_retake_scheduled_at', null);

if (error) { console.error(error); process.exit(1); }

const targets = (data || [])
  .filter(r => Array.isArray(r.tags) && r.tags.includes('bot ia'))
  .filter(r => r.stage_name === 'Ingreso - Test Agent IA' || r.stage_name === 'Bot IA')
  .filter(r => !r.bot_appointment_at);

// Baseline = bot_last_msg_at || ultima_actividad || ghl_updated_at || synced_at
const ready = [];
for (const r of targets) {
  const baseline = r.bot_last_msg_at || r.ultima_actividad || r.ghl_updated_at || r.synced_at;
  if (!baseline) continue;
  const isRetomar = !r.bot_last_msg_at;
  const nudgeNumber = (r.bot_followup_count || 0) + 1;
  const requiredDelayMin = NUDGE_DELAYS_MIN[nudgeNumber - 1] ?? NUDGE_DELAYS_MIN[NUDGE_DELAYS_MIN.length - 1];
  const elapsedMin = (Date.now() - new Date(baseline).getTime()) / 60000;
  if (elapsedMin >= requiredDelayMin) {
    ready.push({ ...r, nudgeNumber, elapsedMin: Math.round(elapsedMin), requiredDelayMin, isRetomar, baseline });
  }
}

console.log(`\n=== LEADS QUE RECIBIRÍAN FOLLOWUP AHORA ===\n`);
console.log(`Total candidatos pasando todos los filtros: ${ready.length}\n`);

if (ready.length === 0) {
  console.log('(ninguno)');
  process.exit(0);
}

for (const r of ready) {
  console.log(`▸ ${r.bot_full_name || r.nombre || '(sin nombre)'}${r.isRetomar ? ' [RETOMAR]' : ''}`);
  console.log(`  contact_id: ${r.contact_id}`);
  console.log(`  tel:        ${r.telefono}`);
  console.log(`  pipeline:   ${r.pipeline_name}`);
  console.log(`  stage_ghl:  ${r.stage_name}`);
  console.log(`  bot_stage:  ${r.bot_stage}`);
  console.log(`  nudge #:    ${r.nudgeNumber} de ${MAX_FOLLOWUPS}`);
  console.log(`  edad:       ${r.elapsedMin} min (requerido ≥${r.requiredDelayMin}) — baseline=${r.isRetomar ? 'GHL activity' : 'bot last msg'}`);
  console.log(`  tags:       ${(r.tags || []).join(', ')}`);
  console.log('');
}

// También checa cuántos leads únicos ya fueron contactados hoy (para ver si hay margen del cap=50)
const cdmxParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Mexico_City',
  year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(new Date()).reduce((a, p) => ({ ...a, [p.type]: p.value }), {});
const cdmxStartUtc = new Date(`${cdmxParts.year}-${cdmxParts.month}-${cdmxParts.day}T06:00:00Z`).toISOString();

const { data: today } = await supabase
  .from('leads')
  .select('contact_id, eventos')
  .gte('bot_last_msg_at', cdmxStartUtc);

const uniqueContacts = new Set();
for (const r of today || []) {
  const eventos = r.eventos || [];
  const had = eventos.some(e => e.tipo === 'SMS' && e.direccion === 'out' && e.fecha >= cdmxStartUtc);
  if (had) uniqueContacts.add(r.contact_id);
}
// También mostrar los que NO califican aún para entender por qué
const notReady = [];
for (const r of targets) {
  const baseline = r.bot_last_msg_at || r.ultima_actividad || r.ghl_updated_at || r.synced_at;
  if (!baseline) {
    notReady.push({ ...r, reason: 'sin baseline (ningún timestamp)' });
    continue;
  }
  const nudgeNumber = (r.bot_followup_count || 0) + 1;
  const requiredDelayMin = NUDGE_DELAYS_MIN[nudgeNumber - 1] ?? NUDGE_DELAYS_MIN[NUDGE_DELAYS_MIN.length - 1];
  const elapsedMin = (Date.now() - new Date(baseline).getTime()) / 60000;
  if (elapsedMin < requiredDelayMin) {
    notReady.push({ ...r, reason: `edad ${Math.round(elapsedMin)}min < ${requiredDelayMin}min`, nudgeNumber });
  }
}

if (notReady.length > 0) {
  console.log(`\n=== ${notReady.length} LEAD(S) NO ELEGIBLES TODAVÍA ===`);
  for (const r of notReady) {
    console.log(`  - ${r.bot_full_name || r.nombre} (${r.pipeline_name}) → ${r.reason}`);
  }
}

console.log(`\n=== CAP DEL DÍA ===`);
console.log(`Leads ÚNICOS contactados hoy por SMS-out: ${uniqueContacts.size} / 50`);
console.log(`Margen disponible: ${Math.max(0, 50 - uniqueContacts.size)}`);
process.exit(0);
