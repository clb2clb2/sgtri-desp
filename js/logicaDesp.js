// js/logicaDesp.js
// Lógica UI y validaciones para fichas de desplazamiento
// Funciones expuestas en window.logicaDesp
//
// MODELO SIMPLIFICADO:
// - Campos de texto (fechas, horas, km, alojamiento): recálculo en BLUR (después del formateo)
// - Selects, checkboxes: recálculo inmediato en CHANGE
// - Sin debounce ni timers complejos

(function (global) {
  'use strict';

  // =========================================================================
  // RECÁLCULO DIRECTO (SIN DEBOUNCE)
  // =========================================================================

  /**
   * Ejecuta el recálculo para una ficha específica.
   * Se llama directamente, sin timers ni debounce.
   */
  function recalcularFicha(id) {
    if (!id) return;
    try {
      handleFichaChange(id);
    } catch (e) {
      console.error('Error en recalcularFicha:', e);
    }
  }

  /**
   * Recalcula todas las fichas.
   * Útil después de restaurar datos o cambios globales.
   */
  function recalcularTodas() {
    try {
      const groups = document.querySelectorAll('.desplazamiento-grupo');
      groups.forEach(g => {
        const id = g?.dataset?.desplazamientoId;
        if (id) recalcularFicha(id);
      });
    } catch (e) {
      console.error('Error en recalcularTodas:', e);
    }
  }

  // Mantener compatibilidad con código existente que usa scheduleFullRecalc
  function scheduleFullRecalc(ms = 0) {
    if (ms > 0) {
      setTimeout(recalcularTodas, ms);
    } else {
      recalcularTodas();
    }
  }

  function scheduleRecalcForId(id, ms = 0) {
    if (ms > 0) {
      setTimeout(() => recalcularFicha(id), ms);
    } else {
      recalcularFicha(id);
    }
  }

  // =========================================================================
  // INICIALIZACIÓN Y LISTENERS
  // =========================================================================

  function init() {
    try {
      const container = document.getElementById('desplazamientos-container');
      if (!container) return;

      // -----------------------------------------------------------------
      // BLUR: Para campos de texto (fechas, horas, km, alojamiento)
      // Usamos focusout que SÍ burbuja (a diferencia de blur)
      // -----------------------------------------------------------------
      container.addEventListener('focusout', (e) => {
        const el = e.target;
        if (!el?.classList) return;

        // Solo procesar campos que disparan recálculo
        const isRecalcField = el.classList.contains('input-fecha') ||
                              el.classList.contains('input-hora') ||
                              el.classList.contains('format-km') ||
                              el.classList.contains('format-alojamiento') ||
                              el.classList.contains('otros-gasto-importe');

        if (!isRecalcField) return;

        // Obtener ID del desplazamiento
        const id = getDesplazamientoId(el);
        if (!id) return;

        // Ejecutar recálculo en el siguiente tick del event loop
        // Esto garantiza que el formateo de formLogic.js ya haya terminado
        setTimeout(() => recalcularFicha(id), 0);
      });

      // -----------------------------------------------------------------
      // CHANGE: Para selects y checkboxes (inmediato)
      // -----------------------------------------------------------------
      container.addEventListener('change', (e) => {
        const el = e.target;
        if (!el) return;

        // Obtener ID del desplazamiento
        const id = getDesplazamientoId(el);
        if (!id) return;

        // Recálculo inmediato
        recalcularFicha(id);
      });

      // -----------------------------------------------------------------
      // CLICK: Para botones de añadir/eliminar otros gastos
      // -----------------------------------------------------------------
      container.addEventListener('click', (e) => {
        const addBtn = e.target.closest?.('.btn-otros-gastos');
        const removeBtn = e.target.closest?.('.btn-remove-otros-gasto');

        if (!addBtn && !removeBtn) return;

        const id = getDesplazamientoId(e.target);
        if (!id) return;

        // Pequeño delay para que el DOM se actualice
        setTimeout(() => recalcularFicha(id), 10);
      });

    } catch (e) {
      console.error('logicaDesp.init error:', e);
    }
  }

  /**
   * Obtiene el ID del desplazamiento a partir de un elemento.
   */
  function getDesplazamientoId(el) {
    // Intentar extraer del ID del elemento (ej: "km-1" → "1")
    const match = el.id?.match(/-(\d+)$/);
    if (match) return match[1];

    // Fallback: buscar en el contenedor padre
    const grupo = el.closest?.('.desplazamiento-grupo');
    return grupo?.dataset?.desplazamientoId || null;
  }

  // =========================================================================
  // MANEJO DE CAMBIOS EN FICHA
  // =========================================================================

  /**
   * Procesa un cambio en una ficha: valida UI y dispara el cálculo.
   */
  function handleFichaChange(id) {
    try {
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (!desp) return;

      // Mostrar/ocultar campos de fronteras según país
      const paisSel = desp.querySelector(`#pais-destino-${id}`);
      const fronteras = document.getElementById(`fronteras-fields-${id}`);
      const isIntl = paisSel && isInternationalCountry(paisSel.value);
      if (fronteras) fronteras.style.display = isIntl ? 'block' : 'none';

      // Mostrar/ocultar ticket-cena según tipo de proyecto y hora
      const tipoProj = document.getElementById('tipoProyecto')?.value || '';
      const horaRegEl = desp.querySelector(`#hora-regreso-${id}`);
      const horaReg = horaRegEl?.value || '';
      const ticketField = desp.querySelector(`#ticket-cena-field-${id}`);
      if (ticketField) {
        ticketField.style.display = shouldShowTicketCena(tipoProj, horaReg) ? 'block' : 'none';
      }

      // Validar orden de fechas
      const fechaIdEl = desp.querySelector(`#fecha-ida-${id}`);
      const fechaRegEl = desp.querySelector(`#fecha-regreso-${id}`);
      const horaIdEl = desp.querySelector(`#hora-ida-${id}`);
      const horaRegE = desp.querySelector(`#hora-regreso-${id}`);
      
      const fechaOk = validateFechaOrden(
        fechaIdEl?.value, 
        horaIdEl?.value, 
        fechaRegEl?.value, 
        horaRegE?.value
      );
      
      if (!fechaOk) {
        desp.dataset.dtInvalid = '1';
      } else {
        delete desp.dataset.dtInvalid;
      }

      // Validar cruces de fronteras
      try { 
        validateCrucesForFicha(id); 
      } catch (e) { /* ignore */ }

      // Ejecutar cálculo y renderizado
      try {
        if (global.calculoDesp?.calculaDesplazamientoFicha) {
          global.calculoDesp.calculaDesplazamientoFicha(desp);
        }
      } catch (e) { 
        console.warn('Error en cálculo de desplazamiento:', e);
      }
      
    } catch (e) { 
      console.error('handleFichaChange error:', e); 
    }
  }

  // =========================================================================
  // VALIDACIÓN DE CRUCES DE FRONTERAS
  // =========================================================================

  function validateCrucesForFicha(id) {
    try {
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (!desp) return true;

      const cruceIdEl = desp.querySelector(`#cruce-ida-${id}`);
      const cruceVueltaEl = desp.querySelector(`#cruce-vuelta-${id}`);
      const paisEl = desp.querySelector(`#pais-destino-${id}`);
      const isIntl = paisEl && isInternationalCountry(paisEl.value);

      // Si no es internacional, limpiar errores y salir
      if (!isIntl || !cruceIdEl || !cruceVueltaEl) {
        cruceIdEl?.classList.remove('field-error');
        cruceVueltaEl?.classList.remove('field-error');
        return true;
      }

      const fechaIdEl = desp.querySelector(`#fecha-ida-${id}`);
      const fechaRegEl = desp.querySelector(`#fecha-regreso-${id}`);
      
      const fId = parseDateStrict(fechaIdEl?.value);
      const fReg = parseDateStrict(fechaRegEl?.value);
      const cId = parseDateStrict(cruceIdEl.value);
      const cV = parseDateStrict(cruceVueltaEl.value);

      let hasError = false;

      // Formato incorrecto
      if ((cruceIdEl.value && !cId) || (cruceVueltaEl.value && !cV)) {
        hasError = true;
      }

      // Orden: fechaIda <= cruceIda <= cruceVuelta <= fechaRegreso
      if (cId && cV && !global.utils.ordenCrucesValido(fId, cId, cV, fReg)) {
        hasError = true;
      }

      // Actualizar clases visuales
      if (hasError) {
        cruceIdEl.classList.add('field-error');
        cruceVueltaEl.classList.add('field-error');
      } else {
        cruceIdEl.classList.remove('field-error');
        cruceVueltaEl.classList.remove('field-error');
      }
      
      return !hasError;
    } catch (e) { 
      return true; 
    }
  }

  // =========================================================================
  // UTILIDADES
  // =========================================================================

  function parseDateStrict(v) {
    return global.limpiaDatos.parseDateStrict(v);
  }

  function shouldShowTicketCena(tipoProyecto, horaRegreso) {
    try {
      const esRD462 = global.utils.getNormativa(tipoProyecto) === 'rd';
      if (!esRD462 || !horaRegreso) return false;
      const m = horaRegreso.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return false;
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return false;
      return (hh * 60 + mm) > (22 * 60);
    } catch (e) { 
      return false; 
    }
  }

  function isInternationalCountry(pais) {
    return global.utils.esPaisInternacional(pais);
  }

  function validateFechaOrden(fechaIda, horaIda, fechaReg, horaReg) {
    try {
      function parse(d, h) {
        const date = parseDateStrict(d);
        if (!date) return null;
        const t = global.limpiaDatos.parseTimeStrict(h);
        if (t) date.setHours(t.hh, t.mm, 0, 0);
        return date;
      }
      
      const s = parse(fechaIda, horaIda);
      const e = parse(fechaReg, horaReg);
      
      // Si faltan datos, no podemos validar → asumimos OK
      if (!s || !e) return true;
      
      // Regreso debe ser posterior a ida
      return e > s;
    } catch (e) { 
      return true; 
    }
  }

  // =========================================================================
  // API PÚBLICA
  // =========================================================================

  global.logicaDesp = {
    init,
    recalcularFicha,
    recalcularTodas,
    shouldShowTicketCena,
    isInternationalCountry,
    validateFechaOrden,
    // Mantener compatibilidad con código existente
    scheduleFullRecalc,
    scheduleRecalcForId
  };

})(typeof window !== 'undefined' ? window : this);
