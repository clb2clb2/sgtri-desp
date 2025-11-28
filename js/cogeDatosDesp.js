// js/cogeDatosDesp.js
// Funciones que recolectan datos del DOM para el cálculo de desplazamientos.
(function(){
  function collectDataFromFicha(despEl) {
    if (!despEl) return null;
    const id = despEl.dataset && despEl.dataset.desplazamientoId;
    const safe = sel => (sel ? sel.value : '');
    const data = {
      id: id,
      fechaIda: safe(despEl.querySelector(`#fecha-ida-${id}`)),
      horaIda: safe(despEl.querySelector(`#hora-ida-${id}`)),
      fechaRegreso: safe(despEl.querySelector(`#fecha-regreso-${id}`)),
      horaRegreso: safe(despEl.querySelector(`#hora-regreso-${id}`)),
      cruceIda: safe(despEl.querySelector(`#cruce-ida-${id}`)),
      cruceVuelta: safe(despEl.querySelector(`#cruce-vuelta-${id}`)),
      pais: safe(despEl.querySelector(`#pais-destino-${id}`)),
      paisIndex: (function(){ const el = despEl.querySelector(`#pais-destino-${id}`); return (el && typeof el.selectedIndex === 'number') ? el.selectedIndex : -1; })(),
      km: safe(despEl.querySelector(`#km-${id}`)),
      alojamiento: safe(despEl.querySelector(`#alojamiento-${id}`)),
      ticketCena: !!(despEl.querySelector(`#ticket-cena-${id}`) && despEl.querySelector(`#ticket-cena-${id}`).checked),
      noManutencion: !!(despEl.querySelector(`#no-manutencion-${id}`) && despEl.querySelector(`#no-manutencion-${id}`).checked),
      justificarPernocta: !!(despEl && despEl.dataset && despEl.dataset.justificarPernocta === '1'),
      dtInvalid: !!(despEl && despEl.dataset && despEl.dataset.dtInvalid === '1'),
      otrosGastos: Array.from(despEl.querySelectorAll('.otros-gasto-importe')).map(i => i.value || '0'),
      tipoProyecto: (document.getElementById('tipoProyecto') ? document.getElementById('tipoProyecto').value : '')
    };
    return data;
  }

  function parseNumber(v) {
    if (v === null || typeof v === 'undefined') return 0;
    let s = String(v).trim();
    if (!s) return 0;
    s = s.replace(/[^0-9,\.\-]/g, '');
    if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) { s = s.replace(/\./g, ''); s = s.replace(/,/g, '.'); }
    else if (s.indexOf(',') !== -1) s = s.replace(/,/g, '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  window.cogeDatosDesp = window.cogeDatosDesp || {};
  window.cogeDatosDesp.collectDataFromFicha = collectDataFromFicha;
  window.cogeDatosDesp.parseNumber = parseNumber;
  window.cogeDatosDesp.parseNumericLoose = parseNumber;
})();
