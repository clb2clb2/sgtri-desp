// js/cogeDatosDesp.js
// Recolecta y normaliza datos del DOM para el cálculo de desplazamientos.
// Delega el parseo a limpiaDatos.js y utils.js.

(function (global) {
  'use strict';

  // =========================================================================
  // ACCESO A MÓDULOS DE UTILIDADES
  // =========================================================================

  // utils.js y limpiaDatos.js se cargan antes que este módulo (ver index.html)
  const parseNumber = () => global.utils.parseNumber;
  const parseDateStrict = () => global.limpiaDatos.parseDateStrict;
  const parseTimeStrict = () => global.limpiaDatos.parseTimeStrict;

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
    return global.utils.esPaisInternacional(pais);
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

      if (!global.utils.ordenCrucesValido(datos.fechaIda, datos.cruceIda, datos.cruceVuelta, datos.fechaRegreso)) {
        errores.push('Los cruces de frontera deben cumplir: ida <= cruce de ida <= cruce de vuelta <= regreso');
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

  global.cogeDatosDesp = {
    collectDataFromFicha,
    parseNumber: v => parseNumber()(v),
    esInternacional,
    validarFechas
  };
})(typeof window !== 'undefined' ? window : this);
