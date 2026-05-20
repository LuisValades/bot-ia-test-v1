// Crea folder "PYME Form 2026 Meta Ads" + custom fields del form PYME en GHL.
// Idempotente: si el folder o un campo ya existen, los reusa/skipea.
//
// Uso:
//   cd "c:/01_ANTIGRAVITY PROYECTOS/BOT GHL/agentes/alejandra"
//   node scripts/create-pyme-customfields.mjs

import fs from 'node:fs';
import path from 'node:path';

// ----- Cargar .env manualmente (no requerimos dotenv) -----
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');
const envText = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const LOCATION_ID = env.GHL_LOCATION_ID;
const TOKEN = env.GHL_API_TOKEN;
const BASE = env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28'; // versión que soporta customFields v2

if (!LOCATION_ID || !TOKEN) {
  console.error('Faltan GHL_LOCATION_ID / GHL_API_TOKEN en .env');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Version': API_VERSION,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

const FOLDER_NAME = 'PYME Form 2026 Meta Ads';

// Definición de los custom fields
const FIELDS = [
  // CRÍTICOS
  { name: 'Lead Score PYME', dataType: 'NUMERICAL', placeholder: '0-110' },
  {
    name: 'Facturación mensual SAT',
    dataType: 'SINGLE_OPTIONS',
    options: ['$500K – $1M', '$1M – $3M', 'Más de $3M'],
  },
  {
    name: 'Buró de Crédito',
    dataType: 'SINGLE_OPTIONS',
    options: ['Sano (sin atrasos 12m)', 'Atraso menor al corriente', 'No estoy seguro'],
  },
  {
    name: 'Urgencia capital',
    dataType: 'SINGLE_OPTIONS',
    options: ['Lo necesito ya', 'Próximo mes', 'Estoy explorando opciones'],
  },
  {
    name: 'Capital solicitado',
    dataType: 'SINGLE_OPTIONS',
    options: ['Menos de $500K', '$500K – $2M', '$2M – $5M', '$5M – $10M'],
  },

  // ÚTILES
  {
    name: 'Origen de ingresos',
    dataType: 'SINGLE_OPTIONS',
    options: [
      'Terminal punto de venta (TPV)',
      'SPEI / depósitos bancarios',
      'Facturación CFDI',
      'Combinación de las anteriores',
    ],
  },
  {
    name: 'Giro del negocio',
    dataType: 'SINGLE_OPTIONS',
    options: [
      'Retail / comercio',
      'Salud y consultorios',
      'Alimentos y restaurantes',
      'Servicios profesionales',
      'Belleza y bienestar',
      'Refacciones, maquinaria o construcción',
      'Gasolineras y servicios automotrices',
      'Otro',
    ],
  },
  {
    name: 'Antigüedad fiscal',
    dataType: 'SINGLE_OPTIONS',
    options: ['Menos de 1 año', '1 – 2 años', '2 – 5 años', 'Más de 5 años'],
  },
  {
    name: 'CIEC del SAT',
    dataType: 'SINGLE_OPTIONS',
    options: ['Sí, la tengo y sé dónde está', 'Sí, pero no la recuerdo', 'No tengo CIEC activa'],
  },
  { name: 'RFC del negocio', dataType: 'TEXT', placeholder: 'XAXX010101000' },

  // TRACKING
  { name: 'UTM Source', dataType: 'TEXT', placeholder: 'facebook, google...' },
  { name: 'UTM Medium', dataType: 'TEXT', placeholder: 'cpc, organic...' },
  { name: 'UTM Campaign', dataType: 'TEXT', placeholder: 'pyme-mayo-2026' },
  { name: 'UTM Content', dataType: 'TEXT', placeholder: 'creative ID' },
  { name: 'fbclid', dataType: 'TEXT', placeholder: '' },
  { name: 'gclid (Form)', dataType: 'TEXT', placeholder: '' }, // 'gclid' choca con standard field — renombrado
  { name: 'Landing URL', dataType: 'TEXT', placeholder: '' },
  { name: 'Referrer URL', dataType: 'TEXT', placeholder: '' },
];

// ----- Helpers HTTP -----
async function ghlGet(url) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: r.status, data: json };
}
async function ghlPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: r.status, data: json };
}

