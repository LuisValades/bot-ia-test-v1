import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

function getClient() {
  return new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'https://crediexpres.com',
      'X-Title': 'Crediexpres Dashboard'
    }
  });
}

interface Body {
  thread: Array<{ who: string; msg: string; time: string }>;
  currentSms: string;
  instruction: string;
  leadName: string;
  advisorName: string;
  reason?: string;
}

const SYSTEM = `Eres un asistente que pule SMS cortos de follow-up para el equipo comercial de Crediexpres México (broker hipotecario, créditos hipotecarios y PyME).

REGLAS DEL SMS:
- Español neutro México, tutear (nunca usted).
- 1 a 3 frases cortas. Sin emojis. Sin listas ni bullets. Sin signos de exclamación en exceso (máx 1).
- Directo, cálido, humano. Nunca suena a script ni a bot.
- Nunca inventes datos (tasas, plazos, montos) que no estén en el contexto.
- Si el asesor pide un cambio de tono (ej. "más corto", "dale las gracias", "menos formal"), aplícalo sin perder la intención original.
- Si el SMS actual ya cumple la instrucción, mejóralo marginalmente pero no reescribas por reescribir.

Responde SOLO con JSON válido:
{"sms":"<el nuevo SMS listo para enviar>","note":"<1 frase explicando qué cambiaste>"}`;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY no configurada' },
        { status: 500 }
      );
    }

    const { thread, currentSms, instruction, leadName, advisorName, reason } =
      (await req.json()) as Body;

    const threadText = thread.map(m => `[${m.who} · ${m.time}] ${m.msg}`).join('\n');

    const userPrompt = `Lead: ${leadName}
Asesor que va a enviar: ${advisorName}
${reason ? `Razón sugerida del AI: ${reason}\n` : ''}
Hilo reciente con el lead:
${threadText}

SMS actual (borrador):
"${currentSms || '(vacío — proponer uno desde cero)'}"

Instrucción del asesor para pulir el SMS:
"${instruction}"

Devuelve el SMS pulido respetando las reglas.`;

    const client = getClient();
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let parsed: { sms?: string; note?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { sms: raw.trim(), note: '' };
    }

    const sms = (parsed.sms || '').trim();
    const note = (parsed.note || '').trim();

    if (!sms) {
      return NextResponse.json(
        { error: 'El modelo no devolvió SMS. Intenta otra instrucción.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ sms, note, model: MODEL });
  } catch (err: any) {
    console.error('[suggest-sms] error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
