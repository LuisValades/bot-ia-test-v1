# SECUENCIA DE SEGUIMIENTO — BOT ALEJANDRA
> Lógica de reactivación para leads sin respuesta
> CrediExpres México · Abril 2026

---

## ESCENARIO A — Lead que nunca respondió (o primer contacto frío)

> Día 1 = el día en que escribió por primera vez y no hubo respuesta.
> El bot NO envía nada fuera del horario hábil.
> Ventana permitida: **11:00 am – 7:00 pm · Lunes a Viernes únicamente.**

---

### DÍA 2 — Dos contactos

| Turno | Horario | Enviar si... |
|---|---|---|
| Mañana | 11:30 am | Siempre |
| Tarde | 4:00 pm | Solo si no respondió el de la mañana |

**A2-M:**
> "Ayer te escribí sobre tu consulta de crédito y no tuve respuesta.
>
> ¿Sigues interesado o cambió algo?"

**A2-T:**
> "Por si no viste el mensaje de esta mañana — cualquier duda sobre hipoteca, crédito o financiamiento aquí estamos.
>
> Solo dime y arrancamos 👍"

---

### DÍA 3 — Dos contactos

| Turno | Horario | Enviar si... |
|---|---|---|
| Mediodía | 12:00 pm | Siempre |
| Tarde | 5:00 pm | Solo si no respondió el del mediodía |

**A3-M:**
> "¿Sabías que la asesoría con nosotros no tiene ningún costo para ti?
>
> Nosotros cobramos al banco, no al cliente. Si quieres te explicamos cómo funciona — son 10 minutos."

**A3-T:**
> "Todavía hay lugar esta semana si quieres que analicemos tu caso.
>
> ¿Te agendamos la llamada rápida?"

---

### DÍA 4 — Un contacto

| Turno | Horario | Enviar si... |
|---|---|---|
| Mediodía | 11:30 am | Siempre |

**A4:**
> "¿Todo bien?
>
> Llevamos varios días sin respuesta y quería asegurarme de que estuvieras bien.
>
> Si ya no te interesa el crédito no hay problema, solo avísame y no te escribimos más."

---

### DÍA 5 — Cierre empático (mensaje final)

| Turno | Horario |
|---|---|
| Mediodía | 11:00 am |

**A5 — CIERRE (texto fijo, no modificar):**
> "Este será mi último mensaje de seguimiento.
>
> Entiendo que quizás no es el momento ideal para continuar con tu trámite, así que no te molestaremos más por ahora.
>
> Si en el futuro decides retomar, avísanos y con gusto te apoyamos.
>
> Mientras tanto, te invitamos a seguirnos para consejos financieros e inmobiliarios:
> 📺 YouTube: https://www.youtube.com/@luisvaladesbroker
> 🔵 Facebook: https://www.facebook.com/luis.valades.broker.hipotecario/"

→ Después de enviar A5: marcar lead como `finalizado` en Supabase. **No enviar más mensajes.**

---

### Vista rápida — Escenario A

```
Día 1  →  Lead escribe · Bot responde · Sin respuesta
Día 2  →  11:30 am  |  4:00 pm
Día 3  →  12:00 pm  |  5:00 pm
Día 4  →  11:30 am  (¿Todo bien?)
Día 5  →  11:00 am  (Cierre + RRSS)
─────────────────────────────────
Total:  6 mensajes · Solo lunes a viernes · 11am–7pm
```

---

---

## ESCENARIO B — Lead estaba en conversación y se cortó

> El lead mostró interés, dio algún dato, y dejó de responder.
> Los intervalos son más cortos porque el lead está caliente.
> Si tras 3 intentos de reactivación no responde → **pasa automáticamente al patrón A desde el Día 2**.

---

### FASE CALIENTE — Misma sesión / mismo día

| # | Espera | Límite horario | Contenido |
|---|---|---|---|
| B1 | +90 minutos | Antes de 7:00 pm | Recordatorio ligero |
| B2 | +3 horas (si no respondió B1) | Antes de 7:00 pm | Retoma con contexto |
| B3 | Día siguiente 11:30 am | — | Buenos días, donde quedamos |

**B1 (90 min después):**
> "Oye, ¿sigues por aquí?
>
> Nos quedamos a medias — cuando puedas seguimos."

**B2 (+3 horas):**
> "Sin apuro, solo que no quiero que pierdas el momento.
>
> ¿Retomamos?"

**B3 (día siguiente 11:30 am):**
> "Ayer quedamos platicando sobre tu [hipoteca / crédito / liquidez].
>
> ¿Tienes unos minutos hoy para terminar el análisis?"

---

### CASO ESPECIAL — Lead vio los slots pero no eligió uno

