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
      className="grid h-[100dvh] w-screen grid-cols-1 md:grid-cols-[248px_1fr]"
      style={{ background: 'var(--bg-0)' }}
    >
      <Sidebar />
      <main className="flex min-w-0 flex-col overflow-hidden">
        <TopBar title={title} subtitle={subtitle} />
        <GhlStrip />
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
