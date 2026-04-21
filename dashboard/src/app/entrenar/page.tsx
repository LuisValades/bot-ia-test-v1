'use client';

import { useState, useRef, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import AgentPicker from '@/components/AgentPicker';
import PromptModal from '@/components/PromptModal';
import FeedbackChat from '@/components/FeedbackChat';
import { AGENTS, type Agent } from '@/lib/agents';

type Role = 'user' | 'assistant';

interface Message {
  role: Role;
  content: string;
  citations?: string[];
  feedback?: 'good' | 'bad' | null;
  feedbackText?: string;
  feedbackSent?: boolean;
}

export default function EntrenarPage() {
  const [activeAgent, setActiveAgent] = useState<Agent>(AGENTS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitial, setChatInitial] = useState<{ index: number; feedback: string } | null>(null);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

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
      setMessages([
        ...next,
        { role: 'assistant', content: data.reply, citations: data.citations || [], feedback: null }
      ]);
    } catch (err: any) {
      setMessages([...next, { role: 'assistant', content: `⚠️ ${err.message}`, feedback: null }]);
    } finally {
      setSending(false);
    }
  };

  const markGood = async (idx: number) => {
    setMessages(prev =>
      prev.map((m, i) => (i === idx ? { ...m, feedback: 'good', feedbackSent: true } : m))
    );
    try {
      await fetch('/api/feedback-good', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: activeAgent.id,
          conversation: messages,
          responseIndex: idx
        })
      });
    } catch {
      // silent
    }
  };

  const openBadFeedback = (idx: number) => {
    setFeedbackIndex(idx);
    setFeedbackText('');
  };

  const openChatFlow = () => {
    if (feedbackIndex === null || !feedbackText.trim()) return;
    setChatInitial({ index: feedbackIndex, feedback: feedbackText.trim() });
    setChatOpen(true);
    setFeedbackIndex(null);
    setFeedbackText('');
  };

  const onChatApplied = (summary: string) => {
    setChatOpen(false);
    if (chatInitial) {
      const idx = chatInitial.index;
      setMessages(prev =>
        prev.map((m, i) =>
          i === idx
            ? { ...m, feedback: 'bad', feedbackText: chatInitial.feedback, feedbackSent: true }
            : m
        )
      );
    }
    setChatInitial(null);
    alert(summary);
  };

  const clearChat = () => {
    if (messages.length === 0) return;
    if (!confirm('¿Borrar la conversación actual?')) return;
    setMessages([]);
    setFeedbackIndex(null);
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Entrenar agente"
        subtitle="Conversa como lead y califica cada respuesta"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setPromptModalOpen(true)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              📝 Ver Prompt
            </button>
            <button
              onClick={clearChat}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              🗑️ Limpiar
            </button>
          </div>
        }
      />

      <div className="border-b bg-white px-8 py-4">
        <AgentPicker value={activeAgent.id} onChange={switchAgent} />
        <p className="mt-2 text-xs text-slate-500">{activeAgent.description}</p>
      </div>

      <div ref={scrollRef} className="scroll-fade flex-1 overflow-y-auto px-8 py-6">
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-md rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="mb-2 text-4xl">{activeAgent.emoji}</div>
            <p className="text-sm text-slate-600">
              Escribe un mensaje como si fueras un lead real.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {activeAgent.name} responderá con su prompt + knowledge actuales de producción.
            </p>
          </div>
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((m, idx) => (
            <MessageBubble
              key={idx}
              message={m}
              agentName={activeAgent.name}
              onGood={() => markGood(idx)}
              onBad={() => openBadFeedback(idx)}
            />
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
                <span className="inline-block animate-pulse">{activeAgent.name} está escribiendo…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="border-t bg-white px-8 py-4">
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
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </footer>

      {feedbackIndex !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">¿Qué no te gustó?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Describe brevemente lo que pasó — después el <strong>analizador</strong> te hará 1-2 preguntas
              para entender bien antes de tocar el <code className="rounded bg-slate-100 px-1">prompt.md</code> o{' '}
              <code className="rounded bg-slate-100 px-1">knowledge.md</code>.
            </p>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="Ej: la respuesta fue muy larga / faltó preguntar X / usó tono incorrecto…"
              className="mt-3 h-24 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              autoFocus
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
                onClick={openChatFlow}
                disabled={!feedbackText.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Abrir analizador →
              </button>
            </div>
          </div>
        </div>
      )}

      {chatOpen && chatInitial && (
        <FeedbackChat
          agentId={activeAgent.id}
          conversation={messages.map(m => ({ role: m.role, content: m.content }))}
          badResponseIndex={chatInitial.index}
          initialFeedback={chatInitial.feedback}
          open={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setChatInitial(null);
          }}
          onApplied={onChatApplied}
        />
      )}

      <PromptModal
        agentId={activeAgent.id}
        open={promptModalOpen}
        onClose={() => setPromptModalOpen(false)}
      />
    </div>
  );
}

function MessageBubble({
  message,
  agentName,
  onGood,
  onBad
}: {
  message: Message;
  agentName: string;
  onGood: () => void;
  onBad: () => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className="max-w-[80%] space-y-2">
        <div
          className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
            isUser
              ? 'rounded-br-sm bg-blue-600 text-white'
              : 'rounded-bl-sm bg-white text-slate-900'
          }`}
        >
          {!isUser && <div className="mb-1 text-xs font-semibold text-slate-500">{agentName}</div>}
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>

        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <div className="mb-1 font-semibold text-slate-600">📚 Información considerada:</div>
            <div className="flex flex-wrap gap-1">
              {message.citations.map((c, i) => (
                <span
                  key={i}
                  className="rounded bg-white px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {!isUser && !message.feedbackSent && (
          <div className="flex gap-2 text-xs">
            <button
              onClick={onGood}
              className="rounded-md border border-green-300 bg-green-50 px-3 py-1.5 font-medium text-green-700 hover:bg-green-100"
            >
              👍 Buena
            </button>
            <button
              onClick={onBad}
              className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
            >
              👎 Mejorar
            </button>
          </div>
        )}
        {message.feedback === 'good' && (
          <div className="text-xs text-green-600">👍 Marcada como buena</div>
        )}
        {message.feedback === 'bad' && (
          <div className="text-xs text-red-600">👎 Feedback aplicado al Trainer</div>
        )}
      </div>
    </div>
  );
}