Si el lead estaba en stage `proponiendo_horario` y dejó de responder, el B1 re-propone los slots en formato limpio. Sin saludo, sin nombre, sin bullets, sin frases de relleno.

**B1 — lead en stage slots (90 min después):**
> "¿Viste los horarios?
>
> [día]
> 1 — [hora]
> 2 — [hora]
> 3 — [hora]
>
> ¿Cuál te queda bien?"

Ejemplo real:
> "¿Viste los horarios?
>
> miércoles 22
> 1 — 11:00
> 2 — 14:00
> 3 — 16:00
>
> ¿Cuál te queda bien?"

**B2 — lead en stage slots (día siguiente 11:30 am):**
> "Todavía hay horarios disponibles para la llamada.
>
> ¿Alguno de estos te viene?
>
> [día]
> 1 — [hora]
> 2 — [hora]"

> ⚠️ Si los slots originales ya vencieron, hacer fetch de slots actuales antes de enviar B1 o B2.

---

### TRANSICIÓN B → A

```
Sin respuesta tras B1 + B2 + B3
         ↓
stage → "conversacion_fria"
         ↓
Continuar con Escenario A desde Día 2
(mismos mensajes, ventana 11am–7pm, lunes a viernes)
         ↓
Si tampoco responde → Día 5 Cierre + RRSS
         ↓
stage → "finalizado"
```

---

### Vista rápida — Escenario B completo

```
[Conversación activa]
Lead se corta
  ↓
+90 min     →  B1 (ligero)
+3 horas    →  B2 (retoma)
Día sig.    →  B3 (11:30 am)
  ↓ sin respuesta
─── TRANSICIÓN A PATRÓN A ─────
Día +2  →  11:30 am  |  4:00 pm
Día +3  →  12:00 pm  |  5:00 pm
Día +4  →  11:30 am  (¿Todo bien?)
Día +5  →  11:00 am  (Cierre + RRSS)
───────────────────────────────
Total: 3 intentos calientes + 6 seguimientos fríos
```

---

---

## REGLAS GLOBALES

| Regla | Detalle |
|---|---|
| Ventana permitida | **11:00 am – 7:00 pm · Lunes a Viernes** |
| Sábado y Domingo | ❌ No enviar nada |
| Si el lead responde cualquier cosa | Reiniciar contador — vuelve al flujo normal |
| Si el lead dice "no me interesa" | Detener de inmediato. Sin más mensajes. |
| Si pide no contactarlo | Detener + marcar `bloqueado` en Supabase |
| Mensajes repetidos | Nunca enviar el mismo texto dos veces al mismo lead |
| Referirse al equipo | Usar "nosotros" / "te apoyamos" — nunca "Luis" en los nudges |

---

## CONFIG RECOMENDADA

```javascript
// Escenario A — horarios de envío
FOLLOWUP_A_TIMES_DAY2 = ["11:30", "16:00"]
FOLLOWUP_A_TIMES_DAY3 = ["12:00", "17:00"]
FOLLOWUP_A_TIMES_DAY4 = ["11:30"]
FOLLOWUP_A_TIMES_DAY5 = ["11:00"]   // cierre

// Escenario B — fase caliente
FOLLOWUP_B_DELAY_1_MIN = 90          // minutos tras último mensaje del lead
FOLLOWUP_B_DELAY_2_HRS = 3           // horas tras B1
FOLLOWUP_B_NEXT_DAY    = "11:30"     // hora del B3

// Ventana global
FOLLOWUP_WINDOW_START  = "11:00"
FOLLOWUP_WINDOW_END    = "19:00"
FOLLOWUP_SKIP_WEEKEND  = true        // sábado y domingo fuera
MAX_FOLLOWUPS          = 9           // 3 calientes + 6 fríos
```

---

## ESTADOS DEL LEAD EN SUPABASE

```
inicio
  → calificando
  → proponiendo_horario
  → confirmado
  → conversacion_fria      ← B1/B2/B3 sin respuesta
  → seguimiento_a          ← entró al patrón frío
  → finalizado             ← después del cierre día 5
  → bloqueado              ← pidió no ser contactado
```

---

## FORMATO DE SLOTS — REFERENCIA RÁPIDA

| ❌ Incorrecto | ✅ Correcto |
|---|---|
| "Hola Luis! 😊 Solo quería saber si..." | Sin saludo, sin nombre, directo al grano |
| "Recuerda que tengo disponibles estos horarios:" | "¿Viste los horarios?" o "¿Alguno de estos te viene?" |
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

*Bot Alejandra · Secuencia de seguimiento v1.2 · CrediExpres México · Abril 2026*