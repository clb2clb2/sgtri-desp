# Arquitectura

> Análisis sobre el commit `c4dd894` (ver STATUS.md). Las rutas son relativas a la raíz del repositorio.

## 1. Visión general

Es una SPA de un solo HTML (`index.html`) y no tiene servidor. Toda la lógica corre en el navegador con módulos IIFE que se registran en `window`. Las capas son estas:

```
utils / limpiaDatos / confirmDialog / validaciones          ← utilidades transversales
uiPagos, uiDesplazamientos, uiDesplazamientoEspecial,
uiDesplazamientoAecc, uiAjustes, uiImputacion              ← UI por sección (crean DOM dinámico)
serializacionDatos, tipoLiquidacion                         ← estado (.dta) y modo de liquidación
cogeDatosDesp → calculoDesp (MOTOR puro + WRAPPER) → salidaDesp   ← pipeline de cálculo por ficha
logicaDesp                                                  ← disparadores de recálculo
resultadoLiquidacion (+ window.__sgtriTotales)              ← consolidación de importes
main, formLogic                                             ← arranque y orquestación
pdfGen (+ pdfmake, pdfFonts)                                ← salida PDF
```

## 2. Orden de carga (`index.html:24-54`)

1. **Síncronos en `<head>`**, que se ejecutan antes que todos los `defer`: `pdfmake.min.js` y `pdfFonts.js`. Este último fusiona sus fuentes en `pdfMake.vfs` y `pdfMake.fonts`.
2. **`defer`, en orden de documento:** utils → limpiaDatos → confirmDialog → validaciones → uiPagos → uiDesplazamientos → uiDesplazamientoEspecial → uiDesplazamientoAecc → uiAjustes → uiImputacion → serializacionDatos → tipoLiquidacion → cogeDatosDesp → calculoDesp → logicaDesp → salidaDesp → resultadoLiquidacion → main → formLogic → pdfGen.
3. **Auto-inicialización.** `tipoLiquidacion.js:306-310`, `uiDesplazamientoAecc.js:1243-1247` y `pdfGen.js:2479-2483` usan el patrón `readyState==='loading' ? DOMContentLoaded : init()`. Como los scripts `defer` se ejecutan con `readyState` ya en `interactive`, en la práctica se inician en el momento.
4. **Dos listeners de `DOMContentLoaded`**, que se ejecutan en este orden:
   - `main.js:6`
     - Monta el acordeón de secciones (ARIA, `data-start-collapsed`, ResizeObserver).
     - Hace `preventDefault` en todos los `submit`.
     - Llama a `logicaDesp.init()`, `resultadoLiquidacion.init()` y `uiImputacion.init()`.
     - Hace un cálculo inicial de fichas que no tiene efecto, porque al arrancar no hay ninguna (`main.js:173-190`).
   - `formLogic.js:14`
     - Registra los listeners delegados globales: `input` (saneado en vivo), `blur` (formateo y validación de IBAN, tarjeta, fechas…), `focusin` y `keydown`.
     - Lanza `fetch('assets/data/datos.json')`.
     - En el `.then` (`formLogic.js:81-264`), en este orden:
       1. `window.__sgtriDatos = data`.
       2. Rellena los selects de categoría, pago y tipo de proyecto.
       3. Pasa los países y los datos AECC a los módulos.
       4. Llama a `uiPagos.init()`, `serializacionDatos.inicializar(versionEsquema)`, `uiDesplazamientos.init()` y `uiAjustes.init()`.
       5. Conecta los botones Guardar, Cargar, Borrar todo, Inicio y fecha de firma.
     - Si el `fetch` falla, **solo** se hace `console.error` (:265) y esos botones quedan sin conectar.

## 3. Módulos (API pública → quién la usa)

