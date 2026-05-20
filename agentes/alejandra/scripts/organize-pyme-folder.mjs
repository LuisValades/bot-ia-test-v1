// Crea folder "PYME Form 2026 Meta Ads" y mueve los 18 custom fields ahí.
// También borra el TEST_FOLDER que se creó durante el probing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname,'..','.env'),'utf8')
    .split(/\r?\n/).filter(l=>l&&!l.startsWith('#')&&l.includes('='))
    .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')];})
);

const BASE = env.GHL_BASE_URL;
const LOC = env.GHL_LOCATION_ID;
const TOKEN = env.GHL_API_TOKEN;
const headers = {
  Authorization: 'Bearer ' + TOKEN,
  Version: '2021-07-28',
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const FOLDER_NAME = 'PYME Form 2026 Meta Ads';

const PYME_FIELD_IDS = [
  'xqRGlM2CnMkRa8LClUNt', // Lead Score PYME
  'erAaxwJ9PRUJcbvU3ZCu', // Facturación mensual SAT
  'oftP58YctrOUmh5fmqsG', // Buró de Crédito
  'QCCMeDKTrX2miABPBXB1', // Urgencia capital
  'tf36r6iQq3DSsiXRkVgy', // Capital solicitado
  'xj2wqbJajtDsX2xEOuph', // Origen de ingresos
  'jxuRUqod79jY1qPO0NKq', // Giro del negocio
  'rS0e2layAjNEe3NqfOG2', // Antigüedad fiscal
  'qkGIpVVVEfmTDLOj2wKb', // CIEC del SAT
  'MsAL5jDKXSev9BL1Fy2m', // RFC del negocio
  'pOw74Tb5sWrsmLyLQUcH', // UTM Source
  '78yDFwS3okjo0NYtq7cC', // UTM Medium
  'z1CO4zDgMgH2Yaqh8kpw', // UTM Campaign
  '3bpO4R0iw509g7k6gMCS', // UTM Content
  'mXDKxMmeSmCCJQow102m', // fbclid
  'qAJcQAlxgEaDhy1Y1CLl', // gclid (Form)
  'ePSvMBAEimP9jWVE9dK8', // Landing URL
  'CEobh0CBUl4nEp65OpIe', // Referrer URL
];

const TEST_FOLDER_ID = 'RQg4Qpd8gyCtt1QM6Dyo';

async function api(method, url, body) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: r.status, data: json };
}

(async () => {
  // 1) Borrar TEST_FOLDER
  console.log('1) Borrando TEST_FOLDER...');
  const del = await api('DELETE', `${BASE}/locations/${LOC}/customFields/${TEST_FOLDER_ID}`);
  console.log(`   status=${del.status}  ${JSON.stringify(del.data).slice(0,150)}\n`);

  // 2) Crear folder real
  console.log(`2) Creando folder "${FOLDER_NAME}"...`);
  const create = await api('POST', `${BASE}/locations/${LOC}/customFields`, {
    name: FOLDER_NAME,
    model: 'contact',
    documentType: 'folder',
  });
  if (create.status >= 300) {
    console.log('   ❌ FAIL', create.status, JSON.stringify(create.data).slice(0,300));
    process.exit(1);
  }
  const folderId = create.data?.customFieldFolder?.id || create.data?.id;
  console.log(`   ✓ Folder creado: id=${folderId}\n`);

  // 3) Actualizar cada uno de los 18 fields con parentId = folderId
  console.log(`3) Moviendo 18 fields al folder ${folderId}...`);
  let ok = 0, fail = 0;
  for (const fieldId of PYME_FIELD_IDS) {
    // Necesitamos enviar el body que GHL acepta para PUT — investiguemos
    const r = await api('PUT', `${BASE}/locations/${LOC}/customFields/${fieldId}`, {
      parentId: folderId,
    });
    if (r.status >= 200 && r.status < 300) {
      console.log(`   ✓ ${fieldId} movido`);
      ok++;
    } else {
      console.log(`   ✗ ${fieldId} status=${r.status} ${JSON.stringify(r.data).slice(0,200)}`);
      fail++;
    }
    await new Promise((res) => setTimeout(res, 200));
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`Folder creado: ${folderId}`);
  console.log(`Fields movidos: ${ok}/${PYME_FIELD_IDS.length} (${fail} errores)`);

  // Update mapping JSON
  const mappingPath = path.resolve(__dirname, '..', 'pyme-customfields-mapping.json');
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  mapping.folderId = folderId;
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`\nMapping actualizado en pyme-customfields-mapping.json`);
})();
