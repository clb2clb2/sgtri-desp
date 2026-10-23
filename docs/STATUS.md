# Estado del código

- **Fecha del análisis:** 2026-10-23
- **Commit base:** `c4dd894` (`git rev-parse --short HEAD`), rama `main`.
- **Cambios del 2026-10-23 sin commit sobre ese commit:**
  - Se recuperó el trabajo de "portada" de `stash@{0}`.
  - Se corrigieron bugs, lógica duplicada y código muerto (§2).
  - `datos_ejemplo.js` y `Prueba salida PDF *.docx` se sacaron del repositorio (§5).
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

1. **IRPF del tramo "España (ida)".** El último día en España usa el exento bajo (26,67 en vez de 53,34), porque el tramo termina a las 00:00 y se interpreta como "sin pernocta" (`calculoDesp.calcIRPF`).
2. **Mapeo de `evento-asociado` al cargar.** Si se borraron fichas antes de guardar, el congreso puede quedar asociado a otra ficha (`serializacionDatos.restaurarDesplazamientos`, clave `desp${id original}`).
3. **Pérdidas silenciosas al cargar un `.dta`:**
   - las fichas que superan el límite;
   - los valores de select que no existen;
   - los códigos de pago antiguos (`CuentaEsp`…).
4. **Restauración con `setTimeout` encadenados** (50/100/120×10/150/300 ms) en lugar de eventos (`serializacionDatos.restaurarTodo` y funciones auxiliares). Es la parte más frágil de la app.
5. **DNI, IBAN y tarjeta se guardan en claro** en el `.dta`.

## 4. Decidido / sin acción

- **El usuario confirma que es correcto según la normativa:**
  - el día del cruce de vuelta se paga a tarifa española;
  - la residencia eventual en viajes internacionales se mide sobre todo el viaje;
  - el alojamiento por encima del máximo entra entero en el total, solo con un aviso.
- **Ignorados por decisión del usuario:**
  - el listener de cambio de país que usa el contador global (`uiDesplazamientos.js`, `manejarCambioPais(desplazamientoCounter)`);
  - el tooltip de las fechas del congreso;
  - el viaje internacional de un solo día;
  - el descuento de congreso en GNRAL con la ficha especial;
  - el fallo de `fetch(datos.json)` (por ejemplo, con `file://`);
  - la ausencia de tests.

## 5. Datos personales

- `datos_ejemplo.js` y `Prueba salida PDF 0/1/2.docx` se han sacado del índice de git (`git rm --cached`). Las copias locales siguen en disco y se han añadido a `.gitignore`.
- **Siguen en el historial de git y en el remoto** (`github.com/clb2clb2/sgtri-desp`), y también en `stash@{0}`. Para borrarlos de verdad haría falta reescribir el historial (p. ej. `git filter-repo`) y hacer *force push*. No se ha hecho.

## 6. Partes frágiles y deuda técnica restante

- **Archivos grandes con varias responsabilidades:** `pdfGen.js`, `formLogic.js`, `calculoDesp.js`, `serializacionDatos.js` y `uiDesplazamientoAecc.js`.
- **Dependencia del orden de `<script>` y del estado global en `window`.** Desde 2026-10-23 los módulos usan `window.utils` y `window.limpiaDatos` **sin respaldo**, así que `utils.js` y `limpiaDatos.js` tienen que cargarse los primeros.
- **`MutationObserver` sobre el atributo `value`** de un input oculto como canal de comunicación (`resultadoLiquidacion.js`, `#descuento-manut-congreso`).
- **Diálogos mezclados.** La carga de archivos sigue usando `confirm()` y `alert()` nativos.
- **Criterios distintos de validación de fechas:** el motor permite regreso = ida, pero `logicaDesp` y `validaciones` lo rechazan.
- **Sincronía manual con `sgtri-desp-prod`.**

## 7. Dudas / no verificado

- Las pruebas automáticas se hicieron en Chrome. No se ha probado en Firefox ni Safari.
- Hosting real de prod: ver INTEGRATIONS §7.
