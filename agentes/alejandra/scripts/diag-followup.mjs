import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

const MAX_FOLLOWUPS = parseInt(process.env.FOLLOWUP_MAX || process.env.MAX_FOLLOWUPS || '3', 10);
const MIN_DELAY_MIN = 90;

console.log(`MAX_FOLLOWUPS env: ${MAX_FOLLOWUPS}`);
console.log(`FOLLOWUP_DAILY_CAP env: ${process.env.SMS_DAILY_CAP || 50}`);
console.log(`FOLLOWUP_BUSINESS_HOURS_START: ${process.env.BUSINESS_HOURS_START || '11'}`);
console.log(`FOLLOWUP_BUSINESS_HOURS_END: ${process.env.BUSINESS_HOURS_END || '19'}`);

const cutoff = new Date(Date.now() - MIN_DELAY_MIN * 60 * 1000).toISOString();
const nudgeStages = ['inicio', 'calificando', 'proponiendo_horario'];

console.log(`\n→ filtros que aplica runFollowups():`);
console.log(`   bot_stage IN ${JSON.stringify(nudgeStages)}`);
console.log(`   bot_followup_count < ${MAX_FOLLOWUPS}`);
console.log(`   bot_last_msg_at < ${cutoff}`);
console.log(`   bot_retake_scheduled_at IS NULL`);
console.log(`   + tags includes "bot ia"`);
console.log(`   + stage_name IN ["Ingreso - Test Agent IA", "Bot IA"]`);

// Vamos a hacer la query principal sin los filtros extra y verificar uno por uno
const { data: all, error } = await supabase
  .from('leads')
  .select('contact_id, bot_full_name, nombre, bot_stage, bot_followup_count, bot_last_msg_at, bot_retake_scheduled_at, bot_appointment_at, tags, stage_name, pipeline_name')
  .in('bot_stage', nudgeStages)
  .lt('bot_followup_count', MAX_FOLLOWUPS)
  .lt('bot_last_msg_at', cutoff)
  .is('bot_retake_scheduled_at', null);

if (error) { console.error('query err:', error); process.exit(1); }

console.log(`\n[query principal] ${all?.length || 0} leads pasan los filtros base`);

if (!all || all.length === 0) {
  // Veamos qué leads HAY en bot ia con esos stages (sin importar el cutoff)
  const { data: any } = await supabase
    .from('leads')
    .select('contact_id, bot_full_name, nombre, bot_stage, bot_followup_count, bot_last_msg_at, tags, stage_name, pipeline_name, bot_appointment_at, bot_retake_scheduled_at')
    .in('bot_stage', nudgeStages)
    .limit(20);
  console.log(`\n[diag amplio — sin cutoff] leads en stages activos: ${any?.length || 0}`);
  for (const r of (any || [])) {
    const ageMin = r.bot_last_msg_at
      ? Math.round((Date.now() - new Date(r.bot_last_msg_at).getTime()) / 60000)
      : null;
    console.log(`   - ${r.bot_full_name || r.nombre || r.contact_id} | bot_stage=${r.bot_stage} | followup=${r.bot_followup_count} | edad=${ageMin}min | tags=${JSON.stringify(r.tags)} | stage_name=${r.stage_name} | pipeline=${r.pipeline_name} | appt=${r.bot_appointment_at || 'null'} | retake=${r.bot_retake_scheduled_at || 'null'}`);
  }
  process.exit(0);
}

// Para los que pasan filtros base, verificar tags + stage_name
let pasanTodo = 0;
for (const r of all) {
  const tagOk = Array.isArray(r.tags) && r.tags.includes('bot ia');
  const stageOk = r.stage_name === 'Ingreso - Test Agent IA' || r.stage_name === 'Bot IA';
  const ageMin = r.bot_last_msg_at
    ? Math.round((Date.now() - new Date(r.bot_last_msg_at).getTime()) / 60000)
    : null;
  console.log(`   - ${r.bot_full_name || r.nombre || r.contact_id}`);
  console.log(`     bot_stage=${r.bot_stage} followup=${r.bot_followup_count} edad=${ageMin}min`);
  console.log(`     tags=${JSON.stringify(r.tags)} → bot ia? ${tagOk ? 'SI' : 'NO'}`);
  console.log(`     stage_name="${r.stage_name}" → match? ${stageOk ? 'SI' : 'NO'}`);
  console.log(`     pipeline=${r.pipeline_name}`);
  if (tagOk && stageOk) pasanTodo++;
}
console.log(`\n→ ${pasanTodo} leads pasan TODOS los filtros y tendrían que recibir followup ahora.`);
process.exit(0);
