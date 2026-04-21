'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
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
    ? Object.entries(metrics.byDay)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 14)
    : [];

  const ratio = metrics && metrics.totalFeedback > 0
    ? Math.round((metrics.good / metrics.totalFeedback) * 100)
    : 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Métricas" subtitle="Resumen de feedback humano dado a los agentes" />

      <div className="scroll-fade flex-1 overflow-y-auto p-4 md:p-8">
        {loading ? (
          <div className="text-center text-sm text-slate-500">Cargando…</div>
        ) : !metrics ? (
          <div className="text-center text-sm text-slate-500">Sin datos todavía.</div>
        ) : (
          <>
            <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <BigStat label="Feedback total" value={metrics.totalFeedback} />
              <BigStat label="👍 Buenas" value={metrics.good} color="green" />
              <BigStat label="👎 Mejorar" value={metrics.bad} color="red" />
              <BigStat label="% aprobación" value={`${ratio}%`} color="blue" />
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Por agente
              </h2>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Agente</th>
                      <th className="px-4 py-3 text-right">👍 Buenas</th>
                      <th className="px-4 py-3 text-right">👎 Mejorar</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">% aprobación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {AGENTS.map(agent => {
                      const s = metrics.byAgent[agent.id] || { good: 0, bad: 0 };
                      const total = s.good + s.bad;
                      const pct = total > 0 ? Math.round((s.good / total) * 100) : 0;
                      return (
                        <tr key={agent.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium">
                            <span className="mr-2">{agent.emoji}</span>
                            {agent.name}
                          </td>
                          <td className="px-4 py-3 text-right text-green-600">{s.good}</td>
                          <td className="px-4 py-3 text-right text-red-600">{s.bad}</td>
                          <td className="px-4 py-3 text-right font-semibold">{total}</td>
                          <td className="px-4 py-3 text-right">{total > 0 ? `${pct}%` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Últimos 14 días
              </h2>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-right">👍</th>
                      <th className="px-4 py-3 text-right">👎</th>
                      <th className="px-4 py-3">Distribución</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {days.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                          Aún no hay feedback registrado.
                        </td>
                      </tr>
                    )}
                    {days.map(([date, s]) => {
                      const total = s.good + s.bad;
                      const goodPct = total > 0 ? (s.good / total) * 100 : 0;
                      return (
                        <tr key={date} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-xs">{date}</td>
                          <td className="px-4 py-3 text-right text-green-600">{s.good}</td>
                          <td className="px-4 py-3 text-right text-red-600">{s.bad}</td>
                          <td className="px-4 py-3">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full bg-green-500"
                                style={{ width: `${goodPct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  color
}: {
  label: string;
  value: number | string;
  color?: 'green' | 'red' | 'blue';
}) {
  const colorMap: Record<string, string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600'
  };
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color ? colorMap[color] : 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  );
}