// ----- Listar custom fields (para idempotencia) -----
async function listCustomFields() {
  const url = `${BASE}/locations/${LOCATION_ID}/customFields?model=contact`;
  const { status, data } = await ghlGet(url);
  if (status >= 200 && status < 300) {
    return data?.customFields || [];
  }
  console.warn('[listCustomFields] status', status, JSON.stringify(data).slice(0, 200));
  return [];
}

// ----- Crear folder -----
async function ensureFolder(name) {
  // GHL no expone listado directo de folders. Lo creamos siempre — si ya existe responde 4xx con código específico.
  const url = `${BASE}/locations/${LOCATION_ID}/customFields/folder`;
  const body = { name, model: 'contact' };
  const { status, data } = await ghlPost(url, body);
  if (status >= 200 && status < 300) {
    const id = data?.id || data?.folder?.id || data?._id;
    console.log(`✓ Folder "${name}" creado: id=${id}`);
    return id;
  }
  // Si ya existe, intentar parsear el id del error
  console.warn(`[folder] status ${status}: ${JSON.stringify(data).slice(0, 240)}`);
  return null;
}

// ----- Crear field individual -----
async function createField(field, folderId) {
  const url = `${BASE}/locations/${LOCATION_ID}/customFields`;
  const body = {
    name: field.name,
    dataType: field.dataType,
    placeholder: field.placeholder || '',
    model: 'contact',
  };
  if (folderId) body.parentId = folderId;
  if (field.options) body.options = field.options;

  const { status, data } = await ghlPost(url, body);
  if (status >= 200 && status < 300) {
    const id = data?.id || data?.customField?.id || data?._id;
    console.log(`  ✓ "${field.name}" → ${id}`);
    return { ok: true, id, name: field.name, dataType: field.dataType };
  }
  console.log(`  ✗ "${field.name}" status=${status} ${JSON.stringify(data).slice(0, 240)}`);
  return { ok: false, name: field.name, error: data };
}

// ----- Main -----
(async () => {
  console.log(`\n=== GHL Custom Fields Setup — ${FOLDER_NAME} ===`);
  console.log(`Location: ${LOCATION_ID}\n`);

  // 1) Snapshot inicial de fields existentes
  const existing = await listCustomFields();
  const existingNames = new Set(existing.map((f) => (f.name || '').toLowerCase().trim()));
  console.log(`Custom fields existentes en location: ${existing.length}\n`);

  // 2) Crear folder
  const folderId = await ensureFolder(FOLDER_NAME);

  // 3) Crear cada field (skip si ya existe por nombre)
  console.log(`\nCreando ${FIELDS.length} custom fields...\n`);
  const results = [];
  for (const f of FIELDS) {
    if (existingNames.has(f.name.toLowerCase().trim())) {
      const matched = existing.find((x) => (x.name || '').toLowerCase().trim() === f.name.toLowerCase().trim());
      console.log(`  ↺ "${f.name}" ya existía → ${matched?.id}`);
      results.push({ ok: true, id: matched?.id, name: f.name, skipped: true });
      continue;
    }
    const r = await createField(f, folderId);
    results.push(r);
    // pequeño delay para no rate-limitearnos
    await new Promise((r2) => setTimeout(r2, 250));
  }

  // 4) Imprimir mapa final id↔name (lo que va al script del webhook)
  const mapping = {};
  for (const r of results) if (r.ok) mapping[r.name] = r.id;
  fs.writeFileSync(
    path.resolve(process.cwd(), 'pyme-customfields-mapping.json'),
    JSON.stringify({ folderId, fields: mapping }, null, 2)
  );

  console.log('\n=== RESUMEN ===');
  console.log(`OK:      ${results.filter((r) => r.ok).length}`);
  console.log(`Errores: ${results.filter((r) => !r.ok).length}`);
  console.log(`\nMapping guardado en: pyme-customfields-mapping.json`);
})();
