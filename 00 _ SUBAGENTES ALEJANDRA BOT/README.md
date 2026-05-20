# SUBAGENTES ALEJANDRA — ÍNDICE Y GUÍA DE INTEGRACIÓN

> **Versión:** 1.0 · **Fecha:** 30 de abril de 2026
> **Mantenedor:** Luis Valades — luis@crediexpres.com
> **Para:** Claude Code (integración técnica)

---

## QUÉ ES ESTA CARPETA

Esta carpeta contiene los **prompts de cada subagente** de Alejandra. Es la migración del agente monolítico (un solo prompt de ~200K chars con `gpt-4o-mini` o `claude-haiku-4-5`) a una arquitectura de **subagentes especializados** con guardrails determinísticos.

**Cada archivo es un prompt listo para producción** — Claude Code lo lee y lo conecta al modelo correspondiente vía OpenRouter.

---

## ARQUITECTURA EN UNA LÍNEA

```
Mensaje lead → Guardian (código) → Router (LLM) → Subagente especializado (LLM) → Validator (código) → SMS
```

---

## ÍNDICE DE ARCHIVOS

| Archivo | Subagente | Modelo | Prompt size | Función |
|---|---|---|---|---|
| `99_arquitectura-general.md` | — | — | — | Visión completa del sistema. **Lee esto PRIMERO**. |
| `00_router.md` | 🧭 Router | `claude-haiku-4-5` | ~400 palabras | Clasifica intención y decide a qué subagente mandar |
| `01_greeter.md` | 👋 Greeter | `claude-haiku-4-5` | ~350 palabras | Pasos 1-2: saludo + nombre + tipo crédito |
| `02_hipoteca-qualifier.md` | 🏠 Hipoteca | `claude-haiku-4-5` | ~700 palabras | Pasos 3-7 hipoteca |
| `03_pyme-qualifier.md` | 💼 PyME | `claude-haiku-4-5` | ~750 palabras | Pasos 3-7 PyME (3 sub-rutas) |
| `04_closer.md` | ✅ Closer | `claude-haiku-4-5` | ~500 palabras | Paso 8 cierre + manejo de hora del lead |
| `05_objection-handler.md` | 🛡️ Objections | `claude-sonnet-4-5` | ~600 palabras | 40 objeciones (estilo socrático) |
| `06_multimodal.md` | 📎 Multimodal | `claude-haiku-4-5` | ~400 palabras | Procesa imagen/audio/PDF |
| `07_followup-personalizer.md` | 🔄 Followup | `claude-haiku-4-5` | ~250 palabras | Personaliza plantillas fijas A2-A5 / B1-B3 |
| `08_escalator-code.md` | 🚨 Escalator | **CÓDIGO** (sin LLM) | — | Especificación del handoff inmediato |

---

## REGLAS GLOBALES (todos los subagentes deben respetarlas)

### REGLA #0 — TAG `bot ia`

El **Guardian de código** verifica esto ANTES de invocar cualquier subagente:

- Si el contacto NO tiene tag `bot ia` en GHL → **bot no responde, no se invoca subagente**.
- Si tiene `bot ia` → continúa al Router.

Esta regla se aplica en `src/guardrails/tag-checker.js`, NO en los prompts.

### REGLA #1 — ANTI-FECHAS

Ningún subagente puede generar:
- Días de la semana ("lunes", "martes", ...)
- Meses ("enero", "febrero", ...)
- Fechas calendario ("4 de mayo", "el 15")
- Horas que el lead NO haya dicho primero

**Validator de código** (`src/guardrails/anti-fechas.js`) regex-bloquea estos patrones antes de enviar el SMS. Si detecta uno, devuelve la respuesta al subagente para que la regenere.

### REGLA #2 — UNA PREGUNTA POR TURNO

Excepto Paso 5 hipoteca (asalariado/independiente + ingresos — fusionada por diseño), cada subagente hace UNA sola pregunta por respuesta.

### REGLA #3 — FORMATO DE RESPUESTA

Cada subagente devuelve **dos partes** en su respuesta:

1. **Texto del SMS** (lo que se manda al lead, sin emojis al inicio, sin asteriscos dobles)
2. **ACTION JSON** al final, encerrado en `[ACTION]...[/ACTION]`:

```
[ACTION]{"next_agent":"<router|greeter|hipoteca|pyme|closer|objection|multimodal|escalator|done>","profile_updates":{},"needs_escalation":false,"reasoning":"breve"}[/ACTION]
```

`next_agent` indica a qué subagente debe ir el siguiente turno (puede ser sí mismo si falta capturar más datos).

---

## CONFIGURACIÓN DE MODELOS

En `.env`:

```env
OPENROUTER_MODEL_ROUTER=anthropic/claude-haiku-4-5
OPENROUTER_MODEL_GREETER=anthropic/claude-haiku-4-5
OPENROUTER_MODEL_HIPOTECA=anthropic/claude-haiku-4-5
OPENROUTER_MODEL_PYME=anthropic/claude-haiku-4-5
OPENROUTER_MODEL_CLOSER=anthropic/claude-haiku-4-5
OPENROUTER_MODEL_OBJECTION=anthropic/claude-sonnet-4-5
OPENROUTER_MODEL_MULTIMODAL=anthropic/claude-haiku-4-5
OPENROUTER_MODEL_FOLLOWUP=anthropic/claude-haiku-4-5
```

---

## PINECONE — CHUNKING POR SUBAGENTE

| Subagente | Namespace Pinecone | Fuente |
|---|---|---|
| Router | (no usa) | — |
| Greeter | (no usa) | — |
| Hipoteca | `knowledge-hipoteca` | `02_knowledge-hipotecario.md` chunkeado por H3 |
| PyME | `knowledge-pyme` | `03_knowledge-pyme.md` chunkeado por H3 |
| Closer | (no usa) | — |
| Objections | `objections` | `05_objeciones.md` chunkeado por H3 |
| Multimodal | (no usa) | — |
| Followup | (no usa, usa plantillas) | — |

Top-k recomendado: 3-5 chunks por query.

---

## PASOS DE INTEGRACIÓN PARA CLAUDE CODE

1. Lee primero `99_arquitectura-general.md`.
2. Crea la estructura de carpetas en `agentes/alejandra/src/agents/` y `src/guardrails/`.
3. Para cada subagente, crea un módulo JS que:
   - Carga el prompt desde `src/prompts/<agente>.md`
   - Llama a OpenRouter con el modelo de su `.env`
   - Devuelve `{ sms, action }`
4. Implementa los guardrails en `src/guardrails/`.
5. Re-ingestar Pinecone con el nuevo namespacing.
6. Migrar `src/ai.js` → `src/orchestrator.js` que coordina Router → Subagentes → Validator.
7. Mantener `src/followup.js` con plantillas fijas, llamando solo al `followup-personalizer` para personalización.
8. Implementar logging por subagente para debug (saber cuál falló si algo se rompe).

---

## CRITERIO DE ÉXITO

El bot debe pasar este test:

```
Lead: "Info, vi video y me interesa asesoría"
Bot esperado: saludo canónico + pide nombre

Lead: "Luis Valades"
Bot esperado: pregunta tipo crédito (1 Hipotecario / 2 PyME)

Lead: "1, quiero comprar propiedad"
Bot esperado: pregunta monto aproximado

[... sigue flujo de 8 pasos ...]
```

Si el bot **respeta el orden de pasos y NO inventa fechas**, la migración fue exitosa.
