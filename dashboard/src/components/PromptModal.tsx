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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-lg bg-white shadow-2xl md:h-[85vh] md:rounded-lg">
        <header className="flex items-center justify-between border-b px-4 py-3 md:px-6 md:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold md:text-lg">Archivos del agente</h2>
            <p className="text-xs text-slate-500">Lectura · mismo contenido que usa en producción</p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </header>

        <div className="border-b bg-slate-50 px-4 md:px-6">
          <div className="flex gap-1">
            <TabButton active={tab === 'prompt'} onClick={() => setTab('prompt')}>
              📝 Prompt
            </TabButton>
            <TabButton active={tab === 'knowledge'} onClick={() => setTab('knowledge')}>
              📚 Knowledge
            </TabButton>
          </div>
        </div>

        <div className="scroll-fade flex-1 overflow-auto bg-slate-50 p-4 md:p-6">
          {loading ? (
            <div className="text-center text-sm text-slate-500">Cargando…</div>
          ) : (
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
              {current || '(vacío)'}
            </pre>
          )}
        </div>

        <footer className="border-t px-4 py-3 text-xs text-slate-500 md:px-6">
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
