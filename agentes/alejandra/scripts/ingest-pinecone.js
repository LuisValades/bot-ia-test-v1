#!/usr/bin/env node
/**
 * Ingesta knowledge.md + playbooks/*.md al índice de Pinecone.
 *
 * Uso:
 *   node scripts/ingest-pinecone.js                    # ingesta todo
 *   node scripts/ingest-pinecone.js playbooks/pyme.md  # ingesta un archivo específico
 *   node scripts/ingest-pinecone.js --clean            # borra todo antes (re-ingest completo)
 *
 * Lee los MDs, los parte en chunks por sección (H1/H2/H3), genera embeddings
 * con OpenRouter y upserts a Pinecone. Cada chunk lleva metadata con source,
 * title, chunkIndex y body (para recuperar sin segunda llamada).
 */
import 'dotenv/config';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Import dinámico para que dotenv se cargue antes
const { embed, upsertChunks, deleteBySource, isRagEnabled, getIndexStats } = await import('../src/rag.js');

if (!isRagEnabled()) {
  console.error('❌ Pinecone no configurado. Revisa PINECONE_API_KEY y PINECONE_INDEX_HOST en .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const cleanMode = args.includes('--clean');
const specificFiles = args.filter(a => !a.startsWith('--'));

const MAX_CHARS = 2500;    // ~625 tokens por chunk
const MIN_CHARS = 80;      // ignorar chunks tiny

/**
 * Parsea un MD en secciones jerárquicas por H1/H2/H3.
 * Cada sección hereda el contexto de sus padres en el title.
 */
function parseSections(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let currentPath = [];  // pila de títulos padre por nivel
  let currentBody = [];
  let currentTitle = '';
  let currentLevel = 0;

  const flush = () => {
    const body = currentBody.join('\n').trim();
    if (body.length >= MIN_CHARS) {
      sections.push({
        title: currentPath.slice(0, currentLevel).join(' > ') || currentTitle || '(intro)',
        body,
        level: currentLevel
      });
    }
    currentBody = [];
  };

  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flush();
      const level = h[1].length;
      const title = h[2].trim();
      currentPath = currentPath.slice(0, level - 1);
      currentPath.push(title);
      currentTitle = title;
      currentLevel = level;
    } else {
      currentBody.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * Si una sección supera MAX_CHARS, la parte en sub-chunks por párrafos
 * manteniendo el título original como contexto.
 */
function splitBigSection(section) {
  if (section.body.length <= MAX_CHARS) return [section];
  const paragraphs = section.body.split(/\n\s*\n+/);
  const chunks = [];
  let buf = [];
  let bufLen = 0;
  for (const p of paragraphs) {
    if (bufLen + p.length > MAX_CHARS && buf.length > 0) {
      chunks.push({ ...section, body: buf.join('\n\n') });
      buf = [];
      bufLen = 0;
    }
    buf.push(p);
    bufLen += p.length + 2;
  }
  if (buf.length) chunks.push({ ...section, body: buf.join('\n\n') });
  return chunks;
}

function chunkIdFor(source, idx, body) {
  // hash corto para idempotencia: mismo contenido → mismo id → upsert no duplica
  const h = crypto
    .createHash('sha1')
    .update(`${source}::${idx}::${body.slice(0, 200)}`)
    .digest('hex')
    .slice(0, 12);
  return `${source}#${idx}-${h}`;
}

async function ingestFile(filePath, sourceId) {
  const raw = readFileSync(filePath, 'utf-8');
  if (!raw.trim()) {
    console.log(`  ⚠️  ${sourceId} vacío — skip`);
    return 0;
  }
  const sections = parseSections(raw).flatMap(splitBigSection);
  if (sections.length === 0) {
    console.log(`  ⚠️  ${sourceId} sin secciones — skip`);
    return 0;
  }

  console.log(`  📄 ${sourceId} → ${sections.length} chunks`);

  // Borra chunks viejos de este source antes de re-ingestar
  try {
    await deleteBySource(sourceId);
  } catch (err) {
    // 404 si no existía: OK
    if (!/not found/i.test(err.message)) console.warn(`  (delete prev: ${err.message})`);
  }

  const records = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const text = `${s.title}\n\n${s.body}`;
    process.stdout.write(`    [${i + 1}/${sections.length}] embedding "${s.title.slice(0, 50)}"...\r`);
    try {
      const vec = await embed(text);
      records.push({
        id: chunkIdFor(sourceId, i, s.body),
        values: vec,
        metadata: {
          source: sourceId,
          title: s.title,
          body: s.body.slice(0, 3500), // Pinecone metadata cap ~40KB, dejamos margen
          chunkIndex: i,
          level: s.level,
          length: s.body.length
        }
      });
    } catch (err) {
      console.error(`\n    ❌ embedding "${s.title}": ${err.message}`);
    }
  }
  console.log();

  const { upserted } = await upsertChunks(records);
  console.log(`  ✅ ${sourceId}: ${upserted} chunks upserted`);
  return upserted;
}

function collectFiles() {
  const targets = [];

  if (specificFiles.length > 0) {
    for (const f of specificFiles) {
      const abs = resolve(ROOT, f);
      if (!existsSync(abs)) {
        console.error(`❌ No existe: ${f}`);
        process.exit(1);
      }
      targets.push({ abs, source: relative(ROOT, abs).replace(/\\/g, '/') });
    }
    return targets;
  }

  // Default: knowledge.md + todos los .md en playbooks/
  const kbPath = join(ROOT, 'knowledge.md');
  if (existsSync(kbPath)) {
    targets.push({ abs: kbPath, source: 'knowledge.md' });
  }

  const playbooksDir = join(ROOT, 'playbooks');
  if (existsSync(playbooksDir) && statSync(playbooksDir).isDirectory()) {
    const mds = readdirSync(playbooksDir)
      .filter(f => f.endsWith('.md'))
      .sort();
    for (const f of mds) {
      targets.push({
        abs: join(playbooksDir, f),
        source: `playbooks/${f}`
      });
    }
  }

  return targets;
}

async function main() {
  console.log('🔍 Pinecone index:', process.env.PINECONE_INDEX_NAME);
  try {
    const stats = await getIndexStats();
    console.log(
      `   Estado actual: ${stats.totalVectorCount || 0} vectors, ${stats.dimension} dims`
    );
  } catch (err) {
    console.warn(`   (no pude leer stats: ${err.message})`);
  }

  const targets = collectFiles();
  if (targets.length === 0) {
    console.error('❌ No encontré MDs para ingestar (ni knowledge.md ni playbooks/*.md)');
    process.exit(1);
  }

  console.log(`\n📥 Ingestando ${targets.length} archivo(s):\n`);

  let totalChunks = 0;
  for (const { abs, source } of targets) {
    totalChunks += await ingestFile(abs, source);
  }

  console.log(`\n🎉 Listo. Total: ${totalChunks} chunks en Pinecone.`);

  try {
    const stats = await getIndexStats();
    console.log(`   Estado final: ${stats.totalVectorCount || 0} vectors.`);
  } catch {}
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
