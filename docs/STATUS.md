# Estado del código

- **Fecha del análisis:** 2026-10-23 (actualizado el 2026-11-07).
- **Commit de referencia:** `9cb44aa` (el calendario de fechas entró en `ee4cf19`, los iconos Lucide en `9281709` y el aviso de plazo de presentación en `9cb44aa`). Los cambios marcados "2026-11-07" en §2 se confirmaron en el commit siguiente ("IRPF per-day discounts…").
- **Método:** lectura del código, más pruebas automáticas en Chrome headless que se ejecutan fuera del repositorio (§1).

## 1. Tests y calidad

- **El repositorio no tiene tests.** No hay `package.json`, framework de pruebas ni CI. El usuario ha decidido no añadirlos por ahora.
- **Validación de los cambios del 2026-10-23.** Se hizo con dos páginas de prueba que se sirven junto a la app. No se guardaron en el repositorio.
  1. **Comparación con `HEAD`.**
     - Motor `calculateDesplazamiento`: 5000 entradas aleatorias.
     - Wrapper DOM: 20 escenarios con 1–3 fichas, incluidas internacionales con tramos. Compara la salida, `calcularResultado`, el `.dta` y la definición completa del PDF.
     - Resultado: 0 diferencias, salvo los casos de residencia eventual con salida el día 29, 30 o 31, que cambian a propósito.
  2. **Pruebas funcionales de cada corrección.** Además, PDF real con pdfmake en los 5 modos e ida y vuelta guardar → cargar → guardar.
     - Resultado: 33/33 OK.
- No hay linter ni formateador configurados. `.vscode/extensions.json` solo recomienda ESLint y Prettier.

## 2. Corregido el 2026-10-23

