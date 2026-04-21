import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputArg = process.argv[2];

async function findLatestJson() {
  if (inputArg) return path.resolve(inputArg);
  const files = await fs.readdir(__dirname);
  const match = files.filter(f => f.startsWith('yt-videos-') && f.endsWith('.json')).sort().reverse();
  if (!match[0]) throw new Error('No hay yt-videos-*.json en scripts/');
  return path.join(__dirname, match[0]);
}

const CATEGORIES = [
  { id: 'hipotecario_general', label: 'Hipotecario — guías generales y proceso' },
  { id: 'tasas_bancos', label: 'Comparativas de bancos y tasas (Santander, Banorte, HSBC, BBVA, Scotia, Banamex)' },
  { id: 'perfiles_hipoteca', label: 'Hipoteca por perfil (independiente, PFAE, RESICO, residente en USA, creciente vs fija)' },
  { id: 'infonavit', label: 'Infonavit y combinaciones (Apoyo Infonavit, Cofinavit)' },
  { id: 'terreno_construccion', label: 'Terreno y construcción' },
  { id: 'liquidez_hipotecaria', label: 'Liquidez hipotecaria (crédito sobre propiedad)' },
  { id: 'pyme_negocio', label: 'Crédito PyME y financiamiento empresarial' },
  { id: 'capitalizacion', label: 'Capitalización de negocios y estrategia de deuda' },
  { id: 'sat_fiscal', label: 'SAT, fiscal y RESICO (declaraciones, deducciones, devoluciones)' },
  { id: 'seguros_hipoteca', label: 'Seguros, avalúo, escrituración y cancelación' },
  { id: 'inversion', label: 'Inversión en bienes raíces y educación financiera' },
  { id: 'quienes_somos', label: 'Quiénes somos / entrevistas / testimonios / autoridad' }
];

const SYSTEM = `Eres un categorizador de videos de YouTube de un canal de broker hipotecario mexicano (Luis Valades / Crediexpres).

Recibes una lista de videos con título, descripción, duración, views y URL.

Debes clasificarlos en ESTAS categorías (usa el id exacto):
${CATEGORIES.map(c => `- ${c.id}: ${c.label}`).join('\n')}

REGLAS:
- Cada video va EN UNA sola categoría (la más específica que aplique).
- Si un video no encaja en ninguna, ignóralo.
- Para cada categoría selecciona los **TOP 3 videos** más relevantes y representativos (prioriza los que son guías explicativas, con más views, o más recientes).
- Responde SOLO con JSON válido en este formato:
{
  "categories": {
    "hipotecario_general": [
      {"videoId": "...", "title": "...", "url": "...", "duration": "...", "why": "1 línea por qué es el top"},
      ...
    ],
    "tasas_bancos": [...],
    ...
  }
}`;

async function main() {
  const inputFile = await findLatestJson();
  console.log(`[cat] input: ${inputFile}`);
  const data = JSON.parse(await fs.readFile(inputFile, 'utf8'));
  const videos = data.videos || [];
  console.log(`[cat] ${videos.length} videos a categorizar`);

  const compact = videos.map(v => ({
    id: v.videoId,
    title: v.title,
    desc: (v.description || '').slice(0, 120),
    duration: v.duration,
    views: v.viewCount,
    publishedAt: v.publishedAt?.slice(0, 10)
  }));

  const client = new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'https://crediexpres.com',
      'X-Title': 'Crediexpres YT Categorizer'
    }
  });

  console.log(`[cat] llamando LLM…`);
  const response = await client.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `VIDEOS:\n${JSON.stringify(compact, null, 2)}` }
    ],
    temperature: 0.2,
    max_tokens: 4500,
    response_format: { type: 'json_object' }
  });

  const raw = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outJson = path.join(__dirname, `yt-categorized-${stamp}.json`);
  const outMd = path.join(__dirname, `yt-categorized-${stamp}.md`);

  await fs.writeFile(outJson, JSON.stringify(parsed, null, 2), 'utf8');

  const lines = [
    '# Videos del canal — mapeados por tema (Top 3 por categoría)',
    `**Fuente:** ${path.basename(inputFile)}`,
    `**Generado:** ${new Date().toLocaleString('es-MX')}`,
    `**Canal:** ${data.channelTitle} — ${data.channelUrl}`,
    ''
  ];

  for (const cat of CATEGORIES) {
    const items = parsed.categories?.[cat.id] || [];
    if (items.length === 0) continue;
    lines.push(`## ${cat.label}`);
    lines.push('');
    lines.push('| Duración | Título | URL |');
    lines.push('|---|---|---|');
    for (const v of items) {
      const t = (v.title || '').replace(/\|/g, '\\|').slice(0, 90);
      lines.push(`| ${v.duration || '—'} | ${t} | [ver](${v.url}) |`);
    }
    lines.push('');
  }

  await fs.writeFile(outMd, lines.join('\n'), 'utf8');

  console.log(`\n✅ Categorización guardada:\n   ${outJson}\n   ${outMd}`);
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
