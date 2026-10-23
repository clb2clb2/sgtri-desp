# Modelo de datos

**No hay base de datos.** Los datos viven en cuatro sitios:

| Qué | Dónde | Quién lo escribe / lee |
|---|---|---|
| Catálogos, límites, tarifas, versión de esquema | `assets/data/datos.json` (estático) → `window.__sgtriDatos` | `formLogic.js:76-83` lo carga; lo leen el motor, la UI y AECC |
| Estado del formulario de un usuario | Archivo `.dta` (JSON) que el usuario descarga y vuelve a subir | `serializacionDatos.recopilarTodo` / `restaurarTodo` |
| Estado vivo | El DOM (inputs) + variables de módulo (contadores, `lineasImputacion`, `datosAecc`…) | Cada módulo UI |
| Importes consolidados | `window.__sgtriTotales` | `resultadoLiquidacion.js:42-55` |

No se usa `localStorage`, `sessionStorage` ni IndexedDB. Un grep en `js/` no da ninguna coincidencia.

## 1. `assets/data/datos.json`

Las listas son pares `[etiqueta, código]`. Al rellenar un select, el código es el `value` de cada opción (`formLogic.js:86-116`).

| Clave | Contenido | Uso |
|---|---|---|
| `versionEsquema` | `"26.10.2"` | `serializacionDatos.inicializar`. Se escribe en el `.dta` y se compara al cargarlo |
| `limites` | `maxDesplazamientos` (8), `maxOtrosGastosPorDesplazamiento` (10), `maxOtrosDescuentos` (5), `maxLineasImputacion` (4) | uiDesplazamientos, uiAjustes, uiImputacion, AECC. Valores por defecto en código si falta el objeto: 6/10/5/4 |
| `categorias` | 13 categorías del beneficiario (IP, ME, DC…) | Select `#categoria`. **El motor no lo usa**; solo se guarda y se imprime |
| `pagos` | CE (cuenta española), CI (extranjera), TJ (tarjeta UEx) | `#tipo-pago` → uiPagos |
| `tiposProyecto` | UEX, G24, I24, PEI, PCO, NAL, JEX | `#tipoProyecto` → normativa |
| `otrosGastos` | AVN, PJE, TAX, PRK, TRF, INS, ALQ, SAC, SME, TTR, TAG, OTR | Select de otros gastos. AECC añade `ICG` "Inscripción Congreso" (`uiDesplazamientoAecc.js:450-462`) |
| `otrosDescuentos` | TOT, MNT, ALJ, KLM, OTR | Descuentos de ajustes por categoría |
| `kmTarifas` | `coche` 0.26, `motocicleta` 0.106 €/km | `calculoDesp.getKmTarifa` (:954-959), según el radio global `vehiculo-tipo` |
| `dietasPorPais.paises` | 99 países; índice 0 = España, último = "Resto del mundo" | Select de país (sin placeholder). **El índice del select es el índice en las tablas** |
| `dietasPorPais.decreto42_2025` / `.rd462_2002` | `alojamiento[99]`, `manutencion[99]` (€/día y €/noche) | `calculoDesp.getPrecios`. Si no hay tabla o tarifa, el respaldo es 0, así que no hay importe |
| `limitesIRPF` | `esp` [26.67, 53.34], `ext` [48.08, 91.35] | Exento diario [bajo, alto] (`calculoDesp.getLimitesIRPF`, :261-289; AECC) |
| `normativasPorTipoProyecto` | `rd`: G24, I24, PEI, NAL; `decreto`: UEX, PCO, JEX | Solo se lee `rd`. El resto se trata como `decreto` (`calculoDesp.getNormativa`, :223-228) |
| `datosAECC` | `importekm`, desayuno/comida/cena Esp/Ext, `alojMaxEspNormal`, `alojMaxEspAltaOcupacion`, `alojMaxExt` | `uiDesplazamientoAecc.setDatosAecc` |

## 2. Archivo `.dta` (objeto de `serializacionDatos.recopilarTodo`, `serializacionDatos.js:421-445`)

Es JSON en claro (`JSON.stringify(datos, null, 2)`, :1168), sin cifrar. Claves de primer nivel:

