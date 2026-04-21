import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  GHL_API_TOKEN,
  GHL_LOCATION_ID,
  GHL_BASE_URL = 'https://services.leadconnectorhq.com',
  OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
} = process.env;

const LUIS_EMAIL = 'luis@crediexpres.com';
const MAX_CONVERSATIONS = parseInt(process.argv[2] || '100', 10);
const MAX_MSGS_PER_CONV = 30;
const ANALYSIS_MODEL = process.argv[3] || 'openai/gpt-4o-mini';

function ghlHeaders() {
  return {
    Authorization: `Bearer ${GHL_API_TOKEN}`,
    Version: '2021-04-15',
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

async function ghl(url, options = {}) {
  const res = await fetch(`${GHL_BASE_URL}${url}`, {
    ...options,
    headers: { ...ghlHeaders(), ...(options.headers || {}) }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GHL ${options.method || 'GET'} ${url} → ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

const TEAM = {
  [process.env.GHL_LUIS_USER_ID || '']: 'LUIS',
  [process.env.GHL_EFRAIN_USER_ID || '']: 'EFRAIN',
  [process.env.GHL_JONNY_USER_ID || '']: 'JONNY'
};
// limpiar entrada vacía
delete TEAM[''];

async function findLuisUserId() {
  const fromEnv = process.env.GHL_LUIS_USER_ID;
  if (fromEnv) {
    console.log(`[luis] usando GHL_LUIS_USER_ID de env: ${fromEnv}`);
    return fromEnv;
  }
  try {
    const data = await ghl(`/users/search?companyId=${GHL_LOCATION_ID}&locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(LUIS_EMAIL)}`);
    const users = data.users || data.items || [];
    const luis = users.find(
      u => (u.email || '').toLowerCase() === LUIS_EMAIL.toLowerCase()
    );
    if (luis) {
      console.log(`[luis] encontrado via API: ${luis.id}`);
      return luis.id;
    }
  } catch (err) {
    console.warn(`[luis] no se pudo resolver por email (${err.message})`);
  }
  return null;
}

async function searchConversations(limit) {
  const params = new URLSearchParams({
    locationId: GHL_LOCATION_ID,
    limit: String(Math.min(limit, 100)),
    sort: 'desc',
    sortBy: 'last_message_date'
  });
  const data = await ghl(`/conversations/search?${params}`);
  return data.conversations || data.items || [];
}

async function getMessages(conversationId) {
  const data = await ghl(
    `/conversations/${conversationId}/messages?limit=${MAX_MSGS_PER_CONV}`
  );
  return data.messages?.messages || data.messages || data.items || [];
}

function cleanText(s) {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/\[Mensaje Automatizado\]/gi, '')
    .trim();
}

function messageDirection(m) {
  if (m.direction) return m.direction;
  if (m.meta?.sms?.direction) return m.meta.sms.direction;
  if (m.meta?.whatsapp?.direction) return m.meta.whatsapp.direction;
  return null;
}

const CHANNEL_MAP = {
  20: 'SMS',
  1: 'CALL',
  18: 'IG',
  3: 'EMAIL',
  37: 'NOTE',
  11: 'WA'
};

function extractRelevantMessages(messages) {
  return messages
    .filter(m => {
      const ch = CHANNEL_MAP[m.type];
      return (ch === 'SMS' || ch === 'NOTE' || ch === 'IG' || ch === 'WA') && (m.body || m.message);
    })
    .map(m => ({
      channel: CHANNEL_MAP[m.type] || '?',
      direction: messageDirection(m) || (m.type === 37 ? 'outbound' : null),
      userId: m.userId || null,
      body: cleanText(m.body || m.message),
      date: m.dateAdded || m.createdAt,
      contactId: m.contactId
    }))
    .filter(m => m.body && m.body.length > 1);
}

function labelMessage(msg, luisUserId) {
  if (msg.direction === 'inbound') return 'LEAD';
  if (msg.channel === 'NOTE' && luisUserId && msg.userId === luisUserId) return 'LUIS-NOTE';
  if (msg.channel === 'NOTE') return 'NOTE';
  if (luisUserId && msg.userId === luisUserId) return 'LUIS';
  if (msg.userId && TEAM[msg.userId]) return TEAM[msg.userId];
  if (msg.userId) return 'STAFF';
  return 'BOT';
}

function formatCorpus(conversations, luisUserId) {
  const lines = [];
  for (const conv of conversations) {
    lines.push(`\n=== Conv ${conv.id?.slice(-6) || '?'} (contact ${conv.contactId?.slice(-6) || '?'}) ===`);
    for (const msg of conv.messages) {
      const label = labelMessage(msg, luisUserId);
      lines.push(`[${label}·${msg.channel}] ${msg.body.slice(0, 400)}`);
    }
  }
  return lines.join('\n');
}

const ANALYST_SYSTEM = `Eres un analista experto en conversaciones SMS comerciales de brokers hipotecarios mexicanos.

Recibes un corpus etiquetado con:
- [LUIS] y [LUIS-NOTE]: mensajes/notas del BROKER PRINCIPAL (Luis Valadés, dueño CrediExpres) → **DALE 3X MÁS PESO** en el análisis de tono y estilo. Es la referencia de oro.
- [EFRAIN] y [JONNY]: otros asesores del equipo — peso 1x, útiles pero NO son la referencia principal
- [STAFF]: otros usuarios sin identificar — peso 1x
- [NOTE]: notas internas sin identificar autor específico
- [BOT]: mensajes automatizados del bot IA (NO los uses para identificar tono humano, solo contexto)
- [LEAD]: mensajes de los clientes potenciales (útiles para entender cómo responden los leads, qué preguntan, qué objeciones tienen)

Tu tarea: extraer patrones concretos de tono y escritura que sirvan para entrenar a "Alejandra" (el bot de CrediExpres) para que suene como Luis.

Responde en markdown estructurado con SECCIONES claras:

## 1. TONO general de Luis y el equipo
Frases adjetivas (ej: cercano, directo, técnico-claro). Con 3-5 citas textuales cortas.

## 2. ESTILO de escritura
Longitud promedio, emojis, puntuación, saltos de línea, uso de mayúsculas, coletillas típicas (ej: "va?", "sale?", "mándame", "ok").

## 3. SALUDOS típicos
Lista de saludos concretos que usa Luis al iniciar (4-8 ejemplos textuales).

## 4. CIERRES típicos
Cómo cierra conversaciones o propone siguiente paso. Frases textuales.

## 5. MANEJO DE OBJECIONES
Cuando el lead duda o dice "no", cómo responde Luis. Ejemplos textuales.

## 6. PREGUNTAS DE CALIFICACIÓN
Qué preguntas usa Luis para pre-calificar (ingresos, empleo, propiedad, buró, plazo).

## 7. FRASES CARACTERÍSTICAS (top 15)
Lista numerada de frases o expresiones que aparecen mucho en los mensajes de Luis/staff. Textuales.

## 8. DIFERENCIAS LUIS vs STAFF vs BOT
Si detectas patrones distintos entre los 3 grupos, dilo. Ejemplo: "Luis usa X, staff usa Y, bot usa Z".

## 9. OPORTUNIDADES DE MEJORA para el bot
3-5 sugerencias concretas basadas en lo que notaste: qué debería imitar el bot del tono humano.

## 10. FRASES QUE EL BOT DEBE EVITAR
Si ves que el bot dice cosas que los humanos NUNCA dicen, señálalo.

IMPORTANTE:
- Cita TEXTUALMENTE cuando puedas (entre comillas).
- Si no hay suficientes datos para una sección, escribe "(datos insuficientes)".
- No inventes patrones que no estén en el corpus.`;

async function analyzeWithLLM(corpus, stats) {
  const client = new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'https://crediexpres.com',
      'X-Title': 'CrediExpres Tone Analyzer'
    }
  });

  const userPrompt = `CORPUS de conversaciones SMS de CrediExpres (${stats.conversations} conversaciones, ${stats.luis} msgs de Luis, ${stats.staff} msgs de staff, ${stats.lead} msgs de leads, ${stats.bot} msgs de bot):

${corpus}

Genera el análisis completo en markdown siguiendo las 10 secciones pedidas.`;

  const completion = await client.chat.completions.create({
    model: ANALYSIS_MODEL,
    messages: [
      { role: 'system', content: ANALYST_SYSTEM },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 4000
  });

  return completion.choices[0]?.message?.content || '(sin análisis)';
}

async function main() {
  console.log(`[tone] arrancando análisis de las últimas ${MAX_CONVERSATIONS} conversaciones…`);
  if (!GHL_API_TOKEN || !GHL_LOCATION_ID) {
    throw new Error('Faltan GHL_API_TOKEN o GHL_LOCATION_ID en .env');
  }
  if (!OPENROUTER_API_KEY) {
    throw new Error('Falta OPENROUTER_API_KEY en .env');
  }

  const luisUserId = await findLuisUserId();

  console.log('[ghl] buscando conversaciones…');
  const convs = await searchConversations(MAX_CONVERSATIONS);
  console.log(`[ghl] ${convs.length} conversaciones encontradas`);

  const detailed = [];
  const typeCounts = {};
  let idx = 0;
  for (const c of convs) {
    idx++;
    process.stdout.write(`\r[ghl] fetch mensajes ${idx}/${convs.length}`);
    try {
      const raw = await getMessages(c.id);
      for (const m of raw) {
        const t = String(m.type ?? m.messageType ?? '?');
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }
      const sms = extractRelevantMessages(raw);
      if (sms.length > 0) detailed.push({ id: c.id, contactId: c.contactId, messages: sms });
    } catch (err) {
      // skip conv
    }
  }
  console.log('\n[debug] message types seen:', typeCounts);

  const stats = { conversations: detailed.length, luis: 0, luisNote: 0, efrain: 0, jonny: 0, staff: 0, lead: 0, bot: 0, note: 0 };
  for (const c of detailed) {
    for (const m of c.messages) {
      const lbl = labelMessage(m, luisUserId);
      if (lbl === 'LUIS') stats.luis++;
      else if (lbl === 'LUIS-NOTE') stats.luisNote++;
      else if (lbl === 'EFRAIN') stats.efrain++;
      else if (lbl === 'JONNY') stats.jonny++;
      else if (lbl === 'STAFF') stats.staff++;
      else if (lbl === 'LEAD') stats.lead++;
      else if (lbl === 'NOTE') stats.note++;
      else stats.bot++;
    }
  }
  console.log('[stats]', stats);

  const corpus = formatCorpus(detailed, luisUserId);
  const corpusBytes = Buffer.byteLength(corpus);
  console.log(`[corpus] ${corpusBytes.toLocaleString()} bytes (~${Math.round(corpusBytes / 4).toLocaleString()} tokens aprox)`);

  console.log(`[llm] analizando con ${ANALYSIS_MODEL}…`);
  const analysis = await analyzeWithLLM(corpus, stats);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(__dirname);
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `tone-analysis-${stamp}.md`);
  const corpusFile = path.join(outDir, `corpus-${stamp}.txt`);

  const header = `# Análisis de tono — CrediExpres SMS
**Fecha:** ${new Date().toLocaleString('es-MX')}
**Modelo:** ${ANALYSIS_MODEL}
**Luis user ID:** ${luisUserId || '(no resuelto)'}
**Stats:** ${JSON.stringify(stats, null, 2)}

---

${analysis}

---

## Metadata
- Corpus guardado en: \`${path.basename(corpusFile)}\`
- Conversaciones analizadas: ${detailed.length}
- Bytes del corpus: ${corpusBytes.toLocaleString()}
`;

  await fs.writeFile(outFile, header, 'utf8');
  await fs.writeFile(corpusFile, corpus, 'utf8');

  console.log(`\n✅ ANÁLISIS GUARDADO EN:\n   ${outFile}\n   ${corpusFile}`);
}

main().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
