'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';

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
  skipped?: boolean;
  reason?: string;
  error?: string;
  git?: { committed: boolean; pushed?: boolean; commitSha?: string };
  at: string;
}

export default function HistorialPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [filter, setFilter] = useState<'all' | 'bad' | 'good' | 'rollback'>('all');

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

  const rollback = async (entry: Entry) => {
    if (!entry.backupPath || !entry.filePath) return;
    if (!confirm(`Revertir cambio en ${entry.filePath} usando backup ${entry.backupPath}?`)) return;
    try {
      const res = await fetch('/api/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupPath: entry.backupPath, targetPath: entry.filePath })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en rollback');
      alert(`✅ Restaurado (${data.restoredBytes} bytes)`);
      load();
      setSelected(null);
    } catch (err: any) {
      alert(`⚠️ ${err.message}`);
    }
  };

  const filtered = entries.filter(e => filter === 'all' || e.kind === filter);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Historial"
        subtitle="Feedback humano aplicado a los agentes (últimos 200)"
        action={
          <button
            onClick={load}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            🔄 Recargar
          </button>
        }
      />

      <div className="border-b bg-white px-4 py-3 md:px-8">
        <div className="flex flex-wrap gap-2">
          {(['all', 'bad', 'good', 'rollback'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                filter === f
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'bad' ? '👎 Mejorar' : f === 'good' ? '👍 Buenas' : '↩️ Rollbacks'}
            </button>
          ))}
          <span className="ml-auto self-center text-xs text-slate-500">
            {filtered.length} entrada{filtered.length !== 1 && 's'}
          </span>
        </div>
      </div>

      <div className="scroll-fade flex-1 overflow-y-auto p-4 md:p-8">
        {loading ? (
          <div className="text-center text-sm text-slate-500">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-slate-500">Sin entradas todavía.</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Agente</th>
                    <th className="px-4 py-3 text-left">Acción / Feedback</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <KindBadge kind={e.kind} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {new Date(e.at).toLocaleString('es-MX', { hour12: false })}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{e.agentId || '—'}</td>
                      <td className="max-w-md truncate px-4 py-3 text-slate-700">
                        {e.patch?.section_title
                          ? `→ ${e.patch.target_file}.md · "${e.patch.section_title}"`
                          : e.feedback || e.reason || e.error || '(sin detalle)'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelected(e)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y md:hidden">
              {filtered.map(e => (
                <li key={e.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <KindBadge kind={e.kind} />
                        <span className="font-mono text-[10px] text-slate-500">
                          {new Date(e.at).toLocaleString('es-MX', { hour12: false })}
                        </span>
                      </div>
                      <div className="break-words text-xs text-slate-500">{e.agentId || '—'}</div>
                      <div className="mt-1 line-clamp-2 break-words text-xs text-slate-700">
                        {e.patch?.section_title
                          ? `→ ${e.patch.target_file}.md · "${e.patch.section_title}"`
                          : e.feedback || e.reason || e.error || '(sin detalle)'}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelected(e)}
                      className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Ver
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
          <div className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-lg bg-white shadow-2xl md:h-[85vh] md:rounded-lg">
            <header className="flex items-start justify-between gap-2 border-b px-4 py-3 md:px-6 md:py-4">
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold md:text-lg">
                  <KindBadge kind={selected.kind} /> <span>Detalle del feedback</span>
                </h2>
                <p className="text-xs text-slate-500">{new Date(selected.at).toLocaleString('es-MX', { hour12: false })}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </header>
            <div className="scroll-fade flex-1 space-y-4 overflow-y-auto p-4 text-sm md:p-6">
              <Field label="Agente">{selected.agentId || '—'}</Field>
              {selected.feedback && <Field label="Feedback humano">{selected.feedback}</Field>}
              {selected.patch?.reasoning && (
                <Field label="Razonamiento del Trainer">{selected.patch.reasoning}</Field>
              )}
              {selected.patch && (
                <>
                  <Field label="Archivo afectado">{selected.patch.target_file}.md</Field>
                  <Field label="Sección">{selected.patch.section_title}</Field>
                  <Field label="Contenido aplicado">
                    <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 font-mono text-xs text-slate-700">
                      {selected.patch.new_content}
                    </pre>
                  </Field>
                </>
              )}
              {selected.git && (
                <Field label="Git">
                  {selected.git.committed ? `✅ commit ${selected.git.commitSha?.slice(0, 7)}` : '⏸ no committed'}
                  {selected.git.pushed ? ' · 🚀 pushed' : ''}
                </Field>
              )}
              {selected.backupPath && <Field label="Backup">{selected.backupPath}</Field>}
              {selected.error && <Field label="Error">{selected.error}</Field>}
            </div>
            {selected.kind === 'bad' && selected.backupPath && selected.filePath && (
              <footer className="flex justify-end border-t px-4 py-3 md:px-6">
                <button
                  onClick={() => rollback(selected)}
                  className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 md:px-4"
                >
                  ↩️ Revertir este cambio
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    good: { label: '👍 Buena', cls: 'bg-green-50 text-green-700' },
    bad: { label: '👎 Mejorar', cls: 'bg-red-50 text-red-700' },
    rollback: { label: '↩️ Rollback', cls: 'bg-amber-50 text-amber-700' }
  };
  const m = map[kind] || { label: kind, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-700">{children}</div>
    </div>
  );
}
