// js/calculoDesp.js (fusionado)
// Arquitectura:
//   - MOTOR: funciones puras de cálculo (no manipulan DOM)
//   - WRAPPER: orquestador que conecta DOM → Motor → Renderer
//
// El motor recibe un input normalizado y devuelve resultados numéricos.
// Flags soportados: excludeManutencion, excludeAlojamiento, justificarPernocta

// =============================================================================
// Sección 1: MOTOR DE CÁLCULO (funciones puras)
// =============================================================================

// -----------------------------------------------------------------------------
// 1.1 Parsers (wrappers de limpiaDatos con fallback)
// -----------------------------------------------------------------------------

/**
 * Parsea fecha dd/mm/aa a Date.
 * Usa limpiaDatos si está disponible.
 */
function parseDate(ddmmaa) {
  if (window.limpiaDatos && window.limpiaDatos.parseDateStrict) {
    return window.limpiaDatos.parseDateStrict(ddmmaa);
  }
  // Fallback
  if (!ddmmaa) return null;
  const parts = String(ddmmaa).split('/').map(p => p.trim());
  if (parts.length < 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  let y = parseInt(parts[2], 10);
  if (y < 100) y = 2000 + y;
  return new Date(y, m, d);
}

/**
 * Parsea hora hh:mm a {hh, mm}.
 * Usa limpiaDatos si está disponible.
 */
function parseTime(hhmm) {
  if (window.limpiaDatos && window.limpiaDatos.parseTimeStrict) {
    return window.limpiaDatos.parseTimeStrict(hhmm);
  }
  // Fallback
  if (!hhmm) return null;
  const parts = String(hhmm).split(':').map(p => p.trim());
  if (parts.length < 2) return null;
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  return { hh, mm };
}

/**
 * Parsea número con tolerancia a formatos europeos.
 * Usa limpiaDatos si está disponible.
 */
function parseNumber(value) {
  if (window.limpiaDatos && window.limpiaDatos.parseNumber) {
    return window.limpiaDatos.parseNumber(value);
  }
  // Fallback
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const s = String(value).replace(/[^0-9,.\-]/g, '').replace(/\./g, '').replace(/,/g, '.');
  return parseFloat(s) || 0;
}

// -----------------------------------------------------------------------------
// 1.2 Utilidades de fecha/hora
// -----------------------------------------------------------------------------

/**
 * Combina fecha y hora en un DateTime.
 */
function toDateTime(dateObj, timeObj) {
  if (!dateObj) return null;
  const d = new Date(dateObj.getTime());
  d.setHours(timeObj ? timeObj.hh : 0);
  d.setMinutes(timeObj ? timeObj.mm : 0);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d;
}

/**
 * Calcula días naturales entre dos fechas (medianoche a medianoche).
 */
function daysBetween(a, b) {
  if (!a || !b) return 0;
  const msPerDay = 86400000;
  const am = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bm = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((bm - am) / msPerDay));
}

/**
 * Convierte hora {hh, mm} a minutos desde medianoche.
 */
function toMinutes(time) {
  if (!time || typeof time.hh !== 'number') return null;
  return time.hh * 60 + time.mm;
}

/**
 * Verifica si dos fechas son el mismo día.
 */
function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

/**
 * Formatea Date a string dd/mm/yyyy.
 */
