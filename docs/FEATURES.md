# Funcionalidades

Cada funcionalidad se describe con cuatro apartados: **Qué**, **Archivos**, **Flujo** y **Casos límite**. Las líneas son las del commit `c4dd894`. Los posibles bugs se detallan en STATUS.md.

## 1. Selección del tipo de liquidación (modo)

**Qué.** Un menú inicial (`#tipo-liquidacion-inicio`, `index.html:84-92`) permite elegir entre DESPL, CONGR, HONOR y AECC, o cargar un archivo.

**Archivos.** `js/tipoLiquidacion.js` (`CONFIG`, :29-35; `aplicarModoUI`, :174-228; `seleccionarTipo`, :252-292).

**Flujo.** Botón → `seleccionarTipo` → `aplicarModoUI` → `mostrarFormulario`. El modo queda en `window.__sgtriTipoLiquidacion`. Qué activa cada modo:

| Modo | Eventos | Honorarios | Desplazamientos | AECC | Máx. fichas | Ficha especial | Importe anticipado |
|---|---|---|---|---|---|---|---|
| DESPL | – | – | ✓ | – | `limites` (8) | – | – |
| CONGR | ✓ | – | ✓ | – | 1 | – | – |
| HONOR | – | ✓ | ✓ | – | 1 | – | – |
| AECC | – | – | – | ✓ | – | – | – |
| GNRAL | ✓ | ✓ | ✓ | – | `limites` | ✓ | ✓ |

**Casos límite.**
- Al modo **GNRAL** solo se llega con **Shift+clic** en "Liquidación de desplazamientos" (:259-262) o cargando un archivo GNRAL.
- `normalizarTipo` convierte cualquier valor desconocido en GNRAL (:39-46).
- En AECC se fuerza el tipo de proyecto "Reto AECC 70% Supervivencia" y el select queda deshabilitado (`aplicarRestriccionesProyectoPorTipo`). "Borrar todo" y borrar la sección Proyecto lo conservan (`limpiarSeccionProyecto`). Al salir de AECC, la opción se elimina del select.
- El modo no se puede cambiar sin volver al menú. `#btn-home`, el clic en el título o el clic en el logo de la cabecera piden confirmación y borran todo (`formLogic.js:216-243`). El clic en el logo solo actúa con un formulario abierto.
- La cabecera alterna las clases `portada-mode` y `formulario-mode`. El subtítulo `.app-title-sub` cambia según el modo (`TITULO_POR_TIPO` en `tipoLiquidacion.js`) y recupera el texto inicial al volver al menú.

## 2. Beneficiario y forma de pago

**Qué.** Datos personales, categoría y la forma de pago: cuenta española (CE), cuenta extranjera más SWIFT (CI) o tarjeta UEx (TJ).

**Archivos.**
- `js/uiPagos.js` (`renderPagoFields`): pinta los campos.
- `js/formLogic.js`: formateo en vivo (:496-537) y validación en el blur:
  - Tarjeta: entre 15 y 19 dígitos y algoritmo de Luhn (:873-919).
  - IBAN español: CCC con mod-11, o `ES` + mod-97 (:922-1023).
  - IBAN extranjero: mod-97 (:1026-1081).
  - SWIFT: 8 u 11 caracteres (:1084-1126).

**Flujo.** El `change` de `#tipo-pago` llama a `renderPagoFields` y el `blur` llama a la validación. Si el beneficiario coincide con el responsable del proyecto, los nombres se sincronizan (`aplicarCoincidenciaBeneficiarioResponsable`, `formLogic.js:43-70`).

**Casos límite.** La validación **solo avisa**: marca `.field-error` y muestra un icono, pero no bloquea.

## 3. Proyecto y normativa

**Qué.** Tipo de proyecto, responsable, orgánica y referencia. El tipo decide la normativa: RD 462/2002 para G24/I24/PEI/NAL y Decreto 42/2025 para el resto.

**Archivos.**
- `calculoDesp.getNormativa` (:223-228).
- `formLogic.actualizarTextoDecreto` (:119 y siguientes).
- El listener de `#tipoProyecto` (`formLogic.js:122-137`), que recalcula todas las fichas.

**Casos límite.**
- La orgánica debe empezar por `18.` (`formLogic.js:1392-1399`, `uiImputacion.js:105-108`).
- El texto estático de `index.html:215` dice "Decreto 42/2005", pero la JS lo sobrescribe con 42/2025 cuando carga `datos.json`.

## 4. Desplazamientos normales (fichas)

