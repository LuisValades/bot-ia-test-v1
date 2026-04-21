'use client';

import { AGENTS, type Agent } from '@/lib/agents';

interface Props {
  value: string;
  onChange: (agent: Agent) => void;
}

export default function AgentPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {AGENTS.map(agent => {
        const active = agent.id === value;
        return (
          <button
            key={agent.id}
            onClick={() => onChange(agent)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
              active
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="text-base">{agent.emoji}</span>
            <span>{agent.name}</span>
            {agent.status === 'placeholder' && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                placeholder
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
