// Auditoría completa de una opp + su conversación
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const INPUT_ID = process.argv[2] || '7MffKyNU4S0CwE6HYJWC';
// El ID puede ser contact OR opp — intentamos resolver
let OPP_ID = INPUT_ID;
let CONTACT_ID_HINT = null;

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
const LOC = process.env.GHL_LOCATION_ID;

console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
console.log(`║  AUDITORÍA OPP — ${OPP_ID}              ║`);
console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);

// 1. Resolver ID — primero intentar como CONTACT (más común en GHL UI URLs)
let opp = null, contactId = null;
try {
  const cr = await ghl.get(`/contacts/${INPUT_ID}`);
  if (cr.data?.contact) {
    contactId = INPUT_ID;
    console.log(`📋 Es CONTACT_ID directamente. Buscando opp asociado...`);
    // Buscar opp en Supabase
    const { data: lookup } = await supabase
      .from('leads')
      .select('opp_id')
      .eq('contact_id', INPUT_ID)
      .single();
    if (lookup?.opp_id) {
      OPP_ID = lookup.opp_id;
      const r = await ghl.get(`/opportunities/${OPP_ID}`);
      opp = r.data?.opportunity;
    }
  }
} catch (err) {
  // No es contact, intentar como opp
  try {
    const r = await ghl.get(`/opportunities/${INPUT_ID}`);
    opp = r.data?.opportunity;
    contactId = opp?.contactId || opp?.contact?.id;
  } catch (err2) {
    console.log(`❌ Ni contact ni opp: ${err2.message}`);
    process.exit(1);
  }
}
console.log(`📋 OPP:`);
console.log(`   id:               ${OPP_ID}`);
console.log(`   name:             ${opp?.name}`);
console.log(`   pipeline_id:      ${opp?.pipelineId}`);
console.log(`   stage_id:         ${opp?.pipelineStageId}`);
console.log(`   assignedTo:       ${opp?.assignedTo}`);
console.log(`   monetary value:   ${opp?.monetaryValue}`);
console.log(`   contactId:        ${contactId}`);
console.log(`   created:          ${opp?.createdAt}`);
console.log(`   updated:          ${opp?.updatedAt}`);

// 2. Pull contact
let contact = null;
if (contactId) {
  try {
    const r = await ghl.get(`/contacts/${contactId}`);
    contact = r.data?.contact;
    console.log(`\n👤 CONTACTO:`);
    console.log(`   name:           ${contact?.firstName} ${contact?.lastName}`);
    console.log(`   phone:          ${contact?.phone}`);
    console.log(`   email:          ${contact?.email}`);
    console.log(`   tags:           ${(contact?.tags||[]).join(', ')}`);
    console.log(`   dateAdded:      ${contact?.dateAdded}`);
  } catch (err) {
    console.log(`❌ contact fetch: ${err.message}`);
  }
}

// 3. Pull Supabase state
if (contactId) {
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('contact_id', contactId)
    .single();
  if (lead) {
    console.log(`\n📊 SUPABASE STATE:`);
    console.log(`   stage_name:                ${lead.stage_name}`);
    console.log(`   pipeline_name:             ${lead.pipeline_name}`);
    console.log(`   bot_stage:                 ${lead.bot_stage}`);
    console.log(`   bot_followup_count:        ${lead.bot_followup_count}`);
    console.log(`   bot_last_decision:         ${lead.bot_last_decision}`);
    console.log(`   bot_last_decision_at:      ${lead.bot_last_decision_at}`);
    console.log(`   bot_skip_reason:           ${lead.bot_skip_reason || '-'}`);
    console.log(`   bot_postpone_until:        ${lead.bot_postpone_until || '-'}`);
    console.log(`   bot_appointment_at:        ${lead.bot_appointment_at || '-'}`);
    console.log(`   bot_profile:               ${JSON.stringify(lead.bot_profile || {})}`);
    console.log(`   eventos count:             ${(lead.eventos||[]).length}`);
  }
}

// 4. Pull conversación completa
console.log(`\n💬 CONVERSACIÓN GHL (orden cronológico):`);
try {
  const conv = await ghl.get('/conversations/search', {
    params: { contactId, locationId: LOC, limit: 1 }
  });
  const c = conv.data?.conversations?.[0];
  if (c) {
    console.log(`   conversation_id: ${c.id}`);
    const m = await ghl.get(`/conversations/${c.id}/messages`, { params: { limit: 100 } });
    const msgs = m.data?.messages?.messages || m.data?.messages || [];
    msgs.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
    console.log(`   total: ${msgs.length} mensajes\n`);

    // Filtrar system messages
    const real = msgs.filter(x => x.body && !/^(Opportunity (updated|created|moved)|Tag added|Tag removed|Pipeline|Stage |\{ ?WA#|Nuevo Lead asignado|Lead \*TYPEFORM\*|Nuevo Lead TPV)/i.test(x.body));

    for (const msg of real) {
      const ts = (msg.dateAdded || '').slice(0, 19).replace('T', ' ');
      const dir = msg.direction === 'inbound' ? '⬅️ LEAD ' : '➡️ AGENT';
      const userId = msg.userId ? `[u=${msg.userId.slice(0,8)}]` : '[no user]';
      const body = (msg.body || '').replace(/\s+/g, ' ').trim();
      console.log(`   ${ts} ${dir} ${userId}`);
      console.log(`     "${body}"`);
      console.log('');
    }
  }
} catch (err) {
  console.log(`   ❌ ${err.response?.data?.message || err.message}`);
}

// 5. Notas
console.log(`📝 NOTAS GHL:`);
try {
  const r = await ghl.get(`/contacts/${contactId}/notes`);
  const notes = r.data?.notes || [];
  for (const n of notes.slice(0, 5)) {
    const ts = (n.dateAdded || '').slice(0, 19).replace('T', ' ');
    const body = (n.body || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    console.log(`   ${ts}: ${body}`);
  }
} catch (err) {
  console.log(`   ❌ ${err.message}`);
}

console.log(`\n╚══════════════════════════════════════════════════════════════════╝\n`);
process.exit(0);
