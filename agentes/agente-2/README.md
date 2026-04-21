# Agente 2 — *(rol por definir)*

**Estado:** 🔜 Placeholder

## A definir con Luis

- **Rol / función principal**: calificación inicial / propiedades / recordatorios / otro
- **Etapa GHL donde correrá**: ej. "Nuevo lead", "Primera llamada pendiente", etc.
- **Objetivo de la conversación**: qué resultado busca (agendar / calificar / recuperar)

## Estructura esperada (cuando se construya)

Misma que Alejandra, cada archivo con contenido propio del nuevo rol:

```
agente-2/
├── src/
│   ├── index.js
│   ├── ai.js
│   ├── ghl.js
│   └── ...
├── knowledge.md
├── prompt.md
├── secuencia.md
├── modal_app.py
├── package.json
└── .env
```

## Cómo arrancarlo cuando se defina

1. Copiar estructura de `agentes/alejandra/` como base
2. Reescribir `prompt.md` y `knowledge.md` para el nuevo rol
3. Deploy a Modal con nombre distinto (ej. `agente-2-calificacion`)
4. Conectar webhook GHL a la etapa correspondiente
5. Registrarlo en el selector del Dashboard (`dashboard/src/lib/bots.ts`)
6. Registrarlo en el Trainer (`trainer/src/config/bots.js`) con su path y archivos .md
