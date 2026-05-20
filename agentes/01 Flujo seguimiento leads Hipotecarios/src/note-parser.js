// Detector de fechas/citas/instrucciones en notas GHL.
// Si UNA nota contiene cualquiera de estos patrones → SKIP automático.

const DAYS = /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)\b/i;
const MONTHS = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i;
const DATE_PATTERNS = [
  /\bel\s+\d{1,2}\b/i,
  /\bd[ií]a\s+\d{1,2}\b/i,
  /\b\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i,
  /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/,
  /\b(ma[ñn]ana|pasado\s+ma[ñn]ana|pr[óo]xima\s+semana|hoy)\b/i,
  /\b(agendad[oa]|programad[oa]|cita\s+(?:el|para)|llamar\s+(?:el|en)|contactar\s+(?:el|en)|verlo\s+(?:el|en)|reagendar)/i
];

const NEGATIVE_INSTRUCTIONS = /\b(no\s+contactar|no\s+insistir|no\s+escribir|no\s+llamar|ya\s+(?:cerr[óo]|no\s+quiere|no\s+est[áa]\s+interesad)|cliente\s+cerrado|caso\s+cerrado|baja\s+definitiva|no\s+volv(?:er|amos))\b/i;

const HOUR_PATTERNS = [
  /\b\d{1,2}\s*(?::\d{2})?\s*(am|pm|hrs?|h)\b/i,
  /\b\d{1,2}\s+de\s+la\s+(ma[ñn]ana|tarde|noche)\b/i
];

export function analyzeNote(noteBody) {
  if (!noteBody || typeof noteBody !== 'string') return { match: null };
  const text = noteBody.toLowerCase();

  if (NEGATIVE_INSTRUCTIONS.test(text)) {
    return { match: 'instruccion_negativa', detail: extractContext(text, NEGATIVE_INSTRUCTIONS) };
  }
  if (DAYS.test(text)) {
    return { match: 'dia_semana', detail: extractContext(text, DAYS) };
  }
  if (MONTHS.test(text)) {
    return { match: 'mes_calendario', detail: extractContext(text, MONTHS) };
  }
  for (const rx of DATE_PATTERNS) {
    if (rx.test(text)) return { match: 'fecha_explicita', detail: extractContext(text, rx) };
  }
  for (const rx of HOUR_PATTERNS) {
    if (rx.test(text)) return { match: 'hora_explicita', detail: extractContext(text, rx) };
  }
  return { match: null };
}

function extractContext(text, regex) {
  const m = text.match(regex);
  if (!m) return '';
  const idx = m.index || 0;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + (m[0]?.length || 0) + 40);
  return '…' + text.slice(start, end).replace(/\s+/g, ' ').trim() + '…';
}

/**
 * Analiza un array de notas. Devuelve la PRIMERA que dispare un match.
 * Las notas vienen de getContactNotes (GHL).
 */
export function findBlockingNote(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return null;
  for (const n of notes) {
    const body = n.body || n.note || '';
    const result = analyzeNote(body);
    if (result.match) {
      return {
        match: result.match,
        detail: result.detail,
        body: body.slice(0, 200),
        createdAt: n.dateAdded || n.createdAt || n.createdAtStr || null
      };
    }
  }
  return null;
}
