import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data } = await s
  .from('leads')
  .select('contact_id, bot_full_name, nombre, telefono, bot_stage, bot_followup_count, bot_last_msg_at, ultima_actividad, ghl_updated_at, ghl_created_at, synced_at, last_synced_at, tags, stage_name, pipeline_name, total_eventos, eventos')
  .or('stage_name.eq.Ingreso - Test Agent IA,stage_name.eq.Bot IA');

const withTagBotIa = (data || []).filter(r => Array.isArray(r.tags) && r.tags.includes('bot ia'));

console.log(`Total con tag "bot ia" en Test Agente IA: ${withTagBotIa.length}\n`);

for (const r of withTagBotIa) {
  const baseline = r.bot_last_msg_at || r.ultima_actividad || r.ghl_updated_at || r.synced_at;
  const ageMin = baseline ? Math.round((Date.now() - new Date(baseline).getTime()) / 60000) : null;
  const numEventos = (r.eventos || []).length;
  const lastEvento = (r.eventos || [])[(r.eventos || []).length - 1];

  console.log(`▸ ${r.bot_full_name || r.nombre}`);
  console.log(`  pipeline=${r.pipeline_name} | bot_stage=${r.bot_stage} | total_eventos=${r.total_eventos || 0} (eventos[]=${numEventos})`);
  console.log(`  bot_last_msg_at:  ${r.bot_last_msg_at || 'null'}`);
  console.log(`  ultima_actividad: ${r.ultima_actividad || 'null'}`);
  console.log(`  ghl_updated_at:   ${r.ghl_updated_at || 'null'}`);
  console.log(`  ghl_created_at:   ${r.ghl_created_at || 'null'}`);
  console.log(`  synced_at:        ${r.synced_at || 'null'}`);
  console.log(`  last_synced_at:   ${r.last_synced_at || 'null'}`);
  console.log(`  → baseline elegido: ${baseline || 'NINGUNO'} (edad=${ageMin}min)`);
  if (lastEvento) {
    console.log(`  último evento eventos[]: tipo=${lastEvento.tipo} fecha=${lastEvento.fecha} emisor=${lastEvento.emisor}`);
  }
  console.log('');
}
process.exit(0);
