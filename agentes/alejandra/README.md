# Bot Alejandra — SMS GHL

Bot SMS conversacional con IA para **Crediexpres Mexico**. Califica leads por SMS, agenda citas en GoHighLevel, procesa imágenes/PDFs/audios (MMS) y hace follow-up automático.

## Producción

- **URL pública (Modal):** https://luisvalades--bot-alejandra-ghl-serve.modal.run
- **Health:** `/health`
- **Webhooks GHL:** `/webhook/ghl/trigger` y `/webhook/ghl/reply`
- **Dashboard:** https://modal.com/apps/luisvalades/main/deployed/bot-alejandra-ghl

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node 20 + Express + node-cron |
| Chat / visión / PDF | OpenRouter → `openai/gpt-4o-mini` |
| Transcripción audio | OpenRouter → `openai/gpt-4o-mini-audio-preview` |
| SMS / Calendario | GoHighLevel API (PIT token) |
| Persistencia | Supabase (`conversations`, `messages`) |
| Deploy | Modal (Python wrapper → contenedor Node) |

## Features

- **Memoria total** del lead — lee hasta 100 msgs del historial en cada turno
- **Name-capture** — si GHL no trae `firstName`, Alejandra pregunta el nombre y lo persiste
- **Tono WhatsApp natural** — tutea, 4-5 frases cortas, emojis ocasionales
- **Horarios reales** desde el calendario GHL (`free-slots`)
- **Agendamiento directo** en GHL cuando el lead acepta un slot
- **Follow-up cron** — cada 1 min revisa conversaciones activas sin respuesta >5 min y manda recordatorio contextual (máx 2 por lead)
- **MMS multimodal** — ve imágenes, lee PDFs, transcribe audios que llegan por MMS

## Estructura

```
BOT IA GHL TEST/
├── .env                      # credenciales (NO commiteado)
├── modal_app.py              # wrapper Python para deploy Modal
├── package.json
├── sql/
│   └── schema.sql            # tablas Supabase + migración followup
├── src/
│   ├── index.js              # Express + webhooks + cron
│   ├── env.js                # dotenv con override (evita env vars Windows)
│   ├── openrouter.js         # cliente OpenRouter compartido
│   ├── ai.js                 # prompt Alejandra + buildUserContent multimodal
│   ├── ghl.js                # API GHL (SMS, contact, calendar, appointment)
│   ├── db.js                 # Supabase CRUD
│   ├── calendar.js           # slots + formato español
│   ├── followup.js           # cron de recordatorios
│   └── media.js              # descarga attachments + transcripción audio
├── SETUP-WORKFLOW-GHL.md     # cómo crear los Workflows en GHL
└── README.md
```

## Setup local

```bash
npm install
# Aplicar sql/schema.sql en tu proyecto Supabase
npm run dev                   # arranca con --watch, auto reload
```

Necesitas `.env` con:
```
GHL_LOCATION_ID=...
GHL_API_TOKEN=pit-...
GHL_CALENDAR_ID=...
GHL_TRIGGER_PIPELINE_ID=...
GHL_TRIGGER_STAGE_ID=...
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o-mini
TRANSCRIBE_MODEL=openai/gpt-4o-mini-audio-preview
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_...
```

## Deploy a Modal

Primera vez:
```bash
pip install modal python-dotenv
python -m modal setup                                           # autentica
python -m modal secret create bot-alejandra-env --from-dotenv .env
python -m modal deploy modal_app.py
```

Actualizar tras cambios:
```bash
python -m modal deploy modal_app.py                             # redeploy (caché de layers)
# Si cambió .env:
python -m modal secret create bot-alejandra-env --from-dotenv .env --force
python -m modal deploy modal_app.py
```

En Windows agrega `PYTHONUTF8=1` antes de los comandos Modal por encoding UTF-8.

## Flujo del bot

```
Lead entra a stage "Bot IA" → Workflow GHL → POST /webhook/ghl/trigger
                                               ↓
                                         Alejandra saluda por SMS
                                               ↓
Lead responde SMS → Workflow GHL → POST /webhook/ghl/reply
                                               ↓
                               Procesa attachments (imagen/PDF/audio)
                                               ↓
                     Lee historial completo de Supabase (100 msgs)
                                               ↓
                        gpt-4o-mini multimodal con contexto + ACTION JSON
                                               ↓
                 Si ACTION.book_slot → crea cita en GHL
                 Si ACTION.propose_slots → consulta free-slots → ofrece
                 Si ACTION.captured_name → guarda en conversations.full_name
                                               ↓
                        sendSMS vía GHL + logMessage en Supabase

Paralelo — cada 1 min:
Cron → busca conversaciones activas sin respuesta >5 min
     → genera recordatorio contextual con historial
     → envía SMS + incrementa followup_count
```

## Setup de Workflows en GHL

Ver [SETUP-WORKFLOW-GHL.md](SETUP-WORKFLOW-GHL.md). Necesitas 2 workflows:
- **Trigger:** Pipeline Stage Changed (In Stage "Bot IA") → Webhook a `/webhook/ghl/trigger`
- **Reply:** Customer Replied (SMS) → Webhook a `/webhook/ghl/reply`

Para MMS multimodal, el workflow Reply debe incluir `attachments: {{message.attachments}}` en el body.

## Costos aproximados (por 1000 conversaciones)

| Item | Costo |
|---|---|
| gpt-4o-mini (texto) | ~$0.10 |
| Con imagen adjunta | +$0.50 (por 1000 imágenes) |
| Con PDF (5 pág avg) | +$1.50 (por 1000 PDFs) |
| Con audio (1 min avg) | +$10 (por 1000 audios) |
| Supabase | gratis en free tier |
| Modal compute | ~$5/mes con min_containers=1 |
| GHL SMS | usa tu balance Twilio/GHL |

## Tuning (env vars opcionales)

- `OPENROUTER_MODEL` — cambia el modelo de chat
- `TRANSCRIBE_MODEL` — cambia el modelo de audio
- `FOLLOWUP_DELAY_MIN` — minutos sin respuesta para disparar nudge (default 5)
- `MAX_FOLLOWUPS` — máx recordatorios por lead (default 2)

## Troubleshooting

- **Cron spamea `column followup_count does not exist`** → aplica la migración al final de `sql/schema.sql` en Supabase SQL Editor
- **`.trim is not a function` en logs** → ya está fix con `coerceMessage()`, si reaparece revisa qué tipo manda GHL en `message`
- **OpenRouter 401 "User not found"** → env var `OPENROUTER_API_KEY` colisiona con otra var de Windows; `src/env.js` usa `dotenv override:true` para resolverlo
- **Modal cold start lento** → ya tenemos `min_containers=1`, revisa el dashboard si cambia

## Licencia

Propietario — Crediexpres Mexico.
