# SECUENCIA DE SEGUIMIENTO — BOT ALEJANDRA
> Versión 1.3 · Abril 2026
> Lógica de reactivación para leads sin respuesta

---

## ÍNDICE

1. [Estado actual del código vs diseño target](#1-estado-actual)
2. [Escenario A — Lead frío (nunca respondió bien)](#2-escenario-a)
3. [Escenario B — Lead caliente que se cortó](#3-escenario-b)
4. [Transición B → A](#4-transicion)
5. [Reglas globales](#5-reglas-globales)
6. [Estados del lead en Supabase](#6-estados)
7. [Configuración actual y recomendada](#7-configuracion)
8. [Formato de slots en nudges](#8-formato-slots)

---

## 1. ESTADO ACTUAL

### ✅ Implementado en [src/followup.js](src/followup.js)

- Cron cada 1 minuto.
- Si lead en stage activo (`inicio / calificando / proponiendo_horario`) y `last_msg_at < now - FOLLOWUP_DELAY_MIN` (default 5 min) → manda nudge.
- Nudge contextual generado por la IA con historial completo + slots frescos.
- Máximo `MAX_FOLLOWUPS` (default 2) por lead.
- Claim optimista con `followup_count` para evitar duplicados.
- Reset automático del contador si el lead responde.

### 🔜 En roadmap (del diseño target)

- Ventana horaria 11am-7pm lun-vie (actualmente 24/7).
- Intervalos específicos según día (11:30am, 4pm, etc.) vs umbral único de 5 min.
- Escenario B con fases caliente/frío separadas.
- Mensaje de cierre día 5 con links de RRSS.
- Estados `conversacion_fria`, `bloqueado` en Supabase.

---

## 2. ESCENARIO A — Lead frío

> Lead que nunca tuvo una conversación fluida. El bot le manda nudges progresivamente más espaciados.
> Ventana permitida: **11:00 am – 7:00 pm · Lunes a Viernes**.

### Cadencia

| Día | Turno | Horario | Condición |
|---|---|---|---|
| Día 1 | — | — | Conversación inicial o sin respuesta |
| **Día 2** | Mañana | 11:30 am | Siempre |
| Día 2 | Tarde | 4:00 pm | Solo si no respondió al de la mañana |
| **Día 3** | Mediodía | 12:00 pm | Siempre |
| Día 3 | Tarde | 5:00 pm | Solo si no respondió al del mediodía |
| **Día 4** | Mediodía | 11:30 am | Siempre |
| **Día 5** | Mediodía | 11:00 am | Cierre definitivo |

### Textos de referencia

**A2-M (Día 2 mañana):**
> Ayer te escribí sobre tu consulta de crédito y no tuve respuesta.
>
> ¿Sigues interesado o cambió algo?

**A2-T (Día 2 tarde):**
> Por si no viste el mensaje de esta mañana — cualquier duda sobre hipoteca, crédito o financiamiento aquí estamos.
>
> Solo dime y arrancamos 👍

**A3-M (Día 3 mediodía):**
> ¿Sabías que la asesoría con nosotros no tiene costo para ti?
>
> Nosotros cobramos al banco, no al cliente.
>
> Si quieres te explicamos cómo funciona — son 10 minutos.

**A3-T (Día 3 tarde):**
> Todavía hay lugar esta semana si quieres que analicemos tu caso.
>
> ¿Te agendamos la llamada rápida?

**A4 (Día 4):**
> ¿Todo bien?
>
> Llevamos varios días sin respuesta y quería asegurarme de que estuvieras bien.
>
> Si ya no te interesa el crédito no hay problema, solo avísame y no te escribimos más.

**A5 — CIERRE (Día 5, texto fijo):**
> Este será mi último mensaje de seguimiento.
>
> Entiendo que quizás no es el momento ideal para continuar con tu trámite, así que no te molestaremos más por ahora.
>
> Si en el futuro decides retomar, avísanos y con gusto te apoyamos.
>
> Mientras tanto, te invitamos a seguirnos para consejos financieros e inmobiliarios:
> 📺 YouTube: https://www.youtube.com/@luisvaladesbroker
> 🔵 Facebook: https://www.facebook.com/luis.valades.broker.hipotecario/

→ Después de A5: marcar `stage = 'finalizado'` en Supabase. **No enviar más mensajes.**

### Vista rápida

```
Día 1  →  Conversación inicial · Sin respuesta después
Día 2  →  11:30 am  |  4:00 pm (si no respondió mañana)
Día 3  →  12:00 pm  |  5:00 pm (si no respondió mediodía)
Día 4  →  11:30 am  (¿Todo bien?)
Día 5  →  11:00 am  (Cierre + RRSS)
──────────────────────────────────
Total: hasta 6 mensajes · Solo lunes a viernes · 11am–7pm
```

---

## 3. ESCENARIO B — Lead caliente

> El lead mostró interés, dio algún dato, y dejó de responder.
> Los intervalos son **más cortos** porque el lead está caliente.

### FASE CALIENTE — Misma sesión / día siguiente

| # | Espera | Límite horario | Contenido |
|---|---|---|---|
| B1 | +90 minutos | Antes de 7 pm | Recordatorio ligero |
| B2 | +3 horas (si B1 sin respuesta) | Antes de 7 pm | Retoma con contexto |
| B3 | Día siguiente 11:30 am | — | "Donde quedamos" |

**B1 (+90 min):**
> Oye, ¿sigues por aquí?
>
> Nos quedamos a medias — cuando puedas seguimos.

**B2 (+3 hrs después de B1):**
> Sin apuro, solo que no quiero que pierdas el momento.
>
> ¿Retomamos?

**B3 (día siguiente 11:30 am):**
> Ayer quedamos platicando sobre tu [hipoteca / crédito / liquidez].
>
> ¿Tienes unos minutos hoy para terminar el análisis?

### CASO ESPECIAL — Lead en stage `proponiendo_horario`

Si el lead vio slots pero no eligió, el B1 re-propone slots **frescos** (no los que vio antes, porque pueden estar caducos):

**B1 para lead en slots (90 min):**
> ¿Viste los horarios?
>
> miércoles 22
> 1 — 11:00
> 2 — 14:00
> 3 — 16:00
>
> ¿Cuál te queda bien?

**B2 para lead en slots (día siguiente):**
> Todavía hay horarios disponibles para la llamada.
>
> ¿Alguno de estos te viene?
>
> [fetch fresco + formato numerado]

> ⚠️ Si los slots originales ya vencieron, el código hace `getNextSlots()` fresh antes de enviar. Ya implementado en [src/followup.js](src/followup.js).

---

## 4. TRANSICIÓN B → A

```
B1 + B2 + B3 sin respuesta
         ↓
  stage → "conversacion_fria"
         ↓
  Continuar con Escenario A desde Día 2
  (mismos mensajes, ventana 11am–7pm, lunes a viernes)
         ↓
    Si tampoco responde
         ↓
  Día 5 → Cierre + RRSS
         ↓
    stage → "finalizado"
```

### Vista rápida — Escenario B completo

```
[Conversación activa se corta]
  ↓
+90 min     →  B1 (ligero)
+3 horas    →  B2 (retoma)
Día sig.    →  B3 (11:30 am)
  ↓ sin respuesta
─── TRANSICIÓN A PATRÓN FRÍO ─────
Día +2  →  11:30 am  |  4:00 pm
Día +3  →  12:00 pm  |  5:00 pm
Día +4  →  11:30 am  (¿Todo bien?)
Día +5  →  11:00 am  (Cierre + RRSS)
───────────────────────────────────
Total: 3 intentos calientes + hasta 6 fríos
```

---

## 5. REGLAS GLOBALES

| Regla | Detalle | Estado |
|---|---|---|
| Ventana permitida | 11:00 am – 7:00 pm · Lunes a Viernes | 🔜 No implementada |
| Sábado y Domingo | ❌ No enviar nada | 🔜 No implementada |
| Lead responde cualquier cosa | Reiniciar contador → volver al flujo normal | ✅ Implementado (cron resetea al recibir reply) |
| Lead dice "no me interesa" | Detener + `stage = 'finalizado'` | 🔜 Detección actual solo vía `needs_escalation` |
| Lead pide no contactarlo | Detener + `stage = 'bloqueado'` | 🔜 Pendiente |
| Mensajes repetidos | Nunca enviar el mismo texto 2x al mismo lead | ✅ IA genera nuevo cada vez (no templates fijos) |
| Referirse al equipo en nudges | "nosotros" / "te apoyamos" — nunca "Luis" en nudges | ✅ Prompt lo maneja |
| Escalación a asesor | Si lead pide humano → stop + alertar | ✅ Implementado ([sección 9 del prompt](Prompt%20alejandra.md#9-escalacion)) |

---

## 6. ESTADOS DEL LEAD EN SUPABASE

```
inicio
  → calificando
  → proponiendo_horario
  → confirmado          ← cita agendada (bot sigue respondiendo)
  → conversacion_fria   🔜 B1/B2/B3 sin respuesta
  → seguimiento_a       🔜 entró al patrón A tras B
  → finalizado          ← cierre día 5 (bot deja de responder)
  → escalado            ✅ asesor humano toma la conversación (bot deja de responder)
  → bloqueado           🔜 lead pidió no ser contactado
```

### Implementados hoy (Abril 2026)

✅ `inicio`, `calificando`, `proponiendo_horario`, `confirmado`, `finalizado`, `escalado`.

### En roadmap

🔜 `conversacion_fria`, `seguimiento_a`, `bloqueado`.

Si los quieres agregar, no requiere migración de schema (el campo `stage` es text libre). Solo hay que extender la lógica del cron en [src/followup.js](src/followup.js) para manejarlos.

---

## 7. CONFIGURACIÓN

### Env vars actuales (implementadas)

```bash
FOLLOWUP_DELAY_MIN=5      # Min sin respuesta para disparar nudge
MAX_FOLLOWUPS=2           # Máx nudges por lead
RESPONSE_DELAY_MS=10000   # Delay natural antes de enviar SMS
```

### Env vars propuestas (roadmap)

```bash
# Escenario A — horarios de envío
FOLLOWUP_A_TIMES_DAY2=11:30,16:00
FOLLOWUP_A_TIMES_DAY3=12:00,17:00
FOLLOWUP_A_TIMES_DAY4=11:30
FOLLOWUP_A_TIMES_DAY5=11:00

# Escenario B — fase caliente
FOLLOWUP_B_DELAY_1_MIN=90     # minutos tras último mensaje del lead
FOLLOWUP_B_DELAY_2_HRS=3      # horas tras B1
FOLLOWUP_B_NEXT_DAY=11:30     # hora del B3

# Ventana global
FOLLOWUP_WINDOW_START=11:00
FOLLOWUP_WINDOW_END=19:00
FOLLOWUP_SKIP_WEEKEND=true    # sábado y domingo fuera
MAX_FOLLOWUPS=9               # 3 calientes + hasta 6 fríos
```

### Diferencia entre lo actual y el target

**Actual (minimalista):**
- Cron cada 1 min, único umbral (`last_msg_at < now - 5 min`)
- Sin distinción entre escenario A y B
- IA genera el texto del nudge cada vez con contexto

**Target (diseño completo):**
- Horarios específicos por día
- Distinción caliente/frío
- Templates de referencia por fase
- Ventana horaria de negocio

### Para migrar al target

El código actual es compatible: la IA genera mensajes naturales por turno. Para las mejoras faltantes:

1. Agregar ventana horaria al `runFollowups()` — check `isBusinessHours()` antes de enviar.
2. Agregar track de `day_number` para saber qué día va el lead.
3. Agregar lógica de transición B → A en base al stage.

Scope: ~2-3 horas de dev. Avisar cuando sea prioridad.

---

## 8. FORMATO DE SLOTS EN NUDGES

| ❌ Incorrecto | ✅ Correcto |
|---|---|
| "Hola Luis! 😊 Solo quería saber si..." | Sin saludo, sin nombre, directo al grano |
| "Recuerda que tengo disponibles estos horarios:" | "¿Viste los horarios?" / "¿Alguno de estos te viene?" |
| "- miércoles 22 de abril a las 10:00am" | `miércoles 22` como encabezado, luego `1 — 10:00` |
| "¿Te gustaría alguna de estas opciones?" | "¿Cuál te queda bien?" |
| "la asesoría con Luis" | "la asesoría con nosotros" |

**Ejemplo correcto completo:**

```
¿Viste los horarios?

miércoles 22
1 — 11:00
2 — 14:00
3 — 16:00

¿Cuál te queda bien?
```

---

## CHANGELOG

### v1.3 (Abril 2026)
- Marcado claramente qué está implementado vs en roadmap.
- Agregado estado `escalado` al schema (ya implementado en código).
- Referencias cruzadas a [Prompt alejandra.md](Prompt%20alejandra.md).
- Config actual separada de config target.

### v1.2 (anterior)
- Escenarios A/B completos con horarios específicos.
- Cierre día 5 con RRSS.

---

*Bot Alejandra · Secuencia de seguimiento v1.3 · CrediExpres México · Abril 2026*
