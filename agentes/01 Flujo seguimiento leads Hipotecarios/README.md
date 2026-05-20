# Seguimiento manual — leads Hipotecarios

Tool CLI manual de seguimiento. **No corre automáticamente.** Tú decides cuándo correrlo, contra qué stage, y autorizas el envío explícitamente.

## Flujo de uso (2 pasos obligatorios)

### 1. Generar plan (NUNCA envía)

```bash
node src/index.js --plan --stage agente
node src/index.js --plan --stage lead
node src/index.js --plan --stage calificacion-asesor
```

Aliases válidos:
- `agente` → stage GHL `Ingreso - Test Agent IA`
- `lead` → stage GHL `Ingreso`
- `calificacion-asesor` → stage GHL `Calificación Asesor`

(También aceptas el nombre exacto del stage entre comillas.)

Opcional: una instrucción extra para el LLM al generar los SMS:

```bash
node src/index.js --plan --stage agente --instruction "Recordar que falta INE y comprobante"
```

El plan se guarda en `runs/YYYY-MM-DD_HHhMM_<stage>.plan.json` y se imprime un resumen completo en consola con cada lead, su contexto, y el SMS preview.

### 2. Aplicar el plan (envía a GHL)

Después de revisar el plan en chat conmigo y autorizarlo:

```bash
# Enviar TODOS los eligibles del plan
node src/index.js --apply runs/2026-04-30_18h00_agente.plan.json

# Enviar SOLO algunos (filtro por nombre o contact_id)
node src/index.js --apply runs/2026-04-30_18h00_agente.plan.json --only marybella,rich
```

El reporte de envío se guarda en `runs/YYYY-MM-DD_HHhMM_<stage>.apply.json`.

---

## Filtros de colisión (8 checks)

Un lead **NO recibe SMS** si cualquiera aplica:

| # | Check | Razón |
|---|---|---|
| 1 | `bot_retake_scheduled_at` | Alejandra ya tiene retake programado |
| 2 | `bot_appointment_at` futuro | Tiene cita programada |
| 3 | Tag `bot ia` + en stage del bot, no escalado | Alejandra activa |
| 4 | Tag `atencion-asesor`, `no-contactar`, etc. | Asesor humano ya tomó / lead pidió no contacto |
| 5 | Nota GHL con fecha/día/mes/instrucción negativa | Asesor escribió plan futuro |
| 6 | Último SMS outbound < 48h | Cooldown — ya le hablaron recientemente |
| 7 | Lead respondió "no me interesa" en últimos 30d | Rechazo explícito |
| 8 | Sin teléfono | No se puede enviar SMS |

## Detección de "fecha en nota" (check #5)

Cualquier nota del contacto en GHL que contenga:

- **Día semana**: lunes, martes, miércoles, jueves, viernes, sábado, domingo
- **Mes**: enero, febrero, ..., diciembre
- **Patrón fecha**: "el 5", "día 23", "5/12", "el 4 de mayo"
- **Patrón cita**: "agendado", "llamar el", "contactar el", "verlo el"
- **Hora explícita**: "5 pm", "11 am", "3 de la tarde"
- **Instrucción negativa**: "no contactar", "no insistir", "ya cerró"

→ skip automático con razón específica en el reporte.

## Identidad y tono del SMS

El LLM (Claude Haiku) recibe el system prompt completo de Alejandra (los 6 MDs de `00_ KNOWLEDGE-PLAYBOOKS - AGENT ALEJANDRA/KNOWLOGE + PLAYBOOKS 28.04.26/`). Reglas duras al generar:

- 1-2 frases máximo
- Sin emojis, sin asteriscos, sin firma
- **Cumple §0.3 anti-fechas** del system prompt (no inventa días, meses, horas)
- No recicla info ya dada en la conversación
- Cierra con UNA pregunta abierta corta

## Anti-baneo

- 2 segundos de throttle entre cada SMS al enviar
- No se hace ningún tag-marking ni "saved follow-up state" — cada corrida es independiente
- Si quieres correr 2 veces seguidas el mismo plan, el check #6 (cooldown 48h) bloquea duplicados accidentales

## Estructura

```
01 Flujo seguimiento leads Hipotecarios/
├── README.md                  ← este archivo
├── package.json
├── src/
│   ├── index.js               ← CLI entry
│   ├── clients.js             ← supabase + openrouter + ghl axios
│   ├── stage-pull.js          ← pull leads por stage de Supabase
│   ├── checks.js              ← 8 filtros de colisión
│   ├── note-parser.js         ← regex fechas/instrucciones en notas
│   ├── llm-message.js         ← genera SMS con identidad Alejandra
│   └── reporter.js            ← imprime y guarda planes/reportes
└── runs/                      ← historial de corridas (planes + apply reports)
```

## Credenciales

Reutiliza el `.env` de `agentes/alejandra/`. **No tiene su propio `.env`.** Si las credenciales de Alejandra están en orden, este tool funciona automáticamente.

## Primera corrida

```bash
cd "c:/01_ANTIGRAVITY PROYECTOS/BOT GHL/agentes/01 Flujo seguimiento leads Hipotecarios"
npm install
node src/index.js --plan --stage agente
```