**Qué.** Hasta `limites.maxDesplazamientos` fichas. Cada una tiene:
- fechas y horas de ida y regreso, origen, destino y país;
- cruces de frontera, si el destino es internacional;
- km, alojamiento y motivo;
- un "no manutención";
- otros gastos (hasta 10 líneas).

Calcula la manutención, las noches, el máximo de alojamiento, el kilometraje y el IRPF sujeto.

**Archivos.** `uiDesplazamientos.js`, `logicaDesp.js`, `validaciones.js`, `cogeDatosDesp.js`, `calculoDesp.js` y `salidaDesp.js`.

**Flujo.** Ver ARCHITECTURE §5.

**Reglas principales** (`calculoDesp.js`; constantes en :368-372, con 14:00 comida, 16:00 fin de comida, 22:00 cena, y 01:00 y 07:00 para la pernocta):

- **Mismo día** (`calcManutencionesSameDay`, :379-400):
  - Media dieta de cena si se regresa después de las 22:00. Con RD hace falta además `ticketCena`.
  - Media dieta de comida si se sale antes de las 14:00 y se regresa después de las 16:00.
  - Con RD, si el viaje dura menos de 5 h solo puede contar la cena.
- **Varios días** (`calcManutencionesSeveralDays`, :407-435):
  - Día de salida: 1 si se sale antes de las 14:00, 0,5 si se sale antes de las 22:00, y 0 en otro caso.
  - Días intermedios: 1 cada uno.
  - Día de regreso: 1 si cuenta la cena, 0,5 si se regresa después de las 14:00, y 0 en otro caso.
- **Noches** (`calcNoches`, :532-609; `evalLastNightByHour`, :487-502):
  - La última noche cuenta si se regresa a las 07:00 o más tarde.
  - No cuenta si se regresa a la 01:00 o antes.
  - Entre las 01:01 y las 06:59 el caso es **ambiguo**: aparece el checkbox "justificar pernocta" (`salidaDesp.js:240-243`) y la noche solo cuenta si se marca.
- **Alojamiento.** El máximo es noches × precio por noche. El importe del usuario entra entero en el total y, si supera el máximo, solo se muestra un aviso en rojo.
- **Km.** km × `kmTarifas[vehiculo-tipo]`, con 0,26 €/km por defecto. El tipo de vehículo es **uno solo para toda la liquidación**. La ficha de vehículo aparece en cuanto alguna ficha tiene km > 0 (`uiDesplazamientos.js:174-192`).
- **Internacional con cruces** (`buildSegmentInputs`, :1046-1179). Se divide en tramos "España (ida)", país y "España (vuelta)". El día del cruce de ida se paga a tarifa extranjera y el del cruce de vuelta a tarifa española.
- **Residencia eventual.** Se aplica si el regreso es posterior a la ida más 1 mes (España) o más 3 meses (extranjero), contando de fecha a fecha. Si el mes de vencimiento no tiene ese día, cuenta el último día del mes: 31/01 + 1 mes = 28/02. Aplica un factor 0,8 a la manutención y al máximo de alojamiento (`isResidenciaEventual`, `sumarMesesNaturales`).
- **IRPF.** Por cada día, se toma como sujeto lo que excede el límite exento de `limitesIRPF`. El último día, y el penúltimo si no hubo pernocta, usa el límite bajo (`calcIRPF`, :658-723).

**Casos límite.**
- Si las fechas no son válidas, o hay cualquier `.field-error` en la ficha, la manutención y el alojamiento se ponen a 0 (:1429-1442). El kilometraje sí se calcula.
- El ticket de cena solo aparece en proyectos RD 462/2002 (los de `normativasPorTipoProyecto.rd`: G24/I24/PEI/NAL) con regreso después de las 22:00 (`logicaDesp.shouldShowTicketCena`, `uiDesplazamientos.actualizarTicketCena`, ambos con `utils.getNormativa`).
- Los ids de las fichas no se reutilizan. El número visible se renumera de forma secuencial (:589-609).
- Eliminar una ficha pide confirmación y la quita del registro de totales (:661-705).

## 5. Desplazamiento especial (solo GNRAL)

**Qué.** Una ficha libre con líneas de tipo `seccion` (solo título) o `normal` (descripción, importe × cantidad = total), con IRPF introducido a mano.

**Archivos.** `js/uiDesplazamientoEspecial.js`; se crea con Shift+clic en `#btn-add-desplazamiento` (`uiDesplazamientos.js:860-878`).

