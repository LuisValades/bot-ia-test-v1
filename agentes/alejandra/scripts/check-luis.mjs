import 'dotenv/config';
import axios from 'axios';

const TOKEN = process.env.GHL_API_TOKEN;
const BASE = process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
const contactId = 'F1OIt6R63IR8gFWu4Yx6';

const r = await axios.get(`${BASE}/contacts/${contactId}`, {
  headers: { Authorization: `Bearer ${TOKEN}`, Version: '2021-07-28' }
});
const c = r.data.contact;
console.log(`\n=== ${c.firstName} ${c.lastName} ===`);
console.log(`tags: ${JSON.stringify(c.tags)}`);
console.log(`assignedTo: ${c.assignedTo}`);

// Buscar opportunities
const oppsR = await axios.get(`${BASE}/opportunities/search?location_id=${process.env.GHL_LOCATION_ID}&contact_id=${contactId}`, {
  headers: { Authorization: `Bearer ${TOKEN}`, Version: '2021-07-28' }
});
console.log(`\nOpps: ${oppsR.data.opportunities?.length || 0}`);
for (const o of (oppsR.data.opportunities || [])) {
  console.log(`  ${o.id} | pipeline=${o.pipelineName || o.pipelineId} | stage=${o.pipelineStageName || o.pipelineStageId} | assignedTo=${o.assignedTo}`);
}
process.exit(0);