| Qué | Dónde |
|---|---|
| Se dejó de guardar y restaurar `vehiculo.justificarPernocta`, que leía un id inexistente | `serializacionDatos.recopilarVehiculo` / `restaurarVehiculo` |
| Tarifas de respaldo a 0: si no hay tarifas, no se calcula. Antes eran 50,55 / 98,88 | `calculoDesp.getPrecios`, `formLogic.computeDescuentoManutencion` |
| Ticket de cena en proyectos I24. La lista RD sale ahora de `datos.json` | `utils.getNormativa`, usado en `logicaDesp.shouldShowTicketCena` y `uiDesplazamientos.actualizarTicketCena` |
| Comentario de cabecera falso del módulo AECC | `uiDesplazamientoAecc.js:1-7` |
| Si falla la carga de un `.dta`, se muestra "Falló la carga de datos guardados." con el motivo. `restaurarTodo` devuelve `{ok, cargaParcial, motivo?, cancelado?}`; si el usuario cancela la pregunta de versión, no hay mensaje | `serializacionDatos.mensajeFalloCarga`, `abrirDialogoImportar` |
| AECC: "Borrar todo"/borrar proyecto conserva "Reto AECC" | `formLogic.limpiarSeccionProyecto` |
| AECC: una carga parcial sobre un formulario AECC no toca el proyecto | `serializacionDatos.restaurarTodo` |
| AECC: la opción "Reto AECC" se elimina al salir del modo | `tipoLiquidacion.aplicarRestriccionesProyectoPorTipo` |
| Imputación: el botón "+" respeta el límite después de cada repintado, y `onAddLinea` lo comprueba | `uiImputacion.renderLineas`, `onAddLinea` |
| Imputación: se actualiza también cuando el total baja a 0 | `resultadoLiquidacion.renderResultado` |
| Anticipo: fuera de GNRAL se vacía, no se guarda en el `.dta` y el PDF no lo lee del campo crudo | `uiAjustes.actualizarVisibilidadImporteAnticipado`, `serializacionDatos.recopilarAjustes`, `pdfGen` (resumen de resultado) |
| `expandirSeccion` deja el acordeón en un estado coherente: quita `.collapsed` y actualiza ARIA | `formLogic.expandirSeccion` |
| Si no carga ningún logo, el PDF usa una imagen vacía (PNG transparente de 1×1) | `pdfGen.cargarLogoCabecera`, `IMAGEN_VACIA` |
| `confirmDialog` escapa todo lo que inserta en HTML, y `\n` → `<br>` | `confirmDialog.escapeHtml`, `mensajeHtml` |
| Residencia eventual a final de mes: los meses se cuentan de fecha a fecha (art. 5 del Código Civil). Antes, una salida el día 29, 30 o 31 se reconocía hasta 3 días tarde | `calculoDesp.sumarMesesNaturales`, `isResidenciaEventual` (sustituye a `monthsBetween`) |
| Acordeón: el primer clic en una sección podía abrirla en vez de cerrarla, porque `maxHeight` se calculaba con el formulario oculto. `toggle()` usa ahora solo la clase `.collapsed` | `main.js`, `toggle` |
| IRPF del tramo "España (ida)" en viajes internacionales: los días antes del cruce usaban el exento bajo (26,67) porque el corte técnico de las 00:00 se tomaba como un regreso de madrugada. Ahora se considera que hay pernocta. Ejemplo: Decreto, cruce un día después de salir → 26,67 € menos de IRPF sujeto (10,73 € con RD) | `calculoDesp.calcIRPF` (`isSpainOutboundSegment`) |
| Carga de `.dta` sin `setTimeout`. Antes había pausas fijas (50/100/120×10/150/300 ms) y el aviso de "cargado" aparecía ~400 ms antes de terminar. Ahora es síncrona y ordenada, y `restaurarTodo` responde al acabar | `serializacionDatos.restaurarTodo`, `restaurarPago`, `restaurarDesplazamientos`, `restaurarJustificaPernoctaDesplazamiento`, `restaurarVehiculo` |
| Cada clic en "Añadir línea" de la ficha especial lanzaba un error en consola: comparte la clase `btn-otros-gastos` con las fichas normales | `uiDesplazamientos` (delegación de clics) |
| Carga de `.dta` de otro tipo: la carga parcial incluye ahora la forma de pago; un formulario GNRAL abierto carga completo cualquier archivo salvo AECC; erratas del aviso ("liquidación") | `serializacionDatos.restaurarTodo`, `obtenerNombreTipoLiquidacion` |
| Carga de `.dta` de otro tipo: diálogo con tres opciones (abrir como el tipo del archivo / copiar solo datos comunes / cancelar); sin pregunta de versión de esquema; mensajes de éxito y error en modal, sin `alert()`/`confirm()` | `serializacionDatos.restaurarTodo`, `abrirDialogoImportar`, `confirmDialog.showChoice`, `showMessage` |
| "Borrar todo" vaciaba la ficha de vehículo sin avisar a `uiDesplazamientos`, así que no se volvía a crear: se perdía el vehículo al cargar un `.dta` sobre un formulario que lo mostraba, y no reaparecía al volver a poner km | `uiDesplazamientos.resetFichaVehiculo`, `formLogic.limpiarSeccionDesplazamientos` |
| Calendario nativo opcional en todos los campos de fecha (añadido el 2026-10-27), sin cambios en la escritura con teclado; los campos de hora no lo llevan, a propósito | `calendarioFechas.js`, `styles.css` (`.fecha-con-calendario`, `.btn-calendario`) |
| Iconos: los emojis (barra de acciones, "Generar PDF", diálogos, avisos de campo, flechas de la ficha especial) y la goma de "Borrar" se sustituyeron por iconos de Lucide v1.62.0 en un sprite SVG; un solo ayudante, `utils.iconoSvg` | `index.html` (sprite), `utils.iconoSvg`, `confirmDialog.iconoDialogoHtml`, `styles.css` (`.icono`) |
| Aviso modal al introducir una fecha de regreso fuera del plazo de presentación (45 días naturales sin agosto, art. 32.8 de las Normas de Ejecución Presupuestaria de la UEx); solo informativo | `validaciones.js` (`finPlazoPresentacion`, `avisarPlazoPresentacion`) |
| (2026-11-07) Al cerrar el aviso del plazo de presentación, el foco vuelve al campo al que iba el usuario (o a la fecha de regreso) | `validaciones.avisarPlazoPresentacion` |
| (2026-11-07) "Justifica pernoctación" se desmarca al desaparecer (regreso fuera de 01:01–06:59). Antes quedaba marcada en la ficha y el IRPF seguía contando la pernocta | `salidaDesp.setupJustificarPernocta` |
| (2026-11-07) Comidas del congreso e IRPF: el descuento por comidas ya no se resta del importe sujeto. Solo lo reducen las comidas que el usuario asigna a los días con retención dentro del congreso (pregunta nueva `#comidas-retencion-row`), recalculando el sujeto de esos días | `calculoDesp.calcIRPF` (fecha y precio por día), `resultadoLiquidacion` (`registrarCongreso`, `getDiasRetencionCongreso`, `calcularReduccionIrpfCongreso`), `formLogic` (`actualizarPreguntaComidasRetencion`) |
| (2026-11-07) Ajustes: se quita el descuento del total (TOT; las líneas TOT de `.dta` antiguos se ignoran) y se añaden Honorarios (HON, resta también del sujeto) e Inscripción en Congreso (INS, no afecta al IRPF), solo en los modos con esa sección. La financiación máxima sigue restando del sujeto. `versionEsquema` 26.11.1 | `datos.json`, `uiAjustes.tipoDescuentoDisponible`, `tipoLiquidacion.getConfig`, `resultadoLiquidacion.calcularResultado`, `serializacionDatos`, `pdfGen` |
| (2026-11-07) Descuentos de manutención (MNT) e IRPF: ya no se restan enteros del importe sujeto. Solo lo reduce la parte que el usuario asigna a los días con retención (pregunta nueva `#manut-retencion-row` en "Ajustes"), repartida a partes iguales entre esos días y aplicada después de las comidas del congreso | `resultadoLiquidacion` (`getDiasRetencion`, `calcularSujetosTrasCongreso`, `calcularReduccionIrpfManutencion`), `uiAjustes.actualizarPreguntaManutencionRetencion`, `serializacionDatos` (`ajustes.manutencionDiasRetencion`), `formLogic.limpiarSeccionAjustes` |
| (2026-11-07) Descuento por comidas con ficha especial: la ficha asociada se buscaba contando la especial, así que con una ficha normal y la especial el descuento salía 0. Estaba en "ignorados"; se corrigió al unificar la búsqueda de la ficha asociada | `formLogic.getDesplazamientoAsociadoEvento` |
| (2026-11-07) El PDF lleva oculto el contenido del `.dta` (bloque marcado `SgtriDta` al final de la última página, que no dibuja nada), y "Cargar" admite ese PDF para recuperar los datos. Probado con PDF reales: se conserva firmado con Acrobat y en el informe de firma de la UEx. Los metadatos (clave `SgtriDta` en `info`) llevan una copia de reserva, que se usa si el bloque falta: el informe de la UEx descarta los metadatos, pero "Adobe PDF" rehace las páginas y los conserva. "Microsoft Print to PDF" pierde ambos | `pdfGen.incrustarDatosEnContenido`, `pdfGen.buildDocDefinition` (`info`), `serializacionDatos.codificarDatosParaPdf`, `extraerDatosDePdf`, `importarArchivo` |
| (2026-11-07) Mapeo de `evento-asociado` al cargar: el valor guardado (`despN`, posición de la ficha) se traducía como si fuera el id de la ficha, así que si se habían borrado fichas antes de guardar el congreso podía quedar asociado a otra. Ahora se restaura tal cual | `serializacionDatos.restaurarDesplazamientos`, `restaurarEvento` (se elimina `__tempMapeoDesplazamientos`) |