- `versionEsquema`, `guardadoEl` (ISO), `tipoLiquidacion` (DESPL|CONGR|HONOR|AECC|GNRAL).
- `beneficiario`: `{nombre, dni, entidad, categoria, categoriaNombre}`.
- `pago`: `{tipo, tipoNombre}`, más `iban` (CE), `iban`+`swift` (CI; el IBAN se lee de `#iban-ext`) o `tarjeta` (TJ).
- `proyecto`: `{tipo, tipoNombre, normativa ('rd'|'decreto'), beneficiarioCoincideResponsable, responsable, organica, referencia}`.
- `desplazamientos[]`: solo fichas normales (:238-288). Cada una con:
  - `id`, fechas y horas de ida y regreso, `ticketCena`, `justificaPernocta`
  - `origen`, `destino`, `paisDestino`, `cruceIda`, `cruceVuelta`, `motivo`, `km`, `alojamiento`, `noManutencion`
  - `otrosGastos[] {tipo, concepto, importe}`
  - `datosCalculados`, con valor `null` o con los campos `numManutenciones, precioManutencion, importeManutencion, numNoches, precioNoche, importeMaxAlojamiento, excedeMaxAlojamiento, precioPorKm, importeKm, residenciaEventual, irpfSujeto, importeTotal, segmentos[]`. Se construye a partir de `__sgtriTotales.desplazamientos[id].detalles` (:235).
- `desplazamientoAECC[]`: 0 o 1 elementos (`uiDesplazamientoAecc.obtenerDatos`, :1100-1145), con fechas, destino, `destinoAltaOcupacion`, `manutPrimerDia`, `manutUltimoDia`, `km`, `alojamiento`, `otrosGastos[]` y `datosCalculados`.
- `desplazamientoEspecial`: `null` o `{titulo, lineas[], irpf, total}`. Cada línea es `{tipo:'seccion', descripcion}` o `{tipo:'normal', descripcion, importe, cantidad, total}`.
- `vehiculo`: `null` o `{tipo, marca, modelo, matricula}`. Los `.dta` antiguos pueden traer `justificarPernocta`, que se ignora.
- `evento`: `{nombre, lugar, fechaDesde, fechaHasta, gastosInscripcion, comidasIncluidas, desplazamientoAsociado ("despN"|""), descuentoComidas}`.
- `honorarios`: `{importe, beneficiario, situacion, concepto, domicilio}`.
- `imputacion[]`: `{organica, responsable, importe, readonly}`.
- `ajustes`: `{financiacionMaxima, importeAnticipado (vacío salvo en GNRAL), comentarios, descuentos[] {tipo, motivo, importe}}`. Los comentarios de la sección "Comentarios" se guardan aquí.
- `resultadoLiquidacion`: `{totalLiquidacion, totalAntesFinanciacion, importeAnticipado, importeImputar, irpfTotal}`.
- `fechaFirma`: `{fechado, ciudad, fecha}`.

Los importes se guardan como **texto con formato** (p. ej. `"1.234,56 €"`) y se vuelven a parsear al cargar.

Hay campos que se guardan pero **nunca se restauran**: `categoriaNombre`, `tipoNombre`, `normativa`, `guardadoEl`, todos los `datosCalculados` y `resultadoLiquidacion` (se recalcula al restaurar). Están ahí porque `pdfGen` usa este mismo objeto.

## 3. Entrada y salida del motor de cálculo

**Entrada normalizada.** Viene de `cogeDatosDesp.collectDataFromFicha`, `cogeDatosDesp.js:245-298`:
- `id`
- `fechaIda`, `fechaRegreso`, `cruceIda`, `cruceVuelta` (`Date`); `horaIda`, `horaRegreso` (`{hh,mm}`); `dtIda`, `dtRegreso`
- `raw{...strings}`
- `pais`, `paisIndex`, `esInternacional`, `km`, `alojamiento`, `otrosGastos[]`, `otrosGastosTotal`
- `ticketCena`, `noManutencion`, `justificarPernocta`, `dtInvalid`, `tipoProyecto`, `esValido`, `errores[]`

