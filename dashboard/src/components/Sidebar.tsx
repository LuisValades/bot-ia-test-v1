'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { AGENTS } from '@/lib/agents';
import { useApp } from '@/lib/app-context';

const navItems = [
  { href: '/', label: 'Inicio', icon: 'home' as const },
  { href: '/entrenar', label: 'Entrenar', icon: 'chat' as const },
  { href: '/conocimiento', label: 'Conocimiento', icon: 'book' as const },
  { href: '/metricas', label: 'Métricas', icon: 'chart' as const },
  { href: '/historial', label: 'Historial', icon: 'note' as const },
  { href: '/config', label: 'Configuración', icon: 'settings' as const }
];

const agentColors: Record<string, string> = {
  alejandra: 'linear-gradient(135deg, oklch(0.75 0.14 200), oklch(0.65 0.17 250))',
  'agente-2': 'linear-gradient(135deg, oklch(0.78 0.14 155), oklch(0.70 0.15 195))',
  'agente-3': 'linear-gradient(135deg, oklch(0.78 0.14 355), oklch(0.72 0.15 30))'
};

export default function Sidebar() {
  const pathname = usePathname();
  const { agent: activeAgent, setAgentId } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-md md:hidden"
        style={{
          border: '1px solid var(--border)',
          background: 'var(--bg-1)',
          color: 'var(--fg-1)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <Icon name="menu" size={18} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-shrink-0 flex-col transition-transform duration-200 md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{
          background: 'var(--bg-1)',
          borderRight: '1px solid var(--border)'
        }}
      >
        <div
          className="flex items-center justify-between px-[18px] py-[18px]"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-[10px]">
            <div
              className="grid h-[30px] w-[30px] place-items-center rounded-lg text-sm font-bold"
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--violet) 100%)',
                color: 'var(--accent-ink)',
                boxShadow: '0 0 0 1px var(--border-strong) inset, 0 0 18px var(--accent-glow)'
              }}
            >
              C
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight" style={{ color: 'var(--fg-0)' }}>
                Crediexpres
              </div>
              <div
                className="mt-[2px] text-[11px]"
                style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}
              >
                hipotecario · pyme · ghl
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-md md:hidden"
            style={{ color: 'var(--fg-2)' }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div
          className="px-[14px] pb-[6px] pt-[16px] text-[10.5px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-3)' }}
        >
          Espacio
        </div>
        <div className="flex flex-col gap-[1px] px-2 py-[2px]">
          {navItems.map(item => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex cursor-pointer select-none items-center gap-[10px] rounded-[6px] px-[14px] py-2 text-[13.5px]"
                style={{
                  background: active ? 'var(--bg-3)' : 'transparent',
                  color: active ? 'var(--fg-0)' : 'var(--fg-1)'
                }}
              >
                {active && (
                  <span
                    className="absolute -left-2 top-[6px] bottom-[6px] w-[2px] rounded"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div
          className="px-[14px] pb-[6px] pt-[16px] text-[10.5px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-3)' }}
        >
          Agentes ({AGENTS.length})
        </div>
        <div className="flex-1 overflow-y-auto pb-3">
          {AGENTS.map(a => {
            const isActive = activeAgent.id === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAgentId(a.id)}
                className="mx-[10px] my-[2px] flex w-[calc(100%-20px)] cursor-pointer items-center gap-[10px] rounded-[10px] px-[12px] py-[10px] transition-all"
                style={{
                  background: isActive ? 'var(--bg-2)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--border-strong)' : 'transparent'}`,
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
                }}
              >
                <div
                  className="relative grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-[10px] text-[13px] font-semibold text-white"
                  style={{ background: agentColors[a.id] || agentColors.alejandra }}
                >
                  {a.name[0]}
                  <span
                    className="absolute -bottom-[1px] -right-[1px] h-[9px] w-[9px] rounded-full"
                    style={{
                      background: a.status === 'production' ? 'var(--success)' : 'var(--fg-3)',
                      border: '2px solid var(--bg-1)'
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div
                    className="truncate text-[13px] font-medium"
                    style={{ color: 'var(--fg-0)' }}
                  >
                    {a.name}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{
                      color: 'var(--fg-2)',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    {a.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="flex items-center gap-[10px] px-[14px] py-[12px]"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div
            className="grid h-[30px] w-[30px] place-items-center rounded-full text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, var(--violet), var(--pink))' }}
          >
            L
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-medium">Luis V.</div>
            <div
              className="text-[11px]"
              style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
            >
              Admin · Crediexpres
            </div>
          </div>
          <Icon name="settings" size={14} />
        </div>
      </aside>
    </>
  );
}
