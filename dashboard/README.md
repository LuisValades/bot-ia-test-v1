# Dashboard — Entrenamiento de agentes GHL

UI web para entrenar a los agentes conversacionales (Alejandra, Agente 2, Agente 3) con feedback humano.

## Funcionalidad

### Pestañas (tabs) — seleccionar qué agente entrenar

```
[ Alejandra ]  [ Agente 2 ]  [ Agente 3 ]
```

Al cambiar de pestaña se limpia la conversación y carga el `prompt.md` + `knowledge.md` del agente seleccionado.

### Chat interactivo

- Luis escribe mensajes como si fuera un lead real
- El agente responde usando el mismo prompt + knowledge que usa en producción
- Se muestra la conversación completa con timestamps

### Feedback por respuesta

Debajo de cada respuesta del agente aparecen 2 botones:

- **👍 Buena** → se guarda como ejemplo positivo
- **👎 Mejorar** → abre textarea

Al dar 👎 Luis escribe: *"Debió responder X porque Y"*.

### Captura de contexto

Cada feedback incluye automáticamente:

- Conversación completa hasta ese punto
- Estado del lead (si aplica)
- Versión del prompt + knowledge en ese momento
- Timestamp + ID del agente

### Envío al Trainer

Cuando Luis da 👎 + escribe feedback → POST a `/api/feedback` del servicio **Trainer**. El Trainer se encarga del resto (ver `../trainer/README.md`).

## Stack propuesto

- **Next.js 14** (App Router) — SSR + API routes para chat
- **Tailwind CSS** — estilos
- **shadcn/ui** — componentes (tabs, button, textarea, card)
- **Vercel AI SDK** (opcional) — streaming de respuestas

## Estructura de archivos (a crear)

```
dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← pantalla principal
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── chat/route.ts     ← chat con el agente (llama OpenRouter)
│   │       └── feedback/route.ts ← envía 👎 al Trainer
│   ├── components/
│   │   ├── AgentSelector.tsx     ← tabs para cambiar agente
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx     ← con 👍👎
│   │   └── FeedbackModal.tsx     ← textarea para "mejorar"
│   └── lib/
│       ├── agents.ts             ← lista de agentes + paths a sus .md
│       └── openrouter.ts
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

## Deploy

- **Desarrollo local**: `npm run dev` en `http://localhost:3000`
- **Producción**: Vercel (gratis) o Modal como servicio web aparte
- Solo Luis necesita acceso → autenticación simple por password o magic link
