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

// TODOS los leads con stage_name del bot — sin filtros adicionales
const { data: rows, error } = await supabase
  .from('leads')
  .select('contact_id, bot_full_name, nombre, telefono, bot_stage, bot_followup_count, bot_last_msg_at, tags, stage_name, pipeline_name, bot_appointment_at, bot_retake_scheduled_at')
  .or('stage_name.eq.Ingreso - Test Agent IA,stage_name.eq.Bot IA');

if (error) { console.error(error); process.exit(1); }

console.log(`Total leads en stage "Ingreso - Test Agent IA" o "Bot IA": ${rows?.length || 0}\n`);

const reasons = { sent: 0, byBlocker: {} };
function blocker(name) {
  reasons.byBlocker[name] = (reasons.byBlocker[name] || 0) + 1;
}

for (const r of rows || []) {
  const checks = [];
  let blocked = null;

  // 1. tag bot ia
  const tagOk = Array.isArray(r.tags) && r.tags.includes('bot ia');
  if (!tagOk && !blocked) blocked = 'sin tag "bot ia"';
  checks.push(`tag-bot-ia=${tagOk ? '✓' : '✗'}`);

  // 2. bot_stage activo
  const stageOk = ['inicio', 'calificando', 'proponiendo_horario'].includes(r.bot_stage);
  if (!stageOk && !blocked) blocked = `bot_stage="${r.bot_stage}" (debe ser inicio/calificando/proponiendo_horario)`;
  checks.push(`bot_stage=${r.bot_stage}${stageOk ? '✓' : '✗'}`);

  // 3. followup_count < MAX
  const countOk = (r.bot_followup_count || 0) < MAX_FOLLOWUPS;
  if (!countOk && !blocked) blocked = `bot_followup_count=${r.bot_followup_count} ≥ ${MAX_FOLLOWUPS}`;
  checks.push(`count=${r.bot_followup_count || 0}${countOk ? '✓' : '✗'}`);

  // 4. retake null
  const retakeOk = !r.bot_retake_scheduled_at;
  if (!retakeOk && !blocked) blocked = `retake programado para ${r.bot_retake_scheduled_at}`;
  checks.push(`retake=${retakeOk ? 'null✓' : '✗'}`);

  // 5. no appointment
  const apptOk = !r.bot_appointment_at;
  if (!apptOk && !blocked) blocked = `appointment_at=${r.bot_appointment_at}`;
  checks.push(`appt=${apptOk ? 'null✓' : '✗'}`);

  // 6. delay
  const ageMin = r.bot_last_msg_at
    ? Math.round((Date.now() - new Date(r.bot_last_msg_at).getTime()) / 60000)
    : null;
  const nudgeNumber = (r.bot_followup_count || 0) + 1;
  const requiredDelayMin = NUDGE_DELAYS_MIN[nudgeNumber - 1] ?? NUDGE_DELAYS_MIN[NUDGE_DELAYS_MIN.length - 1];
  const delayOk = ageMin !== null && ageMin >= requiredDelayMin;
  if (!delayOk && !blocked) blocked = `edad=${ageMin}min < requerido ${requiredDelayMin}min (nudge #${nudgeNumber})`;
  checks.push(`edad=${ageMin}min ${delayOk ? '✓' : '✗'}`);

  console.log(`▸ ${r.bot_full_name || r.nombre || r.contact_id}`);
  console.log(`  pipeline=${r.pipeline_name} | tel=${r.telefono}`);
  console.log(`  ${checks.join(' | ')}`);
  if (blocked) {
    console.log(`  ❌ BLOQUEO: ${blocked}`);
    blocker(blocked.split(' (')[0].split('=')[0].trim());
  } else {
    console.log(`  ✅ ELEGIBLE para nudge #${nudgeNumber}`);
    reasons.sent++;
  }
  console.log('');
}

console.log(`\n=== RESUMEN ===`);
console.log(`Elegibles ahora: ${reasons.sent}`);
console.log(`Bloqueados por:`);
for (const [k, v] of Object.entries(reasons.byBlocker)) {
  console.log(`  - ${k}: ${v}`);
}
process.exit(0);
