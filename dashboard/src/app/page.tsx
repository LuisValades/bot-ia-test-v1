'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { AGENTS } from '@/lib/agents';

interface Stats {
  totalFeedback: number;
  good: number;
  bad: number;
  byAgent: Record<string, { good: number; bad: number }>;
}

export default function InicioPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/metrics')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Inicio"
        subtitle="Panorama general de tus agentes y su entrenamiento"
      />

      <div className="scroll-fade flex-1 overflow-y-auto p-8">
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Agentes
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {AGENTS.map(agent => {
              const agentStats = stats?.byAgent?.[agent.id] || { good: 0, bad: 0 };
              return (
                <div key={agent.id} className="card p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-2xl">
                        {agent.emoji}
                      </div>
                      <div>
                        <div className="font-semibold">{agent.name}</div>
                        <div className="text-xs text-slate-500">{agent.description}</div>
                      </div>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        agent.status === 'production'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {agent.status === 'production' ? 'Activo' : 'Placeholder'}
                    </span>
                  </div>
                  <div className="flex gap-3 border-t pt-3 text-sm">
                    <div className="flex-1">
                      <div className="text-xs text-slate-500">👍 Buenas</div>
                      <div className="text-lg font-semibold text-green-600">{agentStats.good}</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-slate-500">👎 Mejorar</div>
                      <div className="text-lg font-semibold text-red-600">{agentStats.bad}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Resumen global
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Feedback total" value={stats?.totalFeedback ?? 0} color="blue" />
            <StatCard label="👍 Buenas" value={stats?.good ?? 0} color="green" />
            <StatCard label="👎 Mejorar" value={stats?.bad ?? 0} color="red" />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Acciones rápidas
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <QuickAction
              href="/entrenar"
              title="Entrenar agente"
              desc="Conversa y califica respuestas"
              emoji="🎯"
            />
            <QuickAction
              href="/conocimiento"
              title="Revisar conocimiento"
              desc="Editar secciones del knowledge.md"
              emoji="📚"
            />
            <QuickAction
              href="/historial"
              title="Ver historial"
              desc="Últimos feedbacks aplicados"
              emoji="📜"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'green' | 'red' }) {
  const colorMap = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600'
  };
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${colorMap[color]}`}>{value}</div>
    </div>
  );
}

function QuickAction({ href, title, desc, emoji }: { href: string; title: string; desc: string; emoji: string }) {
  return (
    <Link
      href={href}
      className="card flex items-center gap-4 p-4 transition hover:border-blue-400 hover:shadow"
    >
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-xl">{emoji}</div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
    </Link>
  );
}
