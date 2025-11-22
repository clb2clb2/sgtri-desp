// js/logicaDesp.js
// Lógica UI y validaciones para fichas de desplazamiento
// Funciones expuestas en window.logicaDesp

(function () {
  function init() {
    // Inicialización: wiring de listeners delegados para fichas de desplazamiento.
    // Este init actúa por delegación y usa debounce por-id para evitar recálculos innecesarios.
    try {
      const container = document.getElementById('desplazamientos-container');
      if (!container) return;

      const perIdTimers = Object.create(null);
      function scheduleForId(id, fn, ms = 120) {
        if (!id) return;
        if (perIdTimers[id]) clearTimeout(perIdTimers[id]);
        perIdTimers[id] = setTimeout(() => { try { fn(); } catch (e) {} ; delete perIdTimers[id]; }, ms);
      }

      // Delegación: manejar blur en fechas/horas y change en selects/checkboxes
      container.addEventListener('blur', (e) => {
        const el = e.target;
        if (!el) return;
        // Campos que disparan recálculo en blur
        if (el.classList && (el.classList.contains('input-fecha') || el.classList.contains('input-hora') || el.classList.contains('format-km') || el.classList.contains('format-alojamiento') )) {
          const m = (el.id || '').match(/-(\d+)$/);
          const id = m ? m[1] : (el.closest && el.closest('.desplazamiento-grupo') && el.closest('.desplazamiento-grupo').dataset && el.closest('.desplazamiento-grupo').dataset.desplazamientoId);
          if (id) scheduleForId(id, () => handleFichaChange(id));
        }
      }, true);

      container.addEventListener('change', (e) => {
        const el = e.target;
        if (!el) return;
        // selects, checkboxes, botones otros gastos
        const grp = el.closest && el.closest('.desplazamiento-grupo');
        const id = grp && grp.dataset && grp.dataset.desplazamientoId ? grp.dataset.desplazamientoId : null;
        if (id) scheduleForId(id, () => handleFichaChange(id));
      });

      // clicks para añadir/eliminar 'otros gastos' ya manejados por formLogic, pero
      // por si hay eliminación por delegación, escuchamos clicks y recalc
      container.addEventListener('click', (e) => {
        const add = e.target.closest && e.target.closest('.btn-otros-gastos');
        const remove = e.target.closest && e.target.closest('.btn-remove-otros-gasto');
        const grp = e.target.closest && e.target.closest('.desplazamiento-grupo');
        const id = grp && grp.dataset && grp.dataset.desplazamientoId ? grp.dataset.desplazamientoId : null;
        if ((add || remove) && id) scheduleForId(id, () => handleFichaChange(id));
      });

      console.log('logicaDesp initialized');
    } catch (e) { console.error('logicaDesp.init error', e); }
  }

  // Handle a ficha change: validate UI elements, then call cálculo and render
  function handleFichaChange(id) {
    try {
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (!desp) return;
      // show/hide fronteras based on country
      const paisSel = desp.querySelector(`#pais-destino-${id}`);
      const fronteras = document.getElementById(`fronteras-fields-${id}`);
      const isIntl = paisSel && shouldShowTicketCena && isInternationalCountry(paisSel.value) ? true : (paisSel && isInternationalCountry(paisSel.value));
      if (fronteras) fronteras.style.display = isIntl ? 'block' : 'none';

      // show/hide ticket-cena according to tipoProyecto and hour
      const tipoProj = (document.getElementById('tipoProyecto') || {}).value;
      const horaRegEl = desp.querySelector(`#hora-regreso-${id}`);
      const horaReg = horaRegEl ? horaRegEl.value : '';
      const ticketField = desp.querySelector(`#ticket-cena-field-${id}`);
      if (ticketField) ticketField.style.display = shouldShowTicketCena(tipoProj, horaReg) ? 'block' : 'none';

      // show/hide justificar-pernocta placeholder: the renderer will create the checkbox
      // but we control whether the inputs are valid and set dataset.dtInvalid
      const fechaIdEl = desp.querySelector(`#fecha-ida-${id}`);
      const fechaRegEl = desp.querySelector(`#fecha-regreso-${id}`);
      const horaIdEl = desp.querySelector(`#hora-ida-${id}`);
      const horaRegE = desp.querySelector(`#hora-regreso-${id}`);
      const fechaOk = validateFechaOrden(fechaIdEl && fechaIdEl.value, horaIdEl && horaIdEl.value, fechaRegEl && fechaRegEl.value, horaRegE && horaRegE.value);
      if (!fechaOk) {
        // mark invalid dataset so calculaDesplazamiento can force manut=0 / aloj=0
        desp.dataset.dtInvalid = '1';
      } else {
        if (desp && desp.dataset && desp.dataset.dtInvalid) delete desp.dataset.dtInvalid;
      }

      // Call calculoDesp and render
      try {
        if (window.calculoDesp && typeof window.calculoDesp.calculaDesplazamientoFicha === 'function') {
          const res = window.calculoDesp.calculaDesplazamientoFicha(desp);
          if (window.salidaDesp && typeof window.salidaDesp.renderSalida === 'function') {
            window.salidaDesp.renderSalida(desp, res && res.canonical, res && res.displayContext);
          }
        }
      } catch (e) { /* ignore render errors */ }
    } catch (e) { console.error('handleFichaChange error', e); }
  }

  function shouldShowTicketCena(tipoProyecto, horaRegreso) {
    // tipoProyecto: string, horaRegreso: 'hh:mm' or ''
    try {
      const esRD462 = ["G24", "PEI", "NAL"].includes(tipoProyecto);
      if (!esRD462) return false;
      if (!horaRegreso) return false;
      const m = horaRegreso.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return false;
      const hh = parseInt(m[1], 10);
      return hh >= 22 && hh < 24;
    } catch (e) { return false; }
  }

  function shouldShowJustificarPernocta(horaRegreso) {
    // Mostrar justificante si hora de regreso entre 01:00 y 06:59 (inclusive 01:00)
    try {
      if (!horaRegreso) return false;
      const m = horaRegreso.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return false;
      const hh = parseInt(m[1], 10);
      return hh >= 1 && hh < 7;
    } catch (e) { return false; }
  }

  function isInternationalCountry(pais) {
    try { return pais && String(pais).trim() !== '' && String(pais).trim() !== 'España'; } catch (e) { return false; }
  }

  function validateFechaOrden(fechaIda, horaIda, fechaReg, horaReg) {
    // Simple validation: requiere que regreso > salida when both provided (returns boolean)
    try {
      // parse dd/mm/aa
      function parse(d, h) {
        if (!d) return null;
        const parts = String(d).split('/');
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = 2000 + parseInt(parts[2], 10);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        const date = new Date(year, month, day);
        if (h && /^(\d{1,2}):(\d{2})$/.test(h)) {
          const hh = parseInt(h.split(':')[0], 10);
          const mm = parseInt(h.split(':')[1], 10);
          date.setHours(hh, mm, 0, 0);
        }
        return date;
      }
      const s = parse(fechaIda, horaIda);
      const e = parse(fechaReg, horaReg);
      if (!s || !e) return false;
      return e > s;
    } catch (e) { return false; }
  }

  // Expose API
  window.logicaDesp = {
    init,
    shouldShowTicketCena,
    shouldShowJustificarPernocta,
    isInternationalCountry,
    validateFechaOrden
  };
})();
