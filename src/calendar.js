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

const DAY_NAME_TO_DOW = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
  'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6
};

function slotHourMin(iso) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(iso)).reduce((a, p) => ({ ...a, [p.type]: p.value }), {});
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);
  return { hour: parseInt(parts.hour, 10), minute: parseInt(parts.minute, 10), dow };
}

export function tryMatchUserTimeToSlot(message, slots) {
  if (!message || !slots?.length) return null;
  const text = message.toLowerCase();

  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?|h|hrs?)?/i);
  if (!timeMatch) return null;
  let hour = parseInt(timeMatch[1], 10);
  const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const suffix = (timeMatch[3] || '').toLowerCase().replace(/\./g, '');
  const isPm = suffix === 'pm' || suffix === 'p';
  const isAm = suffix === 'am' || suffix === 'a';
  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;
  if (!isAm && !isPm) {
    if (hour >= 1 && hour <= 7) hour += 12;
  }
  if (hour < 0 || hour > 23) return null;

  let wantedDow = null;
  for (const [name, dow] of Object.entries(DAY_NAME_TO_DOW)) {
    if (text.includes(name)) { wantedDow = dow; break; }
  }

  let fallback = null;
  for (const iso of slots) {
    const { hour: sh, minute: sm, dow } = slotHourMin(iso);
    if (sh === hour && Math.abs(sm - minute) <= 5) {
      if (wantedDow === null || dow === wantedDow) return iso;
      if (!fallback) fallback = iso;
    }
  }
  return fallback;
}
