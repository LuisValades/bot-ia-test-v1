import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
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

export async function updateConversation(contactId, patch) {
  const { error } = await supabase
    .from('conversations')
    .update({ ...patch, last_msg_at: new Date().toISOString() })
    .eq('contact_id', contactId);
  if (error) throw error;
}

export async function getRecentMessages(contactId, limit = 10) {
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
