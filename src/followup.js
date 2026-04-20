import { supabase, getRecentMessages, updateConversation, logMessage } from './db.js';
import { sendSMS } from './ghl.js';
import { chat } from './ai.js';

const FOLLOWUP_DELAY_MIN = parseInt(process.env.FOLLOWUP_DELAY_MIN || '5', 10);
const MAX_FOLLOWUPS = parseInt(process.env.MAX_FOLLOWUPS || '2', 10);
const ACTIVE_STAGES = ['inicio', 'calificando', 'proponiendo_horario'];

export async function runFollowups() {
  const cutoff = new Date(Date.now() - FOLLOWUP_DELAY_MIN * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from('conversations')
    .select('*')
    .in('stage', ACTIVE_STAGES)
    .lt('followup_count', MAX_FOLLOWUPS)
    .lt('last_msg_at', cutoff);

  if (error) {
    console.error('[followup] query error:', error.message);
    return;
  }
  if (!candidates || candidates.length === 0) return;

  for (const conv of candidates) {
    try {
      await sendFollowup(conv);
    } catch (err) {
      console.error(`[followup] ${conv.contact_id} err:`, err.response?.data || err.message);
    }
  }
}

async function sendFollowup(conv) {
  const { contact_id: contactId, full_name: fullName, id: conversationId } = conv;
  const prevCount = conv.followup_count || 0;
  const nudgeNumber = prevCount + 1;

  const history = await getRecentMessages(contactId, 10);
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

  const aiResponse = await chat({
    history,
    userMessage: nudgePrompt,
    contactName: fullName,
    slotsContext: ''
  });

  const replyText = aiResponse.text;
  const sent = await sendSMS({ contactId, message: replyText });

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
    ghlMessageId: sent?.messageId || sent?.id,
    metadata: { followup: true, nudge_number: nudgeNumber, action: aiResponse.action }
  });

  console.log(`[followup #${nudgeNumber}] ${fullName}: "${replyText}"`);
}
