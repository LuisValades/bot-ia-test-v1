export interface Advisor {
  id: string;
  name: string;
  role: string;
  color: string;
  leads: number;
  hot: number;
}

export interface ThreadMessage {
  who: string;
  msg: string;
  time: string;
  type?: string; // "SMS" | "Email" | "WhatsApp" | "Instagram" | etc.
}

export type LeadTag = 'warm' | 'hot' | 'cold' | 'new';

export interface Lead {
  id: string;
  advisorId: string;
  name: string;
  avatar: string;
  color: string;
  phone: string;
  ghlContactId?: string;
  source: string;
  tag: LeadTag;
  product: string;
  thread: ThreadMessage[];
  suggestion: string | null;
  reason: string;
  dismissed?: boolean;
}

export interface Task {
  id: string;
  text: string;
  meta: string;
  time: string;
  done: boolean;
  type: 'call' | 'task' | 'message';
}

export interface Note {
  id: string;
  text: string;
  who: string;
  when: string;
}

export const ADVISORS: Advisor[] = [
  {
    id: 'efrain',
    name: 'Efrain Cárdenas',
    role: 'Sr · Hipotecario',
    color: 'linear-gradient(135deg, oklch(0.72 0.14 240), oklch(0.68 0.15 290))',
    leads: 12,
    hot: 4
  },
  {
    id: 'lucia',
    name: 'Lucía Martín',
    role: 'Sr · PyME',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 345), oklch(0.72 0.15 25))',
    leads: 9,
    hot: 2
  },
  {
    id: 'rodrigo',
    name: 'Rodrigo Peña',
    role: 'Jr · Hipotecario',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 160), oklch(0.72 0.15 200))',
    leads: 14,
    hot: 5
  },
  {
    id: 'paola',
    name: 'Paola Reyes',
    role: 'SDR · Prospección',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 80), oklch(0.74 0.15 40))',
    leads: 7,
    hot: 1
  }
];