| Archivo | `window.*` | Responsabilidad | Llamado desde |
|---|---|---|---|
| `js/utils.js` | `utils` | `fmt` (`de-DE`), `fmtPrecio`, `parseNumber`, `round2`, `debounce`, `getSgtriDatos` y reglas compartidas: `getNormativa`, `esPaisInternacional`, `ordenCrucesValido`. Es la única implementación; el resto de módulos delega aquí | salidaDesp, resultadoLiquidacion, uiImputacion, uiDesplazamientoEspecial… |
| `js/limpiaDatos.js` | `limpiaDatos` | Saneado de texto, IBAN, DNI y orgánica; `ibanMod97Valido`; `parseDateStrict` y `parseTimeStrict` (únicos parsers de fecha y hora); formateo de fecha | formLogic, uiPagos, AECC, validaciones, cogeDatosDesp |
| `js/confirmDialog.js` | `confirmDialog`, `showConfirm`, `showPrompt`, `showChoice`, `showMessage` | Modales basados en promesas; escapan todo el texto (`escapeHtml`) y convierten `
` en `<br>` | pdfGen, formLogic, uiDesplazamientos, serializacionDatos |
| `js/validaciones.js` | `validaciones` | Validación de fecha y hora (blur, teclado) y de cruces de frontera, con marcado `.field-error` | formLogic (:799, :809, :1222), uiDesplazamientos |
| `js/uiPagos.js` | `uiPagos` | Pinta los campos IBAN, IBAN+SWIFT o tarjeta según `#tipo-pago`. **La validación está en formLogic** | formLogic:158 |
| `js/uiDesplazamientos.js` | `uiDesplazamientos` | Crea, elimina y renumera fichas, otros gastos, ficha de vehículo, select de países, ticket de cena y límites | formLogic, serializacionDatos, tipoLiquidacion |
| `js/uiDesplazamientoEspecial.js` | `uiDesplazamientoEspecial` | Ficha libre de líneas (importe × cantidad), solo en modo GNRAL | resultadoLiquidacion:401, serializacionDatos, tipoLiquidacion |
| `js/uiDesplazamientoAecc.js` | `uiDesplazamientoAecc` | Desplazamiento AECC con **cálculo propio** (`calcularDatosResultadoAecc`, :579-676). Registra en `__sgtriTotales` bajo la clave `'aecc'` | formLogic, tipoLiquidacion, serializacionDatos |
| `js/uiAjustes.js` | `uiAjustes` | Líneas de descuento y visibilidad del importe anticipado (solo en GNRAL) | formLogic, tipoLiquidacion, serializacionDatos |
| `js/uiImputacion.js` | `uiImputacion` | Reparto del importe entre orgánicas (la línea principal es de solo lectura y absorbe el resto) | main, resultadoLiquidacion:665, serializacionDatos |
| `js/serializacionDatos.js` | `serializacionDatos` | `recopilarTodo`, `restaurarTodo`, exportar e importar `.dta` (:1285-1295) | formLogic, tipoLiquidacion, **pdfGen:282** |
| `js/tipoLiquidacion.js` | `tipoLiquidacion` | Menú inicial, `CONFIG` por modo y `aplicarModoUI`; guarda el modo en `window.__sgtriTipoLiquidacion` | serializacionDatos, pdfGen, resultadoLiquidacion, uiAjustes… |
| `js/cogeDatosDesp.js` | `cogeDatosDesp` | Pasa del DOM de una ficha a un objeto normalizado (`collectDataFromFicha`, :245-298) | calculoDesp |
| `js/calculoDesp.js` | `calculoDesp` | MOTOR puro (`calculateDesplazamiento`, :857-907) y WRAPPER `calculaDesplazamientoFicha` (:1382-1537) | logicaDesp, formLogic, uiDesplazamientos, salidaDesp |
| `js/logicaDesp.js` | `logicaDesp` | Listeners delegados en `#desplazamientos-container` que disparan el recálculo, visibilidad de fronteras y ticket de cena | main:149, serializacionDatos, uiDesplazamientos |
| `js/salidaDesp.js` | `salidaDesp` | Plantillas HTML del resultado por ficha y checkbox "justificar pernocta" | calculoDesp:1479 |
| `js/resultadoLiquidacion.js` | `resultadoLiquidacion` | Registro `__sgtriTotales`, `calcularResultado` (:390-480) y `renderResultado` | calculoDesp, AECC, uiAjustes, serializacionDatos, uiImputacion |
| `js/main.js` | — | Acordeón e inicialización de 3 módulos | — |
| `js/formLogic.js` | `formLogic` (`parseNumber`, `validarDatos`, `limpiarFormularioCompleto`), `computeDescuentoManutencion` | Orquestador: carga de `datos.json`, saneado y validación globales, "Comprobar datos", borrado de secciones, descuento de comidas de congreso | pdfGen:2426, serializacionDatos |
| `js/pdfGen.js` | `pdfGen` (`init`, `preview`, `PDF_CONFIG`, `obtenerDatosFormulario`) | Construye el `docDefinition` de pdfmake y lo abre en una pestaña | botón `#btn-generar-pdf` |

## 4. Cómo se comunican

- **Llamadas directas a globales**, casi siempre con `?.` defensivo, p. ej. `window.resultadoLiquidacion?.renderResultado?.()`.
- **Eventos DOM delegados.**
  - Cada módulo escucha en su contenedor: `#desplazamientos-container` (logicaDesp), `#otros-descuentos-container` (resultadoLiquidacion:757-761) e `#imputacion-container` (uiImputacion).
  - formLogic escucha en `document`.
  - Algunos módulos disparan `change` a mano para provocar cascadas, p. ej. `aplicarRestriccionesProyectoPorTipo` en `tipoLiquidacion.js:94-139`.
