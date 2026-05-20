// Verifica si la nueva regla determinista PYME ya está actuando.
// Busca evidencia en Supabase + GHL.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);
const ghl = axios.create({
  baseURL: 'https://services.leadconnectorhq.com',
  headers: {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: '2021-07-28'
  },
  timeout: 30000
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  VERIFICACIÓN — Regla PYME auto-registro (cnt=3)');
console.log('═══════════════════════════════════════════════════════════\n');

// CHECK 1 — leads PYME en stage Bot IA con bot_followup_count = 3 (target del trigger)
const PYME_PIPELINE_ID = '8NAp58xZbUzJJkQRkfn6';
const { data: cnt3Leads } = await supabase
  .from('leads')
  .select('contact_id, nombre, bot_full_name, telefono, bot_stage, bot_followup_count, bot_last_decision, bot_last_decision_at, bot_last_msg_at, tags, pipeline_name, stage_name')
  .eq('pipeline_id', PYME_PIPELINE_ID)
  .eq('bot_followup_count', 3);

console.log(`CHECK 1 · Leads PYME con bot_followup_count = 3 (candidatos del trigger):`);
console.log(`   ${cnt3Leads?.length || 0} encontrados\n`);
if ((cnt3Leads?.length || 0) > 0) {
  for (const l of cnt3Leads.slice(0, 10)) {
    const tags = (l.tags || []).join(',') || 'sin tags';
    const hasTag = (l.tags || []).includes('auto-registro-enviado');
    console.log(`  · ${(l.bot_full_name || l.nombre || '?').padEnd(28)} stage=${l.bot_stage} | tag auto-registro=${hasTag ? '✅ SÍ' : '❌ NO'} | last_decision=${l.bot_last_decision || 'null'}`);
  }
}

// CHECK 2 — leads con tag "auto-registro-enviado" (evidencia de que la regla ya disparó)
const { data: tagged } = await supabase
  .from('leads')
  .select('contact_id, nombre, bot_full_name, telefono, bot_followup_count, bot_last_decision, bot_last_decision_at, bot_last_msg_at, tags, pipeline_name, eventos')
  .filter('tags', 'cs', '{auto-registro-enviado}');

console.log(`\nCHECK 2 · Leads con tag 'auto-registro-enviado' (evidencia regla disparada):`);
console.log(`   ${tagged?.length || 0} encontrados\n`);
if ((tagged?.length || 0) > 0) {
  for (const l of tagged.slice(0, 10)) {
    const min = l.bot_last_msg_at ? Math.round((Date.now() - new Date(l.bot_last_msg_at).getTime()) / 60000) : null;
    console.log(`  ✅ ${(l.bot_full_name || l.nombre || '?').padEnd(28)} cnt=${l.bot_followup_count} | last_msg=${min !== null ? `hace ${min}min` : 'null'} | decision=${l.bot_last_decision}`);
    const lastEvent = (l.eventos || []).slice(-1)[0];
    if (lastEvent?.body) {
      console.log(`      último evento: "${lastEvent.body.slice(0, 100)}"`);
    }
  }
}

// CHECK 3 — leads con bot_last_decision con razon contenedora "pyme_auto_registro"
const { data: byReason } = await supabase
  .from('leads')
  .select('contact_id, nombre, bot_full_name, telefono, bot_followup_count, bot_last_decision, bot_last_decision_at')
  .filter('eventos', 'cs', '{"razon":"pyme_auto_registro_nudge4"}');

console.log(`\nCHECK 3 · Eventos con razon='pyme_auto_registro_nudge4':`);
console.log(`   ${byReason?.length || 0} encontrados (vía búsqueda en eventos[])\n`);

// CHECK 4 — buscar SMS reciente con texto característico del nuevo mensaje
console.log(`\nCHECK 4 · SMS outbound recientes con texto del nuevo mensaje:`);
console.log(`   (buscando "crediexpres.com/fondeadora" en últimos eventos)\n`);

const { data: allPyme } = await supabase
  .from('leads')
  .select('contact_id, nombre, bot_full_name, eventos, bot_last_msg_at')
  .eq('pipeline_id', PYME_PIPELINE_ID)
  .gte('bot_last_msg_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());

let foundCount = 0;
for (const l of allPyme || []) {
  const evs = (l.eventos || []);
  const hit = evs.find(e => (e.body || '').includes('crediexpres.com/fondeadora') || (e.body || '').includes('hay_cash') || (e.body || '').includes('finsus'));
  if (hit) {
    foundCount++;
    if (foundCount <= 5) {
      const fechaIso = hit.fecha || hit.timestamp || '';
      console.log(`  ✅ ${(l.bot_full_name || l.nombre).padEnd(28)} fecha=${fechaIso.slice(0,16)}`);
      console.log(`     "${(hit.body || '').slice(0, 120)}"`);
    }
  }
}
console.log(`\n   Total leads con SMS de auto-registro detectado: ${foundCount}`);

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  RESUMEN');
console.log('═══════════════════════════════════════════════════════════');
const triggered = (tagged?.length || 0) + foundCount;
if (triggered > 0) {
  console.log(`  ✅ REGLA APLICADA — ${triggered} señales encontradas`);
} else if ((cnt3Leads?.length || 0) > 0) {
  console.log(`  ⚪ REGLA NO HA DISPARADO TODAVÍA — ${cnt3Leads.length} candidatos esperando próxima ejecución del Orquestador`);
} else {
  console.log(`  ⚪ SIN CANDIDATOS PYME cnt=3 — no se puede probar la regla hasta que un lead llegue ahí`);
}
console.log('═══════════════════════════════════════════════════════════\n');
process.exit(0);
