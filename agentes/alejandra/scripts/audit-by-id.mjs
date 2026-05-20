// Try as opp OR contact OR conversation
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const ID = process.argv[2] || '7MffKyNU4S0CwE6HYJWC';

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

console.log(`\nProbando ID: ${ID}\n`);

// Try as contact
console.log('--- Try as CONTACT ---');
try {
  const r = await ghl.get(`/contacts/${ID}`);
  const c = r.data?.contact;
  if (c) {
    console.log(`✅ ES CONTACTO: ${c.firstName} ${c.lastName} · ${c.phone}`);
    console.log(`   contactId: ${c.id}`);
    console.log(`   tags: ${(c.tags||[]).join(', ')}`);

    // Find Supabase lead
    const { data: lead } = await supabase
      .from('leads')
      .select('contact_id, opp_id, stage_name, pipeline_name, bot_stage, bot_profile, bot_followup_count, bot_last_decision, bot_last_decision_at')
      .eq('contact_id', ID)
      .single();
    if (lead) {
      console.log(`\n   Supabase:`);
      console.log(`     opp_id:                ${lead.opp_id}`);
      console.log(`     stage:                 ${lead.pipeline_name} / ${lead.stage_name}`);
      console.log(`     bot_stage:             ${lead.bot_stage}`);
      console.log(`     bot_followup_count:    ${lead.bot_followup_count}`);
      console.log(`     bot_last_decision:     ${lead.bot_last_decision}`);
      console.log(`     bot_profile:           ${JSON.stringify(lead.bot_profile||{}).slice(0,200)}`);
    }
    process.exit(0);
  }
} catch (err) {
  console.log(`   no es contacto (${err.response?.data?.message || err.message})`);
}

// Try Supabase by opp_id
console.log('\n--- Try as OPP_ID in Supabase ---');
const { data: byOpp } = await supabase
  .from('leads')
  .select('*')
  .eq('opp_id', ID)
  .maybeSingle();
if (byOpp) {
  console.log(`✅ Encontrado en Supabase por opp_id`);
  console.log(`   contact_id:    ${byOpp.contact_id}`);
  console.log(`   nombre:        ${byOpp.bot_full_name || byOpp.nombre}`);
  console.log(`   stage:         ${byOpp.pipeline_name} / ${byOpp.stage_name}`);
  process.exit(0);
}

// Try as conversation
console.log('\n--- Try as CONVERSATION ---');
try {
  const m = await ghl.get(`/conversations/${ID}/messages`, { params: { limit: 1 } });
  if (m.data) {
    console.log(`✅ Es conversation_id`);
    console.log(`   messages: ${(m.data.messages?.messages || m.data.messages || []).length}`);
  }
} catch (err) {
  console.log(`   no es conversation (${err.response?.data?.message || err.message})`);
}

console.log('\n❌ ID no resuelto.');
process.exit(1);
