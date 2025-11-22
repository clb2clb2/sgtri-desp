// js/salidaDesp.js
// Renderizado de resultados en el div .calc-result
// Expone `renderSalida(despEl, canonicalResult, displayContext)` en window.salidaDesp

(function () {
  function fmt(n) {
    return (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderSalida(despEl, canonical, ctx) {
    if (!despEl) return;
    // If canonical is falsy or all zeros and no otros, remove result
    const otros = (ctx && ctx.otrosSum) ? Number(ctx.otrosSum) : 0;
    const kmAmount = canonical && typeof canonical.kmAmount !== 'undefined' ? Number(canonical.kmAmount || 0) : 0;
    const manut = canonical && typeof canonical.manutencionesAmount !== 'undefined' ? Number(canonical.manutencionesAmount || 0) : 0;
    const aloj = canonical && typeof canonical.alojamiento !== 'undefined' ? Number(canonical.alojamiento || 0) : 0;
    const anyPositive = (otros > 0) || (kmAmount > 0) || (manut > 0) || (aloj > 0);
    if (!canonical || !anyPositive) {
      const existing = despEl.querySelector('.calc-result'); if (existing) existing.remove();
      return;
    }

    // Simple single-result rendering (we will extend for segments later)
    const id = despEl.dataset && despEl.dataset.desplazamientoId ? despEl.dataset.desplazamientoId : Math.random().toString(36).slice(2,8);
    const manutLabel = `Manutención: ${canonical.manutenciones || 0} × ${ (canonical.precioManutencion || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) } €`;
    const manutAmount = fmt(canonical.manutencionesAmount || 0);
    const alojamientoAmount = fmt(canonical.alojamiento || 0);
    const kmAmountFmt = fmt(kmAmount);
    const otrosFmt = fmt(otros);
    const total = (Number(canonical.manutencionesAmount || 0) + Number(kmAmount) + Number(canonical.alojamiento || 0) + Number(otros || 0));
    const totalFmt = fmt(total);

    const html = `
      <div class="calc-result" aria-live="polite" data-desp-id="${id}">
        <div class="calc-line"><span class="label">${manutLabel}</span><span class="leader" aria-hidden="true"></span><span class="amount manut">${manutAmount} €</span></div>
        <div class="calc-line aloj-line"><span class="label">Alojamiento:</span><span class="leader" aria-hidden="true"></span><span class="amount aloj">${alojamientoAmount} €</span></div>
        <div class="calc-line"><span class="label">Km:</span><span class="leader" aria-hidden="true"></span><span class="amount km">${kmAmountFmt} €</span></div>
        <div class="calc-line"><span class="label">Total otros gastos</span><span class="leader" aria-hidden="true"></span><span class="amount otros-gastos-total">${otrosFmt} €</span></div>
        <div class="calc-total"><span class="label">Total:</span><span class="amount"><strong class="slight total-val">${totalFmt} €</strong></span></div>
      </div>
    `;
    const out = despEl.querySelector('.calc-result');
    if (out) out.outerHTML = html; else despEl.insertAdjacentHTML('beforeend', html);
  }

  window.salidaDesp = {
    renderSalida
  };
})();
