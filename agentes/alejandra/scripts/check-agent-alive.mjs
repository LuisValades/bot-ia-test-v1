// Verifica si el agente n8n está respondiendo activamente: busca outbounds
// en los últimos 60 min en GHL para leads de stage Bot IA con tag bot ia.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);
const ghl = axios.create({
  baseURL: process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com',
  headers: {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: '2021-07-28'
  },
  timeout: 30000
});
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const now = Date.now();
const SINCE_MIN = 60;
const sinceMs = now - SINCE_MIN * 60_000;

const { data: leads } = await supabase
  .from('leads')
  .select('contact_id, nombre, bot_full_name, telefono, tags, stage_name')
  .in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA'])
  .order('ghl_updated_at', { ascending: false });

const withTag = (leads || []).filter(l => Array.isArray(l.tags) && l.tags.includes('bot ia'));
console.log(`\n🔎 Buscando actividad outbound del agente en últimos ${SINCE_MIN} min`);
console.log(`   ${withTag.length} leads con tag bot ia en stages Bot IA\n`);

let totalOutboundRecent = 0;
let totalInboundRecent = 0;
const pendingInbound = [];

for (const l of withTag) {
  let messages = [];
  try {
    const r = await ghl.get('/conversations/search', {
      params: { contactId: l.contact_id, locationId: LOCATION_ID, limit: 1 }
    });
    const conv = r.data?.conversations?.[0];
    if (conv) {
      const m = await ghl.get(`/conversations/${conv.id}/messages`, { params: { limit: 20 } });
      messages = m.data?.messages?.messages || m.data?.messages || [];
    }
  } catch (err) { continue; }

  const real = messages.filter(m =>
    m.body && m.direction &&
    !/^(Opportunity (updated|created|moved)|Tag added|Tag removed|Pipeline|Stage |\{ ?WA#|Nuevo Lead asignado|NO RESPONDE CANCELA|cliente toma sesion)/i.test(m.body)
  );
  const recentOut = real.filter(m => m.direction === 'outbound' && m.dateAdded && new Date(m.dateAdded).getTime() > sinceMs);
  const recentIn = real.filter(m => m.direction === 'inbound' && m.dateAdded && new Date(m.dateAdded).getTime() > sinceMs);
  totalOutboundRecent += recentOut.length;
  totalInboundRecent += recentIn.length;

  if (recentOut.length > 0) {
    const name = l.bot_full_name || l.nombre;
    console.log(`✅ ${name}: agente respondió ${recentOut.length}x en últimos ${SINCE_MIN}min`);
    recentOut.forEach(m => {
      const min = Math.round((now - new Date(m.dateAdded).getTime()) / 60_000);
      console.log(`   hace ${min}min: "${(m.body || '').slice(0, 100)}"`);
    });
  }

  // ¿Lead escribió recientemente sin respuesta?
  if (recentIn.length > 0) {
    const lastIn = recentIn[recentIn.length - 1];
    const lastInTs = new Date(lastIn.dateAdded).getTime();
    const lastOutAny = [...real].reverse().find(m => m.direction === 'outbound');
    const lastOutTs = lastOutAny ? new Date(lastOutAny.dateAdded).getTime() : 0;
    if (lastInTs > lastOutTs) {
      const name = l.bot_full_name || l.nombre;
      const min = Math.round((now - lastInTs) / 60_000);
      pendingInbound.push({ name, lead: l, min, msg: lastIn.body });
    }
  }
  await new Promise(r => setTimeout(r, 150));
}

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`  RESULTADO (ventana ${SINCE_MIN}min)`);
console.log(`═══════════════════════════════════════════════════════════`);
console.log(`  Inbounds de leads:                  ${totalInboundRecent}`);
console.log(`  Outbounds del agente:                ${totalOutboundRecent}`);
if (totalOutboundRecent > 0) {
  console.log(`\n  ✅ EL AGENTE ESTÁ VIVO — respondió ${totalOutboundRecent}x`);
} else if (totalInboundRecent > 0) {
  console.log(`\n  🔴 AGENTE MUERTO — leads escribieron pero NINGUNA respuesta del agente`);
} else {
  console.log(`\n  ⚪ SIN ACTIVIDAD — no hubo inbounds en esta ventana, no se puede confirmar`);
}

if (pendingInbound.length > 0) {
  console.log(`\n  🔴 ${pendingInbound.length} LEAD(S) ESPERANDO RESPUESTA:`);
  for (const p of pendingInbound) {
    console.log(`     ${p.name} (hace ${p.min}min): "${(p.msg || '').slice(0, 80)}"`);
  }
}
console.log(`═══════════════════════════════════════════════════════════\n`);
process.exit(0);
