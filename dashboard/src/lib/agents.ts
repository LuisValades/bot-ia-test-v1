export type AgentStatus = 'production' | 'placeholder';

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
}

export const AGENTS: Agent[] = [
  {
    id: 'alejandra',
    name: 'Alejandra',
    description: 'Seguimiento leads, pre-calificación, agendar llamadas',
    status: 'production'
  },
  {
    id: 'agente-2',
    name: 'Agente 2',
    description: 'Rol por definir',
    status: 'placeholder'
  },
  {
    id: 'agente-3',
    name: 'Agente 3',
    description: 'Rol por definir',
    status: 'placeholder'
  }
];

export function getAgent(id: string): Agent | undefined {
  return AGENTS.find(a => a.id === id);
}
