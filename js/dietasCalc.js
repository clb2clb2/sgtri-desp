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

    // Manutenciones
    let manutenciones = 0;
    // Special case: same calendar day
    const isSameDay = fechaIdaDate && fechaRegresoDate && fechaIdaDate.getFullYear() === fechaRegresoDate.getFullYear() && fechaIdaDate.getMonth() === fechaRegresoDate.getMonth() && fechaIdaDate.getDate() === fechaRegresoDate.getDate();
    if (isSameDay) {
      // If both times present, decide 0 / 0.5 / 1 according to rules:
      //  - 0 if sale después de 15:00 AND vuelve antes de 22:01 (i.e. <= 22:00)
      //  - 0.5 if sale después de 15:00 OR vuelve antes de 22:01
      //  - 1 otherwise
      if (horaIda && horaRegreso) {
        const tDep = horaIda.hh * 60 + horaIda.mm;
        const tRet = horaRegreso.hh * 60 + horaRegreso.mm;
        const depAfter15 = tDep > (15 * 60);
        const retBeforeOrAt2200 = tRet <= (22 * 60);
        if (depAfter15 && retBeforeOrAt2200) manutenciones = 0;
        else if (depAfter15 || retBeforeOrAt2200) manutenciones = 0.5;
        else manutenciones = 1;
      } else {
        // incomplete times: cannot compute confidently, keep 0
        manutenciones = 0;
      }
    } else {
      // salida
      if (horaIda) {
        const t = horaIda.hh * 60 + horaIda.mm;
        if (t <= (15*60)) manutenciones += 1; // antes o igual 15:00
        else if (t > (15*60) && t <= (22*60)) manutenciones += 0.5; // entre 15:01 y 22:00
      }

      // días completos entre fechas
      if (fechaIdaDate && fechaRegresoDate) {
        const days = daysBetweenMidnights(fechaIdaDate, fechaRegresoDate);
        // Cada día completo entre fecha de salida y regreso
        if (days > 0) manutenciones += days;
      }

      // regreso
      if (horaRegreso) {
        const t = horaRegreso.hh * 60 + horaRegreso.mm;
        if (t > (22*60)) manutenciones += 1; // vuelve más tarde de 22:00
        else if (t > (15*60) && t <= (22*60)) manutenciones += 0.5; // entre 15:01 y 22:00
      }
    }

    // Noches
    let noches = 0;
    if (isSameDay) {
      // si vuelve el mismo día, por defecto 0 noches
      noches = 0;
    } else {
      if (fechaIdaDate && fechaRegresoDate) {
        noches = daysBetweenMidnights(fechaIdaDate, fechaRegresoDate);
      }
      // se añade una noche más si vuelve más tarde de la 1:00
      if (horaRegreso) {
        const t = horaRegreso.hh * 60 + horaRegreso.mm;
        if (t > (1*60)) noches += 1;
      }
    }

    // Valores
  const precioManutencion = 50.55;
  const precioNoche = 98.88;
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
    const kmAmount = Math.round((kmNum * precioKm + Number.EPSILON) * 100) / 100;

  result.manutenciones = manutenciones;
    result.manutencionesAmount = manutencionesAmount;
    result.noches = noches;
    result.nochesAmount = nochesAmount;
    result.km = kmNum;
    result.kmAmount = kmAmount;
    result.alojamiento = alojamientoNum;
  result.alojamientoMaxAmount = nochesAmount; // esto es el importe máximo calculado
  // incluir precio por km usado en el cálculo
  result.precioKm = precioKm;

    // devolver objeto con resultados
    return result;
  }

  window.dietasCalc = {
    calculateDesplazamiento
  };
})();
