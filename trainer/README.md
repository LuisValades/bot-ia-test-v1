# Trainer — Actualización automática de conocimiento

Backend que recibe feedback 👎 del Dashboard y actualiza los archivos `.md` del agente correspondiente, con redeploy automático.

## Flujo

```
Dashboard  ──feedback──►  Trainer
                             │
                             ├─► 1. Lee conversación + prompt + knowledge actual
                             ├─► 2. Llama LLM (meta-modelo) para entender por qué
                             │      la respuesta fue mala
                             ├─► 3. Genera patch al knowledge.md o prompt.md
                             ├─► 4. Aplica el patch (git diff)
                             ├─► 5. git commit + push
                             └─► 6. Modal redeploy (automático por webhook GitHub)
```

## Tipos de patch

El Trainer decide a qué archivo aplicar el cambio:

| Tipo de feedback | Destino |
|---|---|
| Falta información de producto / tasas / requisitos | `knowledge.md` |
| El agente debería haber sonado diferente (tono, estilo) | `prompt.md` |
| El agente debería haber usado otro flujo | `prompt.md` (sección flujo) |
| El agente repitió algo o hizo algo prohibido | `prompt.md` (frases prohibidas) |

## Endpoints

### `POST /api/feedback`

```json
{
  "agent": "alejandra",
  "conversation": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "badResponseIndex": 5,
  "feedback": "Debió preguntar por el tipo de empleo antes de ofrecer tasa",
  "timestamp": "2026-04-20T17:45:00Z"
}
```

**Respuesta:**
```json
{
  "ok": true,
  "patchApplied": true,
  "filesChanged": ["knowledge.md"],
  "commitSha": "abc123",
  "redeployTriggered": true
}
```

### `POST /api/rollback`

Deshace el último cambio aplicado a un agente. Body: `{"agent": "alejandra"}`.

## Lógica de seguridad

- **Antes de commit**: valida el patch (no borrar secciones críticas accidentalmente)
- **Backup**: guarda versión anterior en `trainer/backups/{agent}/{timestamp}.md`
- **Rollback**: endpoint `POST /api/rollback` para deshacer último cambio
- **Logs**: cada feedback queda en `trainer/logs/feedback.jsonl` para auditoría

## Stack propuesto

- **Node.js + Express**
- **OpenRouter** (mismo modelo que los agentes, para coherencia)
- **simple-git** — para commit/push
- **GitHub API** (opcional, si queremos PR en vez de commit directo)

## Estructura de archivos (a crear)

```
trainer/
├── src/
│   ├── index.js                  ← Express server
│   ├── routes/
│   │   ├── feedback.js           ← POST /api/feedback
│   │   └── rollback.js
│   ├── core/
│   │   ├── analyzer.js           ← LLM que entiende el feedback
│   │   ├── patcher.js            ← aplica cambios a .md
│   │   └── git.js                ← commit + push
│   └── config/
│       └── agents.js             ← mapping agent→paths
├── backups/
├── logs/
├── package.json
└── .env.example
```

## Variables de entorno

```
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
GITHUB_TOKEN=...
GITHUB_REPO_ALEJANDRA=LuisValades/bot-ia-test-v1
AGENT_ALEJANDRA_PATH=../agentes/alejandra/
# cuando existan:
AGENT_2_PATH=../agentes/agente-2/
AGENT_3_PATH=../agentes/agente-3/
```

## Deploy

- **Local**: `npm run dev` en `http://localhost:4000`
- **Producción**: Modal (mismo patrón que Alejandra) — servicio aparte