export const LEADS: Lead[] = [
  {
    id: 'l1',
    advisorId: 'efrain',
    name: 'Fernando Pérez',
    avatar: 'FP',
    color: 'linear-gradient(135deg, oklch(0.72 0.14 240), oklch(0.68 0.15 290))',
    phone: '+52 55 1283 4521',
    ghlContactId: 'ghl_fp_01',
    source: 'Meta Ads · Hipotecario',
    tag: 'warm',
    product: 'Hipotecario · $2.4M',
    thread: [
      {
        who: 'Alejandra',
        msg: 'Te cotizo: $2.4M a 20 años, tasa fija 10.75%, mensualidad $24,480. Enganche mínimo $240K. ¿Avanzamos con documentos?',
        time: 'ayer 19:42'
      },
      { who: 'Fernando', msg: 'lo reviso con mi esposa y te aviso', time: 'ayer 20:01' }
    ],
    suggestion:
      'Hola Fernando, seguimos pendientes. ¿Pudieron revisar la cotización del hipotecario a 20 años? Si confirman esta semana bloqueamos la tasa 10.75% antes del ajuste del 1° de mayo.',
    reason:
      'Lead 18h sin respuesta. Usó "lo reviso con mi esposa". Reenganche con urgencia real (ajuste de tasa) sin presión falsa.'
  },
  {
    id: 'l2',
    advisorId: 'efrain',
    name: 'María Gallegos',
    avatar: 'MG',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 345), oklch(0.72 0.15 25))',
    phone: '+52 33 4091 7823',
    ghlContactId: 'ghl_mg_02',
    source: 'Formulario web',
    tag: 'hot',
    product: 'PyME · capital trabajo $800K',
    thread: [
      {
        who: 'María',
        msg: 'agendé la llamada para hoy a las 4 pero no me ha llamado nadie, necesito el crédito urgente',
        time: 'hoy 16:12'
      },
      { who: 'Marco', msg: 'Disculpa la demora María, confirmo con Efrain ahora mismo.', time: 'hoy 16:13' }
    ],
    suggestion:
      'María, soy Efrain de Crediexpres. Mil disculpas por el retraso. ¿Puedo llamarte en 10 minutos? Tengo preaprobación PyME por $800K a tasa 14.9% lista para revisar contigo.',
    reason:
      '🔥 Lead caliente: agendó llamada y se incumplió. Riesgo alto de perderla. Disculpa directa + preaprobación concreta.'
  },
  {
    id: 'l3',
    advisorId: 'efrain',
    name: 'Diego Alarcón',
    avatar: 'DA',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 160), oklch(0.72 0.15 200))',
    phone: '+52 81 6677 0029',
    ghlContactId: 'ghl_da_03',
    source: 'WhatsApp · Ad',
    tag: 'new',
    product: 'Hipotecario · liquidez',
    thread: [
      { who: 'Diego', msg: 'cuanto me prestan con mi casa de garantia', time: 'hoy 09:21' },
      {
        who: 'Alejandra',
        msg: 'Podemos prestarte hasta el 50% del valor comercial. ¿En qué ciudad está la propiedad y tienes avalúo reciente?',
        time: 'hoy 09:21'
      },
      { who: 'Diego', msg: '...', time: 'hoy 09:22' }
    ],
    suggestion:
      'Diego, para darte un monto preciso necesito 2 datos: ciudad del inmueble y valor aproximado. Con eso te preapruebo en 15 min y te mando simulación.',
    reason: 'Lead nuevo sin avance 6h. Pregunta montos sin dar datos. Pregunta corta + beneficio claro.'
  },
  {
    id: 'l4',
    advisorId: 'lucia',
    name: 'Sofía Beltrán',
    avatar: 'SB',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 80), oklch(0.74 0.15 40))',
    phone: '+52 55 7821 3390',
    ghlContactId: 'ghl_sb_04',
    source: 'Referida',
    tag: 'warm',
    product: 'PyME · Equipamiento $450K',
    thread: [
      {
        who: 'Sofía',
        msg: 'me comentaron que dan credito para equipar mi restaurante',
        time: 'hoy 11:03'
      },
      {
        who: 'Marco',
        msg: '¡Claro! Manejamos PyME a 36 meses con 3 meses de gracia. Para $450K la mensualidad rondaría $16,800. ¿Llevas cuánto operando?',
        time: 'hoy 11:04'
      },
      { who: 'Sofía', msg: 'ok, mañana te mando estados de cuenta', time: 'hoy 11:06' }
    ],
    suggestion:
      'Sofía, buen día. ¿Pudiste localizar los estados de cuenta? Si me los pasas hoy antes de las 5 pm, mañana mismo tienes tu preaprobación del PyME.',
    reason:
      'Prometió enviar docs mañana. Recordatorio suave con plazo claro. Sin descuento: este lead se mueve por velocidad.'
  },
  {
    id: 'l5',
    advisorId: 'rodrigo',
    name: 'Jorge Ruiz',
    avatar: 'JR',
    color: 'linear-gradient(135deg, oklch(0.72 0.14 260), oklch(0.68 0.15 310))',
    phone: '+52 55 2110 4455',
    ghlContactId: 'ghl_jr_05',
    source: 'Meta Ads · PyME',
    tag: 'cold',
    product: 'PyME · descartado',
    thread: [
      {
        who: 'Marco',
        msg: 'Hola Jorge, te vi interesado en el crédito PyME. ¿Te cuento condiciones?',
        time: 'hace 2d'
      },
      { who: 'Jorge', msg: 'no gracias, ya conseguí por otro lado', time: 'hace 2d' }
    ],
    suggestion: null,
    reason: 'Descartar. Lead cerró con competencia. Mover a lista no-contactar 60d.',
    dismissed: true
  },
  {
    id: 'l6',
    advisorId: 'paola',
    name: 'Ana Ortiz',
    avatar: 'AO',
    color: 'linear-gradient(135deg, oklch(0.78 0.14 25), oklch(0.72 0.15 65))',
    phone: '+52 81 5523 7712',
    ghlContactId: 'ghl_ao_06',
    source: 'Meta Ads · Hipotecario',
    tag: 'new',
    product: 'Hipotecario · primera casa',
    thread: [
      { who: 'Ana', msg: 'hola quiero información de hipoteca', time: 'hoy 14:05' },
      {
        who: 'Alejandra',
        msg: '¡Hola Ana! Soy Alejandra de Crediexpres. ¿Para casa nueva o refinanciar?',
        time: 'hoy 14:05'
      }
    ],
    suggestion:
      'Hola Ana, seguimos aquí para ayudarte. ¿Es para comprar casa nueva o estás refinanciando una existente? Con eso te armo una simulación rápida.',
    reason:
      'Lead nuevo silenciado 3h. Segundo toque cordial con la misma pregunta de calificación. Mantiene el tono del bot.'
  }
];

export const TASKS_TODAY: Task[] = [
  {
    id: 't1',
    text: 'Llamar a María Gallegos (reagendar PyME)',
    meta: 'Lead #2 · urgente',
    time: '16:25',
    done: false,
    type: 'call'
  },
  {
    id: 't2',
    text: 'Enviar simulación a Fernando Pérez',
    meta: 'Hipotecario $2.4M',
    time: '17:00',
    done: false,
    type: 'task'
  },
  {
    id: 't3',
    text: 'Revisar buró expediente 8842 Díaz',
    meta: 'Compliance',
    time: '18:00',
    done: false,
    type: 'task'
  },
  {
    id: 't4',
    text: 'Cierre del día · reporte pipeline',
    meta: 'Interno',
    time: '19:30',
    done: false,
    type: 'task'
  },
  {
    id: 't5',
    text: 'Llamada prospección · Sofía Beltrán',
    meta: 'Follow-up',
    time: '09:30',
    done: true,
    type: 'call'
  }
];

export const NOTES: Note[] = [
  {
    id: 'n1',
    text: 'María G. opera restaurante 4 años, facturación $280K/mes. Perfil bueno para PyME capital de trabajo. Prioridad alta.',
    who: 'Marco (bot)',
    when: 'hace 2 h'
  },
  {
    id: 'n2',
    text: 'Diego A. tiene propiedad valuada aprox $3.2M en Monterrey. Si confirma avalúo, liquidez hasta $1.6M.',
    who: 'Efrain',
    when: 'ayer'
  }
];
