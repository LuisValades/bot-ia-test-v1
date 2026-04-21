import './env.js';
import express from 'express';
import cron from 'node-cron';
import { getOrCreateConversation, updateConversation, getRecentMessages, logMessage } from './db.js';
import { sendSMS, getContact, getUser, createAppointment, createContactNote, addContactTags, removeContactTags, findContactOpportunity, moveOpportunityStage } from './ghl.js';
import { chat } from './ai.js';
import { getNextSlots, formatSlotsForLead, formatSlotPairs, formatSlotsMenu, findSlotMatch, tryMatchUserTimeToSlot, tryMatchUserOptionNumber, formatSlotEs } from './calendar.js';
import { runFollowups } from './followup.js';
import { processAttachments } from './media.js';
import { hydrateFromGHL, persistGHLHistory } from './hydration.js';
import { supabase } from './db.js';

const RETAKE_DELAY_MIN = parseInt(process.env.RETAKE_DELAY_MIN || '15', 10);

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

const contactLocks = new Map();

function serializePerContact(contactId, task) {
  if (!contactId) return task();
  const prev = contactLocks.get(contactId) || Promise.resolve();
  const chained = prev.then(() => task()).catch(err => {
    console.error(`[lock] ${contactId} task err:`, err.response?.data || err.message);
  });
  contactLocks.set(contactId, chained);
  chained.finally(() => {
    if (contactLocks.get(contactId) === chained) contactLocks.delete(contactId);
  });
  return chained;
}

function extractContactId(payload) {
  const body = payload?.body || payload || {};
  return body.contact_id || body.contactId || body.contact?.id || null;
}

app.post('/webhook/ghl/trigger', async (req, res) => {
  res.status(200).json({ received: true });
  const contactId = extractContactId(req.body);
  serializePerContact(contactId, async () => {
    try {
      await handleTrigger(req.body);
    } catch (err) {
      console.error('Error en trigger:', err.response?.data || err.message);
    }
  });
});

app.post('/webhook/ghl/reply', async (req, res) => {
  res.status(200).json({ received: true });
  const contactId = extractContactId(req.body);
  serializePerContact(contactId, async () => {
    try {
      await handleReply(req.body);
    } catch (err) {
      console.error('Error en reply:', err.response?.data || err.message);
    }
  });
});

async function handleTrigger(payload) {
  const body = payload.body || payload;
  const contactId = body.contact_id || body.contactId || body.contact?.id;
  if (!contactId) return console.warn('Trigger sin contactId');

  const contact = await getContact(contactId).catch(() => null);
  const fullName = contact?.contactName || contact?.firstName || body.full_name || 'Lead';
  const phone = contact?.phone || body.phone;
  const advisor = await resolveAdvisor(contact);
  const tags = Array.isArray(contact?.tags) ? contact.tags : [];
  const isReactivation = detectReactivation(tags);

  const conversation = await getOrCreateConversation({
    contactId,
    locationId: process.env.GHL_LOCATION_ID,
    phone,
    fullName
  });

  const allowReTrigger = isReactivation && ['inicio', 'finalizado', 'confirmado'].includes(conversation.stage);
  if (conversation.stage !== 'inicio' && !allowReTrigger) {
    console.log(`[${fullName}] ya en etapa ${conversation.stage}, ignorando trigger duplicado`);
    return;
  }

  if (allowReTrigger && conversation.stage !== 'inicio') {
    await updateConversation(contactId, {
      stage: 'inicio',
      followup_count: 0,
      followup_at: null
    });
    conversation.stage = 'inicio';
    conversation.followup_count = 0;
    console.log(`[${fullName}] reactivación detectada, reseteando a inicio`);
  }

  if (isReactivation) {
    try {
      const hydration = await hydrateFromGHL(contactId);
      await persistGHLHistory({ contactId, conversationId: conversation.id, hydration });
      const retakeAt = new Date(Date.now() + RETAKE_DELAY_MIN * 60 * 1000).toISOString();
      await updateConversation(contactId, { retake_scheduled_at: retakeAt });
      console.log(`[${fullName}] reactivación: historial extraído, retake programado para ${retakeAt}`);
      return;
    } catch (err) {
      console.error(`[${fullName}] hydration falló, arranco como lead nuevo:`, err.response?.data || err.message);
    }
  }

  await runTurn({ conversation, contactId, fullName, userMessage: '__TRIGGER_INICIAL__', advisor, tags, isReactivation });
}

