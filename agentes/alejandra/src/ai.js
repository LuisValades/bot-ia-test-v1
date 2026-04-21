import { openrouter } from './openrouter.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_PATH = join(__dirname, '..', 'knowledge.md');
const KNOWLEDGE = existsSync(KNOWLEDGE_PATH) ? readFileSync(KNOWLEDGE_PATH, 'utf-8') : '';
if (KNOWLEDGE) {
  console.log(`[ai] knowledge.md cargado: ${KNOWLEDGE.length} chars (~${Math.round(KNOWLEDGE.length / 4)} tokens)`);
} else {
  console.warn('[ai] knowledge.md NO encontrado, Alejandra responderá sin base de conocimiento');
}

const SYSTEM_PROMPT_PATH = join(__dirname, '..', 'system-prompt.md');
const SYSTEM_PROMPT = existsSync(SYSTEM_PROMPT_PATH)
  ? readFileSync(SYSTEM_PROMPT_PATH, 'utf-8')
  : '';
if (SYSTEM_PROMPT) {
  console.log(`[ai] system-prompt.md cargado: ${SYSTEM_PROMPT.length} chars`);
} else {
  console.warn('[ai] system-prompt.md NO encontrado — Alejandra no tiene instrucciones');
}

const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';


export async function chat({ history, userMessage, contactName, hasName, slotsContext, slotsMenu = '', slotPairs = [], availableSlotsIso = [], attachments = [], postBookingContext = null, profile = null, advisor = null, tags = [], isReactivation = false }) {
  const nameContext = hasName && contactName
    ? `Nombre del lead (YA lo conoces, úsalo): ${contactName}`
    : `NO conoces el nombre del lead todavía. Si es tu primer mensaje o aún no lo ha dicho, PREGUNTA el nombre antes de avanzar. Cuando lo dé, pon captured_name en el ACTION.`;

  const finalUserContent = buildUserContent(userMessage, attachments);

  const pairsMessage = slotPairs && slotPairs.length > 0
    ? `═══ SLOTS REALES DEL CALENDARIO (ÚNICA VERDAD) ═══
Estos son los ÚNICOS horarios disponibles. Si ofreces uno que no está aquí, el sistema falla.

FORMATO DE MENÚ PARA MOSTRAR AL LEAD (cópialo tal cual, es el formato obligatorio):

${slotsMenu}

Mapeo número → ISO (NO MUESTRES ESTO AL LEAD, es solo para ti):
${slotPairs.map(p => `${p.number} → ${p.human} → "${p.iso}"`).join('\n')}

REGLAS INVIOLABLES:
1. Cuando ofrezcas horarios al lead, reproduce EXACTO el formato de menú numerado de arriba. NO inventes horarios ni días.
2. Ofrece máximo 3 opciones por mensaje (números 1, 2, 3). Si hay más, di "tengo más disponibilidad si ninguno te queda".
3. Cuando el lead confirme, puede decir un número ("la 2", "el 3", "dame la 1") o una hora ("11am"). Identifica cuál slot eligió y pon en book_slot el ISO EXACTO.
4. Si el lead pide un horario que no está en la lista, dile que no tienes a esa hora y re-ofrece los que sí.
5. Mantén los horarios DEL MENÚ actual, ignora horarios de mensajes previos del historial (pueden estar caducos).`
    : null;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(KNOWLEDGE ? [{ role: 'system', content: `BASE DE CONOCIMIENTO — Crediexpres / Luis Valades. Consulta esto cuando el lead pregunte por productos, tasas, bancos, requisitos, FAQ. NO copies tablas largas al SMS — extrae lo esencial en 1-2 frases.\n\n${KNOWLEDGE}` }] : []),
    { role: 'system', content: nameContext },
    ...(advisor?.name
      ? [{ role: 'system', content: `ASESOR ASIGNADO a este lead: ${advisor.name}. Cuando propongas la llamada de 10 min, MENCIÓNALO POR NOMBRE (ej. "podemos agendar una llamada con ${advisor.name}, es parte de nuestro equipo"). La cita quedará asignada automáticamente a ${advisor.name}.` }]
      : []),
    ...(isReactivation
      ? [{ role: 'system', content: '⚡ LEAD EN REACTIVACIÓN: este contacto había sido abordado antes pero la conversación no avanzó. Saluda con tono cercano reconociendo que hace tiempo no hablaban, SIN fingir memoria personal. Enfoca en re-capturar interés y luego perfilar (buró / ingresos / necesidad). No lo trates como un desconocido total — ya conoce la marca Crediexpres.' }]
      : []),
    ...(tags && tags.length > 0
      ? [{ role: 'system', content: `Tags del contacto en GHL (contexto útil, pueden indicar intereses previos o fuente del lead): ${tags.join(', ')}` }]
      : []),
    ...(profile && Object.keys(profile).length > 0
      ? [{ role: 'system', content: `PERFIL ACTUAL DEL LEAD (ya lo capturaste antes, NO vuelvas a preguntarlo): ${JSON.stringify(profile)}` }]
      : []),
    ...(postBookingContext ? [{ role: 'system', content: postBookingContext }] : []),
    ...(attachments?.length
      ? [{ role: 'system', content: 'El lead envió archivos adjuntos. Si son imágenes (INE, comprobantes, propiedad, etc.) o PDFs, LÉELOS y coméntalos brevemente en tu respuesta. Si hay audio, ya viene transcrito en el mensaje.' }]
      : []),
    ...history.map(m => ({
      role: m.direction === 'in' ? 'user' : 'assistant',
      content: m.body
    })),
    ...(pairsMessage
      ? [{ role: 'system', content: pairsMessage }]
      : (slotsContext ? [{ role: 'system', content: `Slots disponibles próximos: ${slotsContext}` }] : [])),
    { role: 'user', content: finalUserContent }
  ];

  const res = await openrouter.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 380,
    temperature: 0.5
  });

  const raw = res.choices[0].message.content || '';
  return {
    raw,
    text: extractText(raw),
    action: extractAction(raw),
    usage: res.usage,
    model: res.model
  };
}

