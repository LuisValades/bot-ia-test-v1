import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Lista de asesores reales del equipo Crediexpres.
// Fase 2.1: hardcoded con los 3 userIds reales de GHL.
// Fase 2.2: reemplazar por GET /users/search?locationId=X (requiere scope extra).
const ADVISORS = [
  {
    id: process.env.GHL_EFRAIN_USER_ID || 'I0fIEc9bpsKxNLu0k5On',
    name: 'Efrain Cárdenas',
    role: 'Ejecutivo Sr · Hipotecario + PyME',
    color: 'linear-gradient(135deg, oklch(0.72 0.14 240), oklch(0.68 0.15 290))'
  },
  {
    id: process.env.GHL_JONNY_USER_ID || 'tg0qr7cEMcUyZ5gYqj6G',
    name: 'Jonny',
    role: 'Ejecutivo · Hipotecario',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 160), oklch(0.72 0.15 200))'
  },
  {
    id: process.env.GHL_LUIS_USER_ID || '4lNyGpfB8Roa2XDJVpP9',
    name: 'Luis Valades',
    role: 'Broker · Owner',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 345), oklch(0.72 0.15 25))'
  }
];

export async function GET() {
  return NextResponse.json({ advisors: ADVISORS });
}
