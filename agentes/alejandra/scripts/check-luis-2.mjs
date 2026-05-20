import 'dotenv/config';
import axios from 'axios';

const TOKEN = process.env.GHL_API_TOKEN;
const BASE = process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
const LOC = process.env.GHL_LOCATION_ID;
const contactId = 'F1OIt6R63IR8gFWu4Yx6';

const H = { Authorization: `Bearer ${TOKEN}`, Version: '2021-04-15' };
const H2 = { Authorization: `Bearer ${TOKEN}`, Version: '2021-07-28' };

// 1. Estado actual del contacto
console.log('=== TAGS Y ASIGNACIÓN ===');
const c = (await axios.get(`${BASE}/contacts/${contactId}`, { headers: H2 })).data.contact;
console.log(`tags: ${JSON.stringify(c.tags)}`);
console.log(`assignedTo: ${c.assignedTo}`);

// 2. Stage actual
console.log('\n=== OPPORTUNITY ACTUAL ===');
const opps = (await axios.get(`${BASE}/opportunities/search?location_id=${LOC}&contact_id=${contactId}`, { headers: H2 })).data;
const pipelines = (await axios.get(`${BASE}/opportunities/pipelines?locationId=${LOC}`, { headers: H2 })).data.pipelines;
for (const o of (opps.opportunities || [])) {
  const pip = pipelines.find(p => p.id === o.pipelineId);
  const stage = pip?.stages?.find(s => s.id === o.pipelineStageId);
  console.log(`  ${o.id} | pipeline=${pip?.name} | stage=${stage?.name}`);
}

// 3. Conversaciones del contacto
console.log('\n=== CONVERSACIONES ===');
const convs = (await axios.get(`${BASE}/conversations/search?locationId=${LOC}&contactId=${contactId}`, { headers: H2 })).data;
for (const cv of (convs.conversations || [])) {
  console.log(`  ${cv.id} | type=${cv.type}`);
}

// 4. Tomar primera conversation y mostrar últimos 10 mensajes con TODO el shape
const convId = convs.conversations?.[0]?.id;
if (convId) {
  console.log(`\n=== ÚLTIMOS 10 MENSAJES en conv ${convId} ===`);
  const msgs = (await axios.get(`${BASE}/conversations/${convId}/messages?limit=15`, { headers: H2 })).data;
  const list = msgs.messages?.messages || msgs.messages || [];
  // Ordenar por fecha
  const sorted = list.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
  for (const m of sorted.slice(-10)) {
    console.log(`\n  --- Mensaje ${m.id} ---`);
    console.log(`  fecha: ${m.dateAdded}`);
    console.log(`  type: ${m.type} | direction: ${m.direction}`);
    console.log(`  body: "${(m.body || '').slice(0, 100)}"`);
    if (m.attachments && m.attachments.length > 0) {
      console.log(`  ★ ATTACHMENTS (${m.attachments.length}):`);
      for (const a of m.attachments) {
        console.log(`    - ${typeof a === 'string' ? a : JSON.stringify(a)}`);
      }
    }
    if (m.meta) console.log(`  meta: ${JSON.stringify(m.meta)}`);
  }
}
process.exit(0);
