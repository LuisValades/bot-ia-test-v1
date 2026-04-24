import './env.js';
import express from 'express';
import cron from 'node-cron';
import { getOrCreateConversation, updateConversation, getRecentMessages, logMessage, clearConversation } from './db.js';
import { sendSMS, getContact, getUser, createContactNote, createOpportunityNote, createInternalComment, createTask, addContactTags, removeContactTags, findContactOpportunity, moveOpportunityStage } from './ghl.js';
import { sendEscalationEmail, isEmailEnabled } from './notifications.js';
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

const MESSAGE_BUFFER_MS = parseInt(process.env.MESSAGE_BUFFER_MS || '30000', 10);
const pendingBuffers = new Map(); // contactId -> { timer, payloads[], startedAt }

function flushBuffer(contactId) {
  const entry = pendingBuffers.get(contactId);
  if (!entry) return;
  pendingBuffers.delete(contactId);

  const payloads = entry.payloads;
  const base = payloads[payloads.length - 1].body || payloads[payloads.length - 1];
  const mergedBody = { ...base };

  const parts = payloads
    .map(p => coerceMessage((p.body || p).message ?? (p.body || p).body ?? (p.body || p).last_message?.body ?? ''))
    .map(s => String(s || '').trim())
    .filter(Boolean);
  mergedBody.message = parts.join('\n');

  const allAtts = payloads.flatMap(p => {
    const pb = p.body || p;
    return pb.attachments || pb.last_message?.attachments || [];
  });
  if (allAtts.length > 0) mergedBody.attachments = allAtts;

  console.log(`[${contactId}] buffer flush: ${payloads.length} msg(s) → "${mergedBody.message.slice(0, 80)}..."`);

  serializePerContact(contactId, async () => {
    try {
      await handleReply({ body: mergedBody });
    } catch (err) {
      console.error('Error en reply (buffered):', err.response?.data || err.message);
    }
  });
}

function enqueueReply(payload) {
  const contactId = extractContactId(payload);
  if (!contactId) {
    console.warn('[reply] sin contactId, descartando');
    return;
  }

  const existing = pendingBuffers.get(contactId);
  if (existing) {
    clearTimeout(existing.timer);
    existing.payloads.push(payload);
    existing.timer = setTimeout(() => flushBuffer(contactId), MESSAGE_BUFFER_MS);
    console.log(`[${contactId}] buffer +1 (total ${existing.payloads.length}), timer reset ${MESSAGE_BUFFER_MS / 1000}s`);
    return;
  }

  const entry = { payloads: [payload], startedAt: Date.now(), timer: null };
  entry.timer = setTimeout(() => flushBuffer(contactId), MESSAGE_BUFFER_MS);
  pendingBuffers.set(contactId, entry);
  console.log(`[${contactId}] buffer start, aguantando ${MESSAGE_BUFFER_MS / 1000}s por si llegan más mensajes`);
}

