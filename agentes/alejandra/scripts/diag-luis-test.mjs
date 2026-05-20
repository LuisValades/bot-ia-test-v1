// Diagnóstico de por qué el bot no respondió a Luis Valades
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const CONTACT_ID = 'F1OIt6R63IR8gFWu4Yx6';
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
console.log(`  DIAGNÓSTICO — Luis Valades (${CONTACT_ID})`);
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Estado en Supabase
const { data: lead, error } = await supabase
  .from('leads')
  .select('*')
  .eq('contact_id', CONTACT_ID)
  .single();

if (error || !lead) {
  console.log(`❌ NO ENCONTRADO en Supabase: ${error?.message}`);
} else {
  console.log(`📊 ESTADO SUPABASE:`);
  console.log(`   nombre:                 ${lead.nombre || lead.bot_full_name}`);
  console.log(`   telefono:               ${lead.telefono}`);
  console.log(`   stage_name:             ${lead.stage_name}`);
  console.log(`   pipeline_name:          ${lead.pipeline_name}`);
  console.log(`   bot_stage:              ${lead.bot_stage}`);
  console.log(`   bot_followup_count:     ${lead.bot_followup_count}`);
  console.log(`   bot_last_msg_at:        ${lead.bot_last_msg_at}`);
  console.log(`   bot_last_decision:      ${lead.bot_last_decision}`);
  console.log(`   bot_last_decision_at:   ${lead.bot_last_decision_at}`);
  console.log(`   bot_skip_at:            ${lead.bot_skip_at}`);
  console.log(`   bot_skip_reason:        ${lead.bot_skip_reason}`);
  console.log(`   bot_postpone_until:     ${lead.bot_postpone_until}`);
  console.log(`   bot_appointment_at:     ${lead.bot_appointment_at}`);
  console.log(`   tags:                   ${(lead.tags || []).join(', ')}`);
  console.log(`   synced_at:              ${lead.synced_at}`);
  console.log(`   ghl_updated_at:         ${lead.ghl_updated_at}`);
}

// 2. Últimos eventos
console.log(`\n📜 ÚLTIMOS 10 EVENTOS en Supabase:`);
const events = (lead?.eventos || []).slice(-10);
for (const e of events) {
  const ts = (e.fecha || e.timestamp || '').slice(0, 19);
  const body = (e.body || e.texto || '').replace(/\s+/g, ' ').slice(0, 80);
  console.log(`   [${ts}] ${e.tipo || '?'}/${e.direccion || '?'} src=${e.source || '?'} → ${body}`);
}

// 3. Conversación GHL
console.log(`\n💬 CONVERSACIÓN GHL — últimos 10 mensajes:`);
try {
  const conv = await ghl.get('/conversations/search', {
    params: { contactId: CONTACT_ID, locationId: process.env.GHL_LOCATION_ID, limit: 1 }
  });
  const c = conv.data?.conversations?.[0];
  if (c) {
    console.log(`   conversation_id: ${c.id}`);
    const m = await ghl.get(`/conversations/${c.id}/messages`, { params: { limit: 10 } });
    const msgs = m.data?.messages?.messages || m.data?.messages || [];
    msgs.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
    for (const msg of msgs) {
      const ts = (msg.dateAdded || '').slice(0, 19);
      const dir = msg.direction === 'inbound' ? '⬅️ IN ' : '➡️ OUT';
      const body = (msg.body || '').replace(/\s+/g, ' ').slice(0, 100);
      const userId = msg.userId ? `user=${msg.userId.slice(0,8)}` : 'sin user';
      console.log(`   [${ts}] ${dir} ${userId} → ${body}`);
    }
  }
} catch (err) {
  console.log(`   ❌ ${err.response?.data?.message || err.message}`);
}

// 4. Diagnóstico
console.log(`\n🔍 ANÁLISIS:`);
if (lead) {
  const inBotStage = ['Ingreso - Test Agent IA', 'Bot IA'].includes(lead.stage_name);
  const hasBotTag = (lead.tags || []).includes('bot ia');
  const hasBlockingTag = (lead.tags || []).some(t => ['atencion-asesor', 'no-contactar'].includes((t || '').toLowerCase()));
  const skipped = !!lead.bot_skip_at;
  const postponed = lead.bot_postpone_until && new Date(lead.bot_postpone_until).getTime() > Date.now();
  const cntCap = (lead.bot_followup_count || 0) >= 5;

  console.log(`   ¿En stage Bot IA?           ${inBotStage ? '✅' : '❌ stage=' + lead.stage_name}`);
  console.log(`   ¿Tiene tag "bot ia"?         ${hasBotTag ? '✅' : '❌'}`);
  console.log(`   ¿Tag bloqueante?             ${hasBlockingTag ? '🔴 SÍ' : '✅ NO'}`);
  console.log(`   ¿bot_skip_at set?            ${skipped ? '🔴 SÍ → ' + lead.bot_skip_reason : '✅ NO'}`);
  console.log(`   ¿postpone activo?            ${postponed ? '🔴 SÍ hasta ' + lead.bot_postpone_until : '✅ NO'}`);
  console.log(`   ¿followup_count >= 5?        ${cntCap ? '🔴 SÍ (' + lead.bot_followup_count + ')' : '✅ NO (' + (lead.bot_followup_count || 0) + ')'}`);

  console.log('');
  if (!inBotStage) {
    console.log(`   🔴 PROBABLE CAUSA: lead NO está en stage del bot. CAG no procesa.`);
  } else if (!hasBotTag) {
    console.log(`   🔴 PROBABLE CAUSA: lead SIN tag "bot ia". CAG ignora.`);
  } else if (hasBlockingTag) {
    console.log(`   🔴 PROBABLE CAUSA: tag bloqueante presente.`);
  } else if (skipped) {
    console.log(`   🔴 PROBABLE CAUSA: bot_skip_at marcado.`);
  } else {
    console.log(`   ⚠️  El lead califica para que el CAG responda. Pero no lo hizo.`);
    console.log(`   → Posible causa: workflow CAG en n8n no recibió el webhook GHL, o falló silente.`);
    console.log(`   → Revisar n8n → Alejandra Sistema CAG Subagentes → tab Executions`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════\n');
process.exit(0);
