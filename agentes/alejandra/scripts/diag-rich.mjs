import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data } = await s
  .from('leads')
  .select('contact_id, opp_id, bot_full_name, nombre, telefono, bot_stage, bot_followup_count, bot_last_msg_at, bot_appointment_at, bot_retake_scheduled_at, tags, stage_name, pipeline_name, eventos, total_eventos, last_synced_at')
  .or('bot_full_name.ilike.%rich%,nombre.ilike.%rich%,bot_full_name.ilike.%richaard%')
  .order('total_eventos', { ascending: false })
  .limit(5);

for (const r of data || []) {
  console.log(`\n▸ ${r.bot_full_name || r.nombre} (${r.contact_id})`);
  console.log(`  pipeline: ${r.pipeline_name} | stage_ghl: ${r.stage_name} | bot_stage: ${r.bot_stage}`);
  console.log(`  followup_count: ${r.bot_followup_count} | last_msg_at: ${r.bot_last_msg_at}`);
  console.log(`  appointment: ${r.bot_appointment_at} | retake: ${r.bot_retake_scheduled_at}`);
  console.log(`  tags: ${JSON.stringify(r.tags)}`);
  console.log(`  last_synced_at: ${r.last_synced_at}`);
  console.log(`  total_eventos: ${r.total_eventos}`);

  const sixH = Date.now() - 6*3600*1000;
  const recent = (r.eventos || []).filter(e => e.fecha && new Date(e.fecha).getTime() > sixH).slice(-30);
  console.log(`\n  EVENTOS últimas 6h (${recent.length}):`);
  for (const e of recent) {
    const c = (e.cuerpo || '').replace(/\s+/g,' ').slice(0,160);
    console.log(`    [${e.fecha}] ${e.tipo}/${e.direccion} emisor=${e.emisor} ghl_id=${e.ghl_id || 'null'}`);
    console.log(`       "${c}"`);
  }
}
process.exit(0);
