// js/salidaDesp.js
// Renderizador de resultados de cálculo de desplazamientos.
//
// Arquitectura:
//   - Templates: funciones puras que generan fragmentos HTML
//   - Render: funciones puras que componen el HTML completo
//   - Mount: funciones que interactúan con el DOM (insertar, eventos)

(function () {
  'use strict';

  // =========================================================================
  // UTILIDADES DE FORMATEO
  // =========================================================================

  /**
   * Formatea número a string con 2 decimales y separador de miles alemán.
   */
  function fmt(n) {
    return (Number(n) || 0).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // =========================================================================
  // TEMPLATES (funciones puras → HTML string)
  // =========================================================================

  const templates = {
    /**
     * Línea de concepto con líder de puntos.
     */
    lineaConcepto(label, amount, amountClass = '') {
      const cls = amountClass ? ` ${amountClass}` : '';
      return `<div class="calc-line">
        <span class="label">${label}</span>
        <span class="leader" aria-hidden="true"></span>
        <span class="amount${cls}">${fmt(amount)} €</span>
      </div>`;
    },

    /**
     * Línea de manutención con posible factor de residencia eventual.
     * Formato: "Manutención: 64 × 53,34 € × 80% ................ 2.731,01 €"
     */
    lineaManutencion({ manutenciones, precioManutencion, amount, residenciaEventual = false }) {
      const factorStr = residenciaEventual ? ' × 80%' : '';
      const label = `Manutención: ${manutenciones} × ${fmt(precioManutencion)} €${factorStr}`;
      return `<div class="calc-line">
        <span class="label">${label}</span>
        <span class="leader" aria-hidden="true"></span>
        <span class="amount manut">${fmt(amount)} €</span>
      </div>`;
    },

    /**
     * Línea de kilometraje: km × precio = total
     */
    lineaKilometraje(km, precioKm, totalKm) {
      return `<div class="calc-line">
        <span class="label">Km: ${km} × ${fmt(precioKm)} €</span>
        <span class="leader" aria-hidden="true"></span>
        <span class="amount km">${fmt(totalKm)} €</span>
      </div>`;
    },

    /**
     * Línea de alojamiento nacional con máximo (noches × precio × factor) y posible warning.
     * Formato: "Alojamiento: [ Máximo: 63 × 102,56 × 80% = 5.169,02 € ] ................ 1250,00 €"
     */
    lineaAlojamiento({ noches, precioNoche, maxAmount, userAmount, excedeMax, residenciaEventual = false }) {
      const errorCls = excedeMax ? ' error-line' : '';
      const amountErrorCls = excedeMax ? ' error-amount' : '';
      const warning = excedeMax
        ? templates.warning('¡Atención! El importe del alojamiento supera el máximo permitido.')
        : '';
      const factorStr = residenciaEventual ? ' × 80%' : '';

      return `<div class="calc-line aloj-line${errorCls}">
        <span class="label">Alojamiento: <em>[ Máximo: ${noches} × ${fmt(precioNoche)}${factorStr} = ${fmt(maxAmount)} € ]</em></span>
        <span class="leader" aria-hidden="true"></span>
        <span class="aloj-user">${warning}<span class="amount aloj-user${amountErrorCls}">${fmt(userAmount)} €</span></span>
      </div>`;
    },

    /**
     * Línea de alojamiento internacional (totales): solo muestra máximo sumado con factor.
     * Formato: "Alojamiento: [ Máximo: 7.308,00 € × 80% = 5.846,40 € ] ................ 1250,00 €"
     */
    lineaAlojamientoInternacional({ maxAmount, maxAmountBase, userAmount, excedeMax, residenciaEventual = false }) {
      const errorCls = excedeMax ? ' error-line' : '';
      const amountErrorCls = excedeMax ? ' error-amount' : '';
      const warning = excedeMax
        ? templates.warning('¡Atención! El importe del alojamiento supera el máximo permitido.')
        : '';
      
      // Si hay residencia eventual, mostrar: "Máximo: BASE × 80% = FINAL"
      const maxLabel = residenciaEventual
        ? `Máximo: ${fmt(maxAmountBase)} € × 80% = ${fmt(maxAmount)} €`
        : `Máximo: ${fmt(maxAmount)} €`;

      return `<div class="calc-line aloj-line${errorCls}">
        <span class="label">Alojamiento: <em>[ ${maxLabel} ]</em></span>
        <span class="leader" aria-hidden="true"></span>
        <span class="aloj-user">${warning}<span class="amount aloj-user${amountErrorCls}">${fmt(userAmount)} €</span></span>
      </div>`;
    },

    /**
     * Icono de warning con tooltip.
     */
    warning(mensaje) {
      return `<span class="warn-wrapper" tabindex="0" aria-live="polite">
        <span class="warn-icon" aria-hidden="true">⚠️</span>
        <span class="warn-tooltip" role="tooltip">${mensaje}</span>
      </span>`;
    },

    /**
     * Línea de total final.
     */
    total(amount) {
      return `<div class="calc-total">
        <span class="label">Total:</span>
        <span class="amount"><strong class="slight total-val">${fmt(amount)} €</strong></span>
      </div>`;
    },

    /**
     * Título de sección/segmento.
     */
    tituloSeccion(titulo) {
      return `<div class="calc-seg-title">${titulo}</div>`;
    },

    /**
     * Segmento de viaje internacional.
     * Muestra manutención y alojamiento máximo con desglose.
     * El flag residenciaEventual se usa para mostrar "× 80%" en el cálculo.
     */
    segmento(seg, residenciaEventual = false) {
      const factorStr = residenciaEventual ? ' × 80%' : '';
      return `<div class="calc-result-segment">
        ${templates.tituloSeccion(seg.titulo)}
        <div class="calc-line">
          <span class="label">Manutención: ${seg.manutenciones} × ${fmt(seg.precioManutencion)} €</span>
          <span class="leader" aria-hidden="true"></span>
          <span class="amount manut">${fmt(seg.manutencionAmount)} €</span>
        </div>
        <div class="calc-line aloj-line">
          <span class="label">Alojamiento: <em>[ Máximo: ${seg.noches} × ${fmt(seg.precioNoche)}${factorStr} = ${fmt(seg.nochesAmount)} € ]</em></span>
        </div>
      </div>`;
    },

    /**
     * Checkbox para justificar pernocta en zona ambigua.
     */
    justificarPernocta(id, desde, hasta) {
      return `<div class="ticket-cena-field conditional-row justificar-pernocta-field" id="justificar-container-${id}">
        <div class="form-group">
          <label>
            <input type="checkbox" id="justificar-pernocta-${id}" />
            Justifica haber pernoctado la noche del ${desde} al ${hasta}.
          </label>
        </div>
      </div>`;
    }
  };

  // =========================================================================
  // FUNCIONES DE RENDER (puras → HTML string completo)
  // =========================================================================

  /**
   * Genera HTML para desplazamiento nacional (sin segmentos).
   * Solo muestra líneas con importe > 0.
   */
  function renderSimple(data) {
    const { totales, detalles, ui } = data;
    const lines = [];
    const residenciaEventual = ui?.residenciaEventual || false;

    // Manutención (solo si > 0)
    if (totales.manutencion > 0) {
      lines.push(templates.lineaManutencion({
        manutenciones: detalles.manutenciones,
        precioManutencion: detalles.precioManutencion,
        amount: totales.manutencion,
        residenciaEventual
      }));
    }

    // Alojamiento (solo si usuario introdujo algo > 0)
    if (totales.alojamientoUser > 0) {
      lines.push(templates.lineaAlojamiento({
        noches: totales.noches,
        precioNoche: ui.precioNocheMedio,
        maxAmount: totales.alojamientoMax,
        userAmount: totales.alojamientoUser,
        excedeMax: ui.alojamientoExcedeMax,
        residenciaEventual
      }));
    }

    // Kilometraje (solo si > 0)
    if (totales.km > 0) {
      lines.push(templates.lineaKilometraje(detalles.km, detalles.precioKm, totales.km));
    }

    // Otros gastos (solo si > 0)
    if (totales.otrosGastos > 0) {
      lines.push(templates.lineaConcepto('Total otros gastos', totales.otrosGastos, 'otros-gastos-total'));
    }

    // Si no hay líneas, no mostrar nada
    if (lines.length === 0) return '';

    // Badge de Residencia Eventual si aplica
    const badgeResEvent = residenciaEventual 
      ? `<div class="calc-titulo-ResEvent">[ Residencia Eventual ]</div>\n      ` 
      : '';

    return `<div class="calc-result" aria-live="polite" data-desp-id="${data.id}">
      ${badgeResEvent}${lines.join('\n      ')}
      ${templates.total(totales.total)}
    </div>`;
  }

  /**
   * Genera HTML para desplazamiento internacional (con segmentos).
   * Solo muestra segmentos y totales si las fechas están validadas.
   * Solo muestra líneas de totales con importe > 0.
   */
  function renderSegmentado(data) {
    const { totales, segmentos, ui, exclusiones } = data;
    const residenciaEventual = ui?.residenciaEventual || false;

    // Verificar si hay datos válidos de segmentos (fechas validadas)
    const segmentosValidos = segmentos && segmentos.length > 0 &&
      segmentos.some(seg => seg.manutenciones > 0 || seg.noches > 0);

    // Generar HTML de segmentos solo si hay datos válidos
    // Pasar residenciaEventual a cada segmento para mostrar "× 80%" en el desglose
    let segmentosHtml = '';
    if (segmentosValidos) {
      segmentosHtml = segmentos.map(seg => templates.segmento(seg, residenciaEventual)).join('');
    }

    // Líneas de totales (solo las que tienen importe > 0)
    const totalLines = [];

    // Manutención total (solo si > 0 y segmentos válidos)
    if (totales.manutencion > 0 && segmentosValidos) {
      totalLines.push(templates.lineaConcepto('Total manutención', totales.manutencion, 'manut'));
    }

    // Alojamiento (solo si usuario introdujo algo > 0 y segmentos válidos)
    // En TOTALES solo mostramos el máximo sumado, sin desglose
    if (totales.alojamientoUser > 0 && segmentosValidos) {
      totalLines.push(templates.lineaAlojamientoInternacional({
        maxAmount: totales.alojamientoMax,
        maxAmountBase: totales.alojamientoMaxBase,
        userAmount: totales.alojamientoUser,
        excedeMax: ui.alojamientoExcedeMax,
        residenciaEventual: false  // En TOTALES no mostramos "× 80%" porque ya está aplicado en cada tramo
      }));
    }

    // Kilometraje (solo si > 0) - siempre se muestra si hay km, incluso sin fechas válidas
    if (totales.km > 0 && data.detalles) {
      totalLines.push(templates.lineaKilometraje(data.detalles.km, data.detalles.precioKm, totales.km));
    } else if (totales.km > 0) {
      // Fallback si no hay detalles (usar datos de _data si existen)
      const kmNum = data._data?.km || 0;
      const precioKm = data._canonical?.precioKm || 0.26;
      totalLines.push(templates.lineaKilometraje(kmNum, precioKm, totales.km));
    }

    // Otros gastos (solo si > 0) - siempre se muestra si hay otros gastos
    if (totales.otrosGastos > 0) {
      totalLines.push(templates.lineaConcepto('Total otros gastos', totales.otrosGastos, 'otros-gastos-total'));
    }

    // Si no hay nada que mostrar, devolver vacío
    if (!segmentosHtml && totalLines.length === 0) return '';

    // Construir HTML
    let html = `<div class="calc-result composite" data-desp-id="${data.id}">`;

    // Mostrar título de Residencia Eventual si aplica
    if (residenciaEventual) {
      html += '<div class="calc-titulo-ResEvent">[ Residencia Eventual ]</div>';
    }

    if (segmentosHtml) {
      html += segmentosHtml;
      html += templates.tituloSeccion('TOTALES:');
    }

    html += totalLines.join('\n      ');
    html += templates.total(totales.total);
    html += '</div>';

    return html;
  }

  /**
   * Genera el HTML completo para el resultado del cálculo.
   */
  function renderSalidaHtml(salidaData) {
    if (!salidaData) return '';

    const { totales, ui, segmentos } = salidaData;

    // Verificar si hay algo que mostrar
    const hayContenido = totales.manutencion > 0 ||
                         totales.alojamientoUser > 0 ||
                         totales.km > 0 ||
                         totales.otrosGastos > 0;

    if (!hayContenido) return '';

    // Elegir render según tipo
    return (ui.esInternacional && segmentos?.length > 0)
      ? renderSegmentado(salidaData)
      : renderSimple(salidaData);
  }

  // =========================================================================
  // FUNCIONES DE MONTAJE DOM
  // =========================================================================

  /**
   * Monta el HTML en el elemento DOM.
   */
  function mountSalida(despEl, html, salidaData) {
    if (!despEl) return;

    const existing = despEl.querySelector('.calc-result');

    if (!html) {
      existing?.remove();
      return;
    }

    if (existing) {
      existing.outerHTML = html;
    } else {
      despEl.insertAdjacentHTML('beforeend', html);
    }

    setupJustificarPernocta(despEl, salidaData);
  }

  /**
   * Configura el checkbox de justificar pernocta.
   */
  function setupJustificarPernocta(despEl, salidaData) {
    if (!salidaData?.ui) return;

    const { id, ui } = salidaData;
    const existingField = despEl.querySelector('.justificar-pernocta-field');

    // Sin noches ambiguas → eliminar campo si existe
    if (!ui.nochesAmbiguas || !ui.nochesAmbiguasRango) {
      existingField?.remove();
      return;
    }

    const { desde, hasta } = ui.nochesAmbiguasRango;

    // Crear campo si no existe
    if (!existingField) {
      const justHtml = templates.justificarPernocta(id, desde, hasta);
      const ticketField = despEl.querySelector(`#ticket-cena-field-${id}`);

      if (ticketField) {
        ticketField.insertAdjacentHTML('afterend', justHtml);
      } else {
        despEl.insertAdjacentHTML('beforeend', justHtml);
      }
    }

    // Configurar evento del checkbox
    const chk = despEl.querySelector(`#justificar-pernocta-${id}`);
    if (!chk) return;

    // Sincronizar estado
    if (despEl.dataset?.justificarPernocta === '1') {
      chk.checked = true;
    }

    // Handler de cambio
    if (chk._justHandler) {
      chk.removeEventListener('change', chk._justHandler);
    }

    chk._justHandler = () => {
      if (chk.checked) {
        despEl.dataset.justificarPernocta = '1';
      } else {
        delete despEl.dataset.justificarPernocta;
      }

      // Recalcular
      window.calculoDesp?.calculaDesplazamientoFicha?.(despEl);
    };

    chk.addEventListener('change', chk._justHandler);
  }

  // =========================================================================
  // CONVERSIÓN LEGACY
  // =========================================================================

  /**
   * Suma totales desde segmentos o canonical.
   */
  function sumLegacyTotals(canonical) {
    const segResults = canonical.segmentsResults;
    const esInternacional = Array.isArray(segResults) && segResults.length > 0;

    if (!esInternacional) {
      return {
        manutencion: Number(canonical.manutencionesAmount) || 0,
        alojamientoMax: Number(canonical.nochesAmount) || 0,
        noches: Number(canonical.noches) || 0,
        hayNochesAmbiguas: !!canonical.nochesAmbiguous,
        nochesAmbiguasRango: canonical.nochesAmbiguousFrom && canonical.nochesAmbiguousTo
          ? { desde: canonical.nochesAmbiguousFrom, hasta: canonical.nochesAmbiguousTo }
          : null
      };
    }

    let manutencion = 0, alojamientoMax = 0, noches = 0;
    let hayNochesAmbiguas = false, nochesAmbiguasRango = null;

    for (const seg of segResults) {
      manutencion += Number(seg.manutencionesAmount) || 0;
      alojamientoMax += Number(seg.nochesAmount) || 0;
      noches += Number(seg.noches) || 0;

      if (seg.nochesAmbiguous) {
        hayNochesAmbiguas = true;
        if (seg.nochesAmbiguousFrom && seg.nochesAmbiguousTo) {
          nochesAmbiguasRango = { desde: seg.nochesAmbiguousFrom, hasta: seg.nochesAmbiguousTo };
        }
      }
    }

    return { manutencion, alojamientoMax, noches, hayNochesAmbiguas, nochesAmbiguasRango };
  }

  /**
   * Convierte formato legacy a estructura unificada.
   */
  function convertLegacyToUnified(canonical, ctx, despEl) {
    const id = ctx?.id || despEl?.dataset?.desplazamientoId || '';
    const segResults = canonical.segmentsResults;
    const esInternacional = Array.isArray(segResults) && segResults.length > 0;

    const totals = sumLegacyTotals(canonical);
    const alojamientoUser = (typeof ctx?.alojNum !== 'undefined')
      ? Number(ctx.alojNum)
      : Number(canonical.alojamiento || 0);
    const kmAmount = Number(canonical.kmAmount) || 0;
    const otrosGastos = Number(ctx?.otrosSum) || 0;

    return {
      id,
      totales: {
        manutencion: totals.manutencion,
        alojamientoMax: totals.alojamientoMax,
        alojamientoUser,
        km: kmAmount,
        otrosGastos,
        total: totals.manutencion + alojamientoUser + kmAmount + otrosGastos,
        noches: totals.noches
      },
      detalles: esInternacional ? null : {
        manutenciones: canonical.manutenciones || 0,
        precioManutencion: canonical.precioManutencion || 0,
        noches: canonical.noches || 0,
        precioNoche: canonical.precioNoche || 0,
        km: Number(canonical.km) || 0,
        precioKm: canonical.precioKm || 0.26
      },
      segmentos: esInternacional ? segResults.map(seg => ({
        titulo: seg.segTitle || 'Tramo',
        pais: seg.segPais || '',
        manutenciones: seg.manutenciones || 0,
        manutencionAmount: Number(seg.manutencionesAmount) || 0,
        precioManutencion: seg.precioManutencion || 0,
        noches: seg.noches || 0,
        nochesAmount: Number(seg.nochesAmount) || 0,
        precioNoche: seg.precioNoche || 0,
        nochesAmbiguous: !!seg.nochesAmbiguous
      })) : null,
      ui: {
        esInternacional,
        alojamientoExcedeMax: alojamientoUser > totals.alojamientoMax,
        nochesAmbiguas: totals.hayNochesAmbiguas,
        nochesAmbiguasRango: totals.nochesAmbiguasRango,
        precioNocheMedio: totals.noches > 0
          ? totals.alojamientoMax / totals.noches
          : (canonical.precioNoche || 0)
      },
      exclusiones: {
        manutencion: !!(ctx?.excludeManutencion),
        alojamiento: !!(ctx?.excludeAlojamiento)
      }
    };
  }

  // =========================================================================
  // API PÚBLICA
  // =========================================================================

  /**
   * Renderiza el resultado de un cálculo de desplazamiento.
   * Acepta nueva estructura unificada o formato legacy.
   */
  function renderSalida(despEl, salidaData, legacyCtx) {
    // Detectar formato legacy
    if (salidaData && !salidaData.totales && legacyCtx) {
      salidaData = convertLegacyToUnified(salidaData, legacyCtx, despEl);
    }

    // Normalizar id
    if (!salidaData.id && despEl?.dataset?.desplazamientoId) {
      salidaData.id = despEl.dataset.desplazamientoId;
    }

    const html = renderSalidaHtml(salidaData);
    mountSalida(despEl, html, salidaData);
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  window.salidaDesp = {
    renderSalida,
    renderSalidaHtml,
    mountSalida,
    templates,
    fmt,
    convertLegacyToUnified
  };

})();