function detectReactivation(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const triggerTags = (process.env.REACTIVATION_TAGS || 'reactivacion,reactivación,bot-reactivacion,reengagement,re-engagement,seguimiento')
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  const normalized = tags.map(t => String(t).toLowerCase().trim());
  return triggerTags.some(trigger => normalized.includes(trigger));
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
  const advisor = await resolveAdvisor(contact);
  const tags = Array.isArray(contact?.tags) ? contact.tags : [];

  const conversation = await getOrCreateConversation({
    contactId,
    locationId: process.env.GHL_LOCATION_ID,
    phone,
    fullName
  });

  if (conversation.stage === 'finalizado' || conversation.stage === 'escalado' || conversation.stage === 'bloqueado') {
    console.log(`[${fullName}] conversación ${conversation.stage}, no responde`);
    return;
  }

  if (userMessage && detectBlockIntent(userMessage)) {
    console.log(`[${fullName}] lead pidió no ser contactado, marcando bloqueado`);
    await handleBlockRequest({ contactId, conversationId: conversation.id, leadName: conversation.full_name || fullName });
    return;
  }

  if (userMessage && detectEscalationIntent(userMessage)) {
    console.log(`[${fullName}] lead pidió atención humana explícitamente, escalando`);
    await escalateToAdvisor({
      contactId,
      conversationId: conversation.id,
      leadName: conversation.full_name || fullName,
      advisor,
      reason: 'lead-requested',
      triggeringMessage: userMessage
    });
    return;
  }

  const attachments = rawAttachments.length > 0 ? await processAttachments(rawAttachments) : [];
  if (attachments.length > 0) {
    const kinds = attachments.map(a => a.kind).join(',');
    console.log(`[${fullName}] ${attachments.length} attachment(s): ${kinds}`);
  }

  // isReactivation solo aplica al saludo inicial (trigger/retake), no a replies ya en conversación
  await runTurn({ conversation, contactId, fullName, userMessage, attachments, advisor, tags, isReactivation: false });
}