**`calcInput`.** Lo arma el wrapper en `calculoDesp.js:1395-1412` y usa strings `dd/mm/aa` y `hh:mm`, más `kmTarifa`, `excludeManutencion` (=`noManutencion`), `justificarPernocta` y `excludeAlojamiento` (=`dtInvalid`; no lo marca el usuario). Los tramos añaden `_segmentMode`, `_forceAllNights`, `_forceZeroNights`, `_comesFromPreviousDay`, `_lastNightAmbiguousByHour`, `_lastNightJustified` e `_isLastIntlSegment` (`createSegmentInput`, :978-1006).

**Salida del motor.** `calculateDesplazamiento`, :857-907:
- `manutenciones`, `manutencionesAmount`, `precioManutencion`
- `noches`, `nochesAmount`, `precioNoche`, `nochesAmbiguous`
- `kmAmount`, `alojamientoMaxAmount`, `residenciaEventual`, `factorResidencia`
- `irpf{sujeto, breakdown[], limitesUsed, source}`

**`salidaData`.** Es lo que se pinta y se registra (`buildSalidaData`, :1309-1372):
- `totales{manutencion, alojamientoMax, alojamientoUser, km, otrosGastos, total, irpfSujeto, noches}`
- `detalles` (nacional) o `segmentos[]` (internacional)
- `ui{alojamientoExcedeMax, nochesAmbiguas, residenciaEventual, …}`

`total = manutención + alojamiento introducido por el usuario + km + otros gastos`. El alojamiento **no se limita** al máximo; solo se muestra un aviso.

## 4. `window.__sgtriTotales` (`resultadoLiquidacion.js:42-55`)

```
{ desplazamientos: { [id|'aecc']: { manutencion, alojamiento, km, otrosGastos, irpfSujeto, detalles } },
  honorarios, gastosInscripcion, descuentoCongreso, financiacionMaxima, importeAnticipado,
  descuentosAjustes: [{tipo, tipoLabel, motivo, importe}] }
```

**Quién escribe:**
- `registrarDesplazamiento`: `calculoDesp.js:1515` con id numérico y `uiDesplazamientoAecc.js:718` con la clave `'aecc'`.
- `eliminarDesplazamiento`.
- `actualizar*`: leen del DOM financiación, anticipo, honorarios, inscripción y descuentos.
- `resetTotales`: `formLogic.js:1965`.

La ficha especial **no** se registra; `calcularResultado` la lee directamente con `uiDesplazamientoEspecial.getDatosParaLiquidacion()`.

## 5. `datos_ejemplo.js` (no versionado)

Es un JSON con extensión `.js` que no carga ningún archivo. Su esquema es antiguo: usa `calculos` y `resultados`, mientras que el actual usa `datosCalculados` y `resultadoLiquidacion`. Contiene datos personales, así que desde el 2026-10-23 está en `.gitignore`. No sirve como referencia del formato actual.

## 6. Versionado y migraciones

- La comprobación es una igualdad estricta: `datos.versionEsquema !== VERSION_ESQUEMA`. Si no coinciden, se pregunta con `confirm()` nativo si se carga de todos modos (`serializacionDatos.js:1004-1014`). **No hay migraciones.**
- Solo hay compatibilidad hacia atrás en estos casos:
  - AECC: la clave `justificarPernoctaMadrugada` (`uiDesplazamientoAecc.js:1180-1181`) y `gasto.descripcion` como alias de `concepto` (:1214).
  - `formLogic.validarDatos` acepta los códigos de pago antiguos (`CuentaEsp`, `TarjetaUEx`…, `formLogic.js:1435-1443`), pero la restauración solo entiende CE/CI/TJ.
- Al importar, se acepta la extensión `.json` además de `.dta` ("compatibilidad con Android", :1225-1230). No se valida la forma del objeto más allá de `JSON.parse`.

## 7. Dudas / no verificado

- No se ha comprobado si hay `.dta` reales en circulación con versiones anteriores ni qué cambió entre versiones de esquema. No existe changelog.
- El motivo de la versión `"26.10.2"` (¿fecha AA.MM.n?) se ha deducido del valor; no está documentado en el código.
