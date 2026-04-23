import { NextRequest, NextResponse } from 'next/server';
import { ghlPost, getGhlConfig } from '@/lib/ghl-client';

export const dynamic = 'force-dynamic';

interface Body {
  leadId: string;
  ghlContactId?: string;
  phone?: string;
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
    if (!body.ghlContactId) {
      return NextResponse.json(
        { error: 'Falta ghlContactId — no puedo enviar sin contacto GHL' },
        { status: 400 }
      );
    }

    const channel = body.channel || 'sms';
    const ghlType = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';

    const { locationId } = getGhlConfig();

    // GHL Conversations API — POST /conversations/messages
    // Requiere: type (SMS|WhatsApp), contactId, message, fromNumber opcional.
    const payload: Record<string, any> = {
      type: ghlType,
      contactId: body.ghlContactId,
      message: body.sms.trim(),
      locationId
    };

    const resp = await ghlPost<{ conversationId?: string; messageId?: string; msg?: string }>(
      '/conversations/messages',
      payload
    );

    return NextResponse.json({
      ok: true,
      stubbed: false,
      sentAt: new Date().toISOString(),
      channel,
      conversationId: resp.conversationId,
      messageId: resp.messageId,
      preview: body.sms.trim()
    });
  } catch (err: any) {
    console.error('[ghl/send-sms] error:', err);
    return NextResponse.json({ error: err.message || 'Error GHL' }, { status: 500 });
  }
}
