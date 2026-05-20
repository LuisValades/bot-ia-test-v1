import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

const { data } = await supabase
  .from('leads')
  .select('contact_id, bot_full_name, eventos')
  .eq('contact_id', process.argv[2])
  .single();

console.log('lead:', data?.bot_full_name);
console.log('total eventos:', (data?.eventos || []).length);
console.log('first 3 eventos:', JSON.stringify((data?.eventos || []).slice(0, 3), null, 2));
console.log('last 3 eventos:', JSON.stringify((data?.eventos || []).slice(-3), null, 2));
process.exit(0);
