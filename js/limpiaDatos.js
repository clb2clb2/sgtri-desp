/**
 * limpiaDatos.js
 * ===============
 * Módulo centralizado de sanitización, formateo y parsing de datos.
 * Expone funciones puras para limpiar y validar entradas del usuario.
 *
 * @module limpiaDatos
 */
(function (global) {
  'use strict';

  // =========================================================================
  // SANITIZADORES DE TEXTO
  // =========================================================================

  /**
   * Sanea texto general: letras, números, espacios y caracteres básicos de puntuación.
   * @param {string} value - Valor a sanear
   * @param {number} [maxLen] - Longitud máxima opcional
   * @returns {string} Valor saneado
   */
  function sanitizeGeneralText(value, maxLen) {
    try {
      return String(value || '').replace(/[^0-9A-Za-z\u00C0-\u017F\u0180-\u024F .,\-()&']/g, '').slice(0, maxLen || undefined);
    } catch (err) {
      return String(value || '').slice(0, maxLen || undefined);
    }
  }

  /**
   * Sanea referencias de proyecto: permite letras, números, barras y puntuación básica.
   * @param {string} value - Valor a sanear
   * @param {number} [maxLen] - Longitud máxima opcional
   * @returns {string} Valor saneado
   */
  function sanitizeReferencia(value, maxLen) {
    try {
      return String(value || '').replace(/[^0-9A-Za-z\u00C0-\u017F\u0180-\u024F\/ .,\-()&']/g, '').slice(0, maxLen || undefined);
    } catch (err) {
      return String(value || '').slice(0, maxLen || undefined);
    }
  }

  /**
   * Sanea y formatea IBAN: solo alfanuméricos, mayúsculas, agrupado en bloques de 4.
   * @param {string} value - Valor a sanear
   * @param {number} [maxLen=24] - Longitud máxima de caracteres raw
   * @returns {string} IBAN formateado
   */
  function sanitizeIBAN(value, maxLen) {
    try {
      const raw = String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, maxLen || 24);
      const parts = raw.match(/.{1,4}/g) || [];
      return parts.join(' ');
    } catch (err) {
      return String(value || '').slice(0, maxLen || undefined).toUpperCase();
    }
  }

  /**
   * Sanea DNI/NIF: solo alfanuméricos, puntos y guiones, mayúsculas.
   * @param {string} value - Valor a sanear
   * @param {number} [maxLen=20] - Longitud máxima
   * @returns {string} DNI saneado
   */
  function sanitizeDNI(value, maxLen) {
    try {
      return String(value || '').replace(/[^A-Za-z0-9.-]/g, '').slice(0, maxLen || 20).toUpperCase();
    } catch (err) {
      return String(value || '').slice(0, maxLen || 20).toUpperCase();
    }
  }

  /**
   * Formatea código de orgánica: pares de caracteres separados por puntos.
   * @param {string} value - Valor a formatear
   * @returns {string} Orgánica formateada (ej: "AB.CD.EF")
   */
  function formatOrganica(value) {
    try {
      const only = String(value || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 14).toUpperCase();
      const parts = only.match(/.{1,2}/g) || [];
      return parts.join('.');
    } catch (err) {
      return String(value || '').slice(0, 21).toUpperCase();
    }
  }

  // =========================================================================
  // FORMATEO AGRUPADO (IBAN, Tarjetas, etc.)
  // =========================================================================

  /**
   * Formatea un string raw en grupos con separador.
   * @param {string} raw - String sin formato
   * @param {number} groupSize - Tamaño de cada grupo
   * @param {string} sep - Separador entre grupos
   * @param {boolean} [includeTrailingSep=false] - Añadir separador al final si grupo completo
   * @param {number} [maxRawLen] - Longitud máxima raw
   * @returns {string} String formateado
   */
  function formatGroupedRaw(raw, groupSize, sep, includeTrailingSep, maxRawLen) {
    if (!raw) return '';
    const parts = raw.match(new RegExp('.{1,' + groupSize + '}', 'g')) || [];
    let out = parts.join(sep);
    if (includeTrailingSep && raw.length > 0 && raw.length % groupSize === 0) {
      if (!maxRawLen || raw.length < maxRawLen) out = out + sep;
    }
    return out;
  }

  /**
   * Procesa un input agrupado preservando la posición del caret.
   * @param {HTMLInputElement} inputEl - Elemento input
   * @param {Object} opts - Opciones de formateo
   * @param {number} opts.groupSize - Tamaño de grupo
   * @param {string} opts.sep - Separador
   * @param {number} opts.maxRawLen - Longitud máxima raw
   * @param {string} opts.validPattern - Patrón regex para caracteres válidos
   * @param {Function} [opts.transformRaw] - Función opcional de transformación
   * @returns {boolean} true si se aplicó el formateo
   */
  function processGroupedInput(inputEl, opts) {
    try {
      const { groupSize, sep, maxRawLen, validPattern, transformRaw } = opts;
      const oldValue = inputEl.value || '';
      const selStart = inputEl.selectionStart || 0;

      const validRegex = new RegExp(validPattern, 'g');
      const charsBefore = (oldValue.slice(0, selStart).match(validRegex) || []).length;

      const rawAll = (oldValue.match(validRegex) || []).join('');
      const newRaw = (rawAll || '').slice(0, maxRawLen || rawAll.length);
      const finalRaw = transformRaw ? transformRaw(newRaw) : newRaw;

      const justCompletedGroup = (finalRaw.length > 0) && (finalRaw.length % groupSize === 0) && (finalRaw.length < (maxRawLen || Infinity));
      const formatted = formatGroupedRaw(finalRaw, groupSize, sep, justCompletedGroup, maxRawLen);

      const oldRawAll = (inputEl._lastRawValue) || '';
      const wasInsert = finalRaw.length > (oldRawAll.length || 0);

      let rawPos = charsBefore;
      if (wasInsert && rawPos > 0 && rawPos % groupSize === 0) {
        rawPos = rawPos + 1;
      }

      function rawPosToFormattedIndex(rPos) {
        if (rPos <= 0) return 0;
        const fullGroups = Math.floor(rPos / groupSize);
        const rem = rPos % groupSize;
        let idx = fullGroups * (groupSize + sep.length) + rem;
        return Math.min(idx, formatted.length);
      }

      inputEl.value = formatted;
      const newIndex = rawPosToFormattedIndex(rawPos);
      inputEl.setSelectionRange(newIndex, newIndex);

      inputEl._lastRawValue = finalRaw;
      return true;
    } catch (err) {
      try {
        const raw = ((inputEl.value || '').match(new RegExp(opts.validPattern, 'g')) || []).join('').slice(0, opts.maxRawLen || undefined);
        inputEl.value = formatGroupedRaw(raw, opts.groupSize, opts.sep);
      } catch (e) { /* ignore */ }
      return false;
    }
  }

  // =========================================================================
  // PARSERS DE FECHA Y HORA
  // =========================================================================

  /**
   * Valida si una fecha es real (considera días por mes y años bisiestos).
   * @param {number} d - Día
   * @param {number} m - Mes (1-12)
   * @param {number} y - Año completo (ej: 2025)
   * @returns {boolean} true si la fecha es válida
   */
  function isValidDate(d, m, y) {
    if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1) return false;
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= daysInMonth[m - 1];
  }

  /**
   * Parsea una fecha en formato dd/mm/aa o d/m/aa (permisivo).
   * @param {string} ddmmaa - Fecha en formato dd/mm/aa o variantes
   * @returns {Date|null} Objeto Date o null si inválida
   */
  function parseDateStrict(ddmmaa) {
    if (!ddmmaa) return null;
    const parts = String(ddmmaa).split('/').map(p => p.trim());
    if (parts.length !== 3) return null;
    // Permitir 1 o 2 dígitos para día/mes, 2 o 4 para año
    if (parts[0].length < 1 || parts[0].length > 2) return null;
    if (parts[1].length < 1 || parts[1].length > 2) return null;
    if (parts[2].length < 2 || parts[2].length > 4) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y = 2000 + y;
    if (!isValidDate(d, m, y)) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  /**
   * Parsea una hora en formato hh:mm estricto.
   * @param {string} hhmm - Hora en formato hh:mm o h:mm
   * @returns {{hh: number, mm: number}|null} Objeto con horas y minutos o null si inválida
   */
  function parseTimeStrict(hhmm) {
    if (!hhmm) return null;
    const raw = String(hhmm).trim();
    const m = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m) return null;
    const hh = parseInt(m[1], 10);
    let mm = (typeof m[2] !== 'undefined' && m[2] !== '') ? parseInt(m[2], 10) : 0;
    if (isNaN(hh) || isNaN(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { hh, mm };
  }

  /**
   * Formatea un valor de fecha (normaliza a dd/mm/aa).
   * @param {string} value - Valor de entrada
   * @returns {string} Fecha formateada o valor original si no tiene suficientes datos
   */
  function formatFechaValue(value) {
    if (!value) return '';
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length < 6) return value;
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    let a = digits.slice(4, 6);
    if (digits.length >= 8) a = digits.slice(6, 8);
    return `${d}/${m}/${a}`;
  }

  // =========================================================================
  // PARSERS NUMÉRICOS
  // =========================================================================

  /**
   * Parsea un número con tolerancia a formatos europeos/internacionales.
   * Delegamos a utils.parseNumber si está disponible, sino usamos implementación local.
   * @param {string|number} str - Valor a parsear
   * @returns {number} Número parseado (0 si no es válido)
   */
  function parseNumber(str) {
    // Usar utils.parseNumber si está disponible
    if (global.utils && typeof global.utils.parseNumber === 'function') {
      return global.utils.parseNumber(str);
    }
    // Fallback para compatibilidad
    if (!str && str !== 0) return 0;
    try {
      const s = String(str || '').trim();
      if (s === '') return 0;
      let cleaned = s.replace(/€/g, '').replace(/km/g, '').replace(/\s/g, '');
      if (/,/.test(cleaned) && /\./.test(cleaned)) {
        cleaned = cleaned.replace(/\./g, '');
      } else if (/\./.test(cleaned) && !/,/.test(cleaned)) {
        if (/\.\d{3}(?!\d)/.test(cleaned)) {
          cleaned = cleaned.replace(/\./g, '');
        }
      }
      cleaned = cleaned.replace(/,/g, '.');
      cleaned = cleaned.replace(/[^0-9.\-]/g, '');
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  // =========================================================================
  // HELPERS DE INPUT CON PRESERVACIÓN DE CARET
  // =========================================================================

  /**
   * Aplica una transformación al valor de un input preservando la posición del caret.
   * @param {HTMLInputElement} inputEl - Elemento input
   * @param {Function} transformFn - Función de transformación (value, selStart, selEnd) => newValue
   * @returns {boolean} true si el valor cambió
   */
  function applyWithCaretPreserved(inputEl, transformFn) {
    try {
      const selectionStart = inputEl.selectionStart;
      const selectionEnd = inputEl.selectionEnd;
      const oldValue = inputEl.value;
      const newValue = transformFn(oldValue, selectionStart, selectionEnd);
      if (newValue === oldValue) return false;

      const lenDiff = newValue.length - oldValue.length;
      inputEl.value = newValue;

      const basePos = (selectionEnd != null ? selectionEnd : selectionStart) || 0;
      const newPos = Math.max(0, basePos + lenDiff);
      inputEl.setSelectionRange(newPos, newPos);
      return true;
    } catch (err) {
      try {
        inputEl.value = transformFn(inputEl.value, inputEl.selectionStart, inputEl.selectionEnd);
      } catch (e) {
        inputEl.value = transformFn(inputEl.value);
      }
      return true;
    }
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const limpiaDatos = {
    // Sanitizadores
    sanitizeGeneralText,
    sanitizeReferencia,
    sanitizeIBAN,
    sanitizeDNI,
    formatOrganica,

    // Formateo agrupado
    formatGroupedRaw,
    processGroupedInput,

    // Parsers de fecha/hora
    isValidDate,
    parseDateStrict,
    parseTimeStrict,
    formatFechaValue,

    // Parsers numéricos
    parseNumber,

    // Helpers
    applyWithCaretPreserved
  };

  // Exponer globalmente
  global.limpiaDatos = limpiaDatos;

  // Compatibilidad: exponer parseNumber en formLogic si existe
  if (global.formLogic) {
    global.formLogic.parseNumber = parseNumber;
  }

})(typeof window !== 'undefined' ? window : this);
