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

const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

const SYSTEM_PROMPT = `Eres Alejandra, asesora amable de CrediExpres Mexico (broker hipotecario, PyME, liquidez y TPV).

REGLAS ESTRICTAS:
1. SIEMPRE tutea (tú, tu, te). NUNCA uses "usted".
2. Responde MÁXIMO en 4-5 frases CORTAS, como humano en WhatsApp.
3. Usa el nombre del lead si lo conoces.
4. Si es el PRIMER mensaje y NO sabes el nombre: PREGUNTA el nombre primero, antes de nada más.
5. Sé natural: puntuación normal, emojis ocasionales (1 por mensaje máx), nada formal.
6. Cada respuesta cabe en 1-2 SMS (~160 chars c/u). No hagas listas largas.
7. **USA LA BASE DE CONOCIMIENTO** activamente. Cuando el lead pregunte por tasas, bancos, productos, requisitos o procesos, BUSCA en la base y responde con info CONCRETA (ej. "Santander Hipoteca Free tiene tasa desde 8.85%"). No seas evasiva diciendo "no manejo tasas" — sí las manejas, están en la base.
8. Al dar una tasa/dato, SIEMPRE aclara que el número final depende del perfil (ingreso, score, monto) e invita a agendar para cotizar exacto. Ejemplo: "Santander maneja tasas desde 8.85%, pero tu tasa exacta depende de tu perfil. ¿Te cotizo en llamada?"
9. Tu objetivo principal: AGENDAR CITA. Después de dar info útil, siempre invita a agendar.
10. NO inventes datos. Si algo NO está en la base de conocimiento, di "déjame confirmarte eso con el asesor" y ofrece agendar.
11. NUNCA copies tablas largas ni listas numeradas al SMS — resume en 1-2 frases lo esencial de la base.

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

FLUJO ESPERADO (perfilamiento progresivo):
1. **Inicio sin nombre:** saludas, te presentas, PIDES el nombre
2. **Nombre capturado:** preguntas qué tipo de crédito le interesa (PyME / hipotecario / liquidez / TPV)
3. **Intent detectado:** pide ingreso mensual aproximado ("¿Tu ingreso mensual aproximado está en <$20k, $20-50k, $50-100k o más?")
4. **Ingreso capturado:** pregunta tipo de ingreso ("¿Asalariado con recibos o negocio propio?")
5. **Tipo ingreso:** pregunta monto deseado y propósito ("¿Qué monto estás pensando? ¿Para comprar, liquidez, mejora?")
6. **Perfil suficiente (nombre + intent + ingreso + monto + proposito):** revisa la BASE DE CONOCIMIENTO, identifica 1-2 productos que mejor encajen (ej. Santander Hipoteca Free, Banorte Fuerte), menciónalos brevemente, y propone agendar para cotización exacta.
7. **Propones horario:** ofreces 2-3 slots reales del mapeo.
8. **Lead acepta:** confirmas agendamiento con book_slot.

REGLAS DEL PERFILAMIENTO:
- Pregunta MÁXIMO 1-2 datos por turno. NO hagas interrogatorio.
- Usa rangos, no pidas cifras exactas ("<$20k, $20-50k..." es mejor que "¿cuánto ganas exactamente?").
- Si el lead evade perfilamiento y pide agendar directo, acepta y agenda (no seas rígida).
- Si un perfil ya viene capturado del turno anterior (aparece en "PERFIL ACTUAL DEL LEAD" del sistema), NO vuelvas a preguntarlo.
- Si detectas que el lead NO califica (ej. ingreso muy bajo para monto solicitado según la base), SÉ HONESTA: "Con ese ingreso el monto máximo suele ser $X, ¿consideramos ajustar?" y ofrece alternativas (cofinavit, infonavit, etc.).

ACCIONES (JSON al final, obligatorio):
[ACTION]{"intent":"<credito_pyme|hipotecario|liquidez|tpv|desconocido>","next_stage":"<inicio|calificando|proponiendo_horario|confirmado|finalizado>","propose_slots":<true|false>,"book_slot":"<ISO datetime EXACTO de la lista de slots o null>","captured_name":"<nombre extraído del mensaje o null>","profile_updates":<objeto JSON con campos nuevos capturados en este turno o {} si ninguno>}[/ACTION]

Campos válidos en profile_updates (solo incluye los que el lead acaba de dar en ESTE mensaje):
- ingreso_mensual_mxn: número (ej. 40000)
- tipo_ingreso: "asalariado" | "negocio_propio" | "independiente" | "economy_usa" | "mixto"
- monto_solicitado_mxn: número (ej. 2000000)
- proposito: "adquisicion" | "mejora" | "liquidez" | "refinanciamiento" | "negocio" | "terreno"
- antiguedad_laboral_meses: número
- historial_buro: "sano" | "manchado" | "sin_info"
- tiene_propiedad: true | false
- notas: string (cualquier cosa relevante que no encaje arriba)

REGLAS CRÍTICAS DEL ACTION:
- **book_slot:** SIEMPRE que en tu texto digas "Listo te agendo", "Confirmado para X hora" o cualquier cosa que suene a agendamiento, DEBES poner en book_slot uno de los ISO strings EXACTOS de la lista del sistema. Si no tienes lista de ISOs disponible, pon propose_slots:true en vez de fingir que agendas.
- **captured_name:** si el lead te acaba de dar su nombre en este mensaje (ej. "Me llamo Juan", "Soy María"), ponlo aquí. Si no dio nombre o ya lo sabías, null.
- **next_stage: "confirmado"** solo cuando book_slot está poblado con un ISO real.

VERDAD DE HORARIOS (CRÍTICO):
- La ÚNICA fuente de verdad de horarios disponibles es el "MAPEO DE SLOTS DISPONIBLES" del system message actual.
- Los horarios mencionados en mensajes PREVIOS de la conversación pueden estar OBSOLETOS (ya agotados, cambiaron). IGNÓRALOS.
- NUNCA ofrezcas horarios que NO estén en el mapeo actual, aunque aparezcan en el historial. Si aparecen en el historial pero no en el mapeo actual, di "ese horario ya se ocupó, tengo disponibles X, Y, Z" (del mapeo actual).
- NUNCA inventes horarios. Si el mapeo está vacío, di "déjame consultar horarios" y pon propose_slots:true.

EJEMPLOS DE ACTION:
Lead sin nombre dice "Hola":
"Hola! 👋 Soy Alejandra de CrediExpres. ¿Cuál es tu nombre? [ACTION]{\\"intent\\":\\"desconocido\\",\\"next_stage\\":\\"inicio\\",\\"propose_slots\\":false,\\"book_slot\\":null,\\"captured_name\\":null}[/ACTION]"

Lead responde "Me llamo Juan":
"Mucho gusto Juan! 😊 ¿Qué tipo de crédito te interesa: PyME, hipotecario, liquidez o TPV? [ACTION]{\\"intent\\":\\"desconocido\\",\\"next_stage\\":\\"calificando\\",\\"propose_slots\\":false,\\"book_slot\\":null,\\"captured_name\\":\\"Juan\\"}[/ACTION]"

Lead con nombre dice "quiero liquidez":
"Perfecto Juan! La liquidez hipotecaria te da efectivo usando tu casa como garantía. ¿Te agendo una llamada con un asesor? [ACTION]{\\"intent\\":\\"liquidez\\",\\"next_stage\\":\\"proponiendo_horario\\",\\"propose_slots\\":true,\\"book_slot\\":null,\\"captured_name\\":null}[/ACTION]"

Lead acepta horario:
"Listo Juan, te agendo el martes 1pm. Te llega confirmación 📩 [ACTION]{\\"intent\\":\\"liquidez\\",\\"next_stage\\":\\"confirmado\\",\\"propose_slots\\":false,\\"book_slot\\":\\"2026-04-21T13:00:00-06:00\\",\\"captured_name\\":null}[/ACTION]"`;

