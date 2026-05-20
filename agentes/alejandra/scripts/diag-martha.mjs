import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data } = await s
  .from('leads')
  .select('contact_id, bot_full_name, nombre, telefono, bot_stage, bot_followup_count, bot_last_msg_at, bot_appointment_at, bot_retake_scheduled_at, tags, stage_name, pipeline_name, eventos, total_eventos')
  .or('bot_full_name.ilike.%martha%,bot_full_name.ilike.%matyrdz%,nombre.ilike.%martha%');

console.log(`leads encontrados: ${data?.length || 0}\n`);

for (const r of (data || [])) {
  console.log(`▸ ${r.bot_full_name || r.nombre} (${r.contact_id})`);
  console.log(`  tel:${r.telefono} | pipeline:${r.pipeline_name} | stage_ghl:${r.stage_name}`);
  console.log(`  bot_stage:${r.bot_stage} | followup_count:${r.bot_followup_count} | last_msg:${r.bot_last_msg_at}`);
  console.log(`  appt_at:${r.bot_appointment_at} | retake:${r.bot_retake_scheduled_at}`);
  console.log(`  tags:${JSON.stringify(r.tags)}`);
  console.log(`  total_eventos:${r.total_eventos}`);

  // Eventos del día relevante (12:00-12:30)
  const todayStart = new Date(Date.now() - 6*3600*1000); // CDMX hoy ~
  const recent = (r.eventos || []).filter(e => {
    if (!e.fecha) return false;
    const t = new Date(e.fecha).getTime();
    return t > Date.now() - 3*3600*1000; // últimas 3h
  }).slice(-30);

  console.log(`\n  EVENTOS últimas 3h (${recent.length}):`);
  for (const e of recent) {
    const cuerpo = (e.cuerpo || '').replace(/\s+/g, ' ').slice(0, 120);
    console.log(`    [${e.fecha}] tipo=${e.tipo} dir=${e.direccion} emisor=${e.emisor} ghl_id=${e.ghl_id || 'null'}`);
    console.log(`       "${cuerpo}"`);
  }
  console.log('');
}
process.exit(0);
