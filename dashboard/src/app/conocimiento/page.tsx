'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icon';
import { useApp } from '@/lib/app-context';

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

export default function ConocimientoPage() {
  const { agent } = useApp();
  const [activeFile, setActiveFile] = useState<'knowledge' | 'prompt'>('knowledge');
  const [knowledge, setKnowledge] = useState<FileData | null>(null);
  const [prompt, setPrompt] = useState<FileData | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Section | null>(null);
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (agent.status === 'placeholder') {
      setKnowledge({ raw: '', sections: [], bytes: 0 });
      setPrompt({ raw: '', sections: [], bytes: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/knowledge-sections?agent=${agent.id}`)
      .then(r => r.json())
      .then(d => {
        setKnowledge(d.knowledge);
        setPrompt(d.prompt);
      })
      .catch(() => {
        setKnowledge(null);
        setPrompt(null);
      })
      .finally(() => setLoading(false));
  }, [agent.id, agent.status]);

  const current = activeFile === 'knowledge' ? knowledge : prompt;

  const filtered = useMemo(() => {
    if (!current) return [];
    if (!search) return current.sections;
    const q = search.toLowerCase();
    return current.sections.filter(
      s => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q)
    );
  }, [current, search]);

  const openEdit = (s: Section) => {
    setEditing(s);
    setEditBody(s.body);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch('/api/knowledge-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agent.id,
          file: activeFile,
          slug: editing.slug,
          newBody: editBody
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      const r2 = await fetch(`/api/knowledge-sections?agent=${agent.id}`);
      const d2 = await r2.json();
      setKnowledge(d2.knowledge);
      setPrompt(d2.prompt);
      setEditing(null);
    } catch (err: any) {
      alert(`⚠️ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Conocimiento" subtitle={`${agent.name} · agentes/${agent.id}/`}>
      <div
        className="flex gap-2 px-4 py-3 md:px-6"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-0)' }}
      >
        <button
          type="button"
          onClick={() => setActiveFile('knowledge')}
          className="btn"
          style={
            activeFile === 'knowledge'
              ? { background: 'var(--bg-3)', color: 'var(--fg-0)' }
              : {}
          }
        >
          📚 knowledge{knowledge ? ` (${knowledge.sections.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setActiveFile('prompt')}
          className="btn"
          style={
            activeFile === 'prompt' ? { background: 'var(--bg-3)', color: 'var(--fg-0)' } : {}
          }
        >
          📝 system-prompt{prompt ? ` (${prompt.sections.length})` : ''}
        </button>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar sección…"
          className="ml-auto w-full max-w-[280px] rounded-[8px] px-[12px] py-[6px] text-[13px] outline-none"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            color: 'var(--fg-0)',
            fontFamily: 'inherit'
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {loading ? (
          <div className="text-center text-sm" style={{ color: 'var(--fg-2)' }}>
            Cargando…
          </div>
        ) : !current || current.sections.length === 0 ? (
          <div className="text-center text-sm" style={{ color: 'var(--fg-2)' }}>
            {agent.status === 'placeholder'
              ? `${agent.name} aún no tiene archivos.`
              : 'Sin secciones.'}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map((s, i) => (
                <li key={i} className="flex items-start gap-[10px] px-4 py-[10px]">
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
                      className="text-[13px] font-medium"
                      style={{ color: 'var(--fg-0)' }}
                    >
                      {s.title}
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
                  <button type="button" onClick={() => openEdit(s)} className="btn">
                    <Icon name="pencil" size={11} /> Editar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4">
          <div
            className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[14px] md:h-[85vh] md:rounded-[14px]"
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--border-strong)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <header
              className="flex items-center justify-between px-4 py-[12px] md:px-6 md:py-[14px]"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold md:text-[17px]">Editar sección</h2>
                <p
                  className="truncate text-[11.5px]"
                  style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
                >
                  {activeFile}.md · H{editing.level} · {editing.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="btn btn-ghost"
              >
                <Icon name="x" size={14} />
              </button>
            </header>
            <textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              className="flex-1 resize-none p-4 text-[13px] leading-[1.55] outline-none md:p-6"
              style={{
                background: 'var(--bg-0)',
                color: 'var(--fg-0)',
                fontFamily: 'var(--font-mono)',
                border: 'none'
              }}
            />
            <footer
              className="flex flex-wrap items-center justify-between gap-[8px] px-4 py-[10px] md:px-6"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <span
                className="text-[11.5px]"
                style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}
              >
                {editBody.length.toLocaleString()} chars
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="btn">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving || editBody === editing.body}
                  className="btn btn-primary"
                >
                  {saving ? 'Guardando…' : '💾 Guardar'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}
