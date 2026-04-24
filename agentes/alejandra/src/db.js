import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

export async function getOrCreateConversation({ contactId, locationId, phone, fullName }) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contactId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      contact_id: contactId,
      location_id: locationId,
      phone,
      full_name: fullName,
      stage: 'inicio'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function clearConversation(contactId) {
  if (!contactId) return;
  const resetPatch = {
    stage: 'inicio',
    profile: {},
    intent: null,
    proposed_slots: null,
    appointment_id: null,
    appointment_at: null,
    followup_count: 0,
    followup_at: null,
    retake_scheduled_at: null,
    last_msg_at: new Date().toISOString()
  };
  const { error: updErr } = await supabase
    .from('conversations')
    .update(resetPatch)
    .eq('contact_id', contactId);
  if (updErr) console.warn('[clearConversation] update err:', updErr.message);

  const { error: delErr } = await supabase
    .from('messages')
    .delete()
    .eq('contact_id', contactId);
  if (delErr) console.warn('[clearConversation] delete msgs err:', delErr.message);
}

export async function updateConversation(contactId, patch) {
  const { error } = await supabase
    .from('conversations')
    .update({ ...patch, last_msg_at: new Date().toISOString() })
    .eq('contact_id', contactId);
  if (error) throw error;
}

export async function getRecentMessages(contactId, limit = 100) {
  const { data, error } = await supabase
    .from('messages')
    .select('direction, body, created_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).reverse();
}

export async function logMessage({
  contactId,
  conversationId,
  direction,
  body,
  aiModel,
  aiTokensIn,
  aiTokensOut,
  aiCostUsd,
  ghlMessageId,
  metadata
}) {
  const { error } = await supabase.from('messages').insert({
    contact_id: contactId,
    conversation_id: conversationId,
    direction,
    body,
    ai_model: aiModel,
    ai_tokens_in: aiTokensIn,
    ai_tokens_out: aiTokensOut,
    ai_cost_usd: aiCostUsd,
    ghl_message_id: ghlMessageId,
    metadata
  });
  if (error) console.error('logMessage error:', error.message);
}
