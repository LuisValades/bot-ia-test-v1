// Respuesta inmediata a leads con inbound pendiente.
// Pull GHL → identifica leads con último mensaje inbound > último outbound
// dentro del stage objetivo → genera respuesta con LLM (Alejandra prompt) → preview.
// NO ENVÍA. Solo genera el plan. Hay que correr --apply para enviar.
import { ghl, LOCATION_ID } from '../src/clients.js';
import { pullLeadsInStage } from '../src/stage-pull.js';
import { generateFollowupSMS } from '../src/llm-message.js';
import { writePlanFile, printPlanToConsole } from '../src/reporter.js';

const STAGE = 'Ingreso - Test Agent IA';
const now = Date.now();

console.log(`\n🔍 Pull de leads en "${STAGE}"...`);
const leads = await pullLeadsInStage(STAGE);
const withBotIaTag = leads.filter(l => Array.isArray(l.tags) && l.tags.includes('bot ia'));
console.log(`   ${leads.length} en stage, ${withBotIaTag.length} con tag bot ia.\n`);

const eligible = [];
const skipped = [];
const errors = [];

for (let i = 0; i < withBotIaTag.length; i++) {
  const lead = withBotIaTag[i];
  const name = lead.bot_full_name || lead.nombre || '(sin nombre)';
  const tag = `[${i + 1}/${withBotIaTag.length}] ${name}`;
  process.stdout.write(`${tag} → `);

  if (!lead.telefono) {
    process.stdout.write('⏭️  sin teléfono\n');
    skipped.push({ name, contact_id: lead.contact_id, phone: lead.telefono, skip_reason: 'sin teléfono', skip_check: 'sin_telefono' });
    continue;
  }

  // Pull conversación GHL
  let messages = [];
  try {
    const r = await ghl.get('/conversations/search', {
      params: { contactId: lead.contact_id, locationId: LOCATION_ID, limit: 1 }
    });
    const conv = r.data?.conversations?.[0];
    if (conv) {
      const m = await ghl.get(`/conversations/${conv.id}/messages`, { params: { limit: 20 } });
      messages = m.data?.messages?.messages || m.data?.messages || [];
    }
  } catch (err) {
    process.stdout.write(`❌ pull GHL falló: ${err.message}\n`);
    errors.push({ name, contact_id: lead.contact_id, error: `pull GHL: ${err.message}` });
    continue;
  }

  // Filtra system messages tipo "Opportunity updated", "Tag added", asignaciones, etc.
  const realMsgs = messages.filter(m =>
    m.body
    && m.direction
    && !/^(Opportunity (updated|created|moved)|Tag added|Tag removed|Pipeline|Stage |\{ ?WA#|Nuevo Lead asignado|NO RESPONDE CANCELA|cliente toma sesion|a tus ordenes ,)/i.test(m.body)
  );
  realMsgs.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
  const lastIn = [...realMsgs].reverse().find(m => m.direction === 'inbound');
  const lastOut = [...realMsgs].reverse().find(m => m.direction === 'outbound');

  // PENDIENTE = lead escribió DESPUÉS del último outbound real
  const pending = lastIn && (!lastOut || new Date(lastIn.dateAdded) > new Date(lastOut.dateAdded));
  if (!pending) {
    const reason = !lastIn ? 'sin mensajes inbound' : 'bot ya respondió después del lead';
    process.stdout.write(`⏭️  ${reason}\n`);
    skipped.push({ name, contact_id: lead.contact_id, phone: lead.telefono, skip_reason: reason, skip_check: 'no_pending' });
    continue;
  }

  // Cooldown: si el último outbound real fue hace < 10 min, skip (anti-loop)
  if (lastOut) {
    const lastOutMin = (now - new Date(lastOut.dateAdded).getTime()) / 60000;
    if (lastOutMin < 10) {
      process.stdout.write(`⏭️  último bot hace ${Math.round(lastOutMin)}min (< 10 cooldown)\n`);
      skipped.push({ name, contact_id: lead.contact_id, phone: lead.telefono, skip_reason: `último bot hace ${Math.round(lastOutMin)}min`, skip_check: 'cooldown' });
      continue;
    }
  }

  // Tags bloqueantes
  const blockingTags = ['atencion-asesor', 'no-contactar', 'no contactar', 'cerrado'];
  const hitTag = (lead.tags || []).find(t => blockingTags.includes((t || '').toLowerCase()));
  if (hitTag) {
    process.stdout.write(`⏭️  tag bloqueante: ${hitTag}\n`);
    skipped.push({ name, contact_id: lead.contact_id, phone: lead.telefono, skip_reason: `tag: ${hitTag}`, skip_check: 'tag_bloq' });
    continue;
  }

  process.stdout.write('✏️  generando respuesta...');
  try {
    const sms = await generateFollowupSMS({
      lead,
      ghlMessages: realMsgs,
      instruction: 'El lead escribió y nadie le ha respondido. Responde retomando el último punto de la conversación; si su mensaje es saludo simple, responde acorde manteniendo el flujo (Alejandra). NO uses la palabra "Hey".'
    });
    const lastInMin = lastIn?.dateAdded ? Math.round((now - new Date(lastIn.dateAdded).getTime()) / 60000) : null;
    eligible.push({
      contact_id: lead.contact_id,
      name,
      phone: lead.telefono,
      bot_stage: lead.bot_stage,
      profile_fields: 0,
      last_msg_days: null,
      context: `bot_stage=${lead.bot_stage} | lead escribió hace ${lastInMin}min: "${(lastIn.body || '').slice(0, 60)}"`,
      sms_text: sms.text
    });
    process.stdout.write(' ✅\n');
  } catch (err) {
    process.stdout.write(`❌ ${err.message}\n`);
    errors.push({ name, contact_id: lead.contact_id, error: err.message });
  }
  await new Promise(r => setTimeout(r, 300));
}

const plan = {
  type: 'seguimiento-manual-hipotecarios',
  version: 1,
  created_at: new Date().toISOString(),
  pipeline: 'Credito Hipotecario',
  stage: STAGE,
  instruction: 'Auto: respondiendo a leads con inbound pendiente',
  total_in_stage: leads.length,
  eligible,
  skipped,
  errors
};
const fullPath = writePlanFile(plan);
const filename = fullPath.split(/[\\/]/).pop();
plan._filename = filename;
printPlanToConsole(plan);
