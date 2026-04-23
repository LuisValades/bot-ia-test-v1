import { NextResponse } from 'next/server';
import { ghlGet, getGhlConfig } from '@/lib/ghl-client';

export const dynamic = 'force-dynamic';

interface GhlUser {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  deleted?: boolean;
  roles?: { role?: string };
  profilePhoto?: string;
}

// Paleta determinística para colorear avatares por id
function colorFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, oklch(0.75 0.14 ${h}), oklch(0.68 0.15 ${(h + 60) % 360}))`;
}

function inferRole(u: GhlUser): string {
  if (u.roles?.role === 'admin') return 'Broker · Admin';
  return 'Ejecutivo · Crediexpres';
}

const FALLBACK = [
  {
    id: process.env.GHL_EFRAIN_USER_ID || 'I0fIEc9bpsKxNLu0k5On',
    name: 'Efrain Hernandez',
    role: 'Ejecutivo · Crediexpres',
    color: 'linear-gradient(135deg, oklch(0.72 0.14 240), oklch(0.68 0.15 290))'
  },
  {
    id: process.env.GHL_JONNY_USER_ID || 'tg0qr7cEMcUyZ5gYqj6G',
    name: 'Jonny Barrera',
    role: 'Ejecutivo · Crediexpres',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 160), oklch(0.72 0.15 200))'
  },
  {
    id: process.env.GHL_LUIS_USER_ID || '4lNyGpfB8Roa2XDJVpP9',
    name: 'Luis Valades',
    role: 'Broker · Admin',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 345), oklch(0.72 0.15 25))'
  },
  {
    id: '1bidsYzU1RyaoZ85s1I8',
    name: 'Saul Ramirez',
    role: 'Ejecutivo · Crediexpres',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 80), oklch(0.74 0.15 40))'
  }
];

export async function GET() {
  try {
    const { locationId } = getGhlConfig();
    const resp = await ghlGet<{ users: GhlUser[] }>(
      '/users/',
      { locationId },
      { version: '2021-07-28' }
    );
    const users = (resp.users || []).filter(u => !u.deleted);
    if (!users.length) throw new Error('GHL Users devolvió vacío');

    const advisors = users.map(u => ({
      id: u.id,
      name: u.name || `${u.firstName} ${u.lastName}`.trim(),
      role: inferRole(u),
      color: colorFromId(u.id),
      email: u.email,
      phone: u.phone
    }));

    return NextResponse.json({ advisors, source: 'ghl' });
  } catch (err: any) {
    console.warn('[ghl/advisors] fallback hardcoded porque:', err.message);
    return NextResponse.json({ advisors: FALLBACK, source: 'fallback', error: err.message });
  }
}
