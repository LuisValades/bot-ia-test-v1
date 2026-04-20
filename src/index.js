import './env.js';
import express from 'express';
import { getOrCreateConversation, updateConversation, getRecentMessages, logMessage } from './db.js';
import { sendSMS, getContact, createAppointment } from './ghl.js';
import { chat } from './ai.js';
import { getNextSlots, formatSlotsForLead, findSlotMatch } from './calendar.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({
  ok: true,
  bot: 'Alejandra',
  trigger: {
    pipeline: process.env.GHL_TRIGGER_PIPELINE_NAME,
    stage: process.env.GHL_TRIGGER_STAGE_NAME
  }
}));

app.post('/webhook/ghl/trigger', async (req, res) => {
  res.status(200).json({ received: true });
  try {
    await handleTrigger(req.body);
  } catch (err) {
    console.error('Error en trigger:', err.response?.data || err.message);
  }
});

app.post('/webhook/ghl/reply', async (req, res) => {
  res.status(200).json({ received: true });
  try {
    await handleReply(req.body);
  } catch (err) {
    console.error('Error en reply:', err.response?.data || err.message);
  }
});

async function handleTrigger(payload) {
  const body = payload.body || payload;
  const contactId = body.contact_id || body.contactId || body.contact?.id;
  if (!contactId) return console.warn('Trigger sin contactId');

  const contact = await getContact(contactId).catch(() => null);
  const fullName = contact?.contactName || contact?.firstName || body.full_name || 'Lead';
  const phone = contact?.phone || body.phone;

  const conversation = await getOrCreateConversation({
    contactId,
    locationId: process.env.GHL_LOCATION_ID,
    phone,
    fullName
  });

  if (conversation.stage !== 'inicio') {
    console.log(`[${fullName}] ya en etapa ${conversation.stage}, ignorando trigger duplicado`);
    return;
  }

  await runTurn({ conversation, contactId, fullName, userMessage: '__TRIGGER_INICIAL__' });
}

async function handleReply(payload) {
  const body = payload.body || payload;
  const contactId = body.contact_id || body.contactId || body.contact?.id;
  const userMessage = (body.message || body.body || body.last_message?.body || '').trim();
  const direction = body.direction || body.last_message?.direction || 'inbound';

  if (!contactId) return console.warn('Reply sin contactId');
  if (direction !== 'inbound' && direction !== 'in') return;
  if (!userMessage) return console.warn('Reply sin mensaje');

  const contact = await getContact(contactId).catch(() => null);
  const fullName = contact?.contactName || contact?.firstName || body.full_name || 'Lead';
  const phone = contact?.phone || body.phone;

  const conversation = await getOrCreateConversation({
    contactId,
    locationId: process.env.GHL_LOCATION_ID,
    phone,
    fullName
  });

  if (conversation.stage === 'finalizado' || conversation.stage === 'confirmado') {
    console.log(`[${fullName}] conversación ${conversation.stage}, no responde`);
    return;
  }

  await runTurn({ conversation, contactId, fullName, userMessage });
}

async function runTurn({ conversation, contactId, fullName, userMessage }) {
  const isInitial = userMessage === '__TRIGGER_INICIAL__';

  if (!isInitial) {
    await logMessage({
      contactId,
      conversationId: conversation.id,
      direction: 'in',
      body: userMessage
    });
  }

  const history = await getRecentMessages(contactId, 10);

  let availableSlots = [];
  let slotsContext = '';
  if (conversation.stage === 'proponiendo_horario' || conversation.proposed_slots) {
    availableSlots = await getNextSlots({ daysAhead: 7, take: 6 });
    slotsContext = formatSlotsForLead(availableSlots, 6);
  }

  const promptInput = isInitial
    ? `[SISTEMA: Este lead acaba de entrar a la etapa "${process.env.GHL_TRIGGER_STAGE_NAME}". Salúdalo, preséntate como Alejandra de CrediExpres y pregunta qué tipo de crédito le interesa.]`
    : userMessage;

  const aiResponse = await chat({
    history,
    userMessage: promptInput,
    contactName: fullName,
    slotsContext
  });

  let replyText = aiResponse.text;
  const action = aiResponse.action;

  if (action.propose_slots && availableSlots.length === 0) {
    availableSlots = await getNextSlots({ daysAhead: 7, take: 3 });
    if (availableSlots.length > 0) {
      const propuesta = formatSlotsForLead(availableSlots, 3);
      replyText = `${replyText} Tengo disponible: ${propuesta}. ¿Cuál te queda mejor?`;
      await updateConversation(contactId, {
        stage: 'proponiendo_horario',
        proposed_slots: availableSlots,
        intent: action.intent
      });
    }
  }

  let appointmentId = null;
  let appointmentAt = null;
  if (action.book_slot) {
    const matched = findSlotMatch(action.book_slot, availableSlots) || action.book_slot;
    try {
      const appt = await createAppointment({
        contactId,
        startTime: matched,
        title: `Bot Alejandra - ${fullName}`
      });
      appointmentId = appt.id;
      appointmentAt = matched;
      await updateConversation(contactId, {
        stage: 'confirmado',
        intent: action.intent,
        appointment_id: appointmentId,
        appointment_at: appointmentAt
      });
    } catch (err) {
      console.error('Error creando cita:', err.response?.data || err.message);
      replyText = 'Tuve un problema agendando. Te confirmo el horario en un momento.';
    }
  } else if (!action.propose_slots) {
    await updateConversation(contactId, {
      stage: action.next_stage || conversation.stage,
      intent: action.intent || conversation.intent
    });
  }

  const sent = await sendSMS({ contactId, message: replyText });

  const usage = aiResponse.usage || {};
  await logMessage({
    contactId,
    conversationId: conversation.id,
    direction: 'out',
    body: replyText,
    aiModel: aiResponse.model,
    aiTokensIn: usage.prompt_tokens,
    aiTokensOut: usage.completion_tokens,
    ghlMessageId: sent?.messageId || sent?.id,
    metadata: { action, appointment_id: appointmentId, appointment_at: appointmentAt, trigger: isInitial }
  });

  console.log(`[${fullName}] ${isInitial ? '🟢 trigger' : `in: "${userMessage}"`} → out: "${replyText}"`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot Alejandra escuchando en puerto ${PORT}`);
  console.log(`Trigger:  POST http://localhost:${PORT}/webhook/ghl/trigger`);
  console.log(`Reply:    POST http://localhost:${PORT}/webhook/ghl/reply`);
  console.log(`Pipeline: ${process.env.GHL_TRIGGER_PIPELINE_NAME} → ${process.env.GHL_TRIGGER_STAGE_NAME}`);
});