**Lógica duplicada unificada:**
- `utils.getNormativa`, que antes estaba en 5 sitios.
- `utils.esPaisInternacional`, antes en 6.
- `utils.ordenCrucesValido`, antes en 3.
- `parseNumber`, `fmt`, `round2` y `fmtPrecio`, que ahora delegan siempre en `utils`; `round2` admite cadenas.
- El parseo de fechas y horas, que ahora delega siempre en `limpiaDatos`.
- `limpiaDatos.ibanMod97Valido`.
- `uiDesplazamientos.construirLineaOtroGasto`, compartida con AECC.
- La lectura de líneas de la ficha especial (`leerLineasResultado`).
- Los nombres de "otros gastos" del PDF, que ahora salen del catálogo (`nombreTipoOtroGasto`).
- `tipoLiquidacion.TITULO_POR_TIPO`, que ahora también usa el PDF.
- Las reglas de manutención del día de ida y de regreso (`unidadesDiaIda`, `unidadesDiaRegreso`).
- `LIMITES_IRPF_POR_DEFECTO`.
- El formateo de la tarjeta, que se hacía dos veces.

**Código muerto eliminado:**
- `pdfGen.generar`.
- `confirmDelete` y `confirmAction`.
- `utils.throttle`, `getSgtriDatosSection` y `logger`.
- El cálculo inicial de `main.js`.
- El CASO 3 de `calcNoches` y el flag `comesFromPreviousDay`.
- `nonFinalAssumeCena`.
- El bloque inalcanzable de tramos con fechas inválidas.
- `exclusiones` en `salidaData`.
- En `salidaDesp`: `getDescuentoCongreso`, `calcIrpfAjustado`, `sumLegacyTotals` y `convertLegacyToUnified`.
- `logicaDesp.shouldShowJustificarPernocta`.
- `validaciones.init`.
- `restaurarResultadoLiquidacion`.
- Los listeners vacíos.
- Un reseteo duplicado de la ficha especial.
- La rama `resultado === true`.
- El alias `'congresos'`.
- Variables y parámetros sin uso.

