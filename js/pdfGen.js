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
    },
    // Espaciado vertical entre tablas (1 cm = 28.35 pt)
    espacioTablas: 28.35
  };

  // =========================================================================
  // UTILIDADES
  // =========================================================================

  /**
   * Parsea un string numérico en formato europeo (1.234,56) a número.
   * @param {string|number} val - Valor a parsear
   * @returns {number} Número parseado
   */
  function parseEuroNumber(val) {
    if (typeof val === 'number') return val;
    if (!val || typeof val !== 'string') return 0;
    // Quitar símbolo €, espacios, puntos de miles, y reemplazar coma decimal por punto
    const cleaned = val.replace(/€/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return Number(cleaned) || 0;
  }

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
   * Formatea importe en formato europeo con símbolo €.
   * Ej: 1234.56 → "1.234,56 €"
   */
  function fmtEuro(n) {
    return fmt(n) + ' €';
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
  // REFERENCIA AL MÓDULO DE SERIALIZACIÓN
  // =========================================================================

  /**
   * Obtiene los datos del formulario usando el módulo de serialización.
   * @returns {Object} Datos serializados del formulario
   */
  function obtenerDatosFormulario() {
    const serializar = window.serializacionDatos;
    if (!serializar || typeof serializar.recopilarTodo !== 'function') {
      console.error('[pdfGen] Módulo serializacionDatos no disponible');
      return null;
    }
    return serializar.recopilarTodo();
  }

  // =========================================================================
  // CONSTRUCCIÓN DEL DOCUMENTO
  // =========================================================================

  /**
   * Construye la definición del documento PDF.
   * @param {Object} datos - Datos de la liquidación
   * @param {string} logoBase64 - Logo en Base64 (PNG) o contenido SVG
   * @param {boolean} logoIsSVG - true si el logo es SVG
   * @param {string} separadorSVG - Contenido SVG del separador
   */
  function buildDocDefinition(datos, logoBase64, logoIsSVG = false, separadorSVG = null) {
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
        font: 'HelveticaNeue',
        fontSize: 10
      },

      styles: {
        titulo: {
          font: 'HelveticaNeue-BoldCondensed',
          fontSize: 18,
          color: '#407C2E'  // RGB(64,124,46)
        },
        version: {
          font: 'HelveticaNeue-MediumCondensed',
          fontSize: 10,
          color: '#7c7c7c'  // Gris
        },
        versionSmall: {
          font: 'HelveticaNeue-MediumCondensed',
          fontSize: 8,
          color: '#7c7c7c'  // Gris
        },
        // Estilos para tablas de datos
        tablaEncabezado: {
          font: 'HelveticaNeue',
          bold: true,
          fontSize: 10,
          color: '#407C2E'  // RGB(64,124,46) - Verde
        },
        tablaEtiqueta: {
          font: 'HelveticaNeue-MediumCondensed',
          fontSize: 10,
          color: '#7c7c7c'  // Gris
        },
        tablaDato: {
          font: 'HelveticaNeue',
          fontSize: 10,
          color: '#000000'  // Negro
        },
        tablaNotaSmall: {
          font: 'HelveticaNeue',
          fontSize: 8,
          italics: true,
          color: '#7c7c7c'  // Gris
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
          margin: [0, 0, 0, 10]
        },

        // ═══════════════════════════════════════════════════════════════════
        // LÍNEA SEPARADORA
        // ═══════════════════════════════════════════════════════════════════
        separadorSVG ? {
          svg: separadorSVG,
          width: PDF_CONFIG.anchoUtil,
          alignment: 'center',
          margin: [0, 0, 0, 15]
        } : {},

        // ═══════════════════════════════════════════════════════════════════
        // TABLAS DE DATOS
        // ═══════════════════════════════════════════════════════════════════
        
        // Tabla: Datos del beneficiario
        ...buildTablaBeneficiario(datos),

        // Espaciador entre tablas
        { text: '', margin: [0, PDF_CONFIG.espacioTablas, 0, 0] },

        // Tabla: Datos del proyecto
        ...buildTablaProyecto(datos),

        // Tablas de desplazamientos nacionales
        ...buildTablasDesplazamientos(datos)

      ]
    };
  }

  // =========================================================================
  // CONSTRUCTORES DE TABLAS
  // =========================================================================

  /**
   * Construye un encabezado de sección con línea verde debajo.
   * @param {string} texto - Texto del encabezado
   * @returns {Array} Array con texto y canvas para la línea
   */
  function buildEncabezadoSeccion(texto) {
    return [
      { text: texto, style: 'tablaEncabezado', margin: [0, 0, 0, 2] },
      {
        canvas: [
          {
            type: 'line',
            x1: 0, y1: 0,
            x2: PDF_CONFIG.anchoUtil, y2: 0,
            lineWidth: 1,
            lineColor: '#407C2E'
          }
        ],
        margin: [0, 0, 0, 0]
      }
    ];
  }

  /**
   * Construye la tabla de datos del beneficiario.
   * @param {Object} datos - Datos del formulario
   * @returns {Array} Array con encabezado y tabla para pdfmake
   */
  function buildTablaBeneficiario(datos) {
    const b = datos.beneficiario || {};
    const pago = datos.pago || {};

    // Construir fila de pago según el tipo
    let filaPago;
    if (pago.tipo === 'CE') {
      filaPago = {
        text: [
          { text: 'Pago en cuenta española n.º: ', style: 'tablaEtiqueta' },
          { text: pago.iban || '', style: 'tablaDato' }
        ],
        colSpan: 2
      };
    } else if (pago.tipo === 'TJ') {
      filaPago = {
        text: [
          { text: 'Pagado con tarjeta de investigador: ', style: 'tablaEtiqueta' },
          { text: pago.tarjeta || '', style: 'tablaDato' }
        ],
        colSpan: 2
      };
    } else if (pago.tipo === 'CI') {
      filaPago = {
        text: [
          { text: 'Pago en cuenta extranjera con IBAN: ', style: 'tablaEtiqueta' },
          { text: pago.iban || '', style: 'tablaDato' },
          { text: ' y SWIFT: ', style: 'tablaEtiqueta' },
          { text: pago.swift || '', style: 'tablaDato' }
        ],
        colSpan: 2
      };
    } else {
      filaPago = { text: '', colSpan: 2 };
    }

    // Encabezado con línea verde
    const encabezado = buildEncabezadoSeccion('BENEFICIARIO:');
    
    // Tabla sin la fila de encabezado
    const tabla = {
      table: {
        widths: ['50%', '*'],
        body: [
          // Fila 1: Nombre (50%) + DNI (50%)
          [
            {
              text: [
                { text: 'Nombre: ', style: 'tablaEtiqueta' },
                { text: b.nombre || '', style: 'tablaDato' }
              ]
            },
            {
              text: [
                { text: 'DNI/Pasaporte: ', style: 'tablaEtiqueta' },
                { text: b.dni || '', style: 'tablaDato' }
              ]
            }
          ],
          // Fila 2: Entidad (50%) + Categoría (50%)
          [
            {
              text: [
                { text: 'Entidad contratante: ', style: 'tablaEtiqueta' },
                { text: b.entidad || '', style: 'tablaDato' }
              ]
            },
            {
              text: [
                { text: 'En calidad de: ', style: 'tablaEtiqueta' },
                { text: b.categoriaNombre || b.categoria || '', style: 'tablaDato' }
              ]
            }
          ],
          // Fila 3: Datos de pago (100%)
          [
            filaPago,
            {}
          ]
        ]
      },
      layout: {
        hLineWidth: (i) => i === 0 ? 0 : 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#cccccc',
        vLineColor: () => '#cccccc',
        paddingTop: () => 5
      },
      margin: [0, 0, 0, 0]
    };

    return [...encabezado, tabla];
  }

  /**
   * Construye la tabla de datos del proyecto.
   * @param {Object} datos - Datos del formulario
   * @returns {Array} Array con encabezado y tabla para pdfmake
   */
  function buildTablaProyecto(datos) {
    const p = datos.proyecto || {};
    const imputacion = datos.imputacion || [];

    // Construir filas del body (4 columnas: 25%, 25%, 25%, 25%)
    const bodyRows = [
      // Fila 1: Tipo (50%) + Referencia (50%)
      [
        {
          text: [
            { text: 'Tipo: ', style: 'tablaEtiqueta' },
            { text: p.tipoNombre || p.tipo || '', style: 'tablaDato' }
          ],
          colSpan: 2
        },
        {},
        {
          text: [
            { text: 'Referencia: ', style: 'tablaEtiqueta' },
            { text: p.referencia || '', style: 'tablaDato' }
          ],
          colSpan: 2
        },
        {}
      ],
      // Fila 2: Responsable (50%) + Orgánica (25%) + Importe (25%)
      [
        {
          text: [
            { text: 'Responsable: ', style: 'tablaEtiqueta' },
            { text: p.responsable || '', style: 'tablaDato' }
          ],
          colSpan: 2
        },
        {},
        {
          text: [
            { text: 'Orgánica: ', style: 'tablaEtiqueta' },
            { text: p.organica || '', style: 'tablaDato' }
          ]
        },
        {
          text: [
            { text: 'Importe: ', style: 'tablaEtiqueta' },
            { text: fmtEuro(imputacion[0]?.importe), style: 'tablaDato' }
          ]
        }
      ]
    ];

    // Añadir filas para imputaciones adicionales (desde índice 1)
    for (let i = 1; i < imputacion.length; i++) {
      const imp = imputacion[i];
      const num = i + 1;
      bodyRows.push([
        {
          text: [
            { text: `Responsable${num}: `, style: 'tablaEtiqueta' },
            { text: imp.responsable || '', style: 'tablaDato' }
          ],
          colSpan: 2
        },
        {},
        {
          text: [
            { text: `Orgánica${num}: `, style: 'tablaEtiqueta' },
            { text: imp.organica || '', style: 'tablaDato' }
          ]
        },
        {
          text: [
            { text: 'Importe: ', style: 'tablaEtiqueta' },
            { text: fmtEuro(imp.importe), style: 'tablaDato' }
          ]
        }
      ]);
    }

    // Fila final: Normativa con enlace
    let textoNormativa;
    if (p.normativa === 'decreto') {
      textoNormativa = {
        text: [
          { text: 'Cálculos efectuados en base al ' },
          {
            text: 'Decreto 42/2025',
            link: 'https://doe.juntaex.es/otrosFormatos/html.php?xml=2025040078&anio=2025&doe=1010o',
            decoration: 'underline'
          }
        ],
        style: 'tablaNotaSmall',
        alignment: 'center',
        colSpan: 4
      };
    } else {
      textoNormativa = {
        text: [
          { text: 'Cálculos efectuados en base al ' },
          {
            text: 'RD 462/2002',
            link: 'https://www.boe.es/buscar/act.php?id=BOE-A-2002-10337',
            decoration: 'underline'
          }
        ],
        style: 'tablaNotaSmall',
        alignment: 'center',
        colSpan: 4
      };
    }
    bodyRows.push([textoNormativa, {}, {}, {}]);

    // Encabezado con línea verde
    const encabezado = buildEncabezadoSeccion('DATOS DEL PROYECTO:');

    // Tabla sin la fila de encabezado
    const tabla = {
      table: {
        widths: ['25%', '25%', '25%', '*'],
        body: bodyRows
      },
      layout: {
        hLineWidth: (i) => i === 0 ? 0 : 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#cccccc',
        vLineColor: () => '#cccccc',
        paddingTop: () => 5
      },
      margin: [0, 0, 0, 0]
    };

    return [...encabezado, tabla];
  }

  /**
   * Construye las tablas de desplazamientos nacionales.
   * Solo procesa desplazamientos con paisDestino = "España".
   * @param {Object} datos - Datos del formulario
   * @returns {Array} Array con tablas para cada desplazamiento nacional
   */
  function buildTablasDesplazamientos(datos) {
    const desplazamientos = datos.desplazamientos || [];
    const result = [];

    for (const desp of desplazamientos) {
      // Solo desplazamientos nacionales (España)
      if (desp.paisDestino !== 'España') {
        continue;
      }

      const dc = desp.datosCalculados || {};

      // Construir texto de fechas: "dd/mm/aa, hh:mm h — dd/mm/aa, hh:mm h" con posible ticket cena
      const fechasText = [
        { text: `${desp.fechaIda}, ${desp.horaIda} h — ${desp.fechaRegreso}, ${desp.horaRegreso} h`, style: 'tablaDato' }
      ];
      if (desp.ticketCena) {
        fechasText.push({ text: '     [ticket cena]', style: 'tablaNotaSmall' });
      }

      // Encabezado con línea verde
      const encabezado = buildEncabezadoSeccion(`DESPLAZAMIENTO #${desp.id}`);

      // Factor de residencia eventual
      const factorResEv = dc.residenciaEventual ? ' × 80%' : '';

      // Tabla del desplazamiento
      // Mapa de tipos de otros gastos
      const TIPOS_OTROS_GASTOS = {
        'AVN': 'Avión / Tren / Autobús',
        'PJE': 'Peaje',
        'TAX': 'Taxi',
        'PRK': 'Aparcamiento',
        'TRF': 'Transfer o Traslados',
        'INS': 'Gastos de instalación',
        'ALQ': 'Alquiler de coche',
        'SAC': 'Seguro de accidentes',
        'SME': 'Seguro médico',
        'TTR': 'Tasa turística',
        'TAG': 'Tasa agencia de viajes',
        'OTR': 'Otros gastos'
      };

      // Construir filas base de la tabla
      const bodyRows = [
        // Fila 1: Fechas + Manutención
        [
          { text: fechasText },
          {
            text: `Manut. [ ${dc.numManutenciones || 0} × ${fmtEuro(dc.precioManutencion || 0)}${factorResEv} ]`,
            style: 'tablaEtiqueta',
            alignment: 'right'
          },
          {
            text: fmtEuro(dc.importeManutencion || 0),
            style: 'tablaDato',
            alignment: 'right'
          }
        ],
        // Fila 2: Origen/Destino + Alojamiento
        [
          {
            text: `${desp.origen || ''} — ${desp.destino || ''}`,
            style: 'tablaDato'
          },
          {
            text: `Aloj. [ máx ${dc.numNoches || 0} × ${fmtEuro(dc.precioNoche || 0)}${factorResEv} = ${fmtEuro(dc.importeMaxAlojamiento || 0)} ]`,
            style: 'tablaEtiqueta',
            alignment: 'right'
          },
          {
            text: fmtEuro(desp.alojamiento || 0),
            style: 'tablaDato',
            alignment: 'right'
          }
        ],
        // Fila 3: Motivo + Kilometraje
        [
          {
            text: [
              { text: 'Motivo: ', style: 'tablaEtiqueta' },
              { text: desp.motivo || '', style: 'tablaDato' }
            ]
          },
          {
            text: `Km. [ ${desp.km || 0} × ${fmtEuro(dc.precioPorKm || 0)} ]`,
            style: 'tablaEtiqueta',
            alignment: 'right'
          },
          {
            text: fmtEuro(dc.importeKm || 0),
            style: 'tablaDato',
            alignment: 'right'
          }
        ]
      ];

      // Añadir filas de otros gastos si existen
      const otrosGastos = desp.otrosGastos || [];
      for (const gasto of otrosGastos) {
        const nombreTipo = TIPOS_OTROS_GASTOS[gasto.tipo] || gasto.tipo || 'Otro';
        const concepto = gasto.concepto || '';
        
        // Construir texto con estilos separados para tipo y concepto
        const textoGasto = concepto 
          ? [
              { text: `${nombreTipo}: `, style: 'tablaEtiqueta' },
              { text: concepto, style: 'tablaDato' }
            ]
          : { text: nombreTipo, style: 'tablaEtiqueta' };
        
        bodyRows.push([
          {
            text: textoGasto,
            alignment: 'right',
            colSpan: 2
          },
          {},
          {
            text: fmtEuro(parseEuroNumber(gasto.importe)),
            style: 'tablaDato',
            alignment: 'right'
          }
        ]);
      }

      const tabla = {
        table: {
          widths: ['50%', '38%', '*'],  // Primera 50%, segunda 38%, tercera el resto (~12%)
          body: bodyRows
        },
        layout: {
          hLineWidth: (i) => i === 0 ? 0 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cccccc',
          vLineColor: () => '#cccccc',
          paddingTop: () => 5
        },
        margin: [0, 0, 0, 0]
      };

      // Añadir espaciador, encabezado y tabla
      result.push({ text: '', margin: [0, PDF_CONFIG.espacioTablas, 0, 0] });
      result.push(...encabezado);
      result.push(tabla);
    }

    return result;
  }

  // =========================================================================
  // GENERACIÓN DEL PDF
  // =========================================================================

  /**
   * Genera y descarga el PDF.
   * @param {Object} [datos] - Datos de la liquidación (si no se proporciona, se obtienen del formulario)
   */
  async function generar(datos) {
    // Obtener datos del formulario si no se proporcionan
    const d = datos || obtenerDatosFormulario();
    
    if (!d) {
      alert('Error: No se pudieron obtener los datos del formulario.');
      return;
    }

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
      console.log('[pdfGen] Datos del formulario:', d);
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

      // Cargar separador SVG
      let separadorSVG = null;
      try {
        separadorSVG = await loadSVG('assets/img/separador.svg');
        console.log('[pdfGen] Separador SVG cargado');
      } catch (e) {
        console.warn('[pdfGen] No se pudo cargar el separador SVG');
      }

      console.log('[pdfGen] Generando PDF...');
      const docDefinition = buildDocDefinition(d, logoData, isSVG, separadorSVG);

      pdfMake.createPdf(docDefinition).download(`Liquidacion_${d.proyecto?.referencia || 'borrador'}.pdf`);
      console.log('[pdfGen] PDF generado correctamente');

    } catch (error) {
      console.error('[pdfGen] Error generando PDF:', error);
      alert('Error generando el PDF: ' + error.message);
    }
  }

  /**
   * Abre el PDF en una nueva pestaña (previsualización).
   * @param {Object} [datos] - Datos de la liquidación (si no se proporciona, se obtienen del formulario)
   */
  async function preview(datos) {
    // Obtener datos del formulario si no se proporcionan
    const d = datos || obtenerDatosFormulario();
    
    if (!d) {
      alert('Error: No se pudieron obtener los datos del formulario.');
      return;
    }

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

      // Cargar separador SVG
      let separadorSVG = null;
      try {
        separadorSVG = await loadSVG('assets/img/separador.svg');
      } catch {
        // Continuar sin separador
      }

      const docDefinition = buildDocDefinition(d, logoData, isSVG, separadorSVG);
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
    obtenerDatosFormulario
  };

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : this);