**Flujo.** `calcularResultado` la lee con `getDatosParaLiquidacion()` (:813-865) y no pasa por `__sgtriTotales`.

**Casos límite.**
- Le afecta el tope de financiación, pero no los descuentos de ajustes (`resultadoLiquidacion.calcularResultado`).
- Si se sale de GNRAL se elimina (`tipoLiquidacion.js:210-214`).

## 6. Desplazamiento AECC

**Qué.** Un formulario propio (`#form-aecc-desplazamiento`) con tarifas fijas de `datosAECC`:
- Comidas sueltas del primer y del último día, elegidas en selects.
- Días intermedios a dieta completa.
- Máximo de alojamiento distinto en España (normal o de alta ocupación) y en el extranjero.

**Archivos.** `js/uiDesplazamientoAecc.js` (`calcularDatosResultadoAecc`, :579-676; reglas de madrugada, :222-253).

**Flujo.** Los cambios llaman a `renderResultado` del módulo. `syncResultadoLiquidacionAecc` (:703-741) registra el resultado en `__sgtriTotales` con la clave `'aecc'`.

**Casos límite.**
- Si se regresa entre las 00:00 y la 01:00, no hay pernocta.
- Si se regresa entre las 01:01 y las 06:59, tampoco hay pernocta salvo que se marque "justifica pernocta". En ese caso las comidas del último día pasan a `NONE` y se resta una noche.
- El comentario de cabecera dice que el módulo no interactúa con resultadoLiquidacion; **es falso**.

## 7. Congresos (eventos) y honorarios

**Qué.**
- **Evento:** nombre, lugar, fechas, gastos de inscripción, comidas incluidas y desplazamiento asociado.
- **Honorarios:** importe, tipo de beneficiario, situación, concepto y domicilio. En el PDF añaden una autodeclaración.

**Archivos.**
- `formLogic.computeDescuentoManutencion` (expuesta en `window`): calcula el descuento por las comidas incluidas (media manutención del país por comida), que se escribe en el input oculto `#descuento-manut-congreso`, y registra el congreso con `resultadoLiquidacion.registrarCongreso` (ficha asociada, fechas y comidas).
- `resultadoLiquidacion` (MutationObserver sobre el input oculto) y `pdfGen` (:831-965, :1647-1737).

**Comidas e IRPF.** El descuento de las comidas reduce la manutención, pero **no** el importe sujeto, salvo las comidas que caen en días con retención:
- `resultadoLiquidacion.getDiasRetencionCongreso` busca, en el desglose diario de la ficha asociada (`diasIrpf`), los días con sujeto > 0 dentro de las fechas del congreso.
- Si hay alguno, `formLogic.actualizarPreguntaComidasRetencion` muestra `#comidas-retencion-row`: "De estas comidas incluidas en el congreso, ¿cuántas corresponden al día dd/mm/aa?" (o "a los días …, … o …"). Si no hay, la oculta y la pone a 0.
- Cada comida de esos días descuenta media manutención de su día (como mucho, las medias que tenga) y el sujeto del día se recalcula (`calcularReduccionIrpfCongreso`). Con varios días, las comidas se reparten de una en una por orden de fecha y, tras el último día, se vuelve a empezar por el primero.
- Al cargar un `.dta`, el valor se restaura después de recalcular las fichas (`restaurarTodo`, paso 6.1), porque antes la pregunta está oculta.

**Casos límite.**
- Con varias fichas, el usuario elige la ficha asociada en `#evento-asociado` (valores `despN` por posición entre las fichas normales, `uiDesplazamientos.js:627-647`). `formLogic.getDesplazamientoAsociadoEvento` resuelve la ficha y no cuenta la ficha especial.
- Las fechas del evento admiten ±4 días respecto al desplazamiento (`formLogic.js:751-760`), aunque el tooltip de `index.html:483` dice otra cosa.
- El precio de manutención se busca con el `selectedIndex` del país. Si no se encuentra, vale 0 y no hay descuento.

## 8. Ajustes (descuentos, financiación máxima y anticipo)

**Qué.**
- Hasta 5 líneas de descuento. "Descontar de": Manutención (MNT), Alojamiento (ALJ), Kilometraje (KLM), Honorarios (HON), Inscripción en Congreso (INS) y Otros gastos (OTR).
- Un tope de "financiación máxima".
- Un "importe anticipado", solo en GNRAL.

**Archivos.** `js/uiAjustes.js`, `resultadoLiquidacion.js` (`calcularResultado`).

