'use client';

import { useState } from 'react';
import Icon from './Icon';
import type { Lead, Advisor } from '@/lib/advisors-data';

const tagLabels: Record<string, { label: string; bg: string; fg: string }> = {
  warm: {
    label: 'TIBIO',
    bg: 'color-mix(in oklab, var(--warn), transparent 82%)',
    fg: 'var(--warn)'
  },
  hot: {
    label: '🔥 CALIENTE',
    bg: 'color-mix(in oklab, var(--danger), transparent 82%)',
    fg: 'var(--danger)'
  },
  cold: {
    label: 'FRÍO',
    bg: 'color-mix(in oklab, var(--fg-2), transparent 82%)',
    fg: 'var(--fg-1)'
  },
  new: {
    label: 'NUEVO',
    bg: 'color-mix(in oklab, var(--accent), transparent 80%)',
    fg: 'var(--accent)'
  }
};

interface Props {
  lead: Lead;
  advisor: Advisor;
  onDismiss: () => void;
  onSent: (channel: 'sms' | 'whatsapp') => void;
}

export default function LeadCard({ lead, advisor, onDismiss, onSent }: Props) {
  const [draft, setDraft] = useState(lead.suggestion || '');
  const [instruction, setInstruction] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [polishNote, setPolishNote] = useState<string | null>(null);
  const [sending, setSending] = useState<null | 'sms' | 'whatsapp'>(null);
  const [sentChannel, setSentChannel] = useState<null | 'sms' | 'whatsapp'>(null);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tag = tagLabels[lead.tag];
  const hasDraft = !!draft?.trim();

  const polish = async () => {
    if (!instruction.trim() || polishing) return;
    setPolishing(true);
    setError(null);
    try {
      const res = await fetch('/api/suggest-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread: lead.thread,
          currentSms: draft,
          instruction: instruction.trim(),
          leadName: lead.name,
          advisorName: advisor.name,
          reason: lead.reason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al pulir SMS');
      setDraft(data.sms);
      setPolishNote(data.note || null);
      setInstruction('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPolishing(false);
    }
  };

  const send = async (channel: 'sms' | 'whatsapp') => {
    if (sending || !draft.trim()) return;
    setSending(channel);
    setError(null);
    try {
      const res = await fetch('/api/ghl/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          ghlContactId: lead.ghlContactId,
          phone: lead.phone,
          sms: draft,
          advisorId: advisor.id,
          channel
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error enviando');
      setSentChannel(channel);
      onSent(channel);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(null);
    }
  };

  const proposeFromScratch = async (customInstruction?: string) => {
    if (polishing) return;
    setPolishing(true);
    setError(null);
    try {
      const baseInstruction =
        'Proponer un SMS de seguimiento apropiado basado en el hilo reciente, corto y con una sola pregunta clara.';
      const instr = customInstruction?.trim()
        ? `${baseInstruction} Considera este guion del asesor: "${customInstruction.trim()}"`
        : baseInstruction;
      const res = await fetch('/api/suggest-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread: lead.thread,
          currentSms: '',
          instruction: instr,
          leadName: lead.name,
          advisorName: advisor.name,
          reason: lead.reason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al proponer');
      setDraft(data.sms);
      setPolishNote(data.note || null);
      setInstruction('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPolishing(false);
    }
  };

  return (
    <div
      className="rounded-[14px] overflow-hidden"
      style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}
    >
      <div className="flex flex-wrap items-center gap-[12px] px-4 pt-[14px] pb-[10px]">
        <div
          className="grid h-[40px] w-[40px] flex-shrink-0 place-items-center rounded-[12px] text-sm font-semibold text-white"
          style={{ background: lead.color }}
        >
          {lead.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold" style={{ color: 'var(--fg-0)' }}>
            {lead.name}
          </div>
          <div
            className="mt-[1px] truncate text-[11.5px]"
            style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
          >
            {lead.phone} · {lead.source} · {lead.product}
          </div>
        </div>
        <span
          className="rounded-[10px] px-[7px] py-[2px] text-[10.5px] font-semibold uppercase tracking-[0.04em]"
          style={{
            background: tag.bg,
            color: tag.fg,
            fontFamily: 'var(--font-mono)'
          }}
        >
          {tag.label}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="btn btn-ghost"
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {expanded && (
        <>
          <div
            className="mx-4 flex flex-col gap-1 rounded-[10px] px-[16px] py-[8px] text-[12.5px]"
            style={{
              background: 'var(--bg-0)',
              border: '1px dashed var(--border)',
              color: 'var(--fg-1)'
            }}
          >
            {lead.thread.length === 0 && (
              <div
                className="py-[4px] text-[11.5px] italic"
                style={{ color: 'var(--fg-3)' }}
              >
                (sin mensajes recientes en este canal)
              </div>
            )}
            {lead.thread.map((t, i) => (
              <div key={i} className="flex flex-wrap items-start gap-2 py-[4px]">
                <div className="flex min-w-[96px] flex-wrap items-center gap-1 pt-[2px]">
                  <span
                    className="text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                    style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
                  >
                    {t.who}
                  </span>
                  {t.type && (
                    <span
                      className="rounded-[4px] px-[4px] py-[1px] text-[9px] font-semibold uppercase tracking-[0.05em]"
                      style={{
                        background: 'var(--bg-2)',
                        color: 'var(--fg-2)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {t.type}
                    </span>
                  )}
                </div>
                <span className="flex-1 break-words" style={{ color: 'var(--fg-1)' }}>
                  {t.msg}
                </span>
                <span
                  className="whitespace-nowrap pt-[2px] text-[10.5px]"
                  style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
                >
                  {t.time}
                </span>
              </div>
            ))}
          </div>

          {hasDraft || lead.suggestion !== null ? (
            <div
              className="mx-4 my-3 rounded-[10px] px-[14px] py-[12px]"
              style={{
                background: 'linear-gradient(180deg, var(--bg-2), var(--bg-1))',
                border: '1px solid var(--border-strong)'
              }}
            >
              <div
                className="mb-[6px] flex items-center gap-[6px] text-[10.5px] font-bold uppercase tracking-[0.08em]"
                style={{ color: 'var(--accent)' }}
              >
                <Icon name="sparkles" size={11} /> SMS SUGERIDO · EDITABLE
              </div>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="w-full resize-none rounded-[8px] px-[12px] py-[10px] text-[13.5px] leading-[1.5] outline-none"
                style={{
                  background: 'var(--bg-0)',
                  color: 'var(--fg-0)',
                  border: '1px solid var(--border)',
                  fontFamily: 'inherit'
                }}
                rows={Math.max(3, Math.min(8, draft.split('\n').length + 1))}
                disabled={!!sentChannel}
              />

              {!sentChannel && (
                <div
                  className="mt-[10px] flex gap-[6px] rounded-[8px] p-[6px]"
                  style={{ background: 'var(--bg-0)', border: '1px solid var(--accent-soft)' }}
                >
                  <div
                    className="grid h-[26px] w-[26px] place-items-center rounded-md flex-shrink-0"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <Icon name="sparkles" size={12} />
                  </div>
                  <input
                    type="text"
                    value={instruction}
                    onChange={e => setInstruction(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        polish();
                      }
                    }}
                    placeholder={
                      polishing
                        ? 'Puliendo con IA…'
                        : 'Mejorar / pulir con IA: dale las gracias · hazlo más corto · menos formal…'
                    }
                    disabled={polishing}
                    className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
                    style={{ color: 'var(--fg-0)', fontFamily: 'inherit' }}
                  />
                  <button
                    type="button"
                    onClick={polish}
                    disabled={!instruction.trim() || polishing}
                    className="btn btn-primary"
                  >
                    {polishing ? '…' : 'Pulir'}
                  </button>
                </div>
              )}

              {polishNote && (
                <div
                  className="mt-[8px] rounded-[6px] px-[10px] py-[6px] text-[11.5px]"
                  style={{
                    background: 'color-mix(in oklab, var(--accent), transparent 88%)',
                    color: 'var(--accent)',
                    border: '1px solid color-mix(in oklab, var(--accent), transparent 60%)'
                  }}
                >
                  ✨ {polishNote}
                </div>
              )}

              {error && (
                <div
                  className="mt-[8px] rounded-[6px] px-[10px] py-[6px] text-[11.5px]"
                  style={{
                    background: 'color-mix(in oklab, var(--danger), transparent 85%)',
                    color: 'var(--danger)',
                    border: '1px solid color-mix(in oklab, var(--danger), transparent 60%)'
                  }}
                >
                  ⚠️ {error}
                </div>
              )}

              <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
                {sentChannel ? (
                  <span className="btn btn-sent">
                    <Icon name="check" size={12} /> Enviado via GHL ·{' '}
                    {sentChannel === 'sms' ? 'SMS' : 'WhatsApp'} ·{' '}
                    {new Date().toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => send('sms')}
                      disabled={!draft.trim() || !!sending}
                      className="btn btn-primary"
                    >
                      <Icon name="send" size={12} />
                      {sending === 'sms' ? 'Enviando…' : 'Enviar SMS'}
                    </button>
                    <button
                      type="button"
                      onClick={() => send('whatsapp')}
                      disabled={!draft.trim() || !!sending}
                      className="btn"
                    >
                      <Icon name="whatsapp" size={12} />
                      WhatsApp
                    </button>
                    <button type="button" className="btn" disabled>
                      <Icon name="phone" size={12} /> Llamada
                    </button>
                    <div className="flex-1" />
                    <button type="button" onClick={onDismiss} className="btn btn-ghost">
                      <Icon name="x" size={12} /> Descartar
                    </button>
                  </>
                )}
              </div>

              <details className="mt-[10px]">
                <summary
                  className="cursor-pointer text-[11px]"
                  style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
                >
                  💡 Contexto del AI
                </summary>
                <div
                  className="mt-[6px] text-[11.5px] leading-[1.5]"
                  style={{ color: 'var(--fg-2)' }}
                >
                  {lead.reason}
                </div>
              </details>
            </div>
          ) : (
            <div
              className="mx-4 my-3 rounded-[10px] px-[14px] py-[12px] text-[12.5px]"
              style={{
                background: 'linear-gradient(180deg, var(--bg-2), var(--bg-1))',
                border: '1px solid var(--border-strong)'
              }}
            >
              <div
                className="mb-[8px] flex items-center gap-[6px] text-[10.5px] font-bold uppercase tracking-[0.08em]"
                style={{ color: 'var(--accent)' }}
              >
                <Icon name="sparkles" size={11} /> GENERAR SMS CON IA
              </div>

              <div
                className="mb-[10px] flex gap-[6px] rounded-[8px] p-[6px]"
                style={{ background: 'var(--bg-0)', border: '1px solid var(--accent-soft)' }}
              >
                <div
                  className="grid h-[26px] w-[26px] place-items-center rounded-md flex-shrink-0"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <Icon name="pencil" size={12} />
                </div>
                <input
                  type="text"
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      proposeFromScratch(instruction);
                    }
                  }}
                  placeholder={
                    polishing
                      ? 'Proponiendo…'
                      : 'Guía opcional: tono cálido · dale las gracias · etc. (o vacío = automático)'
                  }
                  disabled={polishing}
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
                  style={{ color: 'var(--fg-0)', fontFamily: 'inherit' }}
                />
              </div>

              {error && (
                <div
                  className="mb-[8px] rounded-[6px] px-[10px] py-[6px] text-[11.5px]"
                  style={{
                    background: 'color-mix(in oklab, var(--danger), transparent 85%)',
                    color: 'var(--danger)',
                    border: '1px solid color-mix(in oklab, var(--danger), transparent 60%)'
                  }}
                >
                  ⚠️ {error}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-[6px]">
                <button
                  type="button"
                  onClick={() => proposeFromScratch(instruction)}
                  disabled={polishing}
                  className="btn btn-primary"
                >
                  <Icon name="sparkles" size={12} />
                  {polishing ? 'Proponiendo…' : 'Proponer SMS con IA'}
                </button>
                <div className="flex-1" />
                <button type="button" onClick={onDismiss} className="btn btn-ghost">
                  <Icon name="x" size={12} /> Descartar
                </button>
              </div>

              <details className="mt-[10px]">
                <summary
                  className="cursor-pointer text-[11px]"
                  style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
                >
                  💡 Contexto del AI
                </summary>
                <div
                  className="mt-[6px] text-[11.5px] leading-[1.5]"
                  style={{ color: 'var(--fg-2)' }}
                >
                  {lead.reason}
                </div>
              </details>
            </div>
          )}
        </>
      )}
    </div>
  );
}
