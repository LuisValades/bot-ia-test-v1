import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CrediExpres Agentes — Entrenamiento',
  description: 'Dashboard para entrenar los agentes conversacionales de GHL'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
