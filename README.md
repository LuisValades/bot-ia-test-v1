# Bot Alejandra - SMS GHL

Bot SMS conversacional con IA para CrediExpres Mexico. Responde leads, agenda citas en GoHighLevel.

## Stack

- Node.js 20+ / Express
- OpenRouter (Claude Haiku 4.5) — IA conversacional
- GoHighLevel API — SMS, calendario, contactos
- Supabase — contexto y logs

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear tablas en Supabase

1. Entra a [app.supabase.com](https://app.supabase.com) → tu proyecto `BOT CLAUDE SUPABASE`
2. SQL Editor → New Query
3. Pega y corre el contenido de `sql/schema.sql`

### 3. Variables de entorno

El archivo `.env` ya está configurado con:
- `GHL_*` — credenciales y location_id de CrediExpres
- `OPENROUTER_*` — API key + modelo
- `SUPABASE_*` — URL y service key

### 4. Levantar el servidor local

```bash
npm run dev
```

Verás:
```
Bot Alejandra escuchando en puerto 3000
Webhook: POST http://localhost:3000/webhook/ghl
```

### 5. Exponer al internet (para que GHL llegue al webhook)

```bash
npx ngrok http 3000
```

Te da una URL pública tipo `https://xxxx.ngrok-free.app`. Esa va al webhook de GHL.

### 6. Configurar Workflow en GHL

1. Sub-cuenta → Automation → Workflows → New
2. Trigger: **Stage Changed in Pipeline** → tu pipeline → etapa que dispara el bot
3. Action: **Webhook**
   - URL: `https://xxxx.ngrok-free.app/webhook/ghl`
   - Method: POST
   - Body: JSON con `contact_id`, `phone`, `full_name`
4. Crear segundo Workflow:
   - Trigger: **Customer Replied** (SMS inbound)
   - Action: **Webhook** al mismo endpoint con `contact_id` y `message`

## Estructura

```
BOT IA GHL TEST/
├── .env                    # credenciales (NO subir a git)
├── package.json
├── sql/
│   └── schema.sql          # tablas Supabase
└── src/
    ├── index.js            # servidor Express + webhook
    ├── db.js               # cliente Supabase + helpers
    ├── ghl.js              # API GHL (SMS, calendario, contactos)
    ├── ai.js               # OpenRouter + prompt Alejandra
    └── calendar.js         # lógica de slots y formato
```

## Flujo del bot

```
GHL webhook → /webhook/ghl
  ↓
1. Carga/crea conversación en Supabase
2. Carga últimos 10 msgs como contexto
3. Si está proponiendo horario → consulta slots de GHL
4. Llama OpenRouter con prompt de Alejandra
5. Si IA dice "agendar" → consulta calendario y propone horarios
6. Si lead acepta → crea cita en GHL
7. Envía respuesta por SMS via GHL
8. Loguea todo en Supabase
```

## Despliegue

Recomendado: **Railway** o **Render**.

```bash
# Railway
railway init
railway up

# Render
# Conecta el repo y selecciona Node, build: npm install, start: npm start
```

Variables de entorno: copiar todas las del `.env` al servicio.

## Pruebas

```bash
# Health check
curl http://localhost:3000/health

# Simular webhook entrante
curl -X POST http://localhost:3000/webhook/ghl \
  -H "Content-Type: application/json" \
  -d '{"contact_id":"ID_REAL_DE_GHL","message":"Hola, quiero info"}'
```

## Costos estimados

- **OpenRouter**: ~$0.0005 por respuesta SMS (Claude Haiku 4.5) → $0.50 USD por 1,000 conversaciones
- **Supabase**: gratis (free tier sobra)
- **GHL SMS**: usa el balance de SMS de tu cuenta GHL
- **Hosting**: $5-7 USD/mes (Railway/Render)
