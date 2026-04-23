'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icon';

interface Entry {
  id: string;
  kind: 'good' | 'bad' | 'rollback';
  agentId?: string;
  feedback?: string;
  patch?: {
    target_file?: string;
    section_title?: string;
    new_content?: string;
    reasoning?: string;
  };
  filePath?: string;
  backupPath?: string;
  error?: string;
  at: string;
}

export default function HistorialPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'bad' | 'good' | 'rollback'>('all');
  const [selected, setSelected] = useState<Entry | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/feedback-log')
      .then(r => r.json())
      .then(d => setEntries(d.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = entries.filter(e => filter === 'all' || e.kind === filter);

  return (
    <AppShell title="Historial" subtitle="Últimos feedbacks aplicados a los agentes">
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-0)' }}
      >
        {(['all', 'bad', 'good', 'rollback'] as const).map(f => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="rounded-[16px] px-[10px] py-[4px] text-[12px] font-medium"
              style={{
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-soft)' : 'var(--bg-1)',
                color: active ? 'var(--accent)' : 'var(--fg-1)',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {f === 'all' ? 'Todos' : f === 'bad' ? '👎 Mejorar' : f === 'good' ? '👍 Buenas' : '↩️ Rollbacks'}
            </button>
          );
        })}
        <button type="button" onClick={load} className="btn btn-ghost ml-auto">
          <Icon name="refresh" size={13} /> Recargar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {loading ? (
          <div className="text-center text-sm" style={{ color: 'var(--fg-2)' }}>
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm" style={{ color: 'var(--fg-2)' }}>
            Sin entradas.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map(e => (
                <li key={e.id} className="flex flex-wrap items-start gap-[10px] px-4 py-[10px]">
                  <KindBadge kind={e.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px]" style={{ color: 'var(--fg-0)' }}>
                      {e.patch?.section_title
                        ? `→ ${e.patch.target_file}.md · "${e.patch.section_title}"`
                        : e.feedback || e.error || '(sin detalle)'}
                    </div>
                    <div
                      className="mt-[2px] text-[11px]"
                      style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
                    >
                      {new Date(e.at).toLocaleString('es-MX', { hour12: false })} · {e.agentId || '—'}
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelected(e)} className="btn">
                    Ver
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4">
          <div
            className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[14px] md:h-[85vh] md:rounded-[14px]"
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)' }}
          >
            <header
              className="flex items-center justify-between px-4 py-[12px] md:px-6 md:py-[14px]"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <div className="flex items-center gap-2 text-[15px] font-semibold md:text-[17px]">
                  <KindBadge kind={selected.kind} /> Detalle
                </div>
                <p
                  className="mt-[2px] text-[11.5px]"
                  style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
                >
                  {new Date(selected.at).toLocaleString('es-MX', { hour12: false })}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="btn btn-ghost">
                <Icon name="x" size={14} />
              </button>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-[13px] md:p-6">
              <Field label="Agente">{selected.agentId || '—'}</Field>
              {selected.feedback && <Field label="Feedback humano">{selected.feedback}</Field>}
              {selected.patch?.reasoning && (
                <Field label="Razonamiento">{selected.patch.reasoning}</Field>
              )}
              {selected.patch?.new_content && (
                <Field label="Contenido aplicado">
                  <pre
                    className="whitespace-pre-wrap rounded-[6px] p-[10px] text-[12px]"
                    style={{
                      background: 'var(--bg-0)',
                      color: 'var(--fg-1)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {selected.patch.new_content}
                  </pre>
                </Field>
              )}
              {selected.error && <Field label="Error">{selected.error}</Field>}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    good: {
      label: '👍 Buena',
      bg: 'color-mix(in oklab, var(--success), transparent 82%)',
      fg: 'var(--success)'
    },
    bad: {
      label: '👎 Mejorar',
      bg: 'color-mix(in oklab, var(--danger), transparent 82%)',
      fg: 'var(--danger)'
    },
    rollback: {
      label: '↩️ Rollback',
      bg: 'color-mix(in oklab, var(--warn), transparent 82%)',
      fg: 'var(--warn)'
    }
  };
  const m = map[kind] || {
    label: kind,
    bg: 'var(--bg-3)',
    fg: 'var(--fg-1)'
  };
  return (
    <span
      className="rounded-[10px] px-[7px] py-[2px] text-[10.5px] font-semibold"
      style={{
        background: m.bg,
        color: m.fg,
        fontFamily: 'var(--font-mono)'
      }}
    >
      {m.label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="mb-[4px] text-[10.5px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--fg-3)' }}
      >
        {label}
      </div>
      <div style={{ color: 'var(--fg-1)' }}>{children}</div>
    </div>
  );
}
