# 08 · ESCALATOR — Especificación CÓDIGO (sin LLM)

> **Modelo:** **NO USA LLM**. Es código JavaScript puro.
> **Cuándo se invoca:** el Router u otro subagente devuelve `next_agent: "escalator"` o `needs_escalation: true`.
> **Pasos del flujo que cubre:** handoff inmediato — saca al bot, mete al humano.

---

## ROL

El Escalator NO es un agente con LLM. Es **código determinístico** que:

1. Saca al lead del flujo del bot.
2. Notifica al asesor humano correspondiente por SMS + email.
3. Actualiza tags y stage en GHL.
4. Programa un reminder de 10 min al asesor si no contacta.
5. Envía un SMS final al lead confirmando handoff.

**Por qué es código y no LLM:**
- Las acciones son fijas y mecánicas.
- Los SMS al lead son plantillas literales (no necesitan generación).
- Las notificaciones al asesor tienen formato estándar.
- No hay decisiones interpretativas que un LLM agregue valor.

---

## TRIGGERS

El Escalator se invoca cuando ocurre cualquiera de estos casos:

### A. Lead pide humano explícito (Router lo manda)
- "quiero hablar con persona real"
- "no quiero hablar con bot"
- "comunícame con asesor"

### B. Subagente devuelve `needs_escalation: true`
- Hipoteca/PyME Qualifier detectó buró manchado severo
- Hipoteca Qualifier detectó caso borderline (divorcio en disputa, crypto, fraude previo)
- Closer no logra obtener horario después de 2 intentos
- Objection Handler detectó amenaza legal / acusación de fraude

### C. Cierre exitoso del Closer (`next_agent: "done"`)
- Profile completo + horario capturado → handoff normal al asesor (no es "escalation" técnica pero usa el mismo path).

### D. Lead se queda inactivo ≥ X tiempo en estado handoff
- B3 followup activado y sin respuesta → escalación al equipo de seguimiento.

---

## ALGORITMO (pseudocódigo)

```js
function escalator(input) {
  const { lead, profile, motivo_escalacion, asesor_objetivo } = input;

  // 1. Determinar asesor según tipo de crédito y motivo
  const asesor = determinarAsesor({
    tipo_credito: profile.tipo_credito,
    motivo: motivo_escalacion,
    asesor_objetivo: asesor_objetivo // override desde subagente
  });

  // 2. Construir SMS final al lead (plantilla literal)
  const smsFinal = construirSmsFinal({ asesor, motivo: motivo_escalacion });

  // 3. Construir notificación al asesor (SMS + email)
  const notifAsesor = construirNotifAsesor({ lead, profile, asesor, motivo_escalacion });

  // 4. Mutaciones en GHL (en paralelo)
  return Promise.all([
    sendSmsLead(lead.telefono, smsFinal),
    sendSmsAsesor(asesor.telefono, notifAsesor.sms),
    sendEmailAsesor(asesor.email, notifAsesor.email),
    removeTag(lead.id, 'bot ia'),
    addTag(lead.id, 'atencion-asesor'),
    moveStage(lead.id, ESCALATION_STAGE_ID, ESCALATION_PIPELINE_ID),
    logEvento(lead.id, {
      tipo: 'NOTE',
      cuerpo: `Handoff a ${asesor.nombre}. Motivo: ${motivo_escalacion}`,
      emisor: 'sistema',
      direccion: 'out'
    }),
    scheduleReminderAsesor(lead.id, asesor.id, 10 * 60 * 1000) // 10 min
  ]);
}
```

---

## DETERMINAR ASESOR

