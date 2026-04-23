'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import SuggestionsTab from '@/components/SuggestionsTab';
import TrainingTab from '@/components/TrainingTab';
import type { Tab } from '@/components/TopBar';
import { LEADS } from '@/lib/advisors-data';

export default function HomePage() {
  const [tab, setTabState] = useState<Tab>('suggestions');

  useEffect(() => {
    const saved = (localStorage.getItem('dash_tab') as Tab | null) || 'suggestions';
    setTabState(saved);
  }, []);

  const setTab = (t: Tab) => {
    setTabState(t);
    localStorage.setItem('dash_tab', t);
  };

  const openLeads = LEADS.filter(l => !l.dismissed).length;

  return (
    <AppShell
      tab={tab}
      onTabChange={setTab}
      showTabs
      suggestionsCount={openLeads}
    >
      {tab === 'suggestions' ? <SuggestionsTab /> : <TrainingTab />}
    </AppShell>
  );
}
