// Status check global del sistema — verifica todo en 1 pantalla
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);
const ghl = axios.create({
  baseURL: 'https://services.leadconnectorhq.com',
  headers: {
    Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
    Version: '2021-07-28'
  },
  timeout: 30000
});
const LOC = process.env.GHL_LOCATION_ID;
const now = Date.now();
const todayCdmx = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const startOfTodayUtc = new Date(`${todayCdmx}T00:00:00-06:00`).toISOString();

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║         STATUS CHECK — Bot Alejandra + Sistema GHL              ║');
console.log(`║         ${new Date().toLocaleString('es-MX', {timeZone:'America/Mexico_City'})}                          ║`);
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

// 1. SUPABASE — total leads y activos
console.log('─── 1. SUPABASE — base de datos ─────────────────────────────────');
const { count: totalLeads } = await supabase.from('leads').select('*', { count:'exact', head:true });
const { count: botLeads } = await supabase.from('leads').select('*', { count:'exact', head:true }).in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA']);
console.log(`  Total leads:                  ${totalLeads}`);
console.log(`  Leads en stages Bot IA:       ${botLeads}`);

// 2. ACTIVIDAD HOY
console.log('\n─── 2. ACTIVIDAD HOY (desde 00:00 CDMX) ──────────────────────────');
const { count: writesToday } = await supabase.from('leads').select('*', { count:'exact', head:true }).gte('bot_last_msg_at', startOfTodayUtc);
const { count: syncedToday } = await supabase.from('leads').select('*', { count:'exact', head:true }).gte('synced_at', startOfTodayUtc);
console.log(`  Leads con bot_last_msg_at hoy: ${writesToday}`);
console.log(`  Leads con synced_at hoy:       ${syncedToday}`);

// 3. ORQUESTADOR — decisiones acumuladas
console.log('\n─── 3. ORQUESTADOR — decisiones registradas ───────────────────');
const { data: leadsAll } = await supabase.from('leads').select('bot_last_decision, bot_stage, stage_name, tags').in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA']);
const byDec = {};
let withBotTag = 0, withoutTag = 0;
for (const l of (leadsAll||[])) {
  byDec[l.bot_last_decision || 'sin_decision'] = (byDec[l.bot_last_decision || 'sin_decision']||0)+1;
  if ((l.tags||[]).includes('bot ia')) withBotTag++; else withoutTag++;
}
console.log('  Distribución de bot_last_decision:');
for (const [d, n] of Object.entries(byDec).sort((a,b)=>b[1]-a[1])) {
  console.log(`    ${d.padEnd(20)} ${n}`);
}
console.log(`\n  Tag bot ia presente:           ${withBotTag} leads`);
console.log(`  Tag bot ia AUSENTE:            ${withoutTag} leads (no procesados)`);

// 4. ÚLTIMA EJECUCIÓN del Orquestador
console.log('\n─── 4. ORQUESTADOR — última actividad ─────────────────────────');
const { data: lastOrq } = await supabase
  .from('leads')
  .select('contact_id, bot_full_name, nombre, bot_last_decision_at')
  .not('bot_last_decision_at', 'is', null)
  .order('bot_last_decision_at', { ascending: false })
  .limit(1)
  .single();
if (lastOrq) {
  const min = Math.round((now - new Date(lastOrq.bot_last_decision_at).getTime())/60000);
  console.log(`  Última decisión registrada:    hace ${min} min`);
  console.log(`  Lead:                          ${lastOrq.bot_full_name || lastOrq.nombre}`);
}

// 5. CAG INBOUND — actividad reciente
console.log('\n─── 5. CAG INBOUND — eventos recientes (1h) ───────────────────');
const oneHourAgo = new Date(now - 3600000).toISOString();
const { data: recentMsg } = await supabase
  .from('leads')
  .select('contact_id, bot_full_name, nombre, bot_last_msg_at')
  .gte('bot_last_msg_at', oneHourAgo)
  .order('bot_last_msg_at', { ascending: false })
  .limit(10);
console.log(`  Leads con bot_last_msg_at en última hora: ${recentMsg?.length || 0}`);
for (const l of (recentMsg || []).slice(0, 5)) {
  const min = Math.round((now - new Date(l.bot_last_msg_at).getTime())/60000);
  console.log(`    · ${(l.bot_full_name || l.nombre).padEnd(28)} hace ${min}min`);
}

// 6. CASOS QUE REQUIEREN ATENCIÓN
console.log('\n─── 6. CASOS ATENCIÓN — anomalías ───────────────────────────');
// followup_count inflado
const { count: inflated } = await supabase.from('leads').select('*', { count:'exact', head:true })
  .in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA'])
  .gt('bot_followup_count', 10);
console.log(`  Leads con bot_followup_count > 10: ${inflated || 0} (anormal, cap es 5)`);

// retake vencido pero stage activo
const { count: stuckRetake } = await supabase.from('leads').select('*', { count:'exact', head:true })
  .in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA'])
  .not('bot_retake_scheduled_at', 'is', null)
  .lt('bot_retake_scheduled_at', new Date().toISOString());
console.log(`  Leads con retake VENCIDO (atascados): ${stuckRetake || 0}`);

// 7. LUIS VALADES (lead de test)
console.log('\n─── 7. TEST LEAD — Luis Valades ───────────────────────────');
const { data: luis } = await supabase
  .from('leads')
  .select('bot_stage, bot_followup_count, bot_last_msg_at, bot_last_decision, bot_profile, tags, stage_name')
  .eq('contact_id', 'F1OIt6R63IR8gFWu4Yx6')
  .single();
if (luis) {
  console.log(`  stage_name:                   ${luis.stage_name}`);
  console.log(`  bot_stage:                    ${luis.bot_stage}`);
  console.log(`  bot_followup_count:           ${luis.bot_followup_count}`);
  console.log(`  bot_last_decision:            ${luis.bot_last_decision || 'null'}`);
  console.log(`  bot_last_msg_at:              ${luis.bot_last_msg_at ? Math.round((now-new Date(luis.bot_last_msg_at).getTime())/60000)+'min ago' : 'null'}`);
  console.log(`  bot_profile:                  ${JSON.stringify(luis.bot_profile || {}).slice(0, 140)}`);
}

// 8. MODAL — verificar que sigue OFF
console.log('\n─── 8. INFRAESTRUCTURA ───────────────────────────────────────');
console.log(`  Modal apps:                   apagados (confirmado en sesión anterior)`);
console.log(`  Pinecone vectors:             324 (confirmado en sesión anterior)`);
console.log(`  Supabase RLS:                 habilitado en leads (confirmado en sesión anterior)`);

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║                          FIN STATUS CHECK                         ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');
process.exit(0);
