import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(__dirname, '..', 'runs');

if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });

function nowSlug() {
  const d = new Date();
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D}_${h}h${m}`;
}

function stageSlug(stageName) {
  return String(stageName || 'unknown')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function writePlanFile(plan) {
  const filename = `${nowSlug()}_${stageSlug(plan.stage)}.plan.json`;
  const fullPath = join(RUNS_DIR, filename);
  writeFileSync(fullPath, JSON.stringify(plan, null, 2), 'utf-8');
  return fullPath;
}

export function writeApplyReport(report) {
  const filename = `${nowSlug()}_${stageSlug(report.stage)}.apply.json`;
  const fullPath = join(RUNS_DIR, filename);
  writeFileSync(fullPath, JSON.stringify(report, null, 2), 'utf-8');
  return fullPath;
}

export function printPlanToConsole(plan) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  PLAN — Stage "${plan.stage}" (Pipeline ${plan.pipeline})`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total leads en stage:  ${plan.total_in_stage}`);
  console.log(`  ✅ Eligibles para SMS: ${plan.eligible.length}`);
  console.log(`  ⏭️  Saltados:           ${plan.skipped.length}`);
  console.log(`  ❌ Errores:            ${plan.errors.length}`);
  console.log('───────────────────────────────────────────────────────────');

  if (plan.eligible.length > 0) {
    console.log('\n────── ELIGIBLES ──────');
    plan.eligible.forEach((e, i) => {
      console.log(`\n${i + 1}. ${e.name} · ${e.phone}`);
      console.log(`   contact_id: ${e.contact_id}`);
      console.log(`   contexto:   ${e.context}`);
      console.log(`   SMS:        "${e.sms_text}"`);
    });
  }

  if (plan.skipped.length > 0) {
    console.log('\n────── SALTADOS ──────');
    plan.skipped.forEach(s => {
      console.log(`  ⏭️  ${s.name} → ${s.skip_reason}`);
    });
  }

  if (plan.errors.length > 0) {
    console.log('\n────── ERRORES ──────');
    plan.errors.forEach(e => {
      console.log(`  ❌ ${e.name || e.contact_id}: ${e.error}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Plan guardado en: runs/${plan._filename}`);
  console.log('  Para enviar:');
  console.log(`    node src/index.js --apply runs/${plan._filename}`);
  console.log('  Para enviar solo algunos:');
  console.log(`    node src/index.js --apply runs/${plan._filename} --only NAME1,NAME2`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

export function printApplyToConsole(report) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  RESULTADO ENVÍO — Stage "${report.stage}"`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ✅ SMS enviados:  ${report.sent.length}`);
  console.log(`  ❌ Errores:       ${report.errors.length}`);
  console.log('───────────────────────────────────────────────────────────');

  if (report.sent.length > 0) {
    console.log('\n────── ENVIADOS ──────');
    report.sent.forEach(s => {
      console.log(`  ✅ ${s.name} · ${s.phone} → ghl_message_id: ${s.ghl_message_id || '(s/id)'}`);
    });
  }

  if (report.errors.length > 0) {
    console.log('\n────── ERRORES ──────');
    report.errors.forEach(e => {
      console.log(`  ❌ ${e.name || e.contact_id}: ${e.error}`);
    });
  }

  console.log(`\n  Reporte guardado: runs/${report._filename}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}