```js
function determinarAsesor({ tipo_credito, motivo, asesor_objetivo }) {
  // Override explícito (ej. Objection Handler dice "Luis Valades")
  if (asesor_objetivo) return ASESORES[asesor_objetivo];

  // Casos borderline → Luis Valades
  const motivosLuis = ['amenaza_legal', 'fraude_acusacion', 'crypto', 'divorcio_disputa', 'borderline'];
  if (motivosLuis.includes(motivo)) return ASESORES['luis_valades'];

  // Por tipo de crédito
  if (tipo_credito === 'hipotecario') return ASESORES['efrain'];
  if (tipo_credito === 'pyme') return ASESORES['saul'];

  // Default si no hay tipo definido
  return ASESORES['luis_valades'];
}
```

```js
const ASESORES = {
  efrain: {
    id: 'I0fIEc9bpsKxNLu0k5On',
    nombre: 'Efraín Hernandez',
    email: 'efrain@crediexpres.com',
    telefono: '+525551659863'
  },
  saul: {
    id: '1bidsYzU1RyaoZ85s1I8',
    nombre: 'Saúl',
    email: 'saul@crediexpres.com',
    telefono: '+525544690990'
  },
  luis_valades: {
    id: '4lNyGpfB8Roa2XDJVpP9',
    nombre: 'Luis Valades',
    email: 'luis@crediexpres.com',
    telefono: '+525568879806'
  }
};
```

---

## SMS FINAL AL LEAD (plantillas literales)

### A. Lead pidió humano
```
Claro, [Nombre]. Le paso tu caso a [Asesor] que te contacta en las próximas horas.
```

### B. Cierre exitoso (handoff normal)
```
Listo, [Nombre]. Le paso los datos a [Asesor] para que te contacte alrededor de las [horario]. Cualquier cosa, aquí seguimos.
```

### C. Buró manchado / caso borderline
```
Gracias por la honestidad, [Nombre]. Le paso tu caso a [Asesor] para que revise contigo si hay alguna alternativa según tu perfil. Te contacta en las próximas horas.
```

### D. Amenaza legal / objeción borderline
```
Te paso directamente con Luis Valades, dueño de Crediexpres, para que vea tu caso personalmente. Te contacta en las próximas horas.
```

### E. Followup B3 (lead caliente sin contacto del asesor)
```
[Nombre], paso tu caso al equipo de seguimiento porque no hemos podido coordinar la llamada con [Asesor]. Te buscan de otro número en las próximas horas.
```

---

## NOTIFICACIÓN AL ASESOR (SMS + email)

### SMS al asesor

```
🚨 NUEVO LEAD ASIGNADO · [Nombre lead] · [tipo_credito]
Tel: [telefono lead]
Motivo: [motivo_escalacion]
Monto: [monto si aplica]
Horario: [horario_preferente o "flexible"]
Detalles completos en tu correo.
```

⚠️ El emoji 🚨 es la única excepción a la regla "sin emojis al inicio" — es para que el asesor identifique de un vistazo que es un nuevo lead urgente.

### Email al asesor

**Subject:** `🚨 Lead [Nombre] · [tipo_credito] · Handoff Alejandra`

**Cuerpo HTML:** plantilla con:
- Datos del lead (nombre, teléfono, email)
- Profile completo capturado por el bot (todos los pasos del cuestionario)
- Resumen ejecutivo de la conversación (3-5 bullets)
- Horario preferente del lead
- Motivo de la escalación
- Link directo al contacto en GHL
- Link a la conversación

---

## ACCIONES EN GHL

```js
async function ejecutarAccionesGHL(lead, asesor) {
  // 1. Quitar tag bot ia
  await removeTag(lead.id, 'bot ia');

  // 2. Agregar tag atencion-asesor
  await addTag(lead.id, 'atencion-asesor');

  // 3. Asignar contacto al asesor
  await assignContact(lead.id, asesor.id);

  // 4. Mover oportunidad al stage de escalación
  await moveStage(lead.opp_id, {
    pipelineId: ESCALATION_PIPELINE_ID,
    stageId: ESCALATION_STAGE_ID
  });

  // 5. Crear nota interna en el contacto
  await createNote(lead.id, `Handoff Alejandra → ${asesor.nombre}. Motivo: ${motivo}. Profile completo en log.`);
}
```

