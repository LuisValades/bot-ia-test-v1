import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://crediexpres.com',
    'X-Title': 'CrediExpres Trainer'
  }
});

const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

const ANALYZER_PROMPT = `Eres un analista de entrenamiento para agentes conversacionales de CrediExpres.

Recibes:
1. La conversación completa entre el agente y un lead simulado
2. La respuesta específica del agente que el humano marcó como mala (👎)
3. El feedback escrito del humano (qué debió responder)
4. El contenido actual del prompt.md y knowledge.md del agente

Tu tarea: decidir qué archivo modificar y generar el patch exacto.

REGLAS:
- Si el feedback es sobre información faltante de producto, tasas, requisitos, ejemplos → modificar knowledge.md
- Si el feedback es sobre tono, estilo, flujo, orden de preguntas, frases prohibidas → modificar prompt.md
- NO inventes contenido. El patch debe reflejar literalmente lo que el humano pidió.
- El patch debe ser incremental: agregar una sección nueva o modificar una existente. NO reescribas todo el archivo.
- Si no tienes suficiente claridad sobre qué cambiar, responde con "needs_clarification": true

Responde SOLO con JSON válido en este formato:
{
  "target_file": "knowledge" | "prompt",
  "action": "append_section" | "modify_section" | "add_to_existing",
  "section_title": "título de la sección a agregar o modificar",
  "new_content": "contenido completo de la sección (markdown)",
  "reasoning": "1-2 líneas explicando por qué este cambio",
  "needs_clarification": false
}`;

export async function analyzeFeedback({ conversation, badResponse, feedback, currentPrompt, currentKnowledge }) {
  const userMessage = `CONVERSACIÓN:
${conversation.map(m => `[${m.role}] ${m.content}`).join('\n')}

RESPUESTA MALA (índice ${badResponse.index}):
${badResponse.content}

FEEDBACK HUMANO:
${feedback}

---
PROMPT.MD ACTUAL (primeros 3000 chars):
${(currentPrompt || '').slice(0, 3000)}

---
KNOWLEDGE.MD ACTUAL (primeros 3000 chars):
${(currentKnowledge || '').slice(0, 3000)}

Genera el patch JSON.`;

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
