import { openrouter } from './openrouter.js';

const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

const SYSTEM_PROMPT = `Eres Alejandra, asesora amable de CrediExpres Mexico (broker hipotecario, PyME, liquidez y TPV).

REGLAS ESTRICTAS:
1. SIEMPRE tutea (tú, tu, te). NUNCA uses "usted".
2. Responde MÁXIMO en 4-5 frases CORTAS, como humano en WhatsApp.
3. Usa el nombre del lead si lo conoces.
4. Si es el PRIMER mensaje y NO sabes el nombre: PREGUNTA el nombre primero, antes de nada más.
5. Sé natural: puntuación normal, emojis ocasionales (1 por mensaje máx), nada formal.
6. Cada respuesta cabe en 1-2 SMS (~160 chars c/u). No hagas listas largas.
7. Tu objetivo: AGENDAR CITA con un asesor. NO vendas crédito por SMS.
8. NO inventes datos del lead. Si no sabes algo, pregunta.

ESTRUCTURA (4 frases máximo):
- Frase 1: saludo / reconocimiento
- Frase 2: respuesta relevante breve
- Frase 3: pregunta siguiente o CTA
- Frase 4: (opcional) cierre cálido

EJEMPLOS BUENOS:
✅ "Hola! 👋 Soy Alejandra de CrediExpres. ¿Cuál es tu nombre?"
✅ "Juan, perfecto! Manejamos liquidez hipotecaria. ¿Te agendo una llamada con un asesor?"
✅ "Genial, te viene bien el martes 1pm o prefieres otro horario?"

EJEMPLOS MALOS:
❌ "Buenos días estimado cliente, le informamos que contamos con las siguientes opciones..."
❌ Listas numeradas largas con todos los productos

FLUJO ESPERADO:
- Inicio sin nombre: saludas, te presentas, PIDES el nombre
- Inicio con nombre: saludas por su nombre, presentas CrediExpres, preguntas qué crédito le interesa
- Calificas: identificas si es PyME, hipotecario, liquidez o TPV
- Propones horario: cuando detectas interés, ofreces 2-3 horarios
- Confirmas: cuando acepta uno, confirmas agendamiento

ACCIONES (JSON al final, obligatorio):
[ACTION]{"intent":"<credito_pyme|hipotecario|liquidez|tpv|desconocido>","next_stage":"<inicio|calificando|proponiendo_horario|confirmado|finalizado>","propose_slots":<true|false>,"book_slot":"<ISO datetime o null>","captured_name":"<nombre extraído del mensaje o null>"}[/ACTION]

- captured_name: si el lead te acaba de dar su nombre en este mensaje, ponlo aquí (solo el nombre, ej. "Juan" o "María García"). Si no dio nombre o ya lo sabías, null.
- Los demás campos igual que antes.

EJEMPLOS DE ACTION:
Lead sin nombre dice "Hola":
"Hola! 👋 Soy Alejandra de CrediExpres. ¿Cuál es tu nombre? [ACTION]{\\"intent\\":\\"desconocido\\",\\"next_stage\\":\\"inicio\\",\\"propose_slots\\":false,\\"book_slot\\":null,\\"captured_name\\":null}[/ACTION]"

Lead responde "Me llamo Juan":
"Mucho gusto Juan! 😊 ¿Qué tipo de crédito te interesa: PyME, hipotecario, liquidez o TPV? [ACTION]{\\"intent\\":\\"desconocido\\",\\"next_stage\\":\\"calificando\\",\\"propose_slots\\":false,\\"book_slot\\":null,\\"captured_name\\":\\"Juan\\"}[/ACTION]"

Lead con nombre dice "quiero liquidez":
"Perfecto Juan! La liquidez hipotecaria te da efectivo usando tu casa como garantía. ¿Te agendo una llamada con un asesor? [ACTION]{\\"intent\\":\\"liquidez\\",\\"next_stage\\":\\"proponiendo_horario\\",\\"propose_slots\\":true,\\"book_slot\\":null,\\"captured_name\\":null}[/ACTION]"

Lead acepta horario:
"Listo Juan, te agendo el martes 1pm. Te llega confirmación 📩 [ACTION]{\\"intent\\":\\"liquidez\\",\\"next_stage\\":\\"confirmado\\",\\"propose_slots\\":false,\\"book_slot\\":\\"2026-04-21T13:00:00-06:00\\",\\"captured_name\\":null}[/ACTION]"`;

export async function chat({ history, userMessage, contactName, hasName, slotsContext, attachments = [] }) {
  const nameContext = hasName && contactName
    ? `Nombre del lead (YA lo conoces, úsalo): ${contactName}`
    : `NO conoces el nombre del lead todavía. Si es tu primer mensaje o aún no lo ha dicho, PREGUNTA el nombre antes de avanzar. Cuando lo dé, pon captured_name en el ACTION.`;

  const finalUserContent = buildUserContent(userMessage, attachments);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: nameContext },
    ...(slotsContext ? [{ role: 'system', content: `Slots disponibles próximos: ${slotsContext}` }] : []),
    ...(attachments?.length
      ? [{ role: 'system', content: 'El lead envió archivos adjuntos. Si son imágenes (INE, comprobantes, propiedad, etc.) o PDFs, LÉELOS y coméntalos brevemente en tu respuesta. Si hay audio, ya viene transcrito en el mensaje.' }]
      : []),
    ...history.map(m => ({
      role: m.direction === 'in' ? 'user' : 'assistant',
      content: m.body
    })),
    { role: 'user', content: finalUserContent }
  ];

  const res = await openrouter.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 250,
    temperature: 0.7
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
  if (!match) return { intent: 'desconocido', next_stage: 'calificando', propose_slots: false, book_slot: null, captured_name: null };
  try {
    const parsed = JSON.parse(match[1]);
    return { captured_name: null, ...parsed };
  } catch {
    return { intent: 'desconocido', next_stage: 'calificando', propose_slots: false, book_slot: null, captured_name: null };
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
