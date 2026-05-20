import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const { data } = await s
  .from('leads')
  .select('contact_id, bot_full_name, bot_stage, bot_followup_count, bot_last_msg_at, tags, stage_name, pipeline_name, last_synced_at')
  .eq('contact_id', 'F1OIt6R63IR8gFWu4Yx6')
  .single();

console.log('=== LUIS VALADES en Supabase ===');
console.log(JSON.stringify(data, null, 2));
process.exit(0);
