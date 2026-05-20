import { ghl, LOCATION_ID } from './clients.js';
import { findBlockingNote } from './note-parser.js';

const NEGATIVE_RESPONSES = /\b(no\s+(?:me\s+)?(?:interesa|quiero|gracias)|ya\s+no|d[eé]jame\s+en\s+paz|deja(?:nos|me)|no\s+contacten|no\s+escriban)\b/i;
const STAGE_BOT = ['Ingreso - Test Agent IA', 'Bot IA'];

/**
 * Pull notas y mensajes recientes del lead para evaluar contexto.
 */
async function fetchGhlContext(contactId) {
  const result = { notes: [], messages: [], conversationId: null };
  try {
    const r = await ghl.get(`/contacts/${contactId}/notes`);
    result.notes = r.data?.notes || [];
  } catch (err) {
    console.warn(`  [checks] notes fetch falló para ${contactId}: ${err.message}`);
  }
  try {
    const r = await ghl.get('/conversations/search', {
      params: { contactId, locationId: LOCATION_ID, limit: 1 }
    });
    const conv = r.data?.conversations?.[0];
    if (conv) {
      result.conversationId = conv.id;
      const m = await ghl.get(`/conversations/${conv.id}/messages`, { params: { limit: 50 } });
      result.messages = m.data?.messages?.messages || m.data?.messages || [];
    }
  } catch (err) {
    console.warn(`  [checks] messages fetch falló para ${contactId}: ${err.message}`);
  }
  return result;
}

/**
 * Corre los 8 filtros sobre un lead. Devuelve {eligible: true} o {eligible: false, reason}.
 * También devuelve el ghl context fetched para reusar en LLM.
 */
export async function evaluateLead(lead) {
  const reasons = [];

  // 1. Retake programado (cualquier fecha futura)
  if (lead.bot_retake_scheduled_at) {
    return {
      eligible: false,
      reason: `Retake programado ${humanDate(lead.bot_retake_scheduled_at)}`,
      check: 'retake_programado'
    };
  }

  // 2. Cita futura
  if (lead.bot_appointment_at) {
    const apt = new Date(lead.bot_appointment_at).getTime();
    if (apt > Date.now()) {
      return {
        eligible: false,
        reason: `Cita programada ${humanDate(lead.bot_appointment_at)}`,
        check: 'cita_futura'
      };
    }
  }

  const tags = Array.isArray(lead.tags) ? lead.tags : [];

  // 3. Alejandra activa (tag "bot ia" en stage del bot, no escalado)
  if (tags.includes('bot ia') && STAGE_BOT.includes(lead.stage_name)) {
    const botActive = !['escalado', 'finalizado'].includes(lead.bot_stage || '');
    if (botActive) {
      return {
        eligible: false,
        reason: `Alejandra activa (stage="${lead.stage_name}" + tag bot ia)`,
        check: 'alejandra_activa'
      };
    }
  }

  // 4. Tags negativas
  const blockingTags = ['atencion-asesor', 'no-contactar', 'no contactar', 'cerrado', 'no-insistir'];
  const hitTag = tags.find(t => blockingTags.includes((t || '').toLowerCase()));
  if (hitTag) {
    return { eligible: false, reason: `Tag bloqueante: "${hitTag}"`, check: 'tag_bloqueante' };
  }

  // Pull GHL context (notas + mensajes) para checks 5-8
  const ctx = await fetchGhlContext(lead.contact_id);

  // 5. Nota con fecha futura / instrucción asesor
  const blockingNote = findBlockingNote(ctx.notes);
  if (blockingNote) {
    return {
      eligible: false,
      reason: `Nota GHL con ${blockingNote.match}: ${blockingNote.detail}`,
      check: 'nota_bloqueante',
      note_body: blockingNote.body,
      ghl_context: ctx
    };
  }

  // 6. Último mensaje out < 48h (ya le hablaron recientemente)
  const lastOut = ctx.messages
    .filter(m => m.direction === 'outbound')
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))[0];
  if (lastOut && lastOut.dateAdded) {
    const hoursAgo = (Date.now() - new Date(lastOut.dateAdded).getTime()) / 3_600_000;
    if (hoursAgo < 48) {
      return {
        eligible: false,
        reason: `Último SMS al lead hace ${hoursAgo.toFixed(1)}h (< 48h cooldown)`,
        check: 'sms_reciente',
        ghl_context: ctx
      };
    }
  }

  // 7. Lead respondió "no me interesa" en últimos 30 días
  const recent30d = Date.now() - 30 * 24 * 3_600_000;
  const negative = ctx.messages
    .filter(m => m.direction === 'inbound' && m.dateAdded && new Date(m.dateAdded).getTime() > recent30d)
    .find(m => NEGATIVE_RESPONSES.test(m.body || ''));
  if (negative) {
    return {
      eligible: false,
      reason: `Lead respondió rechazando: "${(negative.body || '').slice(0, 80)}"`,
      check: 'lead_rechazo',
      ghl_context: ctx
    };
  }

  // 8. Sin teléfono → no podemos enviar SMS
  if (!lead.telefono) {
    return { eligible: false, reason: 'Sin teléfono registrado', check: 'sin_telefono' };
  }

  return { eligible: true, ghl_context: ctx };
}

function humanDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).format(new Date(iso));
}
