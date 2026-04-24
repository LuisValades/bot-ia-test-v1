'use client';

import AppShell from '@/components/AppShell';
import TrainingTab from '@/components/TrainingTab';

export default function HomePage() {
  return (
    <AppShell title="Entrenamiento bot" subtitle="Afinar comportamiento de Alejandra">
      <TrainingTab />
    </AppShell>
  );
}
