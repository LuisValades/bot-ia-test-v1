export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const TRAINER_URL = process.env.TRAINER_URL || 'http://localhost:4000';

export async function GET() {
  try {
    const res = await fetch(`${TRAINER_URL}/api/metrics`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
