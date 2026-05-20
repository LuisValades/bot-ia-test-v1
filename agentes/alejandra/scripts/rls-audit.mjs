// Audita estado RLS de todas las tablas en schema public
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

const { data, error } = await supabase.rpc('exec_sql', {
  query: "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY rowsecurity, tablename"
}).single();

if (error) {
  // Fallback: si exec_sql no existe, usar el REST con SQL via fetch
  console.log('exec_sql no disponible, intentando vía SQL endpoint directo...\n');
  const url = process.env.SUPABASE_URL.replace(/\/$/, '');
  const r = await fetch(url + '/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY,
      'Authorization': 'Bearer ' + (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY)
    },
    body: JSON.stringify({ query: 'SELECT 1' })
  });
  if (!r.ok) {
    console.error('Status:', r.status);
    console.error(await r.text());
  }

  // Alternativa: enumerar tablas conocidas por el código
  console.log('Probando lectura de tablas conocidas del proyecto:\n');
  const knownTables = ['leads', 'feedback', 'conversations', 'leads_archive', 'bot_state', 'eventos'];
  for (const t of knownTables) {
    const { error: tErr, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (tErr) {
      console.log(`  ${t.padEnd(20)} → ❌ ${tErr.message}`);
    } else {
      console.log(`  ${t.padEnd(20)} → ✅ existe (${count} filas)`);
    }
  }
  process.exit(0);
}

console.log('Tablas en schema public:');
console.log(data);
process.exit(0);
