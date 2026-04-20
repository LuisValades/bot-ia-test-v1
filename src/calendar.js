import { getFreeSlots } from './ghl.js';

const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export async function getNextSlots({ daysAhead = 7, take = 6 } = {}) {
  const start = Date.now();
  const end = start + daysAhead * 24 * 60 * 60 * 1000;
  const all = await getFreeSlots({ startDate: start, endDate: end });
  return all.slice(0, take);
}

export function formatSlotEs(iso) {
  const d = new Date(iso);
  const dia = DIAS[d.getDay()];
  const num = d.getDate();
  const mes = MESES[d.getMonth()];
  let h = d.getHours();
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${dia} ${num} de ${mes} a las ${h}:${min}${ampm}`;
}

export function formatSlotsForLead(slots, max = 3) {
  return slots.slice(0, max).map(formatSlotEs).join(', ');
}

export function findSlotMatch(requestedIso, availableSlots) {
  if (!requestedIso) return null;
  const target = new Date(requestedIso).getTime();
  for (const slot of availableSlots) {
    if (Math.abs(new Date(slot).getTime() - target) < 60000) return slot;
  }
  return null;
}
