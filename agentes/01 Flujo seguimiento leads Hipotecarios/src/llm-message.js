import { openrouter, LLM_MODEL } from './clients.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = resolve(__dirname, '..', '..', '..', '00_ KNOWLEDGE-PLAYBOOKS - AGENT ALEJANDRA', 'KNOWLOGE + PLAYBOOKS 28.04.26');

let cachedSystemPrompt = null;
function loadAlejandraPrompt() {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  if (!existsSync(KNOWLEDGE_DIR)) {
    throw new Error(`KNOWLEDGE_DIR no encontrado: ${KNOWLEDGE_DIR}`);
  }
  const files = readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md')).sort();
  const parts = files.map(f => {
    const content = readFileSync(join(KNOWLEDGE_DIR, f), 'utf-8');
    return `<!-- ===== ${f} ===== -->\n${content}`;
  });
  cachedSystemPrompt = parts.join('\n\n');
  return cachedSystemPrompt;
}

function formatHistory(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '(sin historial previo)';
  const sorted = [...messages].sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
  return sorted.slice(-15).map(m => {
    const dir = m.direction === 'inbound' ? 'LEAD' : 'BOT/ASESOR';
    const body = (m.body || '(sin texto)').replace(/\s+/g, ' ').slice(0, 300);
    const fecha = m.dateAdded ? new Date(m.dateAdded).toISOString().slice(0, 16).replace('T', ' ') : '';
    return `[${fecha}] ${dir}: ${body}`;
  }).join('\n');
}

function summarizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return '(sin perfil)';
  const filled = Object.entries(profile).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (filled.length === 0) return '(perfil vacío)';
  return filled.map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
}

/**
 * Genera UN SMS de seguimiento manual para el lead, usando identidad Alejandra.
 * Devuelve {text, model, usage} o lanza error si falla.
 */
export async function generateFollowupSMS({ lead, ghlMessages, instruction }) {
  const systemPrompt = loadAlejandraPrompt();
  const leadName = lead.bot_full_name || lead.nombre || 'lead';
  const firstName = String(leadName).split(' ')[0];
  const stageName = lead.stage_name || '';
  const profile = summarizeProfile(lead.bot_profile);
  const history = formatHistory(ghlMessages);
  const lastOutbound = (ghlMessages || []).filter(m => m.direction === 'outbound').slice(-1)[0];
  const lastInbound = (ghlMessages || []).filter(m => m.direction === 'inbound').slice(-1)[0];
  const lastInboundAge = lastInbound?.dateAdded
    ? Math.round((Date.now() - new Date(lastInbound.dateAdded).getTime()) / (24 * 3600 * 1000))
    : null;
  const lastOutboundAge = lastOutbound?.dateAdded
    ? Math.round((Date.now() - new Date(lastOutbound.dateAdded).getTime()) / (24 * 3600 * 1000))
    : null;

  const taskBrief = `[TAREA: SEGUIMIENTO MANUAL]
Stage GHL del lead: ${stageName}
Nombre: ${firstName} (completo: ${leadName})
Perfil capturado: ${profile}
Última actividad (mensaje del lead): ${lastInboundAge !== null ? `hace ${lastInboundAge} días` : 'nunca respondió'}
Último mensaje del bot/asesor: ${lastOutboundAge !== null ? `hace ${lastOutboundAge} días` : 'nunca le escribimos'}

HISTORIAL DE LA CONVERSACIÓN (últimos 15 mensajes):
${history}

INSTRUCCIÓN ADICIONAL DEL OPERADOR HUMANO: ${instruction || '(ninguna — sigue el criterio normal)'}

GENERA UN SMS DE SEGUIMIENTO con estas reglas DURAS:
1. UNA o DOS frases. Máximo 2 frases. Cero relleno.
2. Tono cálido, natural, NO agresivo, NO comercial.
3. NUNCA inventes fechas, días de la semana, meses ni horas (regla §0.3 del system prompt).
4. NO reciclas info ya dada. Si la conversación se quedó pausada en una pregunta, retómala suave.
5. Si nunca respondió, salúdalo de nuevo identificándote ("soy Alejandra del equipo de Crediexpres").
6. Si ya tenía cuestionario empezado, retoma el punto donde quedó SIN repetir lo ya capturado.
7. Si ya estaba en cierre con asesor, refuerza: "Tu asesor te contactará en las próximas horas, ¿sigue en pie?".
8. Cierra con UNA pregunta abierta corta (no listas de opciones numeradas).
9. NO uses emojis. NO uses asteriscos.
10. NO firmes con nombre — el SMS sale del número de Alejandra.
11. PROHIBIDO empezar con "Hey" o usar "Hey {nombre}" en cualquier parte del mensaje. Alternativas válidas: "Hola {nombre}", "Va, {nombre}", "Sigo aquí", "Te escribo para retomar". El bot mexicano no dice "Hey".

DEVUELVE SOLO EL TEXTO DEL SMS. Nada más. Sin comillas. Sin etiquetas. Sin explicaciones.`;

  const res = await openrouter.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: taskBrief }
    ],
    max_tokens: 200,
    temperature: 0.5
  }, { timeout: 60000 });

  const raw = res.choices?.[0]?.message?.content || '';
  const text = raw.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
  if (!text) throw new Error('LLM devolvió texto vacío');

  return {
    text,
    model: res.model,
    usage: res.usage
  };
}
