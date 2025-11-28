/**
 * validaciones.js
 * ================
 * Módulo de validación de fechas, horas y cruces de fronteras.
 * Gestiona la lógica de validación y actualización de UI para campos temporales.
 *
 * @module validaciones
 * @requires limpiaDatos
 */
(function (global) {
  'use strict';

  // Dependencias
  const ld = global.limpiaDatos || {};

  // =========================================================================
  // HELPERS INTERNOS
  // =========================================================================

  /**
   * Calcula la suma de importes que no son manutención (km, alojamiento, otros gastos).
   * @param {HTMLElement} desp - Elemento del desplazamiento
   * @returns {number} Suma de importes
   */
  function sumNonManutencionAmounts(desp) {
    try {
      if (!desp) return 0;
      if (global.calculoDesp && typeof global.calculoDesp.collectDataFromFicha === 'function') {
        const data = global.calculoDesp.collectDataFromFicha(desp) || {};
        const parse = (global.calculoDesp && typeof global.calculoDesp.parseNumber === 'function')
          ? global.calculoDesp.parseNumber
          : (ld.parseNumber || ((v) => parseFloat(String(v || '').replace(/[^0-9,.\-]/g, '').replace(/,/g, '.')) || 0));
        const km = Math.abs(parse(data.km || 0));
        const aloj = Math.abs(parse(data.alojamiento || 0));
        const otros = (Array.isArray(data.otrosGastos) ? data.otrosGastos.reduce((a, v) => a + Math.abs(parse(v)), 0) : 0);
        return km + aloj + otros;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }

  // =========================================================================
  // VALIDACIÓN DE FECHA/HORA
  // =========================================================================

  /**
   * Valida que la fecha/hora de regreso sea posterior a la de salida.
   * Actualiza la UI: aplica/remueve clase de error y oculta calc-result si hay error.
   * @param {string|number} id - ID del desplazamiento
   * @returns {boolean} true si la validación es correcta
   */
  function validateDateTimePairAndUpdateUI(id) {
    try {
      const fechaIdEl = document.getElementById(`fecha-ida-${id}`);
      const horaIdEl = document.getElementById(`hora-ida-${id}`);
      const fechaRegEl = document.getElementById(`fecha-regreso-${id}`);
      const horaRegEl = document.getElementById(`hora-regreso-${id}`);
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      
      if (!fechaIdEl || !horaIdEl || !fechaRegEl || !horaRegEl) return true;

      const parseDateStrict = ld.parseDateStrict || global.parseDateStrict || (() => null);
      const parseTimeStrict = ld.parseTimeStrict || global.parseTimeStrict || (() => null);

      const fId = parseDateStrict(fechaIdEl.value);
      const fReg = parseDateStrict(fechaRegEl.value);
      const tId = parseTimeStrict(horaIdEl.value);
      const tReg = parseTimeStrict(horaRegEl.value);

      const calc = desp ? desp.querySelector('.calc-result') : null;
      const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;

      // Formato inválido en algún campo
      const anyInvalidFormat = (!fId && fechaIdEl.value) || (!fReg && fechaRegEl.value) || 
                               (!tId && horaIdEl.value) || (!tReg && horaRegEl.value);
      
      if (anyInvalidFormat) {
        if (desp) desp.dataset.dtInvalid = '1';
        const otherSum = sumNonManutencionAmounts(desp);
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
          if (just) just.style.display = 'none';
        } else {
          if (calc) calc.style.display = 'none';
          if (just) just.style.display = 'none';
        }
        return false;
      }

      // Campos vacíos con flag de inválido previo
      if (!fId || !fReg || !tId || !tReg) {
        if (desp && desp.dataset && desp.dataset.dtInvalid === '1') {
          const otherSum = sumNonManutencionAmounts(desp);
          if (otherSum > 0) {
            if (calc) calc.style.display = '';
            if (just) just.style.display = 'none';
            return false;
          }
          if (calc) calc.style.display = 'none';
          if (just) just.style.display = 'none';
          return false;
        }
        [fechaIdEl, horaIdEl, fechaRegEl, horaRegEl].forEach(n => n && n.classList && n.classList.remove('field-error'));
        if (calc) calc.style.display = '';
        if (just) just.style.display = '';
        return true;
      }

      // Construir objetos Date completos
      const dtId = new Date(fId.getFullYear(), fId.getMonth(), fId.getDate(), tId.hh, tId.mm, 0, 0);
      const dtReg = new Date(fReg.getFullYear(), fReg.getMonth(), fReg.getDate(), tReg.hh, tReg.mm, 0, 0);

      // Validar orden
      if (dtReg <= dtId) {
        if (desp) desp.dataset.dtInvalid = '1';
        [fechaIdEl, horaIdEl, fechaRegEl, horaRegEl].forEach(n => n && n.classList && n.classList.add('field-error'));
        const otherSum = sumNonManutencionAmounts(desp);
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
          if (just) just.style.display = 'none';
        } else {
          if (calc) calc.style.display = 'none';
          if (just) just.style.display = 'none';
        }
        return false;
      }

      // OK: limpiar errores
      if (desp && desp.dataset && desp.dataset.dtInvalid) delete desp.dataset.dtInvalid;
      [fechaIdEl, horaIdEl, fechaRegEl, horaRegEl].forEach(n => n && n.classList && n.classList.remove('field-error'));
      if (calc) calc.style.display = '';
      if (just) just.style.display = '';

      // Eliminar mensaje de error si existe
      try {
        const existingMsg = desp ? desp.querySelector(`#dt-order-error-${id}`) : null;
        if (existingMsg && existingMsg.parentNode) existingMsg.parentNode.removeChild(existingMsg);
      } catch (e) { /* ignore */ }

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Valida las fechas de cruce de fronteras respecto a salida/regreso.
   * @param {string|number} id - ID del desplazamiento
   * @returns {boolean} true si la validación es correcta
   */
  function validateCrucesAndUpdateUI(id) {
    try {
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (!desp) return true;

      const fechaIdEl = document.getElementById(`fecha-ida-${id}`);
      const fechaRegEl = document.getElementById(`fecha-regreso-${id}`);
      const cruceIdEl = document.getElementById(`cruce-ida-${id}`);
      const cruceVueltaEl = document.getElementById(`cruce-vuelta-${id}`);
      const calc = desp.querySelector('.calc-result');

      const parseDateStrict = ld.parseDateStrict || global.parseDateStrict || (() => null);

      // Determinar si es internacional
      const paisEl = desp.querySelector(`#pais-destino-${id}`);
      const isInternational = paisEl && paisEl.value && 
                              String(paisEl.value).trim() !== '' && 
                              String(paisEl.value).trim() !== 'España';

      // Si no hay campos de cruce y no es internacional, OK
      if (!cruceIdEl || !cruceVueltaEl) {
        if (!isInternational) return true;
        if (desp) desp.dataset.dtInvalid = '1';
        const otherSum = sumNonManutencionAmounts(desp);
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
        } else {
          if (calc) calc.style.display = 'none';
        }
        return false;
      }

      // Internacional con cruces vacíos
      if (isInternational && (String(cruceIdEl.value || '').trim() === '' || String(cruceVueltaEl.value || '').trim() === '')) {
        if (desp) desp.dataset.dtInvalid = '1';
        const otherSum = sumNonManutencionAmounts(desp);
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
        } else {
          if (calc) calc.style.display = 'none';
        }
        return false;
      }

      const fId = parseDateStrict(fechaIdEl && fechaIdEl.value);
      const fReg = parseDateStrict(fechaRegEl && fechaRegEl.value);
      const cId = parseDateStrict(cruceIdEl && cruceIdEl.value);
      const cV = parseDateStrict(cruceVueltaEl && cruceVueltaEl.value);

      // Formato inválido en cruces
      const anyInvalidFormat = ((!cId && cruceIdEl.value) || (!cV && cruceVueltaEl.value));
      if (anyInvalidFormat) {
        if (desp) desp.dataset.dtInvalid = '1';
        const otherSum = sumNonManutencionAmounts(desp);
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
        } else {
          if (calc) calc.style.display = 'none';
        }
        return false;
      }

      // Cruces vacíos con flag de inválido
      if (!cId || !cV) {
        if (desp && desp.dataset && desp.dataset.dtInvalid === '1') {
          const otherSum = sumNonManutencionAmounts(desp);
          if (otherSum > 0) {
            if (calc) calc.style.display = '';
            return false;
          }
          if (calc) calc.style.display = 'none';
          return false;
        }
        [cruceIdEl, cruceVueltaEl].forEach(n => n && n.classList && n.classList.remove('field-error'));
        return true;
      }

      // Validar orden: fechaId <= cruceId <= cruceVuelta <= fechaRegreso
      let orderingOk = true;
      if (fId && cId && cId < fId) orderingOk = false;
      if (fReg && cV && cV > fReg) orderingOk = false;
      if (cId && cV && cV < cId) orderingOk = false;

      if (!orderingOk) {
        [cruceIdEl, cruceVueltaEl].forEach(n => n && n.classList && n.classList.add('field-error'));
        const otherSum = sumNonManutencionAmounts(desp);
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
        } else {
          if (calc) calc.style.display = 'none';
        }
        return false;
      }

      // OK: limpiar errores
      [cruceIdEl, cruceVueltaEl].forEach(n => n && n.classList && n.classList.remove('field-error'));
      if (desp && desp.dataset && desp.dataset.dtInvalid) delete desp.dataset.dtInvalid;
      
      try {
        const existingMsg = desp.querySelector(`#cruce-order-error-${id}`);
        if (existingMsg && existingMsg.parentNode) existingMsg.parentNode.removeChild(existingMsg);
      } catch (e) { /* ignore */ }

      return true;
    } catch (e) {
      return true;
    }
  }

  // =========================================================================
  // HANDLERS DE BLUR PARA CAMPOS DE FECHA/HORA
  // =========================================================================

  /**
   * Handler de blur para campos de fecha. Valida y formatea el valor.
   * @param {Event} e - Evento blur
   */
  function handleFechaBlur(e) {
    const el = e.target;
    if (!el || !el.classList || !el.classList.contains('input-fecha')) return;

    const isValidDate = ld.isValidDate || global.isValidDate || (() => false);
    const formatFechaValue = ld.formatFechaValue || global.formatFechaValue || ((v) => v);

    const v = (el.value || '').trim();
    const digits = (v.replace(/[^0-9]/g, '') || '');
    let final = '';

    if (digits.length === 4) {
      // Si el usuario escribió ddmm, completar con año actual
      const yy = (new Date()).getFullYear().toString().slice(-2);
      const candidate = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + yy;
      const parts = candidate.split('/');
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = 2000 + parseInt(parts[2], 10);
      if (isValidDate(d, m, y)) {
        final = parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + parts[2];
      }
    } else {
      const formatted = formatFechaValue(v);
      const parts = (formatted || '').split('/').map(p => p || '');
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 2) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = 2000 + parseInt(parts[2], 10);
        if (isValidDate(d, m, y)) {
          final = parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + parts[2];
        }
      }
    }

    el.value = final;

    // Validar el par fecha/hora
    const match = (el.id || '').match(/(fecha|hora)-(ida|regreso)-(\d+)/);
    if (match) {
      const id = match[3];
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (final === '' && desp) {
        desp.dataset.dtInvalid = '1';
        const otherSum = sumNonManutencionAmounts(desp);
        const calc = desp.querySelector('.calc-result');
        const just = desp.querySelector('.justificar-pernocta-field');
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
          if (just) just.style.display = 'none';
        } else {
          if (calc) calc.style.display = 'none';
          if (just) just.style.display = 'none';
        }
      }
      validateDateTimePairAndUpdateUI(id);
    }
  }

  /**
   * Handler de blur para campos de hora. Valida y formatea el valor.
   * @param {Event} e - Evento blur
   */
  function handleHoraBlur(e) {
    const el = e.target;
    if (!el || !el.classList || !el.classList.contains('input-hora')) return;

    const v = (el.value || '').trim();

    // Campo vacío: mantener vacío para mostrar placeholder
    if (v === '') {
      el.value = '';
      const matchEmpty = (el.id || '').match(/(fecha|hora)-(ida|regreso)-(\d+)/);
      if (matchEmpty) {
        const id = matchEmpty[3];
        const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
        if (desp) {
          desp.dataset.dtInvalid = '1';
          const otherSum = sumNonManutencionAmounts(desp);
          const calc = desp.querySelector('.calc-result');
          const just = desp.querySelector('.justificar-pernocta-field');
          if (otherSum > 0) {
            if (calc) calc.style.display = '';
            if (just) just.style.display = 'none';
          } else {
            if (calc) calc.style.display = 'none';
            if (just) just.style.display = 'none';
          }
        }
        validateDateTimePairAndUpdateUI(id);
      }
      return;
    }

    const parts = v.split(':').map(p => p.replace(/[^0-9]/g, ''));
    let hh = parts[0] || '';
    let mm = (typeof parts[1] !== 'undefined') ? (parts[1] || '') : '';

    if (mm === '') mm = '00';
    if (hh.length === 1) hh = '0' + hh;
    if (mm.length === 1) mm = '0' + mm;

    const hnum = parseInt(hh, 10);
    const mnum = parseInt(mm, 10);
    let valid = true;

    if (isNaN(hnum) || hnum < 0 || hnum > 23) valid = false;
    if (isNaN(mnum) || mnum < 0 || mnum > 59) valid = false;

    el.value = valid ? (hh || '00') + ':' + (mm || '00') : '';

    // Validar el par fecha/hora
    const match = (el.id || '').match(/(fecha|hora)-(ida|regreso)-(\d+)/);
    if (match) {
      const id = match[3];
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (!valid && desp) {
        desp.dataset.dtInvalid = '1';
        const otherSum = sumNonManutencionAmounts(desp);
        const calc = desp.querySelector('.calc-result');
        const just = desp.querySelector('.justificar-pernocta-field');
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
          if (just) just.style.display = 'none';
        } else {
          if (calc) calc.style.display = 'none';
          if (just) just.style.display = 'none';
        }
      }
      validateDateTimePairAndUpdateUI(id);
    }
  }

  /**
   * Handler de keydown para campos de hora.
   * Autocompleta ':00' cuando el usuario pulsa ':' después de las horas.
   * @param {Event} e - Evento keydown
   */
  function handleHoraKeydown(e) {
    const el = e.target;
    if (!el || !el.classList || !el.classList.contains('input-hora')) return;

    if (e.key === ':') {
      const v = (el.value || '').trim();
      if (/^\d{1,2}$/.test(v)) {
        e.preventDefault();
        let hh = v;
        if (hh.length === 1) hh = '0' + hh;
        el.value = hh + ':';
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch (err) { /* ignore */ }
      }
    }
  }

  // =========================================================================
  // INICIALIZACIÓN DE LISTENERS
  // =========================================================================

  /**
   * Inicializa los listeners globales de validación.
   * Se llama automáticamente al cargar el módulo.
   */
  function init() {
    // Los handlers se adjuntan via delegación en formLogic.js para evitar duplicados
    // Este método puede usarse para re-inicializar si es necesario
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const validaciones = {
    // Validadores principales
    validateDateTimePairAndUpdateUI,
    validateCrucesAndUpdateUI,

    // Handlers de eventos
    handleFechaBlur,
    handleHoraBlur,
    handleHoraKeydown,

    // Helpers
    sumNonManutencionAmounts,

    // Inicialización
    init
  };

  global.validaciones = validaciones;

})(typeof window !== 'undefined' ? window : this);
