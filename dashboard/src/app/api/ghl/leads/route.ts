import { NextRequest, NextResponse } from 'next/server';
import {
  getGhlConfig,
  ghlGet,
  THREAD_MESSAGE_TYPES,
  typeLabel,
  type GhlConversation,
  type GhlMessage
} from '@/lib/ghl-client';

export const dynamic = 'force-dynamic';

const MS_24H = 24 * 60 * 60 * 1000;

interface GhlUser {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  deleted?: boolean;
}

// Cache en memoria del server (se recicla en cada cold start)
let USERS_CACHE: { at: number; map: Record<string, string> } | null = null;
const USERS_TTL_MS = 5 * 60 * 1000;

async function getUserMap(): Promise<Record<string, string>> {
  if (USERS_CACHE && Date.now() - USERS_CACHE.at < USERS_TTL_MS) return USERS_CACHE.map;
  try {
    const { locationId } = getGhlConfig();
    const resp = await ghlGet<{ users: GhlUser[] }>(
      '/users/',
      { locationId },
      { version: '2021-07-28' }
    );
    const map: Record<string, string> = {};
    for (const u of resp.users || []) {
      if (u.deleted) continue;
      const firstName = u.firstName || u.name?.split(' ')[0] || u.id;
      map[u.id] = firstName;
    }
    USERS_CACHE = { at: Date.now(), map };
    return map;
  } catch {
    return USERS_CACHE?.map || {};
  }
}

function tagFromConversation(c: GhlConversation, lastMsgAgeMin: number): 'hot' | 'warm' | 'new' | 'cold' {
  if ((c.unreadCount || 0) >= 2 && lastMsgAgeMin < 60) return 'hot';
  if (c.lastMessageDirection === 'inbound' && lastMsgAgeMin < 180) return 'warm';
  if (lastMsgAgeMin < 15) return 'new';
  return 'cold';
}

function avatarFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFromId(id: string): string {
  // determinístico: hash simple → hue
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, oklch(0.75 0.14 ${h}), oklch(0.68 0.15 ${(h + 60) % 360}))`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const advisorId = searchParams.get('advisor');
    if (!advisorId) {
      return NextResponse.json({ error: 'Falta ?advisor=<userId>' }, { status: 400 });
    }

    const { locationId } = getGhlConfig();

    // 1) Buscar conversaciones recientes del asesor (o de la location si no filtra por asesor).
    //    GHL conversations/search devuelve hasta 20 por default, ordenadas por last_message_date.
    const searchResp = await ghlGet<{ conversations: GhlConversation[] }>(
      '/conversations/search',
      {
        locationId,
        assignedTo: advisorId,
        sort: 'desc',
        sortBy: 'last_message_date',
        limit: 30
      }
    );

    const conversations = searchResp.conversations || [];
    const now = Date.now();
    const recent = conversations.filter(c => {
      if (!c.lastMessageDate) return false;
      const t = new Date(c.lastMessageDate).getTime();
      return now - t < MS_24H;
    });

    // Mapa userId → primer nombre, para saber quién escribió cada mensaje
    const userMap = await getUserMap();

    // 2) Para cada conversación, traer últimos 15 mensajes y armar el hilo visible.
    const leadsRaw = await Promise.all(
      recent.slice(0, 15).map(async conv => {
        let messages: GhlMessage[] = [];
        try {
          const msgResp = await ghlGet<{ messages: { messages: GhlMessage[] } }>(
            `/conversations/${conv.id}/messages`,
            { limit: 15 }
          );
          messages = msgResp?.messages?.messages || [];
        } catch {
          messages = [];
        }

        const leadDisplayName = conv.fullName || conv.contactName || 'Lead';
        const whoOf = (m: GhlMessage): string => {
          if (m.direction === 'inbound') return leadDisplayName;
          if (m.userId && userMap[m.userId]) return userMap[m.userId];
          if (m.source === 'workflow' || m.source === 'bot') return 'Alejandra (bot)';
          return 'Asesor';
        };

        const threadFromMessages = messages
          .filter(m => THREAD_MESSAGE_TYPES.has(m.type))
          .slice(0, 6)
          .reverse()
          .map(m => ({
            who: whoOf(m),
            msg: (m.body || '').trim().slice(0, 320),
            type: typeLabel(m.type),
            time: m.dateAdded
              ? new Date(m.dateAdded).toLocaleString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: 'short'
                })
              : ''
          }));

        // Fallback: si el thread quedó vacío (ej. todos los mensajes son
        // llamadas o notas internas), usamos el lastMessageBody de la convo.
        let thread = threadFromMessages;
        if (thread.length === 0 && conv.lastMessageBody) {
          thread = [
            {
              who: conv.lastMessageDirection === 'inbound' ? leadDisplayName : 'Asesor',
              msg: conv.lastMessageBody.trim().slice(0, 320),
              type: typeLabel(
                Number(String(conv.lastMessageType || '').replace('TYPE_', '').match(/\d+/)?.[0]) || 0
              ),
              time: conv.lastMessageDate
                ? new Date(conv.lastMessageDate).toLocaleString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: 'short'
                  })
                : ''
            }
          ];
        }

        const lastDate = conv.lastMessageDate ? new Date(conv.lastMessageDate) : new Date();
        const ageMin = Math.floor((now - lastDate.getTime()) / 60000);
        const name = conv.fullName || conv.contactName || 'Lead sin nombre';

        return {
          id: conv.id,
          advisorId,
          ghlContactId: conv.contactId,
          name,
          avatar: avatarFromName(name),
          color: colorFromId(conv.contactId || conv.id),
          phone: conv.phone || '',
          source: conv.lastMessageType || 'GHL',
          tag: tagFromConversation(conv, ageMin),
          product: 'Sin clasificar',
          thread,
          unreadCount: conv.unreadCount || 0,
          lastMessageAgeMin: ageMin,
          lastMessageDirection: conv.lastMessageDirection || null,
          suggestion: null, // se genera on-demand desde UI
          reason: `Último mensaje: ${ageMin} min · dirección ${conv.lastMessageDirection || 'n/a'} · unread ${conv.unreadCount || 0}. Canal: ${typeLabel(
            Number(String(conv.lastMessageType || '').replace('TYPE_', '').match(/\d+/)?.[0]) || 0
          )}.`
        };
      })
    );

    // Filtrar leads sin contenido (sin thread y sin phone = inutilizables).
    const leads = leadsRaw.filter(l => l.thread.length > 0 && (l.phone || l.ghlContactId));

    return NextResponse.json({
      advisorId,
      locationId,
      count: leads.length,
      totalFound: conversations.length,
      hidden: leadsRaw.length - leads.length,
      leads
    });
  } catch (err: any) {
    console.error('[ghl/leads] error:', err);
    return NextResponse.json({ error: err.message || 'Error GHL' }, { status: 500 });
  }
}
