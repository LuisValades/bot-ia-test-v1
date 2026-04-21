import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AGENTS_ROOT = path.resolve(__dirname, '../../../agentes');

export const agents = {
  alejandra: {
    id: 'alejandra',
    name: 'Alejandra',
    description: 'Seguimiento leads, pre-calificación, agendar llamadas',
    path: path.join(AGENTS_ROOT, 'alejandra'),
    files: {
      prompt: 'system-prompt.md',
      knowledge: 'knowledge.md',
      sequence: 'secuencia seguimiento.md',
      reference: 'Prompt alejandra.md'
    },
    status: 'production'
  },
  'agente-2': {
    id: 'agente-2',
    name: 'Agente 2',
    description: 'Rol por definir',
    path: path.join(AGENTS_ROOT, 'agente-2'),
    files: {
      prompt: 'prompt.md',
      knowledge: 'knowledge.md'
    },
    status: 'placeholder'
  },
  'agente-3': {
    id: 'agente-3',
    name: 'Agente 3',
    description: 'Rol por definir',
    path: path.join(AGENTS_ROOT, 'agente-3'),
    files: {
      prompt: 'prompt.md',
      knowledge: 'knowledge.md'
    },
    status: 'placeholder'
  }
};

export function getAgent(id) {
  const agent = agents[id];
  if (!agent) throw new Error(`Agente desconocido: ${id}`);
  return agent;
}

export function listAgents() {
  return Object.values(agents).map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    status: a.status
  }));
}
