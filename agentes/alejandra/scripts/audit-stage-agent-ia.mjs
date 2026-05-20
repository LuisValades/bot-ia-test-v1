// Auditoría completa de leads en stage "Ingreso - Test Agent IA" con tag "bot ia".
// Para cada lead: estado, último mensaje del bot, último mensaje del lead,
// pull de mensajes GHL recientes, gap (cuánto tiempo lleva sin respuesta).
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

// 1. Pull todos los leads del stage objetivo
const { data: leads, error } = await supabase
  .from('leads')
  .select('contact_id, opp_id, nombre, bot_full_name, telefono, tags, stage_name, pipeline_name, bot_stage, bot_followup_count, bot_last_msg_at, bot_retake_scheduled_at, bot_appointment_at, ultima_actividad, ghl_updated_at, synced_at')
  .eq('stage_name', 'Ingreso - Test Agent IA')
  .order('ghl_updated_at', { ascending: false });

if (error) { console.error(error); process.exit(1); }

const withTag = (leads || []).filter(l => Array.isArray(l.tags) && l.tags.includes('bot ia'));
const withoutTag = (leads || []).filter(l => !Array.isArray(l.tags) || !l.tags.includes('bot ia'));

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`  AUDITORÍA — Stage "Ingreso - Test Agent IA"`);
console.log('═══════════════════════════════════════════════════════════');
console.log(`  Total leads en stage:        ${leads?.length || 0}`);
console.log(`  ✅ Con tag "bot ia":         ${withTag.length}  ← DEBEN RECIBIR RESPUESTA`);
console.log(`  ⚠️  SIN tag "bot ia":         ${withoutTag.length}  ← no aplican al agente`);
console.log('═══════════════════════════════════════════════════════════\n');

// 2. Para cada lead con tag bot ia, pull GHL conversación reciente
console.log('── ANÁLISIS POR LEAD (los que DEBEN recibir respuesta) ──\n');

let pendingResponse = 0;
let respondedRecently = 0;
let neverResponded = 0;

for (let i = 0; i < withTag.length; i++) {
  const l = withTag[i];
  const name = l.bot_full_name || l.nombre || '(sin nombre)';
  const tag = `[${i + 1}/${withTag.length}] ${name}`;

  // Pull conversation
  let messages = [];
  let conversationId = null;
  try {
    const r = await ghl.get('/conversations/search', {
      params: { contactId: l.contact_id, locationId: LOCATION_ID, limit: 1 }
    });
    const conv = r.data?.conversations?.[0];
    if (conv) {
      conversationId = conv.id;
      const m = await ghl.get(`/conversations/${conv.id}/messages`, { params: { limit: 20 } });
      messages = m.data?.messages?.messages || m.data?.messages || [];
    }
  } catch (err) {
    console.log(`${tag} → ❌ error pull GHL: ${err.response?.data?.message || err.message}\n`);
    continue;
  }

  // Sort messages by date
  messages.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
  const inbound = messages.filter(m => m.direction === 'inbound');
  const outbound = messages.filter(m => m.direction === 'outbound');

  const lastInbound = inbound[inbound.length - 1];
  const lastOutbound = outbound[outbound.length - 1];

  const lastInboundMin = lastInbound?.dateAdded ? Math.round((now - new Date(lastInbound.dateAdded).getTime()) / 60_000) : null;
  const lastOutboundMin = lastOutbound?.dateAdded ? Math.round((now - new Date(lastOutbound.dateAdded).getTime()) / 60_000) : null;

  // Clasificación
  let status = '';
  let urgency = '';
  if (!lastInbound) {
    status = 'sin mensajes entrantes (lead nunca escribió)';
    urgency = '⚪';
  } else if (!lastOutbound) {
    status = `lead escribió hace ${lastInboundMin}min, BOT NUNCA RESPONDIÓ`;
    urgency = '🔴';
    neverResponded++;
    pendingResponse++;
  } else if (new Date(lastInbound.dateAdded) > new Date(lastOutbound.dateAdded)) {
    const gap = lastInboundMin;
    status = `lead escribió hace ${gap}min, último bot hace ${lastOutboundMin}min — PENDIENTE RESPONDER`;
    urgency = gap < 60 ? '🔴' : (gap < 360 ? '🟡' : '⚪');
    if (gap < 24 * 60) pendingResponse++;
  } else {
    status = `bot respondió hace ${lastOutboundMin}min (después del lead) — OK`;
    urgency = '✅';
    respondedRecently++;
  }

  console.log(`${urgency} ${tag}`);
  console.log(`   tel:        ${l.telefono}`);
  console.log(`   bot_stage:  ${l.bot_stage || 'null'} | followups ${l.bot_followup_count || 0}/3`);
  console.log(`   mensajes:   ${inbound.length} in, ${outbound.length} out (total ${messages.length})`);
  console.log(`   estado:     ${status}`);
  if (lastInbound) {
    const txt = (lastInbound.body || '').replace(/\s+/g, ' ').slice(0, 100);
    console.log(`   último lead: "${txt}"`);
  }
  if (lastOutbound) {
    const txt = (lastOutbound.body || '').replace(/\s+/g, ' ').slice(0, 100);
    console.log(`   último bot:  "${txt}"`);
  }
  console.log('');

  // Throttle GHL API
  await new Promise(r => setTimeout(r, 200));
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  RESUMEN AUDITORÍA');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  🔴 Bot NUNCA respondió (lead escribió y nada):    ${neverResponded}`);
console.log(`  🔴 Pendiente respuesta (gap < 24h):               ${pendingResponse}`);
console.log(`  ✅ Bot respondió después del último lead (OK):    ${respondedRecently}`);
console.log('═══════════════════════════════════════════════════════════\n');

// 3. Leads SIN tag bot ia en este stage
if (withoutTag.length > 0) {
  console.log('── LEADS SIN TAG "bot ia" EN ESTE STAGE ──');
  console.log(`(${withoutTag.length} leads, NO los procesa el agente — verificar si deben tener la tag)\n`);
  for (const l of withoutTag) {
    const name = l.bot_full_name || l.nombre || '(sin nombre)';
    console.log(`  ⚠️  ${name} · ${l.telefono} · tags: [${(l.tags || []).join(', ') || 'sin tags'}]`);
  }
}

process.exit(0);
