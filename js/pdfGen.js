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
    espacioTablas: 14,
    // Espacio base reservado en el margen inferior para el pie de página principal
    footer: {
      baseHeight: 132
    }
  };

  /**
   * Calcula la altura del pie de página en función de los datos.
   *  - Base: 152 pt
   *  - +4 pt por cada elemento en imputacion[]
   *  - +6 pt si se muestran logos (proyecto.tipo === 'G24' o 'I24')
   * @param {Object} datos - Datos del formulario
   * @returns {number} Altura en puntos
   */
  function calcularAlturaFooter(datos) {
    let h = PDF_CONFIG.footer.baseHeight;
    const imputacion = datos.imputacion || [];
    h += imputacion.length * 12;
    const tipo = datos.proyecto?.tipo;
    if (tipo === 'G24' || tipo === 'I24') {
      h += 14;
    }
    return h;
  }
  

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
   * @param {string|null} logosGr24Base64 - Imagen logos_gr24 en Base64 (para pie de página)
   */
  function buildDocDefinition(datos, logoBase64, logoIsSVG = false, separadorSVG = null, logosGr24Base64 = null) {
    const margin = PDF_CONFIG.page.margin;
    const footerHeight = calcularAlturaFooter(datos);

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
      pageMargins: [margin, margin, margin, footerHeight],

      // ─────────────────────────────────────────────────────────────────────
      // IMÁGENES (para uso en footer)
      // ─────────────────────────────────────────────────────────────────────
      images: logosGr24Base64 ? { logosGr24: logosGr24Base64 } : {},

      // ─────────────────────────────────────────────────────────────────────
      // PIE DE PÁGINA (sección principal)
      // ─────────────────────────────────────────────────────────────────────
      footer: buildFooterPrincipal(datos, logosGr24Base64),

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
          italics: true,
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
            widths: [80, '*', 80],
            heights: [42],
            body: [
              [
                // Celda 1: Logo
                {
                  margin: [0, -8, 0, 0],
                  alignment: 'left',
                  stack: [
                    logoIsSVG
                      ? {
                        svg: logoBase64,
                        fit: [80, 50],
                        alignment: 'left'
                      }
                      : {
                        image: logoBase64,
                        fit: [80, 50],
                        alignment: 'left'
                      }
                  ]
                },
                // Celda 2: Título
                {
                  margin: [0, 3, 0, 0],
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
          margin: [0, -4, 0, 4]
        },

        // ═══════════════════════════════════════════════════════════════════
        // LÍNEA SEPARADORA
        // ═══════════════════════════════════════════════════════════════════
        separadorSVG ? {
          svg: separadorSVG,
          width: PDF_CONFIG.anchoUtil,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        } : {},

        // ═══════════════════════════════════════════════════════════════════
        // TABLAS DE DATOS
        // ═══════════════════════════════════════════════════════════════════
        
        // Tabla: Datos del beneficiario
        { unbreakable: true, stack: buildTablaBeneficiario(datos) },

        // Espaciador entre tablas
        { text: '', margin: [0, PDF_CONFIG.espacioTablas, 0, 0] },

        // Tabla: Datos del proyecto
        { unbreakable: true, stack: buildTablaProyecto(datos) },

        // Tabla de honorarios (si existe)
        ...buildTablaHonorarios(datos),

        // Tablas de desplazamientos
        ...buildTablasDesplazamientos(datos),

        // Tabla de desplazamiento especial (si existe)
        ...buildTablaDesplazamientoEspecial(datos),

        // Tabla de congresos (si existe y no está asociada a ningún desplazamiento)
        ...(() => {
          const evento = datos.evento || {};
          const desplazamientoAsociado = evento.desplazamientoAsociado;
          if (!desplazamientoAsociado) {
            return buildTablaCongresos(datos);
          }
          return [];
        })()

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
  function buildEncabezadoSeccion(texto, notaDerecha = null) {
    const headerRow = notaDerecha
      ? {
          columns: [
            { text: texto, style: 'tablaEncabezado', width: 'auto' },
            { text: notaDerecha.text, style: 'tablaNotaSmall', alignment: 'right', link: notaDerecha.link, decoration: notaDerecha.link ? 'underline' : undefined }
          ],
          margin: [0, 0, 0, 2]
        }
      : { text: texto, style: 'tablaEncabezado', margin: [0, 0, 0, 2] };

    return [
      headerRow,
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
    const v = datos.vehiculo || null;

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
    const encabezado = buildEncabezadoSeccion('BENEFICIARIO');
    
    // Tabla sin la fila de encabezado
    // Usar 4 columnas para soportar fila de vehículo; filas 1-3 usan colSpan
    const tabla = {
      table: {
        widths: ['25%', '25%', '25%', '*'],
        body: [
          // Fila 1: Nombre (50%) + DNI (50%)
          [
            {
              text: [
                { text: 'Nombre: ', style: 'tablaEtiqueta' },
                { text: b.nombre || '', style: 'tablaDato' }
              ],
              colSpan: 2
            },
            {},
            {
              text: [
                { text: 'DNI/Pasaporte: ', style: 'tablaEtiqueta' },
                { text: b.dni || '', style: 'tablaDato' }
              ],
              colSpan: 2
            },
            {}
          ],
          // Fila 2: Entidad (50%) + Categoría (50%)
          [
            {
              text: [
                { text: 'Entidad contratante: ', style: 'tablaEtiqueta' },
                { text: b.entidad || '', style: 'tablaDato' }
              ],
              colSpan: 2
            },
            {},
            {
              text: [
                { text: 'En calidad de: ', style: 'tablaEtiqueta' },
                { text: b.categoriaNombre || b.categoria || '', style: 'tablaDato' }
              ],
              colSpan: 2
            },
            {}
          ],
          // Fila 3: Vehículo particular (solo si tiene datos reales)
          ...(v && (v.marca || v.modelo || v.matricula) ? [[
            {
              text: [
                { text: `Vehículo particular (${v.tipo || ''}): `, style: 'tablaEtiqueta' }
              ]
            },
            {
              text: [
                { text: 'Marca: ', style: 'tablaEtiqueta' },
                { text: v.marca || '', style: 'tablaDato' }
              ]
            },
            {
              text: [
                { text: 'Modelo: ', style: 'tablaEtiqueta' },
                { text: v.modelo || '', style: 'tablaDato' }
              ]
            },
            {
              text: [
                { text: 'Matrícula: ', style: 'tablaEtiqueta' },
                { text: v.matricula || '', style: 'tablaDato' }
              ]
            }
          ]] : []),
          // Fila última: Datos de pago (100%)
          [
            { ...filaPago, colSpan: 4 },
            {},
            {},
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

    // Nota de normativa para el encabezado
    let notaNormativa;
    if (p.normativa === 'decreto') {
      notaNormativa = {
        text: 'Cálculos efectuados en base al Decreto 42/2025',
        link: 'https://doe.juntaex.es/otrosFormatos/html.php?xml=2025040078&anio=2025&doe=1010o'
      };
    } else {
      notaNormativa = {
        text: 'Cálculos efectuados en base al RD 462/2002',
        link: 'https://www.boe.es/buscar/act.php?id=BOE-A-2002-10337'
      };
    }

    // Encabezado con línea verde + nota normativa a la derecha
    const encabezado = buildEncabezadoSeccion('DATOS DEL PROYECTO', notaNormativa);

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
   * Construye la tabla de honorarios.
   * @param {Object} datos - Datos del formulario
   * @returns {Array} Array con encabezado y tabla (vacío si no hay datos)
   */
  function buildTablaHonorarios(datos) {
    const honorarios = datos.honorarios || {};
    if (!honorarios.importe) return [];

    // Encabezado con línea verde
    const encabezado = buildEncabezadoSeccion('HONORARIOS');

    // Layout: bordes horizontales sin borde superior
    const layoutSinBordeSuperior = {
      hLineWidth: (i) => i === 0 ? 0 : 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#cccccc',
      vLineColor: () => '#cccccc',
      paddingTop: () => 5
    };

    const bodyRows = [
      // Fila 1: En concepto de (colspan=2)
      [
        {
          text: [
            { text: 'En concepto de: ', style: 'tablaEtiqueta' },
            { text: honorarios.concepto || '', style: 'tablaDato' }
          ],
          colSpan: 2
        },
        {}
      ],
      // Fila 2: IMPORTE HONORARIOS
      [
        {
          text: 'IMPORTE HONORARIOS:',
          style: 'tablaEtiqueta',
          alignment: 'right'
        },
        {
          text: fmtEuro(parseEuroNumber(honorarios.importe)),
          style: 'tablaDato',
          alignment: 'right',
          bold: true
        }
      ]
    ];

    const tabla = {
      table: {
        widths: ['86%', '14%'],
        body: bodyRows
      },
      layout: layoutSinBordeSuperior,
      margin: [0, 0, 0, 0]
    };

    return [
      { text: '', margin: [0, PDF_CONFIG.espacioTablas, 0, 0] },
      { unbreakable: true, stack: [...encabezado, tabla] }
    ];
  }

  /**
   * Construye las tablas de desplazamientos (nacionales e internacionales).
   * @param {Object} datos - Datos del formulario
   * @returns {Array} Array con tablas para cada desplazamiento
   */
  function buildTablasDesplazamientos(datos) {
    const desplazamientos = datos.desplazamientos || [];
    const evento = datos.evento || {};
    const desplazamientoAsociado = evento.desplazamientoAsociado;
    const result = [];

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

    // Layout: bordes verticales + horizontales internos + borde inferior (sin borde superior)
    const layoutSinBordeSuperior = {
      hLineWidth: (i) => i === 0 ? 0 : 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#cccccc',
      vLineColor: () => '#cccccc',
      paddingTop: () => 5
    };

    // Layout: solo borde inferior y laterales, sin bordes internos ni superior
    const layoutSoloBordeInferior = {
      hLineWidth: (i, node) => i === node.table.body.length ? 0.5 : 0,
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 0.5 : 0,
      hLineColor: () => '#cccccc',
      vLineColor: () => '#cccccc',
      paddingTop: () => 5
    };

    // Layout: borde inferior + laterales + línea horizontal interna (sin borde superior)
    const layoutUltimaTabla = {
      hLineWidth: (i, node) => i === 0 ? 0 : 0.5,
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 0.5 : 0,
      hLineColor: () => '#cccccc',
      vLineColor: () => '#cccccc',
      paddingTop: () => 5
    };

    for (let despIdx = 0; despIdx < desplazamientos.length; despIdx++) {
      const desp = desplazamientos[despIdx];
      const dc = desp.datosCalculados || {};
      const esInternacional = desp.paisDestino !== 'España';

      // ─── 1. Encabezado con línea verde ───────────────────────────────────
      const encabezado = buildEncabezadoSeccion(`DESPLAZAMIENTO #${despIdx + 1}`);

      // ─── 2. Tabla de datos generales (2 filas, bordes completos) ─────────
      const fechasText = [
        { text: `${desp.fechaIda}, ${desp.horaIda} h — ${desp.fechaRegreso}, ${desp.horaRegreso} h`, style: 'tablaDato' }
      ];
      if (desp.ticketCena) {
        fechasText.push({ text: '     [ticket cena]', style: 'tablaNotaSmall' });
      }

      const origenDestinoText = esInternacional
        ? `${desp.origen || ''} — ${desp.destino || ''} (${desp.paisDestino})`
        : `${desp.origen || ''} — ${desp.destino || ''}`;

      const tablaDatosGenerales = {
        table: {
          widths: ['50%', '*'],
          body: [
            // Fila 1: Fechas | Origen — Destino
            [
              { text: fechasText },
              { text: origenDestinoText, style: 'tablaDato' }
            ],
            // Fila 2: Motivo (colspan=2)
            [
              {
                text: [
                  { text: 'Motivo: ', style: 'tablaEtiqueta' },
                  { text: desp.motivo || '', style: 'tablaDato' }
                ],
                colSpan: 2
              },
              {}
            ]
          ]
        },
        layout: layoutSinBordeSuperior,
        margin: [0, 0, 0, 0]
      };

      // ─── 3. Tablas de segmentos (solo internacional) ─────────────────────
      const tablasSegmentos = [];
      if (esInternacional && dc.segmentos && dc.segmentos.length > 0) {
        for (const seg of dc.segmentos) {
          tablasSegmentos.push({
            table: {
              widths: ['20%', '40%', '*'],
              body: [
                [
                  {
                    text: seg.titulo || '',
                    style: 'tablaEtiqueta',
                    color: '#407C2E'
                  },
                  {
                    text: `Manut: ${seg.numManutenciones || 0} × ${fmtEuro(seg.precioManutencion || 0)} = ${fmtEuro(seg.importeManutencion || 0)}`,
                    style: 'tablaEtiqueta'
                  },
                  {
                    text: `Aloj. máx: ${seg.numNoches || 0} × ${fmtEuro(seg.precioNoche || 0)} = ${fmtEuro(seg.importeMaxAlojamiento || 0)}`,
                    style: 'tablaEtiqueta'
                  }
                ]
              ]
            },
            layout: layoutSoloBordeInferior,
            margin: [0, 0, 0, 0]
          });
        }
      }

      // ─── 4. Tabla de importes (bordes solo exteriores) ───────────────────
      const factorResEv = dc.residenciaEventual ? ' × 80%' : '';
      const otrosGastos = desp.otrosGastos || [];

      // 4.1 – Líneas de etiquetas e importes
      const lineasEtiquetas = [];
      const lineasImportes = [];

      if (esInternacional) {
        // 4.1B – Internacional
        lineasEtiquetas.push({ text: 'Manutención total', style: 'tablaEtiqueta' });
        lineasEtiquetas.push({ text: `Alojamiento [ máximo: ${fmtEuro(dc.importeMaxAlojamiento || 0)} ]`, style: 'tablaEtiqueta' });
      } else {
        // 4.1A – Nacional
        const manutLabel = desp.noManutencion
          ? 'Manutención [ No incluida ]'
          : `Manutención [ ${dc.numManutenciones || 0} × ${fmtEuro(dc.precioManutencion || 0)}${factorResEv} ]`;
        lineasEtiquetas.push({ text: manutLabel, style: 'tablaEtiqueta' });
        lineasEtiquetas.push({
          text: `Alojamiento [ máx. ${dc.numNoches || 0} × ${fmtEuro(dc.precioNoche || 0)}${factorResEv} = ${fmtEuro(dc.importeMaxAlojamiento || 0)} ]`,
          style: 'tablaEtiqueta'
        });
      }

      // Importes correspondientes
      const alojamientoUsuario = parseEuroNumber(desp.alojamiento);
      const excedeMax = dc.excedeMaxAlojamiento;
      const importeKm = dc.importeKm || 0;

      // Manutención (siempre)
      lineasImportes.push({ text: fmtEuro(dc.importeManutencion || 0), style: 'tablaDato' });

      // Alojamiento: ocultar si 0 € y destino es España
      if (alojamientoUsuario > 0 || esInternacional) {
        lineasImportes.push(
          excedeMax
            ? { text: `* ${fmtEuro(alojamientoUsuario)}`, style: 'tablaDato', color: '#c50909', italics: true }
            : { text: fmtEuro(alojamientoUsuario), style: 'tablaDato' }
        );
      } else {
        // Quitar la etiqueta de alojamiento ya añadida
        lineasEtiquetas.pop();
      }

      // Kilometraje: ocultar si 0 €
      if (importeKm > 0) {
        lineasEtiquetas.push({ text: `Kilometraje [ ${desp.km || 0} × ${fmtEuro(dc.precioPorKm || 0)} ]`, style: 'tablaEtiqueta' });
        lineasImportes.push({ text: fmtEuro(importeKm), style: 'tablaDato' });
      }

      // Otros gastos (una línea por cada uno)
      for (const gasto of otrosGastos) {
        const nombreTipo = TIPOS_OTROS_GASTOS[gasto.tipo] || gasto.tipo || 'Otro';
        const concepto = gasto.concepto || '';
        const importeGasto = parseEuroNumber(gasto.importe);

        if (concepto) {
          lineasEtiquetas.push({
            text: [
              { text: `${nombreTipo}: `, style: 'tablaEtiqueta' },
              { text: concepto, style: 'tablaDato' }
            ]
          });
        } else {
          lineasEtiquetas.push({ text: nombreTipo, style: 'tablaEtiqueta' });
        }

        lineasImportes.push({ text: fmtEuro(importeGasto), style: 'tablaDato' });
      }

      // 4.2 – Fila de TOTAL
      const irpfSujeto = dc.irpfSujeto || 0;
      const importeTotal = dc.importeTotal || 0;

      const celdaIrpf = irpfSujeto > 0
        ? {
            text: [
              { text: 'Sujeto a retención por IRPF: ', style: 'tablaEtiqueta' },
              { text: fmtEuro(irpfSujeto), style: 'tablaDato' }
            ],
            alignment: 'left'
          }
        : { text: '' };

      // Celda del total (con formato especial si excede máximo alojamiento)
      const celdaTotal = excedeMax
        ? {
            text: `* ${fmtEuro(importeTotal)}`,
            style: 'tablaDato',
            alignment: 'right',
            bold: true,
            color: '#c50909',
            italics: true
          }
        : {
            text: fmtEuro(importeTotal),
            style: 'tablaDato',
            alignment: 'right',
            bold: true
          };

      const tablaImportes = {
        table: {
          widths: ['40%', '46%', '*'],
          body: [
            // Fila 1: Etiquetas (colspan=2) | Importes
            [
              { stack: lineasEtiquetas, alignment: 'right', colSpan: 2, lineHeight: 1.35 },
              {},
              { stack: lineasImportes, alignment: 'right', lineHeight: 1.35 }
            ],
            // Fila 2: IRPF | TOTAL | Importe total
            [
              celdaIrpf,
              {
                text: 'TOTAL:',
                style: 'tablaEtiqueta',
                alignment: 'right'
              },
              celdaTotal
            ]
          ]
        },
        layout: layoutUltimaTabla,
        margin: [0, 0, 0, 0]
      };

      // ─── Ensamblar resultado (unbreakable) ───────────────────────────────
      const despStack = [
        ...encabezado,
        tablaDatosGenerales,
        ...tablasSegmentos,
        tablaImportes
      ];
      result.push({ text: '', margin: [0, PDF_CONFIG.espacioTablas, 0, 0] });
      result.push({ unbreakable: true, stack: despStack });

      // Si este desplazamiento está asociado al evento/congreso, agregar tabla de congresos
      // Extraer número de "desp1" → 0, "desp2" → 1, o usar directamente si es número
      let indiceAsociado = null;
      if (desplazamientoAsociado) {
        const match = String(desplazamientoAsociado).match(/\d+/);
        if (match) {
          indiceAsociado = parseInt(match[0]) - 1; // "desp1" → 0, "desp2" → 1
        }
      }
      if (indiceAsociado !== null && indiceAsociado === despIdx) {
        result.push(...buildTablaCongresos(datos));
      }
    }

    return result;
  }

  /**
   * Construye la tabla del desplazamiento especial.
   * @param {Object} datos - Datos del formulario
   * @returns {Array} Array con encabezado y tabla (vacío si no hay datos)
   */
  function buildTablaDesplazamientoEspecial(datos) {
    const despEsp = datos.desplazamientoEspecial;
    if (!despEsp || !despEsp.lineas || despEsp.lineas.length === 0) return [];

    // Encabezado con línea verde
    const encabezado = buildEncabezadoSeccion('DESPLAZAMIENTO ESPECIAL');

    // Layout: todos los bordes horizontales excepto el superior
    const layoutConBordesH = {
      hLineWidth: (i, node) => i === 0 ? 0 : 0.5,
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 0.5 : 0,
      hLineColor: () => '#cccccc',
      vLineColor: () => '#cccccc',
      paddingTop: () => 5
    };

    const bodyRows = [];
    let etiquetasActuales = [];
    let importesActuales = [];

    for (const linea of despEsp.lineas) {
      if (linea.tipo === 'seccion') {
        // Si hay elementos acumulados, crear una fila con ellos
        if (etiquetasActuales.length > 0) {
          bodyRows.push([
            { stack: etiquetasActuales, alignment: 'right', colSpan: 2, lineHeight: 1.35 },
            {},
            { stack: importesActuales, alignment: 'right', lineHeight: 1.35 }
          ]);
          etiquetasActuales = [];
          importesActuales = [];
        }

        // Añadir la fila de sección
        bodyRows.push([
          {
            text: linea.descripcion || '',
            style: 'tablaEtiqueta',
            color: '#407C2E',
            colSpan: 3
          },
          {},
          {}
        ]);
      } else if (linea.tipo === 'normal') {
        const totalVal = parseEuroNumber(linea.total);
        const cantidad = (linea.cantidad || '').toString().trim();

        // Etiqueta: descripción + [ importe × cantidad ] si hay cantidad
        const labelText = cantidad !== ''
          ? `${linea.descripcion || ''} [ ${linea.importe || ''} × ${cantidad} ]`
          : (linea.descripcion || '');

        etiquetasActuales.push({
          text: labelText,
          style: 'tablaEtiqueta'
        });

        importesActuales.push({
          text: fmtEuro(totalVal),
          style: 'tablaDato',
          alignment: 'right'
        });
      }
    }

    // Si quedan elementos acumulados al final, crear una fila
    if (etiquetasActuales.length > 0) {
      bodyRows.push([
        { stack: etiquetasActuales, alignment: 'right', colSpan: 2, lineHeight: 1.35 },
        {},
        { stack: importesActuales, alignment: 'right', lineHeight: 1.35 }
      ]);
    }

    // Fila de TOTAL + IRPF
    const irpfVal = parseEuroNumber(despEsp.irpf);
    const totalVal = typeof despEsp.total === 'number' ? despEsp.total : parseEuroNumber(despEsp.total);

    const celdaIrpf = irpfVal > 0
      ? {
          text: [
            { text: 'Sujeto a retención por IRPF: ', style: 'tablaEtiqueta' },
            { text: fmtEuro(irpfVal), style: 'tablaDato' }
          ],
          alignment: 'left'
        }
      : { text: '' };

    bodyRows.push([
      celdaIrpf,
      {
        text: 'TOTAL:',
        style: 'tablaEtiqueta',
        alignment: 'right'
      },
      {
        text: fmtEuro(totalVal),
        style: 'tablaDato',
        alignment: 'right',
        bold: true
      }
    ]);

    const tabla = {
      table: {
        widths: ['40%', '46%', '*'],
        body: bodyRows
      },
      layout: layoutConBordesH,
      margin: [0, 0, 0, 0]
    };

    return [
      { text: '', margin: [0, PDF_CONFIG.espacioTablas, 0, 0] },
      { unbreakable: true, stack: [...encabezado, tabla] }
    ];
  }

  /**
   * Construye la tabla de congresos u otros eventos.
   * @param {Object} datos - Datos del formulario
   * @returns {Array} Array con encabezado y tabla (vacío si no hay datos)
   */
  function buildTablaCongresos(datos) {
    const evento = datos.evento;
    if (!evento || (!evento.nombre && !evento.gastosInscripcion)) return [];

    // Encabezado con línea verde
    const encabezado = buildEncabezadoSeccion('CONGRESOS U OTROS EVENTOS');

    // Layout: todos los bordes horizontales excepto el superior
    const layoutConBordesH = {
      hLineWidth: (i, node) => i === 0 ? 0 : 0.5,
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 0.5 : 0,
      hLineColor: () => '#cccccc',
      vLineColor: () => '#cccccc',
      paddingTop: () => 5
    };

    const bodyRows = [];

    // Fila 1: Nombre del evento (colspan=3)
    bodyRows.push([
      {
        text: [
          { text: 'Nombre del evento: ', style: 'tablaEtiqueta' },
          { text: evento.nombre || '', style: 'tablaDato' }
        ],
        alignment: 'left',
        colSpan: 3
      },
      {},
      {}
    ]);

    // Fila 2: Celebrado + Comidas incluidas
    const lugar = evento.lugar || '';
    const fechaDesde = evento.fechaDesde || '';
    const fechaHasta = evento.fechaHasta || '';
    const celebradoText = lugar
      ? `en ${lugar}, del ${fechaDesde} al ${fechaHasta}`
      : `del ${fechaDesde} al ${fechaHasta}`;

    bodyRows.push([
      {
        text: [
          { text: 'Celebrado: ', style: 'tablaEtiqueta' },
          { text: celebradoText, style: 'tablaDato' }
        ],
        alignment: 'left'
      },
      {
        text: [
          { text: 'Número de comidas o cenas incluidas: ', style: 'tablaEtiqueta' },
          { text: evento.comidasIncluidas || '0', style: 'tablaDato' }
        ],
        alignment: 'left',
        colSpan: 2
      },
      {}
    ]);

    // Fila 3: Gastos de inscripción
    const gastosInscripcion = parseEuroNumber(evento.gastosInscripcion);
    bodyRows.push([
      {
        text: 'GASTOS DE INSCRIPCIÓN:',
        style: 'tablaEtiqueta',
        alignment: 'right',
        colSpan: 2
      },
      {},
      {
        text: fmtEuro(gastosInscripcion),
        style: 'tablaDato',
        alignment: 'right',
        bold: true
      }
    ]);

    const tabla = {
      table: {
        widths: ['50%', '36%', '14%'],
        body: bodyRows
      },
      layout: layoutConBordesH,
      margin: [0, 0, 0, 0]
    };

    return [
      { text: '', margin: [0, PDF_CONFIG.espacioTablas, 0, 0] },
      { unbreakable: true, stack: [...encabezado, tabla] }
    ];
  }

  // =========================================================================
  // PIE DE PÁGINA (sección principal)
  // =========================================================================

  /**
   * Construye la función footer para la sección principal del PDF.
   * @param {Object} datos - Datos del formulario
   * @param {string|null} logosGr24Base64 - Imagen logos_gr24 en Base64
   * @returns {Function} Función footer(currentPage, pageCount) para pdfmake
   */
  function buildFooterPrincipal(datos, logosGr24Base64) {
    const imputacion = datos.imputacion || [];
    const beneficiario = datos.beneficiario || {};
    const proyecto = datos.proyecto || {};

    // Responsables únicos (sin repetir)
    const responsablesUnicos = [...new Set(
      imputacion.map(imp => imp.responsable).filter(Boolean)
    )];

    const textoFdoResponsable = responsablesUnicos.length > 1
      ? 'Fdo: los/las responsables del gasto,'
      : 'Fdo: el/la responsable del gasto,';

    const mostrarLogos = (proyecto.tipo === 'G24' || proyecto.tipo === 'I24') && !!logosGr24Base64;

    return function (currentPage, pageCount) {
      const m = PDF_CONFIG.page.margin;

      // Fila 4: logos (columnas 2-3) o vacía
      const celdaLogos = mostrarLogos
        ? { image: 'logosGr24', fit: [PDF_CONFIG.anchoUtil * 0.84, 28], alignment: 'center', colSpan: 2 }
        : { text: '', colSpan: 2 };

      return {
        margin: [m, 0, m, 0],
        table: {
          widths: ['8%', '42%', '42%', '8%'],
          // Reservar altura para la zona de firma (fila 1) y para la fila de logos/paginación (fila 3)
          heights: (row) => row === 1 ? 56.7 : undefined,
          body: [
            // Fila 1: Conforme (colspan=4)
            [
              {
                text: 'Conforme, en ______________ a ____ de ______________ de _______',
                style: 'tablaDato',
                alignment: 'center',
                colSpan: 4
              },
              {},
              {},
              {}
            ],
            // Fila 2: espacio vacío (2 cm ≈ 56,7 pt — controlado por heights)
            [
              { text: '', colSpan: 4 },
              {},
              {},
              {}
            ],
            // Fila 3: Fdo + nombres responsables (colspan=2) | Fdo + nombre beneficiario (colspan=2)
            [
              {
                stack: [
                  { text: textoFdoResponsable, style: 'tablaDato', alignment: 'center' },
                  { text: responsablesUnicos.join('\n'), style: 'tablaDato', alignment: 'center' }
                ],
                lineHeight: 1.20,
                colSpan: 2
              },
              {},
              {
                stack: [
                  { text: 'Fdo.: el/la beneficiario/a,', style: 'tablaDato', alignment: 'center' },
                  { text: beneficiario.nombre || '', style: 'tablaDato', alignment: 'center' }
                ],
                lineHeight: 1.20,
                colSpan: 2
              },
              {}
            ],
            // Fila 4: vacía | logos (colspan=2) | Paginación
            [
              { text: '' },
              celdaLogos,
              {},
              { text: `pág. ${currentPage}/${pageCount}`, style: 'tablaEtiqueta', alignment: 'right' }
            ]
          ]
        },
        layout: {
          defaultBorder: false
        }
      };
    };
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

      // Cargar logos GR24 (para pie de página)
      let logosGr24Base64 = null;
      try {
        logosGr24Base64 = await loadImageAsBase64('assets/img/logos_gr24.png');
        console.log('[pdfGen] Logos GR24 cargado');
      } catch (e) {
        console.warn('[pdfGen] No se pudo cargar logos_gr24.png');
      }

      console.log('[pdfGen] Generando PDF...');
      const docDefinition = buildDocDefinition(d, logoData, isSVG, separadorSVG, logosGr24Base64);

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

      // Cargar logos GR24 (para pie de página)
      let logosGr24Base64 = null;
      try {
        logosGr24Base64 = await loadImageAsBase64('assets/img/logos_gr24.png');
      } catch {
        // Continuar sin logos
      }

      const docDefinition = buildDocDefinition(d, logoData, isSVG, separadorSVG, logosGr24Base64);
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
        preview();
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
