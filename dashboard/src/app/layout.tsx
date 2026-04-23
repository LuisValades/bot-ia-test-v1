import type { Metadata, Viewport } from 'next';
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/lib/app-context';

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap'
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Crediexpres · Agentes GHL',
  description: 'Dashboard de entrenamiento y actividades de asesores'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" className={`${interTight.variable} ${jetbrains.variable}`}>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