async function resolveAdvisor(contact) {
  const advisorId = contact?.assignedTo;
  if (!advisorId) return null;
  const user = await getUser(advisorId);
  if (!user) return { id: advisorId, name: null };
  const name = user.firstName || user.name || (user.email ? user.email.split('@')[0] : null);
  return { id: advisorId, name, email: user.email };
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

async function runTurn({ conversation, contactId, fullName, userMessage, attachments = [], advisor = null, tags = [], isReactivation = false }) {
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

  const postBookingContext = conversation.stage === 'confirmado' && conversation.appointment_at
    ? `El lead YA tiene una cita agendada para ${new Date(conversation.appointment_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'full', timeStyle: 'short' })}. Si pregunta algo, respóndele usando la base de conocimiento. Si quiere reagendar, propone nuevos slots y cambia la cita. Si quiere cancelar, confírmale que el asesor lo contactará. Si solo agradece o saluda, responde cordial sin volver a vender.`
    : null;

  let availableSlots = [];
  let slotPairs = [];
  let slotsContext = '';
  let slotsMenu = '';
  const activeStage = !['confirmado', 'finalizado'].includes(conversation.stage);
  if (activeStage) {
    availableSlots = await getNextSlots({ daysAhead: 7, take: 6 });
    slotPairs = formatSlotPairs(availableSlots, 6);
    slotsContext = formatSlotsForLead(availableSlots, 6);
    slotsMenu = formatSlotsMenu(availableSlots, 6);
    console.log(`[${leadName || fullName}] slots reales:`, slotsContext);
  }

  const promptInput = isInitial
    ? (isReactivation
      ? (hasName
        ? `[SISTEMA: Lead en REACTIVACIÓN. ${leadName} fue contactado antes pero la conversación no avanzó. Salúdalo por nombre reconociendo que hace tiempo no hablaban (sin fingir memoria personal), menciona que eres Alejandra de CrediExpres y pregúntale si sigue interesado en un crédito. Tono cálido y breve.]`
        : `[SISTEMA: Lead en REACTIVACIÓN (sin nombre conocido). Fue contactado antes. Salúdalo, preséntate como Alejandra de CrediExpres, reconoce que hace tiempo no hablaban y pregúntale su nombre para retomar.]`)
      : (hasName
        ? `[SISTEMA: Nuevo lead (${leadName}) en etapa "${process.env.GHL_TRIGGER_STAGE_NAME}". Salúdalo POR SU NOMBRE, preséntate como Alejandra de CrediExpres y pregunta qué tipo de crédito le interesa.]`
        : `[SISTEMA: Nuevo lead en etapa "${process.env.GHL_TRIGGER_STAGE_NAME}". Salúdalo, preséntate como Alejandra de CrediExpres y PREGUNTA SU NOMBRE antes de avanzar.]`))
    : userMessage;

  const aiResponse = await chat({
    history,
    userMessage: promptInput,
    contactName: leadName,
    hasName,
    slotsContext,
    slotPairs,
    slotsMenu,
    availableSlotsIso: availableSlots,
    attachments: isInitial ? [] : attachments,
    postBookingContext,
    profile: conversation.profile || {},
    advisor,
    tags,
    isReactivation
  });

  let replyText = aiResponse.text;
  const action = aiResponse.action;
  console.log(`[${leadName || 'Lead'}] ACTION:`, JSON.stringify(action));

  if (action.needs_escalation) {
    console.log(`[${leadName || 'Lead'}] AI pidió escalación`);
    await escalateToAdvisor({
      contactId,
      conversationId: conversation.id,
      leadName: leadName || fullName,
      advisor,
      reason: 'ai-cannot-answer',
      triggeringMessage: userMessage
    });
    return;
  }

  if (!action.book_slot && !isInitial && availableSlots.length > 0) {
    const rescuedSlot = tryMatchUserOptionNumber(userMessage, availableSlots) || tryMatchUserTimeToSlot(userMessage, availableSlots);
    if (rescuedSlot) {
      console.log(`[${leadName || 'Lead'}] rescue: user eligió; matcheo código a ${rescuedSlot}`);
      action.book_slot = rescuedSlot;
      const pair = slotPairs.find(p => p.iso === rescuedSlot);
      if (pair) {
        replyText = `Listo, te agendo para ${pair.human}.\n\nEs una llamada de ~10 min con el asesor.\n\nTe llegará confirmación 📩`;
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

  if (action.profile_updates && typeof action.profile_updates === 'object' && Object.keys(action.profile_updates).length > 0) {
    const currentProfile = conversation.profile || {};
    const mergedProfile = { ...currentProfile, ...action.profile_updates };
    await updateConversation(contactId, { profile: mergedProfile });
    console.log(`[${leadName || 'Lead'}] perfil actualizado:`, JSON.stringify(action.profile_updates));
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
      const appointmentPayload = {
        contactId,
        startTime: matched,
        title: `Llamada 10 min - ${fullName}`
      };
      if (advisor?.id) appointmentPayload.assignedUserId = advisor.id;

      try {
        let appt;
        try {
          appt = await createAppointment(appointmentPayload);
        } catch (teamErr) {
          const teamMsg = (teamErr.response?.data?.message || '').toLowerCase();
          if (appointmentPayload.assignedUserId && teamMsg.includes('not part of calendar team')) {
            console.warn(`[${leadName || fullName}] asesor ${advisor?.name || advisor?.id} no está en calendar team; reintentando sin assignedUserId`);
            delete appointmentPayload.assignedUserId;
            appt = await createAppointment(appointmentPayload);
          } else {
            throw teamErr;
          }
        }
        appointmentId = appt.id;
        appointmentAt = matched;
        await updateConversation(contactId, {
          stage: 'confirmado',
          intent: action.intent,
          appointment_id: appointmentId,
          appointment_at: appointmentAt
        });
        await createBookingNote({ contactId, leadName: leadName || fullName, profile: conversation.profile || {}, intent: action.intent, appointmentAt: matched, advisor });
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

  const sendResult = await sendMultiPartSMS({
    contactId,
    message: replyText,
    leadName: leadName || fullName
  });

  const usage = aiResponse.usage || {};
  await logMessage({
    contactId,
    conversationId: conversation.id,
    direction: 'out',
    body: replyText,
    aiModel: aiResponse.model,
    aiTokensIn: usage.prompt_tokens,
    aiTokensOut: usage.completion_tokens,
    ghlMessageId: sendResult?.ghlMessageId,
    metadata: { action, appointment_id: appointmentId, appointment_at: appointmentAt, trigger: isInitial, chunks_count: sendResult?.chunks?.length }
  });

  const logName = action.captured_name || leadName || 'Lead';
  console.log(`[${logName}] ${isInitial ? '🟢 trigger' : `in: "${userMessage}"`} → out: "${replyText}"`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sendMultiPartSMS({ contactId, message, leadName, firstDelayMs = null }) {
  const chunks = String(message || '')
    .split(/\n{2,}/)
    .map(s => s.trim())
    .filter(Boolean);
  if (chunks.length === 0) return null;

  const firstDelay = firstDelayMs ?? getNaturalDelay();
  const chunkMin = parseInt(process.env.CHUNK_DELAY_MIN_MS || '1800', 10);
  const chunkMax = parseInt(process.env.CHUNK_DELAY_MAX_MS || '3500', 10);

  const sentIds = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      console.log(`[${leadName || 'Lead'}] enviando ${chunks.length} SMS (primer chunk en ${firstDelay}ms)`);
      await sleep(firstDelay);
    } else {
      const chunkDelay = chunkMin + Math.floor(Math.random() * Math.max(1, chunkMax - chunkMin));
      await sleep(chunkDelay);
    }
    try {
      const sent = await sendSMS({ contactId, message: chunks[i] });
      sentIds.push(sent?.messageId || sent?.id || null);
    } catch (err) {
      console.error(`[${leadName || 'Lead'}] fallo enviando chunk ${i + 1}/${chunks.length}:`, err.response?.data || err.message);
    }
  }
  return { ghlMessageId: sentIds[0] || null, allIds: sentIds, chunks };
}

const ESCALATION_KEYWORDS = [
  'hablar con asesor', 'hablar con un asesor', 'con un asesor',
  'hablar asesor', 'quiero asesor', 'dame un asesor',
  'asesor humano', 'atencion humana', 'atención humana',
  'una persona', 'persona real', 'alguien real',
  'humano', 'un humano',
  'atencion personal', 'atención personal',
  'atencion personalizada', 'atención personalizada',
  'no quiero bot', 'eres un bot', 'eres bot', 'sos bot',
  'quiero hablar con alguien', 'quiero atencion',
  'quiero atención', 'ayuda humana',
  'hablame un asesor', 'háblame un asesor'
];

function detectEscalationIntent(message) {
  if (!message) return false;
  const text = String(message).toLowerCase().trim();
  if (text.length === 0) return false;
  return ESCALATION_KEYWORDS.some(kw => text.includes(kw));
}

const BLOCK_KEYWORDS = [
  'no me contacten', 'no me escriban', 'no me escriba',
  'no quiero que me contacten', 'no quiero que me escriban',
  'dejenme en paz', 'déjenme en paz', 'dejame en paz', 'déjame en paz',
  'bloqueame', 'bloquéame', 'bloqueenme', 'bloquéenme',
  'no me hables mas', 'no me hables más', 'no me hablen mas', 'no me hablen más',
  'retirenme', 'retírenme', 'borrenme', 'bórrenme',
  'eliminen mi numero', 'eliminen mi número',
  'quitenme', 'quítenme',
  'no me llamen mas', 'no me llamen más',
  'no quiero saber nada', 'ya no quiero nada',
  'dejen de mandarme', 'paren de escribirme',
  'unsubscribe', 'stop'
];

function detectBlockIntent(message) {
  if (!message) return false;
  const text = String(message).toLowerCase().trim();
  if (text.length === 0) return false;
  return BLOCK_KEYWORDS.some(kw => text.includes(kw));
}

async function handleBlockRequest({ contactId, conversationId, leadName }) {
  const msg = 'Entendido, no te contactamos más.\n\nSi algún día quieres retomar, avísanos y con gusto te apoyamos.\n\nGracias por tu tiempo 🙏';
  try {
    const result = await sendMultiPartSMS({ contactId, message: msg, leadName });
    await logMessage({
      contactId,
      conversationId,
      direction: 'out',
      body: msg,
      ghlMessageId: result?.ghlMessageId,
      metadata: { blocked: true, chunks_count: result?.chunks?.length }
    });
  } catch (err) {
    console.error(`[${leadName}] fallo enviando confirmación de bloqueo:`, err.response?.data || err.message);
  }
  await updateConversation(contactId, { stage: 'bloqueado' });
  await Promise.all([
    addContactTags(contactId, ['no-contactar']),
    removeContactTags(contactId, [process.env.GHL_BOT_TAG || 'bot ia'])
  ]);
  try {
    await createContactNote({
      contactId,
      body: `🛑 LEAD SOLICITÓ NO SER CONTACTADO\n\nEl bot dejó de responder automáticamente. Respeta su decisión.\n\n— Bot Alejandra`
    });
  } catch (err) {
    console.error(`[${leadName}] fallo creando nota de bloqueo:`, err.message);
  }
  console.log(`[${leadName}] 🛑 lead bloqueado. No responde más.`);
}

async function escalateToAdvisor({ contactId, conversationId, leadName, advisor, reason, triggeringMessage }) {
  const farewellMsg = 'Va, te paso con un asesor.\n\nTe contacta en unos minutos directamente.\n\n¡Gracias por escribir! 🙌';
  const escalationTag = (process.env.GHL_ESCALATION_TAG || 'atencion-asesor').trim();
  const botTag = (process.env.GHL_BOT_TAG || 'bot ia').trim();
  const escalationStageId = process.env.GHL_ESCALATION_STAGE_ID;
  const escalationPipelineId = process.env.GHL_ESCALATION_PIPELINE_ID || process.env.GHL_TRIGGER_PIPELINE_ID;

  try {
    const result = await sendMultiPartSMS({ contactId, message: farewellMsg, leadName });
    await logMessage({
      contactId,
      conversationId,
      direction: 'out',
      body: farewellMsg,
      ghlMessageId: result?.ghlMessageId,
      metadata: { escalation: true, reason, triggering_message: triggeringMessage, chunks_count: result?.chunks?.length }
    });
  } catch (err) {
    console.error(`[${leadName}] fallo enviando SMS de despedida:`, err.response?.data || err.message);
  }

  await updateConversation(contactId, { stage: 'escalado' }).catch(err =>
    console.error('updateConversation escalado err:', err.message)
  );

  await Promise.all([
    addContactTags(contactId, [escalationTag]),
    removeContactTags(contactId, [botTag])
  ]);

  if (escalationStageId && escalationPipelineId) {
    const opp = await findContactOpportunity(contactId);
    if (opp?.id) {
      await moveOpportunityStage({
        opportunityId: opp.id,
        pipelineId: escalationPipelineId,
        stageId: escalationStageId
      });
      console.log(`[${leadName}] oportunidad movida a etapa de escalación ${escalationStageId}`);
    } else {
      console.warn(`[${leadName}] no encontré oportunidad para mover a escalación`);
    }
  }

  try {
    const noteBody = [
      '⚠️ ESCALACIÓN AUTOMÁTICA — El lead pide atención humana.',
      '',
      `Lead: ${leadName || '(sin nombre)'}`,
      `Asesor asignado: ${advisor?.name || '(sin asesor)'}`,
      `Razón: ${reason === 'lead-requested' ? 'el lead pidió hablar con humano' : 'el bot no pudo responder'}`,
      triggeringMessage ? `Último mensaje del lead: "${triggeringMessage.slice(0, 300)}"` : '',
      '',
      '— Alejandra dejó de responder. Toma tú la conversación.'
    ].filter(Boolean).join('\n');
    await createContactNote({ contactId, body: noteBody });
  } catch (err) {
    console.error(`[${leadName}] fallo creando nota de escalación:`, err.message);
  }

  console.log(`[${leadName}] ✅ escalación ejecutada. Tags: +${escalationTag}, -${botTag}. Bot no vuelve a responder.`);
}

function getNaturalDelay() {
  const base = parseInt(process.env.RESPONSE_DELAY_MS || '10000', 10);
  const jitterRange = parseInt(process.env.RESPONSE_DELAY_JITTER_MS || '3000', 10);
  const jitter = Math.floor(Math.random() * jitterRange) - Math.floor(jitterRange / 2);
  return Math.max(1000, base + jitter);
}

function hasRealName(name) {
  if (!name) return false;
  const clean = String(name).trim();
  if (clean.length < 3) return false;
  const lower = clean.toLowerCase();
  return lower !== 'lead' && lower !== 'unknown' && lower !== 'sin nombre';
}

async function createBookingNote({ contactId, leadName, profile, intent, appointmentAt, advisor }) {
  try {
    const when = formatSlotEs(appointmentAt);
    const fields = [
      `Lead: ${leadName || '(sin nombre)'}`,
      `Interés: ${intent || 'no identificado'}`,
      `Cita agendada: ${when} (10 min)`,
    ];
    if (advisor?.name) fields.push(`Asesor asignado: ${advisor.name}`);
    if (profile && Object.keys(profile).length > 0) {
      fields.push('');
      fields.push('Perfil capturado por el bot:');
      const labelMap = {
        ingreso_mensual_mxn: 'Ingreso mensual',
        tipo_ingreso: 'Tipo ingreso',
        monto_solicitado_mxn: 'Monto solicitado',
        proposito: 'Propósito',
        antiguedad_laboral_meses: 'Antigüedad laboral (meses)',
        historial_buro: 'Historial buró',
        tiene_propiedad: 'Tiene propiedad',
        necesidad: 'Necesidad',
        notas: 'Notas'
      };
      for (const [k, v] of Object.entries(profile)) {
        if (v === null || v === undefined || v === '') continue;
        const label = labelMap[k] || k;
        const val = typeof v === 'number' && (k === 'ingreso_mensual_mxn' || k === 'monto_solicitado_mxn')
          ? `$${v.toLocaleString('es-MX')} MXN`
          : String(v);
        fields.push(`- ${label}: ${val}`);
      }
    }
    fields.push('');
    fields.push('— Nota generada automáticamente por Bot Alejandra');
    const body = fields.join('\n');
    const note = await createContactNote({ contactId, body });
    console.log(`[${leadName}] nota GHL creada: ${note?.id || 'ok'}`);
  } catch (err) {
    console.error('createBookingNote err:', err.response?.data || err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot Alejandra escuchando en puerto ${PORT}`);
  console.log(`Trigger:  POST http://localhost:${PORT}/webhook/ghl/trigger`);
  console.log(`Reply:    POST http://localhost:${PORT}/webhook/ghl/reply`);
  console.log(`Pipeline: ${process.env.GHL_TRIGGER_PIPELINE_NAME} → ${process.env.GHL_TRIGGER_STAGE_NAME}`);
});

let cronRunning = false;
cron.schedule('* * * * *', async () => {
  if (cronRunning) return;
  cronRunning = true;
  try {
    await runRetakes();
    await runFollowups();
  } catch (err) {
    console.error('[cron] tick error:', err.message);
  } finally {
    cronRunning = false;
  }
});
console.log(`Cron activo: retakes (${RETAKE_DELAY_MIN} min tras reactivación) + followups (umbral ${process.env.FOLLOWUP_DELAY_MIN || 5} min, máx ${process.env.MAX_FOLLOWUPS || 2} por lead)`);

async function runRetakes() {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('stage', 'inicio')
    .not('retake_scheduled_at', 'is', null)
    .lte('retake_scheduled_at', nowIso);
  if (error) { console.error('[retake] query err:', error.message); return; }
  if (!due || due.length === 0) return;

  for (const conv of due) {
    try {
      const { data: claimed } = await supabase
        .from('conversations')
        .update({ retake_scheduled_at: null })
        .eq('contact_id', conv.contact_id)
        .eq('retake_scheduled_at', conv.retake_scheduled_at)
        .select('contact_id');
      if (!claimed || claimed.length === 0) continue;

      const contact = await getContact(conv.contact_id).catch(() => null);
      const fullName = conv.full_name || contact?.firstName || 'Lead';
      const advisor = await resolveAdvisor(contact);
      const tags = Array.isArray(contact?.tags) ? contact.tags : [];
      console.log(`[${fullName}] retake disparando (reactivación tras ${RETAKE_DELAY_MIN} min)`);
      await runTurn({
        conversation: { ...conv, retake_scheduled_at: null },
        contactId: conv.contact_id,
        fullName,
        userMessage: '__TRIGGER_INICIAL__',
        advisor,
        tags,
        isReactivation: true
      });
    } catch (err) {
      console.error(`[retake] ${conv.contact_id} err:`, err.response?.data || err.message);
    }
  }
}
