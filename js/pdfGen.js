/**
 * pdfGen.js
 * ==========
 * Módulo de generación de PDF usando pdfmake.
 * 
 * Fuentes requeridas: pdfFonts.js (generado por tools/convert_fonts_to_base64.py)
 *
 * @module pdfGen
 */
(function (global) {
  'use strict';

  // =========================================================================
  // CONFIGURACIÓN DEL DOCUMENTO
  // =========================================================================

  const PDF_CONFIG = {
    page: {
      size: 'A4',
      margin: 27.64  // Deja 504 ptos de ancho útil (24 celdas * 21 puntos)
    },
    // A4 = 595.28pt × 841.89pt
    get anchoUtil() {
      return 595.28 - (this.page.margin * 2);
    }
  };

  // =========================================================================
  // UTILIDADES
  // =========================================================================

  /**
   * Formatea número a string con 2 decimales y separador alemán.
   */
  function fmt(n) {
    return (Number(n) || 0).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Carga una imagen y la convierte a Base64.
   * @param {string} url - URL de la imagen
   * @returns {Promise<string>} Data URL en base64
   */
  function loadImageAsBase64(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = function () {
        reject(new Error(`No se pudo cargar la imagen: ${url}`));
      };
      img.src = url;
    });
  }

  /**
   * Carga un SVG como texto para pdfmake.
   * @param {string} url - URL del SVG
   * @returns {Promise<string>} Contenido SVG
   */
  async function loadSVG(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo cargar SVG: ${url}`);
    return await response.text();
  }

  // =========================================================================
  // DATOS DE PRUEBA
  // =========================================================================

  const datosPrueba = {
    beneficiario: {
      nombre: 'Víctor Manuel Viñuales Guillén',
      dni: '03864429S',
      entidad: 'Universidad de Extremadura',
      categoria: 'IP'
    },
    proyecto: {
      referencia: 'GR248959'
    }
  };

  // =========================================================================
  // CONSTRUCCIÓN DEL DOCUMENTO
  // =========================================================================

  /**
   * Construye la definición del documento PDF.
   * @param {Object} datos - Datos de la liquidación
   * @param {string} logoBase64 - Logo en Base64 (PNG) o contenido SVG
   * @param {boolean} logoIsSVG - true si el logo es SVG
   */
  function buildDocDefinition(datos, logoBase64, logoIsSVG = false) {
    const margin = PDF_CONFIG.page.margin;

    return {
      // ─────────────────────────────────────────────────────────────────────
      // INFORMACIÓN DEL DOCUMENTO
      // ─────────────────────────────────────────────────────────────────────
      info: {
        title: 'Liquidación de Desplazamientos',
        author: 'SGTRI - Universidad de Extremadura',
        subject: `Liquidación ${datos.proyecto?.referencia || ''}`,
        creator: 'SGTRI v2.0 (2026)'
      },

      // ─────────────────────────────────────────────────────────────────────
      // CONFIGURACIÓN DE PÁGINA
      // ─────────────────────────────────────────────────────────────────────
      pageSize: 'A4',
      pageMargins: [margin, margin, margin, margin], // 15mm = 43pt en todos los lados

      // ─────────────────────────────────────────────────────────────────────
      // ESTILOS
      // ─────────────────────────────────────────────────────────────────────
      defaultStyle: {
        font: 'HelveticaNeue-MediumCondensed',
        fontSize: 10
      },

      styles: {
        titulo: {
          font: 'HelveticaNeue-MediumCondensed',
          fontSize: 18,
          color: [62, 124, 44]
        },
        version: {
          font: 'HelveticaNeue-MediumCondensed',
          fontSize: 10,
          color: [153, 153, 153]  // Gris 60%
        },
        versionSmall: {
          font: 'HelveticaNeue-MediumCondensed',
          fontSize: 8,
          color: [153, 153, 153]  // Gris 60%
        }
      },

      // ─────────────────────────────────────────────────────────────────────
      // CONTENIDO
      // ─────────────────────────────────────────────────────────────────────
      content: [
        // ═══════════════════════════════════════════════════════════════════
        // ENCABEZADO (solo primera página)
        // ═══════════════════════════════════════════════════════════════════
        {
          table: {
            widths: [40, '*', 40],
            body: [
              [
                // Celda 1: Logo
                {
                  margin: [0, 0, 0, 0],
                  alignment: 'left',
                  stack: [
                    logoIsSVG
                      ? {
                        svg: logoBase64,
                        height: 45,
                        alignment: 'left',
                        margin: [0, 0, 0, 0]
                      }
                      : {
                        image: logoBase64,
                        height: 45,
                        alignment: 'left',
                        margin: [0, 0, 0, 0]
                      }
                  ]
                },
                // Celda 2: Título
                {
                  margin: [0, 7.5, 0, 0],
                  alignment: 'center',
                  stack: [
                    { text: 'Liquidación de Desplazamientos,', style: 'titulo' },
                    { text: 'Congresos y Honorarios', style: 'titulo' }
                  ]
                },
                // Celda 3: SGTRI
                {
                  margin: [0, 0, 0, 0],
                  alignment: 'center',
                  stack: [
                    { text: 'S.G.T.R.I.', style: 'version' },
                    { text: 'v2.0 (2026)', style: 'versionSmall' }
                  ]
                }
              ]
            ]
          },
          layout: {
            defaultBorder: false,
          },
          margin: [0, 0, 0, 20]
        },

        // ═══════════════════════════════════════════════════════════════════
        // CONTENIDO TEMPORAL (para visualizar la prueba)
        // ═══════════════════════════════════════════════════════════════════
        {
          text: '\n\n[Aquí irá el contenido de la liquidación]\n\n',
          alignment: 'center',
          color: '#888888',
          italics: true,
          margin: [0, 50, 0, 0]
        },

        // Información de prueba
        {
          table: {
            widths: ['30%', '*'],
            body: [
              [
                { text: 'Configuración:', bold: true, colSpan: 2 },
                {}
              ],
              [
                { text: 'Márgenes:', italics: true },
                { text: '15mm (43pt) en todos los lados' }
              ],
              [
                { text: 'Ancho útil:', italics: true },
                { text: `${PDF_CONFIG.anchoUtil.toFixed(2)} pt` }
              ],
              [
                { text: 'Fuente título:', italics: true },
                { text: 'HelveticaNeue-CondensedBlack 16pt' }
              ],
              [
                { text: 'Fuente versión:', italics: true },
                { text: 'HelveticaNeue-Medium 10pt' }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 30, 0, 0]
        }
      ]
    };
  }

  // =========================================================================
  // GENERACIÓN DEL PDF
  // =========================================================================

  /**
   * Genera y descarga el PDF.
   * @param {Object} [datos] - Datos de la liquidación (usa datos de prueba si no se proporcionan)
   */
  async function generar(datos) {
    const d = datos || datosPrueba;

    // Verificar que pdfMake está disponible
    if (typeof pdfMake === 'undefined') {
      console.error('[pdfGen] pdfMake no está cargado');
      alert('Error: La librería pdfMake no está disponible.');
      return;
    }

    // Verificar que las fuentes están cargadas
    if (!pdfMake.fonts || !pdfMake.fonts['HelveticaNeue-MediumCondensed']) {
      console.error('[pdfGen] Fuentes personalizadas no cargadas. Asegúrate de incluir pdfFonts.js');
      alert('Error: Las fuentes no están cargadas. Verifica pdfFonts.js');
      return;
    }

    try {
      console.log('[pdfGen] Cargando logo...');

      // Intentar cargar como SVG primero
      let logoData;
      let isSVG = false;

      try {
        logoData = await loadSVG('assets/img/logouex.svg');
        isSVG = true;
        console.log('[pdfGen] Logo SVG cargado');
      } catch (svgError) {
        console.warn('[pdfGen] No se pudo cargar SVG, intentando PNG...');
        try {
          logoData = await loadImageAsBase64('assets/img/logo-uex.png');
          console.log('[pdfGen] Logo PNG cargado');
        } catch (pngError) {
          console.error('[pdfGen] No se pudo cargar ningún logo');
          // Continuar sin logo
          logoData = null;
        }
      }

      console.log('[pdfGen] Generando PDF...');
      const docDefinition = buildDocDefinition(d, logoData, isSVG);

      pdfMake.createPdf(docDefinition).download(`Liquidacion_${d.proyecto?.referencia || 'borrador'}.pdf`);
      console.log('[pdfGen] PDF generado correctamente');

    } catch (error) {
      console.error('[pdfGen] Error generando PDF:', error);
      alert('Error generando el PDF: ' + error.message);
    }
  }

  /**
   * Abre el PDF en una nueva pestaña (previsualización).
   */
  async function preview(datos) {
    const d = datos || datosPrueba;

    if (typeof pdfMake === 'undefined') {
      console.error('[pdfGen] pdfMake no está cargado');
      alert('Error: La librería pdfMake no está disponible.');
      return;
    }

    try {
      let logoData;
      let isSVG = false;

      try {
        logoData = await loadSVG('assets/img/logouex.svg');
        isSVG = true;
      } catch {
        try {
          logoData = await loadImageAsBase64('assets/img/logo-uex.png');
        } catch {
          logoData = null;
        }
      }

      const docDefinition = buildDocDefinition(d, logoData, isSVG);
      pdfMake.createPdf(docDefinition).open();

    } catch (error) {
      console.error('[pdfGen] Error:', error);
      alert('Error: ' + error.message);
    }
  }

  // =========================================================================
  // INICIALIZACIÓN
  // =========================================================================

  function init() {
    const btnPDF = document.getElementById('btn-generar-pdf');
    if (btnPDF) {
      btnPDF.addEventListener('click', () => {
        console.log('[pdfGen] Generando PDF...');
        generar();
      });
    }
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  global.pdfGen = {
    init,
    generar,
    preview,
    PDF_CONFIG,
    _datosPrueba: datosPrueba
  };

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : this);
