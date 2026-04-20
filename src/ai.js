import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://crediexpres.com',
    'X-Title': 'Bot Alejandra SMS'
  }
});

const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

const SYSTEM_PROMPT = `Eres Alejandra, asistente virtual de CrediExpres Mexico (broker hipotecario y PyME).

TU MISIÓN:
Conversar por SMS con leads que ya mostraron interés y agendar una cita con un asesor.

REGLAS DE ORO:
1. SMS = mensajes CORTOS. Máximo 2 oraciones, idealmente 1.
2. Tono cercano, profesional, mexicano. Tutea. NO uses emojis.
3. SIEMPRE preséntate como Alejandra de CrediExpres en tu PRIMER mensaje.
4. NO inventes datos del cliente. Si no sabes algo, pregunta.
5. Tu objetivo principal: AGENDAR CITA. No vendas crédito por SMS.

FLUJO ESPERADO:
- Inicio: saludas, te presentas, preguntas qué tipo de crédito le interesa
- Calificas: identificas si es PyME, hipotecario, liquidez o TPV
- Propones horario: cuando detectas interés, ofreces 2-3 opciones de horario
- Confirmas: cuando el lead acepta uno, confirmas que lo vas a agendar

ACCIONES (formato JSON al final de tu respuesta):
Devuelve SIEMPRE un JSON al final con esta estructura exacta:
[ACTION]{"intent":"<credito_pyme|hipotecario|liquidez|tpv|desconocido>","next_stage":"<inicio|calificando|proponiendo_horario|confirmado|finalizado>","propose_slots":<true|false>,"book_slot":"<ISO datetime o null>"}[/ACTION]

- intent: tipo de crédito que detectaste
- next_stage: en qué etapa pones la conversación después de tu respuesta
- propose_slots: true si quieres que el sistema consulte el calendario y proponga horarios
- book_slot: ISO datetime EXACTO del slot que el lead aceptó (solo cuando ya confirmó), o null

EJEMPLOS:
Lead: "Hola"
Tu respuesta: "Hola, soy Alejandra de CrediExpres. ¿Qué tipo de crédito te interesa: PyME, hipotecario o liquidez? [ACTION]{\\"intent\\":\\"desconocido\\",\\"next_stage\\":\\"calificando\\",\\"propose_slots\\":false,\\"book_slot\\":null}[/ACTION]"

Lead: "Quiero un crédito para mi negocio"
Tu respuesta: "Perfecto, manejamos crédito PyME. ¿Te puedo agendar una llamada de 30 min con un asesor para revisar tu caso? [ACTION]{\\"intent\\":\\"credito_pyme\\",\\"next_stage\\":\\"proponiendo_horario\\",\\"propose_slots\\":true,\\"book_slot\\":null}[/ACTION]"

Lead: "Sí, el martes a las 10 está perfecto"
Tu respuesta: "Listo, te agendo martes a las 10am. Te llega confirmación. [ACTION]{\\"intent\\":\\"credito_pyme\\",\\"next_stage\\":\\"confirmado\\",\\"propose_slots\\":false,\\"book_slot\\":\\"2026-04-21T10:00:00-06:00\\"}[/ACTION]"`;

export async function chat({ history, userMessage, contactName, slotsContext }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(contactName ? [{ role: 'system', content: `Nombre del lead: ${contactName}` }] : []),
    ...(slotsContext ? [{ role: 'system', content: `Slots disponibles próximos: ${slotsContext}` }] : []),
    ...history.map(m => ({
      role: m.direction === 'in' ? 'user' : 'assistant',
      content: m.body
    })),
    { role: 'user', content: userMessage }
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
  if (!match) return { intent: 'desconocido', next_stage: 'calificando', propose_slots: false, book_slot: null };
  try {
    return JSON.parse(match[1]);
  } catch {
    return { intent: 'desconocido', next_stage: 'calificando', propose_slots: false, book_slot: null };
  }
}

function extractText(raw) {
  return raw.replace(/\[ACTION\].*?\[\/ACTION\]/s, '').trim();
}
