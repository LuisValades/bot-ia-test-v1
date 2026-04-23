'use client';

import Icon from './Icon';
import { useApp } from '@/lib/app-context';

export type Tab = 'suggestions' | 'training';

interface Props {
  tab?: Tab;
  onTabChange?: (t: Tab) => void;
  title?: string;
  subtitle?: string;
  showTabs?: boolean;
  suggestionsCount?: number;
}

export default function TopBar({
  tab,
  onTabChange,
  title,
  subtitle,
  showTabs = false,
  suggestionsCount = 0
}: Props) {
  const { theme, setTheme } = useApp();

  return (
    <div
      className="flex h-[52px] flex-shrink-0 items-center gap-[18px] px-4 pl-16 md:px-[20px] md:pl-[20px]"
      style={{
        background: 'var(--bg-0)',
        borderBottom: '1px solid var(--border)'
      }}
    >
      {showTabs && tab && onTabChange ? (
        <div
          className="flex gap-[2px] overflow-x-auto rounded-[10px] p-[3px]"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
        >
          <TabBtn active={tab === 'suggestions'} onClick={() => onTabChange('suggestions')}>
            <Icon name="sparkles" size={14} /> Actividades asesores
            {suggestionsCount > 0 && (
              <span
                className="rounded-[8px] px-[6px] py-[1px] text-[10px] font-semibold"
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {suggestionsCount}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === 'training'} onClick={() => onTabChange('training')}>
            <Icon name="book" size={14} /> Entrenamiento bot
            <span
              className="rounded-[8px] px-[6px] py-[1px] text-[10px] font-semibold"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              MD
            </span>
          </TabBtn>
        </div>
      ) : (
        <div className="min-w-0">
          {title && (
            <div className="truncate text-[15px] font-semibold" style={{ color: 'var(--fg-0)' }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div className="truncate text-[11.5px]" style={{ color: 'var(--fg-2)' }}>
              {subtitle}
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="btn hidden md:inline-flex"
        style={{ fontSize: '12.5px' }}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={13} />
        {theme === 'dark' ? 'Claro' : 'Oscuro'}
      </button>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-[8px] whitespace-nowrap rounded-[7px] px-[14px] py-[7px] text-[13px] font-medium transition-all"
      style={{
        color: active ? 'var(--fg-0)' : 'var(--fg-1)',
        background: active ? 'var(--bg-0)' : 'transparent',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        cursor: 'pointer',
        border: 'none',
        fontFamily: 'inherit'
      }}
    >
      {children}
    </button>
  );
}
