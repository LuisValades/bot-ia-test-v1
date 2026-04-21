'use client';

import { useEffect, useState } from 'react';

interface Props {
  agentId: string;
  open: boolean;
  onClose: () => void;
}

export default function PromptModal({ agentId, open, onClose }: Props) {
  const [tab, setTab] = useState<'prompt' | 'knowledge'>('prompt');
  const [data, setData] = useState<{ prompt: string; knowledge: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !agentId) return;
    setLoading(true);
    fetch(`/api/agent-files?id=${agentId}`)
      .then(r => r.json())
      .then(d => setData({ prompt: d.prompt || '', knowledge: d.knowledge || '' }))
      .catch(() => setData({ prompt: '', knowledge: '' }))
      .finally(() => setLoading(false));
  }, [open, agentId]);

  if (!open) return null;

  const current = tab === 'prompt' ? data?.prompt : data?.knowledge;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Archivos del agente</h2>
            <p className="text-xs text-slate-500">Lectura · mismo contenido que usa en producción</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </header>

        <div className="border-b bg-slate-50 px-6">
          <div className="flex gap-1">
            <TabButton active={tab === 'prompt'} onClick={() => setTab('prompt')}>
              📝 Prompt
            </TabButton>
            <TabButton active={tab === 'knowledge'} onClick={() => setTab('knowledge')}>
              📚 Knowledge
            </TabButton>
          </div>
        </div>

        <div className="scroll-fade flex-1 overflow-y-auto bg-slate-50 p-6">
          {loading ? (
            <div className="text-center text-sm text-slate-500">Cargando…</div>
          ) : (
            <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
              {current || '(vacío)'}
            </pre>
          )}
        </div>

        <footer className="border-t px-6 py-3 text-xs text-slate-500">
          {current ? `${current.length.toLocaleString()} caracteres` : ''}
        </footer>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium transition ${
        active
          ? 'border-b-2 border-blue-600 text-blue-700'
          : 'border-b-2 border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}