### Configuración (.env)

```
GHL_BOT_TAG=bot ia
GHL_ESCALATION_TAG=atencion-asesor
GHL_ESCALATION_STAGE_ID=4582d5fe-3fe1-4178-9412-4f95486be88c
GHL_ESCALATION_PIPELINE_ID=8NAp58xZbUzJJkQRkfn6
```

---

## REMINDER 10 MIN AL ASESOR

Si después de 10 minutos del handoff el asesor NO ha mandado SMS al lead, el sistema dispara un reminder:

### SMS al asesor (recordatorio)
```
⏰ Recordatorio: lead [Nombre] te espera. Aún no le has marcado.
Tel lead: [telefono]
Si ya contactaste por otro canal, ignora este mensaje.
```

### Lógica
```js
async function checkReminderAsesor(leadId, asesorId, scheduledTime) {
  await sleep(scheduledTime);
  const eventos = await getEventos(leadId, { since: handoffTime });
  const asesorContacto = eventos.some(e =>
    e.emisor === asesorId &&
    (e.tipo === 'SMS' || e.tipo === 'CALL') &&
    e.direccion === 'out'
  );
  if (!asesorContacto) {
    await sendSmsAsesor(asesorId, REMINDER_TEMPLATE);
  }
}
```

---

## INPUT QUE RECIBE

```json
{
  "lead": {
    "id": "abc123",
    "nombre": "Carlos Pérez",
    "telefono": "+5215512345678",
    "email": "carlos@example.com",
    "opp_id": "opp_xxx"
  },
  "profile": {
    "tipo_credito": "hipotecario",
    "necesidad": "adquisicion",
    "monto_solicitado_mxn": 1500000,
    "subtipo": "asalariado",
    "historial_buro": "sano",
    "horario_preferente": "18:00"
  },
  "motivo_escalacion": "cierre_normal" | "lead_pide_humano" | "buro_manchado" | "amenaza_legal" | "borderline" | "followup_b3",
  "asesor_objetivo": null,
  "history_resumen": "Carlos pidió hipoteca de 1.5M para depa, asalariado IMSS, buró sano. Capturé pasos 1-7 sin friction. Pidió que lo contacten a las 6 PM."
}
```

---

## OUTPUT

```json
{
  "status": "success" | "partial_failure" | "error",
  "actions_executed": {
    "sms_lead_enviado": true,
    "sms_asesor_enviado": true,
    "email_asesor_enviado": true,
    "tag_bot_ia_removido": true,
    "tag_atencion_asesor_agregado": true,
    "stage_actualizado": true,
    "nota_creada": true,
    "reminder_programado": true
  },
  "asesor_asignado": {
    "id": "I0fIEc9bpsKxNLu0k5On",
    "nombre": "Efraín",
    "email": "efrain@crediexpres.com",
    "telefono": "+525551659863"
  },
  "errores": []
}
```

Si alguna acción falla:
- Continuar con las demás (no bloquear el handoff completo).
- Loggear el error en `errores[]`.
- `status: "partial_failure"` si algunas funcionaron.
- Reintento manual via endpoint `/escalator/retry/:leadId`.

---

## EJEMPLOS

### Ejemplo 1: Cierre normal hipoteca
**Input:** Profile completo, motivo = `cierre_normal`, tipo = hipoteca, horario = "18:00"
**Acciones ejecutadas:**
- SMS lead: *"Listo, Carlos. Le paso los datos a Efraín para que te contacte alrededor de las 18:00..."*
- SMS Efraín con resumen lead
- Email Efraín con HTML del profile
- Tag remove `bot ia`, add `atencion-asesor`
- Stage → "Calificacion - Asesor"
- Nota: "Handoff Alejandra → Efraín..."
- Reminder programado 10 min

