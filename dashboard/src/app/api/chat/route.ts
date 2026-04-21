import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAgent } from '@/lib/agents';

const TRAINER_URL = process.env.TRAINER_URL || 'http://localhost:4000';
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

const client = new OpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://crediexpres.com',
    'X-Title': 'CrediExpres Dashboard'
  }
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function loadAgentFiles(agentId: string) {
  const res = await fetch(`${TRAINER_URL}/api/agents/${agentId}/files`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Trainer no devolvió archivos para ${agentId} (${res.status})`);
  return res.json() as Promise<{ prompt: string; knowledge: string }>;
}

const CITATION_INSTRUCTION = `
[MODO ENTRENAMIENTO — instrucción oculta al usuario]
Al final de tu respuesta, en una línea nueva, incluye una etiqueta oculta con las secciones del knowledge.md que consultaste:
[CITED: Nombre de sección 1 | Nombre de sección 2]
Si no usaste ninguna sección específica, escribe: [CITED: ninguna]
Este tag se elimina antes de mostrar tu respuesta al usuario final.`;

function extractCitations(raw: string): { reply: string; citations: string[] } {
  const match = raw.match(/\[CITED:\s*([^\]]*)\]/i);
  if (!match) return { reply: raw.trim(), citations: [] };
  const reply = raw.replace(match[0], '').trim();
  const inner = (match[1] || '').trim();
  if (!inner || /^ninguna$/i.test(inner)) return { reply, citations: [] };
  const citations = inner
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);
  return { reply, citations };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent: agentId, messages } = body as { agent: string; messages: ChatMessage[] };

    const agent = getAgent(agentId);
    if (!agent) return NextResponse.json({ error: `Agente desconocido: ${agentId}` }, { status: 404 });

    if (agent.status === 'placeholder') {
      return NextResponse.json({
        reply: `(${agent.name} aún no tiene prompt ni knowledge. Define su rol y crea los .md en agentes/${agent.id}/.)`,
        citations: []
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY no configurada en dashboard/.env.local' },
        { status: 500 }
      );
    }

    const { prompt, knowledge } = await loadAgentFiles(agentId);

    const systemMessages = [
      { role: 'system' as const, content: prompt || '(prompt vacío)' },
      {
        role: 'system' as const,
        content: `CONOCIMIENTO DE PRODUCTO (knowledge.md):\n\n${knowledge || '(knowledge vacío)'}`
      },
      { role: 'system' as const, content: CITATION_INSTRUCTION }
    ];

    const chatMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [...systemMessages, ...chatMessages],
      temperature: 0.5,
      max_tokens: 600
    });

    const raw = completion.choices[0]?.message?.content || '(sin respuesta)';
    const { reply, citations } = extractCitations(raw);
    return NextResponse.json({ reply, citations, model: MODEL });
  } catch (err: any) {
    console.error('[chat] error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
