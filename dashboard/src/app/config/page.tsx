'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';

interface ConfigData {
  model: string;
  trainerUrl: string;
  autoCommit: boolean;
  autoPush: boolean;
  envAutoCommit: boolean;
  envAutoPush: boolean;
}

export default function ConfigPage() {
  const [cfg, setCfg] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/config')
      .then(r => r.json())
      .then(setCfg)
      .catch(() => setCfg(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (key: 'autoCommit' | 'autoPush', value: boolean) => {
    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setCfg(prev => (prev ? { ...prev, ...data } : prev));
    } catch (err: any) {
      alert(`⚠️ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Configuración" subtitle="Controles del Trainer en tiempo de ejecución" />

      <div className="scroll-fade flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="text-center text-sm text-slate-500">Cargando…</div>
        ) : !cfg ? (
          <div className="text-center text-sm text-slate-500">
            No pude contactar al Trainer en <code>{process.env.TRAINER_URL || 'http://localhost:4000'}</code>
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">
            <section className="card p-6">
              <h2 className="mb-4 text-base font-semibold">Estado del Trainer</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <InfoRow label="URL">{cfg.trainerUrl}</InfoRow>
                <InfoRow label="Modelo OpenRouter">{cfg.model}</InfoRow>
              </dl>
            </section>

            <section className="card p-6">
              <h2 className="mb-1 text-base font-semibold">Auto-commit</h2>
              <p className="mb-4 text-sm text-slate-500">
                Cuando se aplique un patch, automáticamente hacer commit del cambio.
              </p>
              <Toggle
                checked={cfg.autoCommit}
                onChange={v => toggle('autoCommit', v)}
                disabled={saving}
                labelOn="Activado"
                labelOff="Desactivado"
              />
              <p className="mt-2 text-xs text-slate-400">
                Env default: <code>{cfg.envAutoCommit ? 'true' : 'false'}</code>
              </p>
            </section>

            <section className="card p-6">
              <h2 className="mb-1 text-base font-semibold">Auto-push</h2>
              <p className="mb-4 text-sm text-slate-500">
                Después del commit, hacer push al repo remoto (GitHub → Modal redeploya en producción).
              </p>
              <Toggle
                checked={cfg.autoPush}
                onChange={v => toggle('autoPush', v)}
                disabled={saving}
                labelOn="🚀 Activado — producción se actualiza al instante"
                labelOff="⏸ Desactivado — cambios solo locales"
              />
              <p className="mt-2 text-xs text-slate-400">
                Env default: <code>{cfg.envAutoPush ? 'true' : 'false'}</code>
              </p>
              {cfg.autoPush && (
                <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ⚠️ Cuando esto está activado, cada 👎 que aceptes se sube a GitHub y Modal redeploya
                  Alejandra en producción inmediatamente.
                </div>
              )}
            </section>

            <section className="card p-6">
              <h2 className="mb-4 text-base font-semibold">Cambiar defaults permanentemente</h2>
              <p className="text-sm text-slate-500">
                El toggle de arriba solo dura hasta que reinicies el Trainer. Para que persista, edita{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">trainer/.env</code>:
              </p>
              <pre className="mt-3 rounded-md bg-slate-900 p-4 text-xs text-slate-100">
{`GIT_AUTO_COMMIT=true
GIT_AUTO_PUSH=true`}
              </pre>
              <p className="mt-2 text-xs text-slate-400">Luego reinicia: <code>npm run dev</code></p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="font-mono text-sm">{children}</dd>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  labelOn,
  labelOff
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition ${
        checked
          ? 'border-green-300 bg-green-50 text-green-800'
          : 'border-slate-300 bg-slate-50 text-slate-700'
      } ${disabled ? 'cursor-wait opacity-60' : 'hover:shadow'}`}
    >
      <span
        className={`inline-block h-5 w-9 rounded-full transition ${
          checked ? 'bg-green-500' : 'bg-slate-300'
        } relative`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
      <span>{checked ? labelOn : labelOff}</span>
    </button>
  );
}
