# Sofia SMS GHL - Bot Alejandra

## Información del Proyecto

- **Nombre técnico:** ALEJANDRA-sms-ghl
- **Nombre del bot:** Alejandra
- **Carpeta:** `/proyectos/ghl-sms-bot`
- **Plataforma:** GoHighLevel (GHL)
- **Canal:** SMS

## Descripción

Bot SMS con IA que automatiza la conversación inicial con leads y agenda citas directamente en el calendario de GoHighLevel.

## Funcionalidades

1. **Recepción de mensajes**
   - Escucha leads que entran a una etapa predeterminada del pipeline de GHL
   - Activación por trigger/workflow de GHL

2. **Respuesta inteligente con IA**
   - Conversación natural por SMS
   - Comprende intención del lead (interés, objeciones, preguntas)
   - Mantiene tono cercano y profesional

3. **Agendamiento de citas en GHL**
   - Crea citas directamente en el calendario configurado de GHL
   - Vincula la cita al contacto/lead correspondiente

4. **Verificación de disponibilidad**
   - Consulta slots disponibles del calendario antes de proponer horario
   - Evita doble-booking

5. **Confirmación por SMS**
   - Envía mensaje de confirmación con fecha, hora y detalles
   - Opción de reagendar si es necesario

## Stack Sugerido (por definir)

- **Backend:** Node.js / Python
- **IA:** Claude API (Anthropic)
- **Integración:** GHL API v2 (mensajes, calendarios, contactos)
- **SMS:** Twilio nativo de GHL
- **Webhooks:** GHL → Backend

## APIs / Endpoints Clave de GHL

- `POST /conversations/messages` — enviar SMS
- `GET /calendars/{id}/free-slots` — disponibilidad
- `POST /calendars/events/appointments` — crear cita
- Webhook entrante para mensajes recibidos

## Próximos Pasos

- [ ] Definir stack final (Node vs Python)
- [ ] Crear cuenta de desarrollador GHL y obtener API keys
- [ ] Diseñar flujo conversacional de Alejandra (prompts)
- [ ] Configurar etapa de pipeline disparadora en GHL
- [ ] Implementar webhook receptor
- [ ] Integrar Claude API para respuestas
- [ ] Implementar lógica de calendario (disponibilidad + agendar)
- [ ] Pruebas con número SMS real
- [ ] Despliegue (Railway / Render / VPS)

---

> Nota: el prompt original menciona "BOT ALEJANDRA" como título y "sofia-sms-ghl" como nombre técnico — se mantienen ambos. Confirmar cuál usar como nombre del bot frente al lead.
