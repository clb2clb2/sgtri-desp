// js/salidaDesp.js
// Renderizado de resultados en el div .calc-result
// Expone `renderSalida(despEl, canonicalResult, displayContext)` en window.salidaDesp

(function () {
  function fmt(n) {
    return (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderSalida(despEl, canonical, ctx) {
    if (!despEl) return;
    // Build displayResult as a clone of canonical to apply UI-only overrides
    const otros = (ctx && ctx.otrosSum) ? Number(ctx.otrosSum) : 0;
    if (!canonical) {
      const existing = despEl.querySelector('.calc-result'); if (existing) existing.remove();
      return;
    }

    const display = JSON.parse(JSON.stringify(canonical));
    const id = despEl.dataset && despEl.dataset.desplazamientoId ? despEl.dataset.desplazamientoId : Math.random().toString(36).slice(2,8);

    // Apply flags from context (excludeManutencion) and dataset (dtInvalid, justificarPernocta)
    try {
      const excludeMan = ctx && ctx.flags && ctx.flags.excludeManutencion;
      const isDtInvalid = despEl && despEl.dataset && despEl.dataset.dtInvalid === '1';
      if (excludeMan) {
        // zero out manutenciones globally or per-segment
        if (Array.isArray(display.segmentsResults)) {
          display.segmentsResults.forEach(s => { if (s) { s.manutencionesAmount = 0; s.manutenciones = 0; if (s.irpf && typeof s.irpf === 'object') s.irpf.sujeto = 0; } });
        } else {
          try { display.manutencionesAmount = 0; display.manutenciones = 0; if (display.irpf && typeof display.irpf === 'object') display.irpf.sujeto = 0; } catch(e){}
        }
      }
      if (isDtInvalid) {
        // Force manut and alojamiento display to 0
        if (Array.isArray(display.segmentsResults)) {
          display.segmentsResults.forEach(s => { if (s) { s.manutencionesAmount = 0; s.manutenciones = 0; s.nochesAmount = 0; s.noches = 0; } });
          display.alojamientoUser = 0;
        } else {
          display.manutencionesAmount = 0; display.manutenciones = 0; display.alojamiento = 0; display.nochesAmount = 0; display.noches = 0;
        }
      }

      // If user has justified pernocta (dataset flag), apply +1 night to ambiguous segment or last
      const justified = despEl && despEl.dataset && despEl.dataset.justificarPernocta === '1';
      if (justified) {
        if (Array.isArray(display.segmentsResults) && display.segmentsResults.length > 0) {
          const seg = display.segmentsResults.find(s => s && s.nochesAmbiguous) || display.segmentsResults[display.segmentsResults.length - 1];
          if (seg) {
            const price = (typeof seg.precioNoche !== 'undefined') ? Number(seg.precioNoche || 0) : (typeof display.precioNoche !== 'undefined' ? Number(display.precioNoche || 0) : 0);
            seg.noches = (Number(seg.noches) || 0) + 1;
            seg.nochesAmount = (Number(seg.nochesAmount) || 0) + price;
            if (typeof seg.nochesIfCounted !== 'undefined') seg.nochesIfCounted = (Number(seg.nochesIfCounted) || 0) + 1;
            if (typeof seg.nochesAmountIfCounted !== 'undefined') seg.nochesAmountIfCounted = (Number(seg.nochesAmountIfCounted) || 0) + price;
            // adjust aggregate alojamientoUser
            display.alojamientoUser = (Number(display.alojamientoUser) || Number(display.alojamiento) || 0) + price;
          }
        } else {
          const price = (typeof display.precioNoche !== 'undefined') ? Number(display.precioNoche || 0) : 0;
          display.noches = (Number(display.noches) || 0) + 1;
          display.nochesAmount = (Number(display.nochesAmount) || 0) + price;
          display.alojamiento = (Number(display.alojamiento) || 0) + price;
        }
      }
    } catch (e) { /* ignore overlay errors */ }

    // Determine whether to show anything: aggregate relevant numbers
    const kmAmount = typeof display.kmAmount !== 'undefined' ? Number(display.kmAmount || 0) : 0;
    const manutTotal = (Array.isArray(display.segmentsResults) ? display.segmentsResults.reduce((a,s)=>a+(s && s.manutencionesAmount?Number(s.manutencionesAmount||0):0),0) : Number(display.manutencionesAmount || 0));
    const alojTotal = Array.isArray(display.segmentsResults) ? (Number(display.alojamientoUser || 0)) : Number(display.alojamiento || 0);
    const anyPositive = (otros > 0) || (kmAmount > 0) || (manutTotal > 0) || (alojTotal > 0);
    if (!anyPositive) { const existing = despEl.querySelector('.calc-result'); if (existing) existing.remove(); return; }

    // Render composite (segments) or single
    let html = '';
    if (Array.isArray(display.segmentsResults) && display.segmentsResults.length > 0) {
      // per-segment blocks
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

      // aggregated totals
      const totalManutStr = fmt(manutTotal);
      const totalAlojStr = fmt(alojTotal);
      const kmStr = fmt(kmAmount);
      const otrosStr = fmt(otros);
      const totalVal = manutTotal + kmAmount + alojTotal + otros;
      const totalValStr = fmt(totalVal);

      // Check alojamiento max across segments (sum nochesAmount per segment)
      const totalAlojMax = display.segmentsResults.reduce((acc,s)=>acc+((s && typeof s.nochesAmount !== 'undefined')?Number(s.nochesAmount||0):0),0);
      const alojamientoWarn = Number(alojTotal) > Number(totalAlojMax);

      html = `
        <div class="calc-result composite" data-desp-id="${id}">
          ${segHtml}
          <div class="calc-seg-title">TOTALES:</div>
          <div class="calc-line"><span class="label">Total manutención</span><span class="leader" aria-hidden="true"></span><span class="amount manut">${totalManutStr} €</span></div>
          <div class="calc-line aloj-aggregated${alojamientoWarn? ' error-line':''}"><span class="label">Alojamiento: <em>[máx ${fmt(totalAlojMax)} €]</em></span><span class="leader" aria-hidden="true"></span><span class="amount aloj-user${alojamientoWarn? ' error-amount':''}">${totalAlojStr} €</span></div>
          <div class="calc-line"><span class="label">Km.</span><span class="leader" aria-hidden="true"></span><span class="amount km">${kmStr} €</span></div>
          <div class="calc-line"><span class="label">Total otros gastos</span><span class="leader" aria-hidden="true"></span><span class="amount otros-gastos-total">${otrosStr} €</span></div>
          <div class="calc-total"><span class="label">Total:</span><span class="amount"><strong class="slight total-val">${totalValStr} €</strong></span></div>
        </div>
      `;
    } else {
      // single result
      const manutLabel = `Manutención: ${display.manutenciones || 0} × ${ (display.precioManutencion || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) } €`;
      const manutAmount = fmt(display.manutencionesAmount || 0);
      const alojamientoAmount = fmt(display.alojamiento || 0);
      const kmAmountFmt = fmt(kmAmount);
      const otrosFmt = fmt(otros);
      const total = (Number(display.manutencionesAmount || 0) + Number(kmAmount) + Number(display.alojamiento || 0) + Number(otros || 0));
      const totalFmt = fmt(total);
      html = `
        <div class="calc-result" aria-live="polite" data-desp-id="${id}">
          <div class="calc-line"><span class="label">${manutLabel}</span><span class="leader" aria-hidden="true"></span><span class="amount manut">${manutAmount} €</span></div>
          <div class="calc-line aloj-line"><span class="label">Alojamiento:</span><span class="leader" aria-hidden="true"></span><span class="amount aloj">${alojamientoAmount} €</span></div>
          <div class="calc-line"><span class="label">Km:</span><span class="leader" aria-hidden="true"></span><span class="amount km">${kmAmountFmt} €</span></div>
          <div class="calc-line"><span class="label">Total otros gastos</span><span class="leader" aria-hidden="true"></span><span class="amount otros-gastos-total">${otrosFmt} €</span></div>
          <div class="calc-total"><span class="label">Total:</span><span class="amount"><strong class="slight total-val">${totalFmt} €</strong></span></div>
        </div>`;
    }

    const out = despEl.querySelector('.calc-result');
    if (out) out.outerHTML = html; else despEl.insertAdjacentHTML('beforeend', html);

    // Insert justificar-pernocta checkbox if any ambiguous segment or top-level ambiguous
    try {
      const ambiguous = (display && display.nochesAmbiguous) || (Array.isArray(display.segmentsResults) && display.segmentsResults.some(s => s && s.nochesAmbiguous));
      const existingJust = despEl.querySelector('.justificar-pernocta-field');
      if (ambiguous) {
        const ticketField = despEl.querySelector(`#ticket-cena-field-${id}`);
        const nochesFrom = (display && display.nochesAmbiguousFrom) ? display.nochesAmbiguousFrom : ((display.segmentsResults && display.segmentsResults.find(s=>s&&s.nochesAmbiguous) && display.segmentsResults.find(s=>s&&s.nochesAmbiguous).nochesAmbiguousFrom) || '');
        const nochesTo = (display && display.nochesAmbiguousTo) ? display.nochesAmbiguousTo : ((display.segmentsResults && display.segmentsResults.find(s=>s&&s.nochesAmbiguous) && display.segmentsResults.find(s=>s&&s.nochesAmbiguous).nochesAmbiguousTo) || '');
        const justHtml = `<div class="ticket-cena-field conditional-row justificar-pernocta-field" id="justificar-container-${id}"><div class="form-group"><label><input type="checkbox" id="justificar-pernocta-${id}" /> Justifica haber pernoctado la noche del ${nochesFrom} al ${nochesTo}.</label></div></div>`;
        if (!existingJust) {
          if (ticketField && typeof ticketField.insertAdjacentHTML === 'function') ticketField.insertAdjacentHTML('afterend', justHtml);
          else despEl.insertAdjacentHTML('beforeend', justHtml);
        }
        // wire checkbox
        const chk = despEl.querySelector(`#justificar-pernocta-${id}`);
        if (chk) {
          // set checked state from dataset
          try { if (despEl.dataset && despEl.dataset.justificarPernocta === '1') chk.checked = true; else chk.checked = false; } catch(e){}
          // attach change handler
          chk.removeEventListener('change', chk._justHandler);
          chk._justHandler = function () {
            try {
              if (chk.checked) despEl.dataset.justificarPernocta = '1'; else delete despEl.dataset.justificarPernocta;
              // recompute and re-render
              if (window.calculoDesp && typeof window.calculoDesp.calculaDesplazamientoFicha === 'function') {
                const res = window.calculoDesp.calculaDesplazamientoFicha(despEl);
                window.salidaDesp.renderSalida(despEl, res && res.canonical, res && res.displayContext);
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

  window.salidaDesp = {
    renderSalida
  };
})();
