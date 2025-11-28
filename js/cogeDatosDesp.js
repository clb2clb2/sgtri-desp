// js/cogeDatosDesp.js
// Recolecta y normaliza datos del DOM para el cálculo de desplazamientos.
// Delega el parseo a limpiaDatos.js.

(function(){
  'use strict';

  // =========================================================================
  // ACCESO A MÓDULO LIMPIA DATOS
  // =========================================================================

  /**
   * Obtiene una función de limpiaDatos con fallback si no está cargado.
   * @param {string} fnName - Nombre de la función
   * @param {Function} fallback - Función fallback
   * @returns {Function}
   */
  function getLimpiaDatosFn(fnName, fallback) {
    const ld = window.limpiaDatos;
    return (ld && typeof ld[fnName] === 'function') ? ld[fnName] : fallback;
  }

  // Fallbacks mínimos
  const fallbacks = {
    parseNumber: v => {
      if (!v && v !== 0) return 0;
      const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '').replace(/,/g, '.'));
      return isNaN(n) ? 0 : n;
    },
    parseDateStrict: ddmmaa => {
      if (!ddmmaa) return null;
      const parts = String(ddmmaa).split('/').map(p => p.trim());
      if (parts.length < 3) return null;
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y < 100) y = 2000 + y;
      const date = new Date(y, m, d, 0, 0, 0, 0);
      return isNaN(date.getTime()) ? null : date;
    },
    parseTimeStrict: hhmm => {
      if (!hhmm) return null;
      const m = String(hhmm).trim().match(/^(\d{1,2}):(\d{1,2})$/);
      if (!m) return null;
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return { hh, mm };
    }
  };

  // Parsers con fallback
  const parseNumber = () => getLimpiaDatosFn('parseNumber', fallbacks.parseNumber);
  const parseDateStrict = () => getLimpiaDatosFn('parseDateStrict', fallbacks.parseDateStrict);
  const parseTimeStrict = () => getLimpiaDatosFn('parseTimeStrict', fallbacks.parseTimeStrict);

  // =========================================================================
  // HELPERS DE DOM
  // =========================================================================

  /** Extrae el valor de un elemento de forma segura. */
  const safeValue = el => el?.value || '';

  /** Extrae el estado checked de un checkbox. */
  const safeChecked = el => !!(el?.checked);

  /** Obtiene el selectedIndex de un select. */
  const safeSelectedIndex = el => el?.selectedIndex ?? -1;

  // =========================================================================
  // LÓGICA DE NEGOCIO
  // =========================================================================

  /**
   * Determina si un viaje es internacional.
   */
  function esInternacional(paisIndex, pais) {
    if (typeof paisIndex === 'number' && paisIndex >= 0) {
      return paisIndex > 0; // índice 0 = España
    }
    const paisLower = (pais || '').toLowerCase().trim();
    return paisLower !== '' && paisLower !== 'españa';
  }

  /**
   * Combina fecha y hora en un DateTime.
   */
  function toDateTime(fecha, hora) {
    if (!fecha) return null;
    const dt = new Date(fecha.getTime());
    if (hora) {
      dt.setHours(hora.hh, hora.mm, 0, 0);
    }
    return dt;
  }

  /**
   * Valida la coherencia de las fechas del desplazamiento.
   */
  function validarFechas(datos) {
    const errores = [];

    // Fechas y horas obligatorias
    if (!datos.fechaIda) errores.push('Fecha de ida no válida');
    if (!datos.fechaRegreso) errores.push('Fecha de regreso no válida');
    if (!datos.horaIda) errores.push('Hora de ida no válida');
    if (!datos.horaRegreso) errores.push('Hora de regreso no válida');

    // Orden lógico ida <= regreso
    if (datos.dtIda && datos.dtRegreso && datos.dtIda > datos.dtRegreso) {
      errores.push('La fecha/hora de regreso debe ser posterior a la de ida');
    }

    // Validaciones de cruces para viajes internacionales
    if (datos.esInternacional) {
      if (!datos.cruceIda) errores.push('Fecha de cruce de ida no válida para viaje internacional');
      if (!datos.cruceVuelta) errores.push('Fecha de cruce de vuelta no válida para viaje internacional');

      if (datos.cruceIda && datos.fechaIda && datos.cruceIda < datos.fechaIda) {
        errores.push('El cruce de ida no puede ser anterior a la fecha de ida');
      }
      if (datos.cruceVuelta && datos.fechaRegreso && datos.cruceVuelta > datos.fechaRegreso) {
        errores.push('El cruce de vuelta no puede ser posterior a la fecha de regreso');
      }
      if (datos.cruceIda && datos.cruceVuelta && datos.cruceIda > datos.cruceVuelta) {
        errores.push('El cruce de ida debe ser anterior o igual al cruce de vuelta');
      }
    }

    return { valido: errores.length === 0, errores };
  }

  // =========================================================================
  // EXTRACCIÓN DE DATOS DEL DOM
  // =========================================================================

  /**
   * Extrae los valores raw del DOM de una ficha.
   */
  function extractRawValues(despEl, id) {
    const $ = sel => despEl.querySelector(sel);

    const paisEl = $(`#pais-destino-${id}`);

    return {
      fechaIda: safeValue($(`#fecha-ida-${id}`)),
      horaIda: safeValue($(`#hora-ida-${id}`)),
      fechaRegreso: safeValue($(`#fecha-regreso-${id}`)),
      horaRegreso: safeValue($(`#hora-regreso-${id}`)),
      cruceIda: safeValue($(`#cruce-ida-${id}`)),
      cruceVuelta: safeValue($(`#cruce-vuelta-${id}`)),
      km: safeValue($(`#km-${id}`)),
      alojamiento: safeValue($(`#alojamiento-${id}`)),
      pais: safeValue(paisEl),
      paisIndex: safeSelectedIndex(paisEl),
      ticketCena: safeChecked($(`#ticket-cena-${id}`)),
      noManutencion: safeChecked($(`#no-manutencion-${id}`))
    };
  }

  /**
   * Extrae los otros gastos de una ficha.
   */
  function extractOtrosGastos(despEl) {
    const els = despEl.querySelectorAll('.otros-gasto-importe');
    const valores = Array.from(els).map(el => parseNumber()(el.value));
    return {
      items: valores,
      total: valores.reduce((sum, v) => sum + v, 0)
    };
  }

  /**
   * Extrae los flags del dataset de una ficha.
   */
  function extractDatasetFlags(despEl) {
    const ds = despEl?.dataset || {};
    return {
      justificarPernocta: ds.justificarPernocta === '1',
      dtInvalid: ds.dtInvalid === '1'
    };
  }

  // =========================================================================
  // FUNCIÓN PRINCIPAL
  // =========================================================================

  /**
   * Recolecta y normaliza los datos de una ficha de desplazamiento.
   * @param {Element} despEl - Elemento DOM de la ficha (.desplazamiento-grupo)
   * @returns {Object|null} Datos normalizados o null si el elemento no existe
   */
  function collectDataFromFicha(despEl) {
    if (!despEl) return null;

    const id = despEl.dataset?.desplazamientoId;
    const raw = extractRawValues(despEl, id);
    const otrosGastos = extractOtrosGastos(despEl);
    const datasetFlags = extractDatasetFlags(despEl);

    // Parsear fechas y horas
    const fechaIda = parseDateStrict()(raw.fechaIda);
    const fechaRegreso = parseDateStrict()(raw.fechaRegreso);
    const horaIda = parseTimeStrict()(raw.horaIda);
    const horaRegreso = parseTimeStrict()(raw.horaRegreso);
    const cruceIda = parseDateStrict()(raw.cruceIda);
    const cruceVuelta = parseDateStrict()(raw.cruceVuelta);

    // Combinar fecha + hora
    const dtIda = toDateTime(fechaIda, horaIda);
    const dtRegreso = toDateTime(fechaRegreso, horaRegreso);

    // Parsear numéricos
    const km = parseNumber()(raw.km);
    const alojamiento = parseNumber()(raw.alojamiento);

    // Determinar tipo de viaje
    const internacional = esInternacional(raw.paisIndex, raw.pais);

    // Tipo de proyecto (campo global)
    const tipoProyecto = document.getElementById('tipoProyecto')?.value || '';

    // Construir objeto normalizado
    const data = {
      id,

      // Fechas parseadas
      fechaIda,
      fechaRegreso,
      cruceIda,
      cruceVuelta,

      // Horas parseadas
      horaIda,
      horaRegreso,

      // DateTimes combinados
      dtIda,
      dtRegreso,

      // Valores raw para el motor
      raw: {
        fechaIda: raw.fechaIda,
        horaIda: raw.horaIda,
        fechaRegreso: raw.fechaRegreso,
        horaRegreso: raw.horaRegreso,
        cruceIda: raw.cruceIda,
        cruceVuelta: raw.cruceVuelta,
        km: raw.km,
        alojamiento: raw.alojamiento
      },

      // País
      pais: raw.pais,
      paisIndex: raw.paisIndex,
      esInternacional: internacional,

      // Numéricos parseados
      km,
      alojamiento,
      otrosGastos: otrosGastos.items,
      otrosGastosTotal: otrosGastos.total,

      // Flags
      ticketCena: raw.ticketCena,
      noManutencion: raw.noManutencion,
      justificarPernocta: datasetFlags.justificarPernocta,
      dtInvalid: datasetFlags.dtInvalid,

      // Contexto
      tipoProyecto
    };

    // Validación
    const validacion = validarFechas(data);
    data.esValido = validacion.valido && !data.dtInvalid;
    data.errores = validacion.errores;

    return data;
  }

  // =========================================================================
  // EXPORTACIÓN API
  // =========================================================================

  window.cogeDatosDesp = {
    collectDataFromFicha,
    parseNumber: v => parseNumber()(v),
    parseNumericLoose: v => parseNumber()(v),
    esInternacional,
    validarFechas
  };
})();
