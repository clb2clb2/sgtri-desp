/**
 * uiImputacion.js
 * ================
 * Módulo para gestionar la sección de imputación de importes a orgánicas.
 * Permite distribuir el importe de la liquidación entre diferentes orgánicas.
 *
 * @module uiImputacion
 * @requires resultadoLiquidacion
 * @requires limpiaDatos
 */
(function (global) {
  'use strict';

  // =========================================================================
  // ESTADO INTERNO
  // =========================================================================

  let lineasImputacion = []; // Array de { id, organica, responsable, importe, readonly }
  let nextId = 1;
  let container = null;

  // =========================================================================
  // LÍMITES CONFIGURABLES
  // =========================================================================

  /**
   * Obtiene los límites desde datos.json
   */
  function getLimites() {
    const datos = global.__sgtriDatos || {};
    return datos.limites || { maxLineasImputacion: 4 };
  }

  /**
   * Actualiza la visibilidad del botón de añadir imputación según el límite.
   */
  function actualizarBotonAddImputacion() {
    if (!container) return;
    const btn = container.querySelector('.btn-add-imputacion');
    const wrapper = container.querySelector('.btn-add-wrapper');
    if (!btn && !wrapper) return;
    const limites = getLimites();
    const count = lineasImputacion.length;
    const display = count >= limites.maxLineasImputacion ? 'none' : '';
    if (wrapper) wrapper.style.display = display;
    else if (btn) btn.style.display = display;
  }

  // =========================================================================
  // UTILIDADES
  // =========================================================================

  /**
   * Formatea número a string con 2 decimales y separador europeo.
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
   */
  function parseNumber(value) {
    if (global.utils && typeof global.utils.parseNumber === 'function') {
      return global.utils.parseNumber(value);
    }
    // Fallback básico
    if (typeof value === 'number') return value;
    if (!value) return 0;
    let s = String(value).replace(/[^0-9,.\-]/g, '');
    s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  }

  /**
   * Redondea a 2 decimales.
   */
  function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  /**
   * Formatea orgánica (delega a limpiaDatos si disponible).
   */
  function formatOrganica(valor) {
    if (global.limpiaDatos && typeof global.limpiaDatos.formatOrganica === 'function') {
      return global.limpiaDatos.formatOrganica(valor);
    }
    // Fallback básico
    return (valor || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  }

  /**
   * Valida si una orgánica tiene formato correcto.
   * Debe empezar por "18." y tener 2-5 pares de 2 caracteres alfanuméricos.
   * @param {string} valor - Valor de la orgánica
   * @returns {boolean} true si es válida o está vacía/incompleta
   */
  function validarOrganica(valor) {
    const val = (valor || '').trim();
    // Si está vacío o es solo "18.", no marcar error (el usuario lo completará)
    if (val === '' || val === '18.') {
      return true;
    }
    // Regex: 2 a 7 pares de exactamente 2 caracteres alfanuméricos separados por puntos
    const regexOrganica = /^[A-Za-z0-9]{2}(\.[A-Za-z0-9]{2}){1,6}$/;
    return val.startsWith('18.') && regexOrganica.test(val);
  }

  /**
   * Obtiene el total de la liquidación desde el módulo resultadoLiquidacion.
   */
  function getTotalLiquidacion() {
    if (global.resultadoLiquidacion && typeof global.resultadoLiquidacion.calcularResultado === 'function') {
      const resultado = global.resultadoLiquidacion.calcularResultado();
      return round2(resultado.totalLiquidacion || 0);
    }
    return 0;
  }

  /**
   * Obtiene los valores actuales del proyecto (orgánica y responsable).
   */
  function getDatosProyecto() {
    const organica = document.getElementById('organica');
    const responsable = document.getElementById('responsable');
    return {
      organica: organica ? organica.value : '18.',
      responsable: responsable ? responsable.value : ''
    };
  }

  // =========================================================================
  // CÁLCULO DE IMPORTES
  // =========================================================================

  /**
   * Calcula la suma de los importes de las líneas adicionales (no readonly).
   */
  function sumaLineasAdicionales() {
    return lineasImputacion
      .filter(l => !l.readonly)
      .reduce((sum, l) => sum + round2(l.importe || 0), 0);
  }

  /**
   * Calcula el importe restante para la línea principal.
   */
  function calcularImportePrincipal() {
    const total = getTotalLiquidacion();
    const adicionales = sumaLineasAdicionales();
    return round2(Math.max(0, total - adicionales));
  }

  /**
   * Actualiza el importe de la línea principal (readonly).
   * Si el total de liquidación cambia, ajusta las líneas adicionales para mantener coherencia.
   */
  function actualizarLineaPrincipal() {
    const lineaPrincipal = lineasImputacion.find(l => l.readonly);
    if (!lineaPrincipal) return;
    
    const total = getTotalLiquidacion();
    let sumaAdicionales = sumaLineasAdicionales();
    
    // Si la suma de adicionales es >= total, poner todas a 0
    if (sumaAdicionales >= total) {
      lineasImputacion.forEach(l => {
        if (!l.readonly) {
          l.importe = 0;
        }
      });
      sumaAdicionales = 0;
    }
    
    // La línea principal es siempre total - suma de adicionales
    lineaPrincipal.importe = round2(total - sumaAdicionales);
    
    // Actualizar también los datos del proyecto
    const datos = getDatosProyecto();
    lineaPrincipal.organica = datos.organica;
    lineaPrincipal.responsable = datos.responsable;
  }

  // =========================================================================
  // RENDERIZADO
  // =========================================================================

  /**
   * Crea el HTML de una línea de imputación.
   * @param {Object} linea - Datos de la línea
   * @param {boolean} esPrimera - Si es la primera línea (tiene botón + en vez de eliminar)
   */
  function crearLineaHTML(linea, esPrimera) {
    const div = document.createElement('div');
    div.className = 'imputacion-linea' + (linea.readonly ? ' readonly' : '');
    div.dataset.imputacionId = linea.id;

    const readonlyAttr = linea.readonly ? ' readonly' : '';
    const tabindexAttr = linea.readonly ? ' tabindex="-1"' : '';
    
    // Si el importe es 0, usar placeholder en vez de value (solo para líneas editables)
    const importeEsCero = round2(linea.importe) === 0 && !linea.readonly;
    const importeValue = importeEsCero ? '' : `${fmt(linea.importe)} €`;
    
    // Validar orgánica para clase field-error (solo líneas editables)
    const organicaValida = linea.readonly || validarOrganica(linea.organica);
    const fieldErrorClass = organicaValida ? '' : ' field-error';

    // Botón: + para primera línea (añadir), x para el resto (eliminar)
    let botonHTML;
    if (esPrimera) {
      botonHTML = `
        <span class="warn-wrapper btn-add-wrapper">
          <button type="button" class="btn-add-imputacion" aria-label="Añadir línea de imputación">
            <span class="btn-icon" aria-hidden="true">+</span>
          </button>
          <span class="warn-tooltip imputacion-tooltip">Añada líneas adicionales si necesita imputar el importe a diferentes orgánicas. La suma de todos los importes debe igualar el total de la liquidación.</span>
        </span>`;
    } else {
      botonHTML = `
        <button type="button" class="btn-remove-imputacion" aria-label="Eliminar línea">
          <span class="btn-icon" aria-hidden="true">+</span>
        </button>`;
    }

    div.innerHTML = `
      <div class="imputacion-campo">
        <input type="text" 
               class="imputacion-organica organica${fieldErrorClass}" 
               value="${escapeHtml(linea.organica)}"
               pattern="^18(\\.[A-Za-z0-9]{2}){1,6}$"
               maxlength="20"
               ${readonlyAttr}${tabindexAttr}
               aria-label="Orgánica" />
      </div>
      <div class="imputacion-campo">
        <input type="text" 
               class="imputacion-responsable" 
               value="${escapeHtml(linea.responsable)}"
               placeholder="Responsable"
               maxlength="70"
               ${readonlyAttr}${tabindexAttr}
               aria-label="Responsable" />
      </div>
      <div class="imputacion-campo imputacion-campo-importe">
        <input type="text" 
               class="imputacion-importe" 
               value="${linea.readonly ? fmt(linea.importe) + ' €' : importeValue}"
               placeholder="0,00 €"
               maxlength="12"
               ${readonlyAttr}${tabindexAttr}
               aria-label="Importe" />
        ${botonHTML}
      </div>
    `;

    return div;
  }

  /**
   * Escapa HTML para prevenir XSS.
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /**
   * Renderiza todas las líneas de imputación.
   */
  function renderLineas() {
    if (!container) return;

    // Guardar focus actual
    const focusedEl = document.activeElement;
    const focusedLineaId = focusedEl?.closest('.imputacion-linea')?.dataset.imputacionId;
    const focusedClass = focusedEl?.className?.split(' ')[0];

    // Limpiar contenedor
    container.innerHTML = '';

    // Renderizar cada línea
    lineasImputacion.forEach((linea, index) => {
      const lineaEl = crearLineaHTML(linea, index === 0);
      container.appendChild(lineaEl);
    });

    // Restaurar focus si era en una línea
    if (focusedLineaId && focusedClass) {
      const lineaEl = container.querySelector(`[data-imputacion-id="${focusedLineaId}"]`);
      if (lineaEl) {
        const input = lineaEl.querySelector(`.${focusedClass}`);
        if (input) input.focus();
      }
    }
  }

  // =========================================================================
  // EVENTOS
  // =========================================================================

  /**
   * Maneja el click en el botón de añadir línea.
   */
  function onAddLinea() {
    const newLinea = {
      id: nextId++,
      organica: '18.',
      responsable: '',
      importe: 0,
      readonly: false
    };

    lineasImputacion.push(newLinea);
    actualizarLineaPrincipal();
    renderLineas();
    actualizarBotonAddImputacion();

    // Focus en la nueva línea
    setTimeout(() => {
      const lineaEl = container.querySelector(`[data-imputacion-id="${newLinea.id}"]`);
      if (lineaEl) {
        const organicaInput = lineaEl.querySelector('.imputacion-organica');
        if (organicaInput) organicaInput.focus();
      }
    }, 0);
  }

  /**
   * Maneja la eliminación de una línea.
   */
  function onEliminarLinea(lineaId) {
    const idx = lineasImputacion.findIndex(l => l.id === lineaId);
    if (idx === -1 || lineasImputacion[idx].readonly) return;

    lineasImputacion.splice(idx, 1);
    actualizarLineaPrincipal();
    renderLineas();
    actualizarBotonAddImputacion();
  }

  /**
   * Maneja el blur en el campo orgánica.
   */
  function onOrganicaBlur(lineaId, valor) {
    const linea = lineasImputacion.find(l => l.id === lineaId);
    if (!linea || linea.readonly) return;

    let formatted = formatOrganica(valor);
    
    // Si está vacío o incompleto, restaurar a "18."
    if (formatted === '' || formatted === '18') {
      formatted = '18.';
    }
    
    linea.organica = formatted;
    
    // Actualizar el input con el valor formateado y validar
    const lineaEl = container.querySelector(`[data-imputacion-id="${lineaId}"]`);
    if (lineaEl) {
      const input = lineaEl.querySelector('.imputacion-organica');
      
      if (input) {
        input.value = linea.organica;
        
        // Validar y marcar/desmarcar field-error
        const esValida = validarOrganica(linea.organica);
        if (esValida) {
          input.classList.remove('field-error');
        } else {
          input.classList.add('field-error');
        }
      }
    }
  }

  /**
   * Maneja el blur en el campo responsable.
   */
  function onResponsableBlur(lineaId, valor) {
    const linea = lineasImputacion.find(l => l.id === lineaId);
    if (!linea || linea.readonly) return;

    linea.responsable = valor.trim();
  }

  /**
   * Maneja el blur en el campo importe.
   */
  function onImporteBlur(lineaId, valor) {
    const linea = lineasImputacion.find(l => l.id === lineaId);
    if (!linea || linea.readonly) return;

    let importe = parseNumber(valor);
    const restante = calcularImportePrincipal() + linea.importe; // Restante sin contar esta línea

    // Si el importe es >= restante, poner a 0
    if (importe >= restante) {
      importe = 0;
    }

    linea.importe = round2(importe);
    actualizarLineaPrincipal();
    renderLineas();
  }

  /**
   * Delegación de eventos en el contenedor.
   */
  function setupEventDelegation() {
    if (!container) return;

    // Click en botón añadir (primera línea)
    container.addEventListener('click', (e) => {
      const btnAdd = e.target.closest('.btn-add-imputacion');
      if (btnAdd) {
        onAddLinea();
        return;
      }
      
      // Click en botón eliminar
      const btnRemove = e.target.closest('.btn-remove-imputacion');
      if (btnRemove) {
        const lineaEl = btnRemove.closest('.imputacion-linea');
        if (lineaEl) {
          const lineaId = parseInt(lineaEl.dataset.imputacionId, 10);
          onEliminarLinea(lineaId);
        }
      }
    });

    // Blur en inputs
    container.addEventListener('focusout', (e) => {
      const input = e.target;
      if (!input.matches('input')) return;

      const lineaEl = input.closest('.imputacion-linea');
      if (!lineaEl) return;

      const lineaId = parseInt(lineaEl.dataset.imputacionId, 10);

      if (input.classList.contains('imputacion-organica')) {
        onOrganicaBlur(lineaId, input.value);
      } else if (input.classList.contains('imputacion-responsable')) {
        onResponsableBlur(lineaId, input.value);
      } else if (input.classList.contains('imputacion-importe')) {
        onImporteBlur(lineaId, input.value);
      }
    });

    // Formatear importe mientras se escribe (orgánica se formatea por formLogic.js gracias a clase 'organica')
    container.addEventListener('input', (e) => {
      const input = e.target;
      
      // Formatear importe (solo números, coma y punto)
      if (input.classList.contains('imputacion-importe')) {
        let s = (input.value || '').replace(/\./g, ',').replace(/[^0-9,]/g, '');
        const parts = s.split(',');
        if (parts.length > 2) s = parts[0] + ',' + parts.slice(1).join('');
        if (s !== input.value) input.value = s;
      }
    });
  }

  /**
   * Escucha cambios en los campos del proyecto para actualizar la línea principal.
   */
  function setupProyectoListeners() {
    const organicaEl = document.getElementById('organica');
    const responsableEl = document.getElementById('responsable');

    const updateAndRender = () => {
      actualizarLineaPrincipal();
      renderLineas();
    };

    if (organicaEl) {
      organicaEl.addEventListener('change', updateAndRender);
      organicaEl.addEventListener('blur', updateAndRender);
    }

    if (responsableEl) {
      responsableEl.addEventListener('change', updateAndRender);
      responsableEl.addEventListener('blur', updateAndRender);
    }
  }

  // =========================================================================
  // API PÚBLICA
  // =========================================================================

  /**
   * Inicializa el módulo.
   */
  function init() {
    container = document.getElementById('imputacion-container');

    if (!container) {
      console.warn('[uiImputacion] No se encontró el contenedor de imputación');
      return;
    }

    // Inicializar con la línea principal (readonly)
    const datos = getDatosProyecto();
    lineasImputacion = [{
      id: nextId++,
      organica: datos.organica,
      responsable: datos.responsable,
      importe: getTotalLiquidacion(),
      readonly: true
    }];

    // Setup eventos
    setupEventDelegation();
    setupProyectoListeners();
    renderLineas();

    console.log('[uiImputacion] Módulo inicializado');
  }

  /**
   * Actualiza la sección de imputación (llamar después de recalcular).
   */
  function actualizar() {
    actualizarLineaPrincipal();
    renderLineas();
  }

  /**
   * Obtiene las líneas de imputación para serialización.
   * @returns {Array} Array de { organica, responsable, importe, readonly }
   */
  function obtenerLineas() {
    return lineasImputacion.map(l => ({
      organica: l.organica,
      responsable: l.responsable,
      importe: l.importe,
      readonly: l.readonly
    }));
  }

  /**
   * Restaura las líneas de imputación desde datos serializados.
   * @param {Array} lineas - Array de { organica, responsable, importe, readonly }
   */
  function restaurarLineas(lineas) {
    if (!Array.isArray(lineas) || lineas.length === 0) {
      // Si no hay datos, reiniciar con línea principal
      const datos = getDatosProyecto();
      lineasImputacion = [{
        id: nextId++,
        organica: datos.organica,
        responsable: datos.responsable,
        importe: getTotalLiquidacion(),
        readonly: true
      }];
    } else {
      // Restaurar líneas
      lineasImputacion = lineas.map(l => ({
        id: nextId++,
        organica: l.organica || '18.',
        responsable: l.responsable || '',
        importe: round2(l.importe || 0),
        readonly: !!l.readonly
      }));
    }

    actualizarLineaPrincipal();
    renderLineas();
    actualizarBotonAddImputacion();
  }

  /**
   * Resetea a una única línea principal.
   */
  function reset() {
    nextId = 1;
    const datos = getDatosProyecto();
    lineasImputacion = [{
      id: nextId++,
      organica: datos.organica,
      responsable: datos.responsable,
      importe: getTotalLiquidacion(),
      readonly: true
    }];
    renderLineas();
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const uiImputacion = {
    init,
    actualizar,
    obtenerLineas,
    restaurarLineas,
    reset
  };

  global.uiImputacion = uiImputacion;

})(typeof window !== 'undefined' ? window : this);
