# Estado del código

- **Fecha del análisis:** 2026-10-23 (actualizado el 2026-10-27).
- **Commit de referencia:** el último de `main` (los cambios descritos aquí están confirmados y publicados; el calendario de fechas entró en `ee4cf19` y los iconos Lucide en el commit siguiente).
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

## 3. Pendiente de revisar (decisión del usuario: revisar más a fondo más adelante)

1. **Mapeo de `evento-asociado` al cargar.** Si se borraron fichas antes de guardar, el congreso puede quedar asociado a otra ficha (`serializacionDatos.restaurarDesplazamientos`, clave `desp${id original}`).
2. **Pérdidas silenciosas al cargar un `.dta`:**
   - las fichas que superan el límite;
   - los valores de select que no existen;
   - los códigos de pago antiguos (`CuentaEsp`…).

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
  - el descuento de congreso en GNRAL con la ficha especial;
  - el fallo de `fetch(datos.json)` (por ejemplo, con `file://`);
  - la ausencia de tests.

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
