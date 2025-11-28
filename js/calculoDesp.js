// js/calculoDesp.js (fusionado)
// Este archivo contiene dos responsabilidades claramente separadas:
// 1) MOTOR de cálculo (anteriormente en el shim legacy): funciones puras que
//    reciben un objeto con datos de desplazamiento y devuelven un objeto
//    con los resultados numéricos (manutenciones, noches, irpf, km, etc.).
//    - Funciones principales: `calculateDesplazamiento(input)` y auxiliares.
//    - No debería manipular el DOM. Acepta `input.flags` para pequeñas
//      variaciones solicitadas por la UI (excludeManutencion, excludeAlojamiento,
//      justificarPernocta).
// 2) WRAPPER / Orquestador (antes en `js/calculoDesp.js`): recoge datos del DOM
//    (una ficha `.desplazamiento-grupo`), construye el `calcInput`, pasa flags
//    derivados del estado UI, llama al MOTOR y finalmente invoca al renderer
//    (`window.salidaDesp.renderSalida`) con el resultado canónico + contexto.

// -------------------------
// Sección 1: MOTOR de cálculo (funciones puras)
// -------------------------
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

// calculateDesplazamiento: motor principal.
// input.flags aceptados: { excludeManutencion, excludeAlojamiento, justificarPernocta }
function calculateDesplazamiento(input) {
  const result = Object.assign({}, input);
  // Leer flags desde propiedades top-level de `input`, manteniendo compatibilidad
  // con el antiguo `input.flags` si aún se proporciona.
  const flags = {
    _segmentMode: (input && typeof input._segmentMode !== 'undefined') ? input._segmentMode : (input && input.flags && typeof input.flags._segmentMode !== 'undefined' ? input.flags._segmentMode : false),
    excludeManutencion: (input && typeof input.excludeManutencion !== 'undefined') ? input.excludeManutencion : (input && input.flags && typeof input.flags.excludeManutencion !== 'undefined' ? input.flags.excludeManutencion : false),
    justificarPernocta: (input && typeof input.justificarPernocta !== 'undefined') ? input.justificarPernocta : (input && input.flags && typeof input.flags.justificarPernocta !== 'undefined' ? input.flags.justificarPernocta : false),
    excludeAlojamiento: (input && typeof input.excludeAlojamiento !== 'undefined') ? input.excludeAlojamiento : (input && input.flags && typeof input.flags.excludeAlojamiento !== 'undefined' ? input.flags.excludeAlojamiento : false)
  };

  const fechaIdaDate = parseDate(input.fechaIda);
  const fechaRegresoDate = parseDate(input.fechaRegreso);
  const horaIda = parseTime(input.horaIda);
  const horaRegreso = parseTime(input.horaRegreso);

  const dtIda = toDateTime(fechaIdaDate, horaIda);
  const dtVuelta = toDateTime(fechaRegresoDate, horaRegreso);

  // VALIDACIÓN PREVIA: comprobar que tenemos los datos mínimos y que son lógicos
  // Requerimos: fechaIda, fechaRegreso, horaIda, horaRegreso. Además, para
  // desplazamientos internacionales exigimos cruceIda y cruceVuelta, y que ambas
  // fechas de cruce estén dentro del rango [fechaIda, fechaRegreso] y que
  // cruceVuelta >= cruceIda.
  try {
    const segmentMode = flags && flags._segmentMode;
    const missingDatesOrTimes = !fechaIdaDate || !fechaRegresoDate || (!segmentMode && (!horaIda || !horaRegreso));
    const isInternational = (typeof input.paisIndex === 'number') ? (input.paisIndex > 0) : ((input.pais || '').toString().toLowerCase() !== 'españa' && (input.pais || '').toString() !== '');

    // parsear cruces si vienen
    const cruceIdaDate = input && input.cruceIda ? parseDate(input.cruceIda) : null;
    const cruceVueltaDate = input && input.cruceVuelta ? parseDate(input.cruceVuelta) : null;

    const missingCruces = isInternational && (!segmentMode && (!cruceIdaDate || !cruceVueltaDate));
    const invalidOrder = dtIda && dtVuelta && (dtIda.getTime() > dtVuelta.getTime());
    const invalidCrucesOrder = (!segmentMode && cruceIdaDate && cruceVueltaDate && (cruceIdaDate.getTime() > cruceVueltaDate.getTime()));
    const crucesFueraRango = (!segmentMode && cruceIdaDate && cruceVueltaDate && (fechaIdaDate && fechaRegresoDate) && (cruceIdaDate.getTime() < fechaIdaDate.getTime() || cruceVueltaDate.getTime() > fechaRegresoDate.getTime()));

    if (missingDatesOrTimes || missingCruces || invalidOrder || invalidCrucesOrder || crucesFueraRango) {
      // No podemos calcular manutención/noches/retención. Devolver resultado
      // con esas partidas a cero, pero seguir devolviendo importes independientes
      // como km para que la UI pueda mostrar totales parciales.
      const precioKm = (input && input.kmTarifa) ? Number(input.kmTarifa) : 0.26;
      let kmNum = 0;
      if (typeof input.km === 'number') kmNum = input.km;
      else if (typeof input.km === 'string') { const s = input.km.replace(/[^0-9,\.]/g,'').replace(/\./g,'').replace(/,/g,'.'); kmNum = parseFloat(s) || 0; }
      const kmAmount = Math.round((kmNum * precioKm + Number.EPSILON) * 100) / 100;

      result.manutenciones = 0;
      result.manutencionesAmount = 0;
      result.precioManutencion = 0;
      result.precioNoche = 0;
      result.noches = 0;
      result.nochesAmount = 0;
      result.nochesBase = 0;
      result.nochesIfCounted = 0;
      result.nochesIfNotCounted = 0;
      result.nochesAmountIfCounted = 0;
      result.nochesAmountIfNotCounted = 0;
      result.nochesAmbiguous = false;
      result.alojamiento = 0;
      result.alojamientoMaxAmount = 0;
      result.km = kmNum;
      result.kmAmount = kmAmount;
      result.precioKm = precioKm;
      result.irpf = { sujeto: 0, breakdown: [], limitesUsed: [26.67,53.34] };
      return result;
    }
  } catch (e) {
    // En caso de excepción durante la validación, caemos con seguridad y dejamos
    // todo a cero (salvo km si se puede calcular más abajo). Continuamos normalmente.
  }

  // Manutenciones
  let manutenciones = 0;
  let normative = 'decreto';
  try {
    const datos = (typeof window !== 'undefined' && window.__sgtriDatos) ? window.__sgtriDatos : null;
    if (datos && datos.normativasPorTipoProyecto && datos.normativasPorTipoProyecto.rd) {
      const rdList = datos.normativasPorTipoProyecto.rd || [];
      if (input && input.tipoProyecto && rdList.indexOf(input.tipoProyecto) !== -1) normative = 'rd';
    }
  } catch (e) { }

  function minutesOf(t) { return (t && typeof t.hh === 'number' && typeof t.mm === 'number') ? (t.hh * 60 + t.mm) : null; }
  const tDep = minutesOf(horaIda);
  const tRet = minutesOf(horaRegreso);
  const isSameDay = fechaIdaDate && fechaRegresoDate && fechaIdaDate.getFullYear() === fechaRegresoDate.getFullYear() && fechaIdaDate.getMonth() === fechaRegresoDate.getMonth() && fechaIdaDate.getDate() === fechaRegresoDate.getDate();

  if (isSameDay) {
    if (tDep == null || tRet == null) manutenciones = 0;
    else {
      const durationHours = (dtVuelta.getTime() - dtIda.getTime()) / 3600000;
      if (normative === 'rd') {
        const retHalf = (tRet >= (22 * 60) && input && input.ticketCena) ? 0.5 : 0;
        if (durationHours < 5) manutenciones = retHalf;
        else {
          const depHalf = (tDep < (14 * 60) && tRet >= (16 * 60)) ? 0.5 : 0;
          manutenciones = depHalf + retHalf;
        }
      } else {
        const depCond = (tDep < (14 * 60) && tRet >= (16 * 60)) ? 0.5 : 0;
        const retCond = (tRet >= (22 * 60)) ? 0.5 : 0;
        manutenciones = depCond + retCond;
      }
    }
  } else {
    if (tDep != null) {
      if (tDep < (14 * 60)) manutenciones += 1;
      else if (tDep >= (14 * 60) && tDep < (22 * 60)) manutenciones += 0.5;
    }
    if (fechaIdaDate && fechaRegresoDate) {
      const days = daysBetweenMidnights(fechaIdaDate, fechaRegresoDate);
      const intermediate = Math.max(0, days - 1);
      if (intermediate > 0) manutenciones += intermediate;
    }
    if (tRet != null) {
      if (normative === 'rd') {
        if (tRet >= (22 * 60) && input && input.ticketCena) manutenciones += 1;
        else if (tRet >= (14 * 60)) manutenciones += 0.5;
      } else {
        if (tRet >= (22 * 60)) manutenciones += 1;
        else if (tRet >= (14 * 60)) manutenciones += 0.5;
      }
    }
  }

  // aplicar flag excludeManutencion antes de cálculos monetarios
  try { if (flags && flags.excludeManutencion) manutenciones = 0; } catch (e) {}

  // Noches
  let baseNP = 0;
  if (fechaIdaDate && fechaRegresoDate) baseNP = daysBetweenMidnights(fechaIdaDate, fechaRegresoDate);
  let noches = 0; let ambiguous = false; let nochesIfCounted = 0; let nochesIfNotCounted = 0;
  if (baseNP <= 0) { noches = 0; nochesIfCounted = 0; nochesIfNotCounted = 0; }
  else {
    nochesIfCounted = baseNP; nochesIfNotCounted = Math.max(0, baseNP - 1);
    let t = null;
    if (horaRegreso && typeof horaRegreso.hh === 'number' && typeof horaRegreso.mm === 'number') t = horaRegreso.hh * 60 + horaRegreso.mm;
    else if (input && input.horaRegreso) {
      const m = String(input.horaRegreso || '').match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
      if (m) { const hh = parseInt(m[1],10); const mm = parseInt(m[2],10); if (!isNaN(hh) && !isNaN(mm)) t = hh*60 + mm; }
    }
    if (t === null) noches = nochesIfCounted;
    else {
      if (t >= (7*60)) noches = nochesIfCounted;
      else if (t <= (1*60)) noches = nochesIfNotCounted;
      else { ambiguous = true; noches = nochesIfNotCounted; }
    }
  }

  // Valores (precios por país)
  let precioManutencion = 50.55; let precioNoche = 98.88;
  try {
    const datos = (typeof window !== 'undefined' && window.__sgtriDatos) ? window.__sgtriDatos : null;
    if (datos && datos.dietasPorPais && Array.isArray(datos.dietasPorPais.paises)) {
      const paisesArr = datos.dietasPorPais.paises || [];
      let idx = -1;
      if (typeof input.paisIndex === 'number' && input.paisIndex >= 0) idx = input.paisIndex;
      if (idx === -1) idx = paisesArr.indexOf(input && input.pais ? input.pais : '');
      if (idx === -1) idx = Math.max(0, paisesArr.length - 1);
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
  } catch (e) { }
  const precioKm = (input && input.kmTarifa) ? Number(input.kmTarifa) : 0.26;

  // Parse km y alojamiento (robusto)
  let kmNum = 0; if (typeof input.km === 'number') kmNum = input.km; else if (typeof input.km === 'string') { const s = input.km.replace(/[^0-9,\.]/g,'').replace(/\./g,'').replace(/,/g,'.'); kmNum = parseFloat(s) || 0; }
  let alojamientoNum = 0; if (typeof input.alojamiento === 'number') alojamientoNum = input.alojamiento; else if (typeof input.alojamiento === 'string') { const s = input.alojamiento.replace(/[^0-9,\.]/g,'').replace(/\./g,'').replace(/,/g,'.'); alojamientoNum = parseFloat(s) || 0; }

  const manutencionesAmount = Math.round((manutenciones * precioManutencion + Number.EPSILON) * 100) / 100;
  const nochesAmount = Math.round((noches * precioNoche + Number.EPSILON) * 100) / 100;
  const nochesAmountIfCounted = Math.round((nochesIfCounted * precioNoche + Number.EPSILON) * 100) / 100;
  const nochesAmountIfNotCounted = Math.round((nochesIfNotCounted * precioNoche + Number.EPSILON) * 100) / 100;
  const kmAmount = Math.round((kmNum * precioKm + Number.EPSILON) * 100) / 100;

  result.manutenciones = manutenciones;
  result.manutencionesAmount = manutencionesAmount;
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
  if (ambiguous && fechaRegresoDate) {
    const last = new Date(fechaRegresoDate.getTime());
    const penult = new Date(last.getTime()); penult.setDate(last.getDate() - 1);
    function fmtDate(d) { const dd = String(d.getDate()).padStart(2,'0'); const mm = String(d.getMonth()+1).padStart(2,'0'); const yyyy = String(d.getFullYear()); return `${dd}/${mm}/${yyyy}`; }
    result.nochesAmbiguousFrom = fmtDate(penult); result.nochesAmbiguousTo = fmtDate(last);
  }

  // Ajustes por flags: justificarPernocta y excludeAlojamiento
  try {
    if (flags && flags.justificarPernocta) {
      const perNight = Number(precioNoche || 0);
      result.noches = (Number(result.noches) || 0) + 1;
      result.nochesAmount = Math.round(((Number(result.nochesAmount) || 0) + perNight + Number.EPSILON) * 100) / 100;
      result.alojamiento = Math.round(((Number(result.alojamiento) || 0) + perNight + Number.EPSILON) * 100) / 100;
      if (typeof result.nochesIfCounted !== 'undefined') result.nochesIfCounted = (Number(result.nochesIfCounted) || 0) + 1;
      if (typeof result.nochesAmountIfCounted !== 'undefined') result.nochesAmountIfCounted = Math.round(((Number(result.nochesAmountIfCounted) || 0) + perNight + Number.EPSILON) * 100) / 100;
      if (typeof result.nochesIfNotCounted !== 'undefined') result.nochesIfNotCounted = Math.max(0, (Number(result.nochesIfNotCounted) || 0) - 1);
      if (typeof result.nochesAmountIfNotCounted !== 'undefined') result.nochesAmountIfNotCounted = Math.max(0, (Number(result.nochesAmountIfNotCounted) || 0) - perNight);
    }
  } catch (e) {}
  try {
    if (flags && flags.excludeAlojamiento) {
      result.alojamiento = 0; result.noches = 0; result.nochesAmount = 0; if (typeof result.nochesIfCounted !== 'undefined') result.nochesIfCounted = 0; if (typeof result.nochesAmountIfCounted !== 'undefined') result.nochesAmountIfCounted = 0; if (typeof result.nochesIfNotCounted !== 'undefined') result.nochesIfNotCounted = 0; if (typeof result.nochesAmountIfNotCounted !== 'undefined') result.nochesAmountIfNotCounted = 0; result.alojamientoMaxAmount = 0;
    }
  } catch (e) {}

  result.km = kmNum; result.kmAmount = kmAmount; result.alojamiento = alojamientoNum; result.alojamientoMaxAmount = nochesAmount; result.precioKm = precioKm;

  // IRPF
  try {
    const datosFallback = (typeof window !== 'undefined' && window.__sgtriDatos) ? window.__sgtriDatos : null;
    let usedLimits = null;
    if (datosFallback && datosFallback.limitesIRPF) {
      if (typeof input.paisIndex === 'number' && input.paisIndex >= 0) { usedLimits = (input.paisIndex === 0) ? datosFallback.limitesIRPF.esp : datosFallback.limitesIRPF.ext; result.irpfSource = (input.paisIndex === 0) ? 'esp' : 'ext'; }
      else {
        const paisesArr = (datosFallback.dietasPorPais && Array.isArray(datosFallback.dietasPorPais.paises)) ? datosFallback.dietasPorPais.paises : null;
        let idx = -1;
        if (paisesArr && input && input.pais) {
          idx = paisesArr.indexOf(input.pais);
          if (idx === -1) {
            const normalize = s => (s && s.normalize) ? s.normalize('NFD').replace(/[\u0000-\u036f]/g, '') .toLowerCase() : (s || '').toLowerCase();
            const target = normalize(String(input.pais));
            idx = paisesArr.findIndex(p => normalize(String(p)) === target);
          }
        }
        if (idx === 0) { usedLimits = datosFallback.limitesIRPF.esp; result.irpfSource = 'esp'; } else { usedLimits = datosFallback.limitesIRPF.ext; result.irpfSource = 'ext'; }
      }
    }
    if (!usedLimits || !Array.isArray(usedLimits) || usedLimits.length < 2) usedLimits = [26.67, 53.34];

    const perDayManutencionUnits = [];
    if (isSameDay) perDayManutencionUnits.push(manutenciones);
    else {
      let depUnits = 0; if (tDep != null) { if (tDep < (14*60)) depUnits = 1; else if (tDep >= (14*60) && tDep < (22*60)) depUnits = 0.5; else depUnits = 0; }
      perDayManutencionUnits.push(depUnits);
      if (fechaIdaDate && fechaRegresoDate) { const days = daysBetweenMidnights(fechaIdaDate, fechaRegresoDate); const intermediate = Math.max(0, days - 1); for (let i=0;i<intermediate;i++) perDayManutencionUnits.push(1); }
      let retUnits = 0; if (tRet != null) { if (normative === 'rd') { if (tRet >= (22*60) && input && input.ticketCena) retUnits = 1; else if (tRet >= (14*60)) retUnits = 0.5; } else { if (tRet >= (22*60)) retUnits = 1; else if (tRet >= (14*60)) retUnits = 0.5; } }
      perDayManutencionUnits.push(retUnits);
    }

    const perDayDetails = []; let irpfSujetoTotal = 0; const residMul = (input && input.residenciaEventual) ? 0.8 : 1;
    for (let i=0;i<perDayManutencionUnits.length;i++) {
      const units = perDayManutencionUnits[i] || 0;
      const brutoOriginal = Math.round((units * precioManutencion + Number.EPSILON) * 100) / 100;
      const brutoToUse = Math.round((brutoOriginal * residMul + Number.EPSILON) * 100) / 100;
      const isLast = (i === perDayManutencionUnits.length - 1);
      const exento = isLast ? Number(usedLimits[0]) : Number(usedLimits[1]);
      let sujeto = brutoToUse - exento; if (sujeto < 0) sujeto = 0; sujeto = Math.round((sujeto + Number.EPSILON) * 100) / 100;
      perDayDetails.push({ dayIndex: i+1, units, brutoOriginal, bruto: brutoToUse, exento, sujeto, isLast });
      irpfSujetoTotal += sujeto;
    }
    irpfSujetoTotal = Math.round((irpfSujetoTotal + Number.EPSILON) * 100) / 100;
    result.irpf = { sujeto: irpfSujetoTotal, breakdown: perDayDetails, limitesUsed: usedLimits };
  } catch (e) { result.irpf = { sujeto: 0, breakdown: [], limitesUsed: [26.67,53.34] }; }

  // Si se pide excluir manutención, asegurar que IRPF sujeto sea 0
  try { if (flags && flags.excludeManutencion && result && result.irpf) { result.irpf.sujeto = 0; if (Array.isArray(result.irpf.breakdown)) result.irpf.breakdown.forEach(b => { try{ b.sujeto = 0;}catch(e){} }); } } catch (e) {}

  return result;
}

// Exponer la API del motor para compatibilidad hacia atrás
// Exponer el motor en el namespace moderno `calculoDesp`.
window.calculoDesp = window.calculoDesp || {};
window.calculoDesp.calculateDesplazamiento = calculateDesplazamiento;

// -------------------------
// Sección 2: WRAPPER / Orquestador (recolecta DOM, añade flags y renderiza)
// -------------------------
(function () {
  // Las funciones que recolectan datos del DOM y parsean números se han movido
  // a `js/cogeDatosDesp.js` y quedan disponibles en `window.cogeDatosDesp`.
  // Para evitar dependencia del orden de carga de los scripts, no capturamos
  // las referencias en el momento de la carga; en su lugar, definimos
  // respaldos y resolveremos las funciones reales en tiempo de ejecución
  // cuando se invoque `calculaDesplazamientoFicha`.
  function _fallbackCollect(d) { return null; }
  function _fallbackParse(v) { const n = parseFloat(String(v || '').replace(/[^0-9,\.\-]/g,'').replace(/,/g,'.')); return isNaN(n) ? 0 : n; }


  

  function calculaDesplazamientoFicha(despEl) {
    const collectFn = (window.cogeDatosDesp && typeof window.cogeDatosDesp.collectDataFromFicha === 'function') ? window.cogeDatosDesp.collectDataFromFicha : _fallbackCollect;
    const parseNumFn = (window.cogeDatosDesp && typeof window.cogeDatosDesp.parseNumber === 'function') ? window.cogeDatosDesp.parseNumber : _fallbackParse;
    const data = collectFn(despEl);
    if (!data) return null;
    const otrosSum = (Array.isArray(data.otrosGastos) ? data.otrosGastos.reduce((acc, v) => acc + parseNumFn(v), 0) : 0);
    const kmNum = parseNumFn(data.km);
    const alojNum = parseNumFn(data.alojamiento);

    // determinar tarifa km
    let kmTarifa = 0.26;
    try {
      const veh = document.querySelector('input[name="vehiculo-tipo"]:checked');
      const tipoVeh = veh && veh.value ? veh.value : 'coche';
      if (window && window.__sgtriDatos && window.__sgtriDatos.kmTarifas && window.__sgtriDatos.kmTarifas[tipoVeh]) kmTarifa = window.__sgtriDatos.kmTarifas[tipoVeh];
    } catch (e) {}

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
      kmTarifa: kmTarifa,
      // Booleanos top-level (anteriormente en `flags`):
      excludeManutencion: !!data.noManutencion,
      justificarPernocta: !!data.justificarPernocta,
      excludeAlojamiento: !!data.dtInvalid
    };
    // Flags derived from collected `data` (collectDataFromFicha) —
    // evitar leer `despEl.dataset` en varios sitios para mantener la fuente de la verdad en `collectDataFromFicha`.

    let canonical = null;
    try { canonical = calculateDesplazamiento(calcInput); } catch(e) { canonical = null; }

    // Si la UI marcó la ficha como inválida (clase .field-error) o dataset.dtInvalid,
    // forzamos a cero manutenciones, alojamiento e IRPF para no mostrar importes.
    const fechasInvalidas = !!(despEl && despEl.dataset && despEl.dataset.dtInvalid === '1') || (despEl && despEl.querySelector && despEl.querySelector('.field-error') !== null);
    if (fechasInvalidas) {
      try {
        if (!canonical) canonical = {};
        canonical.manutenciones = 0; canonical.manutencionesAmount = 0; canonical.precioManutencion = 0;
        canonical.alojamiento = 0; canonical.alojamientoMaxAmount = 0; canonical.noches = 0; canonical.nochesAmount = 0;
        if (!canonical.irpf) canonical.irpf = { sujeto: 0, breakdown: [], limitesUsed: [26.67,53.34] };
        canonical.irpf.sujeto = 0; if (Array.isArray(canonical.irpf.breakdown)) canonical.irpf.breakdown.forEach(b => { try{ b.sujeto = 0; } catch(e){} });
        // marcar dataset para la UI si no estaba marcado
        try { if (despEl && despEl.dataset && despEl.dataset.dtInvalid !== '1') despEl.dataset.dtInvalid = '1'; } catch(e) {}
      } catch (e) {}
    }

    // Si es internacional y tenemos cruces, generar segmentos (A: ida->cruceIda, B: cruceIda->cruceVuelta, C: cruceVuelta->vuelta)
    try {
      const isInternational = (typeof calcInput.paisIndex === 'number') ? (calcInput.paisIndex > 0) : ((calcInput.pais || '').toString().toLowerCase() !== 'españa' && (calcInput.pais || '').toString() !== '');
      const cruceIdaDateRaw = data.cruceIda;
      const cruceVueltaDateRaw = data.cruceVuelta;
      if (isInternational && cruceIdaDateRaw && cruceVueltaDateRaw) {
        const segments = [];

        // Construir tramos según reglas del usuario:
        // Tramo 1: fechaIda@horaIda -> cruceIda@08:00 (solo si fechaIda != cruceIda)
        // Tramo 2: cruceIda@08:00 -> cruceVuelta@00:00
        // Tramo 3: cruceVuelta@00:00 -> fechaRegreso@horaRegreso (solo si cruceVuelta != fechaRegreso)
        const fechaIdaRaw = data.fechaIda;
        const fechaRegresoRaw = data.fechaRegreso;
        const cruceIdaRaw = data.cruceIda;
        const cruceVueltaRaw = data.cruceVuelta;

        const pushIfValid = (segInp) => { if (segInp) segments.push(segInp); };

        // Helper que monta input con horas concretas
        const makeSegInputWithTimes = (startDate, startTime, endDate, endTime, segPais, segPaisIndex, segTicketCena) => {
          if (!startDate || !endDate) return null;
          const copy = Object.assign({}, calcInput);
          copy.fechaIda = startDate;
          copy.horaIda = startTime || '';
          copy.fechaRegreso = endDate;
          copy.horaRegreso = endTime || '';
          copy.cruceIda = '';
          copy.cruceVuelta = '';
          copy.pais = segPais;
          copy.paisIndex = (typeof segPaisIndex === 'number') ? segPaisIndex : copy.paisIndex;
          copy.km = 0;
          copy.alojamiento = 0;
          // For segment sub-calculations we only set `ticketCena` when the
          // caller explicitly requests it (pass `segTicketCena` true for the
          // final segment). This lets the motor compute correctly (including
          // IRPF) for the last segment while leaving earlier segments unaffected.
          copy.ticketCena = !!segTicketCena;
          copy._segmentMode = true;
          return copy;
        };

        // Determinar normativa para tramos (coincide con la lógica del motor)
        let normativeWrapper = 'decreto';
        try {
          const rdList = (typeof window !== 'undefined' && window.__sgtriDatos && window.__sgtriDatos.normativasPorTipoProyecto && window.__sgtriDatos.normativasPorTipoProyecto.rd) ? window.__sgtriDatos.normativasPorTipoProyecto.rd : null;
          if (rdList && calcInput && calcInput.tipoProyecto && rdList.indexOf(calcInput.tipoProyecto) !== -1) normativeWrapper = 'rd';
        } catch (e) {}

        // Para la normativa 'decreto' se debe comprobar el checkbox de ticket-cena
        // SOLO en el último tramo; en los tramos intermedios se asume que ha cenado.
        const nonFinalAssumeCena = (normativeWrapper === 'decreto');

        // Tramo 1
        try {
          if (fechaIdaRaw && cruceIdaRaw && String(fechaIdaRaw).trim() !== String(cruceIdaRaw).trim()) {
            pushIfValid(makeSegInputWithTimes(fechaIdaRaw, data.horaIda || '', cruceIdaRaw, '08:00', 'España', 0, nonFinalAssumeCena));
          }
        } catch(e) {}

        // Tramo 2 (central) — siempre si hay ambos cruces
        try {
          if (cruceIdaRaw && cruceVueltaRaw) {
            // Usar 23:59 como hora de fin en el tramo central para que
            // un cruce a las 00:00 no reste la noche anterior (00:00 se
            // interpreta como inicio de día y podría reducir el conteo).
            pushIfValid(makeSegInputWithTimes(cruceIdaRaw, '08:00', cruceVueltaRaw, '23:59', data.pais || calcInput.pais, calcInput.paisIndex, nonFinalAssumeCena));
          }
        } catch(e) {}

        // Tramo 3: tramo final siempre calculado con importes de España
        try {
          if (cruceVueltaRaw && fechaRegresoRaw) {
            // For the final segment, pass through the original ticketCena flag
            // so the motor can compute the correct effect (including IRPF).
            pushIfValid(makeSegInputWithTimes(cruceVueltaRaw, '00:00', fechaRegresoRaw, data.horaRegreso || '', 'España', 0, !!data.ticketCena));
          }
        } catch(e) {}

        // Compute raw segment results via motor
        const segResultsRaw = segments.map(sin => {
          try { return calculateDesplazamiento(sin); } catch(e) { return null; }
        }).filter(r => r !== null);

        // DEBUG logging: if this tipoProyecto uses RD (462/2002), print segment inputs and outputs
        try {
          const rdList = (typeof window !== 'undefined' && window.__sgtriDatos && window.__sgtriDatos.normativasPorTipoProyecto && window.__sgtriDatos.normativasPorTipoProyecto.rd) ? window.__sgtriDatos.normativasPorTipoProyecto.rd : null;
          const isRd = rdList && calcInput && calcInput.tipoProyecto && rdList.indexOf(calcInput.tipoProyecto) !== -1;
          if (isRd) {
            try { console.debug('[calculoDesp] RD DEBUG - segments inputs:', JSON.parse(JSON.stringify(segments))); } catch(e) { console.debug('[calculoDesp] RD DEBUG - segments inputs (unserializable)'); }
            try { console.debug('[calculoDesp] RD DEBUG - segResultsRaw:', JSON.parse(JSON.stringify(segResultsRaw))); } catch(e) { console.debug('[calculoDesp] RD DEBUG - segResultsRaw (unserializable)'); }
          }
        } catch(e) {}

        // Filtrar tramos vacíos, pero asegurarnos de que el tramo final
        // (último generado) siempre se incluya aunque sus importes sean 0.
        const segResultsFiltered = segResultsRaw.filter(r => r && ( (r.noches && r.noches>0) || (r.manutenciones && r.manutenciones>0) || (r.km && r.km>0) || (r.nochesAmbiguous) ));
        if (segResultsRaw.length > 0) {
          const finalRaw = segResultsRaw[segResultsRaw.length - 1];
          // si el final no está en el filtrado, añadirlo
          if (finalRaw && !segResultsFiltered.includes(finalRaw)) segResultsFiltered.push(finalRaw);
        }

        // nota: ticket-cena ahora se pasa solo al último segmento para que
        // el motor lo compute correctamente; no hacemos ajustes manuales aquí.

        if (Array.isArray(segResultsFiltered) && segResultsFiltered.length>0) {
          canonical = canonical || {};
          canonical.segmentsResults = segResultsFiltered;
        }
        // Si la validación global de fechas falló, asegurarnos de que los tramos
        // también tengan manutención/alojamiento/irpf a 0 para no mostrar importes.
        if (fechasInvalidas && canonical && Array.isArray(canonical.segmentsResults)) {
          canonical.segmentsResults.forEach(s => {
            try {
              if (!s) return;
              s.manutenciones = 0; s.manutencionesAmount = 0; s.precioManutencion = 0;
              s.alojamiento = 0; s.alojamientoMaxAmount = 0; s.noches = 0; s.nochesAmount = 0;
              if (!s.irpf) s.irpf = { sujeto: 0, breakdown: [], limitesUsed: [26.67,53.34] };
              s.irpf.sujeto = 0; if (Array.isArray(s.irpf.breakdown)) s.irpf.breakdown.forEach(b => { try{ b.sujeto = 0; }catch(e){} });
            } catch(e) {}
          });
        }
      }
    } catch(e) { /* no bloquear render si falla segmentación */ }

    const displayContext = {
      otrosSum,
      kmNum,
      alojNum,
      excludeManutencion: !!calcInput.excludeManutencion,
      justificarPernocta: !!calcInput.justificarPernocta,
      excludeAlojamiento: !!calcInput.excludeAlojamiento,
      id: data.id
    };

    try { if (window && window.salidaDesp && typeof window.salidaDesp.renderSalida === 'function') window.salidaDesp.renderSalida(despEl, canonical, displayContext); } catch (e) {}

    return { canonical, displayContext, calcInput };
  }

  // API pública de `calculoDesp` (export):
  // - `calculaDesplazamientoFicha(despEl)`: recoge datos de la ficha DOM y calcula.
  // - `collectDataFromFicha(despEl)`: devuelve un objeto con campos raw de la ficha.
  // - `parseNumber(v)`: parser robusto para importes numéricos (nuevo nombre).
  // Se mantiene `parseNumericLoose` como alias por compatibilidad hacia atrás.
  // Exportar API pública. Reexportar las utilidades de `cogeDatosDesp` si están
  // disponibles para mantener compatibilidad con código que las consume.
  window.calculoDesp = window.calculoDesp || {};
  window.calculoDesp.calculaDesplazamientoFicha = calculaDesplazamientoFicha;
  window.calculoDesp.collectDataFromFicha = function() { return (window.cogeDatosDesp && typeof window.cogeDatosDesp.collectDataFromFicha === 'function') ? window.cogeDatosDesp.collectDataFromFicha.apply(null, arguments) : _fallbackCollect.apply(null, arguments); };
  window.calculoDesp.parseNumber = function() { return (window.cogeDatosDesp && typeof window.cogeDatosDesp.parseNumber === 'function') ? window.cogeDatosDesp.parseNumber.apply(null, arguments) : _fallbackParse.apply(null, arguments); };
  window.calculoDesp.parseNumericLoose = window.calculoDesp.parseNumber;
})();
