const GHL_BASE_URL = process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = process.env.GHL_API_VERSION || '2021-04-15';

export function getGhlConfig() {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    throw new Error(
      'Faltan env vars GHL_API_TOKEN y/o GHL_LOCATION_ID en el dashboard (Vercel o .env.local).'
    );
  }
  return { token, locationId };
}

function ghlHeaders(token: string, version?: string) {
  return {
    Authorization: `Bearer ${token}`,
    Version: version || GHL_API_VERSION,
    Accept: 'application/json'
  };
}

export async function ghlGet<T = any>(
  path: string,
  query?: Record<string, string | number | undefined>,
  opts?: { version?: string }
): Promise<T> {
  const { token } = getGhlConfig();
  const url = new URL(`${GHL_BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: ghlHeaders(token, opts?.version),
    cache: 'no-store'
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GHL GET ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function ghlPost<T = any>(path: string, body: any, opts?: { version?: string }): Promise<T> {
  const { token } = getGhlConfig();
  const res = await fetch(`${GHL_BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...ghlHeaders(token, opts?.version), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GHL POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export interface GhlConversation {
  id: string;
  contactId: string;
  locationId: string;
  lastMessageBody?: string;
  lastMessageType?: string;
  lastMessageDirection?: 'inbound' | 'outbound';
  lastMessageDate?: string;
  unreadCount?: number;
  fullName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  tags?: string[];
  assignedTo?: string;
}

export interface GhlMessage {
  id: string;
  type: number;
  messageType?: string;
  locationId?: string;
  contactId?: string;
  conversationId?: string;
  dateAdded?: string;
  body?: string;
  direction?: 'inbound' | 'outbound';
  source?: string;
  userId?: string;
}

// Message types from GHL:
// 1 = call, 3 = email, 11 = whatsapp, 18 = instagram DM,
// 20 = custom SMS (outbound nuestro), 37 = internal comment
export const SMS_MESSAGE_TYPES = new Set([20, 11, 18]);
