'use client';

import { useState, useRef, useEffect } from 'react';
import { AGENTS, type Agent } from '@/lib/agents';

type Role = 'user' | 'assistant';

interface Message {
  role: Role;
  content: string;
  feedback?: 'good' | 'bad' | null;
  feedbackText?: string;
  feedbackSent?: boolean;
}

export default function Page() {
  const [activeAgent, setActiveAgent] = useState<Agent>(AGENTS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const switchAgent = (agent: Agent) => {
    if (agent.id === activeAgent.id) return;
    if (messages.length > 0 && !confirm('Cambiar de agente limpiará la conversación. ¿Continuar?')) return;
    setActiveAgent(agent);
    setMessages([]);
    setFeedbackIndex(null);
    setFeedbackText('');
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: activeAgent.id, messages: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al llamar al agente');
      setMessages([...next, { role: 'assistant', content: data.reply, feedback: null }]);
    } catch (err: any) {
      setMessages([...next, { role: 'assistant', content: `⚠️ ${err.message}`, feedback: null }]);
    } finally {
      setSending(false);
    }
  };

  const markGood = (idx: number) => {
    setMessages(prev => prev.map((m, i) => (i === idx ? { ...m, feedback: 'good', feedbackSent: true } : m)));
  };

  const openBadFeedback = (idx: number) => {
    setFeedbackIndex(idx);
    setFeedbackText('');
  };

  const submitBadFeedback = async () => {
    if (feedbackIndex === null || !feedbackText.trim()) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: activeAgent.id,
          conversation: messages,
          badResponseIndex: feedbackIndex,
          feedback: feedbackText.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error enviando feedback');

      setMessages(prev =>
        prev.map((m, i) =>
          i === feedbackIndex
            ? { ...m, feedback: 'bad', feedbackText: feedbackText.trim(), feedbackSent: true }
            : m
        )
      );

      let summary = '✅ Feedback registrado.';
      if (data.patchApplied) {
        summary = `✅ Aplicado a ${data.target}.md → sección "${data.section}"`;
        if (data.git?.committed) summary += ` · commit ${data.git.commitSha?.slice(0, 7)}`;
        if (data.git?.pushed) summary += ' · pushed';
      } else if (data.skipped) {
        summary = `ℹ️ ${data.reason || 'Feedback guardado sin aplicar.'}`;
      }
      alert(summary);
      setFeedbackIndex(null);
      setFeedbackText('');
    } catch (err: any) {
      alert(`⚠️ ${err.message}`);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const clearChat = () => {
    if (messages.length === 0) return;
    if (!confirm('¿Borrar la conversación actual?')) return;
    setMessages([]);
    setFeedbackIndex(null);
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">CrediExpres Agentes — Entrenamiento</h1>
            <p className="text-sm text-slate-500">Conversa con el agente y califica sus respuestas</p>
          </div>
          <button
            onClick={clearChat}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Limpiar chat
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => switchAgent(agent)}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                agent.id === activeAgent.id
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {agent.name}
              {agent.status === 'placeholder' && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                  placeholder
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{activeAgent.description}</p>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <div className="mx-auto mt-20 max-w-md rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">
              Escribe un mensaje como si fueras un lead real. {activeAgent.name} responderá usando su prompt +
              knowledge actuales.
            </p>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((m, idx) => (
            <div key={idx} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 text-sm shadow-sm ${
                  m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-white text-slate-900'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.role === 'assistant' && !m.feedbackSent && (
                  <div className="mt-2 flex gap-2 text-xs">
                    <button
                      onClick={() => markGood(idx)}
                      className="rounded border border-green-300 bg-green-50 px-2 py-1 text-green-700 hover:bg-green-100"
                    >
                      👍 Buena
                    </button>
                    <button
                      onClick={() => openBadFeedback(idx)}
                      className="rounded border border-red-300 bg-red-50 px-2 py-1 text-red-700 hover:bg-red-100"
                    >
                      👎 Mejorar
                    </button>
                  </div>
                )}
                {m.feedback === 'good' && (
                  <div className="mt-2 text-xs text-green-600">👍 Marcada como buena</div>
                )}
                {m.feedback === 'bad' && (
                  <div className="mt-2 text-xs text-red-600">👎 Feedback enviado al Trainer</div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
                {activeAgent.name} está escribiendo…
              </div>
            </div>
          )}
        </div>
      </main>

      {feedbackIndex !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">¿Qué debería haber respondido?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Describe qué era la respuesta correcta y por qué. El Trainer analizará tu feedback y
              actualizará el <code>knowledge.md</code> o <code>prompt.md</code> del agente.
            </p>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="Ej: debió preguntar primero el tipo de empleo antes de ofrecer tasa, porque los asalariados tienen una tabla distinta a los independientes…"
              className="mt-3 h-32 w-full rounded-md border border-slate-300 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setFeedbackIndex(null);
                  setFeedbackText('');
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitBadFeedback}
                disabled={!feedbackText.trim() || feedbackSubmitting}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {feedbackSubmitting ? 'Enviando…' : 'Enviar al Trainer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Escribe a ${activeAgent.name}…`}
            disabled={sending}
            className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="rounded-md bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </footer>
    </div>
  );
}
