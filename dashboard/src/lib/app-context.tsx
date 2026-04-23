'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { AGENTS, type Agent } from './agents';

type Theme = 'dark' | 'light';

interface AppContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  agent: Agent;
  setAgentId: (id: string) => void;
}

const AppCtx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [agentId, setAgentIdState] = useState<string>(AGENTS[0].id);

  useEffect(() => {
    const t = (localStorage.getItem('dash_theme') as Theme | null) || 'dark';
    const a = localStorage.getItem('dash_agent') || AGENTS[0].id;
    setThemeState(t);
    setAgentIdState(a);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('dash_theme', t);
  };

  const setAgentId = (id: string) => {
    setAgentIdState(id);
    localStorage.setItem('dash_agent', id);
  };

  const agent = AGENTS.find(a => a.id === agentId) || AGENTS[0];

  return (
    <AppCtx.Provider value={{ theme, setTheme, agent, setAgentId }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
