/**
 * Festivos bancarios oficiales en México (CONDUSEF / Banco de México).
 * El bot NO ofrece slots en estos días — pregunta al lead qué día le sirve.
 *
 * Constitución (1er lunes feb), Benito Juárez (3er lunes mar) y
 * Revolución (3er lunes nov) ya están calculados por año.
 */

const TIMEZONE = 'America/Mexico_City';

export const FESTIVOS_BANCARIOS_MX = {
  // 2026
  '2026-01-01': 'Año Nuevo',
  '2026-02-02': 'Día de la Constitución',
  '2026-03-16': 'Natalicio de Benito Juárez',
  '2026-05-01': 'Día del Trabajo',
  '2026-09-16': 'Día de la Independencia',
  '2026-11-02': 'Día de Muertos',
  '2026-11-16': 'Día de la Revolución',
  '2026-12-25': 'Navidad',
  // 2027
  '2027-01-01': 'Año Nuevo',
  '2027-02-01': 'Día de la Constitución',
  '2027-03-15': 'Natalicio de Benito Juárez',
  '2027-05-01': 'Día del Trabajo',
  '2027-09-16': 'Día de la Independencia',
  '2027-11-02': 'Día de Muertos',
  '2027-11-15': 'Día de la Revolución',
  '2027-12-25': 'Navidad'
};

/** Devuelve YYYY-MM-DD en zona CDMX para una fecha dada. */
export function dateInCDMX(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

/** Day-of-week (0=dom, 6=sab) en CDMX. */
export function dowInCDMX(d = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

/** Hora y minuto en CDMX (24h). */
export function hourMinInCDMX(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(d).reduce((a, p) => ({ ...a, [p.type]: p.value }), {});
  return { hour: parseInt(parts.hour, 10), minute: parseInt(parts.minute, 10) };
}

/** Si hoy es festivo, devuelve el nombre. Si no, null. */
export function getTodayHolidayName(now = new Date()) {
  return FESTIVOS_BANCARIOS_MX[dateInCDMX(now)] || null;
}

/** Si una fecha cae en festivo, devuelve el nombre. */
export function getHolidayName(d) {
  return FESTIVOS_BANCARIOS_MX[dateInCDMX(d)] || null;
}

/**
 * Reglas de horario hábil para agendar:
 *  - Lun-Jue: 10:00 - 19:00
 *  - Vie:     10:00 - 16:00 (cutoff 4 PM)
 *  - Sáb/Dom: cerrado → siguiente lunes 14:00
 *  - Lunes:   primer slot 14:00
 *  - Festivo: cerrado todo el día
 */
export function isValidBookingSlot(iso) {
  const d = new Date(iso);
  if (getHolidayName(d)) return false;

  const dow = dowInCDMX(d);
  const { hour } = hourMinInCDMX(d);

  if (dow === 0 || dow === 6) return false;        // fin de semana
  if (dow === 1 && hour < 14) return false;        // lunes < 2pm
  if (dow === 5 && hour >= 16) return false;       // viernes ≥ 4pm
  if (hour < 10 || hour >= 19) return false;       // fuera 10-19
  return true;
}

/**
 * Razón por la que HOY no se puede agendar mismo día.
 * Útil para que el bot explique al lead.
 */
export function getOutOfHoursReason(now = new Date()) {
  const holiday = getTodayHolidayName(now);
  if (holiday) return { reason: 'holiday', label: holiday, mensaje: `Hoy es ${holiday} (festivo bancario), el equipo no atiende.` };

  const dow = dowInCDMX(now);
  if (dow === 0 || dow === 6) return { reason: 'weekend', label: 'fin de semana', mensaje: 'El equipo no atiende fines de semana, retoman el lunes a partir de las 2 PM.' };

  const { hour } = hourMinInCDMX(now);
  if (dow === 5 && hour >= 16) return { reason: 'friday-after-cutoff', label: 'viernes después de 4 PM', mensaje: 'Ya pasó el horario de atención del viernes, el equipo retoma el lunes a partir de las 2 PM.' };
  if (dow === 1 && hour < 14) return { reason: 'monday-before-2pm', label: 'lunes antes de 2 PM', mensaje: 'El equipo retoma actividades hoy lunes a partir de las 2 PM.' };
  if (hour < 10 || hour >= 19) return { reason: 'after-hours', label: 'fuera de horario', mensaje: 'Estamos fuera del horario de atención (10 AM a 7 PM).' };
  return null;
}
