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

      // 6️⃣ Países: configurar datos (el select inicial ya no existe, se pobla dinámicamente)
      const paisesData = (data.dietasPorPais && data.dietasPorPais.paises) ? data.dietasPorPais.paises : [];
      if (uiDesp.setPaisesData) uiDesp.setPaisesData(paisesData);

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
      // Revalidar fechas del evento al cambiar desplazamiento asociado
      if (typeof validarFechasEvento === 'function') {
        validarFechasEvento();
      }
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
          return v.replace(/[^A-Za-z0-9.]/g, '').toUpperCase().slice(0, 20);
        }
        const only = v.replace(/[^A-Za-z0-9]/g, '').slice(0, 14).toUpperCase();
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

    // Km (solo números enteros, sin decimales)
    if (el.classList.contains('format-km')) {
      applyWithCaret(el, (valKm) => {
        // Solo permitir dígitos (km es siempre entero)
        return (valKm || '').replace(/[^0-9]/g, '');
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
  // VALIDACIÓN DE FECHAS DE EVENTO (CONGRESO)
  // =========================================================================

  /**
   * Valida que las fechas del evento estén dentro del rango del desplazamiento asociado.
   */
  function validarFechasEvento() {
    const warnWrapper = document.querySelector('.evento-fechas-warn');
    const eventoDelEl = document.getElementById('evento-del');
    const eventoAlEl = document.getElementById('evento-al');
    const eventoDel = (eventoDelEl && eventoDelEl.value || '').trim();
    const eventoAl = (eventoAlEl && eventoAlEl.value || '').trim();

    // Si alguna fecha del evento está vacía, no validar
    if (eventoDel === '' || eventoAl === '') {
      if (warnWrapper) warnWrapper.style.display = 'none';
      if (eventoDelEl) eventoDelEl.classList.remove('field-error');
      if (eventoAlEl) eventoAlEl.classList.remove('field-error');
      return;
    }

    // Obtener todos los desplazamientos normales (no especiales)
    const desplazamientosNormales = document.querySelectorAll('.desplazamiento-grupo:not(.desplazamiento-especial)');
    const eventoAsociadoEl = document.getElementById('evento-asociado');
    let despId = null;

    // Si hay varios desplazamientos y el selector tiene valor, usar el seleccionado
    if (desplazamientosNormales.length > 1 && eventoAsociadoEl && eventoAsociadoEl.value) {
      const match = eventoAsociadoEl.value.match(/desp(\d+)/);
      if (match) {
        const idxNormal = parseInt(match[1], 10);
        if (desplazamientosNormales[idxNormal - 1]) {
          despId = desplazamientosNormales[idxNormal - 1].getAttribute('data-desplazamiento-id');
        }
      }
    }

    // Si solo hay un desplazamiento o no se pudo obtener el ID, usar el primero
    if (!despId && desplazamientosNormales.length > 0) {
      despId = desplazamientosNormales[0].getAttribute('data-desplazamiento-id');
    }

    // Si no hay desplazamientos, no validar
    if (!despId) {
      if (warnWrapper) warnWrapper.style.display = 'none';
      if (eventoDelEl) eventoDelEl.classList.remove('field-error');
      if (eventoAlEl) eventoAlEl.classList.remove('field-error');
      return;
    }

    // Obtener fechas del desplazamiento
    const fechaIdaEl = document.getElementById(`fecha-ida-${despId}`);
    const fechaRegresoEl = document.getElementById(`fecha-regreso-${despId}`);
    const fechaIda = (fechaIdaEl && fechaIdaEl.value || '').trim();
    const fechaRegreso = (fechaRegresoEl && fechaRegresoEl.value || '').trim();

    // Si las fechas del desplazamiento están vacías, no podemos validar
    if (fechaIda === '' || fechaRegreso === '') {
      if (warnWrapper) warnWrapper.style.display = 'none';
      if (eventoDelEl) eventoDelEl.classList.remove('field-error');
      if (eventoAlEl) eventoAlEl.classList.remove('field-error');
      return;
    }

    // Parsear fechas
    const parseDateStrict = (ld && ld.parseDateStrict) || ((v) => {
      const m = (v || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (!m) return null;
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      const date = new Date(y, mo, d);
      if (date.getDate() !== d || date.getMonth() !== mo) return null;
      return date;
    });

    const fEventoDel = parseDateStrict(eventoDel);
    const fEventoAl = parseDateStrict(eventoAl);
    const fIda = parseDateStrict(fechaIda);
    const fRegreso = parseDateStrict(fechaRegreso);

    // Si alguna fecha no se pudo parsear, no validar
    if (!fEventoDel || !fEventoAl || !fIda || !fRegreso) {
      if (warnWrapper) warnWrapper.style.display = 'none';
      if (eventoDelEl) eventoDelEl.classList.remove('field-error');
      if (eventoAlEl) eventoAlEl.classList.remove('field-error');
      return;
    }

    // Validar: evento debe empezar >= ida y terminar <= regreso
    const esValido = fEventoDel >= fIda && fEventoAl <= fRegreso;

    if (warnWrapper) {
      warnWrapper.style.display = esValido ? 'none' : 'inline-flex';
    }
    if (esValido) {
      if (eventoDelEl) eventoDelEl.classList.remove('field-error');
      if (eventoAlEl) eventoAlEl.classList.remove('field-error');
    } else {
      if (eventoDelEl) eventoDelEl.classList.add('field-error');
      if (eventoAlEl) eventoAlEl.classList.add('field-error');
    }
  }

  // =========================================================================
  // DELEGACIÓN GLOBAL DE EVENTOS DE BLUR
  // =========================================================================

  document.addEventListener('blur', (e) => {
    const el = e.target;
    if (!el) return;

    // Fecha blur
    if (el.classList && el.classList.contains('input-fecha')) {
      if (val.handleFechaBlur) val.handleFechaBlur(e);
      // Después del formateo, validar fechas del evento si corresponde
      if (el.id === 'evento-del' || el.id === 'evento-al') {
        validarFechasEvento();
      }
      return;
    }

    // Hora blur
    if (el.classList && el.classList.contains('input-hora')) {
      if (val.handleHoraBlur) val.handleHoraBlur(e);
      return;
    }

    // Km blur (formatear con separador de miles)
    if (el.classList && el.classList.contains('format-km')) {
      const raw = (el.value || '').toString();
      if (!raw) { el.value = ''; return; }
      // Solo dígitos
      const cleaned = raw.replace(/[^0-9]/g, '');
      if (!cleaned) { el.value = ''; return; }
      const num = parseInt(cleaned, 10);
      if (isNaN(num)) { el.value = ''; return; }
      el.value = num.toLocaleString('de-DE') + ' km';
      return;
    }

    // Alojamiento blur
    if (el.classList && el.classList.contains('format-alojamiento')) {
      const raw = (el.value || '').toString();
      if (raw.trim() === '') { el.value = ''; return; }
      const cleaned = raw.replace(/[^0-9,\.]/g, '').replace(/,/g, '.');
      const num = parseFloat(cleaned || '0');
      if (isNaN(num) || num === 0) { el.value = ''; return; }
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

    // Orgánica blur: validar formato (2-7 pares de 2 caracteres separados por puntos, empezando por "18.")
    if (el.id === 'organica') {
      const warnWrapper = document.querySelector('.organica-warn');
      let val = (el.value || '').trim();
      // Si está vacío o incompleto, restaurar a "18."
      if (val === '' || val === '18') {
        el.value = '18.';
        val = '18.';
      }
      // Si es solo "18.", no marcar error (el usuario lo completará)
      if (val === '18.') {
        if (warnWrapper) warnWrapper.style.display = 'none';
        el.classList.remove('field-error');
        return;
      }
      // Regex: 2 a 7 pares de exactamente 2 caracteres alfanuméricos separados por puntos
      const regexOrganica = /^[A-Za-z0-9]{2}(\.[A-Za-z0-9]{2}){1,6}$/;
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

    // Número de tarjeta blur: validar formato (16-19 dígitos, con Luhn para 16 dígitos)
    if (el.id === 'numero-tarjeta' || el.classList.contains('card-number')) {
      const warnWrapper = document.querySelector('.tarjeta-warn');
      const val = (el.value || '').replace(/\s/g, ''); // Eliminar espacios
      // Si está vacío, no marcar error
      if (val === '') {
        if (warnWrapper) warnWrapper.style.display = 'none';
        el.classList.remove('field-error');
        return;
      }
      // Validar: solo dígitos y longitud entre 16 y 19
      let esValida = /^\d{16,19}$/.test(val);
      // Si tiene exactamente 16 dígitos, aplicar algoritmo de Luhn
      if (esValida && val.length === 16) {
        let suma = 0;
        for (let i = 0; i < 16; i++) {
          let digito = parseInt(val[i], 10);
          // Duplicar cada segundo dígito desde la derecha (posiciones impares desde el final)
          if ((16 - i) % 2 === 0) {
            digito *= 2;
            if (digito > 9) digito -= 9;
          }
          suma += digito;
        }
        esValida = (suma % 10 === 0);
      }
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

    // IBAN español blur: validar formato (20 dígitos CCC o 24 caracteres IBAN)
    if (el.id === 'iban' || (el.classList.contains('iban') && el.id !== 'iban-ext')) {
      const warnWrapper = document.querySelector('.iban-warn');
      const val = (el.value || '').replace(/\s/g, '').toUpperCase(); // Eliminar espacios
      // Si está vacío, no marcar error
      if (val === '') {
        if (warnWrapper) warnWrapper.style.display = 'none';
        el.classList.remove('field-error');
        return;
      }

      /**
       * Calcula el dígito de control CCC usando módulo 11.
       * @param {string} digits - 10 dígitos a validar
       * @returns {number} Dígito de control (0-10, donde 10 se convierte en 0)
       */
      function calcularDigitoControlCCC(digits) {
        const pesos = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];
        let suma = 0;
        for (let i = 0; i < 10; i++) {
          suma += parseInt(digits[i], 10) * pesos[i];
        }
        const resto = suma % 11;
        const digito = 11 - resto;
        return digito === 11 ? 0 : (digito === 10 ? 0 : digito);
      }

      /**
       * Valida los dígitos de control del CCC (20 dígitos).
       * @param {string} ccc - 20 dígitos del CCC
       * @returns {boolean} true si es válido
       */
      function validarCCC(ccc) {
        if (!/^\d{20}$/.test(ccc)) return false;
        const entidad = ccc.substring(0, 4);
        const oficina = ccc.substring(4, 8);
        const dc1 = parseInt(ccc[8], 10);
        const dc2 = parseInt(ccc[9], 10);
        const cuenta = ccc.substring(10, 20);

        // Primer dígito de control: sobre "00" + entidad + oficina
        const dc1Calc = calcularDigitoControlCCC('00' + entidad + oficina);
        if (dc1 !== dc1Calc) return false;

        // Segundo dígito de control: sobre número de cuenta
        const dc2Calc = calcularDigitoControlCCC(cuenta);
        if (dc2 !== dc2Calc) return false;

        return true;
      }

      /**
       * Valida el IBAN español (ES + 2 dígitos + 20 dígitos CCC).
       * @param {string} iban - 24 caracteres del IBAN
       * @returns {boolean} true si es válido
       */
      function validarIBANEspanol(iban) {
        if (!/^ES\d{22}$/.test(iban)) return false;
        const ccc = iban.substring(4, 24);
        
        // Primero validar el CCC
        if (!validarCCC(ccc)) return false;

        // Validar dígitos de control del IBAN (módulo 97)
        // Mover los 4 primeros caracteres al final y convertir letras a números
        const reordenado = iban.substring(4) + iban.substring(0, 4);
        let numerico = '';
        for (const char of reordenado) {
          if (/\d/.test(char)) {
            numerico += char;
          } else {
            // A=10, B=11, ..., Z=35
            numerico += (char.charCodeAt(0) - 55).toString();
          }
        }
        // Calcular módulo 97 (en partes para evitar overflow)
        let resto = 0;
        for (let i = 0; i < numerico.length; i++) {
          resto = (resto * 10 + parseInt(numerico[i], 10)) % 97;
        }
        return resto === 1;
      }

      let esValida = false;
      if (val.length === 20) {
        // CCC de 20 dígitos
        esValida = validarCCC(val);
      } else if (val.length === 24) {
        // IBAN español de 24 caracteres
        esValida = validarIBANEspanol(val);
      }
      // Cualquier otra longitud es inválida

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

    // IBAN internacional blur: validar formato (módulo 97)
    if (el.id === 'iban-ext') {
      const warnWrapper = document.querySelector('.iban-ext-warn');
      const val = (el.value || '').replace(/\s/g, '').toUpperCase(); // Eliminar espacios
      // Si está vacío, no marcar error
      if (val === '') {
        if (warnWrapper) warnWrapper.style.display = 'none';
        el.classList.remove('field-error');
        return;
      }

      /**
       * Valida un IBAN internacional usando módulo 97 (ISO 13616).
       * @param {string} iban - IBAN sin espacios
       * @returns {boolean} true si es válido
       */
      function validarIBANInternacional(iban) {
        // Mínimo 15 caracteres, máximo 34
        if (iban.length < 15 || iban.length > 34) return false;
        // Los dos primeros deben ser letras (código país)
        if (!/^[A-Z]{2}/.test(iban)) return false;
        // Los siguientes dos deben ser dígitos (dígitos de control)
        if (!/^[A-Z]{2}\d{2}/.test(iban)) return false;
        // El resto debe ser alfanumérico
        if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;

        // Mover los 4 primeros caracteres al final y convertir letras a números
        const reordenado = iban.substring(4) + iban.substring(0, 4);
        let numerico = '';
        for (const char of reordenado) {
          if (/\d/.test(char)) {
            numerico += char;
          } else {
            // A=10, B=11, ..., Z=35
            numerico += (char.charCodeAt(0) - 55).toString();
          }
        }
        // Calcular módulo 97 (en partes para evitar overflow)
        let resto = 0;
        for (let i = 0; i < numerico.length; i++) {
          resto = (resto * 10 + parseInt(numerico[i], 10)) % 97;
        }
        return resto === 1;
      }

      const esValida = validarIBANInternacional(val);

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

    // SWIFT/BIC blur: validar formato (8 u 11 caracteres)
    if (el.id === 'swift' || el.classList.contains('swift')) {
      const warnWrapper = document.querySelector('.swift-warn');
      const val = (el.value || '').replace(/\s/g, '').toUpperCase(); // Eliminar espacios
      // Si está vacío, no marcar error
      if (val === '') {
        if (warnWrapper) warnWrapper.style.display = 'none';
        el.classList.remove('field-error');
        return;
      }

      /**
       * Valida el formato de un código SWIFT/BIC (ISO 9362).
       * @param {string} swift - Código SWIFT sin espacios
       * @returns {boolean} true si el formato es válido
       */
      function validarSWIFT(swift) {
        // Debe tener 8 u 11 caracteres
        if (swift.length !== 8 && swift.length !== 11) return false;
        // Posiciones 1-4: código del banco (4 letras)
        if (!/^[A-Z]{4}/.test(swift)) return false;
        // Posiciones 5-6: código del país (2 letras)
        if (!/^[A-Z]{4}[A-Z]{2}/.test(swift)) return false;
        // Posiciones 7-8: código de localización (2 alfanuméricos)
        if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}/.test(swift)) return false;
        // Posiciones 9-11 (opcional): código de sucursal (3 alfanuméricos)
        if (swift.length === 11) {
          if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}[A-Z0-9]{3}$/.test(swift)) return false;
        }
        return true;
      }

      const esValida = validarSWIFT(val);

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

    // DNI español blur: validar formato y letra de control
    if (el.id === 'dni') {
      const warnWrapper = document.querySelector('.dni-warn');
      let val = (el.value || '').trim().toUpperCase();
      // Si está vacío, no marcar error
      if (val === '') {
        if (warnWrapper) warnWrapper.style.display = 'none';
        el.classList.remove('field-error');
        return;
      }

      // Solo validar si empieza por número (DNI español)
      // Si empieza por letra, es pasaporte u otro documento, no validamos
      if (!/^\d/.test(val)) {
        if (warnWrapper) warnWrapper.style.display = 'none';
        el.classList.remove('field-error');
        return;
      }

      /**
       * Valida un DNI español.
       * @param {string} dni - DNI introducido
       * @returns {{valido: boolean, formateado: string}} Resultado de validación y DNI formateado
       */
      function validarDNIEspanol(dni) {
        // Extraer solo dígitos y la letra final
        const soloDigitos = dni.replace(/[^\d]/g, '');
        const letras = dni.replace(/[^A-Z]/g, '');
        
        // Debe tener al menos 1 dígito y exactamente 1 letra al final
        if (soloDigitos.length === 0 || soloDigitos.length > 8) {
          return { valido: false, formateado: dni };
        }
        if (letras.length !== 1) {
          return { valido: false, formateado: dni };
        }
        
        // La letra debe estar al final
        const letraUsuario = letras[0];
        const posLetra = dni.lastIndexOf(letraUsuario);
        const posUltimoDigito = dni.search(/\d[^\d]*$/);
        if (posLetra < posUltimoDigito) {
          return { valido: false, formateado: dni };
        }

        // Completar con ceros a la izquierda hasta 8 dígitos
        const numeroCompleto = soloDigitos.padStart(8, '0');
        
        // Tabla de letras de control
        const letrasControl = 'TRWAGMYFPDXBNJZSQVHLCKE';
        const resto = parseInt(numeroCompleto, 10) % 23;
        const letraCorrecta = letrasControl[resto];
        
        const formateado = numeroCompleto + letraCorrecta;
        return { 
          valido: letraUsuario === letraCorrecta, 
          formateado: formateado 
        };
      }

      const resultado = validarDNIEspanol(val);
      
      // Actualizar el campo con el DNI formateado (con ceros)
      if (resultado.valido) {
        el.value = resultado.formateado;
      }

      if (warnWrapper) {
        warnWrapper.style.display = resultado.valido ? 'none' : 'inline-flex';
      }
      if (resultado.valido) {
        el.classList.remove('field-error');
      } else {
        el.classList.add('field-error');
      }
      return;
    }

    // Handler genérico: quitar field-error si el campo tiene contenido
    if (el.classList && el.classList.contains('field-error')) {
      const valor = (el.value || '').trim();
      if (valor !== '' && valor !== '18.') {
        el.classList.remove('field-error');
      }
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

  // =========================================================================
  // MODAL DE MENSAJE
  // =========================================================================

  /**
   * Muestra un modal de mensaje con un botón Aceptar.
   * @param {string} mensaje - Texto a mostrar
   * @param {boolean} esError - true si es error, false si es éxito
   * @returns {Promise} Se resuelve cuando se cierra el modal
   */
  function mostrarMensaje(mensaje, esError = false) {
    return new Promise((resolve) => {
      // Crear overlay si no existe
      let overlay = document.querySelector('.message-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'message-overlay';
        overlay.innerHTML = `
          <div class="message-dialog">
            <div class="message-icon"></div>
            <div class="message-body"></div>
            <div class="message-actions">
              <button type="button" class="btn-message-ok">Aceptar</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      }

      const dialog = overlay.querySelector('.message-dialog');
      const iconEl = overlay.querySelector('.message-icon');
      const bodyEl = overlay.querySelector('.message-body');
      const btnOk = overlay.querySelector('.btn-message-ok');

      // Configurar contenido
      dialog.className = 'message-dialog ' + (esError ? 'message-error' : 'message-success');
      iconEl.textContent = esError ? '⚠️' : '✅';
      bodyEl.textContent = mensaje;

      // Mostrar
      overlay.classList.add('visible');
      btnOk.focus();

      // Handler de cierre
      const cerrar = () => {
        overlay.classList.remove('visible');
        btnOk.removeEventListener('click', cerrar);
        overlay.removeEventListener('click', cerrarOverlay);
        document.removeEventListener('keydown', cerrarEsc);
        resolve();
      };

      const cerrarOverlay = (e) => {
        if (e.target === overlay) cerrar();
      };

      const cerrarEsc = (e) => {
        if (e.key === 'Escape') cerrar();
      };

      btnOk.addEventListener('click', cerrar);
      overlay.addEventListener('click', cerrarOverlay);
      document.addEventListener('keydown', cerrarEsc);
    });
  }

  // =========================================================================
  // COMPROBACIÓN DE DATOS OBLIGATORIOS
  // =========================================================================

  /**
   * Expande una sección si está plegada.
   * @param {HTMLElement} section - Elemento .form-section
   */
  function expandirSeccion(section) {
    if (!section) return;
    const toggle = section.querySelector('.toggle-section');
    const wrapper = section.querySelector('.section-content-wrapper');
    if (toggle && !toggle.classList.contains('open')) {
      toggle.classList.add('open');
      if (wrapper) {
        wrapper.style.maxHeight = wrapper.scrollHeight + 'px';
        wrapper.style.opacity = '1';
      }
    }
  }

  /**
   * Marca un campo como error y expande su sección.
   * @param {HTMLElement} campo - Elemento input/select/textarea
   * @returns {boolean} true si se marcó error
   */
  function marcarCampoError(campo) {
    if (!campo) return false;
    const valor = (campo.value || '').trim();
    if (valor === '' || valor === '18.') {
      campo.classList.add('field-error');
      const seccion = campo.closest('.form-section');
      if (seccion) expandirSeccion(seccion);
      return true;
    }
    return false;
  }

  /**
   * Comprueba todos los datos obligatorios del formulario.
   */
  function comprobarDatosObligatorios() {
    let hayErrores = false;

    // ---- SECCIÓN 1: Datos del beneficiario ----
    const camposBeneficiario = ['nombre-benef', 'dni', 'entidad', 'categoria', 'tipo-pago'];
    camposBeneficiario.forEach(id => {
      const campo = document.getElementById(id);
      if (marcarCampoError(campo)) hayErrores = true;
    });

    // Campos de pago según tipo seleccionado
    const tipoPago = document.getElementById('tipo-pago');
    if (tipoPago) {
      const tipo = tipoPago.value;
      if (tipo === 'CE' || tipo === 'CuentaEsp' || tipo === 'Cuenta Española') {
        const iban = document.getElementById('iban');
        if (marcarCampoError(iban)) hayErrores = true;
      } else if (tipo === 'CI' || tipo === 'CuentaExtranjera' || tipo === 'Cuenta Extranjera') {
        const ibanExt = document.getElementById('iban-ext');
        const swift = document.getElementById('swift');
        if (marcarCampoError(ibanExt)) hayErrores = true;
        if (marcarCampoError(swift)) hayErrores = true;
      } else if (tipo === 'TJ' || tipo === 'TarjetaUEx' || tipo === 'Tarjeta UEx') {
        const tarjeta = document.getElementById('numero-tarjeta');
        if (marcarCampoError(tarjeta)) hayErrores = true;
      }
    }

    // ---- SECCIÓN 2: Datos del proyecto ----
    const camposProyecto = ['tipoProyecto', 'responsable', 'organica', 'referencia'];
    camposProyecto.forEach(id => {
      const campo = document.getElementById(id);
      if (marcarCampoError(campo)) hayErrores = true;
    });

    // ---- SECCIÓN 3: Desplazamientos ----
    const desplazamientosNormales = document.querySelectorAll('.desplazamiento-grupo:not(.desplazamiento-especial)');
    let hayKilometraje = false;

    desplazamientosNormales.forEach(desp => {
      const id = desp.getAttribute('data-desplazamiento-id');
      
      // Campos obligatorios de cada desplazamiento
      const camposDesp = [
        `fecha-ida-${id}`, `hora-ida-${id}`,
        `fecha-regreso-${id}`, `hora-regreso-${id}`,
        `origen-${id}`, `destino-${id}`,
        `pais-destino-${id}`, `motivo-${id}`
      ];
      
      camposDesp.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (marcarCampoError(campo)) hayErrores = true;
      });

      // Verificar si el país es diferente de España
      const paisDestino = document.getElementById(`pais-destino-${id}`);
      if (paisDestino && paisDestino.value && paisDestino.value !== 'España' && paisDestino.value !== 'ES') {
        const cruceIda = document.getElementById(`cruce-ida-${id}`);
        const cruceVuelta = document.getElementById(`cruce-vuelta-${id}`);
        if (marcarCampoError(cruceIda)) hayErrores = true;
        if (marcarCampoError(cruceVuelta)) hayErrores = true;
      }

      // Verificar kilometraje
      const kmField = document.getElementById(`km-${id}`);
      if (kmField) {
        const kmVal = (kmField.value || '').replace(/[^0-9]/g, '');
        if (kmVal && parseInt(kmVal, 10) > 0) {
          hayKilometraje = true;
        }
      }
    });

    // Si hay kilometraje, los datos del vehículo son obligatorios
    if (hayKilometraje) {
      const vehiculoContainer = document.getElementById('vehiculo-particular-container');
      if (vehiculoContainer && vehiculoContainer.innerHTML.trim() !== '') {
        const camposVehiculo = ['veh-marca', 'veh-modelo', 'veh-matricula'];
        camposVehiculo.forEach(id => {
          const campo = document.getElementById(id);
          if (marcarCampoError(campo)) hayErrores = true;
        });
      }
    }

    // ---- SECCIÓN 4: Asistencia a congresos ----
    const eventGastos = document.getElementById('evento-gastos');
    if (eventGastos) {
      const gastosVal = (eventGastos.value || '').replace(/[^0-9,\.]/g, '').replace(',', '.');
      const gastosNum = parseFloat(gastosVal) || 0;
      if (gastosNum > 0) {
        const camposCongreso = ['evento-nombre', 'evento-lugar', 'evento-del', 'evento-al'];
        camposCongreso.forEach(id => {
          const campo = document.getElementById(id);
          if (marcarCampoError(campo)) hayErrores = true;
        });
      }
    }

    // ---- SECCIÓN 5: Honorarios ----
    const honorariosImporte = document.getElementById('honorarios-importe');
    if (honorariosImporte) {
      const importeVal = (honorariosImporte.value || '').replace(/[^0-9,\.]/g, '').replace(',', '.');
      const importeNum = parseFloat(importeVal) || 0;
      if (importeNum > 0) {
        const camposHonorarios = ['honorarios-importe', 'honorarios-beneficiario', 'honorarios-situacion', 'honorarios-concepto'];
        camposHonorarios.forEach(id => {
          const campo = document.getElementById(id);
          if (marcarCampoError(campo)) hayErrores = true;
        });
      }
    }

    // ---- SECCIÓN 7: Imputación ----
    const lineasImputacion = document.querySelectorAll('#imputacion-container .imputacion-linea');
    lineasImputacion.forEach(linea => {
      const organicaInput = linea.querySelector('.imputacion-organica');
      const responsableInput = linea.querySelector('.imputacion-responsable');
      if (marcarCampoError(organicaInput)) hayErrores = true;
      if (marcarCampoError(responsableInput)) hayErrores = true;
    });

    // Mostrar mensaje
    if (hayErrores) {
      mostrarMensaje('¡Atención! Hay algunos datos obligatorios sin rellenar. Revise los campos marcados en rojo.', true);
    } else {
      mostrarMensaje('Todo parece correcto.', false);
    }
  }

  // ---- Botón Comprobar ----
  const btnComprobar = document.getElementById('btn-comprobar-datos');
  if (btnComprobar) {
    btnComprobar.addEventListener('click', comprobarDatosObligatorios);
  }

  // =========================================================================
  // BOTONES DE BORRAR SECCIÓN
  // =========================================================================

  /**
   * Limpia el contenido de una sección específica.
   * @param {string} sectionId - Identificador de la sección
   */
  async function limpiarSeccion(sectionId) {
    const showConfirm = window.showConfirm || ((msg) => Promise.resolve(confirm(msg)));
    
    const confirmed = await showConfirm('¿Estás seguro de que quieres borrar el contenido de esta sección?', {
      confirmText: 'Borrar',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) return;

    switch (sectionId) {
      case 'beneficiario':
        limpiarSeccionBeneficiario();
        break;
      case 'proyecto':
        limpiarSeccionProyecto();
        break;
      case 'desplazamientos':
        limpiarSeccionDesplazamientos();
        break;
      case 'eventos':
        limpiarSeccionEventos();
        break;
      case 'honorarios':
        limpiarSeccionHonorarios();
        break;
      case 'ajustes':
        limpiarSeccionAjustes();
        break;
    }

    // Recalcular resultado
    if (window.resultadoLiquidacion?.renderResultado) {
      window.resultadoLiquidacion.renderResultado();
    }
  }

  /**
   * Limpia la sección de datos del beneficiario.
   */
  function limpiarSeccionBeneficiario() {
    // Campos de texto
    ['nombre-benef', 'dni'].forEach(id => {
      const campo = document.getElementById(id);
      if (campo) {
        campo.value = '';
        campo.classList.remove('field-error');
      }
    });

    // Campo entidad: restaurar valor por defecto
    const entidad = document.getElementById('entidad');
    if (entidad) {
      entidad.value = 'Universidad de Extremadura';
      entidad.classList.remove('field-error');
    }

    // Select categoria (primer valor)
    if (categoriaSelect) {
      categoriaSelect.selectedIndex = 0;
      categoriaSelect.classList.remove('field-error');
    }

    // Select tipo-pago: restaurar primera opción
    if (tipoPagoSelect) {
      tipoPagoSelect.selectedIndex = 0;
      tipoPagoSelect.classList.remove('field-error');
      // Disparar cambio para mostrar/ocultar campos de pago según la opción
      tipoPagoSelect.dispatchEvent(new Event('change'));
    }

    // Limpiar campos de pago (se ocultan con el change de tipo-pago)
    ['iban', 'iban-ext', 'swift', 'numero-tarjeta'].forEach(id => {
      const campo = document.getElementById(id);
      if (campo) {
        campo.value = '';
        campo.classList.remove('field-error');
      }
    });

    // Ocultar warning de DNI
    const dniWarn = document.querySelector('.dni-warn');
    if (dniWarn) dniWarn.style.display = 'none';
  }

  /**
   * Limpia la sección de datos del proyecto.
   */
  function limpiarSeccionProyecto() {
    // Tipo de proyecto
    if (tipoProyecto) {
      tipoProyecto.selectedIndex = 0;
      tipoProyecto.classList.remove('field-error');
      // Disparar cambio para actualizar info decreto
      tipoProyecto.dispatchEvent(new Event('change'));
    }

    // Campos de texto
    ['responsable', 'referencia'].forEach(id => {
      const campo = document.getElementById(id);
      if (campo) {
        campo.value = '';
        campo.classList.remove('field-error');
      }
    });

    // Orgánica: restaurar valor por defecto "18."
    const organica = document.getElementById('organica');
    if (organica) {
      organica.value = '18.';
      organica.classList.remove('field-error');
    }
  }

  /**
   * Limpia la sección de desplazamientos.
   */
  function limpiarSeccionDesplazamientos() {
    // Eliminar todos los desplazamientos normales
    const container = document.getElementById('desplazamientos-container');
    if (container) {
      const desplazamientos = container.querySelectorAll('.desplazamiento-grupo:not(.desplazamiento-especial)');
      desplazamientos.forEach(d => d.remove());
    }

    // Eliminar desplazamiento especial si existe
    if (window.uiDesplazamientoEspecial?.existe && window.uiDesplazamientoEspecial.existe()) {
      const especial = document.getElementById('desplazamiento-especial');
      if (especial) especial.remove();
    }

    // Ocultar ficha de vehículo
    const vehiculoContainer = document.getElementById('vehiculo-particular-container');
    if (vehiculoContainer) {
      vehiculoContainer.innerHTML = '';
      vehiculoContainer.style.display = 'none';
    }

    // Resetear contador de desplazamientos
    if (uiDesp.resetCounter) {
      uiDesp.resetCounter();
    }

    // Actualizar numeración y botón añadir
    if (uiDesp.actualizarNumerosDesplazamientos) {
      uiDesp.actualizarNumerosDesplazamientos();
    }
    if (uiDesp.actualizarBotonAddDesplazamiento) {
      uiDesp.actualizarBotonAddDesplazamiento();
    }
  }

  /**
   * Limpia la sección de eventos/congresos.
   */
  function limpiarSeccionEventos() {
    ['evento-nombre', 'evento-inicio', 'evento-fin', 'evento-ciudad', 'evento-inscripcion'].forEach(id => {
      const campo = document.getElementById(id);
      if (campo) {
        campo.value = '';
        campo.classList.remove('field-error');
      }
    });

    // Ocultar el contenedor de evento asociado
    const eventoAsociadoContainer = document.getElementById('evento-asociado-container');
    if (eventoAsociadoContainer) {
      eventoAsociadoContainer.style.display = 'none';
    }
  }

  /**
   * Limpia la sección de honorarios.
   */
  function limpiarSeccionHonorarios() {
    // Campo importe
    const importe = document.getElementById('honorarios-importe');
    if (importe) {
      importe.value = '';
      importe.classList.remove('field-error');
    }

    // Select beneficiario: restaurar primera opción
    const beneficiario = document.getElementById('honorarios-beneficiario');
    if (beneficiario) {
      beneficiario.selectedIndex = 0;
      beneficiario.classList.remove('field-error');
    }

    // Select de situación
    const situacion = document.getElementById('honorarios-situacion');
    if (situacion) {
      situacion.selectedIndex = 0;
      situacion.classList.remove('field-error');
    }
  }

  /**
   * Limpia la sección de ajustes.
   */
  function limpiarSeccionAjustes() {
    // Financiación máxima
    const financiacion = document.getElementById('financiacion-maxima');
    if (financiacion) {
      financiacion.value = '';
      financiacion.classList.remove('field-error');
    }

    // Eliminar líneas de otros descuentos
    const descuentosContainer = document.getElementById('otros-descuentos-container');
    if (descuentosContainer) {
      descuentosContainer.innerHTML = '';
    }

    // Resetear módulo de ajustes si existe
    if (window.uiAjustes?.reset) {
      window.uiAjustes.reset();
    }
  }

  // ---- Listener delegado para botones de borrar sección ----
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-clear-section');
    if (!btn) return;

    // Evitar que el clic propague al section-title (toggle)
    e.stopPropagation();

    const section = btn.closest('.form-section');
    if (section && section.dataset.sectionId) {
      limpiarSeccion(section.dataset.sectionId);
    }
  });

});
