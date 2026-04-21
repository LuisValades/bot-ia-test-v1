export type AgentStatus = 'production' | 'placeholder';

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  emoji: string;
}

export const AGENTS: Agent[] = [
  {
    id: 'alejandra',
    name: 'Alejandra',
    description: 'Seguimiento leads, pre-calificación, agendar llamadas',
    status: 'production',
    emoji: '👩‍💼'
  },
  {
    id: 'agente-2',
    name: 'Agente 2',
    description: 'Rol por definir',
    status: 'placeholder',
    emoji: '🤖'
  },
  {
    id: 'agente-3',
    name: 'Agente 3',
    description: 'Rol por definir',
    status: 'placeholder',
    emoji: '🤖'
  }
];

export function getAgent(id: string): Agent | undefined {
  return AGENTS.find(a => a.id === id);
}
