/**
 * RAG helper — vector search sobre Pinecone para recuperar contexto
 * relevante del knowledge + playbooks en cada turno del bot.
 *
 * API:
 *   await embed(text)             → devuelve vector[1536]
 *   await searchKB(query, k=5)    → devuelve top-k chunks {id, score, source, title, body}
 *   await upsertChunks(chunks)    → sube chunks al índice (usado por ingest)
 */
import { openrouter } from './openrouter.js';

const PINECONE_HOST = (process.env.PINECONE_INDEX_HOST || '').replace(/\/$/, '');
const PINECONE_KEY = process.env.PINECONE_API_KEY;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-small';

export function isRagEnabled() {
  return !!(PINECONE_HOST && PINECONE_KEY);
}

export async function embed(text) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('embed: texto vacío');
  const res = await openrouter.embeddings.create({
    model: EMBEDDING_MODEL,
    input: clean.slice(0, 8000) // safety cap, text-embedding-3-small acepta 8191 tokens
  });
  return res.data[0].embedding;
}

async function pineconeFetch(path, options = {}) {
  if (!PINECONE_HOST || !PINECONE_KEY) {
    throw new Error('Pinecone no configurado (falta PINECONE_INDEX_HOST o PINECONE_API_KEY)');
  }
  const res = await fetch(`${PINECONE_HOST}${path}`, {
    ...options,
    headers: {
      'Api-Key': PINECONE_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pinecone ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Busca top-k chunks similares a la query.
 * @param {string} query - Texto del usuario o tema de consulta
 * @param {number} k - Cantidad de chunks a devolver (default 5)
 * @param {object} [filter] - Filtro de metadata opcional (ej. {source: 'playbooks/pyme.md'})
 * @returns {Array<{id, score, source, title, body}>}
 */
export async function searchKB(query, k = 5, filter = null) {
  if (!isRagEnabled()) return [];
  const vector = await embed(query);
  const body = {
    vector,
    topK: k,
    includeMetadata: true,
    includeValues: false,
    ...(filter ? { filter } : {})
  };
  const res = await pineconeFetch('/query', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return (res.matches || []).map(m => ({
    id: m.id,
    score: m.score,
    source: m.metadata?.source || 'unknown',
    title: m.metadata?.title || '',
    body: m.metadata?.body || '',
    chunkIndex: m.metadata?.chunkIndex
  }));
}

/**
 * Formatea los chunks como un bloque de contexto para el system message.
 */
export function formatChunksAsContext(chunks) {
  if (!chunks || chunks.length === 0) return '';
  const lines = chunks.map((c, i) => {
    return `[${i + 1}] (${c.source}${c.title ? ` · ${c.title}` : ''})\n${c.body.trim()}`;
  });
  return `CONOCIMIENTO RELEVANTE (RAG · top ${chunks.length}):\n\n${lines.join('\n\n---\n\n')}`;
}

/**
 * Upsert batch de chunks al índice.
 * @param {Array<{id, values, metadata}>} records
 */
export async function upsertChunks(records) {
  if (!records.length) return { upserted: 0 };
  // Pinecone recomienda batches ≤ 100
  const batchSize = 100;
  let total = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await pineconeFetch('/vectors/upsert', {
      method: 'POST',
      body: JSON.stringify({ vectors: batch })
    });
    total += batch.length;
  }
  return { upserted: total };
}

/**
 * Elimina vectores por filtro (ej. borrar todos los chunks de un archivo antes de re-ingestar).
 */
export async function deleteBySource(source) {
  if (!isRagEnabled()) return;
  await pineconeFetch('/vectors/delete', {
    method: 'POST',
    body: JSON.stringify({
      filter: { source: { $eq: source } }
    })
  });
}

export async function deleteAllVectors() {
  if (!isRagEnabled()) return;
  await pineconeFetch('/vectors/delete', {
    method: 'POST',
    body: JSON.stringify({ deleteAll: true })
  });
}

export async function getIndexStats() {
  return pineconeFetch('/describe_index_stats', { method: 'POST', body: JSON.stringify({}) });
}