app.post('/webhook/ghl/reply', async (req, res) => {
  res.status(200).json({ received: true });
  enqueueReply(req.body);
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

  // --- Comando /clear — reinicia la conversación desde cero ---
  if (userMessage && /^\s*\/?clear\s*$/i.test(userMessage)) {
    console.log(`[${contactId}] comando CLEAR recibido, reiniciando conversación`);
    await clearConversation(contactId);
    try {
      await sendSMS({ contactId, message: 'OK, conversación reiniciada. Escríbeme para empezar de cero.' });
    } catch (err) {
      console.error(`[${contactId}] fallo enviando confirmación de clear:`, err.message);
    }
    return;
  }

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

  // --- Reactivación automática ---
  // Si el contacto vuelve al flujo del bot (tiene el tag "bot ia" y NO tiene
  // el tag "atencion-asesor"), reactivamos su conversación en Supabase aunque
  // antes haya sido escalada. Esto le permite al asesor devolver leads al bot
  // con solo mover la etiqueta en GHL, sin tener que tocar Supabase.
  const BOT_TAG = (process.env.GHL_BOT_TAG || 'bot ia').trim().toLowerCase();
  const ESCALATION_TAG = (process.env.GHL_ESCALATION_TAG || 'atencion-asesor').trim().toLowerCase();
  const tagsLower = tags.map(t => String(t).trim().toLowerCase());
  const hasBotTag = tagsLower.includes(BOT_TAG);
  const hasEscalationTag = tagsLower.includes(ESCALATION_TAG);

  if (hasEscalationTag) {
    console.log(`[${fullName}] contacto tiene tag "${ESCALATION_TAG}" — bot no responde, está con asesor humano`);
    return;
  }

  if (
    hasBotTag &&
    (conversation.stage === 'escalado' || conversation.stage === 'finalizado')
  ) {
    console.log(
      `[${fullName}] regresó al bot (tag "${BOT_TAG}" presente sin "${ESCALATION_TAG}") — reactivando: ${conversation.stage} → calificando`
    );
    await updateConversation(contactId, { stage: 'calificando' }).catch(err =>
      console.error('[reactivar] updateConversation err:', err.message)
    );
    conversation.stage = 'calificando';
  }

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
      phone: contact?.phone,
      advisor,
      reason: 'lead-requested',
      triggeringMessage: userMessage,
      profile: conversation.profile || {}
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

// Mapa estático de asesores por userId (email + phone para notificaciones).
// Complementa la info que llega de la API GHL Users.
const ADVISOR_STATIC_MAP = {
  [process.env.GHL_LUIS_USER_ID || '']: {
    email: process.env.GHL_LUIS_ADVISOR_EMAIL || 'luis@crediexpres.com',
    phone: process.env.GHL_LUIS_ADVISOR_PHONE || null
  },
  [process.env.GHL_EFRAIN_USER_ID || '']: {
    email: process.env.GHL_EFRAIN_EMAIL || 'efrain@crediexpres.com',
    phone: process.env.GHL_EFRAIN_PHONE || null
  },
  [process.env.GHL_JONNY_USER_ID || '']: {
    email: process.env.GHL_JONNY_EMAIL || 'jonny@crediexpres.com',
    phone: process.env.GHL_JONNY_PHONE || null
  },
  [process.env.GHL_SAUL_USER_ID || '']: {
    email: process.env.GHL_SAUL_EMAIL || 'saul@crediexpres.com',
    phone: process.env.GHL_SAUL_PHONE || null
  }
};

async function resolveAdvisor(contact) {
  // Prioridad: asesor de la OPORTUNIDAD (opportunity.assignedTo).
  // Fallback: asesor del contacto (contact.assignedTo).
  let advisorId = null;
  let source = null;

  if (contact?.id) {
    try {
      const opp = await findContactOpportunity(contact.id);
      if (opp?.assignedTo) {
        advisorId = opp.assignedTo;
        source = `opportunity:${opp.id}`;
      }
    } catch (err) {
      console.warn('[resolveAdvisor] fallo buscando opp:', err.message);
    }
  }

  if (!advisorId && contact?.assignedTo) {
    advisorId = contact.assignedTo;
    source = 'contact';
  }

  if (!advisorId) return null;

  const staticInfo = ADVISOR_STATIC_MAP[advisorId] || {};
  const user = await getUser(advisorId);
  const name = user
    ? (user.firstName || user.name || (user.email ? user.email.split('@')[0] : null))
    : null;
  const advisor = {
    id: advisorId,
    name,
    email: user?.email || staticInfo.email || null,
    phone: user?.phone || staticInfo.phone || null,
    source
  };
  return advisor;
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
  const profileData = conversation.profile || {};
  const profileFieldsCount = Object.keys(profileData).filter(k => profileData[k] != null && profileData[k] !== '').length;
  const leadAskedToBook = !isInitial && /\b(agend|cita|llamada|horario|hora|slot|disponib|cu[áa]ndo|marc|llam)\b/i.test(userMessage || '');
  // Detectar hora explícita: "5 pm", "11am", "3 de la tarde", "17:00", "mañana 10"
  const hasExplicitTime = !isInitial && (
    /\b\d{1,2}\s*(?::\d{2})?\s*(am|pm|hrs?|h\.?)\b/i.test(userMessage || '') ||
    /\b\d{1,2}\s*(?:de la|de)\s+(ma[ñn]ana|tarde|noche)/i.test(userMessage || '') ||
    /\b(en\s+\d+\s+(?:hora|minuto)s?|ma[ñn]ana|hoy|pr[óo]xim|siguiente|m[áa]s tarde)\b/i.test(userMessage || '')
  );
  const stageAllowsSlots = conversation.stage === 'proponiendo_horario';
  const profileReady = profileFieldsCount >= 2;
  const shouldExposeSlots = activeStage && (stageAllowsSlots || profileReady || leadAskedToBook || hasExplicitTime);

  if (shouldExposeSlots) {
    availableSlots = await getNextSlots({ daysAhead: 7, take: 6 });
    slotPairs = formatSlotPairs(availableSlots, 6);
    slotsContext = formatSlotsForLead(availableSlots, 6);
    slotsMenu = formatSlotsMenu(availableSlots, 6);
    console.log(`[${leadName || fullName}] slots reales (expuestos al LLM):`, slotsContext);
  } else if (activeStage) {
    console.log(`[${leadName || fullName}] slots NO expuestos — stage=${conversation.stage}, profileFields=${profileFieldsCount}, leadAskedToBook=${leadAskedToBook}`);
  }

  const promptInput = isInitial
    ? (isReactivation
      ? (hasName
        ? `[SISTEMA: Lead en REACTIVACIÓN. ${leadName} fue contactado antes pero la conversación no avanzó. Salúdalo por nombre reconociendo que hace tiempo no hablaban (sin fingir memoria personal), menciona que eres Alejandra de Crediexpres y pregúntale si sigue interesado en un crédito. Tono cálido y breve.]`
        : `[SISTEMA: Lead en REACTIVACIÓN (sin nombre conocido). Fue contactado antes. Salúdalo, preséntate como Alejandra de Crediexpres, reconoce que hace tiempo no hablaban y pregúntale su nombre para retomar.]`)
      : (hasName
        ? `[SISTEMA: Nuevo lead (${leadName}) en etapa "${process.env.GHL_TRIGGER_STAGE_NAME}". Salúdalo POR SU NOMBRE, preséntate como Alejandra de Crediexpres y pregunta qué tipo de crédito le interesa.]`
        : `[SISTEMA: Nuevo lead en etapa "${process.env.GHL_TRIGGER_STAGE_NAME}". Salúdalo, preséntate como Alejandra de Crediexpres y PREGUNTA SU NOMBRE antes de avanzar.]`))
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
    const mergedProfileForEsc = { ...(conversation.profile || {}), ...(action.profile_updates || {}) };
    await escalateToAdvisor({
      contactId,
      conversationId: conversation.id,
      leadName: leadName || fullName,
      phone: contact?.phone,
      advisor,
      reason: 'ai-cannot-answer',
      triggeringMessage: userMessage,
      profile: mergedProfileForEsc,
      callbackWindow: mergedProfileForEsc.callback_window || null
    });
    return;
  }

  // Rescue: si el modelo no setó book_slot pero el lead dio hora explícita, cargar slots on-demand
  if (!action.book_slot && !isInitial && hasExplicitTime && availableSlots.length === 0) {
    availableSlots = await getNextSlots({ daysAhead: 7, take: 12 });
    slotPairs = formatSlotPairs(availableSlots, 12);
    console.log(`[${leadName || 'Lead'}] rescue: cargué ${availableSlots.length} slots on-demand por hora explícita en "${userMessage}"`);
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

  // Fallback crítico: si el modelo mintió ("está agendado" en texto) pero no hay book_slot,
  // escalar de todos modos para que el asesor contacte manualmente con la ventana que pidió el lead
  const modelClaimsBooked = /(est[áa]\s+agendad|qued[óo]\s+agendad|te\s+llamar[áa]|te\s+marca|agendamos)/i.test(replyText || '');
  if (!action.book_slot && modelClaimsBooked && hasExplicitTime) {
    console.warn(`[${leadName || 'Lead'}] modelo dijo "agendado" sin book_slot — disparando escalación con callback manual`);
    try {
      const oppForFallback = await findContactOpportunity(contactId);
      await dispatchEscalationNotifications({
        contactId,
        conversationId: conversation.id,
        leadName: leadName || fullName,
        phone: contact?.phone,
        advisor,
        reason: 'appointment-booked',
        triggeringMessage: userMessage,
        profile: { ...(conversation.profile || {}), ...(action.profile_updates || {}), intent: action.intent },
        callbackWindow: `lead pidió: "${userMessage}" (sin slot en calendario, agendar manual)`,
        opportunityId: oppForFallback?.id || null
      });
      await updateConversation(contactId, { stage: 'confirmado', intent: action.intent });
    } catch (notifErr) {
      console.error(`[${leadName || fullName}] fallo en fallback notif:`, notifErr.message);
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
      // Nota: NO se crea evento en calendar del asesor. En su lugar, creamos una
      // actividad pendiente (task GHL) + disparamos email + notas. El asesor
      // agenda manualmente en su calendario cuando reciba la notificación.
      appointmentAt = matched;
      await updateConversation(contactId, {
        stage: 'confirmado',
        intent: action.intent,
        appointment_at: appointmentAt
      });

      try {
        const oppForBooking = await findContactOpportunity(contactId);
        await dispatchEscalationNotifications({
          contactId,
          conversationId: conversation.id,
          leadName: leadName || fullName,
          phone: contact?.phone,
          advisor,
          reason: 'appointment-booked',
          triggeringMessage: userMessage,
          profile: { ...(conversation.profile || {}), ...(action.profile_updates || {}), intent: action.intent },
          callbackWindow: formatSlotEs ? formatSlotEs(matched) : matched,
          dueDate: matched,
          opportunityId: oppForBooking?.id || null
        });
      } catch (notifErr) {
        console.error(`[${leadName || fullName}] fallo notificando cita:`, notifErr.message);
      }

    }
  } else if (!action.propose_slots) {
    await updateConversation(contactId, {
      stage: action.next_stage || conversation.stage,
      intent: action.intent || conversation.intent
    });
  }

  replyText = sanitizeReply(replyText, advisor);

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

/**
 * Safety net quirúrgico: si el modelo mandó un bloque de slots horarios
 * numerados, remueve SÓLO ese bloque y deja el resto del mensaje intacto.
 * Requiere AM/PM explícito o HH:MM para evitar falsos positivos con listas
 * de productos ("1 - 500k", "1 - TPV") o montos.
 */
function sanitizeReply(text, advisor) {
  if (!text) return text;

  // Línea de slot horario: "1 - 10am" | "2 - 11:00pm" | "3 - 12:00"
  const slotLineRegex = /^[ \t]*\d+\s*[-–—]\s*(?:\d{1,2}:\d{2}(?:\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))\s*$/gim;
  const slotMatches = text.match(slotLineRegex) || [];
  const hasSlotsHeader = /(horarios disponibles|aqu[íi] est[áa]n? los horarios|estos son los horarios)/i.test(text);

  // Solo intervenir si hay ≥2 slots consecutivos o header+≥1 slot
  if (slotMatches.length < 2 && !(hasSlotsHeader && slotMatches.length >= 1)) {
    return text;
  }

  let out = text;
  // Quitar header tipo "Aquí están los horarios disponibles:"
  out = out.replace(/(?:^|\n)[^\n]*(horarios disponibles|aqu[íi] est[áa]n? los horarios|estos son los horarios)[^\n]*\n?/gim, '\n');
  // Quitar línea de día ("Jueves 23 de abril")
  out = out.replace(/(?:^|\n)(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)[^\n]*\n?/gim, '\n');
  // Quitar las líneas de slots
  out = out.replace(slotLineRegex, '');
  // Quitar cierre "¿Cuál te queda bien?" si quedó suelto
  out = out.replace(/\n?[^\n]*¿cu[aá]l te queda[^?]*\?[^\n]*/gi, '');
  // Compactar blancos
  out = out.replace(/\n{3,}/g, '\n\n').trim();

  // Si quedó muy corto, agregar cierre de callback flexible
  const advisorName = advisor?.name || 'Efraín';
  if (!out || out.length < 30 || !/(llamar|hora|asesor|Efra[íi]n)/i.test(out)) {
    out = `Le paso los comentarios a ${advisorName}.\n\n¿Te puede llamar en 2 horas? Si prefieres otra hora, dime a qué hora (horario 11 AM - 7 PM).`;
  } else if (!/(2 horas|¿a qu[eé] hora|qu[eé] hora)/i.test(out)) {
    out = `${out}\n\n¿Te puede llamar en 2 horas? Si prefieres otra hora, dime cuándo.`;
  }

  console.warn(`[sanitize] removido bloque de ${slotMatches.length} slots numerados. Conservado el resto.`);
  return out;
}

function detectTone(triggeringMessage, history = []) {
  const text = [(triggeringMessage || ''), ...history.slice(-3).map(m => m.body || '')]
    .join(' ')
    .toLowerCase();
  if (/\b(molesto|enojado|harto|estafa|cagad|demand|queja|inútil|no sirve)\b/.test(text)) return 'molesto';
  if (/\b(urgente|rápido|pronto|ya|ahorita|ahora)\b/.test(text)) return 'con prisa';
  if (/\b(gracias|perfecto|excelente|genial|sale)\b/.test(text)) return 'interesado';
  return 'neutral';
}

async function dispatchEscalationNotifications({
  contactId,
  conversationId,
  leadName,
  phone,
  advisor,
  reason,
  triggeringMessage,
  profile,
  callbackWindow,
  opportunityId,
  dueDate
}) {
  const history = await getRecentMessages(contactId, 15).catch(() => []);
  const tone = detectTone(triggeringMessage, history);

  const reasonLabel =
    reason === 'lead-requested'
      ? 'Lead pidió hablar con humano'
      : reason === 'profile-complete'
        ? 'Perfil completo — lead listo para llamada'
        : reason === 'appointment-booked'
          ? 'Cita agendada'
          : 'Escalación automática';

  const profileLines = Object.entries(profile || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `  • ${k}: ${v}`)
    .join('\n');

  const noteBody = [
    `⚠️ ${reasonLabel}`,
    '',
    `Lead: ${leadName || '(sin nombre)'}${phone ? ` · ${phone}` : ''}`,
    `Asesor asignado: ${advisor?.name || '(sin asesor)'}`,
    callbackWindow ? `Ventana callback: ${callbackWindow}` : null,
    `Tono detectado: ${tone}`,
    '',
    profileLines ? `Perfil capturado:\n${profileLines}` : null,
    '',
    triggeringMessage ? `Último mensaje del lead: "${triggeringMessage.slice(0, 300)}"` : null,
    '',
    '— Alejandra dejó de responder. Toma tú la conversación.'
  ]
    .filter(v => v !== null && v !== undefined)
    .join('\n');

  // Título corto para la task (aparece en la lista de actividades del asesor)
  const intent = profile?.intent || '';
  const monto = profile?.monto || profile?.valor_propiedad || '';
  const taskTitle = `Llamar a ${leadName || 'lead'}${intent ? ` · ${intent}` : ''}${monto ? ` · ${monto}` : ''}${callbackWindow ? ` · ${callbackWindow}` : ''}`.slice(0, 120);

  const results = await Promise.allSettled([
    isEmailEnabled()
      ? sendEscalationEmail({
          advisor,
          leadName,
          contactId,
          phone,
          profile,
          reason,
          callbackWindow,
          tone,
          history,
          triggeringMessage
        })
      : Promise.resolve({ sent: false, error: 'email disabled' }),
    createContactNote({ contactId, body: noteBody }),
    opportunityId ? createOpportunityNote({ opportunityId, body: noteBody }) : Promise.resolve(null),
    createInternalComment({ contactId, conversationId, body: noteBody }),
    createTask({
      contactId,
      title: taskTitle,
      body: noteBody,
      assignedTo: advisor?.id || null,
      dueDate: dueDate || null
    })
  ]);

  const [emailRes, contactNoteRes, oppNoteRes, internalRes, taskRes] = results;
  console.log(
    `[${leadName}] notifs → email:${emailRes.status === 'fulfilled' && emailRes.value?.sent ? 'OK' : 'X'} contact-note:${contactNoteRes.status === 'fulfilled' ? 'OK' : 'X'} opp-note:${oppNoteRes.status === 'fulfilled' && oppNoteRes.value ? 'OK' : 'skip'} internal:${internalRes.status === 'fulfilled' && internalRes.value ? 'OK' : 'skip'} task:${taskRes.status === 'fulfilled' && taskRes.value ? 'OK' : 'X'}`
  );
  if (emailRes.status === 'fulfilled' && !emailRes.value?.sent && emailRes.value?.error) {
    console.warn(`[${leadName}] email err: ${emailRes.value.error}`);
  }
  if (taskRes.status === 'rejected') {
    console.warn(`[${leadName}] task err:`, taskRes.reason?.message);
  }
}

async function escalateToAdvisor({ contactId, conversationId, leadName, advisor, reason, triggeringMessage, profile, callbackWindow, phone }) {
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

  let opportunityId = null;
  const opp = await findContactOpportunity(contactId);
  if (opp?.id) {
    opportunityId = opp.id;
    if (escalationStageId && escalationPipelineId) {
      await moveOpportunityStage({
        opportunityId: opp.id,
        pipelineId: escalationPipelineId,
        stageId: escalationStageId
      });
      console.log(`[${leadName}] oportunidad movida a etapa de escalación ${escalationStageId}`);
    }
  } else {
    console.warn(`[${leadName}] no encontré oportunidad para escalación`);
  }

  try {
    await dispatchEscalationNotifications({
      contactId,
      conversationId,
      leadName,
      phone,
      advisor,
      reason,
      triggeringMessage,
      profile,
      callbackWindow,
      opportunityId
    });
  } catch (err) {
    console.error(`[${leadName}] fallo en dispatchEscalationNotifications:`, err.message);
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
