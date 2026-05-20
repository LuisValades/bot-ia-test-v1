import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

const now = Date.now();

// 1. Leads con sync reciente (15 min)
const cutoff = new Date(now - 15 * 60_000).toISOString();
const { data: synced } = await supabase
  .from('leads')
  .select('contact_id, nombre, telefono, stage_name, synced_at, ghl_updated_at, ultima_actividad, eventos')
  .or(`synced_at.gte.${cutoff},ghl_updated_at.gte.${cutoff},ultima_actividad.gte.${cutoff}`)
  .order('synced_at', { ascending: false })
  .limit(20);

console.log(`\n=== LEADS CON ACTIVIDAD EN ÚLTIMOS 15 MIN ===\n`);
if (!synced || synced.length === 0) {
  console.log('(ninguno — n8n no ha sincronizado nada reciente)');
} else {
  for (const l of synced) {
    const syncMin = l.synced_at ? Math.round((now - new Date(l.synced_at).getTime()) / 60000) : null;
    const updMin = l.ghl_updated_at ? Math.round((now - new Date(l.ghl_updated_at).getTime()) / 60000) : null;
    const actMin = l.ultima_actividad ? Math.round((now - new Date(l.ultima_actividad).getTime()) / 60000) : null;
    console.log(`▸ ${l.nombre || '(sin nombre)'} · ${l.telefono} · ${l.stage_name}`);
    console.log(`  synced=${syncMin}min · upd=${updMin}min · actividad=${actMin}min`);
    const evs = (l.eventos || []).slice(-5);
    if (evs.length > 0) {
      console.log(`  últimos eventos:`);
      for (const e of evs) {
        const ts = e.fecha ? new Date(e.fecha).toISOString().slice(11, 16) : '??:??';
        const txt = (e.texto || e.body || '').replace(/\s+/g, ' ').slice(0, 60);
        console.log(`    [${ts}] ${e.tipo || '?'} ${e.direccion || ''} → ${txt}`);
      }
    }
    console.log('');
  }
}

// 2. Buscar específicamente por phone si hay algún test reciente. El número que envió HOLA TEST.
console.log('\n=== BÚSQUEDA POR LEAD "TEST" / "Luis Valades" ===\n');
const { data: testLeads } = await supabase
  .from('leads')
  .select('contact_id, nombre, telefono, stage_name, eventos')
  .or('nombre.ilike.%luis%,nombre.ilike.%test%')
  .limit(10);

for (const l of testLeads || []) {
  const evs = (l.eventos || []);
  const recent = evs.filter(e => e.fecha && (now - new Date(e.fecha).getTime()) < 30 * 60_000);
  if (recent.length > 0) {
    console.log(`▸ ${l.nombre} · ${l.telefono}`);
    console.log(`  ${recent.length} eventos en últimos 30 min:`);
    for (const e of recent.slice(-10)) {
      const ts = e.fecha ? new Date(e.fecha).toISOString().slice(11, 19) : '?';
      const txt = (e.texto || e.body || '').replace(/\s+/g, ' ').slice(0, 80);
      console.log(`    [${ts}] ${e.tipo || '?'} ${e.direccion || e.direction || ''} → "${txt}"`);
    }
    console.log('');
  }
}

process.exit(0);
