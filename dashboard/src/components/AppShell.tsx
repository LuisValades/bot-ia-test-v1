'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import GhlStrip from './GhlStrip';

interface Props {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AppShell({ children, title, subtitle }: Props) {
  return (
    <div
      className="grid h-screen w-screen"
      style={{ gridTemplateColumns: '248px 1fr', background: 'var(--bg-0)' }}
    >
      <Sidebar />
      <main className="flex min-w-0 flex-col overflow-hidden">
        <TopBar title={title} subtitle={subtitle} />
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
