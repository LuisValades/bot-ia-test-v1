import 'dotenv/config';
const HOST = process.env.PINECONE_INDEX_HOST;
const KEY = process.env.PINECONE_API_KEY;
if (!HOST || !KEY) { console.error('Missing Pinecone env'); process.exit(1); }

// Use a dummy zero vector to retrieve top K, then group by source
async function listAll() {
  // Pinecone v1 query with topK and includeMetadata
  const body = {
    vector: new Array(1536).fill(0.001),
    topK: 1000,
    includeMetadata: true,
    includeValues: false
  };
  const url = HOST.startsWith('http') ? `${HOST}/query` : `https://${HOST}/query`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Api-Key': KEY, 'Content-Type': 'application/json', 'X-Pinecone-API-Version': '2024-07' },
    body: JSON.stringify(body)
  });
  if (!r.ok) { console.error('Query err:', r.status, await r.text()); process.exit(1); }
  const j = await r.json();
  return j.matches || [];
}

const matches = await listAll();
const bySource = {};
for (const m of matches) {
  const src = m.metadata?.source || '(no source)';
  bySource[src] = (bySource[src] || 0) + 1;
}
console.log('Total matches:', matches.length);
console.log();
console.log('Por source:');
for (const [src, cnt] of Object.entries(bySource).sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${cnt.toString().padStart(4)} chunks  -  ${src}`);
}
