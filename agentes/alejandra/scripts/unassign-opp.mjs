import 'dotenv/config';
import axios from 'axios';

const contactId = process.argv[2];
if (!contactId) { console.error('uso: unassign-opp.mjs <contactId>'); process.exit(1); }

const BASE = process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
const TOKEN = process.env.GHL_API_TOKEN;

const headers = { Authorization: `Bearer ${TOKEN}`, Version: '2021-07-28', 'Content-Type': 'application/json' };

const oppsResp = await axios.get(`${BASE}/opportunities/search?location_id=${process.env.GHL_LOCATION_ID}&contact_id=${contactId}`, { headers });
const opps = oppsResp.data?.opportunities || [];
console.log(`encontré ${opps.length} opp(s) para ${contactId}`);

for (const opp of opps) {
  console.log(`  → ${opp.id} (assignedTo=${opp.assignedTo || 'none'}) — desasignando…`);
  try {
    await axios.put(`${BASE}/opportunities/${opp.id}`, { assignedTo: null }, { headers });
    console.log(`     ✅`);
  } catch (err) {
    console.error(`     ❌`, err.response?.data?.message || err.message);
  }
}
process.exit(0);
