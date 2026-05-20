#!/usr/bin/env node
/**
 * CLI: seguimiento manual a leads del pipeline Hipotecario por stage.
 *
 * Modo PLAN (siempre primero, NUNCA envía):
 *   node src/index.js --plan --stage agente
 *   node src/index.js --plan --stage "Calificación Asesor"
 *
 * Modo APPLY (solo con plan ya generado):
 *   node src/index.js --apply runs/2026-04-30_18h00_calificacion-asesor.plan.json
 *   node src/index.js --apply runs/<plan>.plan.json --only marybella,rich
 *
 * Aliases de stage:
 *   agente              → Ingreso - Test Agent IA
 *   lead                → Ingreso
 *   calificacion-asesor → Calificación Asesor
 */
import { ghl, LOCATION_ID } from './clients.js';
import { resolveStageName, pullLeadsInStage } from './stage-pull.js';
import { evaluateLead } from './checks.js';
import { generateFollowupSMS } from './llm-message.js';
import { writePlanFile, writeApplyReport, printPlanToConsole, printApplyToConsole } from './reporter.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);

function getFlag(name, hasValue = true) {
  const idx = args.findIndex(a => a === `--${name}`);
  if (idx === -1) return null;
  if (!hasValue) return true;
  return args[idx + 1] || null;
}

const isPlan = args.includes('--plan');
const applyPath = (() => {
  const i = args.findIndex(a => a === '--apply');
  return i !== -1 ? args[i + 1] : null;
})();
const stageInput = getFlag('stage');
const onlyInput = getFlag('only');
const instructionInput = getFlag('instruction');

if (!isPlan && !applyPath) {
  console.error(`
Uso:
  --plan --stage <agente|lead|calificacion-asesor>   Genera plan (sin enviar)
  --apply <ruta-plan.json> [--only NOMBRE1,NOMBRE2]  Ejecuta envío del plan

Ejemplos:
  node src/index.js --plan --stage agente
  node src/index.js --plan --stage "Calificación Asesor" --instruction "Recordar que falta documentación"
  node src/index.js --apply runs/2026-04-30_18h00_agente.plan.json
  node src/index.js --apply runs/...plan.json --only marybella,rich
`);
  process.exit(1);
}

if (isPlan) {
  if (!stageInput) {
    console.error('❌ --plan requiere --stage <agente|lead|calificacion-asesor|nombre exacto>');
    process.exit(1);
  }
  await runPlan(stageInput, instructionInput);
} else {
  await runApply(applyPath, onlyInput);
}

