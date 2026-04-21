export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const TRAINER_URL = process.env.TRAINER_URL || 'http://localhost:4000';

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agent');
  if (!agentId) return NextResponse.json({ error: 'agent requerido' }, { status: 400 });
  try {
    const res = await fetch(`${TRAINER_URL}/api/agents/${agentId}/knowledge-sections`, {
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent: agentId, file, slug, newBody } = body;
    if (!agentId) return NextResponse.json({ error: 'agent requerido' }, { status: 400 });

    const res = await fetch(`${TRAINER_URL}/api/agents/${agentId}/section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file, slug, newBody })
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
