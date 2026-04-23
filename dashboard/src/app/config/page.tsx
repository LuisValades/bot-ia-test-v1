'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';

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
    <AppShell title="Configuración" subtitle="Controles del Trainer en tiempo de ejecución">
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {loading ? (
          <div className="text-center text-sm" style={{ color: 'var(--fg-2)' }}>
            Cargando…
          </div>
        ) : !cfg ? (
          <div className="text-center text-sm" style={{ color: 'var(--fg-2)' }}>
            No pude contactar al Trainer.
          </div>
        ) : (
          <div className="max-w-2xl space-y-4">
            <section className="card p-[16px]">
              <h2 className="mb-3 text-[14px] font-semibold">Estado del Trainer</h2>
              <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
                <Info label="URL">{cfg.trainerUrl}</Info>
                <Info label="Modelo">{cfg.model}</Info>
              </dl>
            </section>

            <section className="card p-[16px]">
              <h2 className="mb-1 text-[14px] font-semibold">Auto-commit</h2>
              <p className="mb-3 text-[12.5px]" style={{ color: 'var(--fg-2)' }}>
                Commit automático al aplicar patch.
              </p>
              <Toggle
                checked={cfg.autoCommit}
                onChange={v => toggle('autoCommit', v)}
                disabled={saving}
                labelOn="Activado"
                labelOff="Desactivado"
              />
            </section>

            <section className="card p-[16px]">
              <h2 className="mb-1 text-[14px] font-semibold">Auto-push</h2>
              <p className="mb-3 text-[12.5px]" style={{ color: 'var(--fg-2)' }}>
                Push automático tras commit.
              </p>
              <Toggle
                checked={cfg.autoPush}
                onChange={v => toggle('autoPush', v)}
                disabled={saving}
                labelOn="🚀 Activado — prod se actualiza"
                labelOff="⏸ Desactivado — solo local"
              />
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt
        className="text-[10.5px] uppercase tracking-[0.05em]"
        style={{ color: 'var(--fg-2)' }}
      >
        {label}
      </dt>
      <dd className="text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-0)' }}>
        {children}
      </dd>
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
      className="flex items-center gap-[12px] rounded-[10px] px-[14px] py-[10px] text-[13px] font-medium"
      style={{
        border: `1px solid ${checked ? 'var(--success)' : 'var(--border)'}`,
        background: checked ? 'color-mix(in oklab, var(--success), transparent 82%)' : 'var(--bg-1)',
        color: checked ? 'var(--success)' : 'var(--fg-1)',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontFamily: 'inherit'
      }}
    >
      <span
        className="relative inline-block h-[18px] w-[32px] rounded-full"
        style={{ background: checked ? 'var(--success)' : 'var(--bg-3)' }}
      >
        <span
          className="absolute top-[2px] h-[14px] w-[14px] rounded-full"
          style={{
            background: 'var(--bg-0)',
            left: checked ? '16px' : '2px',
            transition: 'left 0.15s ease'
          }}
        />
      </span>
      <span>{checked ? labelOn : labelOff}</span>
    </button>
  );
}
