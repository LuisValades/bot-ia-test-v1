import { openrouter } from './openrouter.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { searchKB, formatChunksAsContext, isRagEnabled } from './rag.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT_PATH = join(__dirname, '..', 'system-prompt.md');
const SYSTEM_PROMPT = existsSync(SYSTEM_PROMPT_PATH)
  ? readFileSync(SYSTEM_PROMPT_PATH, 'utf-8')
  : '';
if (SYSTEM_PROMPT) {
  console.log(`[ai] system-prompt.md cargado: ${SYSTEM_PROMPT.length} chars`);
} else {
  console.warn('[ai] system-prompt.md NO encontrado — Alejandra no tiene instrucciones');
}

if (isRagEnabled()) {
  console.log('[ai] RAG habilitado — Pinecone como base de conocimiento');
} else {
  console.warn('[ai] RAG deshabilitado — Alejandra responderá solo con system prompt');
}

const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const RAG_TOP_K = parseInt(process.env.RAG_TOP_K || '5', 10);
const RAG_MIN_QUERY_LEN = 3;

async function retrieveKnowledge(userMessage, attachments) {
  if (!isRagEnabled()) return '';
  const parts = [];
  if (userMessage && userMessage.trim().length >= RAG_MIN_QUERY_LEN) {
    parts.push(userMessage.trim());
  }
  const audios = (attachments || []).filter(a => a.kind === 'audio' && a.transcript);
  for (const a of audios) parts.push(a.transcript);
  const query = parts.join(' ').slice(0, 1500).trim();
  if (query.length < RAG_MIN_QUERY_LEN) return '';
  try {
    const chunks = await searchKB(query, RAG_TOP_K);
    if (!chunks || chunks.length === 0) return '';
    const formatted = formatChunksAsContext(chunks);
    return `${formatted}

INSTRUCCIÓN: Usa estos chunks solo como referencia para responder con precisión. NO copies texto literal al SMS (salvo frases canónicas marcadas explícitamente en el playbook). Extrae lo esencial y respétalo con las reglas de tono del system prompt (3-5 frases, tuteo, 1 emoji máx, cero listas).`;
  } catch (err) {
    console.warn('[ai] searchKB falló:', err.message);
    return '';
  }
}


export async function chat({ history, userMessage, contactName, hasName, slotsContext, slotsMenu = '', slotPairs = [], availableSlotsIso = [], attachments = [], postBookingContext = null, profile = null, advisor = null, tags = [], isReactivation = false }) {
  const nameContext = hasName && contactName
    ? `Nombre del lead (YA lo conoces, úsalo): ${contactName}`
    : `NO conoces el nombre del lead todavía. Si es tu primer mensaje o aún no lo ha dicho, PREGUNTA el nombre antes de avanzar. Cuando lo dé, pon captured_name en el ACTION.`;

  const finalUserContent = buildUserContent(userMessage, attachments);

  const pairsMessage = slotPairs && slotPairs.length > 0
    ? `═══ MAPEO INTERNO DE CALLBACK (PRIVADO — NUNCA LO MUESTRES AL LEAD) ═══
Estos horarios son referencia interna para que luego tú puedas poner el ISO correcto en book_slot.

Mapeo interno (NO mostrar al lead, solo para book_slot):
${slotPairs.map(p => `${p.human} → "${p.iso}"`).join('\n')}

REGLAS DE CIERRE DE CITA — CALLBACK FLEXIBLE:
0. Si el lead apenas saludó, dijo "info", "hola", no ha dado nombre o intent → IGNORA este bloque.
1. Cuando llegues al cierre (paso 7/8, perfil completo), NUNCA ESCRIBAS:
   - "Aquí están los horarios disponibles"
   - Listas numeradas de horarios: "1 - 10am", "2 - 11am", "3 - 12pm"
   - Fechas con día de la semana: "Jueves 23 de abril 10am"
2. EL CIERRE CORRECTO es callback flexible:
   "Le paso los comentarios a [Asesor]. ¿Te puede llamar en 2 horas? Si prefieres otra hora, dime a qué hora puedes."
3. Horario laboral asesor: **11 AM - 7 PM (L-V)**. Si el lead propone fuera → "Efraín atiende de 11 AM a 7 PM, ¿entre ese rango qué hora te queda?".
4. Cuando el lead confirme una hora ("sale, en 2 horas" / "11am me queda" / "mañana 3pm"), buscas en el mapeo interno el ISO más cercano y lo pones en book_slot. Si no hay ningún slot cercano, agendas el más próximo disponible.
5. Si el lead dice "mañana" sin hora → "¿Entre 11am y 7pm qué hora te queda bien?". Nunca listes opciones numeradas.`
    : null;

  const ragContext = await retrieveKnowledge(userMessage, attachments);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(ragContext ? [{ role: 'system', content: ragContext }] : []),
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
    ...(pairsMessage ? [{ role: 'system', content: pairsMessage }] : []),
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
