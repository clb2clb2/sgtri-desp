// js/salidaDesp.js
// Renderizador: separación entre lógica pura (HTML/DocumentFragment) y montaje DOM
// Provee funciones puras que no leen ni escriben el DOM, y una pequeña capa `mount`.

(function () {
  function fmt(n) {
    return (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Crea una copia 'display' del objeto canonical aplicando overlays según ctx.
  // Esta función es pura: no accede al DOM.
  function buildDisplay(canonical, ctx) {
    if (!canonical) return null;
    const display = JSON.parse(JSON.stringify(canonical));
    const excludeMan = ctx && typeof ctx.excludeManutencion !== 'undefined' ? ctx.excludeManutencion : (ctx && ctx.flags && ctx.flags.excludeManutencion);
    const isDtInvalid = ctx && ctx.dtInvalid === true;
    const justified = ctx && ctx.justificarPernocta === true;

    if (excludeMan) {
      if (Array.isArray(display.segmentsResults)) {
        display.segmentsResults.forEach(s => { if (s) { s.manutencionesAmount = 0; s.manutenciones = 0; if (s.irpf && typeof s.irpf === 'object') s.irpf.sujeto = 0; } });
      } else {
        try { display.manutencionesAmount = 0; display.manutenciones = 0; if (display.irpf && typeof display.irpf === 'object') display.irpf.sujeto = 0; } catch (e) {}
      }
    }

    if (isDtInvalid) {
      if (Array.isArray(display.segmentsResults)) {
        display.segmentsResults.forEach(s => { if (s) { s.manutencionesAmount = 0; s.manutenciones = 0; s.nochesAmount = 0; s.noches = 0; } });
        display.alojamientoUser = 0;
      } else {
        display.manutencionesAmount = 0; display.manutenciones = 0; display.alojamiento = 0; display.nochesAmount = 0; display.noches = 0;
      }
    }

    if (justified) {
      if (Array.isArray(display.segmentsResults) && display.segmentsResults.length > 0) {
        const seg = display.segmentsResults.find(s => s && s.nochesAmbiguous) || display.segmentsResults[display.segmentsResults.length - 1];
        if (seg) {
          const price = (typeof seg.precioNoche !== 'undefined') ? Number(seg.precioNoche || 0) : (typeof display.precioNoche !== 'undefined' ? Number(display.precioNoche || 0) : 0);
          seg.noches = (Number(seg.noches) || 0) + 1;
          seg.nochesAmount = (Number(seg.nochesAmount) || 0) + price;
          if (typeof seg.nochesIfCounted !== 'undefined') seg.nochesIfCounted = (Number(seg.nochesIfCounted) || 0) + 1;
          if (typeof seg.nochesAmountIfCounted !== 'undefined') seg.nochesAmountIfCounted = (Number(seg.nochesAmountIfCounted) || 0) + price;
          if (typeof display.alojamientoMaxAmount !== 'undefined') display.alojamientoMaxAmount = Math.round(((Number(display.alojamientoMaxAmount) || 0) + price + Number.EPSILON) * 100) / 100;
        }
      } else {
        const price = (typeof display.precioNoche !== 'undefined') ? Number(display.precioNoche || 0) : 0;
        display.noches = (Number(display.noches) || 0) + 1;
        display.nochesAmount = (Number(display.nochesAmount) || 0) + price;
        if (typeof display.alojamientoMaxAmount !== 'undefined') display.alojamientoMaxAmount = Math.round(((Number(display.alojamientoMaxAmount) || 0) + price + Number.EPSILON) * 100) / 100;
      }
    }

    return display;
  }

  // Genera el HTML (string) a partir de 'display' y ctx. Pura — no accede al DOM.
  function renderSalidaHtml(canonical, ctx) {
    if (!canonical) return '';
    const display = buildDisplay(canonical, ctx);
    if (!display) return '';
    const otros = (ctx && ctx.otrosSum) ? Number(ctx.otrosSum) : 0;
    const kmAmount = typeof display.kmAmount !== 'undefined' ? Number(display.kmAmount || 0) : 0;
    const manutTotal = (Array.isArray(display.segmentsResults) ? display.segmentsResults.reduce((a,s)=>a+(s && s.manutencionesAmount?Number(s.manutencionesAmount||0):0),0) : Number(display.manutencionesAmount || 0));
    const ctxAlojNum = (ctx && typeof ctx.alojNum !== 'undefined') ? Number(ctx.alojNum || 0) : 0;
    const alojTotal = Array.isArray(display.segmentsResults) ? (ctxAlojNum > 0 ? ctxAlojNum : Number(display.alojamientoUser || 0)) : (ctxAlojNum > 0 ? ctxAlojNum : Number(display.alojamiento || 0));
    const anyPositive = (otros > 0) || (kmAmount > 0) || (manutTotal > 0) || (alojTotal > 0);
    if (!anyPositive) return '';

    const id = (ctx && ctx.id) ? ctx.id : (Math.random().toString(36).slice(2,8));

    let html = '';
    if (Array.isArray(display.segmentsResults) && display.segmentsResults.length > 0) {
      const segHtml = display.segmentsResults.map((r, idx) => {
        const segTitle = r && r.segTitle ? r.segTitle : `Tramo ${idx+1}`;
        const precioManUnitSeg = (r && r.precioManutencion) ? Number(r.precioManutencion) : 0;
        const manutAmountSeg = (r && r.manutencionesAmount) ? Number(r.manutencionesAmount) : 0;
        const alojamientoSegAmt = (r && r.nochesAmount) ? Number(r.nochesAmount) : 0;
        const nochesTxt = (r && typeof r.noches !== 'undefined') ? String(r.noches) : '0';
        return `
          <div class="calc-result-segment">
            <div class="calc-seg-title">${segTitle}</div>
            <div class="calc-line"><span class="label">Manutención: ${ (r && r.manutenciones) ? r.manutenciones : 0 } × ${ (precioManUnitSeg).toLocaleString('de-DE', { minimumFractionDigits: 2 }) } €</span><span class="leader" aria-hidden="true"></span><span class="amount manut">${fmt(manutAmountSeg)} €</span></div>
            <div class="calc-line aloj-line"><span class="label">Alojamiento máx: ${nochesTxt} noches = ${fmt(alojamientoSegAmt)} €</span></div>
          </div>
        `;
      }).join('');

      const totalManutStr = fmt(manutTotal);
      const totalAlojStr = fmt(alojTotal);
      const kmStr = fmt(kmAmount);
      const otrosStr = fmt(otros);
      const totalVal = manutTotal + kmAmount + alojTotal + otros;
      const totalValStr = fmt(totalVal);

      const totalAlojMax = display.segmentsResults.reduce((acc,s)=>acc+((s && typeof s.nochesAmount !== 'undefined')?Number(s.nochesAmount||0):0),0);
      const totalNoches = display.segmentsResults.reduce((acc,s)=>acc+((s && typeof s.noches !== 'undefined')?Number(s.noches||0):0),0);
      const alojamientoWarn = Number(alojTotal) > Number(totalAlojMax);
      const avgPrecioNoche = (totalNoches > 0) ? (totalAlojMax / totalNoches) : 0;

      html = `
        <div class="calc-result composite" data-desp-id="${id}">
          ${segHtml}
          <div class="calc-seg-title">TOTALES:</div>
          <div class="calc-line"><span class="label">Total manutención</span><span class="leader" aria-hidden="true"></span><span class="amount manut">${totalManutStr} €</span></div>
          <div class="calc-line aloj-aggregated${alojamientoWarn? ' error-line':''}"><span class="label">Alojamiento: <em>[ Máximo: ${totalNoches} × ${fmt(avgPrecioNoche)} = ${fmt(totalAlojMax)} € ]</em></span><span class="leader" aria-hidden="true"></span><span class="aloj-user">${alojamientoWarn ? `<span class="warn-wrapper" tabindex="0" aria-live="polite"><span class="warn-icon" aria-hidden="true">⚠️</span><span class="warn-tooltip" role="tooltip">¡Atención! El importe del alojamiento supera el máximo permitido.</span></span>` : ''}<span class="amount aloj-user${alojamientoWarn? ' error-amount':''}">${totalAlojStr} €</span></span></div>
          <div class="calc-line"><span class="label">Km.</span><span class="leader" aria-hidden="true"></span><span class="amount km">${kmStr} €</span></div>
          <div class="calc-line"><span class="label">Total otros gastos</span><span class="leader" aria-hidden="true"></span><span class="amount otros-gastos-total">${otrosStr} €</span></div>
          <div class="calc-total"><span class="label">Total:</span><span class="amount"><strong class="slight total-val">${totalValStr} €</strong></span></div>
        </div>
      `;
    } else {
      const manutLabel = `Manutención: ${display.manutenciones || 0} × ${ (display.precioManutencion || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) } €`;
      const manutAmount = fmt(display.manutencionesAmount || 0);
      const kmAmountFmt = fmt(kmAmount);
      const otrosFmt = fmt(otros);
      const alojMaxRaw = Number(typeof display.alojamientoMaxAmount !== 'undefined' ? display.alojamientoMaxAmount : display.nochesAmount || 0);
      const nochesCnt = Number(display.noches || 0);
      const precioNoche = (nochesCnt > 0) ? (alojMaxRaw / nochesCnt) : (typeof display.precioNoche !== 'undefined' ? Number(display.precioNoche || 0) : 0);
      const alojUserNum = Number(typeof display.alojamientoUser !== 'undefined' ? display.alojamientoUser : 0);
      const alojBracket = `<em>[ Máximo: ${nochesCnt} × ${fmt(precioNoche)} = ${fmt(alojMaxRaw)} € ]</em>`;
      const ctxAlojNumSingle = (ctx && typeof ctx.alojNum !== 'undefined') ? Number(ctx.alojNum || 0) : 0;
      const alojUserNumFinal = ctxAlojNumSingle > 0 ? ctxAlojNumSingle : alojUserNum;
      const alojamientoExceedsMax = alojUserNumFinal > alojMaxRaw;
      const alojUserHtml = (alojUserNumFinal > 0) ? `${alojamientoExceedsMax ? `<span class="warn-wrapper" tabindex="0" aria-live="polite"><span class="warn-icon" aria-hidden="true">⚠️</span><span class="warn-tooltip" role="tooltip">¡Atención! El importe del alojamiento supera el máximo permitido.</span></span>` : ''}<span class="amount aloj-user${alojamientoExceedsMax ? ' error-amount' : ''}">${fmt(alojUserNumFinal)} €</span>` : `<span class="amount aloj-user">${fmt(0)} €</span>`;
      const totalWithUser = (Number(display.manutencionesAmount || 0) + Number(kmAmount) + Number(alojUserNumFinal || 0) + Number(otros || 0));
      const totalWithUserFmt = fmt(totalWithUser);
      html = `
        <div class="calc-result" aria-live="polite" data-desp-id="${id}">
          <div class="calc-line"><span class="label">${manutLabel}</span><span class="leader" aria-hidden="true"></span><span class="amount manut">${manutAmount} €</span></div>
          <div class="calc-line aloj-line${alojamientoExceedsMax ? ' error-line' : ''}"><span class="label">Alojamiento: ${alojBracket}</span><span class="leader" aria-hidden="true"></span>${alojUserHtml}</div>
          <div class="calc-line"><span class="label">Km:</span><span class="leader" aria-hidden="true"></span><span class="amount km">${kmAmountFmt} €</span></div>
          <div class="calc-line"><span class="label">Total otros gastos</span><span class="leader" aria-hidden="true"></span><span class="amount otros-gastos-total">${otrosFmt} €</span></div>
          <div class="calc-total"><span class="label">Total:</span><span class="amount"><strong class="slight total-val">${totalWithUserFmt} €</strong></span></div>
        </div>`;
    }

    return html;
  }

  // Monta el HTML en el elemento `despEl` y maneja los elementos interactivos (checkbox justificar).
  // Esta función es DOM-dependiente.
  function mountSalida(despEl, html, canonical, ctx) {
    if (!despEl) return;
    if (!html) {
      const existing = despEl.querySelector('.calc-result'); if (existing) existing.remove();
      return;
    }
    const out = despEl.querySelector('.calc-result');
    if (out) out.outerHTML = html; else despEl.insertAdjacentHTML('beforeend', html);

    // Wire justificar-pernocta if needed (uses display computed from canonical+ctx)
    try {
      const display = buildDisplay(canonical, ctx);
      const ambiguous = (display && display.nochesAmbiguous) || (Array.isArray(display.segmentsResults) && display.segmentsResults.some(s => s && s.nochesAmbiguous));
      const id = (ctx && ctx.id) ? ctx.id : (despEl.dataset && despEl.dataset.desplazamientoId ? despEl.dataset.desplazamientoId : Math.random().toString(36).slice(2,8));
      const existingJust = despEl.querySelector('.justificar-pernocta-field');
      if (ambiguous) {
        const ticketField = despEl.querySelector(`#ticket-cena-field-${id}`);
        const firstAmb = Array.isArray(display.segmentsResults) ? display.segmentsResults.find(s=>s&&s.nochesAmbiguous) : null;
        const nochesFrom = (display && display.nochesAmbiguousFrom) ? display.nochesAmbiguousFrom : (firstAmb && firstAmb.nochesAmbiguousFrom) || '';
        const nochesTo = (display && display.nochesAmbiguousTo) ? display.nochesAmbiguousTo : (firstAmb && firstAmb.nochesAmbiguousTo) || '';
        const justHtml = `<div class="ticket-cena-field conditional-row justificar-pernocta-field" id="justificar-container-${id}"><div class="form-group"><label><input type="checkbox" id="justificar-pernocta-${id}" /> Justifica haber pernoctado la noche del ${nochesFrom} al ${nochesTo}.</label></div></div>`;
        if (!existingJust) {
          if (ticketField && typeof ticketField.insertAdjacentHTML === 'function') ticketField.insertAdjacentHTML('afterend', justHtml);
          else despEl.insertAdjacentHTML('beforeend', justHtml);
        }
        const chk = despEl.querySelector(`#justificar-pernocta-${id}`);
        if (chk) {
          try { if (despEl.dataset && despEl.dataset.justificarPernocta === '1') chk.checked = true; else chk.checked = false; } catch (e) {}
          chk.removeEventListener('change', chk._justHandler);
          chk._justHandler = function () {
            try {
              if (chk.checked) despEl.dataset.justificarPernocta = '1'; else delete despEl.dataset.justificarPernocta;
              if (window.calculoDesp && typeof window.calculoDesp.calculaDesplazamientoFicha === 'function') {
                const res = window.calculoDesp.calculaDesplazamientoFicha(despEl);
                if (res && res.canonical) {
                  window.salidaDesp.renderSalida(despEl, res.canonical, res.displayContext);
                }
              }
            } catch (e) {}
          };
          chk.addEventListener('change', chk._justHandler);
        }
      } else {
        if (existingJust && existingJust.parentNode) existingJust.parentNode.removeChild(existingJust);
      }
    } catch (e) { /* ignore */ }
  }

  // Compat wrapper: mantiene la API existente pero delega en las funciones puras.
  function renderSalida(despEl, canonical, ctx) {
    // normalize ctx
    const _ctx = Object.assign({}, ctx || {});
    // allow caller to pass id via dataset or ctx
    if (!(_ctx.id) && despEl && despEl.dataset && despEl.dataset.desplazamientoId) _ctx.id = despEl.dataset.desplazamientoId;
    const html = renderSalidaHtml(canonical, _ctx);
    mountSalida(despEl, html, canonical, _ctx);
  }

  window.salidaDesp = {
    renderSalidaHtml,
    mountSalida,
    renderSalida // compat
  };
})();
