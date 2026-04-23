import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Body {
  leadId: string;
  ghlContactId?: string;
  phone: string;
  sms: string;
  advisorId: string;
  channel?: 'sms' | 'whatsapp';
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!body.sms?.trim()) {
      return NextResponse.json({ error: 'SMS vacío' }, { status: 400 });
    }

    // FASE 2: llamar a GHL Conversations API real con GHL_API_TOKEN + locationId.
    // Por ahora log + ack para destrabar el UX.
    console.log('[ghl-send-sms] stub payload:', {
      leadId: body.leadId,
      ghlContactId: body.ghlContactId,
      phone: body.phone,
      channel: body.channel || 'sms',
      advisorId: body.advisorId,
      sms: body.sms
    });

    return NextResponse.json({
      ok: true,
      stubbed: true,
      sentAt: new Date().toISOString(),
      channel: body.channel || 'sms',
      preview: body.sms,
      note:
        'Stub local — en Fase 2 se conecta con GHL Conversations API y dispara el webhook con el leadId.'
    });
  } catch (err: any) {
    console.error('[ghl-send-sms] error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