**Casos límite.**
- HON solo se ofrece si hay sección de honorarios (HONOR y GNRAL) e INS si la hay de congresos (CONGR y GNRAL): `uiAjustes.tipoDescuentoDisponible`, según `tipoLiquidacion.getConfig()`.
- HON resta de los honorarios y también del importe sujeto (los honorarios están siempre sujetos). INS resta de la inscripción y no afecta al IRPF.
- MNT resta de la manutención, pero del importe sujeto solo resta la parte que el usuario asigna a los días con retención. Si hay descuentos MNT y días con retención (de cualquier ficha normal), aparece `#manut-retencion-row`: "Del descuento en manutención, ¿qué importe corresponde al día dd/mm/aa?" (o "a los días f1, f2 o f3?"). El importe se limita al total MNT, se divide a partes iguales entre las fechas y cada parte se resta del sujeto de su día (sin bajar de 0), después de las comidas del congreso (`resultadoLiquidacion.calcularReduccionIrpfManutencion`). Al ocultarse, el campo se vacía (`uiAjustes.actualizarPreguntaManutencionRetencion`).
- Ya no hay descuento del total (TOT). Las líneas TOT de un `.dta` antiguo se ignoran al cargarlo.
- Fuera de GNRAL, el campo del anticipo se oculta **y se vacía** (`uiAjustes.actualizarVisibilidadImporteAnticipado`). Tampoco se guarda en el `.dta` (`recopilarAjustes`).

## 9. Resultado de la liquidación

**Qué.** Un resumen consolidado en `#resultado-liquidacion-container`.

**Archivos.** `js/resultadoLiquidacion.js`.

**Cálculo** (`calcularResultado`):
1. Neto de cada categoría = max(0, total − sus descuentos), incluidos honorarios (HON) e inscripción (INS). A la manutención se le resta también el descuento del congreso.
2. `totalAntesFinanciacion` = suma de netos + ficha especial.
3. Si la financiación máxima es menor, `totalLiquidacion` pasa a ser ese tope.
4. `irpfTotal` = max(0, sujeto de desplazamientos − reducción por comidas del congreso en días con retención − reducción por la parte de los descuentos MNT asignada a días con retención + honorarios netos + IRPF de la ficha especial − recorte por financiación máxima).
5. `importeImputar` = total − anticipo.

**Casos límite.** Si no hay contenido, `renderResultado` sale antes de tiempo (:645-648) y no actualiza la imputación.

## 10. Imputación a orgánicas

**Qué.** Reparte `importeImputar` en un máximo de 4 líneas (orgánica, responsable, importe). La línea principal es de solo lectura y vale total − suma de las adicionales.

**Archivos.** `js/uiImputacion.js` (`actualizarLineaPrincipal`, `onImporteBlur`, `renderLineas`).

**Casos límite.**
- Si las líneas adicionales suman el total o más, se ponen a 0.
- Un importe adicional mayor o igual que el restante se resetea a 0 sin avisar.
- El botón "+" se oculta al llegar a `maxLineasImputacion`, también después de cada repintado.
- Si el total baja a 0, la línea principal se actualiza a 0 (`renderResultado` llama a `uiImputacion.actualizar` también sin contenido).

## 11. Guardar y cargar datos (`.dta`)

**Qué.** Exporta e importa el estado completo; ver DATA_MODEL §2.

**Archivos.** `js/serializacionDatos.js` (`exportarArchivo`, `importarArchivo`, `restaurarTodo`, `abrirDialogoImportar`, `mensajeFalloCarga`, `extraerDatosDePdf`).

**Cargar desde un PDF.** "Cargar" admite también un `.pdf` generado por la app: `extraerDatosDePdf` lee la clave `SgtriDta` de sus metadatos (ver §12) y el objeto resultante sigue el mismo flujo que un `.dta`. Si el PDF no la tiene: "Este PDF no contiene datos del formulario…".

