// Verifica actividad del Orquestador HOY desde las 11 AM CDMX
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

// Cálculo de 11 AM CDMX hoy → ISO UTC
const cdmxFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
const todayCdmx = cdmxFmt.format(new Date()); // YYYY-MM-DD
const elevenAmCdmxIso = `${todayCdmx}T11:00:00-06:00`;
const elevenAmUtcMs = new Date(elevenAmCdmxIso).getTime();
const nowMs = Date.now();
const hoursElapsed = ((nowMs - elevenAmUtcMs) / 3600000).toFixed(2);

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`  ORQUESTADOR — actividad desde ${elevenAmCdmxIso}`);
console.log(`  (hace ${hoursElapsed}h)`);
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Leads cuyo bot_last_msg_at se actualizó desde las 11 AM
const elevenAmUtcIso = new Date(elevenAmUtcMs).toISOString();
const { data: updated } = await supabase
  .from('leads')
  .select('contact_id, nombre, bot_full_name, telefono, stage_name, bot_stage, bot_last_msg_at, bot_followup_count, bot_skip_reason, bot_skip_at, eventos')
  .in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA'])
  .gte('bot_last_msg_at', elevenAmUtcIso)
  .order('bot_last_msg_at', { ascending: false });

console.log(`📊 Leads con bot_last_msg_at >= 11 AM hoy:`);
console.log(`   ${updated?.length || 0} leads escritos por el bot/orquestador\n`);

if ((updated?.length || 0) > 0) {
  for (const l of updated.slice(0, 10)) {
    const name = l.bot_full_name || l.nombre || '(sin nombre)';
    const lastMsgMin = Math.round((nowMs - new Date(l.bot_last_msg_at).getTime()) / 60000);
    const lastEvent = (l.eventos || []).slice(-1)[0];
    const ev = lastEvent ? `${lastEvent.tipo || '?'}/${lastEvent.direccion || '?'}` : 'sin eventos';
    console.log(`  ▸ ${name.padEnd(28)} hace ${lastMsgMin}min · followups=${l.bot_followup_count}/3 · último evento: ${ev}`);
  }
}

// 2. Leads con bot_skip_at desde 11 AM (decisión "skip" del Orquestador)
const { data: skipped } = await supabase
  .from('leads')
  .select('contact_id, nombre, bot_full_name, bot_skip_at, bot_skip_reason')
  .in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA'])
  .gte('bot_skip_at', elevenAmUtcIso);

console.log(`\n📊 Leads donde Orquestador decidió SKIP desde 11 AM:`);
console.log(`   ${skipped?.length || 0} skip decisions\n`);
if ((skipped?.length || 0) > 0) {
  for (const s of skipped.slice(0, 10)) {
    console.log(`  ⏭️  ${(s.bot_full_name || s.nombre).padEnd(28)} → ${s.bot_skip_reason || '(sin razón)'}`);
  }
}

// 3. Cuenta total de leads activos (potenciales targets del Orquestador)
const { count: activeLeads } = await supabase
  .from('leads')
  .select('contact_id', { count: 'exact', head: true })
  .in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA']);
console.log(`\n📊 Universo total leads en stages Bot IA: ${activeLeads}`);

// 4. Outbounds GHL hoy desde 11 AM en stages bot
console.log(`\n📊 Buscando outbounds GHL hoy >= 11 AM (puede ser bot, asesor o sistema):`);
const { data: leadsAll } = await supabase
  .from('leads')
  .select('contact_id, bot_full_name, nombre, telefono')
  .in('stage_name', ['Ingreso - Test Agent IA', 'Bot IA']);

let totalOut = 0, totalIn = 0;
const outsByLead = [];
for (const l of (leadsAll || []).slice(0, 20)) {
  try {
    const conv = await ghl.get('/conversations/search', { params: { contactId: l.contact_id, locationId: LOC, limit: 1 } });
    const c = conv.data?.conversations?.[0];
    if (!c) continue;
    const m = await ghl.get(`/conversations/${c.id}/messages`, { params: { limit: 30 } });
    const msgs = m.data?.messages?.messages || m.data?.messages || [];
    const real = msgs.filter(x => x.body && x.direction && !/^(Opportunity (updated|created|moved)|Tag added|Tag removed|Pipeline|Stage |\{ ?WA#|Nuevo Lead asignado|NO RESPONDE CANCELA)/i.test(x.body));
    const recentOut = real.filter(x => x.direction === 'outbound' && new Date(x.dateAdded).getTime() >= elevenAmUtcMs);
    const recentIn = real.filter(x => x.direction === 'inbound' && new Date(x.dateAdded).getTime() >= elevenAmUtcMs);
    totalOut += recentOut.length;
    totalIn += recentIn.length;
    if (recentOut.length > 0) {
      const name = l.bot_full_name || l.nombre;
      outsByLead.push({ name, count: recentOut.length, sample: recentOut[0].body?.slice(0, 80) });
    }
  } catch (err) { /* skip */ }
  await new Promise(r => setTimeout(r, 100));
}

console.log(`   Inbounds (lead escribió):  ${totalIn}`);
console.log(`   Outbounds (bot/asesor):   ${totalOut}`);
if (outsByLead.length > 0) {
  console.log(`\n  Outbounds detectados:`);
  for (const o of outsByLead.slice(0, 10)) {
    console.log(`    ▸ ${o.name.padEnd(28)} ${o.count}x · "${o.sample}"`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  VEREDICTO');
console.log('═══════════════════════════════════════════════════════════');
const dbWrites = (updated?.length || 0) + (skipped?.length || 0);
if (dbWrites > 0) {
  console.log(`  ✅ ORQUESTADOR ACTIVO — ${dbWrites} escrituras a Supabase desde 11 AM`);
} else if (totalOut > 0) {
  console.log(`  ⚠️  HAY OUTBOUNDS pero CERO escrituras de Orquestador a Supabase`);
  console.log(`     → los outbounds pueden ser de asesor humano, NO del bot`);
} else {
  console.log(`  🔴 ORQUESTADOR NO HA HECHO NADA visible desde 11 AM`);
  console.log(`     → cero escrituras a Supabase + cero outbounds nuevos`);
}
console.log('═══════════════════════════════════════════════════════════\n');
process.exit(0);
