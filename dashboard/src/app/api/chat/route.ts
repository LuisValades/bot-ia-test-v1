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
  const res = await fetch(`${TRAINER_URL}/api/agents/${agentId}/files`, {
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`Trainer no devolvió archivos para ${agentId} (${res.status})`);
  }
  return res.json() as Promise<{ prompt: string; knowledge: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent: agentId, messages } = body as { agent: string; messages: ChatMessage[] };

    const agent = getAgent(agentId);
    if (!agent) {
      return NextResponse.json({ error: `Agente desconocido: ${agentId}` }, { status: 404 });
    }

    if (agent.status === 'placeholder') {
      return NextResponse.json({
        reply: `(${agent.name} aún no tiene prompt ni knowledge definidos. Define su rol y crea los archivos .md dentro de agentes/${agent.id}/ antes de entrenarlo.)`
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
      {
        role: 'system' as const,
        content:
          'NOTA: Estás en modo entrenamiento con un humano calificador. Responde EXACTAMENTE igual que en producción real con un lead. No menciones que estás siendo entrenado.'
      }
    ];

    const chatMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [...systemMessages, ...chatMessages],
      temperature: 0.5,
      max_tokens: 500
    });

    const reply = completion.choices[0]?.message?.content?.trim() || '(sin respuesta)';
    return NextResponse.json({ reply, model: MODEL });
  } catch (err: any) {
    console.error('[chat] error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
