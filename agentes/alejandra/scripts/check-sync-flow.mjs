import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

const now = Date.now();

// Lo más reciente sincronizado
const { data: latest } = await supabase
  .from('leads')
  .select('contact_id, nombre, telefono, stage_name, pipeline_name, synced_at, ghl_updated_at, ultima_actividad')
  .order('synced_at', { ascending: false })
  .limit(10);

console.log('\n=== ÚLTIMOS 10 LEADS SINCRONIZADOS ===\n');
for (const l of latest || []) {
  const syncedMin = l.synced_at ? Math.round((now - new Date(l.synced_at).getTime()) / 60000) : null;
  const updatedMin = l.ghl_updated_at ? Math.round((now - new Date(l.ghl_updated_at).getTime()) / 60000) : null;
  const actMin = l.ultima_actividad ? Math.round((now - new Date(l.ultima_actividad).getTime()) / 60000) : null;
  console.log(`▸ ${l.nombre || '(sin nombre)'} · ${l.pipeline_name} / ${l.stage_name}`);
  console.log(`  synced_at:        ${syncedMin !== null ? `hace ${syncedMin}min (${l.synced_at})` : 'null'}`);
  console.log(`  ghl_updated_at:   ${updatedMin !== null ? `hace ${updatedMin}min` : 'null'}`);
  console.log(`  ultima_actividad: ${actMin !== null ? `hace ${actMin}min` : 'null'}`);
  console.log('');
}

// Conteo de leads sincronizados en distintas ventanas de tiempo
const buckets = [
  { label: '< 5 min',  ms: 5 * 60_000 },
  { label: '< 15 min', ms: 15 * 60_000 },
  { label: '< 1 h',    ms: 60 * 60_000 },
  { label: '< 6 h',    ms: 6 * 60 * 60_000 },
  { label: '< 24 h',   ms: 24 * 60 * 60_000 }
];

console.log('\n=== ACTIVIDAD DE SYNC POR VENTANA ===\n');
for (const b of buckets) {
  const cutoff = new Date(now - b.ms).toISOString();
  const { count: syncedCount } = await supabase
    .from('leads')
    .select('contact_id', { count: 'exact', head: true })
    .gte('synced_at', cutoff);
  const { count: updatedCount } = await supabase
    .from('leads')
    .select('contact_id', { count: 'exact', head: true })
    .gte('ghl_updated_at', cutoff);
  console.log(`  ${b.label.padEnd(10)} → synced: ${syncedCount ?? '?'} | ghl_updated: ${updatedCount ?? '?'}`);
}

// Total de filas
const { count: total } = await supabase
  .from('leads')
  .select('contact_id', { count: 'exact', head: true });
console.log(`\nTotal de leads en Supabase: ${total}`);

process.exit(0);
