'use client';

import { useApp } from '@/lib/app-context';

export default function GhlStrip() {
  const { agent } = useApp();
  return (
    <div
      className="flex items-center gap-[12px] overflow-x-auto whitespace-nowrap px-[20px] py-[8px] text-[12.5px]"
      style={{
        background: 'linear-gradient(90deg, var(--bg-1), var(--bg-0))',
        borderBottom: '1px solid var(--border)',
        color: 'var(--fg-1)'
      }}
    >
      <span
        className="inline-block h-[6px] w-[6px] flex-shrink-0 rounded-full"
        style={{
          background: 'var(--success)',
          boxShadow: '0 0 0 3px color-mix(in oklab, var(--success), transparent 80%)',
          animation: 'pulse-dot 2.4s ease-in-out infinite'
        }}
      />
      <span>GHL conectado:</span>
      <span style={{ color: 'var(--fg-0)', fontWeight: 500 }}>Crediexpres México</span>
      <span className="h-[14px] w-[1px]" style={{ background: 'var(--border)' }} />
      <span
        style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}
      >
        location_id: kfPM0DMEUT6fPe2PEZb3
      </span>
      <span className="h-[14px] w-[1px]" style={{ background: 'var(--border)' }} />
      <span
        style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}
      >
        modelo: {agent.status === 'production' ? 'gpt-4o-mini · Modal' : 'placeholder'}
      </span>
      <div className="flex-1" />
      <span
        className="hidden md:inline"
        style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}
      >
        agente activo: {agent.name}
      </span>
    </div>
  );
}
