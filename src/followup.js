import { supabase, getRecentMessages, updateConversation, logMessage } from './db.js';
import { sendSMS } from './ghl.js';
import { chat } from './ai.js';
import { getNextSlots, formatSlotsForLead, formatSlotPairs } from './calendar.js';

const FOLLOWUP_DELAY_MIN = parseInt(process.env.FOLLOWUP_DELAY_MIN || '90', 10);
const MAX_FOLLOWUPS = parseInt(process.env.MAX_FOLLOWUPS || '2', 10);
const FINAL_CLOSURE_DELAY_HOURS = parseInt(process.env.FINAL_CLOSURE_DELAY_HOURS || '24', 10);
const ACTIVE_STAGES = ['inicio', 'calificando', 'proponiendo_horario', 'confirmado'];

const CLOSURE_MESSAGE = `Este será mi último mensaje de seguimiento.

Entiendo que quizás no es el momento ideal para continuar con tu trámite.

Si en el futuro decides retomar, avísanos y con gusto te apoyamos.

Mientras tanto, te invitamos a seguirnos:
📺 YouTube: https://www.youtube.com/@luisvaladesbroker
🔵 Facebook: https://www.facebook.com/luis.valades.broker.hipotecario/`;

function isBusinessHours() {
  const skipWeekend = (process.env.FOLLOWUP_SKIP_WEEKEND || 'true').toLowerCase() !== 'false';
  const windowStart = process.env.FOLLOWUP_WINDOW_START || '11:00';
  const windowEnd = process.env.FOLLOWUP_WINDOW_END || '19:00';
  const timezone = process.env.BOT_TIMEZONE || 'America/Mexico_City';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date()).reduce((a, p) => ({ ...a, [p.type]: p.value }), {});

  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dayMap[parts.weekday];
  if (skipWeekend && (dow === 0 || dow === 6)) return false;

  const current = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  const [sh, sm] = windowStart.split(':').map(n => parseInt(n, 10));
  const [eh, em] = windowEnd.split(':').map(n => parseInt(n, 10));
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return current >= startMin && current < endMin;
}

export async function runFollowups() {
  if (!isBusinessHours()) {
    return;
  }

  const nudgeActiveStages = ['inicio', 'calificando', 'proponiendo_horario'];
  const cutoff = new Date(Date.now() - FOLLOWUP_DELAY_MIN * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from('conversations')
    .select('*')
    .in('stage', nudgeActiveStages)
    .lt('followup_count', MAX_FOLLOWUPS)
    .lt('last_msg_at', cutoff);

  if (error) {
    console.error('[followup] query error:', error.message);
  } else if (candidates && candidates.length > 0) {
    for (const conv of candidates) {
      try {
        await sendFollowup(conv);
      } catch (err) {
        console.error(`[followup] ${conv.contact_id} err:`, err.response?.data || err.message);
      }
    }
  }

  await runClosures();
}

async function runClosures() {
  const closureCutoff = new Date(Date.now() - FINAL_CLOSURE_DELAY_HOURS * 60 * 60 * 1000).toISOString();
  const closureActiveStages = ['inicio', 'calificando', 'proponiendo_horario'];

  const { data: toClose, error } = await supabase
    .from('conversations')
    .select('*')
    .in('stage', closureActiveStages)
    .gte('followup_count', MAX_FOLLOWUPS)
    .lt('last_msg_at', closureCutoff);

  if (error) { console.error('[closure] query err:', error.message); return; }
  if (!toClose || toClose.length === 0) return;

  for (const conv of toClose) {
    try {
      await sendClosure(conv);
    } catch (err) {
      console.error(`[closure] ${conv.contact_id} err:`, err.response?.data || err.message);
    }
  }
}

async function sendClosure(conv) {
  const { contact_id: contactId, full_name: fullName, id: conversationId } = conv;
  const { data: claimed } = await supabase
    .from('conversations')
    .update({ stage: 'finalizado' })
    .eq('contact_id', contactId)
    .neq('stage', 'finalizado')
    .select('contact_id');
  if (!claimed || claimed.length === 0) return;

  const { sendMultiPartSMS } = await import('./index.js');
  const result = await sendMultiPartSMS({ contactId, message: CLOSURE_MESSAGE, leadName: fullName });

  await logMessage({
    contactId,
    conversationId,
    direction: 'out',
    body: CLOSURE_MESSAGE,
    ghlMessageId: result?.ghlMessageId,
    metadata: { closure: true, chunks_count: result?.chunks?.length }
  });

  console.log(`[closure] ${fullName}: mensaje de cierre enviado, stage=finalizado`);
}

async function sendFollowup(conv) {
  const { contact_id: contactId, full_name: fullName, id: conversationId } = conv;
  const prevCount = conv.followup_count || 0;
  const nudgeNumber = prevCount + 1;

  const history = await getRecentMessages(contactId, 100);
  if (history.length === 0) return;
  const lastMsg = history[history.length - 1];
  if (lastMsg.direction !== 'out') return;

  const { data: claim, error: claimErr } = await supabase
    .from('conversations')
    .update({ followup_count: nudgeNumber })
    .eq('contact_id', contactId)
    .eq('followup_count', prevCount)
    .select('contact_id');
  if (claimErr || !claim || claim.length === 0) return;

  const nudgePrompt = nudgeNumber === 1
    ? `[SISTEMA: El lead ${fullName} no ha respondido desde hace ${FOLLOWUP_DELAY_MIN}+ minutos. Revisa la conversación y manda un recordatorio breve, conversacional y cercano. NO repitas lo mismo. Si ya propusiste horarios, recuérdaselos. Mantén el tono de Alejandra.]`
    : `[SISTEMA: Segundo y último recordatorio para ${fullName}. Sigue sin responder. Manda un mensaje breve y cordial ofreciendo que te avise cuando pueda platicar. Sin presión.]`;

  const hasName = !!(fullName && String(fullName).trim().length >= 3 && fullName.toLowerCase() !== 'lead');

  const freshSlots = await getNextSlots({ daysAhead: 7, take: 6 }).catch(() => []);
  const slotPairs = formatSlotPairs(freshSlots, 6);
  const slotsContext = formatSlotsForLead(freshSlots, 6);

  const aiResponse = await chat({
    history,
    userMessage: nudgePrompt,
    contactName: fullName,
    hasName,
    slotsContext,
    slotPairs,
    availableSlotsIso: freshSlots
  });

  const replyText = aiResponse.text;
  const { sendMultiPartSMS } = await import('./index.js');
  const result = await sendMultiPartSMS({ contactId, message: replyText, leadName: fullName });

  await updateConversation(contactId, {
    followup_at: new Date().toISOString(),
    intent: aiResponse.action?.intent || conv.intent
  });

  const usage = aiResponse.usage || {};
  await logMessage({
    contactId,
    conversationId,
    direction: 'out',
    body: replyText,
    aiModel: aiResponse.model,
    aiTokensIn: usage.prompt_tokens,
    aiTokensOut: usage.completion_tokens,
    ghlMessageId: result?.ghlMessageId,
    metadata: { followup: true, nudge_number: nudgeNumber, action: aiResponse.action, chunks_count: result?.chunks?.length }
  });

  console.log(`[followup #${nudgeNumber}] ${fullName}: "${replyText}"`);
}
