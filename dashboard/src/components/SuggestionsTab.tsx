'use client';

import { useMemo, useState } from 'react';
import Icon from './Icon';
import LeadCard from './LeadCard';
import {
  ADVISORS,
  LEADS,
  TASKS_TODAY,
  NOTES,
  type Lead,
  type Task
} from '@/lib/advisors-data';

type Filter = 'all' | 'hot' | 'warm' | 'new' | 'dismissed';

export default function SuggestionsTab() {
  const [advisorId, setAdvisorId] = useState(ADVISORS[0].id);
  const [filter, setFilter] = useState<Filter>('all');
  const [leads, setLeads] = useState<Lead[]>(LEADS);
  const [tasks, setTasks] = useState<Task[]>(TASKS_TODAY);

  const advisor = ADVISORS.find(a => a.id === advisorId) || ADVISORS[0];

  const leadsForAdvisor = useMemo(
    () => leads.filter(l => l.advisorId === advisorId),
    [leads, advisorId]
  );

  const visible = useMemo(() => {
    if (filter === 'all') return leadsForAdvisor.filter(l => !l.dismissed);
    if (filter === 'dismissed') return leadsForAdvisor.filter(l => l.dismissed);
    return leadsForAdvisor.filter(l => !l.dismissed && l.tag === filter);
  }, [leadsForAdvisor, filter]);

  const counts = useMemo(
    () => ({
      all: leadsForAdvisor.filter(l => !l.dismissed).length,
      hot: leadsForAdvisor.filter(l => !l.dismissed && l.tag === 'hot').length,
      warm: leadsForAdvisor.filter(l => !l.dismissed && l.tag === 'warm').length,
      new: leadsForAdvisor.filter(l => !l.dismissed && l.tag === 'new').length,
      dismissed: leadsForAdvisor.filter(l => l.dismissed).length
    }),
    [leadsForAdvisor]
  );

  const dismiss = (id: string) =>
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, dismissed: true } : l)));

  const toggleTask = (id: string) =>
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, done: !t.done } : t)));

  const openTasks = tasks.filter(t => !t.done).length;

  return (
    <div
      className="grid flex-1 overflow-hidden"
      style={{
        gridTemplateColumns: 'minmax(240px, 280px) minmax(0, 1fr) minmax(280px, 340px)'
      }}
    >
      {/* COL 1: advisor picker */}
      <aside
        className="flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg-1)',
          borderRight: '1px solid var(--border)'
        }}
      >
        <div
          className="flex items-center gap-2 px-4 pb-[10px] pt-[14px] text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-3)', borderBottom: '1px solid var(--border)' }}
        >
          <Icon name="users" size={12} />
          Asesores del equipo
          <span
            className="ml-auto"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}
          >
            {ADVISORS.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {ADVISORS.map(a => {
            const active = advisorId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAdvisorId(a.id)}
                className="flex w-full cursor-pointer items-center gap-[12px] px-4 py-[12px] text-left"
                style={{
                  background: active ? 'var(--bg-2)' : 'transparent',
                  borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  borderBottom: '1px solid color-mix(in oklab, var(--border), transparent 50%)'
                }}
              >
                <div
                  className="grid h-[36px] w-[36px] flex-shrink-0 place-items-center rounded-[10px] text-[13px] font-semibold text-white"
                  style={{ background: a.color }}
                >
                  {a.name
                    .split(' ')
                    .map(w => w[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium" style={{ color: 'var(--fg-0)' }}>
                    {a.name}
                  </div>
                  <div
                    className="mt-[2px] truncate text-[11px]"
                    style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
                  >
                    {a.role} · {a.leads} leads
                  </div>
                </div>
                <span
                  className="rounded-[10px] px-[7px] py-[2px] text-[11px] font-semibold"
                  style={{
                    background:
                      a.hot >= 3
                        ? 'color-mix(in oklab, var(--warn), transparent 80%)'
                        : 'var(--bg-3)',
                    color: a.hot >= 3 ? 'var(--warn)' : 'var(--fg-1)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {a.hot} 🔥
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-[14px]" style={{ borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn btn-ghost w-full justify-center">
            <Icon name="plus" size={12} /> Invitar asesor
          </button>
        </div>
      </aside>

      {/* COL 2: leads */}
      <div className="flex flex-col overflow-hidden" style={{ background: 'var(--bg-0)' }}>
        <div
          className="flex flex-wrap items-center gap-[12px] px-[20px] py-[14px]"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="grid h-[28px] w-[28px] place-items-center rounded-[8px] text-[11px] font-semibold text-white"
            style={{ background: advisor.color }}
          >
            {advisor.name
              .split(' ')
              .map(w => w[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">
              Sugerencias para <span style={{ color: 'var(--accent)' }}>{advisor.name}</span>
            </div>
            <div
              className="mt-[2px] text-[11.5px]"
              style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
            >
              Leads últimas 24h · datos mock · Fase 2 conecta GHL en vivo
            </div>
          </div>
          <div className="flex-1" />
          <button type="button" className="btn btn-ghost">
            <Icon name="refresh" size={13} /> Actualizar
          </button>
          <button type="button" className="btn">
            <Icon name="flow" size={13} /> Workflow GHL
          </button>
        </div>

        <div
          className="flex flex-wrap items-center gap-[8px] px-[20px] py-[12px]"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="mr-[4px] text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--fg-3)' }}
          >
            Filtrar
          </div>
          {(
            [
              ['all', 'Todos', counts.all],
              ['hot', '🔥 Calientes', counts.hot],
              ['warm', 'Tibios', counts.warm],
              ['new', 'Nuevos', counts.new],
              ['dismissed', 'Descartados', counts.dismissed]
            ] as const
          ).map(([k, lbl, n]) => {
            const active = filter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className="rounded-[16px] px-[10px] py-[4px] text-[12px] font-medium transition-all"
                style={{
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--bg-1)',
                  color: active ? 'var(--accent)' : 'var(--fg-1)',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                {lbl}{' '}
                <span style={{ opacity: 0.6, fontFamily: 'var(--font-mono)' }}>{n}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col gap-[12px] overflow-y-auto px-[20px] pb-[20px] pt-[12px]">
          {visible.length === 0 ? (
            <div
              className="m-auto text-center text-sm"
              style={{ color: 'var(--fg-2)' }}
            >
              Sin leads en este filtro.
            </div>
          ) : (
            visible.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                advisor={advisor}
                onDismiss={() => dismiss(lead.id)}
                onSent={() => {}}
              />
            ))
          )}
        </div>
      </div>

      {/* COL 3: today */}
      <aside
        className="flex flex-col overflow-y-auto"
        style={{
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--border)'
        }}
      >
        <div className="p-[14px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            className="mb-[10px] flex items-center gap-[6px] text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--fg-3)' }}
          >
            <Icon name="chart" size={12} /> Hoy · {advisor.name.split(' ')[0]}
          </div>
          <div className="flex gap-[10px]">
            <StatCard label="Tareas" value={openTasks} delta="+2 vs ayer" />
            <StatCard label="Leads" value={advisor.leads} delta="+3 vs ayer" />
            <StatCard label="🔥 urgentes" value={advisor.hot} delta={null} />
          </div>
        </div>

        <div className="p-[14px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            className="mb-[10px] flex items-center gap-[6px] text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--fg-3)' }}
          >
            <Icon name="calendar" size={12} /> Agenda del día
          </div>
          {tasks.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTask(t.id)}
              className="flex w-full cursor-pointer items-start gap-[10px] py-[8px] text-left text-[13px]"
              style={{
                borderTop: '1px solid color-mix(in oklab, var(--border), transparent 60%)',
                color: t.done ? 'var(--fg-3)' : 'var(--fg-0)',
                textDecoration: t.done ? 'line-through' : 'none'
              }}
            >
              <div
                className="mt-[1px] grid h-[16px] w-[16px] flex-shrink-0 place-items-center rounded-[5px]"
                style={{
                  border: `1.5px solid ${t.done ? 'var(--accent)' : 'var(--border-strong)'}`,
                  background: t.done ? 'var(--accent)' : 'transparent'
                }}
              >
                {t.done && (
                  <div style={{ color: 'var(--accent-ink)' }}>
                    <Icon name="check" size={10} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                {t.text}
                <div
                  className="mt-[2px] text-[11px]"
                  style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
                >
                  {t.meta}
                </div>
              </div>
              <span
                className="whitespace-nowrap rounded-[6px] px-[6px] py-[2px] text-[11px]"
                style={{
                  background: 'var(--bg-2)',
                  color: 'var(--fg-2)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {t.time}
              </span>
            </button>
          ))}
        </div>

        <div className="p-[14px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            className="mb-[10px] flex items-center gap-[6px] text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--fg-3)' }}
          >
            <Icon name="note" size={12} /> Notas del lead
          </div>
          {NOTES.map(n => (
            <div
              key={n.id}
              className="mt-2 rounded-[8px] px-[12px] py-[10px] text-[12.5px] leading-[1.5]"
              style={{
                background: 'color-mix(in oklab, var(--warn), transparent 85%)',
                border: '1px solid color-mix(in oklab, var(--warn), transparent 70%)',
                color: 'var(--fg-0)'
              }}
            >
              {n.text}
              <div
                className="mt-[6px] flex gap-[8px] text-[10.5px]"
                style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
              >
                <span>· {n.who}</span>
                <span>{n.when}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-[14px]">
          <div
            className="mb-[10px] flex items-center gap-[6px] text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--fg-3)' }}
          >
            <Icon name="bell" size={12} /> Recordatorios
          </div>
          <div
            className="text-[12.5px] leading-[1.5]"
            style={{ color: 'var(--fg-1)' }}
          >
            <b>18:00</b> — Revisar pipeline semanal.
            <br />
            <span style={{ color: 'var(--fg-2)' }}>Siguiente lead agendado a las 20:00.</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta
}: {
  label: string;
  value: number | string;
  delta: string | null;
}) {
  return (
    <div
      className="flex-1 rounded-[10px] px-[12px] py-[10px]"
      style={{ background: 'var(--bg-0)', border: '1px solid var(--border)' }}
    >
      <div
        className="text-[20px] font-semibold"
        style={{ letterSpacing: '-0.02em', color: 'var(--fg-0)' }}
      >
        {value}
      </div>
      <div
        className="mt-[2px] text-[10.5px] uppercase tracking-[0.05em]"
        style={{ color: 'var(--fg-2)' }}
      >
        {label}
      </div>
      {delta && (
        <div
          className="mt-[2px] text-[10.5px]"
          style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}
        >
          {delta}
        </div>
      )}
    </div>
  );
}
