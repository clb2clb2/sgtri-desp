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
   *       diasIrpf: [{ fecha (yyyy-mm-dd), units, precio, bruto, exento, sujeto }, ...],
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
   *   congreso: { despId, desde, hasta, numComidas, comidasDiasRetencion },
   *   financiacionMaxima: number,
   *   importeAnticipado: number,
   *   descuentosAjustes: [{ tipo, motivo, importe }, ...],
   *   manutencionDiasRetencion: number  // parte de los descuentos MNT de días con retención
   * }
   */
  function getRegistro() {
    if (!global.__sgtriTotales) {
      global.__sgtriTotales = registroVacio();
    }
    return global.__sgtriTotales;
  }

  /**
   * Registro de totales en su estado inicial.
   * @returns {Object}
   */
  function registroVacio() {
    return {
      desplazamientos: {},
      honorarios: 0,
      gastosInscripcion: 0,
      descuentoCongreso: 0,
      congreso: congresoVacio(),
      financiacionMaxima: 0,
      importeAnticipado: 0,
      descuentosAjustes: [],
      manutencionDiasRetencion: 0
    };
  }

  /**
   * Datos del congreso que afectan al IRPF, sin congreso.
   * @returns {Object}
   */
  function congresoVacio() {
    return { despId: null, desde: '', hasta: '', numComidas: 0, comidasDiasRetencion: 0 };
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
      diasIrpf: (totales.diasIrpf || []).map(d => ({
        fecha: d.fecha,
        units: Number(d.units) || 0,
        precio: Number(d.precio) || 0,
        bruto: Number(d.bruto) || 0,
        exento: Number(d.exento) || 0,
        sujeto: Number(d.sujeto) || 0
      })),
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
   * Registra los datos del congreso que deciden qué comidas reducen el IRPF.
   * @param {Object} datos
   * @param {string|null} datos.despId - ID del desplazamiento asociado al congreso
   * @param {string} datos.desde - Inicio del congreso (yyyy-mm-dd) o ''
   * @param {string} datos.hasta - Fin del congreso (yyyy-mm-dd) o ''
   * @param {number} datos.numComidas - Comidas incluidas en la inscripción
   * @param {number} datos.comidasDiasRetencion - De ellas, las de días con retención
   */
  function registrarCongreso(datos) {
    const numComidas = Math.max(0, Math.floor(Number(datos?.numComidas) || 0));
    getRegistro().congreso = {
      despId: datos?.despId != null ? String(datos.despId) : null,
      desde: datos?.desde || '',
      hasta: datos?.hasta || '',
      numComidas,
      comidasDiasRetencion: Math.min(numComidas, Math.max(0, Math.floor(Number(datos?.comidasDiasRetencion) || 0)))
    };
  }

  /**
   * Registra la financiación máxima.
   * @param {number} importe
   */
  function registrarFinanciacionMaxima(importe) {
    getRegistro().financiacionMaxima = round2(importe || 0);
  }

  /**
   * Registra el importe anticipado.
   * @param {number} importe
   */
  function registrarImporteAnticipado(importe) {
    getRegistro().importeAnticipado = round2(importe || 0);
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

  /**
   * Registra qué parte de los descuentos de manutención (MNT) corresponde a días con retención.
   * @param {number} importe
   */
  function registrarManutencionDiasRetencion(importe) {
    getRegistro().manutencionDiasRetencion = round2(Math.max(0, importe || 0));
  }

  // =========================================================================
  // UTILIDADES (delegadas a utils.js)
  // =========================================================================

  /**
   * Formatea número a string con 2 decimales y separador de miles alemán.
   * Delega a utils.fmt si está disponible.
   */
  function fmt(n) {
    return global.utils.fmt(n);
  }

  /**
   * Parsea número con tolerancia a formatos europeos.
   * Delega a utils.parseNumber si está disponible.
   */
  function parseNumber(value) {
    return global.utils.parseNumber(value);
  }

  /**
   * Redondea a 2 decimales.
   * Delega a utils.round2 si está disponible.
   */
  function round2(n) {
    return global.utils.round2(n);
  }

  /**
   * Debounce para evitar múltiples renders seguidos.
   * Delega a utils.debounce si está disponible.
   */
  function debounce(fn, delay) {
    return global.utils.debounce(fn, delay);
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
   * Días con importe sujeto a retención del desplazamiento asociado al congreso
   * que caen entre las fechas de celebración del congreso.
   * Solo hay días si el congreso incluye comidas.
   * @returns {Array<{fecha, units, precio, bruto, exento, sujeto}>} Ordenados por fecha
   */
  function getDiasRetencionCongreso() {
    const reg = getRegistro();
    const congreso = reg.congreso || congresoVacio();
    if (congreso.numComidas <= 0 || !congreso.despId || !congreso.desde || !congreso.hasta) return [];

    const desp = reg.desplazamientos[congreso.despId];
    if (!desp || !Array.isArray(desp.diasIrpf)) return [];

    return desp.diasIrpf
      .filter(d => d.sujeto > 0 && d.fecha >= congreso.desde && d.fecha <= congreso.hasta)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  /**
   * Días con importe sujeto a retención de todos los desplazamientos normales.
   * Son los mismos objetos del registro que devuelve getDiasRetencionCongreso().
   * @returns {Array<{fecha, units, precio, bruto, exento, sujeto}>} Ordenados por fecha
   */
  function getDiasRetencion() {
    const dias = [];
    Object.values(getRegistro().desplazamientos).forEach(desp => {
      (desp.diasIrpf || []).forEach(d => {
        if (d.sujeto > 0) dias.push(d);
      });
    });
    return dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  /**
   * Importe sujeto de cada día tras descontar las comidas del congreso que caen en días con retención.
   * Las comidas se reparten de una en una por orden de fecha y, al llegar al último día, se
   * vuelve a empezar por el primero. Cada día admite como mucho las medias manutenciones que tiene.
   * Cada comida descuenta media manutención de su día, y el sujeto de ese día se recalcula.
   * @param {Array} dias - Resultado de getDiasRetencionCongreso()
   * @param {number} comidas - Comidas del congreso que corresponden a esos días
   * @returns {Map<Object, number>} Día del registro → importe sujeto
   */
  function calcularSujetosTrasCongreso(dias, comidas) {
    const capacidad = dias.map(d => Math.round(d.units * 2));
    const comidasDia = dias.map(() => 0);
    let pendientes = comidas;

    while (pendientes > 0 && comidasDia.some((n, i) => n < capacidad[i])) {
      for (let i = 0; i < dias.length && pendientes > 0; i++) {
        if (comidasDia[i] < capacidad[i]) {
          comidasDia[i]++;
          pendientes--;
        }
      }
    }

    const sujetos = new Map();
    dias.forEach((d, i) => {
      const brutoDia = Math.max(0, d.bruto - comidasDia[i] * 0.5 * d.precio);
      sujetos.set(d, round2(Math.max(0, brutoDia - d.exento)));
    });
    return sujetos;
  }

  /**
   * Reducción del importe sujeto por la parte de los descuentos de manutención que el
   * usuario asigna a los días con retención. El importe se divide a partes iguales entre
   * esos días (fechas distintas) y cada parte se resta del sujeto de su día, sin bajar de 0.
   * Se aplica después de las comidas del congreso.
   * @param {Array} dias - Resultado de getDiasRetencion()
   * @param {Map<Object, number>} sujetosCongreso - Resultado de calcularSujetosTrasCongreso()
   * @param {number} importe - Parte de los descuentos MNT de días con retención
   * @returns {number}
   */
  function calcularReduccionIrpfManutencion(dias, sujetosCongreso, importe) {
    const fechas = [...new Set(dias.map(d => d.fecha))];
    if (fechas.length === 0 || importe <= 0) return 0;

    const cuota = importe / fechas.length;
    let reduccion = 0;
    fechas.forEach(fecha => {
      // Una fecha puede estar en dos desplazamientos (regreso de uno y salida del otro)
      let restante = cuota;
      dias.filter(d => d.fecha === fecha).forEach(d => {
        const sujeto = sujetosCongreso.has(d) ? sujetosCongreso.get(d) : d.sujeto;
        const resta = Math.min(restante, sujeto);
        reduccion += resta;
        restante -= resta;
      });
    });
    return round2(reduccion);
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
   * Obtiene el importe anticipado desde el registro.
   * Solo aplica en modo especial (GNRAL).
   * @returns {number}
   */
  function getImporteAnticipado() {
    const tipoActual = global.tipoLiquidacion?.getTipoActual
      ? String(global.tipoLiquidacion.getTipoActual()).toUpperCase()
      : String(global.__sgtriTipoLiquidacion || '').toUpperCase();

    if (tipoActual !== 'GNRAL') return 0;
    return getRegistro().importeAnticipado || 0;
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
   * Lee y actualiza importe anticipado desde el DOM.
   */
  function actualizarImporteAnticipado() {
    const input = document.getElementById('importe-anticipado');
    registrarImporteAnticipado(input ? parseNumber(input.value) : 0);
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

  /**
   * Lee y actualiza desde el DOM la parte de los descuentos de manutención de días con retención.
   */
  function actualizarManutencionDiasRetencion() {
    const input = document.getElementById('descuento-manut-retencion');
    registrarManutencionDiasRetencion(input ? parseNumber(input.value) : 0);
  }

  // =========================================================================
  // CÁLCULO DEL RESULTADO
  // =========================================================================

  /**
   * Agrupa los descuentos por tipo y suma los importes.
   * @param {Array} descuentos - Array de descuentos de ajustes
   * @returns {Object} { MNT, ALJ, KLM, HON, INS, OTR } (number)
   */
  function agruparDescuentosPorTipo(descuentos) {
    const agrupados = { MNT: 0, ALJ: 0, KLM: 0, HON: 0, INS: 0, OTR: 0 };
    
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
    const importeAnticipado = getImporteAnticipado();
    const honorarios = getHonorarios();
    const gastosInscripcion = getGastosInscripcion();

    // Obtener datos del desplazamiento especial (si existe)
    const datosEspecial = global.uiDesplazamientoEspecial?.getDatosParaLiquidacion?.() || null;
    const totalEspecial = datosEspecial?.total || 0;
    const irpfEspecial = datosEspecial?.irpf || 0;

    // Descuentos por tipo
    const descuentosManutencion = descuentoCongreso + descuentosAgrupados.MNT;
    const descuentosAlojamiento = descuentosAgrupados.ALJ;
    const descuentosKilometraje = descuentosAgrupados.KLM;
    const descuentosOtrosGastos = descuentosAgrupados.OTR;

    // Calcular neto por tipo (mínimo 0)
    const netoManutencion = Math.max(0, totales.manutencion - descuentosManutencion);
    const netoAlojamiento = Math.max(0, totales.alojamiento - descuentosAlojamiento);
    const netoKilometraje = Math.max(0, totales.kilometraje - descuentosKilometraje);
    const netoOtrosGastos = Math.max(0, totales.otrosGastos - descuentosOtrosGastos);
    const netoHonorarios = Math.max(0, honorarios - descuentosAgrupados.HON);
    const netoInscripcion = Math.max(0, gastosInscripcion - descuentosAgrupados.INS);

    // Total de la liquidación (incluye gastos inscripción, honorarios y desplazamiento especial)
    // El desplazamiento especial NO se ve afectado por los descuentos de ajustes
    const totalAntesFinanciacion = round2(
      netoManutencion + netoAlojamiento + netoKilometraje + netoOtrosGastos +
      netoInscripcion + netoHonorarios + totalEspecial
    );

    // Calcular descuento por financiación máxima
    let descuentoFinanciacionMaxima = 0;
    let totalLiquidacion = totalAntesFinanciacion;
    if (financiacionMaxima > 0 && totalAntesFinanciacion > financiacionMaxima) {
      descuentoFinanciacionMaxima = totalAntesFinanciacion - financiacionMaxima;
      totalLiquidacion = financiacionMaxima;
    }

    // === CÁLCULO DEL IRPF ===
    // Comidas del congreso: solo reducen el sujeto las que caen en días con retención
    const diasRetencionCongreso = getDiasRetencionCongreso();
    const sujetosCongreso = calcularSujetosTrasCongreso(
      diasRetencionCongreso,
      getRegistro().congreso?.comidasDiasRetencion || 0
    );
    const reduccionIrpfCongreso = round2(diasRetencionCongreso.reduce(
      (suma, d) => suma + d.sujeto - sujetosCongreso.get(d), 0));

    // Descuentos de manutención (MNT): solo reduce el sujeto la parte que el usuario
    // asigna a los días con retención, que no puede superar lo descontado
    const diasRetencionManutencion = descuentosAgrupados.MNT > 0 ? getDiasRetencion() : [];
    const manutencionDiasRetencion = Math.min(
      getRegistro().manutencionDiasRetencion || 0,
      descuentosAgrupados.MNT
    );
    const reduccionIrpfManutencion = calcularReduccionIrpfManutencion(
      diasRetencionManutencion, sujetosCongreso, manutencionDiasRetencion);

    // IRPF de desplazamientos normales
    const irpfDesplazamientos = Math.max(0, totales.irpfSujeto - reduccionIrpfCongreso - reduccionIrpfManutencion);

    // Los honorarios están siempre sujetos: entra su importe neto (tras el descuento HON).
    // El IRPF del especial NO se ve afectado por descuentos específicos
    const irpfAntesFinanciacion = irpfDesplazamientos + netoHonorarios + irpfEspecial;

    // IRPF final (restando la financiación máxima)
    const irpfTotal = round2(Math.max(0, irpfAntesFinanciacion - descuentoFinanciacionMaxima));

    // Importe final a imputar tras descontar, si procede, un anticipo.
    const importeImputar = round2(Math.max(0, totalLiquidacion - importeAnticipado));

    return {
      totales,
      descuentoCongreso,
      descuentosAjustes,
      descuentosAgrupados,
      financiacionMaxima,
      importeAnticipado,
      descuentoFinanciacionMaxima,
      honorarios,
      gastosInscripcion,
      datosEspecial,
      netos: {
        manutencion: netoManutencion,
        alojamiento: netoAlojamiento,
        kilometraje: netoKilometraje,
        otrosGastos: netoOtrosGastos,
        honorarios: netoHonorarios,
        inscripcion: netoInscripcion
      },
      diasRetencionCongreso,
      reduccionIrpfCongreso,
      diasRetencionManutencion,
      reduccionIrpfManutencion,
      totalAntesFinanciacion: round2(totalAntesFinanciacion),
      totalLiquidacion: round2(totalLiquidacion),
      importeImputar,
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
   * Genera línea de importe a imputar.
   */
  function lineaTotalImputar(amount) {
    return `<div class="resultado-total resultado-total-secundario">
      <span class="resultado-label">IMPORTE A IMPUTAR:</span>
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

  /**
   * Genera línea de importe anticipado con estilo de IRPF (alineada a la derecha).
   */
  function lineaImporteAnticipado(amount) {
    if (amount <= 0) return '';
    return `<div class="resultado-irpf">
      <span class="resultado-label">Importe anticipado:</span>
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

    // La pregunta de comidas en días con retención depende del cálculo de los desplazamientos
    global.formLogic?.actualizarPreguntaComidasRetencion?.(datos.diasRetencionCongreso);
    global.uiAjustes?.actualizarPreguntaManutencionRetencion?.(
      datos.diasRetencionManutencion, datos.descuentosAgrupados.MNT);

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
      // La imputación debe reflejar también el total a 0
      if (global.uiImputacion && typeof global.uiImputacion.actualizar === 'function') {
        global.uiImputacion.actualizar();
      }
      return;
    }

    // --- Total ---
    lines.push(lineaTotal(datos.totalLiquidacion));

    // --- Anticipo e importe a imputar (solo si hay anticipo > 0) ---
    if (datos.importeAnticipado > 0) {
      lines.push(lineaImporteAnticipado(datos.importeAnticipado));
      lines.push(lineaTotalImputar(datos.importeImputar));
    }

    // --- IRPF (siempre al final) ---
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
      MNT: 'manutención',
      ALJ: 'alojamiento',
      KLM: 'kilometraje',
      HON: 'honorarios',
      INS: 'inscripción en congreso',
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

  function onImporteAnticipadoChange() {
    actualizarImporteAnticipado();
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

    // Listener para importe anticipado
    const impAnt = document.getElementById('importe-anticipado');
    if (impAnt) {
      impAnt.addEventListener('change', onImporteAnticipadoChange);
      impAnt.addEventListener('blur', onImporteAnticipadoChange);
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
    actualizarImporteAnticipado();
    actualizarDescuentoCongreso();
    actualizarDescuentosAjustes();
    actualizarManutencionDiasRetencion();

    // Render inicial
    renderResultado();
  }

  /**
   * Resetea el registro centralizado de totales a su estado inicial.
   * Pensado para ser llamado desde limpiarFormularioCompleto().
   */
  function resetTotales() {
    global.__sgtriTotales = registroVacio();
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
    registrarCongreso,
    registrarFinanciacionMaxima,
    registrarImporteAnticipado,
    registrarDescuentosAjustes,
    registrarManutencionDiasRetencion,

    // Actualización desde DOM (para usar tras restaurar datos)
    actualizarHonorarios,
    actualizarGastosInscripcion,
    actualizarDescuentoCongreso,
    actualizarDescuentosAjustes,
    actualizarManutencionDiasRetencion,
    actualizarFinanciacionMaxima,
    actualizarImporteAnticipado,
    
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
