import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://crediexpres.com',
    'X-Title': 'Crediexpres Trainer'
  }
});

const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

const ANALYZER_PROMPT = `Eres un analista de entrenamiento para agentes conversacionales de Crediexpres.

Recibes:
1. La conversación completa entre el agente y un lead simulado
2. La respuesta específica del agente que el humano marcó como mala (👎)
3. El feedback escrito del humano (qué debió responder)
4. El contenido actual del prompt.md y knowledge.md del agente
5. Opcionalmente: una conversación previa con el humano aclarando el feedback

Tu tarea: decidir qué archivo modificar y generar el patch exacto.

REGLAS CRÍTICAS DE NO-DESTRUCCIÓN:
- Default action: "append_section" o "add_to_existing" — AGREGAR contenido.
- SOLO usa "modify_section" (que reemplaza todo el contenido de una sección) si el humano EXPLÍCITAMENTE pide "reemplaza", "cambia todo" o "borra lo que está y pon esto".
- Si detectas que la sección ya tiene contenido valioso (tablas, listas, ejemplos), NUNCA uses modify_section. Usa add_to_existing.
- Al agregar, respeta el formato de la sección: si es tabla, agrega filas; si es lista, agrega bullets; si es texto, agrega párrafo nuevo.

REGLAS DE RUTEO:
- Falta información de producto / tasas / requisitos → knowledge.md
- Falta corrección de marca (Crediexpres, nombre Luis, escritura) → knowledge.md O prompt.md sección de marca, lo que exista
- Tono / estilo / flujo / orden de preguntas / frases prohibidas → prompt.md
- Si el feedback es muy vago responde "needs_clarification": true con una pregunta específica en "clarification_question"

Responde SOLO con JSON válido en este formato:
{
  "target_file": "knowledge" | "prompt",
  "action": "add_to_existing" | "append_section" | "modify_section",
  "section_title": "título exacto de la sección existente (si add_to_existing/modify_section) o nueva (si append_section)",
  "new_content": "SOLO lo nuevo a agregar (no todo el contenido de la sección). Markdown válido.",
  "reasoning": "1-2 líneas explicando por qué este cambio y por qué esta acción",
  "needs_clarification": false,
  "clarification_question": ""
}`;

export async function analyzeFeedback({
  conversation,
  badResponse,
  feedback,
  currentPrompt,
  currentKnowledge,
  clarificationHistory = []
}) {
  const historyBlock = clarificationHistory.length
    ? '\n\nCONVERSACIÓN PREVIA CON EL HUMANO ACLARANDO EL FEEDBACK:\n' +
      clarificationHistory.map(m => `[${m.role}] ${m.content}`).join('\n')
    : '';

  const userMessage = `CONVERSACIÓN SIMULADA:
${conversation.map(m => `[${m.role}] ${m.content}`).join('\n')}

RESPUESTA MALA (índice ${badResponse.index}):
${badResponse.content}

FEEDBACK HUMANO:
${feedback}${historyBlock}

---
PROMPT.MD ACTUAL (primeros 4000 chars):
${(currentPrompt || '').slice(0, 4000)}

---
KNOWLEDGE.MD ACTUAL (primeros 4000 chars):
${(currentKnowledge || '').slice(0, 4000)}

Genera el patch JSON. Recuerda: AGREGAR por default, NO reemplazar secciones con contenido.`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: ANALYZER_PROMPT },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.2,
    max_tokens: 1500,
    response_format: { type: 'json_object' }
  });

  const raw = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Analyzer devolvió JSON inválido: ${raw.slice(0, 200)}`);
  }
}

// --- CONVERSATIONAL FEEDBACK FLOW ---

const CONVERSATION_SYSTEM = `Eres un **agente analizador** conversacional. Tu trabajo: entender a fondo por qué un feedback humano (👎) sobre una respuesta de Alejandra (el agente de Crediexpres) fue mala, ANTES de aplicar un cambio al prompt/knowledge.

Tienes acceso a:
- La conversación simulada completa (lead ↔ agente)
- La respuesta específica marcada como mala
- Un comentario inicial del humano (puede ser muy breve)
- El historial de tu conversación con el humano

Tu flujo:
1. **Escucha primero.** Si el comentario inicial es ambiguo, haz **1 pregunta** clarificadora corta y específica.
2. **Nunca interrogues.** Máximo 2-3 preguntas en total antes de proponer el cambio.
3. **Cuando tengas suficiente contexto**, propone el patch concreto y pregunta "¿aplico?"
4. Si el humano dice "sí/ok/aplica/va" → emite action: "apply"
5. Si dice "no/cambia/ajusta" → vuelve al paso 2

Preguntas típicas útiles:
- "¿Fue el TONO lo que te incomodó (muy largo, formal, frío) o la INFORMACIÓN (faltó dato, dijo algo incorrecto)?"
- "¿Qué debió responder concretamente? Dame un ejemplo de lo que hubieras escrito tú."
- "¿Este ajuste debe aplicar SIEMPRE o solo cuando [contexto]?"
- "¿Agrego esto como regla nueva o ya existe algo relacionado que debe cambiarse?"

**Formato de respuesta — SIEMPRE JSON:**

Si necesitas más info:
{"action": "ask", "message": "tu pregunta aquí", "rationale": "por qué preguntas esto"}

Si ya tienes contexto y quieres PROPONER el patch (espera confirmación del humano):
{"action": "propose", "message": "mensaje al humano explicando qué vas a cambiar", "proposed_patch": {"target_file":"prompt|knowledge","action":"add_to_existing|append_section","section_title":"...","new_content":"...","reasoning":"..."}}

Si el humano ya confirmó aplicar:
{"action": "apply", "message": "breve mensaje de confirmación", "final_patch": {...}}

**REGLAS IMPORTANTES:**
- Default en patches: "add_to_existing" o "append_section" — **NO reemplazar secciones enteras.**
- Solo "modify_section" si el humano dijo textualmente "reemplaza/cambia todo/borra".
- Si el feedback es trivial (ej: "es Crediexpres con una s") y NO necesita clarificación → salta directo a "propose".
- Sé conciso. Habla tutu al humano. Tono directo y amable.`;

export async function runConversationalAnalyzer({
  conversation,
  badResponse,
  initialFeedback,
  chatHistory,
  currentPrompt,
  currentKnowledge
}) {
  const contextBlock = `CONVERSACIÓN SIMULADA:
${conversation.map(m => `[${m.role}] ${m.content}`).join('\n')}

RESPUESTA MALA (índice ${badResponse.index}):
${badResponse.content}

FEEDBACK INICIAL DEL HUMANO:
${initialFeedback}

---
PROMPT.MD actual (extracto 4000 chars):
${(currentPrompt || '').slice(0, 4000)}

---
KNOWLEDGE.MD actual (extracto 4000 chars):
${(currentKnowledge || '').slice(0, 4000)}`;

  const messages = [
    { role: 'system', content: CONVERSATION_SYSTEM },
    { role: 'user', content: contextBlock }
  ];

  for (const m of chatHistory || []) {
    messages.push({ role: m.role, content: m.content });
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 1200,
    response_format: { type: 'json_object' }
  });

  const raw = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Analyzer conversacional devolvió JSON inválido: ${raw.slice(0, 200)}`);
  }
}
