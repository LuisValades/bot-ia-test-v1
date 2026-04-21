'use client';

import { useEffect, useState, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import AgentPicker from '@/components/AgentPicker';
import { AGENTS, type Agent } from '@/lib/agents';

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
  const [agent, setAgent] = useState<Agent>(AGENTS[0]);
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
      .then(data => {
        setKnowledge(data.knowledge);
        setPrompt(data.prompt);
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

  const openEdit = (section: Section) => {
    setEditing(section);
    setEditBody(section.body);
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
      if (!res.ok) throw new Error(data.error || 'Error guardando');

      // refresh
      const r2 = await fetch(`/api/knowledge-sections?agent=${agent.id}`);
      const d2 = await r2.json();
      setKnowledge(d2.knowledge);
      setPrompt(d2.prompt);
      setEditing(null);

      let msg = `✅ Sección "${editing.title}" actualizada`;
      if (data.git?.committed) msg += `\ncommit ${data.git.commitSha?.slice(0, 7)}`;
      if (data.git?.pushed) msg += ' + push GitHub';
      alert(msg);
    } catch (err: any) {
      alert(`⚠️ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Conocimiento"
        subtitle="Visualiza y edita el prompt + knowledge.md del agente"
      />

      <div className="border-b bg-white px-8 py-4">
        <AgentPicker value={agent.id} onChange={setAgent} />
      </div>

      <div className="border-b bg-white px-8">
        <div className="flex gap-1">
          <FileTab active={activeFile === 'knowledge'} onClick={() => setActiveFile('knowledge')}>
            📚 Knowledge{knowledge ? ` (${knowledge.sections.length})` : ''}
          </FileTab>
          <FileTab active={activeFile === 'prompt'} onClick={() => setActiveFile('prompt')}>
            📝 Prompt{prompt ? ` (${prompt.sections.length})` : ''}
          </FileTab>
        </div>
      </div>

      <div className="border-b bg-white px-8 py-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar sección…"
          className="w-full max-w-md rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="scroll-fade flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="text-center text-sm text-slate-500">Cargando…</div>
        ) : !current || current.sections.length === 0 ? (
          <div className="text-center text-sm text-slate-500">
            {agent.status === 'placeholder'
              ? `${agent.name} aún no tiene archivos.`
              : 'Sin secciones que mostrar.'}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Nivel</th>
                  <th className="px-4 py-3 text-left">Sección</th>
                  <th className="px-4 py-3 text-left">Vista previa</th>
                  <th className="px-4 py-3 text-right">Caracteres</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        H{s.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.title}</td>
                    <td className="max-w-md truncate px-4 py-3 text-slate-500">{s.preview}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                      {s.body.length.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(s)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">Editar sección</h2>
                <p className="text-xs text-slate-500">
                  {activeFile}.md · H{editing.level} · {editing.title}
                </p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </header>
            <textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              className="flex-1 resize-none p-6 font-mono text-sm focus:outline-none"
              placeholder="Contenido de la sección…"
            />
            <footer className="flex items-center justify-between border-t px-6 py-3">
              <span className="text-xs text-slate-500">
                {editBody.length.toLocaleString()} caracteres
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving || editBody === editing.body}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : '💾 Guardar'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function FileTab({
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
      className={`px-4 py-3 text-sm font-medium transition ${
        active
          ? 'border-b-2 border-blue-600 text-blue-700'
          : 'border-b-2 border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}
