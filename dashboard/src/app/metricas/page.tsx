'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { AGENTS } from '@/lib/agents';

interface Metrics {
  totalFeedback: number;
  good: number;
  bad: number;
  byAgent: Record<string, { good: number; bad: number }>;
  byDay: Record<string, { good: number; bad: number }>;
}

export default function MetricasPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/metrics')
      .then(r => r.json())
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  const days = metrics
    ? Object.entries(metrics.byDay).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14)
    : [];

  const ratio =
    metrics && metrics.totalFeedback > 0
      ? Math.round((metrics.good / metrics.totalFeedback) * 100)
      : 0;

  return (
    <AppShell title="Métricas" subtitle="Feedback humano dado a los agentes">
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {loading ? (
          <div className="text-center text-sm" style={{ color: 'var(--fg-2)' }}>
            Cargando…
          </div>
        ) : !metrics ? (
          <div className="text-center text-sm" style={{ color: 'var(--fg-2)' }}>
            Sin datos.
          </div>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <BigStat label="Feedback total" value={metrics.totalFeedback} />
              <BigStat label="👍 Buenas" value={metrics.good} color="var(--success)" />
              <BigStat label="👎 Mejorar" value={metrics.bad} color="var(--danger)" />
              <BigStat label="% aprobación" value={`${ratio}%`} color="var(--accent)" />
            </section>

            <section className="mb-6">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-3)' }}>
                Por agente
              </h2>
              <div className="card overflow-hidden overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead style={{ background: 'var(--bg-2)', color: 'var(--fg-3)' }}>
                    <tr>
                      <th className="px-4 py-[10px] text-left text-[11px] uppercase">Agente</th>
                      <th className="px-4 py-[10px] text-right text-[11px] uppercase">👍</th>
                      <th className="px-4 py-[10px] text-right text-[11px] uppercase">👎</th>
                      <th className="px-4 py-[10px] text-right text-[11px] uppercase">Total</th>
                      <th className="px-4 py-[10px] text-right text-[11px] uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {AGENTS.map(a => {
                      const s = metrics.byAgent[a.id] || { good: 0, bad: 0 };
                      const total = s.good + s.bad;
                      const pct = total > 0 ? Math.round((s.good / total) * 100) : 0;
                      return (
                        <tr key={a.id}>
                          <td className="px-4 py-[10px] font-medium">{a.name}</td>
                          <td className="px-4 py-[10px] text-right" style={{ color: 'var(--success)' }}>
                            {s.good}
                          </td>
                          <td className="px-4 py-[10px] text-right" style={{ color: 'var(--danger)' }}>
                            {s.bad}
                          </td>
                          <td className="px-4 py-[10px] text-right font-semibold">{total}</td>
                          <td className="px-4 py-[10px] text-right">{total > 0 ? `${pct}%` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-3)' }}>
                Últimos 14 días
              </h2>
              <div className="card overflow-hidden overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead style={{ background: 'var(--bg-2)', color: 'var(--fg-3)' }}>
                    <tr>
                      <th className="px-4 py-[10px] text-left text-[11px] uppercase">Fecha</th>
                      <th className="px-4 py-[10px] text-right text-[11px] uppercase">👍</th>
                      <th className="px-4 py-[10px] text-right text-[11px] uppercase">👎</th>
                      <th className="px-4 py-[10px] text-left text-[11px] uppercase">Dist.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {days.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center" style={{ color: 'var(--fg-2)' }}>
                          Aún no hay feedback registrado.
                        </td>
                      </tr>
                    )}
                    {days.map(([date, s]) => {
                      const total = s.good + s.bad;
                      const goodPct = total > 0 ? (s.good / total) * 100 : 0;
                      return (
                        <tr key={date}>
                          <td className="px-4 py-[10px]" style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                            {date}
                          </td>
                          <td className="px-4 py-[10px] text-right" style={{ color: 'var(--success)' }}>
                            {s.good}
                          </td>
                          <td className="px-4 py-[10px] text-right" style={{ color: 'var(--danger)' }}>
                            {s.bad}
                          </td>
                          <td className="px-4 py-[10px]">
                            <div
                              className="h-[6px] w-full overflow-hidden rounded-full"
                              style={{ background: 'var(--bg-3)' }}
                            >
                              <div
                                className="h-full"
                                style={{ width: `${goodPct}%`, background: 'var(--success)' }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function BigStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="card p-[14px]">
      <div className="text-[11px] uppercase tracking-[0.05em]" style={{ color: 'var(--fg-2)' }}>
        {label}
      </div>
      <div className="mt-[4px] text-[24px] font-semibold" style={{ color: color || 'var(--fg-0)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  );
}
