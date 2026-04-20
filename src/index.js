import './env.js';
import express from 'express';
import cron from 'node-cron';
import { getOrCreateConversation, updateConversation, getRecentMessages, logMessage } from './db.js';
import { sendSMS, getContact, createAppointment } from './ghl.js';
import { chat } from './ai.js';
import { getNextSlots, formatSlotsForLead, formatSlotPairs, findSlotMatch, tryMatchUserTimeToSlot } from './calendar.js';
import { runFollowups } from './followup.js';
import { processAttachments } from './media.js';

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
  console.log('[reply] payload keys:', Object.keys(body), 'msg type:', typeof body.message);
  const contactId = body.contact_id || body.contactId || body.contact?.id;
  const userMessage = coerceMessage(body.message ?? body.body ?? body.last_message?.body ?? '');
  const direction = body.direction || body.last_message?.direction || 'inbound';
  const rawAttachments = parseAttachments(body.attachments || body.last_message?.attachments);

  if (!contactId) return console.warn('Reply sin contactId');
  if (direction !== 'inbound' && direction !== 'in') return;
  if (!userMessage && rawAttachments.length === 0) return console.warn('Reply sin mensaje ni attachments');

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

  const attachments = rawAttachments.length > 0 ? await processAttachments(rawAttachments) : [];
  if (attachments.length > 0) {
    const kinds = attachments.map(a => a.kind).join(',');
    console.log(`[${fullName}] ${attachments.length} attachment(s): ${kinds}`);
  }

  await runTurn({ conversation, contactId, fullName, userMessage, attachments });
}

function coerceMessage(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val).trim();
  if (typeof val === 'object') {
    const candidate = val.body || val.text || val.message || val.content || '';
    if (typeof candidate === 'string') return candidate.trim();
    return '';
  }
  return String(val).trim();
}

function parseAttachments(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '[]' || trimmed === 'null') return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      if (trimmed.startsWith('http')) return [trimmed];
    }
  }
  return [];
}

