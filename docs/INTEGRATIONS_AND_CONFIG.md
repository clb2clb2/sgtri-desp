# Integraciones y configuración

## 1. Recursos externos

| Recurso | Dónde | Notas |
|---|---|---|
| Google Fonts: Saira y Charis SIL | `index.html:11-18` (`preconnect` + `<link>`) | Solo para la interfaz. `--font-family-title: "Saira"` (`css/styles.css:53`). Si no hay red, se usa la fuente de respaldo |
| pdfmake 0.2.10 | `js/pdfmake.min.js`, **incluido en el repo** (banner en la línea 1) | No se carga desde un CDN |

No hay APIs remotas, analítica, autenticación, backend ni llamadas a servicios de terceros. Los únicos `fetch` de la app son a archivos locales.

## 2. Recursos locales que se cargan en tiempo de ejecución

- **`assets/data/datos.json`**: se carga con `fetch` en `formLogic.js:76`. Contiene todos los catálogos y tarifas; ver DATA_MODEL §1.
- **Logos del PDF** (`pdfGen.js`):
  - Logo principal: `fetch` de `assets/img/uex-sello-institucional-color.svg` (`loadSVG`, :263).
  - Si falla, se prueba con `uex-sello-institucional-color.png` y después con `logo-uex.png`, pasando por canvas (:38-42, :238-255).
  - `assets/img/logos_gr24.png` va en el pie de los proyectos G24/I24.
- **Fuentes del PDF**: están embebidas en `js/pdfFonts.js` (base64): HelveticaNeue (Roman, Bold, Italic, MediumCondensed, BoldCondensed) y Montserrat (Regular, Medium). Se registran en `pdfMake.vfs`/`pdfMake.fonts`. La fuente por defecto del documento es HelveticaNeue 10 pt (`pdfGen.js:346-349`).
- `assets/img/logo-sgtri-horizontal-color.svg` es el logo de la cabecera de la interfaz (`index.html:71`).
- Todo se carga con rutas relativas, así que la app tiene que servirse por HTTP desde la raíz. **Por `file://` falla.**

## 3. Configuración

- **Toda la configuración funcional está en `datos.json`:** límites, tarifas por país y normativa, €/km, límites de IRPF, tarifas AECC y mapeo tipo de proyecto → normativa. Para cambiar tarifas basta con editar ese archivo, siempre manteniendo los arrays de 99 posiciones en el mismo orden que `paises`.
- **Constantes en el código que no están en `datos.json`:**
  - `calculoDesp.js` (`HORA_COMIDA`…`HORA_PERNOCTA_MAX`): horas de corte (14:00, 16:00, 22:00, 01:00, 07:00).
  - `calculoDesp.getPrecios`: tarifa de respaldo `{manutencion: 0, noche: 0}`. Sin tarifas no se calcula.
  - `calculoDesp.getKmTarifa` y `calculateDesplazamiento`: tarifa de km de respaldo 0,26.
  - Los modos de liquidación (`CONFIG`, `tipoLiquidacion.js:29-35`).
  - La opción AECC "Inscripción Congreso" (`ICG`), que se añade al catálogo de otros gastos (`uiDesplazamientoAecc.getOtrosGastosDataCatalogo`).
  - `formLogic.computeDescuentoManutencion`: precio de manutención de respaldo 0 para el descuento de congreso.
  - `calculoDesp.LIMITES_IRPF_POR_DEFECTO` = `[26.67, 53.34]`, si `datos.json` no trae `limitesIRPF`.
- **`versionEsquema`** (`datos.json:2`): se usa para el `.dta`, se imprime como `SGTRI v.x` en el PDF y entra en `info.creator`.

## 4. Variables de entorno

**No hay ninguna.** No existen archivos `.env` ni uso de `process.env` (la app se ejecuta en el navegador), y tampoco hay secretos.

## 5. Herramientas (`tools/`, Python; no van a producción)

