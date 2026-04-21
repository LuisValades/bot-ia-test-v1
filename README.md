# Crediexpres Agentes GHL

Suite de agentes conversacionales IA para GoHighLevel (GHL) + dashboard de entrenamiento humano-en-el-loop.

## Estructura del proyecto

```
CREDIEXPRES AGENTES GHL/
├── agentes/
│   ├── alejandra/            ← Agente 1: seguimiento leads — EN PRODUCCIÓN
│   ├── agente-2/             ← Placeholder (rol por definir)
│   └── agente-3/             ← Placeholder (rol por definir)
├── dashboard/                ← UI de entrenamiento interactivo
├── trainer/                  ← Backend que actualiza conocimiento + redeploya
└── README.md                 ← este archivo
```

## Agentes

| # | Nombre | Rol | Estado | Carpeta |
|---|---|---|---|---|
| 1 | **Alejandra** | Seguimiento leads, pre-calificación, agendar llamadas de 10 min | ✅ En producción | `agentes/alejandra/` |
| 2 | *(por definir)* | Calificación / Propiedades / Recordatorios | 🔜 Pendiente | `agentes/agente-2/` |
| 3 | *(por definir)* | Cobranza / Renovación / Post-venta | 🔜 Pendiente | `agentes/agente-3/` |

## Dashboard de entrenamiento

UI web donde Luis puede:

1. **Seleccionar qué agente entrenar** (tab: Alejandra / Agente 2 / Agente 3)
2. **Conversar con el agente** como si fuera un lead real
3. **Calificar cada respuesta**: 👍 Buena / 👎 Mejorar
4. Si da 👎 → textarea para describir **qué debería haber respondido**
5. El feedback se envía al **Trainer**

## Trainer (backend automático)

Cuando recibe un 👎 + feedback:

1. Lee el contexto completo de la conversación
2. Usa un LLM para entender **por qué** la respuesta fue mala
3. Genera un patch al `knowledge.md` / `prompt.md` del agente correspondiente
4. Hace commit + push a GitHub
5. Modal detecta el push y redeploya automáticamente
6. La siguiente conversación el agente ya sabe lo nuevo

## Stack

- **Agentes**: Node.js + Express + OpenRouter (gpt-4o-mini) + GHL API + Supabase + Modal
- **Dashboard**: Next.js (React + Tailwind + shadcn/ui)
- **Trainer**: Node.js + OpenRouter + GitHub API + Modal redeploy

## Cómo desarrollar cada pieza

Cada carpeta tiene su propio README con detalles:

- [`agentes/alejandra/README.md`](agentes/alejandra/README.md) — setup y operación del agente en producción
- [`dashboard/README.md`](dashboard/README.md) — UI de entrenamiento
- [`trainer/README.md`](trainer/README.md) — backend de actualización
- [`agentes/agente-2/README.md`](agentes/agente-2/README.md) — placeholder
- [`agentes/agente-3/README.md`](agentes/agente-3/README.md) — placeholder

## Quick start — correr Dashboard + Trainer localmente

**Terminal 1 — Trainer** (backend que actualiza los .md):

```bash
cd trainer
npm install
cp .env.example .env       # editar con tu OPENROUTER_API_KEY
npm run dev                # arranca en http://localhost:4000
```

**Terminal 2 — Dashboard** (UI web):

```bash
cd dashboard
npm install
cp .env.example .env.local # editar con tu OPENROUTER_API_KEY
npm run dev                # arranca en http://localhost:3000
```

Abre `http://localhost:3000`, selecciona el tab **Alejandra**, conversa, da 👍 o 👎. Si das 👎 + feedback, el Trainer analiza y actualiza el `.md` correspondiente dentro de `agentes/alejandra/`. Si `GIT_AUTO_PUSH=true`, hace commit + push automáticamente.

## Pendientes al 2026-04-20

- [ ] Rename manual de carpeta raíz `BOT GHL` → `CREDIEXPRES AGENTES GHL` (cuando se cierre VSCode)
- [x] Scaffold de código real de `dashboard/` (Next.js) ✅
- [x] Scaffold de código real de `trainer/` (Node backend) ✅
- [ ] `npm install` en `trainer/` y `dashboard/`
- [ ] Probar feedback loop end-to-end con Alejandra
- [ ] Definir rol/flujo de Agente 2 y Agente 3
- [ ] Pendientes específicos de Alejandra — ver [memoria de proyecto](../../../Users/Valad/.claude/projects/c--01-ANTIGRAVITY-PROYECTOS/memory/project_bot_alejandra.md)

## Notas operativas

- Cada agente deploya a Modal **independientemente** con su propio endpoint
- Cada agente tiene su propio webhook GHL apuntando a etapas distintas del pipeline
- Modal y GitHub son indiferentes al nombre local de la carpeta — solo leen contenido
