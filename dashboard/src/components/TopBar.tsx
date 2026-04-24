'use client';

import Icon from './Icon';
import { useApp } from '@/lib/app-context';

interface Props {
  title?: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: Props) {
  const { theme, setTheme } = useApp();

  return (
    <div
      className="flex h-[52px] flex-shrink-0 items-center gap-[18px] px-4 pl-16 md:px-[20px] md:pl-[20px]"
      style={{
        background: 'var(--bg-0)',
        borderBottom: '1px solid var(--border)'
      }}
    >
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