function extractAction(raw) {
  const match = raw.match(/\[ACTION\](.*?)\[\/ACTION\]/s);
  const fallback = { intent: 'desconocido', next_stage: 'calificando', propose_slots: false, book_slot: null, captured_name: null, profile_updates: {}, needs_escalation: false };
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[1]);
    return { ...fallback, ...parsed, profile_updates: parsed.profile_updates || {} };
  } catch {
    return fallback;
  }
}

function extractText(raw) {
  return raw.replace(/\[ACTION\].*?\[\/ACTION\]/s, '').trim();
}

function buildUserContent(text, attachments) {
  if (!attachments || attachments.length === 0) return text;

  const audios = attachments.filter(a => a.kind === 'audio');
  const images = attachments.filter(a => a.kind === 'image' && a.base64);
  const pdfs = attachments.filter(a => a.kind === 'pdf' && a.base64);
  const others = attachments.filter(a => a.kind === 'other' || a.kind === 'error');

  const textParts = [];
  if (text && text.length > 0) textParts.push(text);
  for (let i = 0; i < audios.length; i++) {
    textParts.push(`[Audio ${i + 1} transcrito]: ${audios[i].transcript}`);
  }
  for (const o of others) {
    textParts.push(`[Archivo adjunto no soportado tipo ${o.mime || 'desconocido'}]`);
  }
  if (textParts.length === 0 && (images.length > 0 || pdfs.length > 0)) {
    textParts.push('(El lead envió archivos sin texto)');
  }

  const content = [{ type: 'text', text: textParts.join('\n\n') }];
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mime};base64,${img.base64}` }
    });
  }
  for (let i = 0; i < pdfs.length; i++) {
    content.push({
      type: 'file',
      file: {
        filename: `adjunto-${i + 1}.pdf`,
        file_data: `data:${pdfs[i].mime};base64,${pdfs[i].base64}`
      }
    });
  }
  return content;
}
