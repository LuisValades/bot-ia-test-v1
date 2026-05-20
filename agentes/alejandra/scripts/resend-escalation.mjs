#!/usr/bin/env node
/**
 * Re-envía el correo de escalación para un lead específico, usando el código
 * actualizado de notifications.js (resumen corto en lugar del thread completo).
 *
 * Uso: node scripts/resend-escalation.mjs <contact_id>
 *      node scripts/resend-escalation.mjs --search "gilberto"
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const searchIdx = args.indexOf('--search');
const searchTerm = searchIdx >= 0 ? args[searchIdx + 1] : null;
const contactIdArg = !searchTerm ? args[0] : null;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

let lead = null;
if (searchTerm) {
  const { data, error } = await supabase
    .from('leads')
    .select('contact_id, bot_full_name, nombre, telefono, bot_profile, eventos')
    .or(`bot_full_name.ilike.%${searchTerm}%,nombre.ilike.%${searchTerm}%`)
    .limit(5);
  if (error) { console.error('search error:', error); process.exit(1); }
  if (!data || data.length === 0) { console.error(`no leads encontrados para "${searchTerm}"`); process.exit(1); }
  const norm = data.map(d => ({ ...d, full_name: d.bot_full_name || d.nombre, phone: d.telefono }));
  console.log('matches:', norm.map(d => ({ id: d.contact_id, name: d.full_name, phone: d.phone })));
  lead = norm[0];
} else if (contactIdArg) {
  const { data, error } = await supabase
    .from('leads')
    .select('contact_id, bot_full_name, nombre, telefono, bot_profile, eventos')
    .eq('contact_id', contactIdArg)
    .single();
  if (error) { console.error('lookup error:', error); process.exit(1); }
  lead = { ...data, full_name: data.bot_full_name || data.nombre, phone: data.telefono };
} else {
  console.error('uso: resend-escalation.mjs <contact_id> | --search <término>');
  process.exit(1);
}

console.log(`\n→ usando lead: ${lead.full_name} (${lead.contact_id})\n`);

// Llama directo a sendEscalationEmail (NO importes index.js, levanta el server)
const { sendEscalationEmail } = await import('../src/notifications.js');

const advisor = {
  name: 'Efraín',
  email: 'efrain@crediexpres.com',
  id: process.env.LUIS_ADVISOR_ID || null
};

// Reconstruye history desde eventos[] usando los campos reales (cuerpo, direccion)
// y filtrando solo SMS/EMAIL (igual que getRecentMessages).
const history = (lead.eventos || [])
  .filter(e => e.tipo === 'SMS' || e.tipo === 'EMAIL')
  .map(e => ({
    direction: e.direccion === 'in' ? 'in' : 'out',
    body: e.cuerpo || '',
    created_at: e.fecha
  }))
  .filter(m => m.body)
  .slice(-30);

console.log(`history reconstruido: ${history.length} mensajes`);

const lastInbound = history.filter(m => m.direction === 'in').slice(-1)[0];
const triggering = lastInbound?.body || '(sin último mensaje)';

const result = await sendEscalationEmail({
  advisor,
  leadName: lead.full_name,
  contactId: lead.contact_id,
  phone: lead.phone,
  profile: lead.bot_profile || {},
  reason: 'profile-complete',
  callbackWindow: lead.bot_profile?.callback_window || 'HOY',
  tone: 'interesado',
  history,
  triggeringMessage: triggering
});

console.log('\nresultado:', result);
process.exit(result.sent ? 0 : 1);
