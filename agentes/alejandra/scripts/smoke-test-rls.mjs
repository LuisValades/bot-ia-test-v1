// Smoke test post-RLS: confirma que service_key sigue funcionando
// y que anon_key (si está disponible) está correctamente bloqueado.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  SMOKE TEST POST-RLS — Luis GHL BOT Project');
console.log('═══════════════════════════════════════════════════════════\n');

const svc = createClient(URL, SERVICE);

// TEST 1 — Read leads count con service_key
console.log('TEST 1 · READ leads con SERVICE_KEY');
const { count: leadsCount, error: e1 } = await svc.from('leads').select('*', { count: 'exact', head: true });
if (e1) {
  console.log(`  ❌ FALLO: ${e1.message}`);
} else {
  console.log(`  ✅ OK — ${leadsCount} filas accesibles`);
}

// TEST 2 — Read 1 lead con datos sensibles
console.log('\nTEST 2 · READ 1 lead con campos sensibles');
const { data: oneLead, error: e2 } = await svc.from('leads').select('contact_id, nombre, telefono, bot_stage, stage_name').limit(1).single();
if (e2) {
  console.log(`  ❌ FALLO: ${e2.message}`);
} else {
  console.log(`  ✅ OK — ejemplo: ${oneLead.nombre || '(sin nombre)'} (${oneLead.telefono || '(sin tel)'}) stage=${oneLead.stage_name}`);
}

// TEST 3 — Write (UPDATE no-op) con service_key
console.log('\nTEST 3 · WRITE (UPDATE no-op) con SERVICE_KEY');
const testContactId = oneLead?.contact_id;
if (testContactId) {
  const { error: e3 } = await svc.from('leads')
    .update({ synced_at: new Date().toISOString() })
    .eq('contact_id', testContactId);
  if (e3) {
    console.log(`  ❌ FALLO: ${e3.message}`);
  } else {
    console.log(`  ✅ OK — update aplicado a ${testContactId.slice(0, 12)}...`);
  }
}

// TEST 4 — RPC/query a otras tablas que usan los agentes
console.log('\nTEST 4 · READ otras tablas usadas por n8n');
for (const t of ['eventos', 'feedback', 'conversations', 'bot_state', 'leads_archive']) {
  const { count, error } = await svc.from(t).select('*', { count: 'exact', head: true });
  if (error) {
    console.log(`  ❌ ${t.padEnd(18)} → ${error.message}`);
  } else {
    console.log(`  ✅ ${t.padEnd(18)} → ${count ?? 0} filas`);
  }
}

// TEST 5 — Confirmar bloqueo con ANON_KEY (si está en .env)
console.log('\nTEST 5 · BLOQUEO con ANON_KEY (debe FALLAR para confirmar RLS activo)');
if (!ANON) {
  console.log('  ⚪ SKIP — SUPABASE_ANON_KEY no está en .env (esperado en setup server-only)');
} else {
  const anonClient = createClient(URL, ANON);
  const { data: anonData, error: anonErr, count: anonCount } = await anonClient.from('leads').select('contact_id', { count: 'exact', head: true });
  if (anonErr) {
    console.log(`  ✅ BLOQUEADO correctamente — ${anonErr.message}`);
  } else if (anonCount === 0 || anonCount === null) {
    console.log(`  ✅ BLOQUEADO correctamente — anon_key ve 0 filas (RLS niega sin policy)`);
  } else {
    console.log(`  🔴 ALERTA — anon_key todavía puede leer ${anonCount} filas. RLS no aplica?`);
  }
}

// TEST 6 — Verificar vista vw_conversaciones
console.log('\nTEST 6 · READ vista vw_conversaciones con SERVICE_KEY');
const { count: vwCount, error: e6 } = await svc.from('vw_conversaciones').select('*', { count: 'exact', head: true });
if (e6) {
  console.log(`  ⚠️  ${e6.message}`);
} else {
  console.log(`  ✅ OK — ${vwCount ?? 0} filas (vista funciona con security_invoker=true)`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  RESULTADO');
console.log('═══════════════════════════════════════════════════════════');
console.log('  Si los TESTS 1-4 y 6 dieron ✅ y el TEST 5 dio ✅ BLOQUEADO:');
console.log('  → Bot funcional con seguridad cerrada. Listo para producción.');
console.log('═══════════════════════════════════════════════════════════\n');
process.exit(0);
