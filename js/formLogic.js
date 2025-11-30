/**
 * formLogic.js
 * =============
 * Orquestador principal del formulario de liquidación de desplazamientos.
 * Coordina la inicialización de módulos y gestiona eventos globales.
 *
 * @module formLogic
 * @requires limpiaDatos
 * @requires validaciones
 * @requires confirmDialog
 * @requires uiPagos
 * @requires uiDesplazamientos
 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // =========================================================================
  // REFERENCIAS DOM PRINCIPALES
  // =========================================================================

  const categoriaSelect = document.getElementById('categoria');
  const tipoPagoSelect = document.getElementById('tipo-pago');
  const tipoProyecto = document.getElementById('tipoProyecto');
  const infoDecreto = document.getElementById('infoDecreto');

  // =========================================================================
  // MÓDULOS - Referencias locales
  // =========================================================================

  const ld = window.limpiaDatos || {};
  const val = window.validaciones || {};
  const uiPagos = window.uiPagos || {};
  const uiDesp = window.uiDesplazamientos || {};
  const serializar = window.serializacionDatos || {};

  // =========================================================================
  // CARGA DE DATOS JSON
  // =========================================================================

  fetch('assets/data/datos.json')
    .then(response => {
      if (!response.ok) throw new Error('No se pudo cargar el JSON');
      return response.json();
    })
    .then(data => {
      // Exponer datos globalmente para otros módulos
      try { window.__sgtriDatos = data; } catch (e) { /* ignore */ }

      // 1️⃣ Rellenar "En calidad de"
      if (categoriaSelect && data.categorias) {
        data.categorias.forEach(([text, value], index) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = text;
          if (index === 0) option.selected = true;
          categoriaSelect.appendChild(option);
        });
      }

      // 2️⃣ Rellenar "Pago en"
      if (tipoPagoSelect && data.pagos) {
        data.pagos.forEach(([text, value], index) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = text;
          if (index === 0) option.selected = true;
          tipoPagoSelect.appendChild(option);
        });
      }

      // 3️⃣ Rellenar "Tipo de proyecto"
      if (tipoProyecto && data.tiposProyecto) {
        data.tiposProyecto.forEach(([text, value], index) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = text;
          if (index === 0) option.selected = true;
          tipoProyecto.appendChild(option);
        });
      }

      // 4️⃣ Texto informativo inicial
      actualizarTextoDecreto(tipoProyecto ? tipoProyecto.value : '');

      // 5️⃣ Listener para cambio de tipo de proyecto
      if (tipoProyecto) {
        tipoProyecto.addEventListener('change', () => {
          actualizarTextoDecreto(tipoProyecto.value);
          // Recalcular todas las fichas
          try {
            document.querySelectorAll('.desplazamiento-grupo').forEach(g => {
              const id = g.dataset && g.dataset.desplazamientoId;
              if (id && window.calculoDesp && typeof window.calculoDesp.calculaDesplazamientoFicha === 'function') {
                window.calculoDesp.calculaDesplazamientoFicha(g);
              }
            });
          } catch (e) { /* ignore */ }
          // Actualizar ticket cena
          if (uiDesp.actualizarTicketCena) uiDesp.actualizarTicketCena();
        });
      }

      // 6️⃣ Países: configurar datos y poblar select inicial
      const paisesData = (data.dietasPorPais && data.dietasPorPais.paises) ? data.dietasPorPais.paises : [];
      if (uiDesp.setPaisesData) uiDesp.setPaisesData(paisesData);

      const primerSelectPais = document.getElementById('pais-destino-1');
      if (primerSelectPais && paisesData.length > 0) {
        if (uiDesp.poblarSelectPaises) uiDesp.poblarSelectPaises(primerSelectPais);
        primerSelectPais.addEventListener('change', () => {
          if (uiDesp.manejarCambioPais) uiDesp.manejarCambioPais(1);
        });
      }

      // =========================================================================
      // INICIALIZACIÓN DE MÓDULOS
      // =========================================================================

      // Inicializar UI de pagos
      if (uiPagos.init) uiPagos.init();

      // Inicializar módulo de serialización con la versión del esquema
      if (serializar.inicializar && data.versionEsquema) {
        serializar.inicializar(data.versionEsquema);
      }

      // Inicializar UI de desplazamientos
      if (uiDesp.init) {
        uiDesp.init({
          onPaisChanged: () => {
            computeDescuentoManutencion();
          }
        });
      }

      // Inicializar UI de ajustes
      const uiAjustes = window.uiAjustes || {};
      if (uiAjustes.init) {
        uiAjustes.init();
      }

      // Actualizar ticket cena inicial
      if (uiDesp.actualizarTicketCena) uiDesp.actualizarTicketCena();

      // Configurar botones de guardar/cargar
      const btnGuardar = document.getElementById('btn-guardar-datos');
      const btnCargar = document.getElementById('btn-cargar-datos');

      if (btnGuardar && serializar.exportarArchivo) {
        btnGuardar.addEventListener('click', () => {
          serializar.exportarArchivo();
        });
      }

      if (btnCargar && serializar.abrirDialogoImportar) {
        btnCargar.addEventListener('click', () => {
          serializar.abrirDialogoImportar();
        });
      }
    })
    .catch(error => console.error('Error cargando datos del JSON:', error));

  // =========================================================================
  // TEXTO INFORMATIVO DEL DECRETO
  // =========================================================================

  /**
   * Actualiza el texto informativo según el tipo de proyecto.
   * @param {string} valor - Valor del tipo de proyecto
   */
  function actualizarTextoDecreto(valor) {
    if (!infoDecreto) return;

    if (['G24', 'PEI', 'NAL'].includes(valor)) {
      infoDecreto.innerHTML = `
        Los cálculos se efectuarán en base al 
        RD 462/2002 (Gobierno de España).  
        <a href="https://www.boe.es/buscar/act.php?id=BOE-A-2002-10337"
           target="_blank" rel="noopener noreferrer">
           Ver Real Decreto
        </a>
      `;
    } else if (valor) {
      infoDecreto.innerHTML = `
        Los cálculos se efectuarán en base al 
        Decreto 42/2025 (Junta de Extremadura).  
        <a href="https://doe.juntaex.es/otrosFormatos/html.php?xml=2025040078&anio=2025&doe=1010o"
           target="_blank" rel="noopener noreferrer">
           Ver Decreto
        </a>
      `;
    } else {
      infoDecreto.textContent = '';
    }
  }

  // =========================================================================
  // DESCUENTO POR COMIDAS EN CONGRESO
  // =========================================================================

  /**
   * Calcula el descuento por comidas incluidas en inscripción de congreso.
   */
  function computeDescuentoManutencion() {
    try {
      const numEl = document.getElementById('evento-num-comidas');
      const hidden = document.getElementById('descuento-manut-congreso');
      const msg = document.getElementById('descuento-manut-message');
      const msgAmount = document.getElementById('descuento-manut-amount');

      if (!numEl || !hidden) return;

      const n = Number(numEl.value) || 0;
      if (n <= 0) {
        hidden.value = '0.00';
        if (msg) msg.style.display = 'none';
        if (msgAmount) msgAmount.textContent = '0,00 €';
        return;
      }

      const desplazamientos = Array.from(document.querySelectorAll('.desplazamiento-grupo'));
      if (desplazamientos.length === 0) {
        hidden.value = '0.00';
        if (msg) msg.style.display = '';
        if (msgAmount) msgAmount.textContent = '0,00 €';
        return;
      }

      let paisIndex = 0;
      if (desplazamientos.length === 1) {
        const paisSelect = desplazamientos[0].querySelector('select[id^="pais-destino"]');
        if (paisSelect) paisIndex = paisSelect.selectedIndex >= 0 ? paisSelect.selectedIndex : 0;
      } else {
        const eventoSelect = document.getElementById('evento-asociado');
        if (!eventoSelect) { 
          hidden.value = '0.00'; 
          if (msg) msg.style.display = '';
          if (msgAmount) msgAmount.textContent = '0,00 €';
          return; 
        }
        const valSel = eventoSelect.value || '';
        const m = valSel.match(/^desp(\d+)$/);
        if (!m) { 
          hidden.value = '0.00'; 
          if (msg) msg.style.display = '';
          if (msgAmount) msgAmount.textContent = '0,00 €';
          return; 
        }
        const idx = parseInt(m[1], 10) - 1;
        const target = desplazamientos[idx];
        if (!target) { 
          hidden.value = '0.00'; 
          if (msg) msg.style.display = '';
          if (msgAmount) msgAmount.textContent = '0,00 €';
          return; 
        }
        const paisSelect = target.querySelector('select[id^="pais-destino"]');
        if (paisSelect) paisIndex = paisSelect.selectedIndex >= 0 ? paisSelect.selectedIndex : 0;
      }

      // Obtener precio de manutención según normativa y país
      const tipoProj = (document.getElementById('tipoProyecto') || {}).value || '';
      const datos = window.__sgtriDatos;
      
      if (!datos || !datos.dietasPorPais) {
        hidden.value = '0.00';
        if (msg) msg.style.display = '';
        if (msgAmount) msgAmount.textContent = '0,00 €';
        return;
      }

      // Determinar normativa
      const rdList = datos.normativasPorTipoProyecto?.rd || [];
      const normativa = rdList.includes(tipoProj) ? 'rd' : 'decreto';
      
      // Obtener tabla de precios según normativa
      const tablas = normativa === 'rd'
        ? datos.dietasPorPais.rd462_2002
        : datos.dietasPorPais.decreto42_2025;
      
      if (!tablas || !tablas.manutencion) {
        hidden.value = '0.00';
        if (msg) msg.style.display = '';
        if (msgAmount) msgAmount.textContent = '0,00 €';
        return;
      }

      // Obtener precio de manutención para el país
      const precio = Number(tablas.manutencion[paisIndex]) || 50.55;
      const descuento = Math.round((precio * 0.5 * n + Number.EPSILON) * 100) / 100;
      hidden.value = descuento.toFixed(2);
      
      // Mostrar mensaje siempre que n > 0 (ya verificado arriba)
      const txt = descuento.toFixed(2).replace('.', ',') + ' €';
      if (msgAmount) msgAmount.textContent = txt;
      if (msg) msg.style.display = '';
    } catch (e) { 
      console.warn('[computeDescuentoManutencion] Error:', e);
    }
  }

  // Exponer globalmente para otros módulos
  window.computeDescuentoManutencion = computeDescuentoManutencion;

  /**
   * Recalcula todos los desplazamientos (para actualizar IRPF tras cambio en congreso).
   */
  function recalcularTodosDesplazamientos() {
    if (!window.calculoDesp || typeof window.calculoDesp.calculaDesplazamientoFicha !== 'function') return;
    
    const desplazamientos = document.querySelectorAll('.desplazamiento-grupo');
    desplazamientos.forEach(desp => {
      try {
        window.calculoDesp.calculaDesplazamientoFicha(desp);
      } catch (e) { /* ignore */ }
    });
  }

  // Listeners para campos de congreso
  const eventoNumEl = document.getElementById('evento-num-comidas');
  if (eventoNumEl) {
    eventoNumEl.addEventListener('input', () => {
      computeDescuentoManutencion();
      recalcularTodosDesplazamientos();
    });
    eventoNumEl.addEventListener('change', () => {
      computeDescuentoManutencion();
      recalcularTodosDesplazamientos();
    });
  }

  const eventoSel = document.getElementById('evento-asociado');
  if (eventoSel) {
    eventoSel.addEventListener('change', () => {
      computeDescuentoManutencion();
      recalcularTodosDesplazamientos();
    });
  }

  // Listener para tipo de proyecto (afecta precio de manutención)
  if (tipoProyecto) {
    tipoProyecto.addEventListener('change', computeDescuentoManutencion);
    tipoProyecto.addEventListener('input', computeDescuentoManutencion);
  }

  // Cálculo inicial
  try { computeDescuentoManutencion(); } catch (e) { /* ignore */ }

  // =========================================================================
  // DELEGACIÓN GLOBAL DE EVENTOS DE INPUT
  // =========================================================================

  /**
   * Handler delegado para sanitización de inputs en tiempo real.
   */
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || el.tagName !== 'INPUT') return;

    const applyWithCaret = ld.applyWithCaretPreserved || ((inp, fn) => { inp.value = fn(inp.value); });

    // Nombre beneficiario
    if (el.id === 'nombre-benef') {
      const v = ld.sanitizeGeneralText ? ld.sanitizeGeneralText(el.value, 70) : el.value;
      if (v !== el.value) el.value = v;
      return;
    }

    // Entidad contratante
    if (el.id === 'entidad') {
      const v = ld.sanitizeGeneralText ? ld.sanitizeGeneralText(el.value, 50) : el.value;
      if (v !== el.value) el.value = v;
      return;
    }

    // DNI
    if (el.id === 'dni') {
      if (ld.sanitizeDNI) applyWithCaret(el, (v) => ld.sanitizeDNI(v, 20));
      return;
    }

    // IBAN
    if (el.id === 'iban' || el.id === 'iban-ext' || el.classList.contains('iban')) {
      applyWithCaret(el, (valIban, selStart) => {
        const v = valIban || '';
        const attrMax = parseInt(el.getAttribute('data-raw-max')) || parseInt(el.getAttribute('maxlength')) || 34;
        if (selStart > 0 && v[selStart - 1] === ' ') {
          const cleaned = v.replace(/[^A-Za-z0-9 ]/g, '').toUpperCase();
          const onlyAlnum = cleaned.replace(/[^A-Za-z0-9]/g, '');
          const limitedAlnum = onlyAlnum.slice(0, attrMax);
          if (onlyAlnum.length <= attrMax) return cleaned.toUpperCase();
          let result = '';
          let taken = 0;
          for (let ch of cleaned) {
            if (/[A-Za-z0-9]/.test(ch)) {
              if (taken < limitedAlnum.length) { result += ch; taken++; } else break;
            } else {
              result += ch;
            }
          }
          return result.toUpperCase();
        }
        const raw = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, attrMax);
        const parts = raw.match(/.{1,4}/g) || [];
        return parts.join(' ').toUpperCase();
      });
      return;
    }

    // SWIFT/BIC
    if (el.id === 'swift' || el.classList.contains('swift')) {
      applyWithCaret(el, (valSwift) => {
        return String(valSwift || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 11);
      });
      return;
    }

    // Número de tarjeta
    if (el.id === 'numero-tarjeta' || el.classList.contains('card-number')) {
      if (ld.processGroupedInput) {
        ld.processGroupedInput(el, { groupSize: 4, sep: ' ', maxRawLen: 19, validPattern: '\\d' });
      }
      return;
    }

    // Responsables
    if (el.classList.contains('responsable') || /^responsable-/.test(el.name || '')) {
      const v = ld.sanitizeGeneralText ? ld.sanitizeGeneralText(el.value, 70) : el.value;
      if (v !== el.value) el.value = v;
      return;
    }

    // Campos de texto general
    if (el.classList.contains('general-text')) {
      if (ld.sanitizeGeneralText) applyWithCaret(el, (v) => ld.sanitizeGeneralText(v, 90));
      return;
    }

    // Orgánica
    if (el.classList.contains('organica') || el.id === 'organica' || /^organica-/.test(el.id || '')) {
      applyWithCaret(el, (valOrg, selStart) => {
        const v = valOrg || '';
        if (selStart > 0 && v[selStart - 1] === '.') {
          return v.replace(/[^A-Za-z0-9.]/g, '').toUpperCase().slice(0, 14);
        }
        const only = v.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase();
        const parts = only.match(/.{1,2}/g) || [];
        return parts.join('.');
      });
      return;
    }

    // Referencia proyecto
    if (el.classList.contains('referencia-proyecto') || /^referencia-/.test(el.name || '')) {
      if (ld.sanitizeReferencia) applyWithCaret(el, (v) => ld.sanitizeReferencia(v, 50));
      return;
    }

    // Fecha (live)
    if (el.classList.contains('input-fecha')) {
      applyWithCaret(el, (valFecha, selStart) => {
        const v = valFecha || '';
        const cleaned = v.replace(/[^0-9\/]/g, '');
        if (selStart > 0 && v[selStart - 1] === '/') {
          const single = cleaned.replace(/\/{2,}/g, '/').replace(/^\//, '');
          if (single.endsWith('/') && single.length > 1) {
            const parts = single.split('/');
            if (parts.length >= 2) {
              const prev = parts[parts.length - 2] || '';
              if (prev.length === 1) {
                parts[parts.length - 2] = prev.padStart(2, '0');
                return parts.join('/').slice(0, 8);
              }
            }
          }
          return single.slice(0, 8);
        }
        const digits = cleaned.replace(/[^0-9]/g, '');
        let out = '';
        if (digits.length <= 2) out = digits;
        else if (digits.length <= 4) out = digits.slice(0, 2) + '/' + digits.slice(2);
        else out = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 6);
        return out.slice(0, 8);
      });
      return;
    }

    // Hora (live)
    if (el.classList.contains('input-hora')) {
      applyWithCaret(el, (valHora) => {
        const v = valHora || '';
        const cleaned = v.replace(/[^0-9:]/g, '');
        const single = cleaned.replace(/:{2,}/g, ':').replace(/^:/, '');
        const digits = single.replace(/[^0-9]/g, '');
        if (digits.length <= 2) return digits.slice(0, 2);
        const hh = digits.slice(0, 2);
        const mm = digits.slice(2, 4);
        return (hh + ':' + mm).slice(0, 5);
      });
      return;
    }

    // Km
    if (el.classList.contains('format-km')) {
      applyWithCaret(el, (valKm) => {
        let s = (valKm || '').replace(/\./g, ',').replace(/[^0-9,]/g, '');
        const parts = s.split(',');
        if (parts.length > 2) s = parts[0] + ',' + parts.slice(1).join('');
        return s;
      });
      return;
    }

    // Alojamiento
    if (el.classList.contains('format-alojamiento')) {
      applyWithCaret(el, (valAloj) => {
        let s = (valAloj || '').replace(/\./g, ',').replace(/[^0-9,]/g, '');
        const parts = s.split(',');
        if (parts.length > 2) s = parts[0] + ',' + parts.slice(1).join('');
        return s;
      });
      return;
    }

    // Limit 2 digits
    if (el.classList.contains('limit-2digits')) {
      let v = String(el.value || '').replace(/[^0-9]/g, '');
      if (v.length > 2) v = v.slice(0, 2);
      el.value = v;
      return;
    }
  });

  // =========================================================================
  // DELEGACIÓN GLOBAL DE EVENTOS DE BLUR
  // =========================================================================

  document.addEventListener('blur', (e) => {
    const el = e.target;
    if (!el) return;

    // Fecha blur
    if (el.classList && el.classList.contains('input-fecha')) {
      if (val.handleFechaBlur) val.handleFechaBlur(e);
      return;
    }

    // Hora blur
    if (el.classList && el.classList.contains('input-hora')) {
      if (val.handleHoraBlur) val.handleHoraBlur(e);
      return;
    }

    // Km blur
    if (el.classList && el.classList.contains('format-km')) {
      const raw = (el.value || '').toString();
      if (!raw) { el.value = ''; return; }
      // Eliminar separadores de miles (puntos) y convertir coma decimal a punto
      let cleaned = raw.replace(/[^0-9,]/g, '').replace(/,/g, '.');
      if (!cleaned) { el.value = ''; return; }
      const num = parseFloat(cleaned);
      if (isNaN(num)) { el.value = ''; return; }
      const rounded = Math.round(num);
      el.value = Number(rounded).toLocaleString('de-DE') + ' km';
      return;
    }

    // Alojamiento blur
    if (el.classList && el.classList.contains('format-alojamiento')) {
      const raw = (el.value || '').toString();
      if (raw.trim() === '') { el.value = ''; return; }
      const cleaned = raw.replace(/[^0-9,\.]/g, '').replace(/,/g, '.');
      const num = parseFloat(cleaned || '0');
      if (isNaN(num)) { el.value = ''; return; }
      const parts = num.toFixed(2).split('.');
      parts[0] = Number(parts[0]).toLocaleString('de-DE');
      el.value = parts[0] + ',' + parts[1] + ' €';
      return;
    }

    // Limit 2 digits blur
    if (el.classList && el.classList.contains('limit-2digits')) {
      const min = (el.min !== undefined && el.min !== '') ? Number(el.min) : null;
      const max = (el.max !== undefined && el.max !== '') ? Number(el.max) : null;
      let v = el.value === '' ? '' : Number(el.value);
      if (v === '' || isNaN(v)) { el.value = ''; return; }
      if (min !== null && v < min) v = min;
      if (max !== null && v > max) v = max;
      el.value = String(v);
      return;
    }

    // Orgánica blur: validar formato (2-5 pares de 2 caracteres separados por puntos, empezando por "18.")
    if (el.id === 'organica') {
      const warnWrapper = document.querySelector('.organica-warn');
      const val = (el.value || '').trim();
      // Si está vacío o es solo "18.", no marcar error (el usuario lo completará)
      if (val === '' || val === '18.') {
        if (warnWrapper) warnWrapper.style.display = 'none';
        el.classList.remove('field-error');
        return;
      }
      // Regex: 2 a 5 pares de exactamente 2 caracteres alfanuméricos separados por puntos
      const regexOrganica = /^[A-Za-z0-9]{2}(\.[A-Za-z0-9]{2}){1,4}$/;
      const esValida = val.startsWith('18.') && regexOrganica.test(val);
      if (warnWrapper) {
        warnWrapper.style.display = esValida ? 'none' : 'inline-flex';
      }
      if (esValida) {
        el.classList.remove('field-error');
      } else {
        el.classList.add('field-error');
      }
      return;
    }
  }, true);

  // =========================================================================
  // DELEGACIÓN GLOBAL DE EVENTOS DE KEYDOWN
  // =========================================================================

  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (el && el.classList && el.classList.contains('input-hora')) {
      if (val.handleHoraKeydown) val.handleHoraKeydown(e);
    }
  });

  // =========================================================================
  // DELEGACIÓN GLOBAL DE EVENTOS DE FOCUSIN
  // =========================================================================

  document.addEventListener('focusin', (e) => {
    const el = e.target;

    // Km focusin
    if (el && el.classList && el.classList.contains('format-km')) {
      const v = (el.value || '').toString().trim();
      if (v.endsWith(' km')) {
        const core = v.slice(0, -3).replace(/\./g, '');
        el.value = core;
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (err) { /* ignore */ }
      }
      return;
    }

    // Alojamiento focusin
    if (el && el.classList && el.classList.contains('format-alojamiento')) {
      const v = (el.value || '').toString().trim();
      let core = v.replace(/\s*€\s*$/, '').replace(/\./g, '').replace(/[^0-9,]/g, '');
      const parts = core.split(',');
      if (parts.length > 2) core = parts[0] + ',' + parts.slice(1).join('');
      if (core !== el.value) el.value = core;
      try { el.setSelectionRange(el.value.length, el.value.length); } catch (err) { /* ignore */ }
      return;
    }

    // Orgánica focusin: posicionar cursor al final
    if (el && el.id === 'organica') {
      setTimeout(() => {
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (err) { /* ignore */ }
      }, 0);
      return;
    }
  });

  // =========================================================================
  // WARN TOOLTIP HANDLERS
  // =========================================================================

  /**
   * Adjunta handlers a elementos warn-wrapper para tooltips.
   * @param {HTMLElement} wrapper
   */
  function attachWarnHandlers(wrapper) {
    if (!wrapper || wrapper.__warnAttached) return;
    wrapper.__warnAttached = true;
    const tooltipTextEl = wrapper.querySelector('.warn-tooltip');
    if (tooltipTextEl) tooltipTextEl.style.display = '';
  }

  // Adjuntar a warn-wrappers estáticos
  try {
    document.querySelectorAll('.warn-wrapper').forEach(w => {
      try { attachWarnHandlers(w); } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }

  // =========================================================================
  // COMPATIBILIDAD: Exponer parseNumber en formLogic
  // =========================================================================

  window.formLogic = window.formLogic || {};
  if (ld.parseNumber) {
    window.formLogic.parseNumber = ld.parseNumber;
  }

});
