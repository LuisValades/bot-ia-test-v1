'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { useApp } from '@/lib/app-context';

type Role = 'user' | 'assistant';

interface Msg {
  role: Role;
  content: string;
  citations?: string[];
  feedback?: 'up' | 'down' | null;
  chunks?: string[];
}

// Alejandra responde en bloque pero el bot live manda cada frase como SMS separado.
// Partimos por líneas vacías (como el formato del prompt) para visualizar igual.
function splitChunks(text: string): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  const parts = clean
    .split(/\n\s*\n+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length > 1) return parts;
  // fallback: split por enter simple si hay varios
  const lines = clean.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length >= 3) return lines;
  return [clean];
}

interface Section {
  level: number;
  title: string;
  slug: string;
  body: string;
  preview: string;
}

interface FileData {
  raw: string;
  sections: Section[];
  bytes: number;
}

export default function TrainingTab() {
  const { agent } = useApp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [knowledge, setKnowledge] = useState<FileData | null>(null);
  const [prompt, setPrompt] = useState<FileData | null>(null);
  const [activeFile, setActiveFile] = useState<'knowledge' | 'prompt'>('knowledge');
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirtyMap, setDirtyMap] = useState<Record<string, { file: 'knowledge' | 'prompt'; change: string; ts: string }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    setMessages([]);
    setKnowledge(null);
    setPrompt(null);
    setDirtyMap({});
  }, [agent.id]);

  const loadSections = async () => {
    const res = await fetch(`/api/knowledge-sections?agent=${agent.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setKnowledge(data.knowledge);
    setPrompt(data.prompt);
  };

  useEffect(() => {
    if (kbOpen) loadSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbOpen, agent.id]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agent.id, messages: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      const chunks = splitChunks(data.reply || '');
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: data.reply,
          citations: data.citations || [],
          feedback: null,
          chunks
        }
      ]);
    } catch (err: any) {
      setMessages([
        ...next,
        { role: 'assistant', content: `⚠️ ${err.message}`, feedback: null }
      ]);
    } finally {
      setSending(false);
    }
  };

  const setFeedback = async (idx: number, val: 'up' | 'down') => {
    setMessages(prev =>
      prev.map((m, i) =>
        i === idx ? { ...m, feedback: m.feedback === val ? null : val } : m
      )
    );
    if (val === 'up') {
      try {
        await fetch('/api/feedback-good', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: agent.id, conversation: messages, responseIndex: idx })
        });
      } catch {}
    }
  };

  const openSectionEdit = (section: Section) => {
    setEditingSection(section);
    setEditBody(section.body);
  };

  const saveSection = async () => {
    if (!editingSection) return;
    setSaving(true);
    try {
      const res = await fetch('/api/knowledge-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agent.id,
          file: activeFile,
          slug: editingSection.slug,
          newBody: editBody
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setDirtyMap(prev => ({
        ...prev,
        [editingSection.slug]: {
          file: activeFile,
          change: `Sección "${editingSection.title}" editada`,
          ts: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        }
      }));
      setEditingSection(null);
      await loadSections();
    } catch (err: any) {
      alert(`⚠️ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const current = activeFile === 'knowledge' ? knowledge : prompt;
  const dirtyCount = Object.keys(dirtyMap).length;

  return (
    <div
      className="grid flex-1 overflow-hidden transition-[grid-template-columns] duration-200"
      style={{
        gridTemplateColumns: kbOpen ? 'minmax(0, 1fr) minmax(0, 1.3fr)' : 'minmax(0, 1fr)'
      }}
    >
      {/* LEFT: chat */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ borderRight: kbOpen ? '1px solid var(--border)' : 'none' }}
      >
        <div
          className="flex flex-wrap items-center gap-[10px] px-[20px] py-[12px]"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-0)' }}
        >
          <Icon name="chat" size={14} />
          <div className="text-[13px] font-semibold">
            Probar bot <span style={{ color: 'var(--accent)' }}>{agent.name}</span>
            <span
              className="ml-[6px] text-[11.5px]"
              style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
            >
              · {agent.description.toLowerCase()}
            </span>
          </div>
          <div className="flex-1" />
          {dirtyCount > 0 && !kbOpen && (
            <button
              type="button"
              onClick={() => setKbOpen(true)}
              className="btn btn-dirty"
            >
              <span className="dirty-dot" /> {dirtyCount} ajuste{dirtyCount > 1 ? 's' : ''} pendiente
              {dirtyCount > 1 ? 's' : ''}
              <Icon name="chevronRight" size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setKbOpen(v => !v)}
            className="btn"
            style={kbOpen ? { background: 'var(--bg-3)', color: 'var(--fg-0)' } : {}}
          >
            <Icon name="book" size={13} /> {kbOpen ? 'Ocultar conocimiento' : 'Ajustar conocimiento'}
          </button>
          <button type="button" onClick={() => setMessages([])} className="btn btn-ghost">
            <Icon name="refresh" size={13} /> Reiniciar
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-[20px] py-[18px]"
          style={{
            background:
              'radial-gradient(ellipse at top right, color-mix(in oklab, var(--accent-glow), transparent 50%), transparent 50%), var(--bg-0)'
          }}
        >
          {messages.length === 0 && (
            <div
              className="m-auto max-w-md rounded-[10px] px-[16px] py-[18px] text-center text-[13px]"
              style={{
                background: 'var(--bg-1)',
                border: '1px dashed var(--border)',
                color: 'var(--fg-1)'
              }}
            >
              <div className="mb-2 text-2xl">🧪</div>
              Escribe a {agent.name} como si fueras un lead real. Abajo tienes feedback 👍/👎 y botón &quot;Ajustar
              conocimiento&quot; para corregir.
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              msg={m}
              agentName={agent.name}
              onFeedback={val => setFeedback(i, val)}
              onSeeSource={() => {
                setKbOpen(true);
                setActiveFile('prompt');
              }}
            />
          ))}

          {sending && (
            <div className="flex max-w-[82%] gap-[10px]">
              <div
                className="grid h-[28px] w-[28px] flex-shrink-0 place-items-center rounded-[8px] text-[11px] font-semibold text-white"
                style={{
                  background:
                    'linear-gradient(135deg, oklch(0.75 0.14 200), oklch(0.65 0.17 250))'
                }}
              >
                {agent.name[0]}
              </div>
              <div
                className="rounded-[12px] rounded-bl-[4px] px-[14px] py-[10px] text-[13.5px]"
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg-2)'
                }}
              >
                <Dots />
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-0)' }}>
          <div className="flex flex-wrap gap-[6px] px-[16px] pb-[6px] pt-[10px]">
            {['¿cuál es la tasa?', 'requisitos hipotecario', 'quiero agendar', 'hola info'].map(
              q => (
                <button
                  key={q}
                  type="button"
                  className="rounded-[16px] px-[9px] py-[4px] text-[11.5px]"
                  style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg-1)',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                  onClick={() => {
                    setInput(q);
                  }}
                >
                  {q}
                </button>
              )
            )}
          </div>
          <div className="px-[16px] pb-[16px]">
            <div
              className="flex items-end gap-[8px] rounded-[12px] px-[14px] py-[10px]"
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)'
              }}
            >
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Pregúntale a ${agent.name} como si fueras un prospecto…`}
                rows={1}
                disabled={sending}
                className="min-h-[22px] flex-1 resize-none bg-transparent text-[13.5px] leading-[1.5] outline-none"
                style={{ color: 'var(--fg-0)', fontFamily: 'inherit', maxHeight: 120 }}
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim() || sending}
                className="grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-[8px]"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  border: 'none',
                  cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                  opacity: sending || !input.trim() ? 0.45 : 1
                }}
              >
                <Icon name="send" size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: kb panel */}
      {kbOpen && (
        <div className="flex flex-col overflow-hidden" style={{ background: 'var(--bg-0)' }}>
          <div
            className="flex flex-wrap items-center gap-[10px] px-[20px] py-[12px]"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <Icon name="book" size={14} />
            <div className="text-[13px] font-semibold">
              Conocimiento de <span style={{ color: 'var(--accent)' }}>{agent.name}</span>
              <span
                className="ml-[6px] text-[11.5px]"
                style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
              >
                · agentes/{agent.id}/
              </span>
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setKbOpen(false)}
              className="btn btn-ghost"
              aria-label="Ocultar panel"
            >
              <Icon name="x" size={13} />
            </button>
          </div>

          {dirtyCount > 0 && (
            <div
              className="mx-4 my-3 rounded-[10px] px-[12px] py-[10px]"
              style={{
                background:
                  'linear-gradient(180deg, color-mix(in oklab, var(--warn), transparent 90%), transparent)',
                border: '1px solid color-mix(in oklab, var(--warn), transparent 60%)'
              }}
            >
              <div
                className="mb-[8px] flex items-center gap-[6px] text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{ color: 'var(--warn)' }}
              >
                <Icon name="alert" size={12} /> Ajustes sin publicar ({dirtyCount})
              </div>
              {Object.entries(dirtyMap).map(([slug, info]) => (
                <div
                  key={slug}
                  className="flex items-start gap-[10px] py-[8px]"
                  style={{
                    borderTop: '1px dashed color-mix(in oklab, var(--warn), transparent 70%)'
                  }}
                >
                  <span className="dirty-dot mt-[6px]" />
                  <div className="flex-1">
                    <div
                      className="text-[13px] font-medium"
                      style={{ color: 'var(--fg-0)', fontFamily: 'var(--font-mono)' }}
                    >
                      {info.file}.md
                      <span
                        className="ml-[6px] font-normal"
                        style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-ui)' }}
                      >
                        · {slug}
                      </span>
                    </div>
                    <div className="mt-[2px] text-[12px]" style={{ color: 'var(--fg-1)' }}>
                      {info.change}
                    </div>
                  </div>
                  <span
                    className="whitespace-nowrap pt-[4px] text-[10.5px]"
                    style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
                  >
                    {info.ts}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div
            className="flex gap-[2px] border-b px-[20px]"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <TabBtn active={activeFile === 'knowledge'} onClick={() => setActiveFile('knowledge')}>
              📚 knowledge.md{knowledge ? ` (${knowledge.sections.length})` : ''}
            </TabBtn>
            <TabBtn active={activeFile === 'prompt'} onClick={() => setActiveFile('prompt')}>
              📝 system-prompt.md{prompt ? ` (${prompt.sections.length})` : ''}
            </TabBtn>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto px-[20px] py-[14px]">
            {!current ? (
              <div
                className="m-auto text-center text-sm"
                style={{ color: 'var(--fg-2)' }}
              >
                Cargando…
              </div>
            ) : (
              <SectionList
                sections={current.sections}
                dirtyMap={dirtyMap}
                file={activeFile}
                onEdit={openSectionEdit}
              />
            )}
          </div>
        </div>
      )}

      {editingSection && (
        <EditSectionModal
          section={editingSection}
          file={activeFile}
          body={editBody}
          setBody={setEditBody}
          saving={saving}
          onSave={saveSection}
          onClose={() => setEditingSection(null)}
        />
      )}
    </div>
  );
}

function TabBtn({
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
      type="button"
      onClick={onClick}
      className="px-[14px] py-[10px] text-[13px] font-medium"
      style={{
        color: active ? 'var(--fg-0)' : 'var(--fg-1)',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'inherit'
      }}
    >
      {children}
    </button>
  );
}

function SectionList({
  sections,
  dirtyMap,
  file,
  onEdit
}: {
  sections: Section[];
  dirtyMap: Record<string, { file: 'knowledge' | 'prompt'; change: string; ts: string }>;
  file: 'knowledge' | 'prompt';
  onEdit: (s: Section) => void;
}) {
  if (sections.length === 0) {
    return (
      <div
        className="m-auto text-center text-sm"
        style={{ color: 'var(--fg-2)' }}
      >
        Sin secciones.
      </div>
    );
  }
  return (
    <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
      {sections.map((s, i) => {
        const dirty = dirtyMap[s.slug]?.file === file;
        return (
          <div key={i} className="flex items-start gap-[10px] py-[10px]">
            <span
              className="mt-[3px] rounded-[4px] px-[6px] py-[2px] text-[10px] font-semibold"
              style={{
                background: 'var(--bg-2)',
                color: 'var(--fg-1)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              H{s.level}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="flex items-center gap-[6px] text-[13px] font-medium"
                style={{ color: 'var(--fg-0)' }}
              >
                {s.title}
                {dirty && (
                  <span
                    className="rounded-[8px] px-[6px] py-[1px] text-[10px] font-semibold"
                    style={{
                      background: 'color-mix(in oklab, var(--warn), transparent 82%)',
                      color: 'var(--warn)',
                      border: '1px solid color-mix(in oklab, var(--warn), transparent 60%)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    ajustado
                  </span>
                )}
              </div>
              <div
                className="mt-[2px] truncate text-[11.5px]"
                style={{ color: 'var(--fg-2)' }}
              >
                {s.preview}
              </div>
            </div>
            <span
              className="whitespace-nowrap text-[10.5px]"
              style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
            >
              {s.body.length.toLocaleString()}
            </span>
            <button type="button" onClick={() => onEdit(s)} className="btn">
              <Icon name="pencil" size={11} /> Editar
            </button>
          </div>
        );
      })}
    </div>
  );
}

function EditSectionModal({
  section,
  file,
  body,
  setBody,
  saving,
  onSave,
  onClose
}: {
  section: Section;
  file: 'knowledge' | 'prompt';
  body: string;
  setBody: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4">
      <div
        className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[14px] md:h-[85vh] md:rounded-[14px]"
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-[12px] md:px-6 md:py-[14px]"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold md:text-[17px]">Editar sección</h2>
            <p
              className="truncate text-[11.5px]"
              style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
            >
              {file}.md · H{section.level} · {section.title}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            <Icon name="x" size={14} />
          </button>
        </div>

        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          className="flex-1 resize-none p-4 text-[13px] leading-[1.55] outline-none md:p-6"
          style={{
            background: 'var(--bg-0)',
            color: 'var(--fg-0)',
            fontFamily: 'var(--font-mono)',
            border: 'none'
          }}
        />

        <div
          className="flex flex-wrap items-center justify-between gap-[8px] px-4 py-[10px] md:px-6"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span
            className="text-[11.5px]"
            style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
          >
            {body.length.toLocaleString()} chars
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn">
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || body === section.body}
              className="btn btn-primary"
            >
              {saving ? 'Guardando…' : '💾 Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  agentName,
  onFeedback,
  onSeeSource
}: {
  msg: Msg;
  agentName: string;
  onFeedback: (val: 'up' | 'down') => void;
  onSeeSource: () => void;
}) {
  const isUser = msg.role === 'user';
  const chunks = !isUser && msg.chunks && msg.chunks.length > 1 ? msg.chunks : null;
  return (
    <div
      className={`flex max-w-[90%] gap-[10px] md:max-w-[82%] ${
        isUser ? 'ml-auto flex-row-reverse' : ''
      }`}
      style={{ animation: 'msg-in 0.3s cubic-bezier(0.22, 1, 0.36, 1)' }}
    >
      <div
        className="grid h-[28px] w-[28px] flex-shrink-0 place-items-center rounded-[8px] text-[11px] font-semibold text-white"
        style={{
          background: isUser
            ? 'linear-gradient(135deg, oklch(0.72 0.14 260), oklch(0.68 0.15 310))'
            : 'linear-gradient(135deg, oklch(0.75 0.14 200), oklch(0.65 0.17 250))'
        }}
      >
        {isUser ? 'L' : agentName[0]}
      </div>
      <div className="min-w-0 flex-1">
        {chunks ? (
          <div className="flex flex-col gap-[4px]">
            {chunks.map((c, i) => (
              <div
                key={i}
                className="rounded-[12px] px-[14px] py-[10px] text-[13.5px] leading-[1.5]"
                style={{
                  background: 'var(--bg-2)',
                  color: 'var(--fg-0)',
                  border: '1px solid var(--border)',
                  borderBottomLeftRadius: i === chunks.length - 1 ? '4px' : '12px',
                  borderTopLeftRadius: i === 0 ? '12px' : '4px',
                  whiteSpace: 'pre-wrap',
                  animation: `msg-in 0.3s ${i * 0.08}s both cubic-bezier(0.22, 1, 0.36, 1)`
                }}
              >
                {i === 0 && (
                  <div
                    className="mb-[3px] flex items-center gap-2 text-[11px] font-semibold"
                    style={{ color: 'var(--fg-2)' }}
                  >
                    {agentName}
                    <span
                      className="rounded-[6px] px-[5px] py-[1px] text-[9px] uppercase tracking-[0.08em]"
                      style={{
                        background: 'var(--bg-3)',
                        color: 'var(--fg-3)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      SMS {i + 1}/{chunks.length}
                    </span>
                  </div>
                )}
                {i > 0 && (
                  <div
                    className="mb-[3px] text-[9px] uppercase tracking-[0.08em]"
                    style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
                  >
                    SMS {i + 1}/{chunks.length}
                  </div>
                )}
                {c}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="rounded-[12px] px-[14px] py-[10px] text-[13.5px] leading-[1.5]"
            style={{
              background: isUser ? 'var(--accent)' : 'var(--bg-2)',
              color: isUser ? 'var(--accent-ink)' : 'var(--fg-0)',
              border: isUser ? 'none' : '1px solid var(--border)',
              borderBottomRightRadius: isUser ? '4px' : undefined,
              borderBottomLeftRadius: !isUser ? '4px' : undefined,
              whiteSpace: 'pre-wrap'
            }}
          >
            {!isUser && (
              <div
                className="mb-[3px] text-[11px] font-semibold"
                style={{ color: 'var(--fg-2)' }}
              >
                {agentName}
              </div>
            )}
            {msg.content}
          </div>
        )}

        {!isUser && (
          <div
            className="mt-[6px] flex flex-wrap items-center gap-[8px] text-[11px]"
            style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}
          >
            {msg.citations?.map(c => (
              <span
                key={c}
                onClick={onSeeSource}
                className="cursor-pointer rounded-[6px] px-[6px] py-[1px]"
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg-2)'
                }}
              >
                <Icon name="file" size={10} /> {c}
              </span>
            ))}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => onFeedback('up')}
              className="rounded-[6px] px-[6px] py-[3px]"
              style={{
                border: '1px solid var(--border)',
                background: msg.feedback === 'up' ? 'color-mix(in oklab, var(--success), transparent 80%)' : 'transparent',
                color: msg.feedback === 'up' ? 'var(--success)' : 'var(--fg-2)',
                cursor: 'pointer'
              }}
            >
              <Icon name="thumbUp" size={11} />
            </button>
            <button
              type="button"
              onClick={() => onFeedback('down')}
              className="rounded-[6px] px-[6px] py-[3px]"
              style={{
                border: '1px solid var(--border)',
                background: msg.feedback === 'down' ? 'color-mix(in oklab, var(--danger), transparent 80%)' : 'transparent',
                color: msg.feedback === 'down' ? 'var(--danger)' : 'var(--fg-2)',
                cursor: 'pointer'
              }}
            >
              <Icon name="thumbDown" size={11} />
            </button>
            <button
              type="button"
              onClick={onSeeSource}
              className="rounded-[6px] px-[6px] py-[3px]"
              style={{
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--fg-2)',
                cursor: 'pointer'
              }}
            >
              <Icon name="pencil" size={11} /> Ajustar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-[4px] align-middle">
      <Dot />
      <Dot delay={0.15} />
      <Dot delay={0.3} />
    </span>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="inline-block h-[6px] w-[6px] rounded-full"
      style={{
        background: 'var(--fg-2)',
        animation: `blink 1.2s ${delay}s infinite ease-in-out`
      }}
    />
  );
}