**Flujo de carga.**
1. Si la versión de esquema es distinta, se carga igualmente (solo un aviso en la consola).
2. Se normaliza el modo.
3. **Tipo distinto al del formulario abierto.** Desde el menú inicial no hay conflicto. Un formulario GNRAL abierto admite cualquier archivo salvo AECC: lo carga completo y sigue siendo GNRAL. En los demás casos aparece un diálogo (`confirmDialog.showChoice`):
   - Icono ⚠️ y texto centrado: *"El archivo corresponde a una liquidación de «Honorarios», / pero la liquidación actual es de «Desplazamientos»."* Debajo, la pregunta *"¿Cómo quiere que se carguen los datos?"* con el estilo `desplazamiento-titulo`.
   - Dos opciones de radio en recuadros (borde verde, *hover* `--color-primary-hover`), alineadas a la izquierda:
     - **"Seguir en la liquidación actual y cargar solamente los datos de beneficiario y proyecto."**: primera y marcada por defecto. Carga parcial: también copia la forma de pago, aunque el texto no lo diga. Si interviene AECC, dice "…de beneficiario." y no carga el proyecto. El resto del formulario no se toca, y los valores del archivo sustituyen a los actuales aunque estén vacíos.
     - **"Abrir como liquidación de «X» y cargar todos los datos (se sustituirán los datos actuales)."**: cambia de tipo y hace una carga completa.
   - Botones **Aceptar** (verde, `btn-message-ok`) y **Cancelar** (gris, `btn-confirm-no`), alineados a la derecha. Cancelar, Escape o clic fuera: no se carga nada. Enter sobre una opción equivale a Aceptar.
   - Nombres de tipo en los diálogos: Desplazamientos, Congresos, Honorarios, AECC, General (`obtenerNombreTipoLiquidacion`).
4. Comprobaciones de compatibilidad:
   - CONGR/HONOR con más de 1 ficha;
   - AECC con fichas normales;
   - AECC en modos que no lo admiten;
   - ficha especial fuera de GNRAL.
5. Carga completa:
   1. `aplicarModoDesdeArchivo`, luego limpiar el formulario y restaurar sección a sección, en orden y sin esperas. "Justificar pernocta" se marca después de calcular su ficha.
   2. Mostrar y restaurar el vehículo, y después `logicaDesp.recalcularTodas()`.
   3. Restaurar la imputación.
   4. `restaurarTodo` responde solo cuando todo ha terminado. Entonces aparece el modal (`showMessage`, el mismo de "Comprobar datos") con "Datos cargados correctamente." o el resumen de la carga parcial.

**Casos límite.**
- Si la carga falla (JSON inválido, archivo vacío o incompatible), se muestra el modal de error "Falló la carga de datos guardados." con el motivo. Si el usuario cancela, no se muestra nada. En la carga ya no queda ningún `alert()` ni `confirm()` nativo.
- Una ficha especial **sin líneas** (solo título o IRPF) no se restaura (`uiDesplazamientoEspecial.restaurarDatos`).
- `evento-asociado` (`despN`, posición de la ficha) se restaura tal cual, porque las fichas se recrean en el mismo orden.
- Las fichas que superan el límite y los valores de select inexistentes se pierden sin aviso; decidido no tratarlos (ver STATUS §4).

## 12. Generar el PDF

**Qué.** El PDF oficial A4 con pdfmake, que se abre en una pestaña nueva.

**Archivos.** `js/pdfGen.js` (`preview`, `cargarLogoCabecera`, `buildDocDefinition`, `nombreTipoOtroGasto`) y `js/pdfFonts.js`.

**Flujo.**
1. Se llama a `formLogic.validarDatos()`. Si hay errores, se pregunta si se quiere revisar o generar igualmente.
2. Se comprueba que la fecha de firma sea posterior a la de regreso; si no lo es, se bloquea (:212-231).
3. Se llama a `recopilarTodo()`, se cargan los logos y se hace `createPdf(def).open()`.

**Secciones del PDF:**
- cabecera;
- beneficiario y vehículo;
- proyecto e imputación;
- honorarios;
- una tabla por desplazamiento (con tramos si es internacional);
- AECC;
- ficha especial;
- congreso;
- comentarios;
- resultado (si es mayor que 0);
- tabla de IRPF (si es mayor que 0);
- autodeclaración de honorarios;
- pie con firmas (una o dos, según `beneficiarioCoincideResponsable`) y logos GR24 en proyectos G24/I24.

El título depende del modo (:81-122).

**Datos ocultos.** La última página termina con un bloque marcado que no dibuja nada, `/SgtriDta <</D (base64)>> BDC EMC`, con el mismo objeto que el `.dta` (`recopilarTodo()` → JSON → UTF-8 → base64, `serializacionDatos.codificarDatosParaPdf`). Lo escribe `pdfGen.incrustarDatosEnContenido`, que envuelve `_flushDoc` de pdfmake para usar `addContent` de pdfkit antes de cerrar. No se ve, no se imprime y no sale al buscar o copiar texto.

