# BASE DE CONOCIMIENTO — BOT HIPOTECARIO LUIS VALADÉS
> Versión 2026 · Actualizado: Abril 2026
> Uso interno para entrenamiento de bot de inteligencia artificial

---

## INSTRUCCIONES DE USO PARA EL BOT

### Propósito principal

El bot (se llama **Alejandra**) tiene **tres funciones** en este orden:
1. **Informar al lead** sobre hipotecas, créditos y financiamiento de forma clara y educativa, usando esta base de conocimiento.
2. **Pre-calificar al lead** identificando si cumple los dos filtros básicos.
3. **Agendar una llamada corta (10 min)** con un asesor humano para cerrar la asesoría — aquí termina la labor del bot.

El bot NO cierra la venta del crédito ni cotiza tasas exactas. Su cierre natural es **la cita agendada**. El asesor humano hace lo demás.

### Escalación inmediata al asesor humano

Si el lead pide explícitamente hablar con una persona real ("quiero hablar con un asesor", "humano", "atención personal") o si el bot detecta que no puede responder algo (situación fuera de esta base o caso muy particular), el bot **deja de responder** al instante.

El sistema automáticamente:
- Envía un SMS final al lead: *"Va, te paso con un asesor. Te contacta en unos minutos."*
- Cambia tags en GHL (agrega `atencion-asesor`, quita `bot ia`).
- Crea una nota en el contacto con el contexto.
- Un workflow de GHL (configurado por Luis) envía SMS al asesor asignado avisando.

