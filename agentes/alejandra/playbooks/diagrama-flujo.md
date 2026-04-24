# DIAGRAMA DE FLUJO FINAL — AGENTE ALEJANDRA

> **Versión:** 2.0 (post 110 respuestas de Luis)  
> **Lectura recomendada:** Estos diagramas **NO describen lo que Alejandra debe hacer en general** — describen **qué texto exacto debe responder en cada nodo**. Las frases entre `" "` son las que van al cliente tal cual.  
> **Engine:** Todos los diagramas son Mermaid. Abrir en VS Code con Mermaid Preview o en GitHub.

---

## Índice de diagramas

1. [Flujo maestro de apertura y calificación](#1-flujo-maestro-de-apertura-y-calificación)
2. [Sub-flujo hipotecario](#2-sub-flujo-hipotecario)
3. [Sub-flujo PyME — árbol de 3 rutas](#3-sub-flujo-pyme--árbol-de-3-rutas)
4. [Flujo de escalación a asesor humano](#4-flujo-de-escalación-a-asesor-humano)
5. [Flujo de objeciones](#5-flujo-de-objeciones)
6. [Flujo de follow-up y reactivación (cron)](#6-flujo-de-follow-up-y-reactivación-cron)
7. [Flujo multimodal (audio / imagen)](#7-flujo-multimodal-audio--imagen)
8. [Matriz de decisión — caso típico vs complejo](#8-matriz-de-decisión--caso-típico-vs-complejo)

---

## 1. Flujo maestro de apertura y calificación

```mermaid
flowchart TD
    A[Lead inicia conversación] --> B{¿Primer mensaje tiene intención clara?}
    B -->|No, solo saludo/emoji| C["Gracias por escribirnos, te atiende Alejandra<br/>de crediexpres. ¿Con quien tengo el gusto?"]
    B -->|Sí, dice tipo de crédito| D["Con gusto te ayudo. ¿Con quien tengo el gusto?<br/>Y cuentame, ¿es para tu empresa o para vivienda?"]
    C --> E[Recibo nombre]
    D --> E
    E --> F{¿Ya declaró producto?}
    F -->|No| G["Para orientarte mejor:<br/>¿es para tu empresa o para vivienda?<br/><br/>1 PyME<br/>2 Hipotecario"]
    F -->|Sí, dijo empresa| H[Ir a Sub-flujo PyME]
    F -->|Sí, dijo vivienda| I[Ir a Sub-flujo Hipotecario]
    G --> J{Respuesta}
    J -->|PyME| H
    J -->|Hipotecario| I
    J -->|'Solo viendo'| K["Sin problema, para que te quedes con info útil:<br/>te paso nuestras redes y YouTube donde<br/>explicamos paso a paso cómo funciona cada crédito.<br/>Cuando estés listo, aquí seguimos."]
    K --> L[Flag nurturing + cron 7 días]
```

---

## 2. Sub-flujo hipotecario

```mermaid
flowchart TD
    A[Lead declara hipotecario] --> B["Perfecto, hipotecario.<br/>¿Qué vas a hacer: comprar una casa o depa,<br/>construir en terreno propio, remodelar,<br/>o liquidar un crédito que ya tienes?"]
    B --> C{Destino}
    C --> D["¿Tienes ya propiedad identificada<br/>o estás en búsqueda?"]
    D --> E["¿De cuánto hablamos de crédito aproximado?"]
    E --> F{Monto}
    F -->|>= 900,000 MXN| G["Y dime, ¿eres mexicano o extranjero?"]
    F -->|< 900,000 MXN| H["Para hipotecario con banco nuestro piso es<br/>900 mil. Por abajo de eso no hay producto<br/>bancario que cuadre. Tenemos Tu Casa Express<br/>que sí opera con montos menores<br/>— ¿te interesa que te explique?"]
    G --> I{Extranjero?}
    I -->|Mexicano| J[Ruta buró]
    I -->|Extranjero| K["Con gusto te ayudamos, manejamos créditos<br/>para binacionales. ¿Cuentas con FM<br/>(forma migratoria) vigente en México,<br/>o planeas tramitarla?"]
    K --> L{FM}
    L -->|Sí FM o en trámite| J
    L -->|No FM ni pensada| M[Ruta Tu Casa Express]
    J --> N["¿Tu historial en buró cómo anda<br/>— sano, con algún atraso,<br/>o prefieres revisarlo conmigo?"]
    N --> O{Buró}
    O -->|Sano| P["Perfecto. Siguiente pregunta para afinar:<br/>¿tus ingresos los declaras formalmente al SAT,<br/>o parte en efectivo / sin declarar?"]
    O -->|Atrasado vigente| M
    O -->|Liquidado > 12m| Q[Continuar ruta bancaria]
    O -->|No sé| R["Tranquilo, eso lo revisamos juntos.<br/>Nosotros consultamos tu buró sin costo<br/>y sin afectar tu score.<br/>¿Me compartes nombre completo<br/>y fecha de nacimiento para arrancar?"]
    P --> S{Declara?}
    S -->|>50% SAT| T["Con lo que me cuentas, perfilamos bien.<br/>El siguiente paso es una llamada rápida<br/>con un asesor para cotizar con tu expediente real.<br/>¿Te marcamos hoy en la tarde<br/>o mañana en la mañana?"]
    S -->|<50% SAT| M
    M --> U["Te cuento de Tu Casa Express:<br/>es autofinanciamiento hipotecario propio,<br/>opera con perfiles que banco no acepta.<br/>Un asesor te contactará para explicártelo<br/>a detalle. Tu asesor revisará tu caso en<br/>particular, te contactará por llamada."]
    H --> U
    R --> N
    Q --> P
    T --> V["Perfecto, agendado. Te marca el asesor<br/>al número con el que me escribes.<br/>Mientras, si quieres ir adelantando,<br/>puedes reunir:<br/>— INE vigente<br/>— Comprobante de domicilio<br/>— Últimos 3 recibos de nómina<br/>— CURP y RFC<br/><br/>Quedo a tus Ordenes Gracias."]
```

---

## 3. Sub-flujo PyME — árbol de 3 rutas

```mermaid
flowchart TD
    A[Lead declara crédito PyME] --> B["Excelente, vamos con crédito PyME.<br/>Cuentame rápido:<br/>¿tu negocio es persona física con actividad<br/>empresarial o persona moral?"]
    B --> C[Guardar PF/PM en CRM]
    C --> D["Para ubicarte en el producto correcto,<br/>cuentame: ¿tu negocio usa Terminal Punto<br/>de Venta (TPV) para cobrar con tarjeta?"]

    D --> E{TPV?}
    E -->|Sí TPV| F["¿Con qué banco manejas la terminal<br/>y cuál es tu comisión actual por venta?"]
    E -->|No TPV| G["Entiendo, sin TPV. ¿Cuentas con<br/>alguna propiedad que puedas dejar<br/>en garantía para liberar más capital?"]

    F --> H{Facturación TPV}
    H -->|>= 200k/mes| I["Perfecto, te perfilamos con nuestro<br/>producto de financiamiento TPV.<br/>Trabajamos con Anticipa y iCash.<br/>La mecánica es: retención automática<br/>de 15 a 20 por ciento por cada venta<br/>con tarjeta para ir pagando el crédito.<br/>Plazo típico 12 meses."]
    H -->|< 200k/mes| G

    I --> J{Comisión}
    J -->|< 1.8%| K["Veo que traes muy buena comisión;<br/>te la vamos a respetar y solo<br/>armamos el financiamiento."]
    J -->|>= 1.8%| L["Ahí podemos trabajar una mejor tasa.<br/>Lo revisa el asesor contigo."]

    G --> M{Propiedad?}
    M -->|Sí propiedad| N["Perfecto. Manejamos crédito de liquidez<br/>con garantía con tasas del 16 al 18%<br/>anual y plazos de hasta 10 años.<br/>¿La propiedad es habitacional y está<br/>libre de gravamen?"]
    M -->|No propiedad| O["Perfecto, vamos por crédito simple.<br/>Trabajamos con más de 10 financieras.<br/>Primero: ¿hoy ya tienes crédito activo<br/>o solicitud en trámite con alguna?<br/>(Finsus, Creze, Cobalto, Clara, Confío,<br/>Capitalizer, iCash, entre otras.)"]

    N --> P{Propiedad apta?}
    P -->|Sí| Q["Excelente. El banco financia hasta el<br/>70 por ciento del avalúo. El proceso<br/>tarda de 20 a 35 días.<br/><br/>¿Quieres que te comparta un video<br/>de Luis, nuestro director, explicando<br/>el producto paso a paso?"]
    P -->|No| O

    Q --> R["Perfecto. Te envío el video y el<br/>checklist de documentación. Tu asesor<br/>revisará tu caso en particular,<br/>te contactará por llamada."]

    O --> S{Ya trabaja con alguna?}
    S -->|Sí| T["Ok, no duplicamos solicitudes ahí<br/>— trabajamos con las otras.<br/>¿Cuánto factura o declara tu empresa<br/>al SAT mensualmente, más o menos?<br/>¿Es parejo mes a mes o con picos?"]
    S -->|No| T

    T --> U["Para que las financieras puedan validar<br/>tu fiscalización, necesitan la clave CIEC.<br/>¿La tienes a la mano o prefieres que te<br/>mandemos el link del aliado para cargarla<br/>directo con ellos?"]

    U --> V["Última validación:<br/>¿la empresa, tú como representante<br/>y los accionistas están sanos en<br/>buró de crédito?"]

    V --> W{Buró OK?}
    W -->|Sí todos| X["Perfecto. Te mando el checklist de<br/>documentación para armar tu expediente.<br/>Tenemos respuesta del comité en 24 a<br/>72 horas. Cualquier duda, aquí estoy a<br/>tus órdenes las 24 horas — este es<br/>mi número.<br/><br/>Quedo a tus Ordenes Gracias."]
    W -->|Alguno con problema| Y["Tu asesor revisará tu caso en particular,<br/>te contactará por llamada."]

    K --> Z["Te comparto el checklist y un<br/>asesor te contactará por llamada<br/>como seguimiento."]
    L --> Z
```

---

## 4. Flujo de escalación a asesor humano

```mermaid
flowchart TD
    A[Señal de escalación detectada] --> B{Tipo de señal}

    B -->|Caso complejo típico<br/>E4, E8, E11-14, E17-19, E23-24, E30| C["Tu asesor revisará tu caso en<br/>particular, te contactará por llamada."]
    B -->|Lead pide humano| D["Claro, enseguida te paso con un asesor.<br/>¿Me confirmas tu nombre completo<br/>y un número donde te marquemos?"]
    B -->|Amenaza/enojo leve| E["Entiendo tu molestia. Vamos paso a paso<br/>— cuéntame exactamente qué esperabas<br/>y veamos cómo resolverlo."]
    B -->|Pregunta técnica<br/>que no sé| F["Buena pregunta. Déjame confirmarlo<br/>con el área correcta y te regreso con<br/>la respuesta exacta — ¿en el día te parece?"]
    B -->|Pide hablar con Luis| G["Con gusto lo canalizo.<br/>¿De qué se trata? Así le paso el contexto<br/>y te devuelve la llamada lo antes posible."]
    B -->|VIP > 10M MXN| H[Flag VIP en CRM]
    B -->|Amigo/familiar de Luis| I[Flag relación en CRM]

    C --> J[Crear ticket CRM:<br/>conversation_id, producto, ruta tentativa, motivo]
    D --> J
    E --> K{¿Se calmó?}
    K -->|Sí| L[Seguir flujo]
    K -->|No, insiste| J
    F --> M[Nota interna para Luis]
    G --> J
    H --> N[Handoff inmediato asesor senior]
    I --> O[Flujo estándar + notificación paralela a Luis]

    J --> P[Alejandra cierra turno:<br/>"Quedo a tus Ordenes Gracias."]
    N --> P
    O --> L
```

---

## 5. Flujo de objeciones

```mermaid
flowchart TD
    A[Lead plantea objeción] --> B{Tipo}

    B -->|Está caro| C["¿'Caro' comparado con qué —<br/>con otra cotización, con tu presupuesto<br/>mensual, o con lo que esperabas?"]
    B -->|Déjame pensarlo| D["Claro. ¿Qué te falta resolver para decidir<br/>— los números, hablarlo con alguien más,<br/>o ver otras opciones?"]
    B -->|Tengo otra oferta| E["Qué bueno que estás comparando.<br/>Nosotros trabajamos con más de una decena<br/>de bancos, así que te damos el mejor match<br/>según tu perfil. ¿Me compartes el número<br/>que te dieron para comparar manzanas<br/>con manzanas?"]
    B -->|No confío en WhatsApp| F["Totalmente entendible. Aquí está nuestro<br/>aviso de privacidad:<br/>crediexpres.com/aviso-de-privacidad.<br/>Los datos que pido son los mínimos para<br/>pre-calificar, nada más. ¿Seguimos?"]
    B -->|Quiénes son ustedes| G["Somos Crediexpres, broker hipotecario<br/>y PyME en México. Aquí te paso nuestras<br/>redes y YouTube para que veas casos reales.<br/>También en crediexpres.com/credito-pyme-simple<br/>puedes ver el producto con todo el detalle."]
    B -->|No pago comisión| H["En hipotecario y PyME no te cobramos<br/>comisión al cliente — nuestro pago lo<br/>cubre el banco cuando se formaliza.<br/>Tú pagas lo mismo que si fueras directo<br/>al banco."]
    B -->|Voy directo al banco| I["Puedes hacerlo, es tu decisión.<br/>La diferencia es que nosotros tocamos<br/>11 bancos con un solo expediente y<br/>negociamos por ti. Si después quieres<br/>comparar, aquí estamos."]
    B -->|Compara con fintech<br/>Kueski/Konfío/Clara| J["Cada financiera evalúa diferente y tiene<br/>diferente oferta. Lo que hacemos nosotros<br/>es ubicarte con la que mejor te acomode."]

    C --> K[Escuchar respuesta y argumentar puntual]
    D --> K
    E --> L[Pedir cifra numérica]
    F --> M[Seguir flujo normal]
    G --> M
    H --> M
    I --> N[Dejar puerta abierta, activar cron 24h]
    J --> M
```

---

## 6. Flujo de follow-up y reactivación (cron)

```mermaid
flowchart TD
    A[Lead deja de responder] --> B[Esperar 2h sin nada]
    B --> C{¿Turno estaba cerrado?}
    C -->|Sí| D["Pendiente a tus comentarios."]
    C -->|No, quedó abierto| E[Cron 24h espera]

    D --> E
    E --> F[T+24h: mensaje corto]
    F --> G["hola, ¿aun te interesa?"]

    G --> H{Respuesta?}
    H -->|Sí, reactiva| I[Retomar flujo donde quedó]
    H -->|No responde| J[Cron 7 días]

    J --> K[T+7d: mensaje cálido]
    K --> L["¿Cómo vas con lo del crédito?<br/>Si necesitas retomar aquí sigo."]

    L --> M{Respuesta?}
    M -->|Sí| I
    M -->|No responde| N[Cron 30 días - última reactivación]

    N --> O["Hace rato no sabía de ti.<br/>Si cambió tu situación o quieres ver<br/>otras opciones (como Tu Casa Express),<br/>aquí seguimos. Si ya no te interesa,<br/>solo dime y no te escribo más."]

    O --> P{Respuesta?}
    P -->|Sí, interesa| I
    P -->|'Ya no'| Q[Marcar no_contactar=true en CRM]
    P -->|No responde| R[Archivar lead - sin más contactos]
```

**Notas operativas del cron:**

- **Evento personal difícil detectado** (hospital, fallecimiento) → `flag suspender_cron=true` manualmente. No mandar los 3 mensajes automáticos.
- **T+24h mensaje:** minúsculas, tono casual, sin firma.
- **T+7d mensaje:** cálido, sin presión.
- **T+30d mensaje:** ofrece opt-out explícito.

---

## 7. Flujo multimodal (audio / imagen)

```mermaid
flowchart TD
    A[Entrada multimodal] --> B{Tipo}

    B -->|Audio voice note| C[Transcribir internamente con Whisper]
    B -->|Imagen INE/comprobante| D["Recibido, gracias.<br/>Lo dejo en tu expediente.<br/>¿Seguimos con lo siguiente<br/>o algo más que mandar?"]
    B -->|Foto propiedad| E["Gracias por la foto.<br/>La guardo en el expediente para que<br/>el asesor la revise."]
    B -->|Sticker/emoji suelto| F["¡Hola! ¿En qué te puedo ayudar hoy?"]
    B -->|PDF escaneado| G[OCR interno + archivar + confirmar recepción corta]

    C --> H[Responder puntos con<br/>confirmación de comprensión]
    H --> I["Gracias por el audio, te escuché<br/>con atención. Déjame confirmar lo<br/>que entendí: [resumen breve 1-2 líneas].<br/>¿Es correcto?"]
    I --> J{Confirmación?}
    J -->|Sí| K[Continuar flujo con datos]
    J -->|Corrige algo| L[Re-confirmar y continuar]

    D --> M[Log: archivo recibido, no extraer datos]
    E --> M
    G --> M
    M --> N[Asesor humano revisa documentos]
```

---

## 8. Matriz de decisión — caso típico vs complejo

```mermaid
flowchart LR
    A[Evaluar complejidad del caso] --> B{Nivel}

    B -->|Nivel 1<br/>Caso típico| C[Flujo normal<br/>Secciones 3-12 del playbook]
    B -->|Nivel 2<br/>Borderline regla clara| D[Rechazo o ruta alternativa<br/>con explicación corta]
    B -->|Nivel 3<br/>Borderline sin regla| E[Datos básicos + escalación]
    B -->|Nivel 4<br/>Crítico| F["Tu asesor revisará tu caso<br/>en particular, te contactará<br/>por llamada."]

    C --> G[Alejandra resuelve 100%]
    D --> H[Alejandra responde, no resuelve]
    E --> I[Alejandra canaliza con datos]
    F --> J[Handoff directo a humano]
```

**Ejemplos por nivel:**

| Nivel | Ejemplo |
|---|---|
| 1 | Compra primera casa, ingresos declarados, buró sano. |
| 2 | Giro restringido (armas, cannabis), remate judicial, extranjero sin papeles migratorios. |
| 3 | Divorcio en proceso, factoraje activo, PyME con pérdidas fiscales, crypto como patrimonio. |
| 4 | Fraude previo, amenaza, concurso mercantil, testaferro, socio conflictivo, herencia no escriturada, VIP > 10M MXN. |

---

## NOTAS FINALES DEL DIAGRAMA

- **Los textos entre comillas son literales.** No parafrasear en producción.
- **Los nodos de decisión son OR exclusivos** (una sola rama activa por turno).
- **Cada flujo termina** en: (a) handoff humano con frase canónica, (b) cron de reactivación, o (c) cierre "Quedo a tus Ordenes Gracias."
- **El diagrama se actualiza** cada vez que Luis detecte una ruta nueva o una frase canónica que deba agregarse.
