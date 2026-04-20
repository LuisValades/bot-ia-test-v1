/**
 * hydration.js — extrae historial completo de un contacto desde GHL
 * (conversaciones, mensajes, notas, citas) y lo persiste en Supabase
 * para que Alejandra pueda retomar la conversación con contexto completo.
 *
 * Se usa en el flujo de REACTIVACIÓN de leads (lead que ya existía en GHL
 * pero no en Supabase, y queremos que Alejandra no actúe como primera vez).
 */
import { supabase } from './db.js';
import {
  searchContactConversations,
  getConversationMessages,
  getContactNotes,
  getContactAppointments
} from './ghl.js';

const MAX_MESSAGES = parseInt(process.env.HYDRATION_MAX_MESSAGES || '100', 10);
const MAX_NOTES = parseInt(process.env.HYDRATION_MAX_NOTES || '10', 10);

export async function hydrateFromGHL(contactId) {
  console.log(`[hydration] ${contactId}: extrayendo historial de GHL...`);
  const convs = await searchContactConversations(contactId);
  console.log(`[hydration] ${contactId}: ${convs.length} conversación(es) encontradas`);

  const allMessages = [];
  for (const c of convs) {
    const msgs = await getConversationMessages(c.id, MAX_MESSAGES);
    for (const m of msgs) allMessages.push({ ...m, _conversationType: c.type });
  }
  allMessages.sort((a, b) => new Date(a.dateAdded || 0) - new Date(b.dateAdded || 0));
  const cappedMessages = allMessages.slice(-MAX_MESSAGES);

  const [notes, appointments] = await Promise.all([
    getContactNotes(contactId),
    getContactAppointments(contactId)
  ]);

  console.log(`[hydration] ${contactId}: ${cappedMessages.length} msgs / ${notes.length} notas / ${appointments.length} citas`);
  return { messages: cappedMessages, notes, appointments, conversations: convs };
}

export async function persistGHLHistory({ contactId, conversationId, hydration }) {
  const rows = hydration.messages.map(m => {
    const rawDirection = (m.direction || '').toLowerCase();
    const direction = rawDirection === 'inbound' || rawDirection === 'in' ? 'in' : 'out';
    const body = (m.body || m.message || m.text || '(sin texto)').toString().slice(0, 4000);
    return {
      contact_id: contactId,
      conversation_id: conversationId,
      direction,
      body,
      created_at: m.dateAdded || new Date().toISOString(),
      metadata: {
        source: 'ghl_history',
        message_type: m.messageType || m.type,
        channel: m._conversationType,
        ghl_message_id: m.id
      }
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase.from('messages').insert(rows);
    if (error) console.error('[hydration] insert messages err:', error.message);
    else console.log(`[hydration] ${contactId}: ${rows.length} msgs históricos guardados`);
  }

  const notesSummary = hydration.notes.slice(0, MAX_NOTES).map(n => {
    const when = n.createdAt || n.dateAdded || '';
    const text = (n.body || '').toString().slice(0, 500);
    return `• [${when}] ${text}`;
  }).join('\n');

  const apptSummary = hydration.appointments.slice(0, 10).map(a => {
    const when = a.startTime || a.dateAdded || '';
    const status = a.appointmentStatus || a.status || '';
    return `• ${when} (${status}) — ${a.title || 'sin título'}`;
  }).join('\n');

  const { data: conv } = await supabase
    .from('conversations')
    .select('profile')
    .eq('contact_id', contactId)
    .maybeSingle();
  const existingProfile = conv?.profile || {};
  const mergedProfile = {
    ...existingProfile,
    ...(notesSummary ? { ghl_notas_previas: notesSummary } : {}),
    ...(apptSummary ? { ghl_citas_previas: apptSummary } : {})
  };
  if (notesSummary || apptSummary) {
    await supabase.from('conversations')
      .update({ profile: mergedProfile })
      .eq('contact_id', contactId);
  }
}

export function buildReactivationSummary(hydration) {
  const lines = [];
  lines.push(`Historial previo del lead en GHL:`);
  lines.push(`- ${hydration.messages.length} mensajes históricos (SMS/chat)`);
  lines.push(`- ${hydration.notes.length} nota(s) del equipo`);
  lines.push(`- ${hydration.appointments.length} cita(s) previas`);
  if (hydration.notes.length > 0) {
    lines.push('');
    lines.push('Últimas notas relevantes del equipo:');
    for (const n of hydration.notes.slice(0, 3)) {
      lines.push(`→ ${(n.body || '').toString().slice(0, 300)}`);
    }
  }
  return lines.join('\n');
}
