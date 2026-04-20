import './env.js';
import express from 'express';
import cron from 'node-cron';
import { getOrCreateConversation, updateConversation, getRecentMessages, logMessage } from './db.js';
import { sendSMS, getContact, getUser, createAppointment, createContactNote } from './ghl.js';
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
  const isReactivation = detectReactivation(tags);

  const conversation = await getOrCreateConversation({
    contactId,
    locationId: process.env.GHL_LOCATION_ID,
    phone,
    fullName
  });

  if (conversation.stage === 'finalizado') {
    console.log(`[${fullName}] conversación finalizada, no responde`);
    return;
  }

  const attachments = rawAttachments.length > 0 ? await processAttachments(rawAttachments) : [];
  if (attachments.length > 0) {
    const kinds = attachments.map(a => a.kind).join(',');
    console.log(`[${fullName}] ${attachments.length} attachment(s): ${kinds}`);
  }

  await runTurn({ conversation, contactId, fullName, userMessage, attachments, advisor, tags, isReactivation });
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

  const delayMs = getNaturalDelay();
  console.log(`[${leadName || fullName}] esperando ${delayMs}ms (respuesta natural) antes de enviar SMS`);
  await sleep(delayMs);
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