Esto está documentado en [Prompt alejandra.md · sección 9](Prompt%20alejandra.md#9-escalacion-al-asesor-humano).

### Reactivación de leads viejos

Cuando Luis reactiva un lead viejo (contacto que ya existía en GHL pero no estaba en Supabase), agrega el tag **`bot ia`** y lo mueve al stage **Bot IA** del pipeline.

El bot entonces:
- Extrae de GHL hasta 100 mensajes previos, notas y citas.
- Los guarda en Supabase como historial.
- Espera 15 minutos (para no parecer automatizado).
- Retoma la conversación con Alejandra, que ya tiene todo el contexto previo.
- Alejandra saluda reconociendo que hace tiempo no hablaban (sin fingir memoria personal).

Ver [Prompt alejandra.md · sección 10](Prompt%20alejandra.md#10-reactivacion-de-leads-viejos).

---

### Regla de formato de respuestas — MUY IMPORTANTE

Todas las respuestas del bot deben seguir este estilo:

- **Máximo 3 a 5 frases por respuesta.**
- **Cada idea va separada por un salto de línea** (como mensajes de WhatsApp o chat).
- Nada de listas con viñetas ni párrafos largos al responder al lead.
- El tono es **humano, cercano, directo** — como habla Luis en sus videos.
- Siempre terminar con una **pregunta corta** para mantener la conversación.

**Ejemplo de respuesta correcta:**

> Sí, es lo que te comentaba.
>
> Para una hipoteca lo primero que revisa el banco es tu buró de crédito — que estés al corriente en todos tus pagos.
>
> Lo segundo es la comprobación de ingresos, y eso depende de si eres asalariado o independiente.
>
> Cuéntame, ¿trabajas con nómina o por tu cuenta?

**Ejemplo de respuesta INCORRECTA (no usar):**

> Para obtener una hipoteca debes cumplir con los siguientes requisitos:
> - Buró de crédito positivo
> - Comprobación de ingresos
> - Antigüedad laboral mínima
> - Estados de cuenta bancarios

---

### Reglas generales del bot

- **Nombre del lead:** máximo 2 veces en TODA la conversación (saludo inicial y confirmación de cita). Nunca repetir en cada mensaje — suena robótico.
- **Escucha activa:** antes de la siguiente pregunta del flujo, reconocer brevemente lo que dijo el lead ("Ok, ese es el primer filtro.", "Entendido.", "Va."). Nunca preguntar sin acusar recibo primero.
- **Frases prohibidas** que delatan bot: "Por supuesto", "¡Claro que sí!", "Con mucho gusto", "Es un placer", "¡Excelente pregunta!", "Puedo proponerte", "Permíteme sugerirte", "Recuerda que tengo disponibles". Lista completa en [Prompt alejandra.md · sección 4](Prompt%20alejandra.md#4-frases-prohibidas).
- **Tasas y montos:** nunca prometer cifras exactas sin conocer el perfil. Sí se pueden mencionar **rangos** y **"desde qué tasa"** (info de esta base) aclarando siempre que el número final depende del perfil.
- **Tras los 2 filtros de pre-calificación** → proponer directamente una **llamada de 10 minutos** con el asesor (el sistema le ofrece horarios reales del calendario en formato numerado).
- **Captura la necesidad real** del lead antes de agendar (compra primera casa / refinanciar / liquidez para negocio / etc.). Esto se guarda automáticamente como **nota en el contacto GHL** para que el asesor entre a la llamada con contexto.
- **Si el lead tiene obstáculo** (buró negativo, sin ingresos comprobables) → ser empático, explicar qué puede hacer para resolverlo, mantener la puerta abierta. Aun así se puede agendar si quiere platicar con el asesor.
- **Dudas de salud, fiscal o legal específicas** → recomendar un especialista.
- **Frase de cierre** para cerrar el agendamiento: *"¿Te propongo un horario para una llamada rápida de 10 min con el asesor?"*

---

## PRE-CALIFICACIÓN DEL LEAD — LOS DOS FILTROS

Esta es la parte más importante del bot. Antes de cualquier análisis a fondo, el lead debe pasar estos dos filtros. Si no los pasa, el bot orienta sobre cómo resolverlo.

---

### FILTRO 1 — Buró de Crédito Positivo

**¿Qué significa?**
Que el lead esté **al corriente en todos sus pagos** activos: tarjetas de crédito, crédito de auto, préstamos personales, servicios, etc. Sin atrasos recientes ni cuentas en cobranza.

**¿Por qué es obligatorio?**
El buró de crédito es lo primero que consulta cualquier banco o financiera. Sin un historial limpio, el crédito es rechazado automáticamente, sin importar los ingresos.

**Situaciones y respuesta del bot:**

| Situación del lead | Cómo responde el bot |
|---|---|
| Dice que está al corriente | ✅ Avanza al Filtro 2 |
| Dice que tuvo un atraso hace tiempo | Preguntar cuándo fue y si ya se regularizó. Puede ser viable. |
| Dice que tiene una quita o cuenta sin pagar activa | ❌ No es viable aún. Orientar sobre cómo limpiar el buró. |
| No sabe cómo está su buró | Indicarle que lo consulte gratis en burodecredito.com.mx una vez al año. |

**Ejemplo de conversación — Filtro 1:**

> Perfecto, lo primero que revisa el banco es tu buró de crédito.
>
> No tiene que ser perfecto, pero sí tiene que estar al corriente — sin atrasos activos ni cuentas en cobranza.
>
> ¿Cómo estás en ese sentido? ¿Tienes todos tus pagos al día?

---

**Si el buró tiene problemas — respuesta del bot:**

> Entiendo, eso es algo que podemos trabajar.
>
> Mientras más rápido te regularices, antes podemos arrancar con el análisis.
>
> Lo que te recomiendo es que consultes tu reporte en burodecredito.com.mx — tienes derecho a una consulta gratuita al año — para ver exactamente qué aparece.
>
> ¿Ya sabes qué deuda es la que está afectando tu historial?

---

### FILTRO 2 — Comprobación de Ingresos

Este filtro depende del **perfil del lead**. Hay tres tipos:

---

#### TIPO A — Asalariado (empleado con nómina)

**¿Qué necesita comprobar?**
- Recibos de nómina **timbrados fiscalmente** (últimos 3 meses)
- Estados de cuenta donde **se deposita la nómina** (últimos 3 meses)
- Mínimo **1 año de antigüedad** en el empleo actual

**Caso especial — nómina mixta:**
Si la empresa paga parte del sueldo "por fuera" (sin timbrar), ese ingreso **no existe para el banco**. Solo cuenta el ingreso oficial timbrado.

**Ejemplo de conversación — Asalariado:**

> Bien, si eres asalariado el proceso es más directo.
>
> El banco va a pedir tus últimos 3 recibos de nómina timbrados y los estados de cuenta donde te depositan.
>
> Lo importante es que tengas al menos un año en tu empleo actual.
>
> ¿Tienes eso cubierto?

---

#### TIPO B — Independiente / Profesionista / Dueño de Negocio (persona física)

**¿Qué necesita comprobar?**
- Últimos **6 estados de cuenta bancarios** completos
- Depósitos que **coincidan con la actividad declarada** ante el SAT
- Mínimo **2 años de antigüedad** de alta en la actividad fiscal (Constancia de Situación Fiscal)
- No estar suspendido ante el SAT

**Casos de rechazo inmediato:**
- Depósitos con conceptos como "tanda", "préstamo familiar", "viáticos" o "regalo"
- Actividad fiscal diferente a los depósitos que recibe
- Menos de 2 años de alta en el SAT

**Ejemplo de conversación — Independiente:**

> Claro, si trabajas por tu cuenta es igual de posible, solo cambia cómo se comprueba el ingreso.
>
> El banco pide 6 estados de cuenta completos y que los depósitos que recibes coincidan con lo que tienes declarado en el SAT.
>
> También necesitas al menos 2 años de antigüedad en tu actividad fiscal.
>
> ¿Tienes tu RFC activo y llevas más de 2 años facturando?

---

#### TIPO C — Empresa / PyME (persona moral o PFAE con facturación)

**¿Qué necesita comprobar?**
La comprobación se hace directamente a través del **Visor del SAT** usando la **Contraseña CIEC** de la empresa.

**¿Cómo funciona el Visor SAT / CIEC?**

La financiera o banco se conecta al portal del SAT con la contraseña CIEC (la clave fiscal de la empresa) y en minutos puede ver:
- Cuánto facturó la empresa cada mes (ingresos declarados)
- Quiénes son sus principales clientes y proveedores
- Si los ingresos son constantes o irregulares
- La relación entre ingresos y egresos (flujo fiscal sano)

Esto reemplaza el proceso de presentar estados de cuenta físicos y permite que la financiera evalúe en **48 a 72 horas** sin citas ni papelería extensa.

**La regla fiscal estricta:**
- Factura todo → la oferta de crédito es sólida
- Facturas parcialmente → el crédito será proporcional a lo demostrable
- Declaras en cero o con pérdidas → el crédito es prácticamente imposible

**Ejemplo de conversación — PyME:**

> Sí, es lo que te comentaba.
>
> Para empresas la comprobación es diferente — no se basa en estados de cuenta, sino en lo que facturas ante el SAT.
>
> La financiera se conecta al Visor SAT con tu contraseña CIEC y en minutos ve el historial de ingresos de tu empresa.
>
> Es necesario comprobar ingresos. Dime un poco de tu negocio, ¿qué giro tienes?

---

**Si la facturación es baja o irregular — respuesta del bot:**

> Entiendo, eso es algo que hay que trabajar antes de solicitar.
>
> Las financieras prestan sobre lo que le declaraste al SAT, no sobre lo que dices que ganas.
>
> Si tu facturación está inconsistente o muy baja, lo más sano es regularizarla primero con tu contador.
>
> ¿Tienes un contador que lleve tu empresa?

---

### FLUJO COMPLETO DE PRE-CALIFICACIÓN

El bot sigue este orden de preguntas para pre-calificar al lead:

```
1. ¿Qué necesitas? (hipoteca, crédito PYME, liquidez, etc.)
        ↓
2. ¿Estás al corriente en tus pagos / buró de crédito limpio?
        ↓ (Si sí)
3. ¿Cómo compruebas tus ingresos?
   → Nómina → ¿Tienes 1 año de antigüedad?
   → Independiente → ¿Tienes 2 años en el SAT y 6 estados de cuenta?
   → PyME → ¿Facturas regularmente? ¿Tienes tu CIEC?
        ↓ (Si los dos filtros están OK)
4. Dar información relevante del producto que necesita
        ↓
5. Invitar a la asesoría gratuita con Luis
```

---

### RESPUESTAS DE CIERRE SEGÚN RESULTADO DE PRE-CALIFICACIÓN

**Lead calificado (buró OK + ingresos comprobables):**

> Perfecto, con eso ya tienes lo principal para arrancar.
>
> El siguiente paso es que Luis revise tu perfil a detalle y te presente las opciones de los bancos que mejor se adapten a ti.
>
> La asesoría es completamente gratuita — el broker cobra al banco, no a ti.
>
> ¿Agendamos? Puedes hacerlo en credexpress.com

---

**Lead con obstáculo temporal (buró en proceso / falta antigüedad):**

> No estás listo hoy, pero sí puedes estarlo pronto.
>
> [Explicar qué debe resolver: regularizar buró, completar 2 años en SAT, etc.]
>
> Cuando lo tengas resuelto regresa y arrancamos sin problema.
>
> ¿Tienes alguna duda de cómo resolverlo?

---

**Lead no calificado (quita activa / sin ingresos comprobables):**

> Entiendo tu situación y te lo digo con respeto — hoy sería muy difícil que un banco te apruebe.
>
> Lo que te conviene es trabajar primero en [buró / facturación].
>
> No es un no para siempre, es un "todavía no" con un camino claro.
>
> Si quieres te explico cómo puedes prepararte, ¿te interesa?


---

## TASAS Y PLAZOS DE REFERENCIA — RESPUESTA RÁPIDA DEL BOT

> Esta sección es para que el bot responda preguntas sobre tasas y plazos de forma inmediata, sin consultar las secciones largas.
> Siempre aclarar: "el número exacto depende de tu perfil crediticio".

---

### PRODUCTO 1 — HIPOTECA (Adquisición de vivienda)

**¿Para quién?** Persona que quiere comprar casa o departamento.

| Banco | Producto | Tasa Inicial | Tasa Final | Plazo | Cobra seguros/comisión |
|---|---|---|---|---|---|
| Santander | Hipoteca Free | 11.35% | 10.35% (mes 37+) | Hasta 198 meses (~16.5 años) | No |
| Santander | Plan Platino (asalariados) | 9.80% | **8.85%** (con 3 requisitos) | Hasta 25 años (300 meses) | No |
| Banorte | Hipoteca Fuerte Cero | 11.15% | 11.15% (fija) | 20 años (240 meses) | No |
| Banorte | Hipoteca Fuerte Tradicional | Desde 9.15% (perfil premium) | Sin beneficio | 20 años | Sí |
| HSBC | Hipoteca Full Adquisición | 10.30% | 10.00% (puntualidad anual) | ~211 meses | Sí |
| Scotiabank | Pagos Oportunos (con vinculación) | 10.75% | 10.00% | ~215 meses | Solo avalúo |
| BBVA | Hipoteca Fija | 10.99% | 10.99% (sin beneficio) | 20 años | Sí |
| Citibanamex | Hipoteca Perfiles | 10.95% (perfil común) | 10.95% | 20 años | Sí |

**Aforo máximo:** hasta 95% (Santander asalariados) · 90% (mayoría de bancos) · 80% (terreno/liquidez)

**Enganche mínimo real a tener:** 10% del valor + 7% gastos de escrituración = ~17% del valor de la propiedad

**Rango de mensualidad orientativo** (crédito de $1,800,000 a 20 años):
- Mensualidad más baja: ~$18,946 (Banorte Cero)
- Mensualidad más alta: ~$20,383 (BBVA)

**Costo total orientativo** (mismo crédito):
- Más barato: Santander Free → **$3,923,964**
- Más caro: BBVA → **$4,812,000**
- Diferencia: hasta $888,000 entre el mejor y el peor banco

---

### PRODUCTO 2 — HIPOTECA PARA TERRENO

**¿Para quién?** Persona que quiere comprar un terreno (no construido).

| Concepto | Detalle |
|---|---|
| Banco de referencia | Banorte |
| Tasa | 10.68% |
| CAT | 12.7% |
| Plazo máximo | **15 años** (más corto que vivienda terminada) |
| Aforo máximo | **70%** (banco presta menos porque el riesgo es mayor) |
| Enganche mínimo | 30% del valor del terreno |
| Seguro de daños | No aplica (no hay construcción) |

**Condición indispensable del terreno:** servicios básicos comprobables (agua o factibilidad) + boleta predial + dentro de fraccionamiento formal.

---

### PRODUCTO 3 — LIQUIDEZ CON GARANTÍA HIPOTECARIA

**¿Para quién?** Dueño de casa libre de gravamen que necesita capital para negocio, inversión o consolidar deudas.

| Banco | Tasa Mínima | CAT | Plazo | Mensualidad ref. ($2M) | Total ref. |
|---|---|---|---|---|---|
| Santander | **11.50%** | 13.9% | Hasta 15 años | $28,734 | $4,906,000 |
| Banorte | 13.99% | 17.1% | Hasta 15 años | $32,792 | $5,590,000 |
| Scotiabank | 15.50% (→14.75% con beneficio) | 18.3% | Hasta 15 años | $35,097 | $5,485,000 |

**Aforo:** banco presta entre 50% y 70% del valor del inmueble.
**Restricción:** solo vivienda habitacional. No terrenos, locales, bodegas ni uso mixto.

---

### PRODUCTO 4 — CRÉDITO PYME / EMPRESARIAL

#### 4A — Sin garantía hipotecaria (rápido, hasta $5M)

| Tipo | Tasa | Plazo | Monto | Requisito principal | Aliados |
|---|---|---|---|---|---|
| Crédito simple (facturación SAT) | 25%–35% anual | 12–36 meses | $500K–$5M | Facturación constante ante SAT | Confío, Finsus, Crece, Banorte |
| Anticipo sobre TPV | 2%–2.5% mensual | Hasta 12 meses | $200K–$10M | Historial de ventas con terminal | iCash, Anticipa |

**Desembolso:** 48–72 horas · Sin garantía hipotecaria · Evaluación por Visor SAT o historial TPV.

#### 4B — Con garantía hipotecaria (tasa baja, largo plazo)

| Concepto | Detalle |
|---|---|
| Tasa anual | 15%–25% |
| Plazo | Hasta 10–15 años |
| Monto | >$5,000,000 MXN |
| Facturación mínima requerida | $5M/mes ($60M anuales) |
| Aliados | Banorte, Afirme, Crece, Capitalizer, Finsus, Max Capital |

#### 4C — Crédito revolvente / Factoraje

| Producto | Para quién | Tasa mensual | Monto |
|---|---|---|---|
| Clara (TDC empresarial) | Agencias, startups, gastos digitales | 2%–3% (0% si paga al corte) | $50K–$5M |
| Fin Cargo | Importadores (Asia, EE.UU., Europa) | 1.5%–2.5% | Hasta $1.5M USD |
| Zepelin (factoraje silencioso) | Empresas que venden a Walmart, Liverpool, etc. | 1.5%–3% | Según facturación |

#### 4D — Arrendamiento puro (Leasing)

| Giro | Aliado |
|---|---|
| Transporte / tráilers | Tip México |
| Autos y flotillas | Bitcar, Tip Auto |
| Equipo médico / tecnología / paneles solares | Engin |
| Maquinaria industrial | Solufi, Unifin, Renda Más |
| Construcción / equipo pesado | Acción Financiera |

**Ventaja fiscal:** renta 100% deducible como gasto operativo ante el SAT.

---

### RESPUESTA RÁPIDA DEL BOT — según tipo de lead

Cuando el lead pregunta "¿qué tasas manejan?" o "¿en qué plazos?" usar esta guía:

**Si el lead busca hipoteca:**
> "Las tasas van del 8.85% al 11.35% dependiendo del banco y tu perfil.
>
> Los plazos van de 15 a 25 años — entre más corto el plazo, menos pagas en total.
>
> El número exacto lo define tu historial crediticio y tu comprobación de ingresos."

**Si el lead busca liquidez sobre su propiedad:**
> "Para liquidez con garantía hipotecaria las tasas van del 11.5% al 15.5% según el banco.
>
> El plazo puede ser hasta 15 años, lo que hace que la mensualidad sea muy manejable.
>
> Es el crédito más barato del mercado si tienes una propiedad libre."

**Si el lead busca crédito para su negocio (sin garantía):**
> "Para crédito empresarial sin dejar una propiedad en garantía las tasas van del 25% al 35% anual.
>
> Son créditos rápidos — el dinero puede estar en tu cuenta en 48 a 72 horas.
>
> El monto depende de lo que facturas ante el SAT o de tus ventas con terminal."

**Si el lead tiene TPV:**
> "Con historial de terminal el financiamiento es del 2% al 2.5% mensual.
>
> Puedes recibir hasta 2 veces tus ventas mensuales promedio.
>
> El pago se hace automático — se retiene un porcentaje de cada venta."

**Si el lead busca crédito PyME con garantía hipotecaria (monto alto):**
> "Si tienes una propiedad en garantía las tasas bajan bastante — entre 15% y 25% anual.
>
> Los plazos pueden ser de hasta 15 años, lo que reduce mucho la mensualidad.
>
> Necesitamos que la empresa facture mínimo $5 millones al mes para este esquema."

---

---

## ÍNDICE DE CONOCIMIENTO

1. [Perfil del Asesor](#1-perfil-del-asesor)
2. [Conceptos Fundamentales de una Hipoteca](#2-conceptos-fundamentales-de-una-hipoteca)
3. [¿Cómo pedir una hipoteca? — Proceso Paso a Paso](#3-cómo-pedir-una-hipoteca--proceso-paso-a-paso)
4. [Evaluación Bancaria: Los 3 Pilares](#4-evaluación-bancaria-los-3-pilares)
5. [Comparativa de Bancos 2026](#5-comparativa-de-bancos-2026)
6. [Banorte: Hipoteca Fuerte Tradicional vs. Cero](#6-banorte-hipoteca-fuerte-tradicional-vs-cero)
7. [Santander: Hipoteca Free y Tasa 8.85%](#7-santander-hipoteca-free-y-tasa-885)
8. [Aportaciones a Capital — ¿Plazo o Mensualidad?](#8-aportaciones-a-capital--plazo-o-mensualidad)
9. [Apoyo Infonavit](#9-apoyo-infonavit)
10. [Cofinavit (Crédito Combinado INFONAVIT + Banco)](#10-cofinavit-crédito-combinado-infonavit--banco)
11. [FOVISSSTE (Para Trabajadores del Gobierno)](#11-fovissste-para-trabajadores-del-gobierno)
12. [Portabilidad de Hipoteca — Cambio de Banco](#12-portabilidad-de-hipoteca--cambio-de-banco)
13. [Crédito de Liquidez con Garantía Hipotecaria](#13-crédito-de-liquidez-con-garantía-hipotecaria)
14. [Cancelación de Hipoteca](#14-cancelación-de-hipoteca)
15. [Seguros de la Hipoteca](#15-seguros-de-la-hipoteca)
16. [Hipoteca para Terreno](#16-hipoteca-para-terreno)
17. [Hipoteca de Economía Americana (Mexicanos en USA/Canadá)](#17-hipoteca-de-economía-americana-mexicanos-en-usacanadá)
18. [Crédito PYME y Empresarial 2026](#18-crédito-pyme-y-empresarial-2026)
19. [Financiamiento Ágil para Negocios en 48-72 Horas](#19-financiamiento-ágil-para-negocios-en-48-72-horas)
20. [Mejora de Score Crediticio](#20-mejora-de-score-crediticio)
21. [Preguntas Frecuentes — Q&A Completo](#21-preguntas-frecuentes--qa-completo)
22. [Glosario de Términos Hipotecarios](#22-glosario-de-términos-hipotecarios)

---

## 1. PERFIL DEL ASESOR

### ¿Quién es Luis Valadés?

**Luis Valadés** es un **Broker Hipotecario Certificado** con más de **10 años de experiencia** y más de **700 operaciones firmadas** en México. Opera bajo la figura de **Master Broker a través de Creditaria**, una plataforma con convenios directos con los principales bancos del país.

Su misión es ser el **puente imparcial** entre el cliente y las instituciones bancarias, analizando múltiples opciones para encontrar la hipoteca con las mejores condiciones según el perfil de cada persona.

### ¿Cómo verificar su certificación?

1. Entra al sitio web de la **AMH** (Asociación Mexicana de Brokers Hipotecarios).
2. Busca el botón **"Consulta si tu asesor está certificado"**.
3. Ingresa la matrícula y RFC de Luis.
4. Vigencia de certificación: **hasta el 15 de junio de 2027**.

### ¿Cuánto cuesta la asesoría?

**La asesoría es 100% gratuita para el cliente.** El broker recibe sus honorarios directamente del banco al momento de la firma de escrituras. Nunca del cliente.

> ⚠️ **Advertencia**: Existen malas prácticas en el sector. Ningún broker certificado y honesto debe cobrarle al cliente por la gestión del crédito hipotecario.

### ¿Qué hace un broker diferente a un ejecutivo de banco?

| Ejecutivo de Banco | Broker Hipotecario |
|---|---|
| Solo ofrece productos de su propio banco | Compara más de 10 instituciones |
| Interés en vender su producto | Interés en el mejor resultado para el cliente |
| No cobra al cliente (pero está limitado) | No cobra al cliente (y tiene más opciones) |
| Un solo análisis de crédito | Análisis personalizado multi-banco |

### Contacto y Agenda

- Sitio web: **credexpress.com**
- Asesoría gratuita disponible en el enlace de la descripción del canal

---

## 2. CONCEPTOS FUNDAMENTALES DE UNA HIPOTECA

### ¿Qué es una hipoteca?

Una hipoteca es un **préstamo a largo plazo** que otorga una institución bancaria para que puedas comprar una propiedad inmueble. La propiedad misma sirve como **garantía** del crédito. Si el acreditado deja de pagar, el banco tiene derecho legal de recuperar la propiedad.

### Componentes de una mensualidad hipotecaria

Una mensualidad hipotecaria está compuesta por los siguientes elementos:

| Componente | Descripción |
|---|---|
| **Capital** | Porción que reduce tu deuda real |
| **Intereses** | Costo del dinero prestado (calculado sobre saldo insoluto) |
| **Seguro de Vida** | Obligatorio; cubre saldo en caso de fallecimiento o ITP |
| **Seguro de Daños** | Obligatorio; cubre la propiedad ante siniestros |
| **Comisión por Administración** | Cargo mensual por la gestión del crédito (varía por banco) |

### La Pirámide Inversa de los Intereses

Los intereses se comportan como una **pirámide inversa** a lo largo del crédito:

- **Al inicio (meses 1–36)**: ~90% de tu pago va a intereses y solo ~10% a capital.
- **A la mitad del crédito**: La proporción va equilibrándose gradualmente.
- **Al final del crédito**: La mayor parte va a capital y una pequeña porción a intereses.

**Conclusión clave**: Cada peso extra que aportes a capital en los primeros años del crédito tiene un impacto exponencialmente mayor en el ahorro de intereses que el mismo peso aportado al final.

### Indicadores clave que debes revisar

| Indicador | ¿Qué mide? | ¿Para qué sirve? |
|---|---|---|
| **Tasa de Interés Nominal** | El costo del préstamo sin costos adicionales | Punto de comparación inicial |
| **CAT (Costo Anual Total)** | Tasa + seguros + comisiones + todos los accesorios | Comparativa real entre bancos |
| **Costo Total del Crédito** | Suma total de todo lo que pagas al banco en el plazo | El indicador más honesto |
| **Mensualidad** | Pago mensual | Evalúa la comodidad de flujo de efectivo |
| **Plazo** | Número de meses del crédito | A menor plazo, menor costo total |
| **Aforo** | % del valor de la propiedad que financia el banco | Determina el enganche necesario |

### El Error Número Uno al Buscar Hipoteca

Obsesionarse **únicamente con la tasa de interés más baja**. La tasa más baja no siempre significa la hipoteca más barata.

**Ejemplo:** Un banco con tasa del 10% que cobra seguros, comisión por apertura y comisión de administración puede costarte **más en total** que un banco con tasa del 11.35% que no cobra ninguno de esos accesorios.

**Regla de oro**: Siempre compara el **Costo Total del Crédito** y el **CAT**, no solo la tasa nominal.

### Gastos Iniciales al Comprar con Hipoteca

Además del enganche, debes presupuestar:

| Gasto | Porcentaje Estimado | Notas |
|---|---|---|
| **Enganche** | Mín. 10% del valor de la propiedad | Algunos bancos financian hasta 90–95% |
| **Gastos de Escrituración** | ~7% del valor de la propiedad | Incluye ISAI, honorarios notariales, derechos |
| **Avalúo Comercial** | $3,000–$8,000 MXN aprox. | Puede ser cubierto por el banco en algunas ofertas |
| **Comisión por Apertura** | 0%–1% del monto del crédito | Algunos bancos la exentan |

> 💡 **Consejo**: Para una propiedad de $2,000,000 MXN con enganche del 10% ($200,000), debes tener disponibles aproximadamente **$340,000 MXN** en total (enganche + gastos de escrituración).

---

## 3. ¿CÓMO PEDIR UNA HIPOTECA? — PROCESO PASO A PASO

El proceso se divide en **dos grandes fases**:

### FASE 1: Análisis y Autorización del Crédito (3–5 días hábiles)

#### Paso 1: Reúne tu documentación

**Para asalariados (empleados con nómina):**
- INE vigente
- Acta de nacimiento y CURP
- Constancia de Situación Fiscal (SAT, actualizada)
- Comprobante de domicilio (máx. 3 meses de antigüedad)
- Últimos 3 recibos de nómina **timbrados fiscalmente**
- Estados de cuenta donde recibes tu nómina (últimos 3 meses)
- Mínimo **1 año de antigüedad** en el empleo actual

**Para independientes / dueños de negocio (PFAE):**
- INE vigente
- Acta de nacimiento y CURP
- Constancia de Situación Fiscal con **mínimo 2 años de antigüedad** en la actividad
- Comprobante de domicilio (máx. 3 meses)
- Últimos **6 estados de cuenta bancarios** completos
- Los depósitos deben coincidir con la actividad declarada ante el SAT

> ⚠️ **Casos de rechazo inmediato para independientes:**
> - Menos de 2 años de alta en actividad fiscal
> - Estar suspendido ante el SAT
> - Depósitos con conceptos como "tanda", "préstamo", "regalo" o "viáticos"
> - Actividad declarada diferente a los depósitos recibidos

#### Paso 2: Pre-calificación

El broker realiza un análisis rápido de tu perfil (ingresos vs. deudas vs. score crediticio) para determinar qué bancos son viables y el monto máximo al que puedes aspirar.

#### Paso 3: Ingreso del expediente al banco

Con todos los documentos completos, el broker ingresa tu expediente al área de riesgos del banco. La respuesta llega en **48 a 72 horas**.

#### Paso 4: Carta de Autorización de Crédito

Si el banco aprueba tu solicitud, emite una **Carta de Autorización** que incluye:
- Monto aprobado
- Tasa de interés asignada
- Plazo y esquema de pagos
- Porcentaje de aforo autorizado

> ✅ Esta carta es tu garantía. Consérvala y revísala con tu broker antes de cualquier compromiso con el vendedor.

---

### FASE 2: Formalización y Firma (2–8 semanas)

#### Paso 5: Avalúo Comercial de la Propiedad

- Un valuador certificado visita la propiedad, toma fotografías y realiza un estudio de mercado comparativo.
- El avalúo debe estar certificado ante la **Sociedad Hipotecaria Federal (SHF)**.
- Tiempo estimado: **5 a 7 días hábiles** desde que se solicita.
- **Lo paga el comprador** (aprox. $3,500–$8,000 MXN).

#### Paso 6: Revisión Jurídica de la Propiedad

El banco y la notaría asignada revisarán:
- Escrituras de la propiedad (sin propiedades ejidales)
- Boleta del Registro Público de la Propiedad
- Boletas de agua y predial (sin adeudos)
- Certificado de Libertad de Gravamen
- Identificación del vendedor y datos bancarios para pago

#### Paso 7: Firma de Escrituras

- El banco asignará una **notaría de su lista de convenios**.
- El broker revisa todos los documentos antes de que el cliente se presente.
- El día de la firma, el comprador debe haber pagado los gastos notariales.
- El banco dispersa el dinero al vendedor generalmente **el mismo día o en 24 horas**.

### Resumen de Tiempos

| Fase | Actividad | Tiempo Estimado |
|---|---|---|
| **Fase 1** | Análisis, documentos, autorización | 3–5 días hábiles |
| **Fase 2** | Avalúo, revisión jurídica, notaría, firma | 2–8 semanas |
| **Total** | Operación completa | 1–2 meses en promedio |

---

## 4. EVALUACIÓN BANCARIA: LOS 3 PILARES

Los bancos analizan tres factores para autorizar o rechazar una hipoteca:

### Pilar 1: Comprobación de Ingresos

- El flujo debe ser **trazable** (bancarizado).
- Para asalariados: recibos de nómina timbrados + estados de cuenta que reflejen los depósitos.
- Para independientes: estados de cuenta donde los depósitos coincidan con la actividad fiscal del SAT.
- **Nómina mixta (riesgo)**: Si tu empresa paga parte de tu sueldo "por fuera" sin timbrar, ese ingreso no existe para el banco.

### Pilar 2: Historial Crediticio (Buró de Crédito)

El banco busca un perfil **verde o sano**: todos los pagos al corriente.

| Situación | Impacto en la solicitud |
|---|---|
| Pagos siempre al corriente | ✅ Perfil viable |
| Atraso menor puntual y aislado | ⚠️ Podría afectar la tasa |
| Quitas (negociación de deuda) | ❌ Rechazo inmediato en casi todos los bancos |
| Cuentas sin pagar activas | ❌ Rechazo inmediato |
| Muchas consultas recientes de buró | ⚠️ Señal de alarma para el banco |

### Pilar 3: Capacidad de Endeudamiento (Regla del 50%)

Los bancos establecen que **máximo el 50% de tus ingresos comprobables** puede destinarse al pago de deudas totales (hipoteca + otras deudas activas).

**Ejemplo práctico:**
- Ingreso mensual comprobable: $50,000
- Capacidad máxima de endeudamiento: $25,000 (50%)
- Tienes deudas activas (auto + tarjeta): $5,000/mes
- Capacidad real para mensualidad hipotecaria: **$20,000**

**Estimación de crédito (regla de tres):**
Por cada $1,000,000 de crédito hipotecario → pago mensual aproximado de $11,000 MXN.

- Con $25,000 de capacidad: crédito de aprox. **$2,272,727 MXN**
- Con $20,000 de capacidad (con deudas): crédito de aprox. **$1,818,182 MXN**

### Perfil Crediticio y Tasa Asignada

| Perfil | Score Crediticio | Líneas de Crédito | Tasa Aprox. 2026 |
|---|---|---|---|
| **Alto** | 750+ | >$150,000 MXN en TDC | 8.5%–9.5% |
| **Medio** | 685–749 | $50,000–$150,000 MXN | 10.0%–11.0% |
| **Estándar** | 620–684 | <$50,000 MXN | 11.0%–12.5% |

---

## 5. COMPARATIVA DE BANCOS 2026

> **Supuestos del ejercicio:** Vivienda particular (libre) · Valor $2,000,000 MXN · Crédito $1,800,000 MXN (90%) · Plazo 240 meses (20 años) · Perfil crediticio promedio-bueno

| Banco | Producto | Tasa Inicial | Tasa Final | Mensualidad | Plazo Final | Costo Total | Cobra Seguros/Comisión |
|---|---|---|---|---|---|---|---|
| **Santander** | Hipoteca Free | 11.35% | 10.35% (mes 37+) | $19,818 | **198 meses** | **$3,923,964** | ❌ No cobra |
| **Scotiabank** | Pagos Oportunos (c/vinculación) | 10.75% | 10.00% | $20,124 | 215 meses | $4,239,000 | Paga avalúo |
| **HSBC** | Hipoteca Full Adquisición | 10.30% | 10.00% | $19,651 | 211 meses | $4,547,361 | ✅ Sí cobra |
| **Banorte** | Hipoteca Fuerte Cero | 11.15% | 11.15% | $18,946 | 240 meses | $4,548,240 | ❌ No cobra |
| **Citibanamex** | Hipoteca Perfiles | 10.95% | 10.95% | $19,915 | 240 meses | $4,696,000 | ✅ Sí cobra |
| **BBVA** | Hipoteca Fija | 10.99% | 10.99% | $20,383 | 240 meses | $4,812,000 | ✅ Sí cobra |

### Clasificación por objetivo

**Si priorizas el menor costo total (hipoteca más inteligente):**
1. 🥇 Santander (Hipoteca Free) — ahorro vs BBVA: **$888,036 MXN**
2. 🥈 Scotiabank (con vinculación de nómina)
3. 🥉 HSBC (Hipoteca Full)

**Si priorizas la mensualidad más baja (flujo mensual):**
1. 🥇 Banorte (Hipoteca Fuerte Cero) — $18,946/mes

**Si priorizas liquidez futura adicional:**
1. 🥇 HSBC — permite crédito de liquidez adicional de hasta $1M usando la misma garantía

### Notas importantes por banco

**Banorte**: La tasa "Premium" (desde 9.15%) es para perfiles muy selectos (~20% de solicitantes). El 80% califica en tasa baja, media o alta.

**Santander**: La reducción de tasa por puntualidad aplica a partir del mes 37 si pagas puntualmente cada mes. Sin un solo atraso.

**Scotiabank**: Sin vinculación (portabilidad de nómina o TDC activa), la tasa sube a 13%. La vinculación es obligatoria para acceder a la oferta competitiva.

**HSBC**: Ofrece tasa de 9.65% para créditos con aforo menor al 70%. Para aforos mayores al 70%, la tasa inicial es 10.30%.

**Citibanamex**: La tasa de 9.25% es casi exclusiva para perfiles con portafolios de inversión >$2M en el banco. Para el perfil promedio, la tasa es 10.95%.

**BBVA**: No ofrece beneficio por pago puntual. El crédito permanece a 240 meses sin reducción de plazo ni tasa.

### Ofertas Especiales para Desarrolladores

Algunos bancos tienen convenios con constructoras en ciudades como Monterrey, Guadalajara y CDMX. Si tu propiedad está en un desarrollo con convenio, puedes acceder a tasas desde **9.5% o incluso menores al 10%**. Pregunta siempre a tu desarrollador o a tu broker sobre esta posibilidad.

---

## 6. BANORTE: HIPOTECA FUERTE TRADICIONAL VS. CERO

> **Ejercicio base:** Valor propiedad $2,000,000 · Crédito $1,600,000 · Plazo 240 meses · Tasa asignada "baja" (10.15% para la Tradicional)

### Comparativa de Productos

| Concepto | Hipoteca Fuerte Tradicional (10.15%) | Hipoteca Fuerte Cero (11.15%) |
|---|---|---|
| Tasa de Interés | 10.15% | 11.15% |
| CAT Promedio | 12.5% | 11.9% |
| Mensualidad | $17,393 | **$16,841** |
| Costo Total (20 años) | $4,188,000 | **$4,043,326** |
| Comisión por Apertura | 1% del crédito ($16,000) | $0 |
| Costo de Avalúo Bancario | ~$5,800 | $0 |
| Seguro de Vida/Daños | Se cobra aparte | Absorbido/incluido |
| Comisión por Administración | Se cobra aparte | Absorbida |

### Conclusión Banorte

A pesar de que la **Hipoteca Fuerte Cero** tiene una tasa nominal más alta (11.15% vs 10.15%), resulta **más barata en total** porque elimina todos los costos accesorios. La mensualidad es $552 más baja y el costo total es **$144,674 menor** en 20 años.

### Escenario pesimista (tasa alta asignada en la Tradicional)

Si Banorte asigna tasa alta (11.15%) en la Hipoteca Tradicional:
- Mensualidad: **$18,491**
- CAT: **13.6%**
- Costo Total: **$4,354,000**
- Diferencia vs Hipoteca Cero: **+$310,674 de sobrecosto**

### ¿A quién aprueba Banorte la Hipoteca Cero?

La asignación depende de un algoritmo que considera: edad, dependientes económicos, ubicación, historial crediticio, líneas de crédito activas y nivel de ingresos. Solo aproximadamente el **20% de los solicitantes** accede a la tasa "Premium" o "Mínima".

### Requisitos de Banorte

- Asalariados: mínimo **6 meses de antigüedad** en el empleo + nómina timbrada + estados de cuenta
- Independientes: mínimo **2 años** de antigüedad en actividad fiscal + 6 estados de cuenta completos
- Buró de crédito limpio y al corriente
- Respuesta: **48–72 horas** tras ingresar expediente completo

### Cofinavit con Banorte (Ejemplo Real)

| Concepto | Monto |
|---|---|
| Valor de la vivienda | $2,000,000 |
| Crédito Banorte (Hipoteca Cero) | $966,000 |
| Crédito Infonavit | $801,000 |
| Subcuenta de Vivienda (enganche) | $233,000 |
| **Total** | **$2,000,000** |
| Mensualidad Banorte | $10,157 |
| Retención Infonavit | $7,481 |
| **Pago Total Mensual** | **$17,638** |

El cliente solo desembolsa los gastos de escrituración (~$140,000 MXN).

---

## 7. SANTANDER: HIPOTECA FREE Y TASA 8.85%

### Hipoteca Free (Cero Accesorios + Premio por Puntualidad)

Este es el producto estrella de Santander. Sus ventajas:
- **Sin cobro** de seguro de vida ni seguro de daños
- **Sin comisión** por apertura ni por administración
- **Premio por puntualidad**: A partir del mes 37, la tasa se reduce progresivamente hasta la tasa piso

| Indicador | Valor |
|---|---|
| Tasa Inicial | 11.35% |
| Tasa Piso (con puntualidad) | 10.35% (a partir del mes 37) |
| Plazo Final (con puntualidad) | 198 meses (16.5 años) en lugar de 240 |
| Costo Total ($1,800,000 a 20 años) | $3,923,964 |
| Seguros | ❌ No cobra |
| Comisión por apertura/avalúo | ❌ No cobra |

> ⚠️ **Condición crítica**: Si tienes aunque sea **un solo pago atrasado**, pierdes el beneficio por puntualidad para ese periodo. La disciplina de pago es fundamental.

### Hipoteca Santander para Asalariados — Tasa 8.85%

Este producto específico está diseñado para empleados con ingreso de nómina:

| Parámetro | Detalle |
|---|---|
| Aforo máximo | **95%** (solo 5% de enganche) |
| Plazo máximo | **25 años** (300 meses) |
| Tasa estándar | 9.8% |
| Tasa especial "Platino" | **8.85%** |

#### Condiciones para la Tasa Especial 8.85% (Plan Platino)

Debes cumplir los **3 requisitos simultáneamente**:

1. **Portabilidad de nómina**: Tu nómina se deposita en cuenta Santander ≥ $30,000 MXN/mes
2. **Consumo con TDC Santander**: Mínimo $20,000 MXN/mes en tarjetas Santander
3. **Seguro adicional**: Contratar póliza (auto, vida) con Santander ≥ $10,000 MXN

> ⚠️ Si en alguna revisión anual dejas de cumplir uno de los tres requisitos, la tasa sube automáticamente al 9.8%.

#### Simulación de Ahorro: Tasa Estándar vs. Platino

> Condiciones: Crédito $1,800,000 MXN · Plazo 25 años · Valor vivienda $2,200,000

| Indicador | Tasa Estándar (9.8%) | Tasa Platino (8.85%) | Ahorro |
|---|---|---|---|
| CAT | 11.8% | 10.7% | 1.1 pp |
| Mensualidad | $18,071 | $16,867 | $1,204/mes |
| Total a Pagar | $4,293,317 | $4,000,980 | **$292,337** |

---

## 8. APORTACIONES A CAPITAL — ¿PLAZO O MENSUALIDAD?

Cuando realizas un **pago extra a capital** en tu hipoteca, puedes elegir entre dos esquemas:

### Esquema 1: Reducir el Plazo ⭐ (El más recomendado para ahorro)

- Tu mensualidad **se mantiene igual**
- El capital extra se destina 100% a reducir el saldo de la deuda
- El plazo del crédito **se acorta**
- **Maximiza el ahorro en intereses**

### Esquema 2: Reducir la Mensualidad

- Tu mensualidad **baja**
- El plazo **se mantiene igual** al original
- Proporciona **holgura financiera** y libera flujo de efectivo mensual
- Ahorro en intereses, pero **menor** que en el esquema de reducción de plazo

### Comparativa de Impacto Real (Ejemplo Scotiabank · Aportación de $100,000)

| Momento de la Aportación | Esquema Plazo (Ahorro en Intereses) | Esquema Mensualidad (Ahorro en Intereses) |
|---|---|---|
| Año 1 (Mes 12) | **$802,000** (reduce ~2 años de plazo) | $201,000 |
| Año 5 (Mes 60) | **$584,000** | $158,000 |
| Año 10 (Mes 120) | **$304,000** | $106,000 |

**Conclusión**: Entre más temprano hagas la aportación y más agresivo sea el esquema (plazo), mayor será el ahorro. El tiempo es el factor más determinante.

### ¿Cómo realizar las aportaciones?

- **Banca en línea o app móvil**: La mayoría de los bancos lo permiten digitalmente. Es la forma más sencilla.
- **Ventanilla (presencial)**: Algunas instituciones aún lo requieren así.

> ⚠️ **Advertencia crítica en ventanilla**: Si pagas un excedente junto con tu mensualidad regular, debes indicar **explícitamente y por escrito** que el monto extra se aplique a capital. De lo contrario, el banco lo puede registrar como un "pago adelantado" de la siguiente mensualidad, sin reducir tu deuda.

### Restricciones importantes

Antes de realizar aportaciones, **revisa tu contrato**: algunos bancos limitan las aportaciones solo a un esquema (plazo o mensualidad). Esto se establece en el contrato inicial. Verifica con tu banco cuál es el esquema permitido.

### Variables que determinan el impacto de una aportación

1. **Tiempo**: Cuanto más temprano, mayor el ahorro
2. **Monto**: A mayor aportación, mayor impacto
3. **Esquema**: Plazo > Mensualidad en términos de ahorro total

---

## 9. APOYO INFONAVIT

### ¿Qué es el Apoyo Infonavit?

Es un esquema que permite usar los recursos de tu **Subcuenta de Vivienda del Infonavit** para dos propósitos, sin que Infonavit sea tu acreedor:

1. **Acelerar el pago de tu hipoteca bancaria**: Las aportaciones patronales del **5% de tu SDI** (Salario Diario Integrado) se aplican directamente al capital de tu crédito con el banco, reduciendo el plazo dramáticamente.

2. **Respaldo ante desempleo (Seguro)**: El saldo acumulado en tu subcuenta queda "congelado" como garantía. Si pierdes el empleo, el banco usa ese dinero para cubrir mensualidades vencidas.

> ⚠️ **Importante**: El saldo de la subcuenta NO se usa como enganche ni puedes disponer de él libremente.

### Comparativa: Crédito Tradicional vs. Apoyo Infonavit

> Ejemplo: Crédito de $1,000,000 · Tasa 10.75% · Aportación patronal ~$3,000 bimestrales · Plazo inicial 20 años

| Característica | Crédito Tradicional | Con Apoyo Infonavit |
|---|---|---|
| Monto del crédito | $1,000,000 | $1,000,000 |
| Mensualidad | $11,180 | $11,180 |
| Plazo real | 17 años 11 meses | **12 años 6 meses** |
| Meses ahorrados | — | **65 mensualidades** |
| Total a pagar | $2,356,000 | $1,642,000 |
| **Ahorro total** | — | **$714,000** |

### Requisitos para tramitar el Apoyo Infonavit

1. Estar **cotizando al IMSS** con relación laboral formal y vigente
2. Tener **saldo en la Subcuenta de Vivienda** (aunque sea mínimo)
3. **No** requiere los 1,080 puntos de Infonavit — solo relación laboral activa y saldo
4. Descargar el **Certificado de Apoyo Infonavit** desde el portal **Mi Cuenta Infonavit**
5. Aprobar el análisis del banco para el crédito hipotecario

### ¿Ya tienes hipoteca activa y no tienes Apoyo Infonavit?

¡Puedes solicitarlo ahora! Pide a tu banco la incorporación del esquema. Deberás:
- Firmar el **Anexo 43 bis** y documentos adicionales
- Las aportaciones comenzarán a reflejarse en tu hipoteca en aprox. **3 bimestres (6 meses)**

### Bancos compatibles con Apoyo Infonavit

La mayoría de las instituciones bancarias del sistema financiero mexicano son compatibles: BBVA, Santander, Banorte, HSBC, Scotiabank, Citibanamex, entre otros.

---

## 10. COFINAVIT (CRÉDITO COMBINADO INFONAVIT + BANCO)

### ¿Qué es Cofinavit?

Es un crédito donde el **banco y el Infonavit financian conjuntamente** la compra de tu vivienda. El derechohabiente usa:
- **Crédito Infonavit**: Para una parte del valor de la vivienda
- **Crédito Bancario**: Para el resto
- **Saldo de Subcuenta de Vivienda**: Como enganche total o parcial

### Beneficios del Cofinavit

- Permite acceder a propiedades de mayor valor
- El saldo de subcuenta elimina o reduce significativamente el enganche en efectivo
- En algunos casos, el cliente solo paga los gastos de escrituración
- Ambos créditos se pagan simultáneamente (el Infonavit retiene de nómina, el banco por cuenta bancaria)

### Requisitos básicos

- Ser derechohabiente activo del Infonavit con puntos suficientes
- Contar con saldo en la Subcuenta de Vivienda
- Aprobar el análisis de crédito del banco
- Solicitar la **Precalificación de Infonavit** para conocer el monto disponible

### Limitante: Tope de valor de vivienda

El Infonavit tiene un tope máximo de vivienda que varía según el salario del trabajador. Para viviendas de alto valor, el crédito Infonavit puede ser pequeño en proporción.

---

## 11. FOVISSSTE (PARA TRABAJADORES DEL GOBIERNO)

### ¿Qué es el FOVISSSTE?

Es el fondo de vivienda para trabajadores al servicio del **Estado (gobierno federal, estatal o municipal)**. Funciona de forma similar al Infonavit pero con diferencias importantes:

| Característica | FOVISSSTE | Infonavit |
|---|---|---|
| Para quién es | Trabajadores del gobierno | Trabajadores del sector privado (IMSS) |
| Aportación patronal | 5% del SDI (gobierno) | 5% del SDI (empresa privada) |
| Producto combinado con banco | Crédito Alia2 Plus / Respalda2 | Cofinavit / Apoyo Infonavit |
| Asignación de crédito | Por puntaje acumulado (sorteo o demanda directa) | Por puntos (más flexible) |

### Crédito Alia2 Plus

Producto conjunto FOVISSSTE + banco. Similar al Cofinavit: el trabajador suma el crédito del fondo con financiamiento bancario.

> 💡 Si eres trabajador del gobierno y no sabes cómo aprovechar tu FOVISSSTE para comprar casa, agenda una asesoría. Tenemos experiencia con este esquema.

---

## 12. PORTABILIDAD DE HIPOTECA — CAMBIO DE BANCO

### ¿Qué es la Portabilidad o Mejora de Hipoteca?

Es el proceso de **trasladar tu hipoteca a un banco diferente** que te ofrece mejores condiciones (tasa más baja, menor costo total, diferente plazo). Tu propiedad se mantiene como garantía, solo cambia el acreedor.

### ¿Cuándo conviene hacer una portabilidad?

- Cuando encontraste una tasa significativamente menor a la que tienes
- Cuando tu historial crediticio ha mejorado y puedes calificar para mejores condiciones
- Cuando quieres cambiar el plazo de tu crédito
- Cuando el ahorro neto (después de gastos de cambio) supera los $100,000 MXN

### Beneficios del cambio de banco

1. **Reducir el plazo**: Mantienes tu mensualidad actual pero reduces los años de deuda
2. **Reducir la mensualidad**: Mantienes el plazo pero pagas menos cada mes con la nueva tasa

### Gastos del proceso de portabilidad

- **NO hay traslado de dominio** (no pagas ISAI porque no cambia el propietario)
- **Gastos notariales e impuestos**: $50,000–$80,000 MXN (proporcional al monto del nuevo crédito)
- En muchas ofertas especiales, el **banco nuevo cubre avalúo, comisión por apertura y honorarios notariales**; el cliente solo paga derechos e impuestos (~$40,000 MXN), que en algunos casos pueden incorporarse al nuevo financiamiento

### Requisitos para una portabilidad exitosa

1. **Historial crediticio impecable**: Al corriente en todos los pagos
2. **Comprobación de ingresos**: La mayoría de los bancos la requiere
3. **Antigüedad mínima en la hipoteca actual**: Al menos **6 meses** pagados al banco de origen
4. **Escrituras inscritas** en el Registro Público de la Propiedad

### Caso Real: Scotiabank → Citibanamex (2026)

| Característica | Scotiabank (Original) | Citibanamex (Nueva) |
|---|---|---|
| Tasa | 10.75% | 8.95% |
| CAT | 14.6% | 10.6% |
| Saldo a portar | $3,409,170 | — |
| Mensualidad | $38,868 | $46,345 (a 10 años) |
| Total a pagar restante | $7,734,000 (est.) | $5,472,000 |
| **Ahorro total** | — | **$2,262,000** |

El cliente aumentó su mensualidad ~$7,000/mes pero liquidará su hipoteca **10 años antes** ahorrando $2.26 millones en intereses.

### Proceso detallado (100% digital y remoto)

**Etapa 1: Análisis y autorización (2–5 días hábiles)**
- Recopilación de documentos
- Análisis del banco receptor
- Emisión de Carta de Autorización

**Etapa 2: Formalización (2–4 semanas)**
- Avalúo de la propiedad
- Asignación de notaría
- Certificados de no adeudo
- Firma del nuevo crédito (la notaría cancela la hipoteca anterior e inscribe la nueva)

### Producto adicional: Mejora de Hipoteca + Liquidez

Además del simple cambio de tasa, existe la posibilidad de solicitar **dinero adicional** al cambiar tu hipoteca. El banco puede prestarte capital extra aprovechando el valor ganado de tu propiedad y la operación de portabilidad.

---

## 13. CRÉDITO DE LIQUIDEZ CON GARANTÍA HIPOTECARIA

### ¿Qué es?

Es un préstamo de **libre destino** donde utilizas tu vivienda (libre de gravamen) como garantía. El banco presta entre el **50% y el 70%** del valor del inmueble, y **deposita el dinero directamente en tu cuenta**.

No vendes tu casa ni la pierdes. Solo la usas como respaldo para obtener financiamiento a **tasas hipotecarias** (las más bajas del mercado).

### ¿Para qué se usa?

1. **Capital de trabajo empresarial**: Financiar inventario, expansión, oportunidades de negocio
2. **Consolidación de deudas**: Liquidar tarjetas de crédito (30–40% anual) con un crédito al 12–15% anual
3. **Proyectos personales**: Educación, viajes, remodelación, cualquier necesidad de liquidez

### Ventajas clave

| Característica | Crédito de Liquidez Hipotecaria | Crédito PYME / Personal |
|---|---|---|
| Tasa de interés anual + IVA | 11.5%–15% | 20%–35% |
| Plazo máximo | 15 años (180 meses) | 2–10 años |
| Mensualidad ($2M a 15 años) | ~$28,000–$33,000 | ~$50,000–$60,000 |
| Costo financiero total | Muy bajo | Alto o muy alto |

### Comparativa bancaria (Ejemplo: $2,000,000 a 15 años · Vivienda $3,000,000)

| Banco | Tasa Mínima | CAT | Mensualidad Est. | Total a Pagar |
|---|---|---|---|---|
| **Santander** | 11.50% | 13.9% | $28,734 | $4,906,000 |
| **Scotiabank** | 15.5% (→14.75%) | 18.3% | $35,097 | $5,485,000 |
| **Banorte** | 13.99% | 17.1% | $32,792 | $5,590,000 |

### Requisitos de la propiedad en garantía

- Uso **100% habitacional** (casa o departamento en buen estado)
- **NO aplica**: Terrenos, bodegas, locales, consultorios, oficinas
- **NO aplica**: Propiedades con uso mixto (casa + local comercial)
- Libre de gravamen (sin hipoteca activa)

### Requisitos del solicitante

- Historial crediticio sano y al corriente
- Ingresos comprobables (nómina o estados de cuenta + constancia fiscal)
- Antigüedad: mínimo 1 año en empleo actual (asalariados) o ingresos periódicos demostrables (independientes)

### Checklist de documentos

| Perfil | Documentación |
|---|---|
| Asalariado | INE · Acta · CSF · Domicilio · 3 recibos de nómina · 3 estados de cuenta |
| Independiente/Empresario | INE · Acta · CSF · Domicilio · 6–12 estados de cuenta · Actividad fiscal activa |

---

## 14. CANCELACIÓN DE HIPOTECA

### El Mito de la Escritura

Una vez que terminas de pagar tu hipoteca, **el banco NO te entrega escrituras originales** ni cancela automáticamente la hipoteca. Tu propiedad sigue apareciendo como **hipotecada ante el Registro Público** hasta que tú inicies el trámite de cancelación.

### El Testimonio vs. La Escritura Original

- La **escritura original** nunca sale de la Notaría. Queda resguardada en el protocolo notarial.
- Lo que recibes es un **Testimonio**: copia oficial con sellos y hologramas que tiene el mismo valor legal que el original.
- Días después de la firma puedes solicitar una **Copia Certificada** (para cambios de servicios, predial, etc.)
- En 4–6 meses recibirás el **Testimonio Inscrito** (con sellos del Registro Público de la Propiedad).

> ⚠️ No te quedes solo con la copia simple. El Testimonio Inscrito es el documento definitivo que acredita que eres propietario de forma plena.

### Proceso de Cancelación de Gravamen

Cuando terminas de pagar tu hipoteca, debes seguir estos pasos:

**Paso 1: Carta de Instrucción para Cancelación (10–20 días hábiles)**
- Solicítala a tu banco o Infonavit
- Tienes derecho a que vaya dirigida a la **notaría de tu preferencia**

**Paso 2: Redacción del Proyecto de Cancelación en Notaría (1–3 semanas)**
- Se redacta una nueva escritura: **Escritura de Cancelación o Escritura Complementaria**
- Tu testimonio original NO cambia; este nuevo documento es un anexo formal

**Paso 3: Firma por Apoderados del Banco (3–6 semanas)**
- La Notaría coordina con el banco o Infonavit para que sus apoderados firmen

**Paso 4: Inscripción en el Registro Público (1–3 meses adicionales)**
- El RPP elimina formalmente el registro de la hipoteca

**Tiempo total**: 4 a 6 meses desde que solicitas la carta hasta la inscripción de cancelación

### Costo de la Cancelación

- **Rango estimado**: $10,000–$15,000 MXN
- El costo principal es el cobro del **Registro Público** por la cancelación del gravamen
- El banco o Infonavit **no cobra** por emitir la Carta de Cancelación

### Estrategia: Si vas a vender la propiedad

¡No inicies la cancelación por separado! Puedes hacer **cancelación + venta en el mismo acto notarial** el mismo día:
- El banco firma la cancelación
- Tú firmas la venta
- Todo simultáneamente en la misma notaría

**Beneficios**:
- Ahorras 4–6 meses de espera
- El costo de la cancelación lo pagas con el dinero de la venta

> ⚠️ Si ya iniciaste la cancelación por tu cuenta y consigues un comprador, deberás **esperar a que el proceso esté completamente terminado e inscrito** antes de poder vender. Esto puede retrasar significativamente la operación.

---

## 15. SEGUROS DE LA HIPOTECA

### Los dos seguros obligatorios

Todo crédito hipotecario **por ley requiere** dos seguros:

1. **Seguro de Vida e Invalidez**
2. **Seguro de Daños al Inmueble**

Adicionalmente, muchos contratos incluyen un:
3. **Seguro de Desempleo** (puede ser obligatorio u opcional según el banco)

---

### 1. Seguro de Vida e Invalidez

**¿Qué cubre?**
- **Fallecimiento**: La aseguradora paga el **saldo total** de la hipoteca directamente al banco (no a la familia). El banco emite la Carta de Cancelación de Hipoteca. La familia inicia el proceso de escriturar la propiedad a su nombre.

- **Invalidez Total y Permanente (ITP)**: Si el titular queda incapacitado de por vida, la aseguradora liquida la hipoteca. Cuidado: la invalidez debe ser **total y absoluta** (no parcial).

- **Incapacidad Temporal (para independientes)**: Algunas pólizas cubren mensualidades durante un periodo de incapacidad por enfermedad o accidente.

**El papel crítico del testamento:**
- Si el titular fallece sin testamento, la casa queda libre de deuda pero **no pasa automáticamente** a los herederos. Se requiere un juicio intestamentario que puede tardar años y costar dinero.
- **Recomendación**: Realiza tu testamento al mismo tiempo que compras tu propiedad.

**Procedimiento ante fallecimiento:**
1. Notificar **inmediatamente** al banco y a la aseguradora
2. **Continuar pagando la mensualidad** mientras la aseguradora dictamina (1–6 meses)
3. Una vez liquidada la hipoteca, el banco puede hacer un retroactivo de los pagos hechos de más

---

### 2. Seguro de Daños al Inmueble

**¿Qué cubre?**
Incendio, terremoto, erupción volcánica, inundaciones, huracanes y riesgos hidrometeorológicos.

**La trampa del valor asegurado:**

| Escenario | Valor Asegurado | Saldo Hipotecario | Resultado para el Cliente |
|---|---|---|---|
| **Óptimo** | Valor Comercial ($3.2M) | $2.5M | Aseguradora paga $3.2M → Liquida hipoteca + devuelve $700K al cliente |
| **Riesgoso** | Valor Destructible ($2M) | $2.5M | Aseguradora paga $2M → Propiedad destruida y el cliente sigue debiendo $500K |

> 💡 **Pregunta clave a tu banco**: ¿Mi propiedad está asegurada por el **valor comercial** o solo por el **valor destructible**?

---

### 3. Seguro de Desempleo

**¿Qué cubre?**
Pago de mensualidades al banco durante **3 a 6 meses** si el titular pierde su empleo.

**Condiciones:**
- Solo aplica para **asalariados formales** (no para independientes o freelancers)
- Requiere **al menos 1 año de antigüedad** en el empleo actual
- Solo aplica por **despido injustificado** (no por renuncia voluntaria)

---

### Reglas de Oro de los Seguros Hipotecarios

1. **Hipoteca siempre al corriente**: Un atraso puede anular la cobertura del seguro ante un siniestro.
2. **Jamás mentir en la declaración de salud**: Las aseguradoras comparten datos del Buró Clínico. Si se detecta fraude por omisión (enfermedad preexistente), el seguro no paga nada.
3. **Mayores de 60 años**: Los bancos exigen exámenes médicos completos. Si hay riesgos de salud significativos, el seguro puede ser rechazado.
4. **Reportar siniestros inmediatamente**: Ante fallecimiento, invalidez o daños catastróficos, notifica de inmediato.

---

## 16. HIPOTECA PARA TERRENO

### Diferencias clave vs. compra de vivienda terminada

| Característica | Vivienda Terminada | Terreno |
|---|---|---|
| Aforo máximo del banco | 80%–95% | **70%** |
| Enganche mínimo requerido | 5%–20% | **30%–40%** |
| Plazo máximo | 20–25 años | **15 años** |
| Seguro de daños | Sí (construcción + contenido) | Solo seguro de vida (no hay construcción que asegurar) |
| Riesgo percibido por el banco | Menor | Mayor |

### Requisitos del Terreno (No Negociables)

El banco rechazará automáticamente si el terreno:
- Es ejidal o rural
- No cuenta con servicios básicos (al menos factibilidad de agua)
- No tiene Boleta Predial
- Está fuera de un fraccionamiento o condominio formalmente constituido (política cada vez más común en 2026)

**La regla de oro**: Si el fraccionamiento dice que "los servicios están por llegar" pero aún no existen físicamente ni hay factibilidad inmediata → el terreno **no califica**.

### Requisitos del Solicitante

Iguales a los de cualquier hipoteca:
- Buró de crédito limpio y al corriente
- Ingresos comprobables (nómina o estados de cuenta)
- Asalariados: mínimo 1 año de antigüedad laboral
- Independientes: mínimo 2 años de actividad fiscal activa

### Ejemplo de Cotización (Banorte · Terreno $1,500,000)

| Concepto | Detalle |
|---|---|
| Valor del terreno | $1,500,000 MXN |
| Financiamiento bancario (70%) | $1,050,000 MXN |
| Enganche (30%) | $450,000 MXN |
| Gastos notariales (4%) | ~$60,000 MXN |
| Tasa de interés | 10.68% |
| CAT | 12.7% |
| Mensualidad total (15 años) | $12,696 MXN |
| Costo total del crédito (sin aportaciones) | $2,236,026 MXN |

> Nota: El crédito hipotecario de terreno **NO genera IVA**. Tampoco cobra seguro de daños (no hay construcción).

### Opción superior: Terreno + Construcción en un solo crédito

Si planeas construir en el corto plazo, existe el **Crédito Hipotecario de Terreno + Construcción**:
- El banco financia la compra del lote **y** la construcción
- Los recursos de la obra se liberan gradualmente conforme avanza la construcción (**ministraciones**)
- Se unifica todo en un solo acto y un solo crédito

---

## 17. HIPOTECA DE ECONOMÍA AMERICANA (MEXICANOS EN USA/CANADÁ)

### ¿Es posible comprar casa en México si vivo en el extranjero?

**Sí, es completamente posible.** Los principales bancos en México tienen un producto específico llamado **Hipoteca de Economía Americana** diseñado para mexicanos que generan ingresos en Estados Unidos o Canadá.

### Diferencias vs. hipoteca tradicional

| Característica | Hipoteca Tradicional (Residente en México) | Hipoteca de Economía Americana |
|---|---|---|
| Aforo máximo | 80%–95% | 80%–85% |
| Enganche mínimo requerido | 5%–20% | **15%–20%** |
| Ingresos en | Pesos MXN | Dólares USD |
| Buró revisado | Solo México | México **y** Estados Unidos |
| Disponibilidad pública | Ampliamente promovida | Poco publicada |

### Perfil de ingresos elegibles

**Aplica:** Asalariados formales y self-employed con declaración fiscal en EE. UU.

**NO aplica:** Ingresos 100% en efectivo, sin declaraciones de impuestos ni depósitos bancarios.

#### Documentación para Asalariados (Employee)

- **Forma W2** del último año fiscal completo
- **Pay Stubs** de los últimos 6 meses
- **Estados de cuenta bancarios americanos** de los últimos 6 meses
- Los tres documentos deben mostrar **cifras consistentes** entre sí

#### Documentación para Independientes (Self-Employed)

- **Forma 1040** con Anexo C (o correspondiente) de los últimos **2 años**
- **Estados de cuenta bancarios personales** de los últimos 6 meses

> ⚠️ **Advertencia sobre cuentas LLC**: Si tu negocio está a nombre de una LLC, el banco en México solo considera ingresos de **persona física**. El dinero en cuenta de empresa no cuenta. Debe reflejarse en tu 1040 personal y en cuentas personales a tu nombre.

### Historial crediticio

Se revisan **ambos burós**: el mexicano y el americano.

- **Buró mexicano**: Deudas de hace más de **6 años** generalmente ya no aparecen. Deudas recientes activas pueden causar rechazo.
- **Buró americano**: Debe ser positivo. Score considerable (sin colecciones ni impagos recientes). Descárgalo de Equifax, TransUnion o Experian.

### Debt-to-Income Ratio

El banco considerará tus compromisos activos en EE. UU. (tarjetas, auto, renta, otros préstamos) para calcular tu capacidad real de pago de la hipoteca en México.

**Recomendación**: Reduce deudas en EE. UU. antes de solicitar la hipoteca en México para mejorar tu capacidad de endeudamiento.

### Documentación general adicional

- INE vigente o **pasaporte mexicano**
- Comprobante de domicilio en EE. UU.
- Comprobante de domicilio en México (puede ser de un familiar)
- Acta de nacimiento y CURP
- **Constancia de Situación Fiscal (RFC)** ante el SAT — aunque trabajes en EE. UU., el banco mexicano lo requiere. Trámite 100% en línea, tarda ~30 minutos.

### Bancos que trabajan con este esquema

BBVA, Santander, Citibanamex, Banorte, Scotiabank, HSBC.

> ⚠️ **El problema real**: Este producto no se publicita masivamente. Muchos ejecutivos de banco y brokers sin experiencia desconocen los requisitos, lo que lleva a expedientes mal integrados y rechazos innecesarios. Es vital trabajar con un broker con experiencia comprobada en este esquema.

### ¿Y si no soy mexicano? (Extranjeros no nacionales)

También existen opciones de financiamiento en México para ciudadanos de otros países (estadounidenses, canadienses, europeos). Los ingresos en otras monedas pueden ser considerados. Agenda una asesoría para evaluar tu caso específico.

---

## 18. CRÉDITO PYME Y EMPRESARIAL 2026

### El principio de la Deuda Inteligente

Las grandes corporaciones (Apple, Netflix, Walmart) no se expanden con su propio flujo de caja. Usan deuda estratégicamente como palanca de crecimiento:

- **Apple**: Pide prestado a pesar de tener efectivo abundante → deduce intereses y no toca sus utilidades
- **Netflix**: Se endeudó para producir contenido antes de tener clientes → usó las suscripciones generadas para pagar la deuda
- **Walmart**: Crédito para abrir nuevas tiendas → las ventas de esa misma sucursal pagan el crédito

**Regla de oro empresarial**: No busques financiamiento cuando ya estás "ahogado". El crédito inteligente se solicita cuando el negocio tiene **salud**, no cuando está en crisis.

**La ecuación correcta**: No veas solo el costo del crédito → ve el **retorno** que generará ese capital.

### Regla de Oro Fiscal

Los bancos y financieras prestan sobre lo que **declaraste ante el SAT**, no sobre lo que dices que ganas. Facturar correctamente no es un gasto, es tu **boleto de entrada al financiamiento**.

---

### ESQUEMA 1: Crédito Simple

Inyección de capital en una sola exhibición. Ideal para: maquinaria, remodelación, inventario.

#### Opción A: Sin Garantía (hasta $5M)
| Característica | Detalle |
|---|---|
| Base de evaluación | Facturación fiscal (SAT) |
| Montos | $500,000–$5,000,000 MXN |
| Desembolso | 48–72 horas |
| Sin garantía hipotecaria | ✅ |
| Tasa anual | 25%–35% |
| Aliados | Confío, Finsus, Cobalto, Crece, Banorte |

#### Opción B: Sobre Terminal Punto de Venta (TPV)
| Característica | Detalle |
|---|---|
| Aplica para | Negocios con cobro por tarjeta |
| Montos | $200,000–$10,000,000 MXN |
| Pago | Retención automática del 15%–25% por ticket |
| Sin garantía hipotecaria | ✅ |
| Tasa mensual | 2%–2.5% |
| Plazo máximo | 12 meses |
| Aliados | Anticipa, iCash |

#### Opción C: Con Garantía Hipotecaria (más de $5M)
| Característica | Detalle |
|---|---|
| Facturación mínima requerida | $5,000,000 MXN/mes |
| Montos | >$5,000,000 MXN |
| Tasa anual | 15%–25% |
| Plazo | Hasta 10–15 años |
| Aliados | Banorte, Banco Afirme, Crece, Fintechs especializadas |

---

### ESQUEMA 2: Crédito Revolvente (Línea de Crédito)

Funciona como una tarjeta de crédito empresarial: se autoriza un límite y solo se pagan intereses sobre lo utilizado.

#### Clara (Tarjeta de Crédito Empresarial)
- Para: Agencias, startups, empresas con gastos en publicidad digital o viáticos
- Línea: $50,000–$5,000,000 MXN
- 0% de interés si se paga el total al corte (hasta 40 días)
- Tasa si se financia: 2%–3% mensual

#### Fin Cargo (Para Importadores)
- Para: Empresas que importan de Asia, Europa o EE. UU.
- Fin Cargo paga al proveedor extranjero; la empresa paga cuando la mercancía llega a México
- La mercancía en tránsito es la garantía (no se hipoteca propiedad)
- Montos: $50,000–$1,500,000 USD
- Tasa mensual: 1.5%–2.5%

#### Zepelin (Factoraje Silencioso)
- Para: Empresas que venden a gigantes (Walmart, Liverpool, etc.) con pagos a 60–90 días
- La empresa sube la factura y recibe el dinero **hoy mismo**
- El cliente de la empresa (el deudor) **nunca se entera** del adelanto
- Funciona como línea revolvente respaldada en facturas de alta calidad
- Tasa mensual: 1.5%–3%

---

### ESQUEMA 3: Arrendamiento Puro (Leasing)

**Regla de activos:**
- Se **rentan**: activos que se devalúan (autos, tecnología, maquinaria)
- Se **compran**: activos que ganan valor (terrenos, naves industriales, bodegas)

**Beneficios fiscales:**
- La renta es 100% deducible como **gasto operativo** ante el SAT
- La empresa no absorbe la depreciación del activo
- Opción al final: comprar el activo a valor residual bajo o devolver y sacar uno nuevo

**Sale & Leaseback (Arrendamiento Inverso):**
Si ya tienes activos pero necesitas flujo, la financiera te **compra el equipo**, te deposita el dinero y tú lo sigues usando pagando una renta mensual deducible.

| Giro de Negocio | Aliados Especializados |
|---|---|
| Logística y Transporte | Tip México |
| Autos y flotillas | Bitcar, Tip Auto |
| Energía, Tecnología, Equipo Médico | Engin |
| Maquinaria industrial en general | Solufi, Unifin, Renda Más |
| Construcción e industria pesada | Acción Financiera |

---

### ESQUEMA 4: Crédito Inmobiliario PYME

Para empresas que quieren dejar de pagar renta y adquirir su propio espacio.

- Para: Bodegas, naves industriales, consultorios, oficinas corporativas, terrenos comerciales
- Aliados: Afirme, Ion Financiera, Tu Casa Express
- Financiamiento máximo: **70% del valor del inmueble**
- Enganche mínimo: **30%** aportado por la empresa
- Plazos: Hasta 10–15 años

---

## 19. FINANCIAMIENTO ÁGIL PARA NEGOCIOS EN 48–72 HORAS

### ¿Por qué no ir al banco tradicional?

Los bancos tradicionales pueden tardar **meses o incluso años** en conocerte y autorizarte. Las financieras modernas (SOFOMES, SOFIPOS) no requieren relación previa y evalúan en horas.

### Requisito de entrada: Buró de Crédito Positivo

- Persona Moral: Buró de la empresa **y** del representante legal deben ser positivos
- PFAE: Buró personal positivo
- Buró negativo → acceso muy limitado o nulo

### Perfil 1: Negocios que cobran por transferencia (SPEI)

La evaluación se basa en la **facturación ante el SAT**. Las financieras se conectan directamente al **Visor del SAT** mediante tu contraseña CIEC para analizar en minutos:
- Monto declarado por mes
- Clientes y proveedores principales
- Comportamiento ingreso vs. egreso

**Regla fiscal estricta:**
- Fiscalizas todo → oferta robusta de crédito
- Fiscalizas parcialmente → oferta proporcional a lo demostrable
- Declaras cero o pérdidas → crédito imposible

**Ejemplo de rechazo** (empresa con ingresos irregulares):

| Mes | Ingreso Fiscalizado |
|---|---|
| Enero | $1,000,000 |
| Febrero | $1,700,000 |
| Marzo | $2,600,000 |
| Abril–Noviembre | Caída constante |
| Diciembre | $338,000 |

Motivo de rechazo: caída severa de ingresos + múltiples solicitudes simultáneas de crédito = señal de problemas graves de flujo.

**Ejemplo de aprobación** (empresa con facturación constante):

| Meses | Ingreso Fiscalizado |
|---|---|
| Todos los meses | $10,000,000–$16,000,000 (constante) |

Resultado: Crédito aprobado por **$5,000,000 MXN**.

---

### Perfil 2: Negocios que cobran con TPV

Evaluación basada en **historial de ventas de los últimos 12 meses**. La financiación puede ser de hasta **2 veces las ventas mensuales promedio**.

**Ejemplo real (tienda de abarrotes con Finsus Anticipa):**

| Concepto | Detalle |
|---|---|
| Monto del anticipo | $1,912,000 MXN |
| Comisión por apertura | 4% |
| Porcentaje de retención por venta | 20% |
| Plazo | 16 meses |
| Costo total del crédito | $664,000 MXN |
| Uso | Apertura de segunda sucursal |

---

## 20. MEJORA DE SCORE CREDITICIO

### ¿Por qué importa el score crediticio en una hipoteca?

Un score más alto puede significar una **tasa de interés menor** y acceso a mejores productos hipotecarios. La diferencia de 1 punto porcentual en la tasa, en un crédito de $2,000,000 a 20 años, puede representar más de **$1,000,000 MXN** en costo total.

### Factores que mejoran el score

| Acción | Impacto |
|---|---|
| Pagar todos los créditos puntualmente | Alto (el más importante) |
| Mantener revolvencia baja (<30% del límite) | Alto |
| Reducir consultas al buró (evitar solicitar muchos créditos a la vez) | Medio-Alto |
| Tener créditos con antigüedad (no cerrarlos innecesariamente) | Medio |
| Diversificar tipos de crédito (TDC + auto + hipoteca) | Medio |

### Factores que dañan el score

| Situación | Impacto |
|---|---|
| Pagos atrasados o incompletos | Muy alto (negativo) |
| Quitas o reestructuras | Muy alto (negativo) |
| Cuentas en cobranza | Muy alto (negativo) |
| Alta revolvencia (>70% del límite usado) | Alto (negativo) |
| Muchas consultas de buró en poco tiempo | Medio (negativo) |

### ¿Cuánto tarda en recuperarse el buró?

- Atraso leve y puntual: 6–12 meses de pagos perfectos pueden compensarlo
- Quita o reestructura: Permanece en el buró hasta **6 años** después de la última actualización
- Cuentas cerradas con historial positivo: Se mantienen como antecedente positivo

### Estrategia de limpieza antes de solicitar hipoteca

1. Paga puntualmente **todos** tus créditos activos por al menos 6 meses antes de solicitar
2. Reduce el uso de tus tarjetas de crédito al **30% o menos** del límite
3. **No solicites** nuevos créditos ni hagas que consulten tu buró en los 3 meses previos
4. Revisa tu reporte de buró en [burodecredito.com.mx](https://www.burodecredito.com.mx) para detectar errores
5. Si hay registros incorrectos, puedes impugnarlos ante el Buró de Crédito

---

## 21. PREGUNTAS FRECUENTES — Q&A COMPLETO

### SOBRE EL BROKER Y EL PROCESO

**P: ¿Cuánto me cuesta la asesoría de Luis Valadés?**
R: Cero. La asesoría hipotecaria es completamente gratuita para ti. El broker recibe sus honorarios del banco cuando se firma la escritura. Nunca del cliente.

**P: ¿Para qué me sirve un broker si puedo ir directo al banco?**
R: Un ejecutivo de banco solo te ofrece los productos de su institución. Un broker compara más de 10 bancos simultáneamente y te presenta la opción que mejor se adapta a tu perfil. Además, al ser auditados por los bancos y certificados por la AMH, garantizan profesionalismo y seguridad.

**P: ¿Cuánto tarda en promedio el proceso hipotecario?**
R: En condiciones normales con documentos completos, entre 4 y 8 semanas totales: 3–5 días para la autorización y 3–7 semanas para la formalización notarial.

**P: ¿Puedo tener hipoteca si soy independiente o dueño de mi negocio?**
R: Sí, siempre que tengas al menos 2 años de alta en actividad fiscal ante el SAT y tus ingresos se reflejen en estados de cuenta bancarios que coincidan con tu actividad declarada.

**P: ¿Qué pasa si me rechazan en un banco?**
R: Un rechazo no significa que no puedas obtener hipoteca. Cada banco tiene criterios diferentes. El broker analiza tu perfil y determina qué institución es más viable para ti. Un crédito rechazado vale $0; el mejor banco es el que te aprueba.

**P: ¿Puedo solicitar hipoteca con mi pareja o familiar (co-acreditado)?**
R: Sí. La mayoría de los bancos acepta co-acreditados, lo que permite sumar ingresos para calificar a un monto mayor. Es una estrategia común cuando los ingresos individuales no son suficientes.

---

### SOBRE TASAS Y COSTOS

**P: ¿Cuál es la mejor tasa hipotecaria en México en 2026?**
R: No existe una "mejor tasa universal". La tasa depende de tu perfil crediticio, nivel de ingresos, score crediticio y el banco. Las tasas publicitadas son "gancho" para perfiles impecables. Lo importante es el costo total del crédito y el CAT, no solo la tasa nominal.

**P: ¿Por qué la CAT es más alta que la tasa de interés?**
R: Porque el CAT incluye la tasa de interés más todos los costos accesorios: seguros, comisiones, avalúo y cualquier otro cargo recurrente. Es el indicador más honesto del costo real del crédito.

**P: ¿Cuánto dinero necesito tener ahorrado para comprar una casa de $2,000,000?**
R: Aproximadamente $340,000 MXN: $200,000 de enganche (10%) + $140,000 de gastos de escrituración (7%). Si usas Cofinavit con saldo de subcuenta Infonavit como enganche, podrías necesitar solo los gastos de escrituración.

**P: ¿Una tasa más baja siempre significa que pago menos?**
R: No. Un banco con tasa del 10% que cobra seguros y comisiones puede costarte más en total que uno con tasa del 11.35% que no cobra accesorios. Siempre compara el costo total del crédito.

---

### SOBRE INFONAVIT Y FOVISSSTE

**P: ¿Para qué sirve el Apoyo Infonavit si ya tengo hipoteca con el banco?**
R: Para reducir dramáticamente el plazo de tu hipoteca sin gastar dinero extra de tu bolsillo. Las aportaciones patronales del 5% de tu SDI se van directo a capital, y pueden ahorrarte hasta $714,000 MXN en el ejemplo comparativo.

**P: ¿Necesito los 1,080 puntos de Infonavit para el Apoyo Infonavit?**
R: No. Solo necesitas tener una relación laboral vigente cotizando al IMSS y saldo en tu Subcuenta de Vivienda. Los 1,080 puntos son para el crédito directo de Infonavit, no para el Apoyo Infonavit.

**P: ¿Puedo incorporar el Apoyo Infonavit si ya tengo hipoteca activa sin él?**
R: Sí. Habla con tu banco, firma el Anexo 43 bis y en aprox. 3 bimestres (6 meses) comenzarás a ver las aportaciones aplicadas a tu hipoteca.

---

### SOBRE APORTACIONES A CAPITAL

**P: ¿Qué me conviene más: reducir el plazo o la mensualidad?**
R: Para maximizar el ahorro en intereses, **reducir el plazo es siempre la mejor estrategia**. Sin embargo, si necesitas holgura en tu flujo mensual, reducir la mensualidad es una opción válida. Todo depende de tu situación financiera personal.

**P: ¿Cuándo es mejor hacer una aportación a capital?**
R: Cuanto antes, mejor. Una aportación de $100,000 en el mes 12 puede ahorrarte hasta $802,000 en intereses (esquema plazo). La misma aportación en el mes 120 ahorra solo $304,000.

**P: ¿Puedo hacer aportaciones a capital cuando quiera?**
R: Depende de tu banco y lo que estipula tu contrato. Muchos bancos lo permiten desde la app o banca en línea. Revisa si hay algún mínimo o restricción en tu contrato original.

---

### SOBRE PORTABILIDAD DE HIPOTECA

**P: ¿Cuándo conviene cambiar mi hipoteca de banco?**
R: Cuando la diferencia en tasas genera un ahorro neto superior a los gastos del proceso. Como regla general, si la tasa nueva es al menos 1–1.5 puntos porcentuales menor y tienes buen historial de pago, muy probablemente conviene.

**P: ¿El cambio de hipoteca afecta la titularidad de mi propiedad?**
R: No. No hay traslado de dominio. Solo cambia el banco acreedor, no el propietario. Por eso no pagas ISAI (Impuesto sobre Adquisición de Inmuebles).

**P: ¿Cuánto tiempo tengo que llevar pagando mi hipoteca para poder cambiarla?**
R: La mayoría de los bancos solicitan un mínimo de **6 meses** de historial de pago con el banco de origen.

---

### SOBRE CANCELACIÓN DE HIPOTECA

**P: Terminé de pagar mi hipoteca, ¿el banco me manda las escrituras?**
R: No. Las escrituras originales nunca salen de la Notaría. El banco no te contactará para decirte que inicies la cancelación. Debes iniciarla tú mismo solicitando la Carta de Instrucción de Cancelación al banco.

**P: Si ya pagué mi hipoteca, ¿puedo vender la casa de inmediato?**
R: No directamente. Primero debes cancelar el gravamen en el Registro Público de la Propiedad (proceso de 4–6 meses) o hacerlo simultáneamente con la venta en el mismo acto notarial.

**P: ¿Cuánto cuesta cancelar la hipoteca?**
R: Entre $10,000 y $15,000 MXN, principalmente por los derechos cobrados por el Registro Público. El banco no cobra por la Carta de Cancelación.

---

### SOBRE SEGUROS

**P: Si fallezco, ¿le pagan a mi familia el dinero de la hipoteca?**
R: No directamente. El seguro de vida paga al banco para liquidar la deuda. El banco emite la Carta de Cancelación. Con eso y el testamento, la familia puede escriturar la propiedad a su nombre. Sin testamento, debe iniciarse un juicio intestamentario.

**P: ¿Qué pasa si pierdo mi trabajo y no puedo pagar la hipoteca?**
R: Si tienes seguro de desempleo y eres asalariado con más de 1 año de antigüedad, el seguro cubre entre 3 y 6 mensualidades. Si no tienes seguro de desempleo (o eres independiente), habla de inmediato con tu banco para explorar opciones de reestructura antes de caer en mora.

---

### SOBRE CRÉDITO PYME

**P: ¿Qué necesito para que me presten dinero para mi negocio rápido?**
R: Dos cosas fundamentales: ingresos comprobables (facturación ante el SAT o historial de ventas con TPV) y Buró de Crédito positivo (empresa y representante legal). Con eso, algunas financieras pueden prestarte en 48–72 horas.

**P: ¿Vale la pena pedir un crédito PYME si la tasa es alta?**
R: Depende del retorno. Si el crédito te permite generar más utilidad de lo que cuesta el interés, es una palanca de crecimiento. El error es ver solo el costo sin calcular el retorno esperado.

**P: ¿Puedo usar mi casa como garantía para un crédito de mi negocio?**
R: Sí, pero lo más recomendable es tramitarlo como un **Crédito de Liquidez Hipotecaria** (tasa 11–15% anual) y no como un crédito PYME con garantía hipotecaria (tasa 25–35% anual). La diferencia en costo es brutal con la misma garantía.

---

### MEXICANOS EN EL EXTRANJERO

**P: Vivo en Estados Unidos, ¿puedo comprar casa en México con hipoteca?**
R: Sí. Existe la Hipoteca de Economía Americana disponible en los principales bancos de México. Necesitas ingresos comprobables (W2 o 1040), buró de crédito positivo en EE. UU. y México, y estar dado de alta ante el SAT mexicano.

**P: ¿Me piden el RFC aunque viva en EE. UU.?**
R: Sí. El banco mexicano requiere tu Constancia de Situación Fiscal del SAT. El alta de RFC es un trámite sencillo y 100% en línea que toma aproximadamente 30 minutos.

**P: ¿El banco acepta mis ingresos en dólares?**
R: Sí, los documentos comprobatorios de ingresos en dólares son aceptados. Se realizará una conversión considerando el tipo de cambio al momento del análisis.

---

## 22. GLOSARIO DE TÉRMINOS HIPOTECARIOS

| Término | Definición |
|---|---|
| **Aforo** | Porcentaje del valor del inmueble que el banco está dispuesto a financiar (ej. 80% de aforo = banco financia el 80%, el cliente pone el 20% de enganche) |
| **Apoyo Infonavit** | Esquema donde las aportaciones patronales del 5% del SDI se destinan al pago de capital de una hipoteca bancaria |
| **Avalúo Comercial** | Estudio pericial que determina el valor de mercado de una propiedad. Debe ser certificado ante la SHF |
| **Buró de Crédito** | Base de datos que registra el comportamiento de pago de personas y empresas ante créditos. Su reporte se llama "Reporte de Crédito Especial" |
| **Buró Clínico** | Base de datos compartida entre aseguradoras con información médica de los asegurados. Previene fraudes por omisión |
| **CAT** | Costo Anual Total. Incluye tasa de interés + seguros + comisiones. El indicador más completo del costo real de un crédito |
| **Carta de Autorización de Crédito** | Documento oficial emitido por el banco que confirma la aprobación del crédito, indicando monto, tasa, plazo y condiciones |
| **Co-acreditado** | Persona que comparte la responsabilidad del crédito hipotecario. Sus ingresos se suman para calificar un mayor monto |
| **Cofinavit** | Crédito conjunto entre el Infonavit y un banco. El saldo de subcuenta puede usarse como enganche |
| **CURP** | Clave Única de Registro de Población. Documento de identidad personal en México |
| **Enganche** | Aportación inicial del comprador que representa la diferencia entre el valor de la propiedad y el monto del crédito |
| **Escritura Pública** | Documento notarial que formaliza legalmente la compraventa de un inmueble |
| **Factor Portafolio** | Condición de algunos bancos (Citibanamex) para dar tasas preferenciales: tener inversiones por encima de cierto monto en esa institución |
| **Factoraje** | Adelanto de cuentas por cobrar. La empresa vende sus facturas a una financiera para recibir el dinero de inmediato en lugar de esperar 30–90 días |
| **Fovissste** | Fondo de la Vivienda del ISSSTE, para trabajadores al servicio del gobierno |
| **Gravamen** | Carga legal sobre una propiedad que la limita (hipoteca, embargo, etc.). Consta en el Registro Público de la Propiedad |
| **IMSS** | Instituto Mexicano del Seguro Social. Seguridad social del sector privado |
| **Infonavit** | Instituto del Fondo Nacional de la Vivienda para los Trabajadores del sector privado |
| **ISAI** | Impuesto Sobre Adquisición de Inmuebles. Se paga en compraventas (aprox. 2–3% del valor). No aplica en portabilidad de hipoteca |
| **ITP** | Invalidez Total y Permanente. Cobertura del seguro de vida hipotecario que liquida la deuda si el titular queda incapacitado de por vida |
| **Leaseback / Sale & Leaseback** | La empresa vende un activo a una financiera y lo renta de vuelta. Convierte activos fijos en liquidez inmediata |
| **Leasing / Arrendamiento Puro** | La financiera compra el activo y la empresa lo renta. La renta es 100% deducible. Al final puede comprarse a valor residual |
| **Ministraciones** | Liberaciones parciales de recursos en un crédito de construcción conforme avanza la obra |
| **Notaría** | Institución jurídica que formaliza y da fe pública a los actos legales como compraventas e hipotecas |
| **Plazo** | Número de meses (o años) en que se pagará el crédito hipotecario |
| **Portabilidad de Hipoteca** | Proceso de cambiar la hipoteca a un nuevo banco para obtener mejores condiciones |
| **Premio por Puntualidad** | Reducción de tasa de interés que algunos bancos (Santander, HSBC, Scotiabank) otorgan por el pago puntual sostenido durante cierto periodo |
| **Registro Público de la Propiedad (RPP)** | Institución gubernamental que registra la titularidad y gravámenes de los inmuebles |
| **Revolvencia** | Porcentaje del límite de crédito de una tarjeta que está siendo utilizado. Revolvencia baja (<30%) mejora el score crediticio |
| **RFC** | Registro Federal de Contribuyentes. Clave fiscal ante el SAT en México |
| **SAT** | Servicio de Administración Tributaria. Autoridad fiscal de México |
| **SDI** | Salario Diario Integrado. Base de cálculo de las aportaciones al IMSS/Infonavit |
| **SHF** | Sociedad Hipotecaria Federal. Entidad gubernamental que certifica avalúos y promueve el crédito hipotecario en México |
| **SOFOM / SOFIPO** | Sociedades Financieras de Objeto Múltiple / Popular. Instituciones de crédito no bancarias, más ágiles pero con tasas generalmente más altas |
| **Saldo Insoluto** | El capital que aún debes en un crédito. Los intereses se calculan sobre este saldo (no sobre el monto original) |
| **Subcuenta de Vivienda** | Cuenta del Infonavit donde se acumulan las aportaciones patronales del 5% del SDI a lo largo de la vida laboral |
| **Tasas Gancho** | Tasas muy bajas que los bancos publicitan y que solo aplican para perfiles crediticios excepcionales (~5%–20% de solicitantes) |
| **Tasa Nominal** | El porcentaje de interés anual cobrado sobre el saldo del crédito, sin incluir seguros ni comisiones |
| **Tasa Piso** | La tasa mínima a la que puede llegar un crédito con premio por puntualidad (ej. 10.35% en Santander Free) |
| **Testimonio Inscrito** | Copia oficial de la escritura con sellos del RPP. Es el documento definitivo que acredita la propiedad plena |
| **TPV** | Terminal Punto de Venta. Dispositivo para cobro con tarjeta de crédito/débito |
| **Valuador Certificado** | Profesional certificado que realiza el avalúo comercial de una propiedad |
| **Vinculación Bancaria** | Requisito de algunos bancos (Scotiabank) para dar tasas preferenciales: portar la nómina, usar su TDC o mantener un saldo mínimo |
| **Visor SAT** | Herramienta del SAT que permite a terceros autorizados consultar la información fiscal de una empresa o persona |

---

## APÉNDICE: FRASES CLAVE DEL BOT

El bot puede usar estas frases para comunicar de forma alineada con la marca de Luis Valadés:

- *"La mejor tasa es la que te aprueban, no la que ves en el anuncio."*
- *"Un crédito rechazado vale cero pesos. El mejor banco es el que te dice sí."*
- *"No te cases con una tasa bonita, cásate con el banco que sí te apruebe."*
- *"El tiempo es el factor más determinante en una hipoteca. Entre más rápido pagues, más ahorras."*
- *"Pagar impuestos no es un gasto, es tu boleto de entrada a las ligas mayores del financiamiento."*
- *"No le regales más años de tu vida al banco. El Apoyo Infonavit es un beneficio que ya te pertenece."*
- *"Una hipoteca pagada no es una hipoteca cancelada, hasta que tengas el testimonio inscrito en el RPP."*
- *"Nuestra asesoría no tiene ningún costo para ti. Agenda en credexpress.com."*

---

*Documento elaborado para uso interno de entrenamiento del Bot de Conocimiento de Luis Valadés · Broker Hipotecario Certificado · AMH · Vigencia de certificación: 15 de junio de 2027 · credexpress.com*