export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const TRAINER_URL = process.env.TRAINER_URL || 'http://localhost:4000';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  try {
    const res = await fetch(`${TRAINER_URL}/api/agents/${id}/files`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