- **Estado compartido en `window`:**
  - `__sgtriDatos`: catálogo de `datos.json`.
  - `__sgtriTipoLiquidacion`: modo actual.
  - `__sgtriTotales`: importes consolidados (ver DATA_MODEL §4).
  - `__tempMapeoDesplazamientos`: estado temporal mientras se carga un `.dta`.
- **Un `MutationObserver`** vigila el atributo `value` del input oculto `#descuento-manut-congreso` (`resultadoLiquidacion.js:747-754`), que escribe `formLogic.computeDescuentoManutencion`.

## 5. Flujo típico de extremo a extremo

1. **Elegir modo.** Con un clic en `#btn-inicio-despl|congr|honor|aecc` se ejecuta `tipoLiquidacion.seleccionarTipo`. Este llama a `aplicarModoUI` (muestra u oculta secciones, fija el máximo de fichas, permite o no la ficha especial, restricción de proyecto en AECC) y después a `mostrarFormulario`.
2. **Añadir un desplazamiento.** El botón `#btn-add-desplazamiento` llama a `uiDesplazamientos.crearNuevoDesplazamiento`. Las fichas tienen ids crecientes que nunca se reutilizan, y sus campos son `fecha-ida-N`, `pais-destino-N`, etc.
3. **Editar un campo.**
   1. El `blur` global de formLogic formatea el valor y valida con `validaciones.handleFechaBlur`/`handleHoraBlur`.
   2. El `focusout` de logicaDesp ejecuta `setTimeout(recalcularFicha, 0)`, que llama a `handleFichaChange` (visibilidad de fronteras y ticket de cena, `dtInvalid`).
   3. Se llama a `calculoDesp.calculaDesplazamientoFicha(despEl)`.
4. **Calcular** (`calculoDesp.js:1382-1537`):
   1. `cogeDatosDesp.collectDataFromFicha` → `calcInput` → `calculateDesplazamiento` (cálculo canónico).
   2. Si el destino es internacional y tiene cruces: `buildSegmentInputs` + `calculateSegments` (tramos España-ida, país, España-vuelta).
   3. Residencia eventual, luego `buildSalidaData` → `salidaDesp.renderSalida`.
   4. `resultadoLiquidacion.registrarDesplazamiento(id, totales, detalles)` → `renderResultado()`.
5. **Resultado.** `calcularResultado` aplica descuentos por categoría, el descuento del congreso, inscripción, honorarios, ficha especial, el tope de financiación y el anticipo. Después pinta `#resultado-liquidacion-container` y llama a `uiImputacion.actualizar()`.
6. **Guardar.** `#btn-guardar-datos` → `serializacionDatos.exportarArchivo`, que pide el nombre con `showPrompt`, hace un `Blob` JSON y lo descarga con `<a download>` como `.dta`.
7. **PDF.** `#btn-generar-pdf` → `formLogic.validarDatos()`. Si hay errores, `showConfirm` pregunta si se continúa. Después se comprueba la fecha de firma y se llama a `pdfGen.preview()`:
   1. `obtenerDatosFormulario()` = `serializacionDatos.recopilarTodo()`.
   2. Carga de logos.
   3. `buildDocDefinition` → `pdfMake.createPdf(def).open()`, que abre el PDF en una pestaña nueva.

## 6. Decisiones de diseño (deducidas del código)

- **Sin build ni dependencias.** Se despliega copiando archivos estáticos; ver INTEGRATIONS §6.
- **Motor de cálculo puro separado del DOM.** Lo dice el comentario de cabecera de `calculoDesp.js:1-7`, que distingue entre MOTOR y WRAPPER.
- **Registro centralizado de totales.** Sirve para no leer importes del DOM (cabecera de `resultadoLiquidacion.js:1-10`).
- **Un único objeto serializado** que sirve a la vez para el `.dta` y para el PDF (`pdfGen.js:276-285`). Por eso el `.dta` incluye campos calculados (`datosCalculados`, `resultadoLiquidacion`) que nunca se restauran.
- **Tarifas en `datos.json`, indexadas por posición de país.** Hay dos tablas por normativa (`rd462_2002`, `decreto42_2025`). La normativa se deduce del tipo de proyecto (`normativasPorTipoProyecto.rd`).
- **El caso AECC está aislado.** Tiene su propio formulario y su propio cálculo, y solo comparte con el resto el registro de totales.
- **El modo de liquidación no se cambia en caliente.** Para cambiarlo hay que volver al menú (`#btn-home`), lo que borra el formulario.

## 7. Dudas / no verificado

- Nada se ha ejecutado en un navegador. El orden real de inicialización se ha deducido de la especificación de `defer`.
- `logicaDesp.init`, `resultadoLiquidacion.init` y `uiImputacion.init` se llaman antes de que llegue `datos.json`. No se ha comprobado que ninguno lo necesite en ese momento.
