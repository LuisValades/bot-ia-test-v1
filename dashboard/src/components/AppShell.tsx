'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar, { type Tab } from './TopBar';
import GhlStrip from './GhlStrip';

interface Props {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  tab?: Tab;
  onTabChange?: (t: Tab) => void;
  showTabs?: boolean;
  suggestionsCount?: number;
}

export default function AppShell({
  children,
  title,
  subtitle,
  tab,
  onTabChange,
  showTabs = false,
  suggestionsCount = 0
}: Props) {
  return (
    <div
      className="grid h-screen w-screen"
      style={{ gridTemplateColumns: '248px 1fr', background: 'var(--bg-0)' }}
    >
      <Sidebar />
      <main className="flex min-w-0 flex-col overflow-hidden">
        <TopBar
          title={title}
          subtitle={subtitle}
          tab={tab}
          onTabChange={onTabChange}
          showTabs={showTabs}
          suggestionsCount={suggestionsCount}
        />
        <GhlStrip />
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </main>
      <style jsx>{`
        @media (max-width: 767px) {
          div[style*='grid-template-columns: 248px 1fr'] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
