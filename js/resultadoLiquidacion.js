/**
 * resultadoLiquidacion.js
 * =======================
 * Módulo para renderizar la sección "Resultado de la liquidación".
 * Consolida todos los importes de los desplazamientos, descuentos y ajustes.
 *
 * Usa un registro centralizado (window.__sgtriTotales) que es actualizado por
 * cada módulo cuando recalcula sus valores, evitando lecturas del DOM.
 *
 * @module resultadoLiquidacion
 */
(function (global) {
  'use strict';

  // =========================================================================
  // REGISTRO CENTRALIZADO DE TOTALES
  // =========================================================================

  /**
   * Inicializa o obtiene el registro global de totales.
   * Estructura:
   * {
   *   desplazamientos: {
   *     '1': {
   *       manutencion, alojamiento, km, otrosGastos, irpfSujeto,
   *       detalles: {
   *         numManutenciones, precioManutencion, importeManutencion,
   *         numNoches, importeMaxAlojamiento, importeAlojamientoUsuario, excedeMaxAlojamiento,
   *         precioPorKm, importeKm
   *       }
   *     },
   *     '2': { ... }
   *   },
   *   honorarios: number,
   *   gastosInscripcion: number,
   *   descuentoCongreso: number,
   *   financiacionMaxima: number,
   *   descuentosAjustes: [{ tipo, motivo, importe }, ...]
   * }
   */
  function getRegistro() {
    if (!global.__sgtriTotales) {
      global.__sgtriTotales = {
        desplazamientos: {},
        honorarios: 0,
        gastosInscripcion: 0,
        descuentoCongreso: 0,
        financiacionMaxima: 0,
        descuentosAjustes: []
      };
    }
    return global.__sgtriTotales;
  }

  /**
   * Registra los totales de un desplazamiento.
   * @param {string|number} id - ID del desplazamiento
   * @param {Object} totales - Objeto con { manutencion, alojamiento, km, otrosGastos, irpfSujeto }
   * @param {Object} [detalles] - Detalles adicionales para serialización
   */
  function registrarDesplazamiento(id, totales, detalles) {
    const reg = getRegistro();
    reg.desplazamientos[String(id)] = {
      manutencion: round2(totales.manutencion || 0),
      alojamiento: round2(totales.alojamientoUser || totales.alojamiento || 0),
      km: round2(totales.km || 0),
      otrosGastos: round2(totales.otrosGastos || 0),
      irpfSujeto: round2(totales.irpfSujeto || 0),
      // Detalles adicionales para serialización
      detalles: detalles || null
    };
  }

  /**
   * Elimina un desplazamiento del registro.
   * @param {string|number} id - ID del desplazamiento
   */
  function eliminarDesplazamiento(id) {
    const reg = getRegistro();
    delete reg.desplazamientos[String(id)];
  }

  /**
   * Registra el importe de honorarios.
   * @param {number} importe
   */
  function registrarHonorarios(importe) {
    getRegistro().honorarios = round2(importe || 0);
  }

  /**
   * Registra los gastos de inscripción.
   * @param {number} importe
   */
  function registrarGastosInscripcion(importe) {
    getRegistro().gastosInscripcion = round2(importe || 0);
  }

  /**
   * Registra el descuento por comidas de congreso.
   * @param {number} importe
   */
  function registrarDescuentoCongreso(importe) {
    getRegistro().descuentoCongreso = round2(importe || 0);
  }

  /**
   * Registra la financiación máxima.
   * @param {number} importe
   */
  function registrarFinanciacionMaxima(importe) {
    getRegistro().financiacionMaxima = round2(importe || 0);
  }

  /**
   * Registra los descuentos de ajustes.
   * @param {Array} descuentos - Array de { tipo, motivo, importe }
   */
  function registrarDescuentosAjustes(descuentos) {
    getRegistro().descuentosAjustes = (descuentos || []).map(d => ({
      tipo: d.tipo,
      tipoLabel: d.tipoLabel || d.tipo,
      motivo: d.motivo || '',
      importe: round2(d.importe || 0)
    }));
  }

  // =========================================================================
  // UTILIDADES (delegadas a utils.js)
  // =========================================================================

  /**
   * Formatea número a string con 2 decimales y separador de miles alemán.
   * Delega a utils.fmt si está disponible.
   */
  function fmt(n) {
    if (global.utils && typeof global.utils.fmt === 'function') {
      return global.utils.fmt(n);
    }
    return (Number(n) || 0).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Parsea número con tolerancia a formatos europeos.
   * Delega a utils.parseNumber si está disponible.
   */
  function parseNumber(value) {
    if (global.utils && typeof global.utils.parseNumber === 'function') {
      return global.utils.parseNumber(value);
    }
    // Fallback
    if (typeof value === 'number') return value;
    if (!value) return 0;
    let s = String(value).replace(/[^0-9,.\-]/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      s = s.replace(/,/g, '');
    } else if (lastComma !== -1) {
      s = s.replace(',', '.');
    }
    return parseFloat(s) || 0;
  }

  /**
   * Redondea a 2 decimales.
   * Delega a utils.round2 si está disponible.
   */
  function round2(n) {
    if (global.utils && typeof global.utils.round2 === 'function') {
      return global.utils.round2(n);
    }
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /**
   * Debounce para evitar múltiples renders seguidos.
   * Delega a utils.debounce si está disponible.
   */
  function debounce(fn, delay) {
    if (global.utils && typeof global.utils.debounce === 'function') {
      return global.utils.debounce(fn, delay);
    }
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // =========================================================================
  // RECOLECCIÓN DE DATOS (desde el registro centralizado)
  // =========================================================================

  /**
   * Suma los totales de todos los desplazamientos desde el registro.
   * @returns {Object} { manutencion, alojamiento, kilometraje, otrosGastos, irpfSujeto }
   */
  function sumarTotalesDesplazamientos() {
    const reg = getRegistro();
    let totalManutencion = 0;
    let totalAlojamiento = 0;
    let totalKilometraje = 0;
    let totalOtrosGastos = 0;
    let totalIrpf = 0;

    Object.values(reg.desplazamientos).forEach(desp => {
      totalManutencion += desp.manutencion || 0;
      totalAlojamiento += desp.alojamiento || 0;
      totalKilometraje += desp.km || 0;
      totalOtrosGastos += desp.otrosGastos || 0;
      totalIrpf += desp.irpfSujeto || 0;
    });

    return {
      manutencion: round2(totalManutencion),
      alojamiento: round2(totalAlojamiento),
      kilometraje: round2(totalKilometraje),
      otrosGastos: round2(totalOtrosGastos),
      irpfSujeto: round2(totalIrpf)
    };
  }

  /**
   * Obtiene el descuento por comidas de congreso desde el registro.
   * @returns {number}
   */
  function getDescuentoCongreso() {
    return getRegistro().descuentoCongreso || 0;
  }

  /**
   * Obtiene los descuentos de ajustes desde el registro.
   * @returns {Array<{tipo: string, tipoLabel: string, motivo: string, importe: number}>}
   */
  function getDescuentosAjustes() {
    return getRegistro().descuentosAjustes || [];
  }

  /**
   * Obtiene la financiación máxima desde el registro.
   * @returns {number}
   */
  function getFinanciacionMaxima() {
    return getRegistro().financiacionMaxima || 0;
  }

  /**
   * Obtiene el importe de honorarios desde el registro.
   * @returns {number}
   */
  function getHonorarios() {
    return getRegistro().honorarios || 0;
  }

  /**
   * Obtiene los gastos de inscripción desde el registro.
   * @returns {number}
   */
  function getGastosInscripcion() {
    return getRegistro().gastosInscripcion || 0;
  }

  // =========================================================================
  // FUNCIONES DE ACTUALIZACIÓN (leen del DOM y actualizan el registro)
  // =========================================================================

  /**
   * Lee y actualiza honorarios desde el DOM.
   */
  function actualizarHonorarios() {
    const input = document.getElementById('honorarios-importe');
    registrarHonorarios(input ? parseNumber(input.value) : 0);
  }

  /**
   * Lee y actualiza gastos de inscripción desde el DOM.
   */
  function actualizarGastosInscripcion() {
    const input = document.getElementById('evento-gastos');
    registrarGastosInscripcion(input ? parseNumber(input.value) : 0);
  }

  /**
   * Lee y actualiza descuento de congreso desde el DOM.
   */
  function actualizarDescuentoCongreso() {
    const hidden = document.getElementById('descuento-manut-congreso');
    registrarDescuentoCongreso(hidden ? parseNumber(hidden.value) : 0);
  }

  /**
   * Lee y actualiza financiación máxima desde el DOM.
   */
  function actualizarFinanciacionMaxima() {
    const input = document.getElementById('financiacion-maxima');
    registrarFinanciacionMaxima(input ? parseNumber(input.value) : 0);
  }

  /**
   * Lee y actualiza los descuentos de ajustes desde el DOM.
   */
  function actualizarDescuentosAjustes() {
    const descuentos = [];
    const lineas = document.querySelectorAll('#otros-descuentos-container .descuento-line');

    lineas.forEach(linea => {
      const selectTipo = linea.querySelector('.descuento-tipo');
      const inputMotivo = linea.querySelector('.descuento-motivo');
      const inputImporte = linea.querySelector('.descuento-importe');

      if (selectTipo && inputImporte) {
        const importe = parseNumber(inputImporte.value);
        if (importe > 0) {
          descuentos.push({
            tipo: selectTipo.value,
            tipoLabel: selectTipo.options[selectTipo.selectedIndex]?.text || selectTipo.value,
            motivo: inputMotivo?.value || '',
            importe: round2(importe)
          });
        }
      }
    });

    registrarDescuentosAjustes(descuentos);
  }

  // =========================================================================
  // CÁLCULO DEL RESULTADO
  // =========================================================================

  /**
   * Agrupa los descuentos por tipo y suma los importes.
   * @param {Array} descuentos - Array de descuentos de ajustes
   * @returns {Object} { TOT: number, MNT: number, ALJ: number, KLM: number, OTR: number }
   */
  function agruparDescuentosPorTipo(descuentos) {
    const agrupados = { TOT: 0, MNT: 0, ALJ: 0, KLM: 0, OTR: 0 };
    
    descuentos.forEach(d => {
      if (agrupados.hasOwnProperty(d.tipo)) {
        agrupados[d.tipo] += d.importe;
      }
    });

    return agrupados;
  }

  /**
   * Calcula el resultado final de la liquidación.
   * @returns {Object} Datos completos para renderizar
   */
  function calcularResultado() {
    const totales = sumarTotalesDesplazamientos();
    const descuentoCongreso = getDescuentoCongreso();
    const descuentosAjustes = getDescuentosAjustes();
    const descuentosAgrupados = agruparDescuentosPorTipo(descuentosAjustes);
    const financiacionMaxima = getFinanciacionMaxima();
    const honorarios = getHonorarios();
    const gastosInscripcion = getGastosInscripcion();

    // Obtener datos del desplazamiento especial (si existe)
    const datosEspecial = global.uiDesplazamientoEspecial?.getDatosParaLiquidacion?.() || null;
    const totalEspecial = datosEspecial?.total || 0;
    const irpfEspecial = datosEspecial?.irpf || 0;

    // Descuentos por tipo específico (SIN el TOT que se aplica al final)
    const descuentosManutencion = descuentoCongreso + descuentosAgrupados.MNT;
    const descuentosAlojamiento = descuentosAgrupados.ALJ;
    const descuentosKilometraje = descuentosAgrupados.KLM;
    const descuentosOtrosGastos = descuentosAgrupados.OTR;

    // Calcular neto por tipo (mínimo 0)
    const netoManutencion = Math.max(0, totales.manutencion - descuentosManutencion);
    const netoAlojamiento = Math.max(0, totales.alojamiento - descuentosAlojamiento);
    const netoKilometraje = Math.max(0, totales.kilometraje - descuentosKilometraje);
    const netoOtrosGastos = Math.max(0, totales.otrosGastos - descuentosOtrosGastos);

    // Total de la liquidación (incluye gastos inscripción, honorarios y desplazamiento especial)
    // El descuento de tipo TOT se aplica al total final, incluyendo honorarios
    // El desplazamiento especial NO se ve afectado por descuentos específicos (MNT, ALJ, KLM, OTR)
    let totalAntesFinanciacion = round2(
      netoManutencion + netoAlojamiento + netoKilometraje + netoOtrosGastos +
      gastosInscripcion + honorarios + totalEspecial - descuentosAgrupados.TOT
    );
    totalAntesFinanciacion = Math.max(0, totalAntesFinanciacion);

    // Calcular descuento por financiación máxima
    let descuentoFinanciacionMaxima = 0;
    let totalLiquidacion = totalAntesFinanciacion;
    if (financiacionMaxima > 0 && totalAntesFinanciacion > financiacionMaxima) {
      descuentoFinanciacionMaxima = totalAntesFinanciacion - financiacionMaxima;
      totalLiquidacion = financiacionMaxima;
    }

    // === CÁLCULO DEL IRPF ===
    // Descuentos que afectan SOLO al IRPF de desplazamientos (manutención):
    // - Descuento por comidas de congreso
    // - Descuentos de manutención del usuario (tipo MNT)
    const descuentosManut = descuentoCongreso + descuentosAgrupados.MNT;
    
    // Descuentos que afectan al IRPF TOTAL (desplazamientos + honorarios + especial):
    // - Descuentos del total (tipo TOT)
    // - Descuento por financiación máxima
    const descuentosTotales = descuentosAgrupados.TOT + descuentoFinanciacionMaxima;
    
    // IRPF de desplazamientos normales (restando descuentos de manutención)
    const irpfDesplazamientos = Math.max(0, totales.irpfSujeto - descuentosManut);
    
    // IRPF total antes de descuentos TOT (desplazamientos + honorarios + especial)
    // El IRPF del especial NO se ve afectado por descuentos específicos
    const irpfAntesDescTot = irpfDesplazamientos + honorarios + irpfEspecial;
    
    // IRPF final (restando descuentos TOT y financiación máxima)
    const irpfTotal = round2(Math.max(0, irpfAntesDescTot - descuentosTotales));

    return {
      totales,
      descuentoCongreso,
      descuentosAjustes,
      descuentosAgrupados,
      financiacionMaxima,
      descuentoFinanciacionMaxima,
      honorarios,
      gastosInscripcion,
      datosEspecial,
      netos: {
        manutencion: netoManutencion,
        alojamiento: netoAlojamiento,
        kilometraje: netoKilometraje,
        otrosGastos: netoOtrosGastos
      },
      totalLiquidacion: round2(totalLiquidacion),
      irpfTotal
    };
  }

  // =========================================================================
  // TEMPLATES
  // =========================================================================

  /**
   * Genera línea con leader.
   */
  function lineaConLeader(label, amount) {
    return `<div class="resultado-line">
      <span class="resultado-label">${label}</span>
      <span class="resultado-leader" aria-hidden="true"></span>
      <span class="resultado-amount">${fmt(amount)} €</span>
    </div>`;
  }

  /**
   * Genera línea de descuento con motivo en cursiva.
   */
  function lineaDescuento(tipoLabel, motivo, amount) {
    const motivoStr = motivo ? ` <em>[ ${motivo} ]</em>` : '';
    return `<div class="resultado-line">
      <span class="resultado-label">Descuento ${tipoLabel.toLowerCase()}${motivoStr}</span>
      <span class="resultado-leader" aria-hidden="true"></span>
      <span class="resultado-amount">−${fmt(amount)} €</span>
    </div>`;
  }

  /**
   * Genera espaciador.
   */
  function espaciador() {
    return '<div class="resultado-spacer"></div>';
  }

  /**
   * Genera línea de total final.
   */
  function lineaTotal(amount) {
    return `<div class="resultado-total">
      <span class="resultado-label">Resultado de la liquidación:</span>
      <span class="resultado-amount">${fmt(amount)} €</span>
    </div>`;
  }

  /**
   * Genera línea de IRPF.
   */
  function lineaIrpf(amount) {
    if (amount <= 0) return '';
    return `<div class="resultado-irpf">
      <span class="resultado-label">Sujeto a retención por IRPF:</span>
      <span class="resultado-amount">${fmt(amount)} €</span>
    </div>`;
  }

  // =========================================================================
  // RENDERIZADO
  // =========================================================================

  /**
   * Renderiza la sección de resultado de la liquidación.
   */
  function renderResultado() {
    const container = document.getElementById('resultado-liquidacion-container');
    if (!container) return;

    const datos = calcularResultado();
    const lines = [];

    // --- Líneas del desplazamiento especial (al principio, sin total) ---
    if (datos.datosEspecial && datos.datosEspecial.lineasHtml.length > 0) {
      lines.push(...datos.datosEspecial.lineasHtml);
      lines.push(espaciador());
    }

    // --- Totales de desplazamientos (solo si > 0) ---
    if (datos.totales.manutencion > 0) {
      lines.push(lineaConLeader('Total manutención', datos.totales.manutencion));
    }
    if (datos.totales.alojamiento > 0) {
      lines.push(lineaConLeader('Total alojamiento', datos.totales.alojamiento));
    }
    if (datos.totales.kilometraje > 0) {
      lines.push(lineaConLeader('Total kilometraje', datos.totales.kilometraje));
    }
    if (datos.totales.otrosGastos > 0) {
      lines.push(lineaConLeader('Total otros gastos', datos.totales.otrosGastos));
    }

    // --- Espaciador antes de gastos inscripción/honorarios ---
    const hayTotalesDesp = datos.totales.manutencion > 0 || datos.totales.alojamiento > 0 ||
                           datos.totales.kilometraje > 0 || datos.totales.otrosGastos > 0;
    const hayGastosExtra = datos.gastosInscripcion > 0 || datos.honorarios > 0;
    if (hayTotalesDesp && hayGastosExtra) {
      lines.push(espaciador());
    }

    // --- Gastos de inscripción (antes de honorarios, sin IRPF) ---
    if (datos.gastosInscripcion > 0) {
      lines.push(lineaConLeader('Gastos de inscripción', datos.gastosInscripcion));
    }

    // --- Honorarios (si > 0) ---
    if (datos.honorarios > 0) {
      lines.push(lineaConLeader('Honorarios', datos.honorarios));
    }

    // --- Descuentos ---
    const hayDescuentos = datos.descuentoCongreso > 0 || datos.descuentosAjustes.length > 0;
    
    if (hayDescuentos && lines.length > 0) {
      lines.push(espaciador());
    }

    // Descuento de congreso
    if (datos.descuentoCongreso > 0) {
      lines.push(lineaDescuento('manutención', 'Comidas incluidas en congreso', datos.descuentoCongreso));
    }

    // Descuentos de ajustes
    datos.descuentosAjustes.forEach(d => {
      const tipoNombre = getTipoNombre(d.tipo);
      lines.push(lineaDescuento(tipoNombre, d.motivo, d.importe));
    });

    // --- Financiación máxima (si > 0) ---
    if (datos.financiacionMaxima > 0) {
      if (hayDescuentos || lines.length > 0) {
        lines.push(espaciador());
      }
      lines.push(lineaConLeader('Financiación máxima concedida', datos.financiacionMaxima));
    }

    // --- Verificar si hay contenido ---
    const hayContenido = datos.totales.manutencion > 0 ||
                         datos.totales.alojamiento > 0 ||
                         datos.totales.kilometraje > 0 ||
                         datos.totales.otrosGastos > 0 ||
                         datos.gastosInscripcion > 0 ||
                         datos.honorarios > 0 ||
                         (datos.datosEspecial && datos.datosEspecial.total > 0);

    if (!hayContenido) {
      container.innerHTML = '<div class="resultado-empty">Complete los datos del formulario para ver el resultado.</div>';
      return;
    }

    // --- Total y IRPF ---
    lines.push(lineaTotal(datos.totalLiquidacion));
    lines.push(lineaIrpf(datos.irpfTotal));

    container.innerHTML = lines.join('\n');

    // Actualizar sección de imputación
    if (global.uiImputacion && typeof global.uiImputacion.actualizar === 'function') {
      global.uiImputacion.actualizar();
    }
  }

  /**
   * Obtiene el nombre del tipo de descuento.
   */
  function getTipoNombre(tipo) {
    const nombres = {
      TOT: 'total',
      MNT: 'manutención',
      ALJ: 'alojamiento',
      KLM: 'kilometraje',
      OTR: 'otros gastos'
    };
    return nombres[tipo] || tipo;
  }

  // =========================================================================
  // INICIALIZACIÓN Y EVENT LISTENERS
  // =========================================================================

  /**
   * Handler que actualiza el registro y re-renderiza.
   */
  function onHonorariosChange() {
    actualizarHonorarios();
    renderResultado();
  }

  function onGastosInscripcionChange() {
    actualizarGastosInscripcion();
    renderResultado();
  }

  function onFinanciacionMaximaChange() {
    actualizarFinanciacionMaxima();
    renderResultado();
  }

  function onDescuentosAjustesChange() {
    actualizarDescuentosAjustes();
    renderResultado();
  }

  function onDescuentoCongresoChange() {
    actualizarDescuentoCongreso();
    renderResultado();
  }

  /**
   * Inicializa los event listeners para actualizar el resultado.
   */
  function init() {
    // Listener para financiación máxima
    const finMax = document.getElementById('financiacion-maxima');
    if (finMax) {
      finMax.addEventListener('change', onFinanciacionMaximaChange);
      finMax.addEventListener('blur', onFinanciacionMaximaChange);
    }

    // Listener para honorarios
    const honorarios = document.getElementById('honorarios-importe');
    if (honorarios) {
      honorarios.addEventListener('change', onHonorariosChange);
      honorarios.addEventListener('blur', onHonorariosChange);
    }

    // Listener para descuento de congreso (campo hidden, cambios programáticos)
    const descCongreso = document.getElementById('descuento-manut-congreso');
    if (descCongreso) {
      // Usar MutationObserver para detectar cambios en value
      const observer = new MutationObserver(onDescuentoCongresoChange);
      observer.observe(descCongreso, { attributes: true, attributeFilter: ['value'] });
      // También escuchar evento change por si acaso
      descCongreso.addEventListener('change', onDescuentoCongresoChange);
    }

    // Listener para contenedor de descuentos (delegación de eventos)
    const descContainer = document.getElementById('otros-descuentos-container');
    if (descContainer) {
      descContainer.addEventListener('change', onDescuentosAjustesChange);
      descContainer.addEventListener('input', debounce(onDescuentosAjustesChange, 300));
    }

    // Listener para gastos de inscripción
    const gastosInscripcion = document.getElementById('evento-gastos');
    if (gastosInscripcion) {
      gastosInscripcion.addEventListener('change', onGastosInscripcionChange);
      gastosInscripcion.addEventListener('blur', onGastosInscripcionChange);
    }

    // Inicializar registro con valores actuales del DOM
    actualizarHonorarios();
    actualizarGastosInscripcion();
    actualizarFinanciacionMaxima();
    actualizarDescuentoCongreso();
    actualizarDescuentosAjustes();

    // Render inicial
    renderResultado();
  }

  /**
   * Resetea el registro centralizado de totales a su estado inicial.
   * Pensado para ser llamado desde limpiarFormularioCompleto().
   */
  function resetTotales() {
    global.__sgtriTotales = {
      desplazamientos: {},
      honorarios: 0,
      gastosInscripcion: 0,
      descuentoCongreso: 0,
      financiacionMaxima: 0,
      descuentosAjustes: []
    };
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const resultadoLiquidacion = {
    // Inicialización
    init,
    
    // Registro de totales (para usar desde otros módulos)
    registrarDesplazamiento,
    eliminarDesplazamiento,
    registrarHonorarios,
    registrarGastosInscripcion,
    registrarDescuentoCongreso,
    registrarFinanciacionMaxima,
    registrarDescuentosAjustes,
    
    // Actualización desde DOM (para usar tras restaurar datos)
    actualizarHonorarios,
    actualizarGastosInscripcion,
    actualizarDescuentoCongreso,
    actualizarDescuentosAjustes,
    actualizarFinanciacionMaxima,
    
    // Renderizado
    renderResultado,
    calcularResultado,
    
    // Reset
    resetTotales,
    
    // Utilidades
    fmt,
    parseNumber
  };

  global.resultadoLiquidacion = resultadoLiquidacion;

})(typeof window !== 'undefined' ? window : this);
