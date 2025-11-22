// js/logicaDesp.js
// Lógica UI y validaciones para fichas de desplazamiento
// Funciones expuestas en window.logicaDesp

(function () {
  function init() {
    // Inicialización: attach handlers if needed (will be wired from formLogic or main)
    // Placeholder: actual wiring will be done when connecting events
    console.log('logicaDesp initialized');
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
