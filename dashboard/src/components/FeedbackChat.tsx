'use client';

import { useEffect, useRef, useState } from 'react';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ProposedPatch {
  target_file: 'prompt' | 'knowledge';
  action: 'add_to_existing' | 'append_section' | 'modify_section';
  section_title: string;
  new_content: string;
  reasoning?: string;
}

interface AnalyzerResponse {
  action: 'ask' | 'propose' | 'apply';
  message: string;
  rationale?: string;
  proposed_patch?: ProposedPatch;
  final_patch?: ProposedPatch;
  error?: string;
}

interface Props {
  agentId: string;
  conversation: Array<{ role: string; content: string }>;
  badResponseIndex: number;
  initialFeedback: string;
  open: boolean;
  onClose: () => void;
  onApplied: (summary: string) => void;
}

export default function FeedbackChat({
  agentId,
  conversation,
  badResponseIndex,
  initialFeedback,
  open,
  onClose,
  onApplied
}: Props) {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposedPatch, setProposedPatch] = useState<ProposedPatch | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setChat([]);
      setInput('');
      setProposedPatch(null);
      bootstrap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat, loading]);

  const callAnalyzer = async (history: ChatMessage[]): Promise<AnalyzerResponse> => {
    const res = await fetch('/api/feedback-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: agentId,
        conversation,
        badResponseIndex,
        initialFeedback,
        chatHistory: history
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del analizador');
    return data;
  };

  const handleResponse = (data: AnalyzerResponse, history: ChatMessage[]) => {
    const newAssistant: ChatMessage = { role: 'assistant', content: data.message || '(sin mensaje)' };
    setChat([...history, newAssistant]);
    if (data.action === 'propose' && data.proposed_patch) {
      setProposedPatch(data.proposed_patch);
    }
    if (data.action === 'apply' && data.final_patch) {
      // auto-apply when analyzer decides
      applyPatch(data.final_patch);
    }
  };

  const bootstrap = async () => {
    setLoading(true);
    try {
      const data = await callAnalyzer([]);
      handleResponse(data, []);
    } catch (err: any) {
      setChat([{ role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...chat, userMsg];
    setChat(next);
    setInput('');
    setLoading(true);
    setProposedPatch(null);
    try {
      const data = await callAnalyzer(next);
      handleResponse(data, next);
    } catch (err: any) {
      setChat([...next, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const applyPatch = async (patch: ProposedPatch) => {
    setLoading(true);
    try {
      const feedbackSummary =
        initialFeedback + (chat.length ? '\n---clarif:\n' + chat.map(m => `[${m.role}] ${m.content}`).join('\n') : '');
      const res = await fetch('/api/feedback-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agentId,
          patch,
          feedbackSummary,
          chatHistory: chat
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error aplicando patch');

      let summary = `✅ Aplicado a ${data.target}.md → sección "${data.section}"`;
      if (data.git?.committed) summary += ` · commit ${data.git.commitSha?.slice(0, 7)}`;
      if (data.git?.pushed) summary += ' · pushed';
      onApplied(summary);
    } catch (err: any) {
      alert(`⚠️ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">🎯 Analizador de Feedback</h2>
            <p className="text-xs text-slate-500">
              Te voy a preguntar lo necesario para entender tu corrección antes de aplicarla al .md
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </header>

        <div className="border-b bg-amber-50 px-6 py-2 text-xs text-amber-800">
          <strong>Feedback inicial:</strong> {initialFeedback}
        </div>

        <div ref={scrollRef} className="scroll-fade flex-1 space-y-3 overflow-y-auto p-6">
          {chat.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'rounded-br-sm bg-blue-600 text-white'
                    : 'rounded-bl-sm bg-slate-100 text-slate-900'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="mb-1 text-xs font-semibold text-slate-500">Analizador</div>
                )}
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-400">
                <span className="animate-pulse">Pensando…</span>
              </div>
            </div>
          )}

          {proposedPatch && !loading && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm">
              <div className="mb-2 font-semibold text-blue-900">📝 Cambio propuesto</div>
              <dl className="space-y-1 text-xs text-slate-700">
                <div>
                  <dt className="inline font-semibold">Archivo:</dt>{' '}
                  <code className="rounded bg-white px-1 py-0.5">{proposedPatch.target_file}.md</code>
                </div>
                <div>
                  <dt className="inline font-semibold">Acción:</dt>{' '}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      proposedPatch.action === 'modify_section'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {proposedPatch.action}
                  </span>
                </div>
                <div>
                  <dt className="inline font-semibold">Sección:</dt> {proposedPatch.section_title}
                </div>
              </dl>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-blue-700">
                  Ver contenido propuesto
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-white p-2 text-xs">
                  {proposedPatch.new_content}
                </pre>
              </details>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => applyPatch(proposedPatch)}
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  ✅ Aplicar este cambio
                </button>
                <button
                  onClick={() => setProposedPatch(null)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Pedir ajustes
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="flex gap-2 border-t p-4">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Responde al analizador…"
            disabled={loading}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50"
            autoFocus
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar
          </button>
        </footer>
      </div>
    </div>
  );
}
