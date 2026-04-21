import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'CrediExpres Agentes — Entrenamiento',
  description: 'Dashboard para entrenar los agentes conversacionales de GHL'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