## 3. Pendiente de revisar

Nada pendiente. El mapeo de `evento-asociado` se corrigió el 2026-11-07 (§2) y las pérdidas silenciosas al cargar se descartaron (§4).

## 4. Decidido / sin acción

- **El usuario confirma que es correcto según la normativa:**
  - el día del cruce de vuelta se paga a tarifa española;
  - la residencia eventual en viajes internacionales se mide sobre todo el viaje;
  - el alojamiento por encima del máximo entra entero en el total, solo con un aviso.
- **DNI, IBAN y tarjeta en claro en el `.dta`: se mantiene así (decisión del 2026-10-23).** Usan el formulario los beneficiarios y sus gestores, que ya tienen acceso a los datos de los investigadores, y volver a teclearlos o usar contraseñas no compensa.
- **Ignorados por decisión del usuario:**
  - el listener de cambio de país que usa el contador global (`uiDesplazamientos.js`, `manejarCambioPais(desplazamientoCounter)`);
  - el tooltip de las fechas del congreso;
  - el viaje internacional de un solo día;
  - el fallo de `fetch(datos.json)` (por ejemplo, con `file://`);
  - la ausencia de tests;
  - las pérdidas silenciosas al cargar un `.dta` (fichas por encima del límite, valores de select que no existen, códigos de pago antiguos como `CuentaEsp`): no hay archivos guardados en esas condiciones (decisión del 2026-11-07).

## 5. Datos personales

- `datos_ejemplo.js` y `Prueba salida PDF 0/1/2.docx` están fuera del repositorio y en `.gitignore`. Las copias locales siguen en disco.
- **El historial se reescribió el 2026-10-23** con `git filter-repo` en `sgtri-desp` y `sgtri-desp-prod`, y se subió con *force push*. Se eliminaron esos archivos, los temporales de Word (`~$…`, `~WRL*.tmp`, también en `.gitignore`) y un nombre y un DNI de ejemplo que había en una versión antigua de `pdfGen.js`.
- GitHub puede conservar un tiempo los commits antiguos, accesibles por su SHA directo. Para eliminarlos del todo hay que pedirlo a su soporte.

## 6. Partes frágiles y deuda técnica restante

- **Archivos grandes con varias responsabilidades:** `pdfGen.js`, `formLogic.js`, `calculoDesp.js`, `serializacionDatos.js` y `uiDesplazamientoAecc.js`.
- **Dependencia del orden de `<script>` y del estado global en `window`.** Desde 2026-10-23 los módulos usan `window.utils` y `window.limpiaDatos` **sin respaldo**, así que `utils.js` y `limpiaDatos.js` tienen que cargarse los primeros.
- **`MutationObserver` sobre el atributo `value`** de un input oculto como canal de comunicación (`resultadoLiquidacion.js`, `#descuento-manut-congreso`).
- **Criterios distintos de validación de fechas:** el motor permite regreso = ida, pero `logicaDesp` y `validaciones` lo rechazan.
- **Una ficha especial sin líneas** (solo título o IRPF) no se guarda al recargar: `uiDesplazamientoEspecial.restaurarDatos` la ignora. Ya era así antes; está sin decidir.
- **Sincronía manual con `sgtri-desp-prod`.**

## 7. Dudas / no verificado

- Las pruebas automáticas se hicieron en Chrome. No se ha probado en Firefox ni Safari.
