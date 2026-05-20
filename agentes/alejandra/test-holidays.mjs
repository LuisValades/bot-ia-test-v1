// Test de la lógica de horario hábil + festivos
// node test-holidays.mjs

import {
  isValidBookingSlot, getOutOfHoursReason, getTodayHolidayName,
  getHolidayName, dateInCDMX, dowInCDMX, hourMinInCDMX
} from './src/holidays.js';

let failed = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); failed++; }
  else console.log('OK:', msg);
};

// Helper: construye Date con offset desde UTC para "hora CDMX". CDMX es UTC-6 (sin DST).
const cdmx = (y, m, d, h = 12, min = 0) => new Date(Date.UTC(y, m - 1, d, h + 6, min));

// --- Festivos ---
assert(getHolidayName(cdmx(2026, 1, 1)) === 'Año Nuevo', 'Año Nuevo 2026 detectado');
assert(getHolidayName(cdmx(2026, 5, 1)) === 'Día del Trabajo', 'Día del Trabajo 2026');
assert(getHolidayName(cdmx(2026, 11, 16)) === 'Día de la Revolución', 'Revolución 2026');
assert(getHolidayName(cdmx(2026, 12, 25)) === 'Navidad', 'Navidad 2026');
assert(getHolidayName(cdmx(2027, 2, 1)) === 'Día de la Constitución', 'Constitución 2027 (1er lunes feb)');
assert(getHolidayName(cdmx(2026, 6, 15)) === null, 'día normal no es festivo');

// --- Slot validity ---
// Martes 28 abr 2026, 11 AM CDMX → válido
assert(isValidBookingSlot(cdmx(2026, 4, 28, 11)) === true, 'martes 11am válido');
// Martes 28 abr 2026, 8 AM CDMX → fuera horario
assert(isValidBookingSlot(cdmx(2026, 4, 28, 8)) === false, 'martes 8am inválido (antes 10am)');
// Martes 28 abr 2026, 7:30 PM (19:30) → fuera horario
assert(isValidBookingSlot(cdmx(2026, 4, 28, 19, 30)) === false, 'martes 19:30 inválido (después 7pm)');
// Lunes 27 abr 2026, 10 AM → INVÁLIDO (lunes <2pm)
assert(isValidBookingSlot(cdmx(2026, 4, 27, 10)) === false, 'lunes 10am inválido (antes 2pm)');
// Lunes 27 abr 2026, 2 PM → válido
assert(isValidBookingSlot(cdmx(2026, 4, 27, 14)) === true, 'lunes 2pm válido');
// Lunes 27 abr 2026, 4 PM → válido
assert(isValidBookingSlot(cdmx(2026, 4, 27, 16)) === true, 'lunes 4pm válido');
// Viernes 1 may 2026 = FESTIVO (Día Trabajo)
assert(isValidBookingSlot(cdmx(2026, 5, 1, 11)) === false, 'viernes 1 may festivo bloqueado');
// Viernes 8 may 2026, 11 AM → válido
assert(isValidBookingSlot(cdmx(2026, 5, 8, 11)) === true, 'viernes 11am válido');
// Viernes 8 may 2026, 4 PM → INVÁLIDO (cutoff)
assert(isValidBookingSlot(cdmx(2026, 5, 8, 16)) === false, 'viernes 4pm inválido');
// Viernes 8 may 2026, 5 PM → INVÁLIDO
assert(isValidBookingSlot(cdmx(2026, 5, 8, 17)) === false, 'viernes 5pm inválido');
// Sábado 9 may 2026, 11 AM → INVÁLIDO
assert(isValidBookingSlot(cdmx(2026, 5, 9, 11)) === false, 'sábado inválido');
// Domingo 10 may 2026, 11 AM → INVÁLIDO
assert(isValidBookingSlot(cdmx(2026, 5, 10, 11)) === false, 'domingo inválido');

// --- getOutOfHoursReason ---
// Forzando "ahora" — en CDMX, 1 may 2026 es festivo (vie Día del Trabajo)
const r1 = getOutOfHoursReason(cdmx(2026, 5, 1, 11));
assert(r1?.reason === 'holiday', 'detecta festivo: ' + r1?.label);

// Sábado 9 may 2026 (cualquier hora)
const r2 = getOutOfHoursReason(cdmx(2026, 5, 9, 11));
assert(r2?.reason === 'weekend', 'detecta fin de semana');

// Viernes 8 may 4:30 PM
const r3 = getOutOfHoursReason(cdmx(2026, 5, 8, 16, 30));
assert(r3?.reason === 'friday-after-cutoff', 'detecta viernes después de 4pm');

// Lunes 27 abr 11 AM (antes de 2pm)
const r4 = getOutOfHoursReason(cdmx(2026, 4, 27, 11));
assert(r4?.reason === 'monday-before-2pm', 'detecta lunes antes de 2pm');

// Martes 28 abr 11 AM (en horario)
const r5 = getOutOfHoursReason(cdmx(2026, 4, 28, 11));
assert(r5 === null, 'martes 11am: dentro de horario, sin razón');

// Jueves 30 abr 8 PM (fuera horario)
const r6 = getOutOfHoursReason(cdmx(2026, 4, 30, 20));
assert(r6?.reason === 'after-hours', 'detecta after-hours fuera de 10-19');

// --- Helpers timezone ---
assert(dateInCDMX(cdmx(2026, 5, 1)) === '2026-05-01', 'dateInCDMX correcto');
assert(dowInCDMX(cdmx(2026, 5, 1)) === 5, 'viernes 1 may = dow 5');
assert(hourMinInCDMX(cdmx(2026, 5, 1, 14, 30)).hour === 14, 'hora CDMX correcta');

console.log(`\n${failed === 0 ? 'TODOS LOS TESTS PASARON' : failed + ' TESTS FALLARON'}`);
process.exit(failed === 0 ? 0 : 1);
