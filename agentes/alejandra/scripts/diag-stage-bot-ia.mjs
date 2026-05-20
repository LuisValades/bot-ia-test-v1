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

// TODOS los leads en stages bot (sin filtros) para diagnóstico completo
const { data, error } = await supabase
  .from('leads')
  .select('contact_id, bot_full_name, nombre, telefono, bot_stage, bot_followup_count, bot_last_msg_at, ultima_actividad, ghl_updated_at, synced_at, tags, stage_name, pipeline_name, bot_appointment_at, bot_retake_scheduled_at')
  .in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA'])
  .order('ghl_updated_at', { ascending: false });

if (error) { console.error(error); process.exit(1); }

const leads = data || [];
console.log(`\n=== ${leads.length} LEAD(S) EN STAGES BOT IA ===\n`);

for (const r of leads) {
  const name = r.bot_full_name || r.nombre || '(sin nombre)';
  console.log(`▸ ${name} — ${r.pipeline_name}`);
  console.log(`  tel:        ${r.telefono || '(sin tel)'}`);
  console.log(`  stage GHL:  ${r.stage_name}`);
  console.log(`  bot_stage:  ${r.bot_stage || '(null)'}`);
  console.log(`  followups:  ${r.bot_followup_count ?? 0}/${MAX_FOLLOWUPS}`);
  console.log(`  tags:       ${(r.tags || []).join(', ') || '(sin tags)'}`);
  console.log(`  last bot:   ${r.bot_last_msg_at || '(null)'}`);
  console.log(`  ultima act: ${r.ultima_actividad || '(null)'}`);
  console.log(`  appt_at:    ${r.bot_appointment_at || '(null)'}`);
  console.log(`  retake:     ${r.bot_retake_scheduled_at || '(null)'}`);

  const reasons = [];
  const hasTag = Array.isArray(r.tags) && r.tags.includes('bot ia');
  if (!hasTag) reasons.push('SIN tag "bot ia"');
  const stageOk = ['inicio', 'calificando', 'proponiendo_horario'].includes(r.bot_stage);
  if (!stageOk) reasons.push(`bot_stage="${r.bot_stage || 'null'}" NO está en [inicio,calificando,proponiendo_horario]`);
  if ((r.bot_followup_count || 0) >= MAX_FOLLOWUPS) reasons.push(`followups ${r.bot_followup_count}/${MAX_FOLLOWUPS} agotados`);
  if (r.bot_retake_scheduled_at) reasons.push(`retake programado ${r.bot_retake_scheduled_at}`);
  if (r.bot_appointment_at) reasons.push(`tiene cita ${r.bot_appointment_at}`);
  const baseline = r.bot_last_msg_at || r.ultima_actividad || r.ghl_updated_at || r.synced_at;
  if (!baseline) reasons.push('sin baseline timestamp');

  if (reasons.length === 0) {
    const nudgeNumber = (r.bot_followup_count || 0) + 1;
    const requiredDelayMin = NUDGE_DELAYS_MIN[nudgeNumber - 1] ?? NUDGE_DELAYS_MIN[NUDGE_DELAYS_MIN.length - 1];
    const elapsedMin = Math.round((Date.now() - new Date(baseline).getTime()) / 60000);
    if (elapsedMin >= requiredDelayMin) {
      console.log(`  ✅ ELEGIBLE AHORA — nudge #${nudgeNumber}, edad=${elapsedMin}min ≥ ${requiredDelayMin}min`);
    } else {
      const wait = requiredDelayMin - elapsedMin;
      console.log(`  ⏳ ESPERANDO ${wait}min — nudge #${nudgeNumber}, edad=${elapsedMin}min, requerido ${requiredDelayMin}min`);
    }
  } else {
    console.log(`  ❌ NO RECIBE FOLLOWUP — ${reasons.join(' | ')}`);
  }
  console.log('');
}
process.exit(0);
