import { NextRequest, NextResponse } from 'next/server';

const TRAINER_URL = process.env.TRAINER_URL || 'http://localhost:4000';

export async function GET() {
  try {
    const res = await fetch(`${TRAINER_URL}/api/config`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${TRAINER_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
