// Pull bot_last_decision por lead desde Supabase para entender qué decidió
// el Orquestador en sus 4 ejecuciones de hoy (11:00, 12:00, 13:00, 14:00 CDMX).
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

// Cálculo: 11 AM CDMX hoy en UTC
const cdmxFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
const todayCdmx = cdmxFmt.format(new Date());
const elevenAmCdmxIso = `${todayCdmx}T11:00:00-06:00`;
const elevenAmUtcMs = new Date(elevenAmCdmxIso).getTime();
const nowMs = Date.now();

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`  DECISIONES DEL ORQUESTADOR — hoy desde 11:00 AM CDMX`);
console.log(`═══════════════════════════════════════════════════════════\n`);

// Pull todos los leads activos en stages Bot IA
const { data: leads, error } = await supabase
  .from('leads')
  .select('contact_id, nombre, bot_full_name, telefono, stage_name, bot_stage, bot_followup_count, bot_last_msg_at, bot_last_decision, bot_postpone_until, bot_skip_at, bot_skip_reason, bot_appointment_at, eventos, tags, ghl_updated_at')
  .in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA'])
  .order('ghl_updated_at', { ascending: false });

if (error) { console.error(error); process.exit(1); }

console.log(`Universo total: ${leads.length} leads en stages Bot IA\n`);

// Resumen por bot_last_decision
const byDecision = {};
const byBotStage = {};
const skipsByReason = {};
let withRecentDecision = 0;
let withoutDecision = 0;

for (const l of leads) {
  const dec = l.bot_last_decision || '(sin decisión)';
  byDecision[dec] = (byDecision[dec] || 0) + 1;
  const stage = l.bot_stage || '(null)';
  byBotStage[stage] = (byBotStage[stage] || 0) + 1;
  if (l.bot_skip_reason) {
    skipsByReason[l.bot_skip_reason] = (skipsByReason[l.bot_skip_reason] || 0) + 1;
  }
  if (l.bot_last_msg_at && new Date(l.bot_last_msg_at).getTime() >= elevenAmUtcMs) {
    withRecentDecision++;
  }
}

console.log(`📊 Decisión registrada (bot_last_decision):`);
for (const [d, n] of Object.entries(byDecision).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${d.padEnd(30)} ${n}`);
}

console.log(`\n📊 Distribución por bot_stage:`);
for (const [s, n] of Object.entries(byBotStage).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${s.padEnd(30)} ${n}`);
}

if (Object.keys(skipsByReason).length > 0) {
  console.log(`\n📊 bot_skip_reason (los leads marcados como skip):`);
  for (const [r, n] of Object.entries(skipsByReason).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${r.padEnd(30)} ${n}`);
  }
}

console.log(`\n📊 Actividad reciente:`);
console.log(`   Leads con bot_last_msg_at >= 11 AM hoy: ${withRecentDecision}`);

// Mostrar TODOS los leads con decisión hoy
const todayDecisions = leads.filter(l => l.bot_last_msg_at && new Date(l.bot_last_msg_at).getTime() >= elevenAmUtcMs);
if (todayDecisions.length > 0) {
  console.log(`\n────── LEADS TOCADOS POR ORQUESTADOR HOY ──────`);
  for (const l of todayDecisions) {
    const name = l.bot_full_name || l.nombre || '(sin nombre)';
    const min = Math.round((nowMs - new Date(l.bot_last_msg_at).getTime()) / 60000);
    console.log(`  ▸ ${name.padEnd(28)} hace ${min}min · decision=${l.bot_last_decision || 'null'} · followups=${l.bot_followup_count}/3 · stage=${l.bot_stage}`);
  }
}

// Mostrar leads con bot_postpone_until futuro (postpone activo)
const postponed = leads.filter(l => l.bot_postpone_until && new Date(l.bot_postpone_until).getTime() > nowMs);
if (postponed.length > 0) {
  console.log(`\n────── LEADS CON POSTPONE ACTIVO (no se tocan hasta esa fecha) ──────`);
  for (const l of postponed.slice(0, 15)) {
    const name = l.bot_full_name || l.nombre || '(sin nombre)';
    const futureH = Math.round((new Date(l.bot_postpone_until).getTime() - nowMs) / 3600000);
    console.log(`  ⏸️  ${name.padEnd(28)} postpone hasta ${l.bot_postpone_until.slice(0,16)} (${futureH}h en futuro)`);
  }
}

// Leads sin tag bot ia (no aplican)
const noBotTag = leads.filter(l => !Array.isArray(l.tags) || !l.tags.includes('bot ia'));
console.log(`\n────── LEADS SIN TAG bot ia (NO PROCESADOS) ──────`);
console.log(`   ${noBotTag.length} leads sin tag → Orquestador los ignora por diseño`);

console.log('\n═══════════════════════════════════════════════════════════\n');
process.exit(0);