async function runTurn({ conversation, contactId, fullName, userMessage, attachments = [] }) {
  const isInitial = userMessage === '__TRIGGER_INICIAL__';

  if (!isInitial) {
    const attachmentMeta = attachments.length > 0
      ? {
          attachments: attachments.map(a => ({
            kind: a.kind,
            mime: a.mime,
            url: a.url,
            transcript: a.transcript,
            bytes: a.bytes
          }))
        }
      : undefined;
    await logMessage({
      contactId,
      conversationId: conversation.id,
      direction: 'in',
      body: userMessage || '(sin texto)',
      metadata: attachmentMeta
    });
  }

  const storedName = (conversation.full_name || '').trim();
  const leadName = hasRealName(storedName) ? storedName : (hasRealName(fullName) ? fullName : '');
  const hasName = !!leadName;

  const history = await getRecentMessages(contactId, 100);

  let availableSlots = [];
  let slotPairs = [];
  let slotsContext = '';
  const activeStage = !['confirmado', 'finalizado'].includes(conversation.stage);
  if (activeStage) {
    availableSlots = await getNextSlots({ daysAhead: 7, take: 6 });
    slotPairs = formatSlotPairs(availableSlots, 6);
    slotsContext = formatSlotsForLead(availableSlots, 6);
    console.log(`[${leadName || fullName}] slots reales:`, slotsContext);
  }

  const promptInput = isInitial
    ? (hasName
      ? `[SISTEMA: Este lead (${leadName}) acaba de entrar a la etapa "${process.env.GHL_TRIGGER_STAGE_NAME}". Salúdalo POR SU NOMBRE, preséntate como Alejandra de CrediExpres y pregunta qué tipo de crédito le interesa.]`
      : `[SISTEMA: Un lead acaba de entrar a la etapa "${process.env.GHL_TRIGGER_STAGE_NAME}". Salúdalo, preséntate como Alejandra de CrediExpres y PREGUNTA SU NOMBRE antes de avanzar.]`)
    : userMessage;

  const aiResponse = await chat({
    history,
    userMessage: promptInput,
    contactName: leadName,
    hasName,
    slotsContext,
    slotPairs,
    availableSlotsIso: availableSlots,
    attachments: isInitial ? [] : attachments
  });

  let replyText = aiResponse.text;
  const action = aiResponse.action;
  console.log(`[${leadName || 'Lead'}] ACTION:`, JSON.stringify(action));

  if (!action.book_slot && !isInitial && availableSlots.length > 0) {
    const rescuedSlot = tryMatchUserTimeToSlot(userMessage, availableSlots);
    if (rescuedSlot) {
      console.log(`[${leadName || 'Lead'}] rescue: user pidió hora; matcheo código a ${rescuedSlot}`);
      action.book_slot = rescuedSlot;
      const pair = slotPairs.find(p => p.iso === rescuedSlot);
      if (pair) {
        replyText = `Listo ${leadName || ''}, te agendo para ${pair.human}. Te llegará confirmación 📩`.trim();
      }
    }
  }

  if (action.captured_name && !hasName) {
    const cleanName = String(action.captured_name).trim().slice(0, 80);
    if (hasRealName(cleanName)) {
      await updateConversation(contactId, { full_name: cleanName });
      console.log(`[${cleanName}] nombre capturado y guardado`);
    }
  }

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
    if (availableSlots.length === 0) {
      availableSlots = await getNextSlots({ daysAhead: 7, take: 6 });
    }
    const matched = findSlotMatch(action.book_slot, availableSlots);
    if (!matched) {
      console.warn(`[${leadName || 'Lead'}] book_slot "${action.book_slot}" no coincide con ningún slot real; re-proponiendo`);
      const freshSlots = availableSlots.length > 0 ? availableSlots : await getNextSlots({ daysAhead: 7, take: 3 });
      const propuesta = formatSlotsForLead(freshSlots, 3);
      replyText = propuesta
        ? `Hmm, ese horario exacto ya no está disponible. ¿Te viene alguno de estos? ${propuesta}`
        : 'Justo ese horario se agotó. Déjame consultarle al asesor y te confirmo.';
      await updateConversation(contactId, {
        stage: 'proponiendo_horario',
        proposed_slots: freshSlots,
        intent: action.intent
      });
    } else {
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
        const msg = err.response?.data?.message || err.message;
        console.error('Error creando cita:', err.response?.data || err.message);
        if (String(msg).toLowerCase().includes('no longer available')) {
          const freshSlots = await getNextSlots({ daysAhead: 7, take: 3 });
          const propuesta = formatSlotsForLead(freshSlots, 3);
          replyText = propuesta
            ? `Se me acaba de ocupar ese horario 😅. ¿Te viene alguno de estos? ${propuesta}`
            : 'Ese horario ya se ocupó y no tengo más esta semana. Te contacta el asesor mañana.';
          await updateConversation(contactId, {
            stage: 'proponiendo_horario',
            proposed_slots: freshSlots,
            intent: action.intent
          });
        } else {
          replyText = 'Tuve un problema técnico agendando. El asesor te contacta en breve para confirmar.';
        }
      }
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

  const logName = action.captured_name || leadName || 'Lead';
  console.log(`[${logName}] ${isInitial ? '🟢 trigger' : `in: "${userMessage}"`} → out: "${replyText}"`);
}

function hasRealName(name) {
  if (!name) return false;
  const clean = String(name).trim();
  if (clean.length < 3) return false;
  const lower = clean.toLowerCase();
  return lower !== 'lead' && lower !== 'unknown' && lower !== 'sin nombre';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot Alejandra escuchando en puerto ${PORT}`);
  console.log(`Trigger:  POST http://localhost:${PORT}/webhook/ghl/trigger`);
  console.log(`Reply:    POST http://localhost:${PORT}/webhook/ghl/reply`);
  console.log(`Pipeline: ${process.env.GHL_TRIGGER_PIPELINE_NAME} → ${process.env.GHL_TRIGGER_STAGE_NAME}`);
});

let followupRunning = false;
cron.schedule('* * * * *', async () => {
  if (followupRunning) return;
  followupRunning = true;
  try {
    await runFollowups();
  } catch (err) {
    console.error('[followup] tick error:', err.message);
  } finally {
    followupRunning = false;
  }
});
console.log(`Followups: cada 1 min (umbral ${process.env.FOLLOWUP_DELAY_MIN || 5} min, máx ${process.env.MAX_FOLLOWUPS || 2} por lead)`);