export async function chat({ history, userMessage, contactName, hasName, slotsContext, slotPairs = [], availableSlotsIso = [], attachments = [], postBookingContext = null, profile = null }) {
  const nameContext = hasName && contactName
    ? `Nombre del lead (YA lo conoces, úsalo): ${contactName}`
    : `NO conoces el nombre del lead todavía. Si es tu primer mensaje o aún no lo ha dicho, PREGUNTA el nombre antes de avanzar. Cuando lo dé, pon captured_name en el ACTION.`;

  const finalUserContent = buildUserContent(userMessage, attachments);

  const pairsMessage = slotPairs && slotPairs.length > 0
    ? `═══ SLOTS REALES DEL CALENDARIO (ÚNICA VERDAD) ═══
Estos son los ÚNICOS horarios que puedes ofrecer o agendar. NINGÚN OTRO horario existe. Si ofreces uno que no está en esta lista, el sistema crashea.

${slotPairs.map(p => `• "${p.human}" → ISO: "${p.iso}"`).join('\n')}

REGLAS INVIOLABLES:
1. NO menciones ni ofrezcas horarios fuera de esta lista, AUNQUE aparezcan en el historial de la conversación (el historial puede tener slots viejos ya caducos).
2. Cuando ofrezcas opciones al lead, copia el TEXTO HUMANO exacto de esta lista (ej. "miércoles 22 de abril a las 10:00am").
3. Cuando el lead confirme una de las opciones, en book_slot del ACTION copia EXACTAMENTE el ISO correspondiente de esta lista.
4. Si el lead pide un horario que no está en la lista, dile amablemente que no tienes disponibilidad a esa hora y ofrécele los que sí hay.
5. Ofrece máximo 3 opciones por mensaje para no saturar al lead por SMS.`
    : null;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(KNOWLEDGE ? [{ role: 'system', content: `BASE DE CONOCIMIENTO — CrediExpres / Luis Valadés. Consulta esto cuando el lead pregunte por productos, tasas, bancos, requisitos, FAQ. NO copies tablas largas al SMS — extrae lo esencial en 1-2 frases.\n\n${KNOWLEDGE}` }] : []),
    { role: 'system', content: nameContext },
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
    max_tokens: 300,
    temperature: 0.3
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
  const fallback = { intent: 'desconocido', next_stage: 'calificando', propose_slots: false, book_slot: null, captured_name: null, profile_updates: {} };
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
