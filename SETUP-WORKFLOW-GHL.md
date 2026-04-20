# Configuración Workflow GHL para Bot Alejandra

**Pipeline:** Liquidez hipotecaria
**Etapa:** Bot IA
**Pipeline ID:** `VQbBNUAUFUCks2WoqzRF`
**Stage ID:** `ab45385e-0011-472d-8e59-bec415bc9b2b`

---

## Workflow 1: TRIGGER inicial (cuando lead entra a Bot IA)

**Nombre sugerido:** `🤖 Bot Alejandra - Trigger Bot IA`

### Trigger
- Tipo: **Pipeline Stage Changed**
- Pipeline: `Liquidez hipotecaria`
- In Stage: `Bot IA`

### Filtro (recomendado)
- Filter: contact tiene un teléfono válido

### Action: Webhook
```
URL:    https://TU-DOMINIO.ngrok-free.app/webhook/ghl/trigger
Method: POST
Headers:
  Content-Type: application/json
Body (JSON):
{
  "contact_id": "{{contact.id}}",
  "phone": "{{contact.phone}}",
  "full_name": "{{contact.name}}",
  "pipeline_id": "{{opportunity.pipeline_id}}",
  "stage_id": "{{opportunity.pipeline_stage_id}}"
}
```

---

## Workflow 2: RESPUESTA cuando el lead contesta SMS

**Nombre sugerido:** `🤖 Bot Alejandra - Respuesta SMS`

### Trigger
- Tipo: **Customer Replied**
- Channel: **SMS**

### Filtro (importante)
- Pipeline: `Liquidez hipotecaria`
- In Stage: `Bot IA`
*(esto evita que el bot responda mensajes de leads en otras etapas)*

### Action: Webhook
```
URL:    https://TU-DOMINIO.ngrok-free.app/webhook/ghl/reply
Method: POST
Headers:
  Content-Type: application/json
Body (JSON):
{
  "contact_id": "{{contact.id}}",
  "phone": "{{contact.phone}}",
  "full_name": "{{contact.name}}",
  "message": "{{message.body}}",
  "direction": "inbound"
}
```

---

## Cómo probar localmente

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Crear las tablas en Supabase** (ya hecho con `sql/schema.sql`)

3. **Levantar el bot:**
   ```bash
   npm run dev
   ```

4. **Exponer al internet con ngrok:**
   ```bash
   npx ngrok http 3000
   ```
   Te da una URL: `https://xxxx-xxx-xxx.ngrok-free.app`

5. **Configurar los 2 workflows arriba** con esa URL

6. **Probar:**
   - Mover un lead a la etapa `Bot IA` (o usar el ya existente: `Luis Valades _ test`)
   - Debería recibir un SMS de Alejandra
   - Responder el SMS → bot debería continuar la conversación

---

## Test rápido sin GHL workflow (simular webhook)

Si solo quieres probar el bot sin tocar GHL aún:

```bash
# Trigger inicial (Alejandra saluda al lead Luis Valades _ test)
curl -X POST http://localhost:3000/webhook/ghl/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "KKtxHJBlt2Zdb44B7ZgS",
    "phone": "+525568879806",
    "full_name": "Luis Valades"
  }'

# Simular que el lead responde
curl -X POST http://localhost:3000/webhook/ghl/reply \
  -H "Content-Type: application/json" \
  -d '{
    "contact_id": "KKtxHJBlt2Zdb44B7ZgS",
    "message": "Quiero información sobre liquidez hipotecaria",
    "direction": "inbound"
  }'
```

⚠️ **El SMS se envía REALMENTE.** Si haces el primer test, Luis Valades recibirá un SMS al `+525568879806`.

---

## Estado para mover el lead fuera del bot

Cuando el bot agenda cita (`stage = 'confirmado'` en Supabase), se queda inactivo. Si quieres que GHL automáticamente mueva al lead a la siguiente etapa (ej. `Nurturing` o `Autorizados`), agrega un **Workflow 3:**

### Workflow 3 (opcional): Mover lead tras agendamiento
- Trigger: **Appointment Booked** en calendario `rKBa7F4Yef7M5fj1wPGR`
- Action: **Move Opportunity** a etapa `Autorizados` (u otra)
