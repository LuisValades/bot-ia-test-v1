import { getFreeSlots } from './ghl.js';

const TIMEZONE = process.env.BOT_TIMEZONE || 'America/Mexico_City';
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export async function getNextSlots({ daysAhead = 7, take = 6 } = {}) {
  const start = Date.now();
  const end = start + daysAhead * 24 * 60 * 60 * 1000;
  const all = await getFreeSlots({ startDate: start, endDate: end, timezone: TIMEZONE });
  return all.slice(0, take);
}

export function formatSlotEs(iso) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  const jsWeekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);
  const dia = DIAS[jsWeekday];
  const num = parseInt(parts.day, 10);
  const mes = MESES[parseInt(parts.month, 10) - 1];
  let h = parseInt(parts.hour, 10);
  const min = parts.minute;
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${dia} ${num} de ${mes} a las ${h}:${min}${ampm}`;
}

export function formatSlotsForLead(slots, max = 3) {
  return slots.slice(0, max).map(formatSlotEs).join(', ');
}

export function formatSlotPairs(slots, max = 6) {
  return slots.slice(0, max).map(iso => ({ human: formatSlotEs(iso), iso }));
}

export function findSlotMatch(requestedIso, availableSlots) {
  if (!requestedIso) return null;
  const target = new Date(requestedIso).getTime();
  for (const slot of availableSlots) {
    if (Math.abs(new Date(slot).getTime() - target) < 60000) return slot;
  }
  return null;
}
