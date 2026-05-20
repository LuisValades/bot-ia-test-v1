import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data } = await s.from('leads').select('*').limit(1).single();
if (data) {
  console.log('Columns:', Object.keys(data).sort().join('\n  - '));
}
process.exit(0);