async function runPlan(stageInput, instruction) {
  const stageName = resolveStageName(stageInput);
  console.log(`\n🔍 Buscando leads en stage "${stageName}" (Credito Hipotecario)...`);

  const leads = await pullLeadsInStage(stageName);
  console.log(`   ${leads.length} lead(s) en stage.\n`);

  if (leads.length === 0) {
    console.log('(nada que evaluar)');
    process.exit(0);
  }

  const eligible = [];
  const skipped = [];
  const errors = [];

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const name = lead.bot_full_name || lead.nombre || '(sin nombre)';
    const tag = `[${i + 1}/${leads.length}] ${name}`;
    process.stdout.write(`${tag} → `);

    try {
      const evalResult = await evaluateLead(lead);
      if (!evalResult.eligible) {
        process.stdout.write(`⏭️  ${evalResult.reason}\n`);
        skipped.push({
          contact_id: lead.contact_id,
          name,
          phone: lead.telefono,
          skip_reason: evalResult.reason,
          skip_check: evalResult.check
        });
        continue;
      }
      // Generar SMS
      process.stdout.write('✏️  generando SMS...');
      const sms = await generateFollowupSMS({
        lead,
        ghlMessages: evalResult.ghl_context?.messages || [],
        instruction
      });
      const profileFields = lead.bot_profile && typeof lead.bot_profile === 'object'
        ? Object.keys(lead.bot_profile).filter(k => lead.bot_profile[k] != null && lead.bot_profile[k] !== '').length
        : 0;
      const lastMsgDays = lead.bot_last_msg_at
        ? Math.round((Date.now() - new Date(lead.bot_last_msg_at).getTime()) / (24 * 3600 * 1000))
        : null;
      eligible.push({
        contact_id: lead.contact_id,
        name,
        phone: lead.telefono,
        bot_stage: lead.bot_stage,
        profile_fields: profileFields,
        last_msg_days: lastMsgDays,
        context: `bot_stage=${lead.bot_stage || 'null'} | perfil ${profileFields}/7 | ${lastMsgDays !== null ? `last bot msg hace ${lastMsgDays}d` : 'sin saludo bot'}`,
        sms_text: sms.text
      });
      process.stdout.write(` ✅\n`);
    } catch (err) {
      process.stdout.write(`❌ ${err.message}\n`);
      errors.push({ contact_id: lead.contact_id, name, error: err.message });
    }
  }

  const plan = {
    type: 'seguimiento-manual-hipotecarios',
    version: 1,
    created_at: new Date().toISOString(),
    pipeline: 'Credito Hipotecario',
    stage: stageName,
    instruction: instruction || null,
    total_in_stage: leads.length,
    eligible,
    skipped,
    errors
  };

  const fullPath = writePlanFile(plan);
  const filename = fullPath.split(/[\\/]/).pop();
  plan._filename = filename;
  printPlanToConsole(plan);
}

async function runApply(planPath, onlyCsv) {
  const abs = resolve(process.cwd(), planPath);
  if (!existsSync(abs)) {
    console.error(`❌ No existe el plan: ${planPath}`);
    process.exit(1);
  }
  const plan = JSON.parse(readFileSync(abs, 'utf-8'));
  if (plan.type !== 'seguimiento-manual-hipotecarios') {
    console.error(`❌ Archivo no es un plan válido (type=${plan.type})`);
    process.exit(1);
  }

  let toSend = plan.eligible;
  if (onlyCsv) {
    const wanted = onlyCsv.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    toSend = plan.eligible.filter(e =>
      wanted.some(w =>
        e.name.toLowerCase().includes(w) || e.contact_id.toLowerCase() === w
      )
    );
    console.log(`\n🎯 Filtro --only "${onlyCsv}" → ${toSend.length}/${plan.eligible.length} eligibles seleccionados.`);
    if (toSend.length === 0) {
      console.error('❌ Ningún lead matchea el filtro. Abort.');
      process.exit(1);
    }
  }

  console.log(`\n📤 Enviando ${toSend.length} SMS...\n`);

  const sent = [];
  const errors = [];

  for (let i = 0; i < toSend.length; i++) {
    const e = toSend[i];
    const tag = `[${i + 1}/${toSend.length}] ${e.name}`;
    process.stdout.write(`${tag} → `);
    try {
      const r = await ghl.post('/conversations/messages', {
        type: 'SMS',
        contactId: e.contact_id,
        message: e.sms_text
      });
      const ghlMessageId = r.data?.messageId || r.data?.message?.id || null;
      sent.push({
        contact_id: e.contact_id,
        name: e.name,
        phone: e.phone,
        sms_text: e.sms_text,
        ghl_message_id: ghlMessageId,
        sent_at: new Date().toISOString()
      });
      process.stdout.write(`✅\n`);
      // Throttle anti-baneo: 2s entre SMS
      await sleep(2000);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      process.stdout.write(`❌ ${msg}\n`);
      errors.push({ contact_id: e.contact_id, name: e.name, error: msg });
    }
  }

  const report = {
    type: 'seguimiento-manual-hipotecarios-apply',
    version: 1,
    created_at: new Date().toISOString(),
    plan_file: planPath,
    stage: plan.stage,
    sent,
    errors
  };

  const fullPath = writeApplyReport(report);
  const filename = fullPath.split(/[\\/]/).pop();
  report._filename = filename;
  printApplyToConsole(report);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