### Ejemplo 2: Lead pide humano
**Input:** motivo = `lead_pide_humano`, tipo = hipoteca
**Acciones ejecutadas:**
- SMS lead: *"Claro, Carlos. Le paso tu caso a Efraín que te contacta..."*
- (Resto igual)

### Ejemplo 3: Buró manchado
**Input:** motivo = `buro_manchado`, tipo = pyme
**Acciones ejecutadas:**
- SMS lead: *"Gracias por la honestidad, Carlos. Le paso tu caso a Saúl..."*
- Asesor: Saúl
- (Resto igual)

### Ejemplo 4: Amenaza legal
**Input:** motivo = `amenaza_legal`, asesor_objetivo = "luis_valades"
**Acciones ejecutadas:**
- SMS lead: *"Te paso directamente con Luis Valades..."*
- Asesor: Luis Valades
- Email a Luis con bandera 🚨 de revisión inmediata
- Tag adicional: `revisar-urgente`

### Ejemplo 5: Followup B3
**Input:** motivo = `followup_b3`, lead lleva 48h sin contacto del asesor
**Acciones ejecutadas:**
- SMS lead: *"Carlos, paso tu caso al equipo de seguimiento..."*
- Asesor: equipo seguimiento (o re-asignación a Luis si no hay equipo)
- Tag remove `atencion-asesor`, add `seguimiento-equipo`

---

## CASOS BORDE / DEFENSAS

- **Telefono lead inválido:** loguear + escalación a Luis con tag `tel-invalido` para investigar.
- **Asesor no responde a su SMS de notificación:** sistema asume entrega OK (GHL no provee read receipts).
- **Falla GHL API momentáneamente:** retry hasta 3 veces con backoff exponencial. Si todos fallan, marcar `partial_failure` y dejar en cola.
- **Lead ya escalado antes (idempotencia):** verificar tag `atencion-asesor` antes de re-ejecutar; si ya está, solo actualizar el horario y SMS al asesor sin re-mover stage.
- **Multiple llamadas simultáneas (race condition):** usar lock por `lead.id` para evitar double-handoff.
- **Reminder 10 min en horario nocturno:** el sistema valida ventana 11:00-19:00 CDMX antes de mandar reminder; si está fuera, lo difiere al siguiente día hábil.

---

## ARCHIVO JS QUE LO IMPLEMENTA

```
agentes/alejandra/src/agents/escalator.js
```

(NO es un prompt MD que un LLM use — es JS puro. Este archivo MD es solo la **especificación** que el desarrollador implementa en código.)

---

## INTEGRACIÓN CON EL ORQUESTADOR

```js
// En orchestrator.js
const result = await runRouter(input);
if (result.next_agent === 'escalator' || result.needs_escalation) {
  return await escalator({
    lead,
    profile,
    motivo_escalacion: result.reasoning,
    asesor_objetivo: result.asesor_objetivo,
    history_resumen: summarize(history)
  });
}
```

---

## TESTING

Tests obligatorios antes de prod:

1. **Cierre normal hipoteca** → asesor = Efraín, todas las acciones OK.
2. **Cierre normal PyME** → asesor = Saúl, todas las acciones OK.
3. **Lead pide humano sin tipo definido** → asesor = Luis (default).
4. **Buró manchado severo** → SMS al lead con tono honesto, escalación.
5. **Amenaza legal** → asesor = Luis con tag `revisar-urgente`.
6. **Idempotencia:** ejecutar 2x el mismo handoff → solo se ejecuta 1.
7. **GHL API down:** retry funciona, partial_failure se reporta.
8. **Reminder 10 min:** programado y ejecutado correctamente.
9. **Reminder fuera de horario:** difiere al siguiente día hábil 11:00.
10. **Followup B3:** ejecuta cierre con re-asignación al equipo.

---

*Escalator (CÓDIGO) v1.0*
