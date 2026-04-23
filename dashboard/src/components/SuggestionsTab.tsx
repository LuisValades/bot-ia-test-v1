'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import LeadCard from './LeadCard';
import {
  ADVISORS as MOCK_ADVISORS,
  LEADS as MOCK_LEADS,
  TASKS_TODAY,
  NOTES,
  type Advisor,
  type Lead,
  type Task
} from '@/lib/advisors-data';

type Filter = 'all' | 'hot' | 'warm' | 'new' | 'cold';
type Mode = 'loading' | 'live' | 'mock' | 'error';

export default function SuggestionsTab() {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [advisorMode, setAdvisorMode] = useState<Mode>('loading');
  const [advisorId, setAdvisorId] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsMode, setLeadsMode] = useState<Mode>('loading');
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [tasks, setTasks] = useState<Task[]>(TASKS_TODAY);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  // Advisors
  useEffect(() => {
    let off = false;
    setAdvisorMode('loading');
    fetch('/api/ghl/advisors')
      .then(r => r.json())
      .then(data => {
        if (off) return;
        if (data.advisors && data.advisors.length) {
          const list: Advisor[] = data.advisors.map((a: any) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            color: a.color,
            leads: 0,
            hot: 0
          }));
          setAdvisors(list);
          setAdvisorId(prev => prev || list[0].id);
          setAdvisorMode('live');
        } else {
          setAdvisors(MOCK_ADVISORS);
          setAdvisorId(MOCK_ADVISORS[0].id);
          setAdvisorMode('mock');
        }
      })
      .catch(() => {
        if (off) return;
        setAdvisors(MOCK_ADVISORS);
        setAdvisorId(MOCK_ADVISORS[0].id);
        setAdvisorMode('mock');
      });
    return () => {
      off = true;
    };
  }, []);

  // Leads
  useEffect(() => {
    if (!advisorId) return;
    let off = false;
    setLeadsMode('loading');
    setLeadsError(null);
    fetch(`/api/ghl/leads?advisor=${encodeURIComponent(advisorId)}`)
      .then(async r => {
        const data = await r.json();
        if (off) return;
        if (!r.ok) {
          setLeadsError(data.error || `HTTP ${r.status}`);
          // fallback mock de ese advisor si coincide id
          const fromMock = MOCK_LEADS.filter(l => l.advisorId === advisorId);
          setLeads(fromMock);
          setLeadsMode(fromMock.length ? 'mock' : 'error');
          return;
        }
        if (data.leads && data.leads.length) {
          setLeads(data.leads);
          setLeadsMode('live');
        } else {
          // sin leads en GHL → mostrar vacío live (no mock)
          setLeads([]);
          setLeadsMode('live');
        }
      })
      .catch(err => {
        if (off) return;
        setLeadsError(err.message);
        const fromMock = MOCK_LEADS.filter(l => l.advisorId === advisorId);
        setLeads(fromMock);
        setLeadsMode(fromMock.length ? 'mock' : 'error');
      });
    return () => {
      off = true;
    };
  }, [advisorId, refreshKey]);

  const advisor = advisors.find(a => a.id === advisorId) || advisors[0];

  const leadsForAdvisor = useMemo(
    () => leads.filter(l => !dismissed.has(l.id)),
    [leads, dismissed]
  );

  const visible = useMemo(() => {
    if (filter === 'all') return leadsForAdvisor;
    return leadsForAdvisor.filter(l => l.tag === filter);
  }, [leadsForAdvisor, filter]);

  const counts = useMemo(
    () => ({
      all: leadsForAdvisor.length,
      hot: leadsForAdvisor.filter(l => l.tag === 'hot').length,
      warm: leadsForAdvisor.filter(l => l.tag === 'warm').length,
      new: leadsForAdvisor.filter(l => l.tag === 'new').length,
      cold: leadsForAdvisor.filter(l => l.tag === 'cold').length
    }),
    [leadsForAdvisor]
  );

  const toggleTask = (id: string) =>
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, done: !t.done } : t)));

  const openTasks = tasks.filter(t => !t.done).length;

  if (!advisor) {
    return (
      <div className="m-auto p-8 text-center text-sm" style={{ color: 'var(--fg-2)' }}>
        Cargando asesores…
      </div>
    );
  }

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
        style={{ background: 'var(--bg-1)', borderRight: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center gap-2 px-4 pb-[10px] pt-[14px] text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-3)', borderBottom: '1px solid var(--border)' }}
        >
          <Icon name="users" size={12} />
          Asesores {advisorMode === 'live' ? '(GHL)' : advisorMode === 'mock' ? '(mock)' : ''}
          <span className="ml-auto" style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
            {advisors.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {advisors.map(a => {
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
                    {a.role}
                  </div>
                </div>
              </button>
            );
          })}
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
              {leadsMode === 'loading' && 'cargando GHL…'}
              {leadsMode === 'live' && `${leads.length} conversaciones últimas 24h · GHL en vivo`}
              {leadsMode === 'mock' && 'datos mock · el GHL real no respondió'}
              {leadsMode === 'error' && `error GHL · ${leadsError}`}
            </div>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setRefreshKey(k => k + 1)}
            className="btn btn-ghost"
            disabled={leadsMode === 'loading'}
          >
            <Icon name="refresh" size={13} /> Actualizar
          </button>
        </div>

        {leadsMode === 'mock' && (
          <div
            className="px-[20px] py-[8px] text-[12px]"
            style={{
              background: 'color-mix(in oklab, var(--warn), transparent 88%)',
              borderBottom: '1px solid color-mix(in oklab, var(--warn), transparent 70%)',
              color: 'var(--warn)'
            }}
          >
            ⚠️ Mostrando datos mock. {leadsError ? `Error: ${leadsError}` : 'GHL no configurado o sin leads.'}
          </div>
        )}

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
              ['cold', 'Fríos', counts.cold]
            ] as const
          ).map(([k, lbl, n]) => {
            const active = filter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className="rounded-[16px] px-[10px] py-[4px] text-[12px] font-medium"
                style={{
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--bg-1)',
                  color: active ? 'var(--accent)' : 'var(--fg-1)',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                {lbl} <span style={{ opacity: 0.6, fontFamily: 'var(--font-mono)' }}>{n}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col gap-[12px] overflow-y-auto px-[20px] pb-[20px] pt-[12px]">
          {leadsMode === 'loading' ? (
            <div className="m-auto text-center text-sm" style={{ color: 'var(--fg-2)' }}>
              Cargando leads de GHL…
            </div>
          ) : visible.length === 0 ? (
            <div className="m-auto text-center text-sm" style={{ color: 'var(--fg-2)' }}>
              {leadsMode === 'live' && leads.length === 0
                ? `No hay conversaciones últimas 24h asignadas a ${advisor.name}.`
                : 'Sin leads en este filtro.'}
            </div>
          ) : (
            visible.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                advisor={advisor}
                onDismiss={() => setDismissed(prev => new Set(prev).add(lead.id))}
                onSent={() => {}}
              />
            ))
          )}
        </div>
      </div>

      {/* COL 3: today */}
      <aside
        className="flex flex-col overflow-y-auto"
        style={{ background: 'var(--bg-1)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="p-[14px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            className="mb-[10px] flex items-center gap-[6px] text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--fg-3)' }}
          >
            <Icon name="chart" size={12} /> Hoy · {advisor.name.split(' ')[0]}
          </div>
          <div className="flex gap-[10px]">
            <StatCard label="Tareas" value={openTasks} />
            <StatCard label="Leads 24h" value={leads.length} />
            <StatCard label="🔥" value={counts.hot} />
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
            <Icon name="note" size={12} /> Notas de lead
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
          <div className="text-[12.5px] leading-[1.5]" style={{ color: 'var(--fg-1)' }}>
            <b>18:00</b> — Revisar pipeline semanal.
            <br />
            <span style={{ color: 'var(--fg-2)' }}>Siguiente lead agendado 20:00.</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
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
    </div>
  );
}
