/**
 * notifications.js — envío de correos al asesor + Luis cuando se escala un lead.
 *
 * Usa Gmail SMTP con OAuth2 (refresh token). Si faltan credenciales hace log y
 * no rompe. El destinatario siempre incluye el asesor asignado (si tiene email)
 * y luis@crediexpres.com.
 */
import nodemailer from 'nodemailer';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GMAIL_USER = process.env.GMAIL_USER;
const EMAIL_FROM = process.env.NOTIFICATION_FROM || (GMAIL_USER ? `Alejandra <${GMAIL_USER}>` : null);
const LUIS_EMAIL = process.env.LUIS_EMAIL || 'luis@crediexpres.com';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const emailEnabled = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN && GMAIL_USER);

let transporter = null;
if (emailEnabled) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GMAIL_USER,
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      refreshToken: GOOGLE_REFRESH_TOKEN
    }
  });
  console.log(`[notifications] Gmail OAuth2 habilitado (${GMAIL_USER})`);
} else {
  console.warn('[notifications] Gmail no configurado — no se mandan correos. Faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN o GMAIL_USER.');
}

export function isEmailEnabled() {
  return emailEnabled;
}

function contactUrl(contactId) {
  if (!GHL_LOCATION_ID || !contactId) return null;
  return `https://app.gohighlevel.com/v2/location/${GHL_LOCATION_ID}/contacts/detail/${contactId}`;
}

function formatThread(history = [], limit = 10) {
  const last = history.slice(-limit);
  return last
    .map(m => {
      const who = m.direction === 'in' ? 'Lead' : 'Alejandra';
      const body = (m.body || '').replace(/\s+/g, ' ').trim();
      return `${who}: ${body}`;
    })
    .join('\n');
}

/**
 * Envía correo de escalación al asesor + a Luis.
 *
 * @param {object} params
 * @param {object} params.advisor - { name, email, id }
 * @param {string} params.leadName
 * @param {string} params.contactId - id de GHL
 * @param {string} params.phone
 * @param {object} params.profile - datos capturados { intent, producto, ruta, monto, buro, ingresos, ... }
 * @param {string} params.reason - motivo escalación
 * @param {string} params.callbackWindow - ej. "en 2 horas", "mañana 10am"
 * @param {string} params.tone - ej. "interesado", "frío", "molesto"
 * @param {Array}  params.history - mensajes [{ direction, body, createdAt }]
 * @param {string} params.triggeringMessage - último mensaje del lead
 * @returns {Promise<{sent: boolean, id?: string, error?: string, to?: string[]}>}
 */
export async function sendEscalationEmail({
  advisor,
  leadName,
  contactId,
  phone,
  profile = {},
  reason,
  callbackWindow,
  tone,
  history = [],
  triggeringMessage
}) {
  if (!emailEnabled) {
    return { sent: false, error: 'Gmail OAuth2 no configurado' };
  }

  const to = [];
  if (advisor?.email) to.push(advisor.email);
  if (LUIS_EMAIL && !to.includes(LUIS_EMAIL)) to.push(LUIS_EMAIL);
  if (to.length === 0) {
    return { sent: false, error: 'sin destinatarios (ni advisor.email ni LUIS_EMAIL)' };
  }

  const displayName = leadName || '(sin nombre)';
  const advisorName = advisor?.name || '(sin asesor asignado)';
  const reasonLabel =
    reason === 'lead-requested'
      ? 'Lead pidió hablar con humano'
      : reason === 'profile-complete'
        ? 'Perfil completo — lead listo para llamada'
        : reason === 'appointment-booked'
          ? 'Cita agendada'
          : reason || 'Escalación automática';

  const url = contactUrl(contactId);
  const threadText = formatThread(history, 10);

  const subject = `[Alejandra] ${displayName} → ${advisorName} · ${reasonLabel}`;

  const profileRows = Object.entries(profile || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 10px 4px 0;color:#6b7280;font-weight:500;">${escapeHtml(k)}</td><td style="padding:4px 0;color:#111827;">${escapeHtml(String(v))}</td></tr>`
    )
    .join('');

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#111827;">
  <div style="border-left:4px solid #6366f1;padding-left:14px;margin-bottom:20px;">
    <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Escalación Alejandra</div>
    <h2 style="margin:6px 0 2px 0;font-size:20px;">${escapeHtml(displayName)}</h2>
    <div style="color:#6b7280;font-size:13px;">${escapeHtml(phone || '')}${phone && advisorName ? ' · ' : ''}asesor asignado: <strong>${escapeHtml(advisorName)}</strong></div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:13px;">
    <tr><td style="padding:4px 10px 4px 0;color:#6b7280;font-weight:500;width:140px;">Motivo</td><td style="padding:4px 0;">${escapeHtml(reasonLabel)}</td></tr>
    ${callbackWindow ? `<tr><td style="padding:4px 10px 4px 0;color:#6b7280;font-weight:500;">Ventana callback</td><td style="padding:4px 0;"><strong>${escapeHtml(callbackWindow)}</strong></td></tr>` : ''}
    ${tone ? `<tr><td style="padding:4px 10px 4px 0;color:#6b7280;font-weight:500;">Tono detectado</td><td style="padding:4px 0;">${escapeHtml(tone)}</td></tr>` : ''}
    ${profileRows}
  </table>

  ${triggeringMessage ? `<div style="background:#fef3c7;padding:12px 14px;border-radius:6px;margin-bottom:16px;font-size:13px;"><strong style="color:#92400e;">Último mensaje del lead:</strong><br/>${escapeHtml(triggeringMessage)}</div>` : ''}

  ${
    threadText
      ? `<div style="margin-bottom:18px;">
          <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Últimos mensajes</div>
          <pre style="background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:6px;font-size:12.5px;font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap;margin:0;color:#374151;">${escapeHtml(threadText)}</pre>
        </div>`
      : ''
  }

  ${url ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">Abrir en GHL →</a>` : ''}

  <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;">
    Alejandra dejó de responder a este lead. Toma tú la conversación.
  </div>
</div>`;

  const text = [
    `Escalación Alejandra — ${displayName}`,
    `Teléfono: ${phone || 'n/d'}`,
    `Asesor: ${advisorName}`,
    `Motivo: ${reasonLabel}`,
    callbackWindow ? `Ventana callback: ${callbackWindow}` : null,
    tone ? `Tono: ${tone}` : null,
    '',
    'Perfil capturado:',
    ...Object.entries(profile || {})
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `  ${k}: ${v}`),
    '',
    triggeringMessage ? `Último mensaje: "${triggeringMessage}"` : null,
    '',
    threadText ? 'Últimos mensajes:' : null,
    threadText || null,
    '',
    url ? `Abrir en GHL: ${url}` : null
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: to.join(', '),
      subject,
      html,
      text
    });
    return { sent: true, id: info.messageId, to };
  } catch (err) {
    console.error('[notifications] Gmail send falló:', err.message);
    return { sent: false, error: err.message };
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
