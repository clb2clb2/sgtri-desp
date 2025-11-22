// js/calculoDesp.js
// Wrapper que construye el objeto de entrada para dietasCalc y expone una función
// pública `calculaDesplazamientoFicha(despEl)` que devuelve { canonicalResult, displayContext }

(function () {
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
      otrosGastos: Array.from(despEl.querySelectorAll('.otros-gasto-importe')).map(i => i.value || '0'),
      tipoProyecto: (document.getElementById('tipoProyecto') ? document.getElementById('tipoProyecto').value : '')
    };
    return data;
  }

  function parseNumericLoose(v) {
    if (v === null || typeof v === 'undefined') return 0;
    let s = String(v).trim();
    if (!s) return 0;
    s = s.replace(/[^0-9,\.\-]/g, '');
    if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) { s = s.replace(/\./g, ''); s = s.replace(/,/g, '.'); }
    else if (s.indexOf(',') !== -1) s = s.replace(/,/g, '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  // main entry: recibe el elemento .desplazamiento-grupo y devuelve el resultado canónico
  // y un contexto de visualización (por ejemplo, otrosSum, kmNum, flags)
  function calculaDesplazamientoFicha(despEl) {
    const data = collectDataFromFicha(despEl);
    if (!data) return null;
    // sumar otros gastos
    const otrosSum = data.otrosGastos.reduce((acc, v) => acc + parseNumericLoose(v), 0);
    // parse km y aloj
    const kmNum = parseNumericLoose(data.km);
    const alojNum = parseNumericLoose(data.alojamiento);

    // build input object for dietasCalc - this will be the canonical input
    const calcInput = {
      fechaIda: data.fechaIda,
      horaIda: data.horaIda,
      fechaRegreso: data.fechaRegreso,
      horaRegreso: data.horaRegreso,
      cruceIda: data.cruceIda,
      cruceVuelta: data.cruceVuelta,
      pais: data.pais,
      paisIndex: data.paisIndex,
      km: kmNum,
      alojamiento: alojNum,
      ticketCena: data.ticketCena,
      tipoProyecto: data.tipoProyecto,
      // flags the engine can use or the wrapper will honor
      flags: {
        excludeManutencion: data.noManutencion,
        justificarPernocta: false // visual-only handled elsewhere; wrapper can pass if needed
      }
    };

    let canonical = null;
    try {
      if (window && window.dietasCalc && typeof window.dietasCalc.calculateDesplazamiento === 'function') {
        canonical = window.dietasCalc.calculateDesplazamiento(calcInput);
      }
    } catch (e) {
      canonical = null;
    }

    const displayContext = {
      otrosSum, kmNum, alojNum, flags: calcInput.flags, id: data.id
    };

    return { canonical, displayContext, calcInput };
  }

  // expose
  window.calculoDesp = {
    calculaDesplazamientoFicha,
    collectDataFromFicha
  };
})();
