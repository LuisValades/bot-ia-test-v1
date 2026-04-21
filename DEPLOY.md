# Deploy público — Dashboard + Trainer

Este documento explica cómo poner el Dashboard y el Trainer en vivo con URLs públicas.

## Arquitectura

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│  Dashboard (Vercel)  │────→│  Trainer (Modal)     │────→│  .md files montados  │
│  Next.js UI pública  │     │  Express + Analyzer  │     │  agentes/alejandra/  │
└──────────────────────┘     └──────────────────────┘     └──────────────────────┘
         │                             │
         └──────────fetch──────────────┘

                  ┌──────────────────────┐
                  │  Alejandra (Modal)   │ ← ya desplegada
                  │  SMS webhook GHL     │
                  └──────────────────────┘
```

---

## Paso 1 — Trainer a Modal (1 vez)

### 1.1 Crear secret con las env vars

Edita el archivo `trainer/.env.modal` (créalo si no existe):

```bash
OPENROUTER_API_KEY=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
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

PORT=4000

# Path a las carpetas de agentes DENTRO del container Modal
AGENTS_ROOT=/app/agentes

# Safe mode en Modal (no hay git en el container)
GIT_AUTO_COMMIT=false
GIT_AUTO_PUSH=false

# URL del Dashboard (llenar después del paso 2)
DASHBOARD_ORIGIN=*
```

### 1.2 Crear el Modal secret

Desde la raíz del proyecto:

```bash
cd "c:/01_ANTIGRAVITY PROYECTOS/BOT GHL/trainer"
python -m modal secret create trainer-env --from-dotenv .env.modal
```

### 1.3 Deploy

```bash
cd "c:/01_ANTIGRAVITY PROYECTOS/BOT GHL/trainer"
python -m modal deploy modal_app.py
```

Te dará una URL tipo `https://luisvalades--crediexpres-trainer-serve.modal.run`. **Cópiala** — la necesitas para Vercel.

### 1.4 Verificar

```bash
curl https://luisvalades--crediexpres-trainer-serve.modal.run/health
```

Debería responder `{"ok":true,...}`.

---

## Paso 2 — Dashboard a Vercel (1 vez)

### 2.1 Ir a Vercel

- Abre https://vercel.com/signup
- Clic **"Continue with GitHub"** (usa tu cuenta de GitHub donde tienes el repo `bot-ia-test-v1`)

### 2.2 Importar el repo

- Dashboard → **"Add New"** → **"Project"**
- Elige el repo **`LuisValades/bot-ia-test-v1`**
- Clic **"Import"**

### 2.3 Configurar el build

- **Framework Preset:** Next.js (lo detecta solo)
- **Root Directory:** clic **"Edit"** → escribe `dashboard` → **"Continue"**
- **Build Command:** `npm run build` (default, dejar)
- **Output Directory:** (default, dejar)

### 2.4 Environment Variables

Agregar las 4 siguientes (clic "Add More" para cada una):

| Name | Value |
|---|---|
| `OPENROUTER_API_KEY` | `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` |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `TRAINER_URL` | *(la URL que te dio Modal en paso 1.3)* |

### 2.5 Deploy

- Clic **"Deploy"**
- 2-3 minutos de build
- Te dará URL tipo `https://bot-ia-test-v1.vercel.app` o similar

### 2.6 Actualizar CORS del Trainer

Ahora que tienes la URL de Vercel, actualiza el secret del Trainer para permitirla:

```bash
# Edita trainer/.env.modal y pon:
DASHBOARD_ORIGIN=https://tu-app.vercel.app

# Re-crea el secret
cd "c:/01_ANTIGRAVITY PROYECTOS/BOT GHL/trainer"
python -m modal secret create trainer-env --from-dotenv .env.modal --force

# Redeploy Trainer
python -m modal deploy modal_app.py
```

---

## Paso 3 — Verificar

Abre la URL de Vercel y:

1. **/** → Inicio con las 3 cards de agentes (Alejandra debe mostrar activa)
2. **/entrenar** → conversa con Alejandra (debe responder con su system prompt real)
3. **/conocimiento** → ver secciones del knowledge.md
4. **/metricas**, **/historial**, **/config** → todas responden

---

## Actualizaciones futuras

### Cambios al Dashboard
- Haces commit + push a `main`
- Vercel redeploya automáticamente (~1 min)

### Cambios al Trainer
- Haces commit + push a `main`
- Re-deploy manual:
  ```bash
  cd trainer
  python -m modal deploy modal_app.py
  ```

### Cambios al knowledge.md / prompt de Alejandra
- Los haces local
- Deployas Alejandra a Modal (como hasta ahora):
  ```bash
  cd agentes/alejandra
  python -m modal deploy modal_app.py
  ```
- El Trainer en Modal lee los .md del **container montado** — así que también hay que redeployarlo si el Dashboard debe ver los cambios:
  ```bash
  cd trainer
  python -m modal deploy modal_app.py
  ```

---

## Notas operativas

- **Trainer en Modal NO puede hacer git push** porque no hay credenciales git en el container. Los patches aplicados desde Dashboard público **modifican solo el container Modal**, no tu repo local ni GitHub. Para que los feedbacks lleguen a producción permanente, edita los .md localmente y redeploya Alejandra.
- **Dashboard + Trainer local** siguen funcionando igual para desarrollo (`npm run dev` en ambos).
- **Costos:** Vercel tiene free tier generoso. Modal cobra por tiempo de container — con `min_containers=1` son ~$20-40/mes por servicio. Si quieres bajar costo, pon `min_containers=0` (arranca on-demand, primera llamada tarda 10-20s).
