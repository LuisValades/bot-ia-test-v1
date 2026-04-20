import axios from 'axios';

const BASE = process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
const TOKEN = process.env.GHL_API_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const CALENDAR_ID = process.env.GHL_CALENDAR_ID;

function client(version = '2021-04-15') {
  return axios.create({
    baseURL: BASE,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Version: version,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
}

const ghlV1 = client('2021-04-15');
const ghlV2 = client('2021-07-28');

export async function sendSMS({ contactId, message }) {
  const { data } = await ghlV1.post('/conversations/messages', {
    type: 'SMS',
    contactId,
    message
  });
  return data;
}

export async function getContact(contactId) {
  const { data } = await ghlV2.get(`/contacts/${contactId}`);
  return data.contact;
}

export async function getUser(userId) {
  try {
    const { data } = await ghlV2.get(`/users/${userId}`);
    return data;
  } catch (err) {
    console.warn(`[ghl] getUser ${userId} falló:`, err.response?.data?.message || err.message);
    return null;
  }
}

export async function getFreeSlots({ startDate, endDate, timezone = 'America/Mexico_City' }) {
  const { data } = await ghlV1.get(
    `/calendars/${CALENDAR_ID}/free-slots`,
    { params: { startDate, endDate, timezone } }
  );
  const slots = [];
  for (const [date, info] of Object.entries(data)) {
    if (date === 'traceId' || !info?.slots) continue;
    for (const s of info.slots) slots.push(s);
  }
  return slots;
}

export async function createAppointment({ contactId, startTime, title, assignedUserId }) {
  const body = {
    calendarId: CALENDAR_ID,
    locationId: LOCATION_ID,
    contactId,
    startTime,
    title: title || 'Cita CrediExpres',
    appointmentStatus: 'confirmed'
  };
  if (assignedUserId) body.assignedUserId = assignedUserId;
  const { data } = await ghlV1.post('/calendars/events/appointments', body);
  return data;
}

export async function rescheduleAppointment({ appointmentId, startTime }) {
  const { data } = await ghlV1.put(
    `/calendars/events/appointments/${appointmentId}`,
    { calendarId: CALENDAR_ID, startTime, appointmentStatus: 'confirmed' }
  );
  return data;
}

export async function cancelAppointment(appointmentId) {
  const { data } = await ghlV1.put(
    `/calendars/events/appointments/${appointmentId}`,
    { calendarId: CALENDAR_ID, appointmentStatus: 'cancelled' }
  );
  return data;
}

export async function createContactNote({ contactId, body }) {
  const { data } = await ghlV2.post(`/contacts/${contactId}/notes`, { body });
  return data;
}
