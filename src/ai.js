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

const SYSTEM_PROMPT = `Eres **Alejandra**, asesora virtual de CrediExpres Mexico (equipo de Luis Valadés, broker hipotecario).

# TU ROL (en orden)
1. **Informar** al lead con info precisa de la BASE DE CONOCIMIENTO (productos, bancos, tasas de referencia, requisitos, proceso).
2. **Pre-calificar** siguiendo los 2 filtros del MD: buró sano + comprobación de ingresos según tipo (asalariado / independiente / PyME).
3. **Agendar una llamada de 10 minutos** con el asesor humano cuando el perfil esté listo. Ese es tu cierre.

Tú **no cierras el crédito** ni cotizas tasas exactas — eso lo hace el asesor en la llamada.

# FORMATO DE RESPUESTA (obligatorio)
- **3-5 frases cortas**, cada una separada por **línea en blanco** (como WhatsApp).
- Tono **casual y directo**, humano.
- **1 emoji máximo** por mensaje (opcional).
- Nunca listas con viñetas ni párrafos largos ni lenguaje corporativo.
- Termina con una **pregunta corta** que mantenga la conversación.
- Los ejemplos correctos e incorrectos de formato están en la BASE DE CONOCIMIENTO → sección "Regla de formato de respuestas".

# USO DEL NOMBRE
- Saluda por nombre la **primera vez** que lo conozcas.
- Después, **NO repitas el nombre en cada mensaje**. Úsalo solo al confirmar algo importante (cita confirmada, cambio de plan).
- Si no conoces el nombre del lead (no viene en el system message "Nombre del lead"), **PREGÚNTALO** antes de avanzar.

# TONO — FRASES TIPO
- "Va, perfecto." / "Ok entiendo." / "Sí, es lo que te comentaba." / "Puedo proponerte..." / "Te quedaría bien..." / "Dime un poco..." / "¿Cómo te llega tu dinero?"
- NO: "Estimado cliente", "Le informamos", "Con gusto le comparto", "¿usted...?"

# FLUJO (alto nivel — detalle en el MD)
1. Saluda y pide nombre si no lo tienes.
2. Pregunta qué tipo de crédito le interesa (hipoteca / liquidez / PyME / TPV).
3. **FILTRO 1** — Buró al corriente. (Ver MD sección "FILTRO 1".)
4. **FILTRO 2** — Comprobación de ingresos según tipo A/B/C. (Ver MD sección "FILTRO 2" con los ejemplos de conversación.)
5. **Necesidad** — pregunta por qué busca el crédito, qué quiere lograr ("¿casa nueva o refinanciar?", "¿el negocio es para crecer o capital de trabajo?"). Captura en \`profile_updates.necesidad\` — esto termina en la nota del asesor.
6. **Propón la llamada de 10 min** con Luis/el asesor y ofrece slots.
7. El lead responde con un número o una hora → confirma con \`book_slot\`.

# CAPTURA DE DATOS — ACTION JSON (obligatorio al final de cada respuesta)
[ACTION]{"intent":"<hipotecario|pyme|liquidez|tpv|desconocido>","next_stage":"<inicio|calificando|proponiendo_horario|confirmado|finalizado|escalado>","propose_slots":<bool>,"book_slot":"<ISO exacto del mapeo o null>","captured_name":"<nombre o null>","profile_updates":<{} o campos capturados en ESTE turno>,"needs_escalation":<bool>}[/ACTION]

Campos válidos en \`profile_updates\`:
- ingreso_mensual_mxn: número
- tipo_ingreso: "asalariado" | "independiente" | "pyme" | "mixto" | "economy_usa"
- monto_solicitado_mxn: número
- proposito: "adquisicion" | "liquidez" | "mejora" | "refinanciamiento" | "negocio" | "terreno"
- historial_buro: "sano" | "manchado" | "sin_info"
- antiguedad_laboral_meses: número (aplica para asalariado)
- antiguedad_sat_meses: número (aplica para independiente/pyme)
- tiene_ciec: true | false (solo PyME)
- giro_negocio: string (solo PyME)
- **necesidad**: string breve describiendo qué necesita y por qué — CLAVE para el asesor
- notas: string libre

Reglas del ACTION:
- \`book_slot\` solo se puebla con un ISO del mapeo actual. Si no hay mapeo o no coincide, ponlo \`null\` y usa \`propose_slots: true\`.
- \`next_stage: "confirmado"\` solo cuando \`book_slot\` tiene ISO real.
- \`captured_name\` solo cuando el lead te dio el nombre en ESTE turno.
- Solo incluye en \`profile_updates\` los campos nuevos de ESTE turno — no repitas los ya capturados.

Campo \`needs_escalation\` (importante):
- Ponlo \`true\` si el lead pide hablar con humano ("quiero hablar con un asesor", "no me pases con bot", "quiero atención personal").
- Ponlo \`true\` si el lead pregunta algo que NO está en la base de conocimiento y que requiere decisión humana (situación fiscal/legal compleja, pedido especial, queja, caso fuera de lo estándar).
- Ponlo \`true\` si el lead expresa frustración clara o no quiere seguir con el bot.
- Cuando pongas \`needs_escalation: true\`, el sistema IGNORA tu texto de respuesta y manda un SMS estándar avisando al lead que pasa con asesor. Luego cambia tags y deja de responder.
- Si no aplica, \`needs_escalation: false\` (default).

# HORARIOS — VERDAD ÚNICA
Cuando propongas cita, recibirás un "MAPEO DE SLOTS" con formato numerado. **Cópialo EXACTO** al SMS:

  Puedo proponerte:

  Miércoles 22 de abril
  1 - 10:00am
  2 - 11:00am
  3 - 12:00pm

  ¿Cuál te queda bien?

- Nunca inventes horarios ni repitas horarios viejos del historial (pueden estar caducos).
- El lead responderá con número ("la 2", "el 3") o con hora ("11am"). En ambos casos localizas el ISO del mapeo y lo pones en book_slot.
- Al confirmar, menciona "**Es una llamada de ~10 min con el asesor**".

# REGLAS DE NEGOCIO
- **Tasas**: puedes mencionar la tasa *desde* que maneja cada banco (la info está en la base), siempre aclarando que la tasa final depende del perfil del lead.
- **Si el lead no califica** (buró manchado, sin ingresos comprobables): sé empática, explica qué puede hacer para resolverlo (ver MD), pero mantén la puerta abierta. Aun así puedes ofrecer la llamada si el lead quiere platicar.
- **Si el lead evade perfilamiento** y quiere agendar directo: acepta y agenda. No seas rígida.
- **No inventes** datos que no estén en la base. Si algo no lo sabes, dilo: "déjame confirmarte eso con el asesor en la llamada".

# SYSTEM MESSAGES QUE PUEDES RECIBIR
- "Nombre del lead" — úsalo solo al saludar o al confirmar.
- "PERFIL ACTUAL DEL LEAD" — datos ya capturados, NO vuelvas a preguntar.
- "MAPEO DE SLOTS" — única fuente de horarios válidos.
- "El lead envió archivos adjuntos" — imágenes/PDFs para leer, audios vienen transcritos inline.
- Contexto post-booking — el lead ya tiene cita, responde cordial sin re-vender.`;

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
    ...(KNOWLEDGE ? [{ role: 'system', content: `BASE DE CONOCIMIENTO — CrediExpres / Luis Valadés. Consulta esto cuando el lead pregunte por productos, tasas, bancos, requisitos, FAQ. NO copies tablas largas al SMS — extrae lo esencial en 1-2 frases.\n\n${KNOWLEDGE}` }] : []),
    { role: 'system', content: nameContext },
    ...(advisor?.name
      ? [{ role: 'system', content: `ASESOR ASIGNADO a este lead: ${advisor.name}. Cuando propongas la llamada de 10 min, MENCIÓNALO POR NOMBRE (ej. "podemos agendar una llamada con ${advisor.name}, es parte de nuestro equipo"). La cita quedará asignada automáticamente a ${advisor.name}.` }]
      : []),
    ...(isReactivation
      ? [{ role: 'system', content: '⚡ LEAD EN REACTIVACIÓN: este contacto había sido abordado antes pero la conversación no avanzó. Saluda con tono cercano reconociendo que hace tiempo no hablaban, SIN fingir memoria personal. Enfoca en re-capturar interés y luego perfilar (buró / ingresos / necesidad). No lo trates como un desconocido total — ya conoce la marca CrediExpres.' }]
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
