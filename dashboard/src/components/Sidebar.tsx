'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/entrenar', label: 'Entrenar', icon: '🎯' },
  { href: '/conocimiento', label: 'Conocimiento', icon: '📚' },
  { href: '/metricas', label: 'Métricas', icon: '📊' },
  { href: '/historial', label: 'Historial', icon: '📜' },
  { href: '/config', label: 'Configuración', icon: '⚙️' }
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="flex w-64 flex-shrink-0 flex-col text-slate-200"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-lg font-bold">C</div>
          <div>
            <div className="text-sm font-semibold text-white">CrediExpres</div>
            <div className="text-xs text-slate-400">Agentes GHL</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(item => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-5 py-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400"></span>
          <span>Trainer activo :4000</span>
        </div>
      </div>
    </aside>
  );
}
