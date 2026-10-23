/**
 * utils.js
 * =========
 * Módulo de utilidades compartidas para toda la aplicación.
 * Centraliza funciones de formateo, parsing, debounce y logging.
 *
 * @module utils
 */
(function (global) {
  'use strict';

  // =========================================================================
  // FORMATEO DE NÚMEROS
  // =========================================================================

  /**
   * Formatea número a string con separador de miles alemán.
   * @param {number} n - Número a formatear
   * @param {number} [decimales=2] - Decimales mínimos y máximos
   * @returns {string} Número formateado (ej: "1.234,56")
   */
  function fmt(n, decimales = 2) {
    return (Number(n) || 0).toLocaleString('de-DE', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    });
  }

  /**
   * Formatea precio unitario sin redondear (hasta 3 decimales si los tiene).
   * Ejemplo: 0.106 → "0,106", 0.26 → "0,26"
   * @param {number} n - Número a formatear
   * @returns {string} Número formateado
   */
  function fmtPrecio(n) {
    const num = Number(n) || 0;
    const str = num.toString();
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    const maxDecimals = Math.max(2, Math.min(decimals, 3));
    return num.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: maxDecimals
    });
  }

  // =========================================================================
  // PARSING DE NÚMEROS
  // =========================================================================

  /**
   * Parsea un número con tolerancia a formatos europeos/internacionales.
   * Acepta comas y puntos como separadores decimales/miles.
   * Heurística: punto seguido de exactamente 3 dígitos (ej: 1.500) = miles (europeo).
   * @param {string|number} str - Valor a parsear
   * @returns {number} Número parseado (0 si no es válido)
   */
  function parseNumber(str) {
    if (typeof str === 'number') return str;
    if (!str && str !== 0) return 0;
    try {
      let s = String(str).trim();
      if (s === '') return 0;
      
      // Eliminar símbolos de moneda y unidades
      s = s.replace(/[€$£¥]/g, '').replace(/km/gi, '').replace(/\s/g, '');
      
      // Determinar formato según presencia y posición de separadores
      const hasComma = s.includes(',');
      const hasDot = s.includes('.');
      const lastComma = s.lastIndexOf(',');
      const lastDot = s.lastIndexOf('.');
      
      if (hasComma && hasDot) {
        // Hay ambos separadores
        if (lastComma > lastDot) {
          // Formato europeo: 1.234,56 → quitar puntos, coma a punto
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          // Formato anglosajón: 1,234.56 → quitar comas
          s = s.replace(/,/g, '');
        }
      } else if (hasComma) {
        // Solo coma: 123,45 → coma a punto (decimal europeo)
        s = s.replace(',', '.');
      } else if (hasDot) {
        // Solo punto: verificar si es miles europeo o decimal
        // Patrón europeo: punto(s) seguido(s) de exactamente 3 dígitos cada uno
        if (/\.\d{3}(?!\d)/.test(s)) {
          // Es separador de miles europeo (ej: 1.500 o 1.234.567)
          s = s.replace(/\./g, '');
        }
        // Si no cumple el patrón, asumimos que es decimal (ej: 1.5)
      }
      
      // Limpiar caracteres no numéricos excepto punto decimal y signo negativo
      s = s.replace(/[^0-9.\-]/g, '');
      
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  // =========================================================================
  // UTILIDADES MATEMÁTICAS
  // =========================================================================

  /**
   * Redondea a 2 decimales evitando errores de punto flotante.
   * @param {number} n - Número a redondear
   * @returns {number} Número redondeado
   */
  function round2(n) {
    return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
  }

  // =========================================================================
  // DEBOUNCE Y THROTTLE
  // =========================================================================

  /**
   * Crea una función con debounce que retrasa su ejecución.
   * @param {Function} fn - Función a ejecutar
   * @param {number} delay - Milisegundos de espera
   * @returns {Function} Función con debounce
   */
  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // =========================================================================
  // ACCESO A DATOS GLOBALES
  // =========================================================================

  /**
   * Obtiene los datos globales de la aplicación de forma segura.
   * @returns {Object} Datos de la aplicación o objeto vacío
   */
  function getSgtriDatos() {
    return global.__sgtriDatos || {};
  }

  // =========================================================================
  // REGLAS COMPARTIDAS
  // =========================================================================

  /**
   * Normativa aplicable según el tipo de proyecto (datos.json → normativasPorTipoProyecto.rd).
   * Todo lo que no es RD 462/2002 se calcula con el Decreto 42/2025.
   * @param {string} tipoProyecto - Código del tipo de proyecto (G24, UEX…)
   * @returns {'rd'|'decreto'}
   */
  function getNormativa(tipoProyecto) {
    const rd = getSgtriDatos().normativasPorTipoProyecto?.rd;
    return Array.isArray(rd) && rd.includes(tipoProyecto) ? 'rd' : 'decreto';
  }

  /**
   * Indica si un país (nombre del select) es extranjero. España es el país de origen.
   * @param {string} pais - Nombre del país
   * @returns {boolean}
   */
  function esPaisInternacional(pais) {
    const nombre = String(pais || '').trim();
    return nombre !== '' && nombre !== 'España';
  }

  /**
   * Validación del orden de los cruces de frontera:
   * fechaIda <= cruceIda <= cruceVuelta <= fechaRegreso (solo se comparan las fechas presentes).
   * @param {Date|null} fechaIda
   * @param {Date|null} cruceIda
   * @param {Date|null} cruceVuelta
   * @param {Date|null} fechaRegreso
   * @returns {boolean} true si el orden es correcto
   */
  function ordenCrucesValido(fechaIda, cruceIda, cruceVuelta, fechaRegreso) {
    if (fechaIda && cruceIda && cruceIda < fechaIda) return false;
    if (cruceIda && cruceVuelta && cruceVuelta < cruceIda) return false;
    if (cruceVuelta && fechaRegreso && cruceVuelta > fechaRegreso) return false;
    return true;
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const utils = {
    // Formateo
    fmt,
    fmtPrecio,

    // Parsing
    parseNumber,

    // Matemáticas
    round2,

    // Timing
    debounce,

    // Datos globales
    getSgtriDatos,

    // Reglas compartidas
    getNormativa,
    esPaisInternacional,
    ordenCrucesValido
  };

  global.utils = utils;

})(typeof window !== 'undefined' ? window : this);
