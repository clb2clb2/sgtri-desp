// js/dietasCalc.js
// Provee una función global `window.dietasCalc.calculateDesplazamiento(obj)`
// que recibe un objeto con datos básicos y devuelve el mismo con los resultados.
(function(){
  function parseDate(ddmmaa) {
    if (!ddmmaa) return null;
    const parts = String(ddmmaa).split('/').map(p => p.trim());
    if (parts.length < 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    let y = parseInt(parts[2], 10);
    if (y < 100) y = 2000 + y;
    return new Date(y, m, d);
  }

  function parseTime(hhmm) {
    if (!hhmm) return null;
    const parts = String(hhmm).split(':').map(p => p.trim());
    if (parts.length < 2) return null;
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    if (isNaN(hh) || isNaN(mm)) return null;
    return { hh, mm };
  }

  function toDateTime(dateObj, timeObj) {
    if (!dateObj) return null;
    const d = new Date(dateObj.getTime());
    if (timeObj) {
      d.setHours(timeObj.hh);
      d.setMinutes(timeObj.mm);
      d.setSeconds(0);
      d.setMilliseconds(0);
    } else {
      d.setHours(0,0,0,0);
    }
    return d;
  }

  function daysBetweenMidnights(a, b) {
    if (!a || !b) return 0;
    const am = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const bm = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    const diff = Math.round((bm - am) / 86400000);
    return Math.max(0, diff);
  }

  function calculateDesplazamiento(input) {
    // input: { fechaIda, horaIda, fechaRegreso, horaRegreso, pais, km, alojamiento }
    const result = Object.assign({}, input);

    const fechaIdaDate = parseDate(input.fechaIda);
    const fechaRegresoDate = parseDate(input.fechaRegreso);
    const horaIda = parseTime(input.horaIda);
    const horaRegreso = parseTime(input.horaRegreso);

    const dtIda = toDateTime(fechaIdaDate, horaIda);
    const dtVuelta = toDateTime(fechaRegresoDate, horaRegreso);

    // Manutenciones (nuevo cálculo basado en normativa seleccionada)
    let manutenciones = 0;
    // determine normative: 'rd' or 'decreto' using input.tipoProyecto and datos.json
    let normative = 'decreto';
    try {
      const datos = (typeof window !== 'undefined' && window.__sgtriDatos) ? window.__sgtriDatos : null;
      if (datos && datos.normativasPorTipoProyecto && datos.normativasPorTipoProyecto.rd) {
        const rdList = datos.normativasPorTipoProyecto.rd || [];
        if (input && input.tipoProyecto && rdList.indexOf(input.tipoProyecto) !== -1) normative = 'rd';
      }
    } catch (e) { /* ignore and default to decreto */ }

    // helper: compute minutes from time object
    function minutesOf(t) { return (t && typeof t.hh === 'number' && typeof t.mm === 'number') ? (t.hh * 60 + t.mm) : null; }

    const tDep = minutesOf(horaIda);
    const tRet = minutesOf(horaRegreso);

    const isSameDay = fechaIdaDate && fechaRegresoDate && fechaIdaDate.getFullYear() === fechaRegresoDate.getFullYear() && fechaIdaDate.getMonth() === fechaRegresoDate.getMonth() && fechaIdaDate.getDate() === fechaRegresoDate.getDate();

    if (isSameDay) {
      // Single-day rules
      if (tDep == null || tRet == null) {
        // Missing times: cannot confidently award manutenciones -> 0
        manutenciones = 0;
      } else {
        const durationHours = (dtVuelta.getTime() - dtIda.getTime()) / 3600000;
        if (normative === 'rd') {
          // RD 462/2002 single-day
          // The dinner half (return >= 22:00 + ticket) is applied independently of total duration.
          const retHalf = (tRet >= (22 * 60) && input && input.ticketCena) ? 0.5 : 0;
          // For the "departure before 14:00 & return after 16:00" half, a minimum
          // duration of 5 hours is required. If duration < 5h, only the dinner half (if any)
          // is awarded.
          if (durationHours < 5) {
            manutenciones = retHalf;
          } else {
            const depHalf = (tDep < (14 * 60) && tRet >= (16 * 60)) ? 0.5 : 0;
            manutenciones = depHalf + retHalf;
          }
        } else {
          // Decreto 42/2025 single-day
          const depCond = (tDep < (14 * 60) && tRet >= (16 * 60)) ? 0.5 : 0;
          const retCond = (tRet >= (22 * 60)) ? 0.5 : 0;
          manutenciones = depCond + retCond;
        }
      }
    } else {
      // Multi-day rules (both RD and Decreto share these rules with subtle difference on return full-day)
      // Day of departure
      if (tDep != null) {
  if (tDep < (14 * 60)) manutenciones += 1;
  else if (tDep >= (14 * 60) && tDep < (22 * 60)) manutenciones += 0.5;
        // else 0
      }

      // Intermediate full days between salida and regreso
      if (fechaIdaDate && fechaRegresoDate) {
        const days = daysBetweenMidnights(fechaIdaDate, fechaRegresoDate);
        const intermediate = Math.max(0, days - 1);
        if (intermediate > 0) manutenciones += intermediate;
      }

      // Day of regreso
      if (tRet != null) {
        if (normative === 'rd') {
          // RD: full (1) if regreso >= 22:00 AND ticketCena checked (>= used as 'posterior')
          if (tRet >= (22 * 60) && input && input.ticketCena) manutenciones += 1;
          else if (tRet >= (14 * 60)) manutenciones += 0.5;
        } else {
          // Decreto: full (1) if regreso >=22:00 (no ticket required)
          if (tRet >= (22 * 60)) manutenciones += 1;
          else if (tRet >= (14 * 60)) manutenciones += 0.5;
        }
      }
    }

    // Noches (nuevo algoritmo con ambigüedad entre 1:01 y 6:59)
    // NP: número entero de días resultado de restar fechaRegreso - fechaIda
    let baseNP = 0;
    if (fechaIdaDate && fechaRegresoDate) baseNP = daysBetweenMidnights(fechaIdaDate, fechaRegresoDate);

    let noches = 0;
    let ambiguous = false;
    let nochesIfCounted = 0; // NP assuming pernoctado
    let nochesIfNotCounted = 0; // NP assuming no pernocta (restar una)

    // Nuevo comportamiento: aplicamos reglas cuando baseNP > 0
    if (baseNP <= 0) {
      // ninguna noche completa entre fechas
      noches = 0;
      nochesIfCounted = 0;
      nochesIfNotCounted = 0;
    } else {
      nochesIfCounted = baseNP;
      nochesIfNotCounted = Math.max(0, baseNP - 1);

      // Determinar minuto relativo de la hora de regreso (t) de forma robusta.
      // Preferimos la hora parseada; si no está disponible intentamos extraerla
      // del string original para evitar casos en que parseTime falló.
      let t = null;
      if (horaRegreso && typeof horaRegreso.hh === 'number' && typeof horaRegreso.mm === 'number') {
        t = horaRegreso.hh * 60 + horaRegreso.mm;
      } else if (input && input.horaRegreso) {
        // intentar extraer hh:mm desde el string (acepta 'hh:mm' o 'h:mm')
        const m = String(input.horaRegreso || '').match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
        if (m) {
          const hh = parseInt(m[1], 10);
          const mm = parseInt(m[2], 10);
          if (!isNaN(hh) && !isNaN(mm)) t = hh * 60 + mm;
        }
      }

      if (t === null) {
        // sin información fiable de hora: por seguridad asumimos que sí pernocta
        noches = nochesIfCounted;
      } else {
        if (t >= (7 * 60)) {
          // vuelve a las 7:00 o después -> asumimos que ha pernoctado
          noches = nochesIfCounted;
        } else if (t <= (1 * 60)) {
          // vuelve a la 1:00 o antes -> asumimos que NO ha pernoctado
          noches = nochesIfNotCounted;
        } else {
          // entre 01:01 y 06:59 -> ambigüedad: el usuario debe justificar
          ambiguous = true;
          // por defecto, mientras no justifique, restaremos una noche
          noches = nochesIfNotCounted;
        }
      }
    }

    // Valores
    // Determine per-country prices from datos.json when available
  let precioManutencion = 50.55;
  let precioNoche = 98.88;
  try {
    const datos = (typeof window !== 'undefined' && window.__sgtriDatos) ? window.__sgtriDatos : null;
    if (datos && datos.dietasPorPais && Array.isArray(datos.dietasPorPais.paises)) {
      const paisesArr = datos.dietasPorPais.paises || [];
      // Prefer explicit paisIndex passed from UI (select.selectedIndex). If not provided, fall back to indexOf(input.pais).
      let idx = -1;
      if (typeof input.paisIndex === 'number' && input.paisIndex >= 0) idx = input.paisIndex;
      if (idx === -1) idx = paisesArr.indexOf(input && input.pais ? input.pais : '');
      if (idx === -1) idx = Math.max(0, paisesArr.length - 1); // fallback to 'Resto del mundo' (last)
      if (normative === 'rd' && datos.dietasPorPais.rd462_2002) {
        const mArr = datos.dietasPorPais.rd462_2002.manutencion || [];
        const aArr = datos.dietasPorPais.rd462_2002.alojamiento || [];
        if (mArr[idx] != null) precioManutencion = Number(mArr[idx]);
        if (aArr[idx] != null) precioNoche = Number(aArr[idx]);
      } else if (normative === 'decreto' && datos.dietasPorPais.decreto42_2025) {
        const mArr = datos.dietasPorPais.decreto42_2025.manutencion || [];
        const aArr = datos.dietasPorPais.decreto42_2025.alojamiento || [];
        if (mArr[idx] != null) precioManutencion = Number(mArr[idx]);
        if (aArr[idx] != null) precioNoche = Number(aArr[idx]);
      }
    }
  } catch (e) { /* fallback to defaults above */ }
  const precioKm = (input && input.kmTarifa) ? Number(input.kmTarifa) : 0.26;

    // Parse km and alojamiento from input (they should be numbers already but be robust)
    let kmNum = 0;
    if (typeof input.km === 'number') kmNum = input.km;
    else if (typeof input.km === 'string') {
      const s = input.km.replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(/,/g, '.');
      kmNum = parseFloat(s) || 0;
    }
    let alojamientoNum = 0;
    if (typeof input.alojamiento === 'number') alojamientoNum = input.alojamiento;
    else if (typeof input.alojamiento === 'string') {
      const s = input.alojamiento.replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(/,/g, '.');
      alojamientoNum = parseFloat(s) || 0;
    }

    const manutencionesAmount = Math.round((manutenciones * precioManutencion + Number.EPSILON) * 100) / 100;
  const nochesAmount = Math.round((noches * precioNoche + Number.EPSILON) * 100) / 100;
  const nochesAmountIfCounted = Math.round((nochesIfCounted * precioNoche + Number.EPSILON) * 100) / 100;
  const nochesAmountIfNotCounted = Math.round((nochesIfNotCounted * precioNoche + Number.EPSILON) * 100) / 100;
    const kmAmount = Math.round((kmNum * precioKm + Number.EPSILON) * 100) / 100;

  result.manutenciones = manutenciones;
    result.manutencionesAmount = manutencionesAmount;
      // expose per-unit prices used for labels in the UI
      result.precioManutencion = precioManutencion;
      result.precioNoche = precioNoche;
    result.noches = noches;
    result.nochesAmount = nochesAmount;
    result.nochesBase = baseNP;
    result.nochesIfCounted = nochesIfCounted;
    result.nochesIfNotCounted = nochesIfNotCounted;
    result.nochesAmountIfCounted = nochesAmountIfCounted;
    result.nochesAmountIfNotCounted = nochesAmountIfNotCounted;
    result.nochesAmbiguous = ambiguous;
    // If ambiguous, provide the penultimate and last dates for the justification text
    if (ambiguous && fechaRegresoDate) {
      const last = new Date(fechaRegresoDate.getTime());
      const penult = new Date(last.getTime());
      penult.setDate(last.getDate() - 1);
      function fmtDate(d) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = String(d.getFullYear());
        return `${dd}/${mm}/${yyyy}`;
      }
      result.nochesAmbiguousFrom = fmtDate(penult);
      result.nochesAmbiguousTo = fmtDate(last);
    }
    result.km = kmNum;
    result.kmAmount = kmAmount;
    result.alojamiento = alojamientoNum;
  result.alojamientoMaxAmount = nochesAmount; // esto es el importe máximo calculado
  // incluir precio por km usado en el cálculo
  result.precioKm = precioKm;

    // === Cálculo IRPF: importe sujeto a retención por manutención ===
    try {
      // Decide de forma determinista los límites a usar ANTES de calcular los detalles por día.
      const datosFallback = (typeof window !== 'undefined' && window.__sgtriDatos) ? window.__sgtriDatos : null;
      let usedLimits = null;
      // If datos available, prefer explicit paisIndex passed from UI. If not, try to infer by name.
      if (datosFallback && datosFallback.limitesIRPF) {
        if (typeof input.paisIndex === 'number' && input.paisIndex >= 0) {
          usedLimits = (input.paisIndex === 0) ? datosFallback.limitesIRPF.esp : datosFallback.limitesIRPF.ext;
          result.irpfSource = (input.paisIndex === 0) ? 'esp' : 'ext';
        } else {
          // attempt to detect by country name
          const paisesArr = (datosFallback.dietasPorPais && Array.isArray(datosFallback.dietasPorPais.paises)) ? datosFallback.dietasPorPais.paises : null;
          let idx = -1;
          if (paisesArr && input && input.pais) {
            idx = paisesArr.indexOf(input.pais);
            if (idx === -1) {
              const normalize = s => (s && s.normalize) ? s.normalize('NFD').replace(/[ -\u036f]/g, '') .toLowerCase() : (s || '').toLowerCase();
              const target = normalize(String(input.pais));
              idx = paisesArr.findIndex(p => normalize(String(p)) === target);
            }
          }
          if (idx === 0) { usedLimits = datosFallback.limitesIRPF.esp; result.irpfSource = 'esp'; }
          else { usedLimits = datosFallback.limitesIRPF.ext; result.irpfSource = 'ext'; }
        }
      }
      // final fallback default
      if (!usedLimits || !Array.isArray(usedLimits) || usedLimits.length < 2) usedLimits = [26.67, 53.34];

  // (debug traces removed in cleanup)

      // Build per-day manutención amounts (monetary) to apply exemptions per day
      const perDayManutencionUnits = [];
      if (isSameDay) {
        // single calendar day: single entry equal to manutenciones (0/0.5/1)
        perDayManutencionUnits.push(manutenciones);
      } else {
        // multi-day: departure day, intermediate full days, return day
        // departure
        let depUnits = 0;
        if (tDep != null) {
          if (tDep < (14 * 60)) depUnits = 1;
          else if (tDep >= (14 * 60) && tDep < (22 * 60)) depUnits = 0.5;
          else depUnits = 0;
        }
        perDayManutencionUnits.push(depUnits);
        // intermediate full days
        if (fechaIdaDate && fechaRegresoDate) {
          const days = daysBetweenMidnights(fechaIdaDate, fechaRegresoDate);
          const intermediate = Math.max(0, days - 1);
          for (let i = 0; i < intermediate; i++) perDayManutencionUnits.push(1);
        }
        // return day
        let retUnits = 0;
        if (tRet != null) {
          if (normative === 'rd') {
            if (tRet >= (22 * 60) && input && input.ticketCena) retUnits = 1;
            else if (tRet >= (14 * 60)) retUnits = 0.5;
          } else {
            if (tRet >= (22 * 60)) retUnits = 1;
            else if (tRet >= (14 * 60)) retUnits = 0.5;
          }
        }
        perDayManutencionUnits.push(retUnits);
      }

      // Compute per-day monetary amounts and apply exemptions: for all days except last use
      // exemption WITH pernoctación (usedLimits[1]); for last day use exemption WITHOUT pernoctación (usedLimits[0]).
      const perDayDetails = [];
      let irpfSujetoTotal = 0;
      for (let i = 0; i < perDayManutencionUnits.length; i++) {
        const units = perDayManutencionUnits[i] || 0;
        const bruto = Math.round((units * precioManutencion + Number.EPSILON) * 100) / 100;
        const isLast = (i === perDayManutencionUnits.length - 1);
        const exento = isLast ? Number(usedLimits[0]) : Number(usedLimits[1]);
        let sujeto = bruto - exento;
        if (sujeto < 0) sujeto = 0;
        sujeto = Math.round((sujeto + Number.EPSILON) * 100) / 100;
        perDayDetails.push({ dayIndex: i + 1, units, bruto, exento, sujeto, isLast });
        irpfSujetoTotal += sujeto;
      }
      irpfSujetoTotal = Math.round((irpfSujetoTotal + Number.EPSILON) * 100) / 100;
      result.irpf = { sujeto: irpfSujetoTotal, breakdown: perDayDetails, limitesUsed: usedLimits };
    } catch (e) {
      result.irpf = { sujeto: 0, breakdown: [], limitesUsed: [26.67, 53.34] };
    }

    // devolver objeto con resultados
    return result;
  }

  window.dietasCalc = {
    calculateDesplazamiento
  };
})();