function formatDateDMY(d) {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Redondea a 2 decimales.
 */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// -----------------------------------------------------------------------------
// 1.3 Lectura de flags y datos externos
// -----------------------------------------------------------------------------

/**
 * Extrae flags del input con compatibilidad hacia atrás.
 */
function extractFlags(input) {
  const get = (name, fallback) => {
    if (input && input[name] !== undefined) return input[name];
    if (input && input.flags && input.flags[name] !== undefined) return input.flags[name];
    return fallback;
  };

  return {
    segmentMode: get('_segmentMode', false),
    excludeManutencion: get('excludeManutencion', false),
    excludeAlojamiento: get('excludeAlojamiento', false),
    justificarPernocta: get('justificarPernocta', false),
    isLastIntlSegment: get('_isLastIntlSegment', false),      // Último tramo de viaje internacional (manutención)
    forceAllNights: get('_forceAllNights', false),            // Forzar todas las noches (tramos no-finales)
    comesFromPreviousDay: get('_comesFromPreviousDay', false), // Viene del día anterior (último tramo intl mismo día)
    forceZeroNights: get('_forceZeroNights', false),          // Forzar 0 noches (cuando la noche ambigua pertenece al tramo anterior)
    lastNightAmbiguousByHour: get('_lastNightAmbiguousByHour', null), // Hora para decidir si la última noche cuenta (formato 'HH:MM')
    lastNightJustified: get('_lastNightJustified', false)     // Si la última noche está justificada (checkbox marcado)
  };
}

/**
 * Obtiene los datos de configuración (dietas, normativas, etc.).
 */
function getDatos() {
  return (typeof window !== 'undefined' && window.__sgtriDatos) || null;
}

/**
 * Determina la normativa aplicable según el tipo de proyecto.
 */
function getNormativa(tipoProyecto) {
  const datos = getDatos();
  if (!datos || !datos.normativasPorTipoProyecto) return 'decreto';
  const rdList = datos.normativasPorTipoProyecto.rd || [];
  return rdList.includes(tipoProyecto) ? 'rd' : 'decreto';
}

/**
 * Obtiene precios de manutención y alojamiento según país y normativa.
 */
function getPrecios(paisIndex, pais, normativa) {
  const defaults = { manutencion: 50.55, noche: 98.88 };
  const datos = getDatos();

  if (!datos || !datos.dietasPorPais || !Array.isArray(datos.dietasPorPais.paises)) {
    return defaults;
  }

  const paisesArr = datos.dietasPorPais.paises;
  let idx = (typeof paisIndex === 'number' && paisIndex >= 0) ? paisIndex : -1;
  if (idx === -1) idx = paisesArr.indexOf(pais || '');
  if (idx === -1) idx = Math.max(0, paisesArr.length - 1);

  const tablas = normativa === 'rd'
    ? datos.dietasPorPais.rd462_2002
    : datos.dietasPorPais.decreto42_2025;

  if (!tablas) return defaults;

  return {
    manutencion: Number(tablas.manutencion?.[idx]) || defaults.manutencion,
    noche: Number(tablas.alojamiento?.[idx]) || defaults.noche
  };
}

/**
 * Obtiene límites IRPF según país.
 */
function getLimitesIRPF(paisIndex, pais) {
  const defaults = [26.67, 53.34];
  const datos = getDatos();

  if (!datos || !datos.limitesIRPF) return { limites: defaults, source: 'default' };

  // Por índice de país
  if (typeof paisIndex === 'number' && paisIndex >= 0) {
    const isSpain = paisIndex === 0;
    return {
      limites: isSpain ? datos.limitesIRPF.esp : datos.limitesIRPF.ext,
      source: isSpain ? 'esp' : 'ext'
    };
  }

  // Por nombre de país
  const paisesArr = datos.dietasPorPais?.paises || [];
  let idx = paisesArr.indexOf(pais || '');
  if (idx === -1) {
    const normalize = s => (s?.normalize?.('NFD') || s || '').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    idx = paisesArr.findIndex(p => normalize(p) === normalize(pais));
  }

  const isSpain = idx === 0;
  return {
    limites: isSpain ? datos.limitesIRPF.esp : datos.limitesIRPF.ext,
    source: isSpain ? 'esp' : 'ext'
  };
}

// -----------------------------------------------------------------------------
// 1.4 Validación de entrada
// -----------------------------------------------------------------------------

/**
 * Valida que el input tenga los datos mínimos necesarios.
 * @returns {Object} { valid, reason }
 */
function validateInput(parsed, flags) {
  const { fechaIda, fechaRegreso, horaIda, horaRegreso, dtIda, dtRegreso, cruceIda, cruceVuelta, isInternational } = parsed;
  const { segmentMode } = flags;

  // Fechas obligatorias
  if (!fechaIda || !fechaRegreso) {
    return { valid: false, reason: 'missing_dates' };
  }

  // Horas obligatorias (excepto en modo segmento)
  if (!segmentMode && (!horaIda || !horaRegreso)) {
    return { valid: false, reason: 'missing_times' };
  }

  // Orden lógico: ida <= regreso
  if (dtIda && dtRegreso && dtIda.getTime() > dtRegreso.getTime()) {
    return { valid: false, reason: 'invalid_order' };
  }

  // Validaciones de cruces para viajes internacionales
  if (isInternational && !segmentMode) {
    if (!cruceIda || !cruceVuelta) {
      return { valid: false, reason: 'missing_cruces' };
    }
    if (cruceIda.getTime() > cruceVuelta.getTime()) {
      return { valid: false, reason: 'invalid_cruces_order' };
    }
    if (cruceIda.getTime() < fechaIda.getTime() || cruceVuelta.getTime() > fechaRegreso.getTime()) {
      return { valid: false, reason: 'cruces_out_of_range' };
    }
  }

  return { valid: true, reason: null };
}

/**
 * Construye resultado vacío (para inputs inválidos).
 */
function buildEmptyResult(input, kmAmount, precioKm) {
  return {
    ...input,
    manutenciones: 0,
    manutencionesAmount: 0,
    precioManutencion: 0,
    precioNoche: 0,
    noches: 0,
    nochesAmount: 0,
    nochesBase: 0,
    nochesIfCounted: 0,
    nochesIfNotCounted: 0,
    nochesAmountIfCounted: 0,
    nochesAmountIfNotCounted: 0,
    nochesAmbiguous: false,
    alojamiento: 0,
    alojamientoMaxAmount: 0,
    km: parseNumber(input.km),
    kmAmount: kmAmount,
    precioKm: precioKm,
    irpf: { sujeto: 0, breakdown: [], limitesUsed: [26.67, 53.34] }
  };
}

// -----------------------------------------------------------------------------
// 1.5 Cálculo de manutenciones
// -----------------------------------------------------------------------------

/**
 * Constantes de tiempo (en minutos).
 */
const HORA_COMIDA = 14 * 60;      // 14:00
const HORA_FIN_COMIDA = 16 * 60;  // 16:00
const HORA_CENA = 22 * 60;        // 22:00
const HORA_PERNOCTA_MIN = 1 * 60; // 01:00
const HORA_PERNOCTA_MAX = 7 * 60; // 07:00

/**
 * Calcula manutenciones para un viaje de un solo día.
 * @param {boolean} isLastIntlSegment - Si es el último tramo de un viaje internacional,
 *   no se requiere volver después de las 16:00 para media manutención (basta con 14:00).
 */
function calcManutencionesSameDay(tDep, tRet, dtIda, dtVuelta, normativa, ticketCena, isLastIntlSegment = false) {
  if (tDep === null || tRet === null) return 0;

  const durationHours = (dtVuelta.getTime() - dtIda.getTime()) / 3600000;

  // Media manutención por cena (depende de normativa y ticket)
  const cenaCuenta = (normativa === 'rd') ? (tRet >= HORA_CENA && ticketCena) : (tRet >= HORA_CENA);
  const retHalf = cenaCuenta ? 0.5 : 0;

  // Para RD: si duración < 5h, solo cuenta la cena
  if (normativa === 'rd' && durationHours < 5) {
    return retHalf;
  }

  // Media manutención por comida
  // En el último tramo internacional, basta con volver después de las 14:00
  const horaFinComidaEfectiva = isLastIntlSegment ? HORA_COMIDA : HORA_FIN_COMIDA;
  const comidaCuenta = (tDep < HORA_COMIDA && tRet >= horaFinComidaEfectiva);
  const depHalf = comidaCuenta ? 0.5 : 0;

  return depHalf + retHalf;
}

/**
 * Calcula manutenciones para un viaje de varios días.
 * @param {boolean} isLastIntlSegment - Si es el último tramo de un viaje internacional,
 *   basta con volver después de las 14:00 para sumar media manutención.
 */
function calcManutencionesSeveralDays(tDep, tRet, diasIntermedios, normativa, ticketCena, isLastIntlSegment = false) {
  let total = 0;

  // Día de ida
  if (tDep !== null) {
    if (tDep < HORA_COMIDA) {
      total += 1;
    } else if (tDep < HORA_CENA) {
      total += 0.5;
    }
  }

  // Días intermedios (1 manutención completa cada uno)
  total += diasIntermedios;

  // Día de regreso
  // En el último tramo internacional, basta con 14:00 para media manutención
  if (tRet !== null) {
    const cenaCuenta = (normativa === 'rd') ? (tRet >= HORA_CENA && ticketCena) : (tRet >= HORA_CENA);
    if (cenaCuenta) {
      total += 1;
    } else if (tRet >= HORA_COMIDA) {
      // En desplazamientos normales se requiere >= 16:00, pero en último tramo intl basta con 14:00
      // Como ya estamos verificando >= HORA_COMIDA (14:00), esto ya cubre ambos casos
      total += 0.5;
    }
  }

  return total;
}

/**
 * Calcula el número total de manutenciones.
 * @param {boolean} isLastIntlSegment - Si es el último tramo de un viaje internacional.
 */
function calcManutenciones(parsed, normativa, ticketCena, isLastIntlSegment = false) {
  const { fechaIda, fechaRegreso, horaIda, horaRegreso, dtIda, dtRegreso } = parsed;
  const tDep = toMinutes(horaIda);
  const tRet = toMinutes(horaRegreso);

  if (isSameDay(fechaIda, fechaRegreso)) {
    return calcManutencionesSameDay(tDep, tRet, dtIda, dtRegreso, normativa, ticketCena, isLastIntlSegment);
  }

  const dias = daysBetween(fechaIda, fechaRegreso);
  const diasIntermedios = Math.max(0, dias - 1);
  return calcManutencionesSeveralDays(tDep, tRet, diasIntermedios, normativa, ticketCena, isLastIntlSegment);
}

// -----------------------------------------------------------------------------
// 1.6 Cálculo de noches
// -----------------------------------------------------------------------------

/**
 * Resultado de cálculo de noches.
 * @typedef {Object} NochesResult
 * @property {number} noches - Noches a contar (valor por defecto)
 * @property {number} nochesIfCounted - Noches si se justifica la última
 * @property {number} nochesIfNotCounted - Noches si NO se justifica la última
 * @property {boolean} ambiguous - Si la última noche está en zona ambigua
 */

/**
 * Crea un resultado de noches estándar.
 */
function nochesResult(noches, nochesIfCounted, nochesIfNotCounted, ambiguous) {
  return { noches, nochesIfCounted, nochesIfNotCounted, ambiguous };
}

/**
 * Determina si una hora de regreso (en minutos) cuenta como pernocta.
 * 
 * Reglas de pernoctación:
 * - <= 01:00 (HORA_PERNOCTA_MIN): NO pernocta
 * - >= 07:00 (HORA_PERNOCTA_MAX): SÍ pernocta
 * - Entre 01:01 y 06:59: Zona AMBIGUA
 * 
 * @param {number|null} tRet - Hora de regreso en minutos desde medianoche
 * @param {boolean} justified - Si está justificada la última noche
 * @returns {{ counts: boolean, ambiguous: boolean }}
 */
function evalLastNightByHour(tRet, justified = false) {
  // Sin hora → conservador: NO pernocta
  if (tRet === null) {
    return { counts: false, ambiguous: false };
  }
  // >= 07:00 → SÍ pernocta
  if (tRet >= HORA_PERNOCTA_MAX) {
    return { counts: true, ambiguous: false };
  }
  // <= 01:00 → NO pernocta
  if (tRet <= HORA_PERNOCTA_MIN) {
    return { counts: false, ambiguous: false };
  }
  // Zona ambigua (01:01-06:59): depende de justificación
  return { counts: justified, ambiguous: true };
}

/**
 * Calcula noches de alojamiento.
 * 
 * Tipos de tramos y sus flags:
 * 
 * 1. TRAMO NO-FINAL (España ida o extranjero con regreso posterior):
 *    - forceAllNights=true: todas las noches cuentan, sin ambigüedad
 * 
 * 2. TRAMO EXTRANJERO con regreso mismo día que cruceVuelta:
 *    - forceAllNights=true + lastNightAmbiguousByHour='HH:MM'
 *    - La última noche pertenece a este tramo (no al tramo España vuelta)
 *    - Se evalúa ambigüedad según la hora de regreso real
 *    - lastNightJustified indica si el usuario justificó la última noche
 * 
 * 3. TRAMO ESPAÑA VUELTA con regreso mismo día que cruceVuelta:
 *    - forceZeroNights=true: 0 noches (la noche ambigua está en el tramo extranjero)
 * 
 * 4. TRAMO ESPAÑA VUELTA con regreso posterior a cruceVuelta:
 *    - comesFromPreviousDay=true: aplica ambigüedad aunque el tramo sea de un solo día
 *    - Usa la hora de regreso normal para evaluar la ambigüedad
 * 
 * 5. TRAMO NORMAL (nacional o sin flags especiales):
 *    - Usa la lógica estándar de días entre fechas y hora de regreso
 * 
 * @param {Object} parsed - Datos parseados con fechaIda, fechaRegreso, horaRegreso
 * @param {Object} flags - Flags de control para casos especiales
 * @returns {NochesResult}
 */
function calcNoches(parsed, flags = {}) {
  const { fechaIda, fechaRegreso, horaRegreso } = parsed;
  const { 
    forceAllNights, 
    forceZeroNights, 
    comesFromPreviousDay, 
    lastNightAmbiguousByHour, 
    lastNightJustified 
  } = flags;
  
  const diasEntre = daysBetween(fechaIda, fechaRegreso);

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 1: Forzar 0 noches (tramo España vuelta cuando cruceVuelta == regreso)
  // ─────────────────────────────────────────────────────────────────────────
  if (forceZeroNights) {
    return nochesResult(0, 0, 0, false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 2: Forzar todas las noches (tramos no-finales)
  // ─────────────────────────────────────────────────────────────────────────
  if (forceAllNights) {
    const nochesBase = Math.max(0, diasEntre);
    
    // Subcaso 2a: La última noche es ambigua según hora de regreso externa
    if (lastNightAmbiguousByHour && nochesBase > 0) {
      const [hh, mm] = lastNightAmbiguousByHour.split(':').map(Number);
      const tRet = hh * 60 + mm;
      const { counts, ambiguous } = evalLastNightByHour(tRet, lastNightJustified);
      
      const nochesIfCounted = nochesBase;
      const nochesIfNotCounted = Math.max(0, nochesBase - 1);
      const noches = counts ? nochesIfCounted : nochesIfNotCounted;
      
      return nochesResult(noches, nochesIfCounted, nochesIfNotCounted, ambiguous);
    }
    
    // Subcaso 2b: Sin ambigüedad, todas las noches cuentan
    return nochesResult(nochesBase, nochesBase, nochesBase, false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 3: Mismo día con viaje que viene del día anterior
  // ─────────────────────────────────────────────────────────────────────────
  if (diasEntre <= 0 && comesFromPreviousDay) {
    const tRet = toMinutes(horaRegreso);
    const { counts, ambiguous } = evalLastNightByHour(tRet, false);
    const noches = counts ? 1 : 0;
    return nochesResult(noches, 1, 0, ambiguous);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 4: Mismo día normal (sin pernocta)
  // ─────────────────────────────────────────────────────────────────────────
  if (diasEntre <= 0) {
    return nochesResult(0, 0, 0, false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO 5: Varios días (lógica estándar)
  // ─────────────────────────────────────────────────────────────────────────
  const nochesBase = diasEntre;
  const nochesIfCounted = nochesBase;
  const nochesIfNotCounted = Math.max(0, nochesBase - 1);

  const tRet = toMinutes(horaRegreso);
  
  // Sin hora de regreso → asumir que sí pernocta
  if (tRet === null) {
    return nochesResult(nochesBase, nochesIfCounted, nochesIfNotCounted, false);
  }

  const { counts, ambiguous } = evalLastNightByHour(tRet, false);
  const noches = counts ? nochesIfCounted : nochesIfNotCounted;
  
  return nochesResult(noches, nochesIfCounted, nochesIfNotCounted, ambiguous);
}

// -----------------------------------------------------------------------------
// 1.7 Cálculo de IRPF
// -----------------------------------------------------------------------------

/**
 * Obtiene las unidades de manutención por día para el cálculo de IRPF.
 */
function getPerDayManutencionUnits(parsed, normativa, ticketCena, manutencionesSameDay) {
  const { fechaIda, fechaRegreso, horaIda, horaRegreso } = parsed;
  const tDep = toMinutes(horaIda);
  const tRet = toMinutes(horaRegreso);

  if (isSameDay(fechaIda, fechaRegreso)) {
    return [manutencionesSameDay];
  }

  const units = [];

  // Día de ida
  let depUnits = 0;
  if (tDep !== null) {
    if (tDep < HORA_COMIDA) depUnits = 1;
    else if (tDep < HORA_CENA) depUnits = 0.5;
  }
  units.push(depUnits);

  // Días intermedios
  const dias = daysBetween(fechaIda, fechaRegreso);
  for (let i = 0; i < dias - 1; i++) {
    units.push(1);
  }

  // Día de regreso
  let retUnits = 0;
  if (tRet !== null) {
    const cenaCuenta = (normativa === 'rd') ? (tRet >= HORA_CENA && ticketCena) : (tRet >= HORA_CENA);
    if (cenaCuenta) retUnits = 1;
    else if (tRet >= HORA_COMIDA) retUnits = 0.5;
  }
  units.push(retUnits);

  return units;
}

/**
 * Calcula el IRPF sujeto por día y el total.
 */
function calcIRPF(parsed, manutenciones, precioManutencion, normativa, ticketCena, input) {
  const { limites, source } = getLimitesIRPF(input.paisIndex, input.pais);
  const residMul = input.residenciaEventual ? 0.8 : 1;

  const perDayUnits = getPerDayManutencionUnits(parsed, normativa, ticketCena, manutenciones);

  let sujetoTotal = 0;
  const breakdown = perDayUnits.map((units, i) => {
    const brutoOriginal = round2(units * precioManutencion);
    const bruto = round2(brutoOriginal * residMul);
    const isLast = (i === perDayUnits.length - 1);
    const exento = Number(isLast ? limites[0] : limites[1]);
    const sujeto = round2(Math.max(0, bruto - exento));

    sujetoTotal += sujeto;
    return { dayIndex: i + 1, units, brutoOriginal, bruto, exento, sujeto, isLast };
  });

  return {
    sujeto: round2(sujetoTotal),
    breakdown,
    limitesUsed: limites,
    source
  };
}

// -----------------------------------------------------------------------------
// 1.8 Aplicación de flags post-cálculo
// -----------------------------------------------------------------------------

/**
 * Aplica el flag justificarPernocta (añade una noche extra).
 */
function applyJustificarPernocta(result, precioNoche) {
  // Solo aplica si hay ambigüedad: asigna nochesIfCounted como valor final
  // Mantiene nochesAmbiguous = true para que la UI siga mostrando el aviso
  if (result.nochesAmbiguous) {
    result.noches = result.nochesIfCounted;
    result.nochesAmount = result.nochesAmountIfCounted;
    // NO modificar nochesAmbiguous - la UI necesita saber que era ambiguo
  }
}

/**
 * Aplica el flag excludeAlojamiento (pone todo a 0).
 */
function applyExcludeAlojamiento(result) {
  result.alojamiento = 0;
  result.noches = 0;
  result.nochesAmount = 0;
  result.nochesIfCounted = 0;
  result.nochesAmountIfCounted = 0;
  result.nochesIfNotCounted = 0;
  result.nochesAmountIfNotCounted = 0;
  result.alojamientoMaxAmount = 0;
}

/**
 * Aplica el flag excludeManutencion al IRPF.
 */
function applyExcludeManutencionToIRPF(result) {
  if (result.irpf) {
    result.irpf.sujeto = 0;
    if (Array.isArray(result.irpf.breakdown)) {
      result.irpf.breakdown.forEach(b => { b.sujeto = 0; });
    }
  }
}

// -----------------------------------------------------------------------------
// 1.9 Función principal del motor
// -----------------------------------------------------------------------------

/**
 * Motor de cálculo de desplazamientos.
 * Recibe un input normalizado y devuelve los resultados del cálculo.
 */
function calculateDesplazamiento(input) {
  if (!input) return null;

  // Extraer flags
  const flags = extractFlags(input);

  // Parsear fechas y horas
  const fechaIda = parseDate(input.fechaIda);
  const fechaRegreso = parseDate(input.fechaRegreso);
  const horaIda = parseTime(input.horaIda);
  const horaRegreso = parseTime(input.horaRegreso);
  const cruceIda = parseDate(input.cruceIda);
  const cruceVuelta = parseDate(input.cruceVuelta);

  const dtIda = toDateTime(fechaIda, horaIda);
  const dtRegreso = toDateTime(fechaRegreso, horaRegreso);

  const isInternational = (typeof input.paisIndex === 'number')
    ? input.paisIndex > 0
    : (input.pais || '').toLowerCase() !== 'españa' && input.pais !== '';

  const parsed = {
    fechaIda, fechaRegreso, horaIda, horaRegreso,
    dtIda, dtRegreso, cruceIda, cruceVuelta, isInternational
  };

  // Validar input
  const precioKm = Number(input.kmTarifa) || 0.26;
  const kmNum = parseNumber(input.km);
  const kmAmount = round2(kmNum * precioKm);

  const validation = validateInput(parsed, flags);
  if (!validation.valid) {
    return buildEmptyResult(input, kmAmount, precioKm);
  }

  // Obtener configuración
  const normativa = getNormativa(input.tipoProyecto);
  const precios = getPrecios(input.paisIndex, input.pais, normativa);
  const ticketCena = input.ticketCena;

  // Calcular manutenciones (pasar flag de último tramo internacional)
  let manutenciones = calcManutenciones(parsed, normativa, ticketCena, flags.isLastIntlSegment);
  if (flags.excludeManutencion) {
    manutenciones = 0;
  }

  // Calcular noches (pasando flags para viajes internacionales)
  const nochesCalc = calcNoches(parsed, {
    forceAllNights: flags.forceAllNights,
    comesFromPreviousDay: flags.comesFromPreviousDay,
    forceZeroNights: flags.forceZeroNights,
    lastNightAmbiguousByHour: flags.lastNightAmbiguousByHour,
    lastNightJustified: flags.lastNightJustified
  });

  // Calcular importes
  const manutencionesAmount = round2(manutenciones * precios.manutencion);
  const nochesAmount = round2(nochesCalc.noches * precios.noche);
  const nochesAmountIfCounted = round2(nochesCalc.nochesIfCounted * precios.noche);
  const nochesAmountIfNotCounted = round2(nochesCalc.nochesIfNotCounted * precios.noche);

  // Parsear valores de usuario
  const alojamientoNum = parseNumber(input.alojamiento);

  // Construir resultado base
  const result = {
    ...input,
    manutenciones,
    manutencionesAmount,
    precioManutencion: precios.manutencion,
    precioNoche: precios.noche,
    precioKm,
    noches: nochesCalc.noches,
    nochesAmount,
    nochesBase: daysBetween(fechaIda, fechaRegreso),
    nochesIfCounted: nochesCalc.nochesIfCounted,
    nochesIfNotCounted: nochesCalc.nochesIfNotCounted,
    nochesAmountIfCounted,
    nochesAmountIfNotCounted,
    nochesAmbiguous: nochesCalc.ambiguous,
    km: kmNum,
    kmAmount,
    alojamiento: alojamientoNum,
    alojamientoMaxAmount: nochesAmount
  };

  // Añadir fechas de ambigüedad si aplica
  if (nochesCalc.ambiguous && fechaRegreso) {
    const last = new Date(fechaRegreso.getTime());
    const penult = new Date(last.getTime());
    penult.setDate(last.getDate() - 1);
    result.nochesAmbiguousFrom = formatDateDMY(penult);
    result.nochesAmbiguousTo = formatDateDMY(last);
  }

  // Calcular IRPF
  result.irpf = calcIRPF(parsed, manutenciones, precios.manutencion, normativa, ticketCena, input);
  result.irpfSource = result.irpf.source;

  // Aplicar flags post-cálculo
  if (flags.justificarPernocta) {
    applyJustificarPernocta(result, precios.noche);
  }

  if (flags.excludeAlojamiento) {
    applyExcludeAlojamiento(result);
  }

  if (flags.excludeManutencion) {
    applyExcludeManutencionToIRPF(result);
  }

  return result;
}

// Exponer la API del motor
window.calculoDesp = window.calculoDesp || {};
window.calculoDesp.calculateDesplazamiento = calculateDesplazamiento;

// Exponer utilidades del motor para testing
window.calculoDesp._parseDate = parseDate;
window.calculoDesp._parseTime = parseTime;
window.calculoDesp._parseNumber = parseNumber;
window.calculoDesp._daysBetween = daysBetween;

// =============================================================================
// Sección 2: WRAPPER / ORQUESTADOR
// =============================================================================
// Conecta: DOM → cogeDatosDesp → Motor → salidaDesp

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 2.1 Helpers del Wrapper
  // ---------------------------------------------------------------------------

  /**
   * Formatea fecha Date a string dd/mm/aaaa.
   */
  function formatDateStr(d) {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  /**
   * Formatea hora {hh, mm} a string hh:mm.
   */
  function formatTimeStr(t) {
    if (!t) return '';
    return `${String(t.hh).padStart(2, '0')}:${String(t.mm).padStart(2, '0')}`;
  }

  /**
   * Obtiene la tarifa de km según el tipo de vehículo seleccionado.
   */
  function getKmTarifa() {
    const veh = document.querySelector('input[name="vehiculo-tipo"]:checked');
    const tipoVeh = veh?.value || 'coche';
    const datos = window.__sgtriDatos;
    return datos?.kmTarifas?.[tipoVeh] || 0.26;
  }

  /**
   * Determina la normativa a aplicar según el tipo de proyecto.
   */
  function getWrapperNormativa(tipoProyecto) {
    const datos = window.__sgtriDatos;
    const rdList = datos?.normativasPorTipoProyecto?.rd || [];
    return rdList.includes(tipoProyecto) ? 'rd' : 'decreto';
  }

  // ---------------------------------------------------------------------------
  // 2.2 Construcción de segmentos internacionales
  // ---------------------------------------------------------------------------

  /**
   * Crea un input de segmento para el motor de cálculo.
   * Incluye flags especiales para el cálculo de noches en viajes internacionales.
   */
  function createSegmentInput(opts) {
    const { fechaIda, horaIda, fechaRegreso, horaRegreso, pais, paisIndex, ticketCena, tipoProyecto, kmTarifa, excludeManutencion, excludeAlojamiento, isLastIntlSegment, forceAllNights, comesFromPreviousDay, forceZeroNights, lastNightAmbiguousByHour, lastNightJustified, justificarPernocta } = opts;

    return {
      fechaIda: formatDateStr(fechaIda),
      horaIda,
      fechaRegreso: formatDateStr(fechaRegreso),
      horaRegreso,
      cruceIda: '',
      cruceVuelta: '',
      pais,
      paisIndex,
      km: 0,
      alojamiento: 0,
      ticketCena,
      tipoProyecto,
      kmTarifa,
      excludeManutencion,
      justificarPernocta: !!justificarPernocta,  // Pasar el valor real
      excludeAlojamiento,
      _segmentMode: true,
      _isLastIntlSegment: !!isLastIntlSegment,       // Último tramo internacional (manutención)
      _forceAllNights: !!forceAllNights,             // Forzar todas las noches (tramos no-finales)
      _comesFromPreviousDay: !!comesFromPreviousDay, // Viene del día anterior (último tramo intl mismo día)
      _forceZeroNights: !!forceZeroNights,           // Forzar 0 noches (noche ambigua en tramo anterior)
      _lastNightAmbiguousByHour: lastNightAmbiguousByHour || null,  // Hora para ambigüedad de última noche
      _lastNightJustified: !!lastNightJustified      // Si la última noche está justificada
    };
  }

  /**
   * Construye los inputs para calcular segmentos de un viaje internacional.
   * 
   * ┌─────────────────────────────────────────────────────────────────────────┐
   * │ ESTRUCTURA DE TRAMOS Y ASIGNACIÓN DE NOCHES                            │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │                                                                         │
   * │ Tramo 1: España (ida)                                                   │
   * │   - Existe si: fechaSalida < fechaCruceIda                              │
   * │   - Periodo: (fechaSalida, horaSalida) → (cruceIda, 00:00)              │
   * │   - Noches: forceAllNights=true (todas cuentan)                         │
   * │                                                                         │
   * │ Tramo 2: País extranjero                                                │
   * │   - Periodo: (cruceIda, horaInicio) → (cruceVuelta, 00:00)              │
   * │   - horaInicio: Si hay tramo España ida → 00:00; sino → hora usuario    │
   * │   - Noches: Depende de si cruceVuelta == fechaRegreso                   │
   * │                                                                         │
   * │ Tramo 3: España (vuelta)                                                │
   * │   - Periodo: (cruceVuelta, 00:00) → (fechaRegreso, horaRegreso)         │
   * │   - Manutención: isLastIntlSegment=true (basta 14:00 para media)        │
   * │   - Noches: Depende de si cruceVuelta == fechaRegreso                   │
   * │                                                                         │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │ ASIGNACIÓN DE LA NOCHE AMBIGUA                                          │
   * ├─────────────────────────────────────────────────────────────────────────┤
   * │                                                                         │
   * │ CASO A: cruceVuelta == fechaRegreso (regreso mismo día)                 │
   * │   - La última noche pertenece al TRAMO EXTRANJERO                       │
   * │   - Tramo extranjero: forceAllNights + lastNightAmbiguousByHour         │
   * │   - Tramo España vuelta: forceZeroNights (0 noches)                     │
   * │                                                                         │
   * │ CASO B: cruceVuelta < fechaRegreso (regreso posterior)                  │
   * │   - La última noche pertenece al TRAMO ESPAÑA VUELTA                    │
   * │   - Tramo extranjero: forceAllNights (todas las noches)                 │
   * │   - Tramo España vuelta: comesFromPreviousDay + justificarPernocta      │
   * │                                                                         │
   * └─────────────────────────────────────────────────────────────────────────┘
   */
  function buildSegmentInputs(data, baseInput) {
    const segments = [];
    const normativa = getWrapperNormativa(data.tipoProyecto);
    const nonFinalAssumeCena = (normativa === 'decreto');

    const baseOpts = {
      tipoProyecto: data.tipoProyecto,
      kmTarifa: baseInput.kmTarifa,
      excludeManutencion: baseInput.excludeManutencion,
      excludeAlojamiento: baseInput.excludeAlojamiento
    };

    // Comprobar si fecha de salida es anterior a fecha de cruce ida (días distintos)
    const salidaAntesDeCruceIda = data.fechaIda && data.cruceIda &&
      data.fechaIda.getTime() < data.cruceIda.getTime();

    // Determinar caso clave: ¿regresa el mismo día que cruza la frontera de vuelta?
    const regresoMismoDiaQueCruceVuelta = data.cruceVuelta && data.fechaRegreso &&
      isSameDay(data.cruceVuelta, data.fechaRegreso);

    // ─────────────────────────────────────────────────────────────────────────
    // TRAMO 1: España (ida) - Solo si sale antes del día de cruce
    // ─────────────────────────────────────────────────────────────────────────
    if (salidaAntesDeCruceIda) {
      segments.push({
        input: createSegmentInput({
          ...baseOpts,
          fechaIda: data.fechaIda,
          horaIda: formatTimeStr(data.horaIda),
          fechaRegreso: data.cruceIda,
          horaRegreso: '00:00',
          pais: 'España',
          paisIndex: 0,
          ticketCena: nonFinalAssumeCena,
          forceAllNights: true
        }),
        titulo: 'España (ida)',
        pais: 'España'
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRAMO 2: País extranjero (cruceIda → cruceVuelta)
    // ─────────────────────────────────────────────────────────────────────────
    if (data.cruceIda && data.cruceVuelta) {
      const horaInicioIntl = salidaAntesDeCruceIda
        ? '00:00'
        : formatTimeStr(data.horaIda);
      
      if (regresoMismoDiaQueCruceVuelta) {
        // CASO A: La noche ambigua pertenece a ESTE tramo
        segments.push({
          input: createSegmentInput({
            ...baseOpts,
            fechaIda: data.cruceIda,
            horaIda: horaInicioIntl,
            fechaRegreso: data.cruceVuelta,
            horaRegreso: '00:00',
            pais: data.pais,
            paisIndex: data.paisIndex,
            ticketCena: nonFinalAssumeCena,
            forceAllNights: true,
            lastNightAmbiguousByHour: formatTimeStr(data.horaRegreso),
            lastNightJustified: !!data.justificarPernocta
          }),
          titulo: data.pais || 'Extranjero',
          pais: data.pais
        });
      } else {
        // CASO B: Todas las noches cuentan (sin ambigüedad aquí)
        segments.push({
          input: createSegmentInput({
            ...baseOpts,
            fechaIda: data.cruceIda,
            horaIda: horaInicioIntl,
            fechaRegreso: data.cruceVuelta,
            horaRegreso: '00:00',
            pais: data.pais,
            paisIndex: data.paisIndex,
            ticketCena: nonFinalAssumeCena,
            forceAllNights: true
          }),
          titulo: data.pais || 'Extranjero',
          pais: data.pais
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRAMO 3: España (vuelta) - Desde cruceVuelta hasta regreso
    // ─────────────────────────────────────────────────────────────────────────
    if (data.cruceVuelta && data.fechaRegreso) {
      if (regresoMismoDiaQueCruceVuelta) {
        // CASO A: 0 noches aquí (la noche ambigua está en el tramo extranjero)
        segments.push({
          input: createSegmentInput({
            ...baseOpts,
            fechaIda: data.cruceVuelta,
            horaIda: '00:00',
            fechaRegreso: data.fechaRegreso,
            horaRegreso: formatTimeStr(data.horaRegreso),
            pais: 'España',
            paisIndex: 0,
            ticketCena: !!data.ticketCena,
            isLastIntlSegment: true,
            forceZeroNights: true
          }),
          titulo: 'España (vuelta)',
          pais: 'España'
        });
      } else {
        // CASO B: La noche ambigua pertenece a ESTE tramo
        segments.push({
          input: createSegmentInput({
            ...baseOpts,
            fechaIda: data.cruceVuelta,
            horaIda: '00:00',
            fechaRegreso: data.fechaRegreso,
            horaRegreso: formatTimeStr(data.horaRegreso),
            pais: 'España',
            paisIndex: 0,
            ticketCena: !!data.ticketCena,
            isLastIntlSegment: true,
            comesFromPreviousDay: true,
            justificarPernocta: !!data.justificarPernocta
          }),
          titulo: 'España (vuelta)',
          pais: 'España'
        });
      }
    }

    return segments;
  }

  /**
   * Calcula los resultados de cada segmento.
   */
  function calculateSegments(segmentDefs) {
    const results = segmentDefs
      .map(seg => {
        const result = calculateDesplazamiento(seg.input);
        if (result) {
          result.segTitle = seg.titulo;
          result.segPais = seg.pais;
        }
        return result;
      })
      .filter(Boolean);

    // Filtrar segmentos vacíos pero mantener el último
    return results.filter((r, idx, arr) => {
      const hasContent = r.noches > 0 || r.manutenciones > 0 || r.km > 0 || r.nochesAmbiguous;
      const isLast = idx === arr.length - 1;
      return hasContent || isLast;
    });
  }

  // ---------------------------------------------------------------------------
  // 2.3 Construcción de estructura unificada para salidaDesp
  // ---------------------------------------------------------------------------

  /**
   * Suma totales desde segmentos o canonical.
   */
  function sumTotals(canonical, segmentos) {
    const esInternacional = segmentos && segmentos.length > 0;

    if (!esInternacional) {
      return {
        manutencion: Number(canonical.manutencionesAmount) || 0,
        alojamientoMax: Number(canonical.nochesAmount) || 0,
        noches: Number(canonical.noches) || 0,
        irpfSujeto: canonical.irpf?.sujeto || 0,
        hayNochesAmbiguas: !!canonical.nochesAmbiguous,
        nochesAmbiguasRango: canonical.nochesAmbiguousFrom && canonical.nochesAmbiguousTo
          ? { desde: canonical.nochesAmbiguousFrom, hasta: canonical.nochesAmbiguousTo }
          : null
      };
    }

    // Para internacionales, sumar de todos los segmentos
    let manutencion = 0, alojamientoMax = 0, noches = 0, irpfSujeto = 0;
    let hayNochesAmbiguas = false, nochesAmbiguasRango = null;

    for (const seg of segmentos) {
      manutencion += Number(seg.manutencionesAmount) || 0;
      alojamientoMax += Number(seg.nochesAmount) || 0;
      noches += Number(seg.noches) || 0;
      irpfSujeto += seg.irpf?.sujeto || 0;

      if (seg.nochesAmbiguous) {
        hayNochesAmbiguas = true;
        if (seg.nochesAmbiguousFrom && seg.nochesAmbiguousTo) {
          nochesAmbiguasRango = { desde: seg.nochesAmbiguousFrom, hasta: seg.nochesAmbiguousTo };
        }
      }
    }

    return { manutencion, alojamientoMax, noches, irpfSujeto, hayNochesAmbiguas, nochesAmbiguasRango };
  }

  /**
   * Construye la estructura de datos unificada para salidaDesp.
   */
  function buildSalidaData(data, canonical, segmentos) {
    const esInternacional = segmentos && segmentos.length > 0;
    const totals = sumTotals(canonical, segmentos);

    const alojamientoUser = Number(data.alojamiento) || 0;
    const kmAmount = Number(canonical.kmAmount) || 0;
    const otrosGastosTotal = Number(data.otrosGastosTotal) || 0;
    const total = round2(totals.manutencion + alojamientoUser + kmAmount + otrosGastosTotal);

    return {
      id: data.id,

      // Totales precalculados
      totales: {
        manutencion: round2(totals.manutencion),
        alojamientoMax: round2(totals.alojamientoMax),
        alojamientoUser: round2(alojamientoUser),
        km: round2(kmAmount),
        otrosGastos: round2(otrosGastosTotal),
        total,
        irpfSujeto: round2(totals.irpfSujeto),
        noches: totals.noches
      },

      // Detalles para desglose (solo nacional)
      detalles: esInternacional ? null : {
        manutenciones: canonical.manutenciones || 0,
        precioManutencion: canonical.precioManutencion || 0,
        noches: canonical.noches || 0,
        precioNoche: canonical.precioNoche || 0,
        km: Number(data.km) || 0,
        precioKm: canonical.precioKm || 0.26
      },

      // Segmentos (solo internacional)
      segmentos: esInternacional ? segmentos.map(seg => ({
        titulo: seg.segTitle || 'Tramo',
        pais: seg.segPais || '',
        manutenciones: seg.manutenciones || 0,
        manutencionAmount: round2(seg.manutencionesAmount || 0),
        precioManutencion: seg.precioManutencion || 0,
        noches: seg.noches || 0,
        nochesAmount: round2(seg.nochesAmount || 0),
        precioNoche: seg.precioNoche || 0,
        nochesAmbiguous: !!seg.nochesAmbiguous
      })) : null,

      // Flags de UI
      ui: {
        esInternacional,
        alojamientoExcedeMax: alojamientoUser > totals.alojamientoMax,
        nochesAmbiguas: totals.hayNochesAmbiguas,
        nochesAmbiguasRango: totals.nochesAmbiguasRango,
        precioNocheMedio: totals.noches > 0 ? round2(totals.alojamientoMax / totals.noches) : 0
      },

      // Estado de exclusiones
      exclusiones: {
        manutencion: !!data.noManutencion,
        alojamiento: !!data.dtInvalid
      },

      // Datos crudos para compatibilidad
      _canonical: canonical,
      _data: data
    };
  }

  // ---------------------------------------------------------------------------
  // 2.4 Función principal del wrapper
  // ---------------------------------------------------------------------------

  /**
   * Calcula los importes de un desplazamiento a partir de su ficha DOM.
   */
  function calculaDesplazamientoFicha(despEl) {
    // 1. Recolectar datos normalizados del DOM
    const collectFn = window.cogeDatosDesp?.collectDataFromFicha;
    if (!collectFn) {
      console.warn('[calculoDesp] cogeDatosDesp.collectDataFromFicha no disponible');
      return null;
    }

    const data = collectFn(despEl);
    if (!data) return null;

    // 2. Construir input para el motor
    const kmTarifa = getKmTarifa();
    const calcInput = {
      fechaIda: data.raw.fechaIda,
      horaIda: data.raw.horaIda,
      fechaRegreso: data.raw.fechaRegreso,
      horaRegreso: data.raw.horaRegreso,
      cruceIda: data.raw.cruceIda,
      cruceVuelta: data.raw.cruceVuelta,
      pais: data.pais,
      paisIndex: data.paisIndex,
      km: data.km,
      alojamiento: data.alojamiento,
      ticketCena: data.ticketCena,
      tipoProyecto: data.tipoProyecto,
      kmTarifa,
      excludeManutencion: data.noManutencion,
      justificarPernocta: data.justificarPernocta,
      excludeAlojamiento: data.dtInvalid
    };

    // 3. Ejecutar motor de cálculo
    let canonical = calculateDesplazamiento(calcInput);
    if (!canonical) {
      canonical = {
        manutenciones: 0,
        manutencionesAmount: 0,
        noches: 0,
        nochesAmount: 0,
        km: data.km,
        kmAmount: round2(data.km * kmTarifa),
        irpf: { sujeto: 0, breakdown: [], limitesUsed: [26.67, 53.34] }
      };
    }

    // 4. Verificar fechas inválidas
    const fechasInvalidas = data.dtInvalid || !data.esValido ||
      despEl?.querySelector?.('.field-error') !== null;

    if (fechasInvalidas) {
      canonical.manutenciones = 0;
      canonical.manutencionesAmount = 0;
      canonical.precioManutencion = 0;
      canonical.alojamiento = 0;
      canonical.alojamientoMaxAmount = 0;
      canonical.noches = 0;
      canonical.nochesAmount = 0;
      canonical.irpf && (canonical.irpf.sujeto = 0);
      despEl?.dataset && (despEl.dataset.dtInvalid = '1');
    }

    // 5. Calcular segmentos si es internacional
    let segmentos = null;
    if (data.esInternacional && data.cruceIda && data.cruceVuelta && !fechasInvalidas) {
      const segmentDefs = buildSegmentInputs(data, calcInput);
      segmentos = calculateSegments(segmentDefs);

      if (fechasInvalidas && segmentos) {
        segmentos.forEach(seg => {
          seg.manutenciones = 0;
          seg.manutencionesAmount = 0;
          seg.noches = 0;
          seg.nochesAmount = 0;
          seg.irpf && (seg.irpf.sujeto = 0);
        });
      }
    }

    // 6. Construir estructura unificada
    const salidaData = buildSalidaData(data, canonical, segmentos);

    // 7. Renderizar salida
    window.salidaDesp?.renderSalida?.(despEl, salidaData);

    // 8. Devolver resultado
    return {
      salidaData,
      canonical,
      data,
      displayContext: {
        otrosSum: data.otrosGastosTotal,
        kmNum: data.km,
        alojNum: data.alojamiento,
        excludeManutencion: data.noManutencion,
        justificarPernocta: data.justificarPernocta,
        excludeAlojamiento: data.dtInvalid,
        id: data.id
      },
      calcInput
    };
  }

  // ---------------------------------------------------------------------------
  // 2.5 Exportación API del Wrapper
  // ---------------------------------------------------------------------------

  window.calculoDesp = window.calculoDesp || {};
  window.calculoDesp.calculaDesplazamientoFicha = calculaDesplazamientoFicha;

  // Reexportar utilidades para compatibilidad
  window.calculoDesp.collectDataFromFicha = function(...args) {
    return window.cogeDatosDesp?.collectDataFromFicha?.(...args) || null;
  };

  window.calculoDesp.parseNumber = function(v) {
    return window.cogeDatosDesp?.parseNumber?.(v) ||
           window.limpiaDatos?.parseNumber?.(v) ||
           parseNumber(v);
  };

  window.calculoDesp.parseNumericLoose = window.calculoDesp.parseNumber;

  // Exponer helpers para testing
  window.calculoDesp._buildSalidaData = buildSalidaData;
  window.calculoDesp._buildSegmentInputs = buildSegmentInputs;
})();