Como copia de reserva, los metadatos (`info`) llevan la clave `SgtriDta` con la misma cadena. pdfmake la escribe como objeto aparte (`/SgtriDta N 0 R`). Se ve en "Propiedades del documento → Personalizado" de algunos lectores.

Al cargar, `extraerDatosDePdf` (asíncrona) busca el bloque en claro; si no está, descomprime los streams Flate con `DecompressionStream`; y si tampoco, recurre a los metadatos (Info, o la copia en claro del XMP `<pdfx:SgtriDta>` que dejan Acrobat y Adobe PDF al comprimir el Info).

Probado el 2026-11-07 con PDF reales:

| Proceso | Bloque | Metadatos |
|---|---|---|
| Firma con Acrobat | se conserva | se conserva (en el XMP) |
| Informe de firma de la UEx (`vfirma`, iText): copia las páginas byte a byte | se conserva | se pierde |
| Imprimir con "Adobe PDF" (Distiller): rehace las páginas | se pierde | se conserva (en el XMP) |
| "Microsoft Print to PDF" | se pierde | se pierde |

**Casos límite.**
- Nunca se descarga el PDF directamente: siempre se abre en una pestaña nueva.
- Si no carga ningún logo, se usa una imagen vacía (`IMAGEN_VACIA`, PNG transparente de 1×1) y el PDF se genera igualmente.
- Los nombres de "otros gastos" salen del catálogo de `datos.json`, más "ICG" de AECC (`uiDesplazamientoAecc.getCatalogoOtrosGastos`).

## 13. Utilidades de UI

- **Acordeón de secciones accesible** (`main.js:44-130`).
- **"Comprobar datos"** (`#btn-comprobar-datos`, `formLogic.validarDatos`): marca los campos obligatorios y abre las secciones afectadas.
- **Borrar sección** (`.btn-clear-section`, `formLogic.js:2018-2029`) y **borrar todo** (`limpiarFormularioCompleto`).
- **Modales de `confirmDialog.js`:** `showConfirm`, `showPrompt` (admite `confirmClass` y `cancelClass`), `showChoice` (icono, mensaje centrado, `pregunta` opcional, opciones de radio y Aceptar/Cancelar) y `showMessage` (mensaje con Aceptar, ✅ o ⚠️; lo usan "Comprobar datos" y la carga de `.dta`). Todos escapan el texto y convierten `\n` en `<br>`; `showMessage` admite `{ html: true }` para HTML fijo del programa (lo usa el aviso de plazo de presentación).
- **Fecha de firma:** con o sin fecha fija, mediante radios (`formLogic.js:240-263`).
- **Calendario en los campos de fecha** (`js/calendarioFechas.js`): un icono dentro de cada `.input-fecha` abre el calendario nativo del navegador (`showPicker()` sobre un `<input type="date">` oculto, uno por campo). El campo sigue siendo de texto, sin listeners nuevos, y el botón está fuera del tabulador (`tabindex="-1"`), así que **la escritura con teclado no cambia**. Abre en la fecha del campo o, si está vacío, en la primera fecha de la misma ficha. Al elegir, escribe `dd/mm/aa` y da y quita el foco al campo, con lo que valida y recalcula igual que al teclear. Se añade también a los campos creados después (`MutationObserver`). En navegadores sin `showPicker()` no aparece. Los campos de hora no llevan selector, a propósito.
- **Aviso de plazo de presentación** (`validaciones.avisarPlazoPresentacion`, art. 32.8 de las Normas de Ejecución Presupuestaria de la UEx): al salir de un campo de fecha de regreso (`fecha-regreso-N` o `aecc-fecha-regreso`), si hoy es posterior al fin del plazo se muestra un modal de aviso (`showMessage`, error) que recuerda el plazo de 45 días naturales tras el desplazamiento (texto con negrita y cursiva, `{ html: true }`). El plazo son 45 días naturales desde el día siguiente al regreso, sin contar los días de agosto (`finPlazoPresentacion`). Solo avisa una vez por valor (`data-aviso-plazo`). No avisa al cargar un `.dta` (no hay blur) ni bloquea nada: es solo informativo.

## 14. Dudas / no verificado

- El usuario confirmó el 2026-10-23 que son correctos: el cruce de vuelta a tarifa española, la residencia eventual internacional sobre todo el viaje y el alojamiento sin tope en el total. El resto de reglas no se ha contrastado con `Normativas/`.
- No se ha probado si los bloqueadores de ventanas emergentes impiden el `.open()` del PDF después de varios `await`.