| Script | Qué hace | Entrada → salida |
|---|---|---|
| `convert_fonts_to_base64.py` | Genera `js/pdfFonts.js` (VFS de pdfmake) | `assets/fonts/*` (mapa `FONTS_TO_CONVERT`, :21-31) → `js/pdfFonts.js` |
| `generate_manual_calculo.py` | Manual de usuario "Cálculos de desplazamientos" | → `docs/Calculo_de_desplazamientos.docx` (:637) |
| `generate_technical_doc.py` | "Lógica interna del cálculo de desplazamientos" | → `docs/Logica_interna_calculo_desplazamientos.docx` (:827). Ese documento se eliminó del repositorio el 2026-10-23; el script puede regenerarlo, pero su contenido puede estar desfasado respecto al código |
| `generate_docx.py` | Guía de liquidación paso a paso | → `docs/Liquidacion_Desplazamientos.docx`, según su docstring. El archivo existente está en la raíz |
| `generate_formLogic_docx.py` | Descripción y propuestas de refactorización de `formLogic.js` | → `docs/formLogic.docx` (no existe en el repo) |
| `generate_input_schema_docx.py` | Esquema de la entrada del motor | → `docs/Estructura_Input_Desplazamiento.docx` (no existe) |
| `extract_docx_text.py` | Extrae el texto de un .docx | `argv[1]` → `.txt` |
| `check_js_balance.py` | Cuenta llaves y paréntesis de `js/formLogic.js` (ruta fija) | stdout |

- Dependencias: `python-docx` (y `lxml`), instaladas en `.venv`, que está en `.gitignore`.
- No hay `requirements.txt`.

## 6. Despliegue

- **Hosting: Cloudflare Pages.**
  - URL pública: **https://dietas.sgtri-unex.es/** (dominio propio).
  - URL de Cloudflare: https://sgtri-dietas.pages.dev/.
  - Ambas sirven exactamente el último commit de `sgtri-desp-prod`; se comprobó el 2026-10-23 comparando los hashes de `index.html`, `css/styles.css` y los `js/`. Cloudflare Pages redirige `/index.html` → `/` (308).
- **Cloudflare despliega desde `sgtri-desp-prod`.** La configuración (proyecto conectado al repositorio de GitHub, rama, dominio) está en el panel de Cloudflare, no en el repo: no hay `wrangler.toml`, `_headers` ni `_redirects`. El despliegue se lanza solo con cada push a `main` de `sgtri-desp-prod` (deducido de que lo publicado coincide con cada commit).
- **GitHub Pages está desactivado** en `sgtri-desp-prod` desde el 2026-10-23; la única publicación es la de Cloudflare.
- **No hay pipeline propio:** no hay CI, ni `.github/`, ni Dockerfile, ni scripts de despliegue en el repo.
- **Cómo se despliega.** El repositorio gemelo `sgtri-desp-prod` (remoto `github.com/clb2clb2/sgtri-desp-prod`) contiene solo los archivos de runtime, copiados a mano. Sus commits se titulan "Sync … from production" / "Sync production app …".
  - A fecha del análisis, todos sus archivos versionados son **idénticos** a los de este repo excepto `.gitignore`. Comprobado con `cmp`.
  - El `.gitignore` de prod excluye explícitamente `docs/`, `tools/`, `Normativas/`, `datos_ejemplo.js`, `Ejemplos PDFMake.pdf` y `*.docx` de prueba.
- **Contenido de prod:**
  - Incluido: `index.html`, `favicon.ico`, `robots.txt`, `css/`, `js/`, `assets/data/datos.json` y `assets/img/*`.
  - Excluido: `assets/fonts/`, que no hace falta porque las fuentes van en `pdfFonts.js`.
- **`robots.txt`:** `Disallow: /`. No se quiere que la app aparezca en buscadores.
- **Al publicar un cambio:** copia los archivos de runtime modificados a `sgtri-desp-prod`, haz el commit allí y `git push`. Cloudflare Pages lo publica en `dietas.sgtri-unex.es` en uno o dos minutos. **No copies** este `CLAUDE.md` ni `docs/*.md`.

## 7. Dudas / no verificado

- No se ha visto la configuración del proyecto en el panel de Cloudflare (rama de producción, comando de build, si hay *preview deployments*). Lo descrito en §6 se ha deducido del contenido publicado.
- No se ha comprobado si el sincronizado con prod sigue un procedimiento o script fuera del repo.
