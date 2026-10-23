# CLAUDE.md — sgtri-desp

## Qué es
Es una SPA estática, sin backend, para el SGTRI de la Universidad de Extremadura. El personal la usa para calcular **liquidaciones de gastos de desplazamiento**: manutención, alojamiento, kilometraje, otros gastos, congresos, honorarios y el caso AECC. Al final genera el **PDF oficial** de la liquidación con pdfmake.
- El cálculo depende de la normativa del proyecto: RD 462/2002 o Decreto 42/2025.
- Las tarifas están en `assets/data/datos.json`.
- El estado se guarda y se carga en archivos locales `.dta` (JSON). No hay servidor ni base de datos.

## Stack
- HTML + CSS + JavaScript vanilla, sin bundler ni dependencias npm. Todos los módulos son IIFE que publican un objeto en `window.*`.
- pdfmake **0.2.10**, incluido en el repositorio (`js/pdfmake.min.js`). Las fuentes del PDF van en base64 en `js/pdfFonts.js`.
- Google Fonts (Saira, Charis SIL) para la interfaz (`index.html:11-18`).
- Python 3 + `python-docx` 1.2.0 solo para `tools/` (en `.venv`, no versionado).

## Comandos
- **Instalar:** no hace falta nada para la app. Para tools: `python -m venv .venv` → `.\.venv\Scripts\Activate.ps1` → `pip install python-docx`.
- **Ejecutar:** sirve la raíz por HTTP (p. ej. `python -m http.server 8000`) y abre `http://localhost:8000`. No funciona por `file://`, porque `fetch('assets/data/datos.json')` (`js/formLogic.js:76`) y la carga de logos (`js/pdfGen.js:263`) fallan. El comando de servidor es una recomendación: el repositorio no define ninguno.
- **Tests / lint / build:** **no existen**. No hay `package.json` ni configuración de ESLint ni de Prettier; `.vscode/extensions.json` solo recomienda las extensiones.
- **Regenerar las fuentes del PDF:** `python tools/convert_fonts_to_base64.py`, que reescribe `js/pdfFonts.js`.

## Mapa de carpetas
- `index.html`: el único HTML. Contiene las secciones del formulario y el orden de carga de los scripts.
- `js/`: todos los módulos (ver @docs/ARCHITECTURE.md).
- `css/styles.css`: todos los estilos, en un solo archivo.
- `assets/data/datos.json`: catálogos, límites, tarifas por país y normativa, IRPF, AECC y `versionEsquema`.
- `assets/img/`: logos que usa el PDF (SVG/PNG).
- `assets/fonts/`: OTF/TTF de origen para `pdfFonts.js`. **No se usan en tiempo de ejecución.**
- `tools/`: scripts Python auxiliares (fuentes base64, generación de .docx). No van a producción.
- `docs/`: esta documentación y dos .docx (manual de cálculo y lógica interna).
- `Normativas/` (PDF del RD 462/2002 y del Decreto 42/2025), `Liquidacion_Desplazamientos.docx`, `Ejemplos PDFMake.pdf`: material de referencia versionado. No los usa la app.

## Convenciones al modificar
- **Patrón de módulo:** `(function(global){ 'use strict'; ... global.nombreModulo = {...}; })(window)`. Los módulos se comunican llamando a `window.X?.metodo?.()`. No hay imports.
- **El orden de `<script defer>` en `index.html:24-54` es una dependencia real.** Un módulo nuevo debe ir después de los que usa.
- El código, los identificadores, los comentarios y la interfaz están **en español**. Respeta ese estilo.
- Para sanear y parsear entradas usa `window.limpiaDatos` (fechas, horas, IBAN) y `window.utils` (`parseNumber`, `fmt` con locale `de-DE`, `round2`). Para reglas compartidas usa `utils.getNormativa`, `utils.esPaisInternacional` y `utils.ordenCrucesValido`. No dupliques estas funciones ni añadas respaldos locales: `utils.js` y `limpiaDatos.js` se cargan siempre los primeros.
- El motor de cálculo (`calculoDesp.js`, sección MOTOR) debe seguir siendo **puro**, sin DOM. El DOM se lee en `cogeDatosDesp.js` y se pinta en `salidaDesp.js`.
- Los totales se registran en `window.__sgtriTotales` mediante `resultadoLiquidacion.registrar*` y nunca se leen del DOM.
- Recálculo: los campos de texto recalculan en `focusout`/blur y los selects y checkboxes en `change` (`js/logicaDesp.js:76-111`).
- Si cambias la forma del objeto `.dta` (`serializacionDatos.recopilarTodo`), sube `versionEsquema` en `datos.json`. Hay que actualizar a la vez la generación del PDF, que usa el mismo objeto.

## Trampas / no tocar
- **`js/pdfmake.min.js`** es de terceros y **`js/pdfFonts.js`** es un archivo generado ("NO EDITAR MANUALMENTE"). No se editan a mano.
- **Sincronía con producción:** el repositorio gemelo `sgtri-desp-prod` contiene una copia idéntica de `index.html`, `js/`, `css/`, `assets/data`, `assets/img`, `favicon.ico` y `robots.txt`; a fecha del análisis solo difiere `.gitignore`. Cualquier cambio en esos archivos hay que copiarlo allí. **La documentación, `tools/` y los ejemplos no se copian a prod.**
- `datos_ejemplo.js` y `Prueba salida PDF *.docx` contienen **datos personales**: están en `.gitignore` y no se versionan (aunque siguen en el historial). No los vuelvas a añadir ni copies sus datos.
- `.dta` es JSON en claro: contiene DNI, IBAN y tarjeta.
- La carga de un `.dta` depende de `setTimeout` encadenados (`js/serializacionDatos.js:998-1157`). Si cambias la creación de fichas, revisa esos tiempos.
- Los diálogos (`showConfirm`/`showPrompt`) escapan el texto: no les pases HTML.
- El índice del `<select>` de país es la posición en los arrays de `dietasPorPais` (99 entradas). **Reordenar `paises` en `datos.json` sin reordenar también las tarifas rompe el cálculo.**
- Los modos (DESPL/CONGR/HONOR/AECC/GNRAL) están en `CONFIG` (`js/tipoLiquidacion.js:29-35`). Al modo GNRAL solo se llega con Shift+clic en "Liquidación de desplazamientos".

## Documentación de detalle
- @docs/ARCHITECTURE.md: módulos, orden de carga, comunicación y flujo de extremo a extremo.
- @docs/DATA_MODEL.md: `datos.json`, formato `.dta`, entrada y salida del motor, `__sgtriTotales`.
- @docs/FEATURES.md: cada funcionalidad con sus archivos, flujo y casos límite.
- @docs/INTEGRATIONS_AND_CONFIG.md: recursos externos, configuración, tools y despliegue.
- @docs/STATUS.md: deuda técnica, posibles bugs, zonas sin tests, fecha y commit del análisis.

## Mantenimiento
Antes de explorar el código desde cero, lee los documentos de docs/. Si cambias el comportamiento, actualiza el documento afectado y la fecha/commit de STATUS.md.
