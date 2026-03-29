/**
 * uiDesplazamientoAecc.js
 * ========================
 * Modulo aislado para el desplazamiento AECC.
 * No interactua con calculoDesp, logicaDesp ni resultadoLiquidacion.
 */
(function (global) {
  'use strict';

  let paisesData = [];
  let datosAecc = {
    importekm: 0,
    importedesayunoEsp: 0,
    importecomidaEsp: 0,
    importecenaEsp: 0,
    importedesayunoExt: 0,
    importecomidaExt: 0,
    importecenaExt: 0,
    alojMaxEspNormal: 0,
    alojMaxEspAltaOcupacion: 0,
    alojMaxExt: 0
  };
  let limitesIrpf = {
    esp: [0, 0],
    ext: [0, 0]
  };
  let maxOtrosGastosPorDesplazamiento = 10;
  let modoManutencion = 'none';
  let condicionNoPernoctaActiva = false;
  let initialized = false;
  const AECC_RESULTADO_ID = 'aecc';

  function byId(id) {
    return document.getElementById(id);
  }

  function poblarSelectPaises() {
    const select = byId('aecc-pais-destino');
    if (!select) return;

    select.innerHTML = '';
    const lista = Array.isArray(paisesData) ? paisesData : [];

    lista.forEach((pais) => {
      const option = document.createElement('option');
      option.value = pais;
      option.textContent = pais;
      select.appendChild(option);
    });

    if (lista.indexOf('España') !== -1) {
      select.value = 'España';
    } else if (select.options.length > 0) {
      select.selectedIndex = 0;
    }
  }

  function setPaisesData(data) {
    paisesData = Array.isArray(data) ? data : [];
    poblarSelectPaises();
    actualizarVisibilidadAltaOcupacion();
    renderResultado();
  }

  function parseDateStrict(v) {
    return global.limpiaDatos?.parseDateStrict ? global.limpiaDatos.parseDateStrict(v) : null;
  }

  function parseTimeStrict(v) {
    return global.limpiaDatos?.parseTimeStrict ? global.limpiaDatos.parseTimeStrict(v) : null;
  }

  function parseNumber(v) {
    return global.limpiaDatos?.parseNumber ? global.limpiaDatos.parseNumber(v) : 0;
  }

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function fmtEuro(n) {
    return (Number(n) || 0).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' €';
  }

  function fmtEuroCompact(n) {
    const num = Number(n) || 0;
    const hasDecimals = Math.abs(num % 1) > Number.EPSILON;
    return num.toLocaleString('de-DE', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    }) + ' €';
  }

  function fmtMoneyNoSymbol(n) {
    const num = Number(n) || 0;
    const hasDecimals = Math.abs(num % 1) > Number.EPSILON;
    return num.toLocaleString('de-DE', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    });
  }

  function setDatosAecc(raw) {
    const src = raw || {};
    datosAecc = {
      importekm: Number(src.importekm) || 0,
      importedesayunoEsp: Number(src.importedesayunoEsp) || 0,
      importecomidaEsp: Number(src.importecomidaEsp) || 0,
      importecenaEsp: Number(src.importecenaEsp) || 0,
      importedesayunoExt: Number(src.importedesayunoExt) || 0,
      importecomidaExt: Number(src.importecomidaExt) || 0,
      importecenaExt: Number(src.importecenaExt) || 0,
      alojMaxEspNormal: Number(src.alojMaxEspNormal) || 0,
      alojMaxEspAltaOcupacion: Number(src.alojMaxEspAltaOcupacion) || 0,
      alojMaxExt: Number(src.alojMaxExt) || 0
    };
    renderResultado();
  }

  function setLimitesIrpf(raw) {
    const src = raw || {};
    const esp = Array.isArray(src.esp) ? src.esp : [0, 0];
    const ext = Array.isArray(src.ext) ? src.ext : [0, 0];

    limitesIrpf = {
      esp: [Number(esp[0]) || 0, Number(esp[1]) || 0],
      ext: [Number(ext[0]) || 0, Number(ext[1]) || 0]
    };

    renderResultado();
  }

  function setLimites(raw) {
    const src = raw || {};
    const maxOtros = Number(src.maxOtrosGastosPorDesplazamiento);
    maxOtrosGastosPorDesplazamiento = Number.isFinite(maxOtros) && maxOtros > 0 ? maxOtros : 10;
    actualizarVisibilidadBotonOtrosGastosAecc();
  }

  function getTarifasManutencionPorPais() {
    const pais = String(byId('aecc-pais-destino')?.value || '').trim();
    const esEspana = pais === 'España';

    return {
      desayuno: esEspana ? (Number(datosAecc.importedesayunoEsp) || 0) : (Number(datosAecc.importedesayunoExt) || 0),
      comida: esEspana ? (Number(datosAecc.importecomidaEsp) || 0) : (Number(datosAecc.importecomidaExt) || 0),
      cena: esEspana ? (Number(datosAecc.importecenaEsp) || 0) : (Number(datosAecc.importecenaExt) || 0)
    };
  }

  function getLimitesIrpfPorPais() {
    const pais = String(byId('aecc-pais-destino')?.value || '').trim();
    const esEspana = pais === 'España';
    const arr = esEspana ? limitesIrpf.esp : limitesIrpf.ext;
    return {
      menor: Number(arr?.[0]) || 0,
      mayor: Number(arr?.[1]) || 0
    };
  }

  function actualizarVisibilidadAltaOcupacion() {
    const row = byId('aecc-alta-ocupacion-row');
    const checkbox = byId('aecc-destino-alta-ocupacion');
    if (!row) return;

    const pais = String(byId('aecc-pais-destino')?.value || '').trim();
    const mostrar = pais === 'España';

    row.style.display = mostrar ? '' : 'none';
    if (!mostrar && checkbox) {
      checkbox.checked = false;
    }
  }

  function formatDateDdMmAa(dateObj) {
    if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '--/--/--';
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = String(dateObj.getFullYear() % 100).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  function actualizarVisibilidadJustificarPernoctaAecc() {
    const row = byId('aecc-justificar-pernocta-row');
    const check = byId('aecc-justificar-pernocta');
    const textEl = byId('aecc-justificar-pernocta-text');
    if (!row) return;

    const fechaReg = parseDateStrict(byId('aecc-fecha-regreso')?.value || '');
    const horaReg = parseTimeStrict(byId('aecc-hora-regreso')?.value || '');

    const minutosReg = horaReg ? (horaReg.hh * 60 + horaReg.mm) : -1;
    const enRangoMadrugada = minutosReg >= 61 && minutosReg <= 419; // 01:01 a 06:59

    const mostrar = !!fechaReg && enRangoMadrugada;
    row.style.display = mostrar ? '' : 'none';

    if (!mostrar) {
      if (check) check.checked = false;
      return;
    }

    const ultimoDia = new Date(fechaReg.getFullYear(), fechaReg.getMonth(), fechaReg.getDate(), 0, 0, 0, 0);
    const penultimoDia = new Date(ultimoDia.getTime() - (24 * 60 * 60 * 1000));
    const desde = formatDateDdMmAa(penultimoDia);
    const hasta = formatDateDdMmAa(ultimoDia);

    if (textEl) {
      textEl.textContent = `Justifica haber pernoctado la noche del ${desde} al ${hasta}.`;
    }
  }

  function getMinutosRegreso() {
    const horaReg = parseTimeStrict(byId('aecc-hora-regreso')?.value || '');
    if (!horaReg) return -1;
    return (horaReg.hh * 60 + horaReg.mm);
  }

  function aplicaReglaNoPernoctaMadrugada() {
    const minutosReg = getMinutosRegreso();
    if (minutosReg < 0) return false;

    // Tramo 00:00 - 01:00 (siempre)
    if (minutosReg >= 0 && minutosReg <= 60) return true;

    // Tramo 01:01 - 06:59 (solo si NO se justifica pernocta)
    if (minutosReg >= 61 && minutosReg <= 419) {
      return !byId('aecc-justificar-pernocta')?.checked;
    }

    return false;
  }

  function aplicarReglaNoPernoctaEnManutencionUltimoDia() {
    const modo = getModoManutencionSegunFechas();
    const aplica = (modo === 'range') && aplicaReglaNoPernoctaMadrugada();
    if (!aplica) {
      condicionNoPernoctaActiva = false;
      return;
    }

    const ultimoSel = byId('aecc-manut-ultimo-dia');
    if (!ultimoSel) return;

    // Solo autoselecciona al entrar en el caso de no pernocta.
    if (!condicionNoPernoctaActiva) {
      ultimoSel.value = 'NONE';
    }
    condicionNoPernoctaActiva = true;
  }

  function calcularNumeroDias() {
    const fIda = parseDateStrict(byId('aecc-fecha-ida')?.value || '');
    const fReg = parseDateStrict(byId('aecc-fecha-regreso')?.value || '');
    if (!fIda || !fReg) return 0;

    const ida = new Date(fIda.getFullYear(), fIda.getMonth(), fIda.getDate(), 0, 0, 0, 0);
    const reg = new Date(fReg.getFullYear(), fReg.getMonth(), fReg.getDate(), 0, 0, 0, 0);
    const diffMs = reg.getTime() - ida.getTime();
    const diffDias = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (!Number.isFinite(diffDias) || diffDias < 0) return 0;
    return diffDias + 1;
  }

  function calcularPernoctaciones() {
    const fIda = parseDateStrict(byId('aecc-fecha-ida')?.value || '');
    const fReg = parseDateStrict(byId('aecc-fecha-regreso')?.value || '');
    if (!fIda || !fReg) return 0;

    const ida = new Date(fIda.getFullYear(), fIda.getMonth(), fIda.getDate(), 0, 0, 0, 0);
    const reg = new Date(fReg.getFullYear(), fReg.getMonth(), fReg.getDate(), 0, 0, 0, 0);
    const diffMs = reg.getTime() - ida.getTime();
    const diffDias = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (!Number.isFinite(diffDias) || diffDias < 0) return 0;
    return diffDias;
  }

  function getMaxAlojamientoPorPernoctacion() {
    const pais = String(byId('aecc-pais-destino')?.value || '').trim();
    if (pais !== 'España') {
      return Number(datosAecc.alojMaxExt) || 0;
    }
    const alta = !!byId('aecc-destino-alta-ocupacion')?.checked;
    return alta ? (Number(datosAecc.alojMaxEspAltaOcupacion) || 0) : (Number(datosAecc.alojMaxEspNormal) || 0);
  }

  function getModoManutencionSegunFechas() {
    const fIda = parseDateStrict(byId('aecc-fecha-ida')?.value || '');
    const fReg = parseDateStrict(byId('aecc-fecha-regreso')?.value || '');
    if (!fIda || !fReg) return 'none';

    const ida = new Date(fIda.getFullYear(), fIda.getMonth(), fIda.getDate(), 0, 0, 0, 0);
    const reg = new Date(fReg.getFullYear(), fReg.getMonth(), fReg.getDate(), 0, 0, 0, 0);
    if (reg.getTime() < ida.getTime()) return 'none';
    if (reg.getTime() === ida.getTime()) return 'same';
    return 'range';
  }

  function setSelectOptions(selectEl, options, defaultValue) {
    if (!selectEl) return;
    const previous = selectEl.value;
    selectEl.innerHTML = '';

    options.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      selectEl.appendChild(option);
    });

    const existsPrev = options.some(o => o.value === previous);
    selectEl.value = existsPrev ? previous : defaultValue;
  }

  function getOpcionesPrimerDiaRange() {
    return [
      { value: 'B+C+CN', label: 'Desayuno + Comida + Cena' },
      { value: 'C+CN', label: 'Comida + Cena' },
      { value: 'CN', label: 'Cena' },
      { value: 'NONE', label: 'Sin manutención' }
    ];
  }

  function getOpcionesPrimerDiaSame() {
    return [
      { value: 'B+C+CN', label: 'Desayuno + Comida + Cena' },
      { value: 'B+C', label: 'Desayuno + Comida' },
      { value: 'C+CN', label: 'Comida + Cena' },
      { value: 'B', label: 'Desayuno' },
      { value: 'C', label: 'Comida' },
      { value: 'CN', label: 'Cena' },
      { value: 'NONE', label: 'Sin manutención' }
    ];
  }

  function textoFechaLabelAecc(inputId) {
    const raw = String(byId(inputId)?.value || '').trim();
    const parsed = parseDateStrict(raw);
    if (parsed) {
      return formatDateDdMmAa(parsed);
    }
    return raw || '--/--/--';
  }

  function actualizarVisibilidadManutencion() {
    const row = byId('aecc-manut-row');
    const primerGroup = byId('aecc-manut-primer-group');
    const ultimoGroup = byId('aecc-manut-ultimo-group');
    const primerSel = byId('aecc-manut-primer-dia');
    const ultimoSel = byId('aecc-manut-ultimo-dia');
    const primerLabel = document.querySelector('label[for="aecc-manut-primer-dia"]');
    const ultimoLabel = document.querySelector('label[for="aecc-manut-ultimo-dia"]');
    const fechaSalidaTxt = textoFechaLabelAecc('aecc-fecha-ida');
    const fechaRegresoTxt = textoFechaLabelAecc('aecc-fecha-regreso');
    if (!row || !primerGroup || !ultimoGroup || !primerSel || !ultimoSel) return;

    const nextMode = getModoManutencionSegunFechas();
    if (nextMode !== modoManutencion) {
      primerSel.value = 'B+C+CN';
      ultimoSel.value = 'B+C+CN';
      modoManutencion = nextMode;
    }

    if (nextMode === 'none') {
      row.style.display = 'none';
      return;
    }

    row.style.display = '';
    if (nextMode === 'same') {
      setSelectOptions(primerSel, getOpcionesPrimerDiaSame(), 'B+C+CN');
      if (primerLabel) primerLabel.textContent = `Manutención ${fechaSalidaTxt}:`;
      primerGroup.style.display = '';
      ultimoGroup.style.display = 'none';
      return;
    }

    setSelectOptions(primerSel, getOpcionesPrimerDiaRange(), 'B+C+CN');
    if (primerLabel) primerLabel.textContent = `Manutención ${fechaSalidaTxt}:`;
    if (ultimoLabel) ultimoLabel.textContent = `Manutención ${fechaRegresoTxt}:`;

    primerGroup.style.display = '';
    ultimoGroup.style.display = '';
  }

  function importeManutencionDia(codigo, tarifas) {
    const desayuno = Number(tarifas?.desayuno) || 0;
    const comida = Number(tarifas?.comida) || 0;
    const cena = Number(tarifas?.cena) || 0;

    if (codigo === 'NONE') return 0;
    if (codigo === 'B+C+CN') return desayuno + comida + cena;
    if (codigo === 'C+CN') return comida + cena;
    if (codigo === 'CN') return cena;
    if (codigo === 'B+C') return desayuno + comida;
    if (codigo === 'B') return desayuno;
    if (codigo === 'C') return comida;
    return 0;
  }

  function construirTextoManutencion(modo, baseDias, primerDia, ultimoDia, full) {

    if (full <= 0) return '0 €';

    if (modo === 'none') return '0 €';

    if (modo === 'same') {
      if (primerDia <= 0) return '0 €';
      if (round2(primerDia) === round2(full)) {
        return `1 × ${fmtEuroCompact(full)}`;
      }
      return fmtEuroCompact(primerDia);
    }

    let nFull = Math.max(baseDias, 0);
    if (round2(primerDia) === round2(full)) nFull += 1;
    if (round2(ultimoDia) === round2(full)) nFull += 1;

    const parts = [];

    // 1) Primer día, solo si no es el máximo
    if (primerDia > 0 && round2(primerDia) !== round2(full)) {
      parts.push(fmtEuroCompact(primerDia));
    }

    // 2) Días con importe máximo
    if (nFull > 0) {
      parts.push(`${nFull} × ${fmtEuroCompact(full)}`);
    }

    // 3) Último día, solo si no es el máximo
    if (ultimoDia > 0 && round2(ultimoDia) !== round2(full)) {
      parts.push(fmtEuroCompact(ultimoDia));
    }

    if (parts.length === 0) return '0 €';
    return parts.join(' + ');
  }

  function warningAlojamientoExcedido() {
    return `<span class="warn-wrapper" tabindex="0" aria-live="polite">
      <span class="warn-icon" aria-hidden="true">⚠️</span>
      <span class="warn-tooltip" role="tooltip">¡Atención! El importe del alojamiento supera el máximo permitido.</span>
    </span>`;
  }

  function getOtrosGastosDataCatalogo() {
    const data = global.utils?.getSgtriDatos?.() || global.__sgtriDatos || {};
    const base = Array.isArray(data.otrosGastos) ? data.otrosGastos : [];

    // En AECC se añade una opción específica al principio de la lista.
    const aeccFirst = ['Inscripción Congreso', 'ICG'];
    const yaExiste = base.some((item) => {
      const label = String(item?.[0] || '').trim().toLowerCase();
      return label === 'inscripción congreso' || label === 'inscripcion congreso';
    });

    return yaExiste ? base : [aeccFirst, ...base];
  }

  function getOtrosGastosContainerAecc() {
    return byId('aecc-otros-gastos');
  }

  function actualizarVisibilidadBotonOtrosGastosAecc() {
    const cont = getOtrosGastosContainerAecc();
    const btn = byId('aecc-btn-otros-gastos');
    if (!cont || !btn) return;
    const count = cont.querySelectorAll('.otros-gasto-line').length;
    btn.style.display = count >= maxOtrosGastosPorDesplazamiento ? 'none' : '';
  }

  function crearLineaOtroGastoAecc() {
    const cont = getOtrosGastosContainerAecc();
    if (!cont) return null;

    const line = document.createElement('div');
    line.className = 'otros-gasto-line form-row three-cols-25-50-25';

    const colTipo = document.createElement('div');
    colTipo.className = 'form-group';
    const labelTipo = document.createElement('label');
    labelTipo.textContent = 'Tipo de gasto:';
    const selectTipo = document.createElement('select');
    selectTipo.className = 'otros-gasto-tipo';
    selectTipo.setAttribute('aria-label', 'Tipo de gasto');
    colTipo.appendChild(labelTipo);
    colTipo.appendChild(selectTipo);

    const colDesc = document.createElement('div');
    colDesc.className = 'form-group';
    const labelDesc = document.createElement('label');
    labelDesc.textContent = 'Descripción:';
    const inputDesc = document.createElement('input');
    inputDesc.type = 'text';
    inputDesc.className = 'otros-gasto-desc';
    inputDesc.maxLength = 60;
    inputDesc.setAttribute('aria-label', 'Descripción del gasto');
    colDesc.appendChild(labelDesc);
    colDesc.appendChild(inputDesc);

    const colImp = document.createElement('div');
    colImp.className = 'form-group';
    const labelImp = document.createElement('label');
    labelImp.textContent = 'Importe:';
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '0.5rem';
    const inputImp = document.createElement('input');
    inputImp.type = 'text';
    inputImp.className = 'format-alojamiento otros-gasto-importe';
    inputImp.placeholder = '0,00 €';
    inputImp.maxLength = 12;
    inputImp.setAttribute('aria-label', 'Importe del gasto');
    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn-remove-otros-gasto';
    btnRemove.setAttribute('aria-label', 'Eliminar otro gasto');
    const spanIcon = document.createElement('span');
    spanIcon.className = 'btn-icon btn-icon-minus';
    spanIcon.setAttribute('aria-hidden', 'true');
    spanIcon.textContent = '+';
    btnRemove.appendChild(spanIcon);

    wrap.appendChild(inputImp);
    wrap.appendChild(btnRemove);
    colImp.appendChild(labelImp);
    colImp.appendChild(wrap);

    line.appendChild(colTipo);
    line.appendChild(colDesc);
    line.appendChild(colImp);

    const catalogo = getOtrosGastosDataCatalogo();
    catalogo.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item[1] || item[0] || '';
      opt.textContent = item[0] || item[1] || '';
      selectTipo.appendChild(opt);
    });

    cont.appendChild(line);
    cont.style.display = 'block';
    actualizarVisibilidadBotonOtrosGastosAecc();
    renderResultado();
    return line;
  }

  function extraerOtrosGastosAecc() {
    const cont = getOtrosGastosContainerAecc();
    if (!cont) return { items: [], total: 0 };
    const lineas = cont.querySelectorAll('.otros-gasto-line');
    const items = [];

    lineas.forEach((linea) => {
      const tipo = String(linea.querySelector('.otros-gasto-tipo')?.value || '').trim();
      const concepto = String(linea.querySelector('.otros-gasto-desc')?.value || '').trim();
      const importeRaw = String(linea.querySelector('.otros-gasto-importe')?.value || '').trim();
      const importe = round2(parseNumber(importeRaw));

      if (tipo || concepto || importe > 0) {
        items.push({
          tipo,
          concepto,
          importe,
          importeRaw
        });
      }
    });

    const total = round2(items.reduce((sum, v) => sum + (Number(v.importe) || 0), 0));
    return { items, total };
  }

  function calcularDatosResultadoAecc() {
    const dias = calcularNumeroDias();
    const modo = getModoManutencionSegunFechas();
    aplicarReglaNoPernoctaEnManutencionUltimoDia();
    const primerSel = byId('aecc-manut-primer-dia')?.value || 'B+C+CN';
    const ultimoSel = byId('aecc-manut-ultimo-dia')?.value || 'B+C+CN';
    const tarifas = getTarifasManutencionPorPais();
    const full = round2((Number(tarifas.desayuno) || 0) + (Number(tarifas.comida) || 0) + (Number(tarifas.cena) || 0));

    let impPrimer = 0;
    let impUltimo = 0;
    let baseDias = 0;
    if (modo === 'same') {
      impPrimer = importeManutencionDia(primerSel, tarifas);
    } else if (modo === 'range') {
      impPrimer = importeManutencionDia(primerSel, tarifas);
      impUltimo = importeManutencionDia(ultimoSel, tarifas);
      baseDias = Math.max(dias - 2, 0);
    }

    const manutencionBase = round2((baseDias * full) + impPrimer + impUltimo);
    const excluirManutencion = !!byId('aecc-no-manutencion')?.checked;
    const manutencion = excluirManutencion ? 0 : manutencionBase;

    const kmValor = parseNumber(byId('aecc-km')?.value || '');
    const kmTarifa = Number(datosAecc.importekm) || 0;
    const kmImporte = round2(kmValor * kmTarifa);

    const alojamiento = round2(parseNumber(byId('aecc-alojamiento')?.value || ''));
    const hayNoPernoctaMadrugada = aplicaReglaNoPernoctaMadrugada();
    const pernoctacionesBase = calcularPernoctaciones();
    const pernoctaciones = hayNoPernoctaMadrugada ? Math.max(pernoctacionesBase - 1, 0) : pernoctacionesBase;
    const maxPorPernoctacion = getMaxAlojamientoPorPernoctacion();
    const maxAlojamiento = round2(pernoctaciones * maxPorPernoctacion);
    const otrosGastosData = extraerOtrosGastosAecc();
    const otrosGastos = otrosGastosData.total;
    const total = round2(manutencion + kmImporte + alojamiento + otrosGastos);
    const irpfLimites = getLimitesIrpfPorPais();

    let sujetoIrpf = 0;
    if (!excluirManutencion) {
      if (modo === 'same') {
        sujetoIrpf = round2(Math.max(0, impPrimer - irpfLimites.menor));
      } else if (modo === 'range') {
        const baseDiasSeguros = Math.max(baseDias, 0);
        let exentoPrimer = irpfLimites.mayor;
        let sujetoIntermedios = Math.max(0, full - irpfLimites.mayor) * baseDiasSeguros;

        if (hayNoPernoctaMadrugada) {
          if (baseDiasSeguros > 0) {
            sujetoIntermedios = (Math.max(0, full - irpfLimites.mayor) * Math.max(baseDiasSeguros - 1, 0))
              + Math.max(0, full - irpfLimites.menor);
          } else {
            exentoPrimer = irpfLimites.menor;
          }
        }

        const sujetoPrimer = Math.max(0, impPrimer - exentoPrimer);
        const sujetoUltimo = Math.max(0, impUltimo - irpfLimites.menor);
        sujetoIrpf = round2(sujetoPrimer + sujetoIntermedios + sujetoUltimo);
      }
    }

    const textoManut = construirTextoManutencion(modo, baseDias, impPrimer, impUltimo, full);
    const textoKm = `${(Math.round(kmValor)).toLocaleString('de-DE')} × ${fmtEuroCompact(kmTarifa)}`;

    return {
      modoManutencion: modo,
      primerDiaCodigo: primerSel,
      ultimoDiaCodigo: ultimoSel,
      baseDias,
      importePrimerDia: round2(impPrimer),
      importeUltimoDia: round2(impUltimo),
      manutencionDiaCompleto: full,
      textoManutencion: textoManut,
      manutencion,
      excluirManutencion,
      km: Math.round(kmValor),
      precioKm: kmTarifa,
      textoKm,
      kilometraje: kmImporte,
      alojamiento,
      pernoctaciones,
      pernoctacionesBase,
      noPernoctaMadrugada: hayNoPernoctaMadrugada,
      maxAlojamientoPorPernoctacion: maxPorPernoctacion,
      maxAlojamiento,
      excedeMaxAlojamiento: alojamiento > maxAlojamiento,
      otrosGastos,
      otrosGastosDetalle: otrosGastosData.items,
      total,
      irpfSujeto: sujetoIrpf,
      irpfLimites: {
        menor: irpfLimites.menor,
        mayor: irpfLimites.mayor
      }
    };
  }

  function hasContenidoAecc(datos) {
    if (!datos) return false;
    const camposTexto = [
      datos.fechaIda,
      datos.horaIda,
      datos.fechaRegreso,
      datos.horaRegreso,
      datos.origen,
      datos.destino,
      datos.paisDestino,
      datos.motivo,
      datos.km,
      datos.alojamiento
    ];
    if (camposTexto.some((v) => String(v || '').trim() !== '')) return true;
    if (datos.destinoAltaOcupacion || datos.justificaPernocta || datos.noManutencion) return true;
    if (Array.isArray(datos.otrosGastos) && datos.otrosGastos.length > 0) return true;
    const calc = datos.datosCalculados || {};
    return (Number(calc.total) || 0) > 0;
  }

  function syncResultadoLiquidacionAecc(calculo, hayContenido) {
    const rl = global.resultadoLiquidacion;
    if (!rl) return;

    if (!hayContenido) {
      if (typeof rl.eliminarDesplazamiento === 'function') {
        rl.eliminarDesplazamiento(AECC_RESULTADO_ID);
      }
      if (typeof rl.renderResultado === 'function') {
        rl.renderResultado();
      }
      return;
    }

    if (typeof rl.registrarDesplazamiento === 'function') {
      rl.registrarDesplazamiento(
        AECC_RESULTADO_ID,
        {
          manutencion: calculo.manutencion,
          alojamientoUser: calculo.alojamiento,
          km: calculo.kilometraje,
          otrosGastos: calculo.otrosGastos,
          irpfSujeto: calculo.irpfSujeto
        },
        {
          origen: byId('aecc-origen')?.value || '',
          destino: byId('aecc-destino')?.value || '',
          paisDestino: byId('aecc-pais-destino')?.value || '',
          motivo: byId('aecc-motivo')?.value || '',
          aecc: true,
          ...calculo
        }
      );
    }

    if (typeof rl.renderResultado === 'function') {
      rl.renderResultado();
    }
  }

  function renderResultado() {
    const resultEl = byId('aecc-calc-result');
    if (!resultEl) return;
    const calculo = calcularDatosResultadoAecc();
    const manutencion = calculo.manutencion;
    const textoManut = calculo.textoManutencion;
    const kmImporte = calculo.kilometraje;
    const textoKm = calculo.textoKm;
    const alojamiento = calculo.alojamiento;
    const pernoctaciones = calculo.pernoctaciones;
    const maxPorPernoctacion = calculo.maxAlojamientoPorPernoctacion;
    const maxAlojamiento = calculo.maxAlojamiento;
    const otrosGastos = calculo.otrosGastos;
    const total = calculo.total;
    const sujetoIrpf = calculo.irpfSujeto;

    const hayContenido = total > 0;
    syncResultadoLiquidacionAecc(calculo, hayContenido);
    if (!hayContenido) {
      resultEl.style.display = 'none';
      resultEl.innerHTML = '';
      return;
    }

    const lineas = [];

    if (manutencion > 0) {
      lineas.push(`
        <div class="calc-line">
          <span class="label">Manutención: ${textoManut}</span>
          <span class="leader"></span>
          <span class="amount">${fmtEuro(manutencion)}</span>
        </div>
      `);
    }

    if (alojamiento > 0) {
      const excedeMaxAloj = alojamiento > maxAlojamiento;
      const errorCls = excedeMaxAloj ? ' error-line' : '';
      const amountErrorCls = excedeMaxAloj ? ' error-amount' : '';
      const warning = excedeMaxAloj ? warningAlojamientoExcedido() : '';

      lineas.push(`
        <div class="calc-line aloj-line${errorCls}">
          <span class="label">Alojamiento: <em>[ Máximo: ${pernoctaciones} × ${fmtMoneyNoSymbol(maxPorPernoctacion)} = ${fmtMoneyNoSymbol(maxAlojamiento)} € ]</em></span>
          <span class="leader"></span>
          <span class="aloj-user">${warning}<span class="amount aloj-user${amountErrorCls}">${fmtEuro(alojamiento)}</span></span>
        </div>
      `);
    }

    if (kmImporte > 0) {
      lineas.push(`
        <div class="calc-line">
          <span class="label">Km: ${textoKm}</span>
          <span class="leader"></span>
          <span class="amount">${fmtEuro(kmImporte)}</span>
        </div>
      `);
    }

    if (otrosGastos > 0) {
      lineas.push(`
        <div class="calc-line">
          <span class="label">Total otros gastos</span>
          <span class="leader"></span>
          <span class="amount">${fmtEuro(otrosGastos)}</span>
        </div>
      `);
    }

    lineas.push(`
      <div class="calc-total">
        <span class="label">Total:</span>
        <span class="amount calc-total-amount">${fmtEuro(total)}</span>
      </div>
    `);

    if (sujetoIrpf > 0) {
      lineas.push(`
        <div class="calc-irpf">
          <span class="label">Sujeto a retención por IRPF:</span>
          <span class="amount">${fmtEuro(sujetoIrpf)}</span>
        </div>
      `);
    }

    resultEl.innerHTML = lineas.join('');
    resultEl.style.display = '';
  }

  function validarOrdenFechaHora() {
    const fechaIdaEl = byId('aecc-fecha-ida');
    const horaIdaEl = byId('aecc-hora-ida');
    const fechaRegEl = byId('aecc-fecha-regreso');
    const horaRegEl = byId('aecc-hora-regreso');

    if (!fechaIdaEl || !horaIdaEl || !fechaRegEl || !horaRegEl) return true;

    const campos = [fechaIdaEl, horaIdaEl, fechaRegEl, horaRegEl];

    const fIda = parseDateStrict(fechaIdaEl.value || '');
    const hIda = parseTimeStrict(horaIdaEl.value || '');
    const fReg = parseDateStrict(fechaRegEl.value || '');
    const hReg = parseTimeStrict(horaRegEl.value || '');

    const hayAlgunoRelleno = campos.some((c) => String(c.value || '').trim() !== '');

    if (!hayAlgunoRelleno) {
      campos.forEach(c => c.classList.remove('field-error'));
      return true;
    }

    if (!fIda || !hIda || !fReg || !hReg) {
      campos.forEach(c => c.classList.remove('field-error'));
      return false;
    }

    const dtIda = new Date(fIda.getFullYear(), fIda.getMonth(), fIda.getDate(), hIda.hh, hIda.mm, 0, 0);
    const dtReg = new Date(fReg.getFullYear(), fReg.getMonth(), fReg.getDate(), hReg.hh, hReg.mm, 0, 0);

    const ok = dtReg > dtIda;
    if (ok) {
      campos.forEach(c => c.classList.remove('field-error'));
      return true;
    }

    campos.forEach(c => c.classList.add('field-error'));
    return false;
  }

  function attachDateTimeValidation() {
    const watchedIds = ['aecc-fecha-ida', 'aecc-hora-ida', 'aecc-fecha-regreso', 'aecc-hora-regreso'];
    watchedIds.forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener('blur', () => {
        validarOrdenFechaHora();
        actualizarVisibilidadManutencion();
        actualizarVisibilidadJustificarPernoctaAecc();
        aplicarReglaNoPernoctaEnManutencionUltimoDia();
        renderResultado();
      });
      el.addEventListener('change', () => {
        validarOrdenFechaHora();
        actualizarVisibilidadManutencion();
        actualizarVisibilidadJustificarPernoctaAecc();
        aplicarReglaNoPernoctaEnManutencionUltimoDia();
        renderResultado();
      });
    });
  }

  function attachResultWatchers() {
    const watchedIdsImmediate = [
      'aecc-manut-primer-dia',
      'aecc-manut-ultimo-dia'
    ];

    watchedIdsImmediate.forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener('change', renderResultado);
      el.addEventListener('blur', renderResultado);
    });

    const paisDestinoEl = byId('aecc-pais-destino');
    if (paisDestinoEl) {
      const onPaisChange = () => {
        actualizarVisibilidadAltaOcupacion();
        renderResultado();
      };
      paisDestinoEl.addEventListener('change', onPaisChange);
      paisDestinoEl.addEventListener('blur', onPaisChange);
    }

    const watchedIdsBlurOnly = ['aecc-km', 'aecc-alojamiento'];
    watchedIdsBlurOnly.forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.addEventListener('blur', renderResultado);
    });

    const altaOcupacionEl = byId('aecc-destino-alta-ocupacion');
    if (altaOcupacionEl) {
      altaOcupacionEl.addEventListener('change', renderResultado);
    }

    const noManutencionEl = byId('aecc-no-manutencion');
    if (noManutencionEl) {
      noManutencionEl.addEventListener('change', renderResultado);
    }

    const justificarPernoctaEl = byId('aecc-justificar-pernocta');
    if (justificarPernoctaEl) {
      justificarPernoctaEl.addEventListener('change', () => {
        aplicarReglaNoPernoctaEnManutencionUltimoDia();
        renderResultado();
      });
    }

    const otrosWrapper = byId('aecc-otros-gastos-wrapper');
    if (otrosWrapper) {
      otrosWrapper.addEventListener('click', (e) => {
        const targetAdd = e.target.closest && e.target.closest('#aecc-btn-otros-gastos');
        if (targetAdd) {
          const nueva = crearLineaOtroGastoAecc();
          if (nueva) {
            const inp = nueva.querySelector('.otros-gasto-desc');
            if (inp) setTimeout(() => inp.focus(), 80);
          }
          return;
        }

        const targetRemove = e.target.closest && e.target.closest('.btn-remove-otros-gasto');
        if (targetRemove) {
          const line = targetRemove.closest('.otros-gasto-line');
          if (line && line.parentNode) {
            line.parentNode.removeChild(line);
          }
          actualizarVisibilidadBotonOtrosGastosAecc();
          renderResultado();
        }
      });

      otrosWrapper.addEventListener('blur', (e) => {
        const el = e.target;
        if (!el || !el.classList) return;
        if (el.classList.contains('otros-gasto-importe')) {
          renderResultado();
        }
      }, true);

      otrosWrapper.addEventListener('change', (e) => {
        const el = e.target;
        if (!el || !el.classList) return;
        if (el.classList.contains('otros-gasto-tipo') || el.classList.contains('otros-gasto-desc') || el.classList.contains('otros-gasto-importe')) {
          renderResultado();
        }
      });
    }
  }

  function init() {
    if (initialized) return;
    if (!byId('form-aecc-desplazamiento')) return;

    if (global.__sgtriDatos?.datosAECC) {
      setDatosAecc(global.__sgtriDatos.datosAECC);
    }
    if (global.__sgtriDatos?.limitesIRPF) {
      setLimitesIrpf(global.__sgtriDatos.limitesIRPF);
    }
    if (global.__sgtriDatos?.limites) {
      setLimites(global.__sgtriDatos.limites);
    }

    if (Array.isArray(global.__sgtriDatos?.dietasPorPais?.paises)) {
      setPaisesData(global.__sgtriDatos.dietasPorPais.paises);
    } else {
      poblarSelectPaises();
    }

    attachDateTimeValidation();
    attachResultWatchers();
    actualizarVisibilidadAltaOcupacion();
    actualizarVisibilidadJustificarPernoctaAecc();
    actualizarVisibilidadManutencion();
    renderResultado();
    initialized = true;
  }

  function reset() {
    const ids = [
      'aecc-fecha-ida',
      'aecc-hora-ida',
      'aecc-fecha-regreso',
      'aecc-hora-regreso',
      'aecc-origen',
      'aecc-destino',
      'aecc-motivo',
      'aecc-manut-primer-dia',
      'aecc-manut-ultimo-dia',
      'aecc-km',
      'aecc-alojamiento'
    ];

    ids.forEach((id) => {
      const el = byId(id);
      if (el) el.value = '';
    });

    const altaOcupacionEl = byId('aecc-destino-alta-ocupacion');
    if (altaOcupacionEl) {
      altaOcupacionEl.checked = false;
    }

    const noManutencionEl = byId('aecc-no-manutencion');
    if (noManutencionEl) {
      noManutencionEl.checked = false;
    }

    const otrosGastosCont = getOtrosGastosContainerAecc();
    if (otrosGastosCont) {
      otrosGastosCont.innerHTML = '';
      otrosGastosCont.style.display = 'none';
    }
    actualizarVisibilidadBotonOtrosGastosAecc();

    const justificarPernoctaEl = byId('aecc-justificar-pernocta');
    if (justificarPernoctaEl) {
      justificarPernoctaEl.checked = false;
    }

    const selPrimer = byId('aecc-manut-primer-dia');
    const selUltimo = byId('aecc-manut-ultimo-dia');
    if (selPrimer) selPrimer.value = 'B+C+CN';
    if (selUltimo) selUltimo.value = 'B+C+CN';
    modoManutencion = 'none';
    condicionNoPernoctaActiva = false;
    actualizarVisibilidadManutencion();

    const selectPais = byId('aecc-pais-destino');
    if (selectPais) {
      if (Array.isArray(paisesData) && paisesData.indexOf('España') !== -1) {
        selectPais.value = 'España';
      } else if (selectPais.options.length > 0) {
        selectPais.selectedIndex = 0;
      }
    }

    actualizarVisibilidadAltaOcupacion();
    actualizarVisibilidadJustificarPernoctaAecc();

    ['aecc-fecha-ida', 'aecc-hora-ida', 'aecc-fecha-regreso', 'aecc-hora-regreso'].forEach((id) => {
      const el = byId(id);
      if (el) el.classList.remove('field-error');
    });

    const resultEl = byId('aecc-calc-result');
    if (resultEl) {
      resultEl.style.display = 'none';
      resultEl.innerHTML = '';
    }

    syncResultadoLiquidacionAecc({
      manutencion: 0,
      alojamiento: 0,
      kilometraje: 0,
      otrosGastos: 0,
      irpfSujeto: 0
    }, false);
  }

  function obtenerDatos() {
    const calculo = calcularDatosResultadoAecc();
    const otrosDetalle = Array.isArray(calculo.otrosGastosDetalle) ? calculo.otrosGastosDetalle : [];
    return {
      fechaIda: byId('aecc-fecha-ida')?.value || '',
      horaIda: byId('aecc-hora-ida')?.value || '',
      fechaRegreso: byId('aecc-fecha-regreso')?.value || '',
      horaRegreso: byId('aecc-hora-regreso')?.value || '',
      origen: byId('aecc-origen')?.value || '',
      destino: byId('aecc-destino')?.value || '',
      paisDestino: byId('aecc-pais-destino')?.value || '',
      destinoAltaOcupacion: !!byId('aecc-destino-alta-ocupacion')?.checked,
      justificaPernocta: !!byId('aecc-justificar-pernocta')?.checked,
      noManutencion: !!byId('aecc-no-manutencion')?.checked,
      motivo: byId('aecc-motivo')?.value || '',
      manutPrimerDia: byId('aecc-manut-primer-dia')?.value || 'B+C+CN',
      manutUltimoDia: byId('aecc-manut-ultimo-dia')?.value || 'B+C+CN',
      km: byId('aecc-km')?.value || '',
      alojamiento: byId('aecc-alojamiento')?.value || '',
      otrosGastos: otrosDetalle.map((g) => ({
        tipo: g.tipo || '',
        concepto: g.concepto || '',
        importe: g.importeRaw || (g.importe > 0 ? fmtEuro(g.importe) : '')
      })),
      otrosGastosTotal: calculo.otrosGastos,
      fechasValidas: validarOrdenFechaHora(),
      datosCalculados: {
        modoManutencion: calculo.modoManutencion,
        textoManutencion: calculo.textoManutencion,
        baseDiasManutencion: calculo.baseDias,
        importePrimerDiaManutencion: calculo.importePrimerDia,
        importeUltimoDiaManutencion: calculo.importeUltimoDia,
        manutencionDiaCompleto: calculo.manutencionDiaCompleto,
        manutencion: calculo.manutencion,
        kilometraje: calculo.kilometraje,
        precioKm: calculo.precioKm,
        textoKm: calculo.textoKm,
        alojamiento: calculo.alojamiento,
        pernoctaciones: calculo.pernoctaciones,
        maxAlojamientoPorPernoctacion: calculo.maxAlojamientoPorPernoctacion,
        maxAlojamiento: calculo.maxAlojamiento,
        excedeMaxAlojamiento: calculo.excedeMaxAlojamiento,
        noPernoctaMadrugada: calculo.noPernoctaMadrugada,
        otrosGastos: calculo.otrosGastos,
        irpfSujeto: calculo.irpfSujeto,
        total: calculo.total,
        irpfLimites: calculo.irpfLimites
      }
    };
  }

  function obtenerDatosSerializacion() {
    const datos = obtenerDatos();
    return {
      ...datos,
      tieneContenido: hasContenidoAecc(datos)
    };
  }

  function restaurarDatos(datos) {
    const src = datos || {};
    reset();

    establecerValorCampoInterno('aecc-fecha-ida', src.fechaIda);
    establecerValorCampoInterno('aecc-hora-ida', src.horaIda);
    establecerValorCampoInterno('aecc-fecha-regreso', src.fechaRegreso);
    establecerValorCampoInterno('aecc-hora-regreso', src.horaRegreso);
    establecerValorCampoInterno('aecc-origen', src.origen);
    establecerValorCampoInterno('aecc-destino', src.destino);
    establecerValorCampoInterno('aecc-motivo', src.motivo);
    establecerValorCampoInterno('aecc-km', src.km);
    establecerValorCampoInterno('aecc-alojamiento', src.alojamiento);

    const paisEl = byId('aecc-pais-destino');
    if (paisEl && src.paisDestino) {
      paisEl.value = src.paisDestino;
    }

    const altaEl = byId('aecc-destino-alta-ocupacion');
    if (altaEl) altaEl.checked = !!src.destinoAltaOcupacion;

    const justificarEl = byId('aecc-justificar-pernocta');
    if (justificarEl) {
      // Compatibilidad con archivos anteriores
      justificarEl.checked = !!(src.justificaPernocta || src.justificarPernoctaMadrugada);
    }

    const noManutEl = byId('aecc-no-manutencion');
    if (noManutEl) noManutEl.checked = !!src.noManutencion;

    actualizarVisibilidadAltaOcupacion();
    actualizarVisibilidadJustificarPernoctaAecc();
    actualizarVisibilidadManutencion();

    const primerSel = byId('aecc-manut-primer-dia');
    if (primerSel && src.manutPrimerDia) {
      primerSel.value = src.manutPrimerDia;
    }

    const ultimoSel = byId('aecc-manut-ultimo-dia');
    if (ultimoSel && src.manutUltimoDia) {
      ultimoSel.value = src.manutUltimoDia;
    }

    const otrosCont = getOtrosGastosContainerAecc();
    if (otrosCont) {
      otrosCont.innerHTML = '';
    }
    const otros = Array.isArray(src.otrosGastos) ? src.otrosGastos : [];
    otros.forEach((gasto) => {
      const linea = crearLineaOtroGastoAecc();
      if (!linea) return;
      const tipoEl = linea.querySelector('.otros-gasto-tipo');
      const conceptoEl = linea.querySelector('.otros-gasto-desc');
      const importeEl = linea.querySelector('.otros-gasto-importe');

      if (tipoEl) tipoEl.value = gasto.tipo || '';
      if (conceptoEl) conceptoEl.value = gasto.concepto || gasto.descripcion || '';
      if (importeEl) importeEl.value = gasto.importe || '';
    });

    actualizarVisibilidadBotonOtrosGastosAecc();
    validarOrdenFechaHora();
    renderResultado();
  }

  function establecerValorCampoInterno(id, valor) {
    const el = byId(id);
    if (!el) return;
    el.value = valor ?? '';
  }

  global.uiDesplazamientoAecc = {
    init,
    setPaisesData,
    setDatosAecc,
    setLimites,
    setLimitesIrpf,
    validarOrdenFechaHora,
    renderResultado,
    reset,
    obtenerDatos,
    obtenerDatosSerializacion,
    restaurarDatos
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
