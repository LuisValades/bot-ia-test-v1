'use client';

import AppShell from '@/components/AppShell';
import TrainingTab from '@/components/TrainingTab';

export default function EntrenarPage() {
  return (
    <AppShell title="Entrenamiento bot" subtitle="Conversa como lead y ajusta conocimiento">
      <TrainingTab />
    </AppShell>
  );
}
