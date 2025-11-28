/**
 * uiPagos.js
 * ===========
 * Módulo de gestión de campos de pago dinámicos.
 * Renderiza los campos IBAN, SWIFT o Tarjeta según el tipo de pago seleccionado.
 *
 * @module uiPagos
 * @requires limpiaDatos
 */
(function (global) {
  'use strict';

  // Dependencias
  const ld = global.limpiaDatos || {};

  // =========================================================================
  // RENDERIZADO DE CAMPOS DE PAGO
  // =========================================================================

  /**
   * Renderiza los campos de pago según el tipo seleccionado.
   * @param {string} tipo - Tipo de pago ('CE', 'CI', 'TJ', etc.)
   */
  function renderPagoFields(tipo) {
    const mid = document.getElementById('pago-iban-container');
    const right = document.getElementById('pago-swift-container');
    const tipoPagoEl = document.getElementById('tipo-pago');
    const parentRow = (tipoPagoEl && tipoPagoEl.closest) ? tipoPagoEl.closest('.form-row') : null;

    if (!mid || !right) return;

    // Limpiar contenedores
    mid.innerHTML = '';
    right.innerHTML = '';

    // Helpers de layout
    function setLayoutThreeCols() {
      if (parentRow) parentRow.className = 'form-row three-cols-25-50-25';
      right.style.display = '';
      right.style.overflow = 'hidden';
    }

    function setLayoutTwoCols() {
      if (parentRow) parentRow.className = 'form-row two-cols-25-75';
      right.style.display = 'none';
      right.style.overflow = '';
    }

    // Cuenta Española: IBAN de 24 caracteres
    if (tipo === 'CE' || tipo === 'Cuenta Española' || tipo === 'CuentaEsp') {
      setLayoutTwoCols();
      mid.innerHTML = `
        <label for="iban">IBAN:</label>
        <input type="text" id="iban" name="iban" class="iban" />
      `;
      // Configurar maxlength con separadores
      const rawMax = 24;
      const sepCount = Math.floor((rawMax - 1) / 4);
      const displayMax = rawMax + sepCount;
      const inp = mid.querySelector('input');
      if (inp) {
        inp.setAttribute('maxlength', String(displayMax));
        inp.setAttribute('data-raw-max', String(rawMax));
      }
      return;
    }

    // Cuenta Extranjera: IBAN de 34 caracteres + SWIFT
    if (tipo === 'CI' || tipo === 'Cuenta Extranjera' || tipo === 'CuentaExtranjera') {
      setLayoutThreeCols();
      mid.innerHTML = `
        <label for="iban-ext">IBAN:</label>
        <input type="text" id="iban-ext" name="iban-ext" class="iban" />
      `;
      // Configurar maxlength para IBAN internacional
      const rawMax = 34;
      const sepCount = Math.floor((rawMax - 1) / 4);
      const displayMax = rawMax + sepCount;
      const inp = mid.querySelector('input');
      if (inp) {
        inp.setAttribute('maxlength', String(displayMax));
        inp.setAttribute('data-raw-max', String(rawMax));
      }
      right.innerHTML = `
        <label for="swift">SWIFT/BIC:</label>
        <input type="text" id="swift" name="swift" class="swift" maxlength="11" />
      `;
      return;
    }

    // Tarjeta UEx
    if (tipo === 'TJ' || tipo === 'Tarjeta UEx' || tipo === 'TarjetaUEx') {
      setLayoutTwoCols();
      mid.innerHTML = `
        <label for="numero-tarjeta">Número de tarjeta:</label>
        <input type="text" id="numero-tarjeta" name="numero-tarjeta" class="card-number" maxlength="23" />
      `;
      // Aplicar formateo agrupado
      setTimeout(() => {
        const cardEl = document.getElementById('numero-tarjeta');
        if (cardEl && ld.processGroupedInput) {
          ld.processGroupedInput(cardEl, {
            groupSize: 4,
            sep: ' ',
            maxRawLen: 19,
            validPattern: '\\d'
          });
        }
      }, 10);
      return;
    }

    // Fallback: IBAN genérico
    mid.innerHTML = `
      <label for="iban">IBAN:</label>
      <input type="text" id="iban" name="iban" class="iban" maxlength="34" data-raw-max="34" />
    `;
  }

  /**
   * Inicializa los listeners para el selector de tipo de pago.
   */
  function init() {
    const tipoPagoSelect = document.getElementById('tipo-pago');
    if (tipoPagoSelect) {
      tipoPagoSelect.addEventListener('change', (e) => {
        renderPagoFields(e.target.value);
      });
      // Render inicial
      renderPagoFields(tipoPagoSelect.value);
    }
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const uiPagos = {
    renderPagoFields,
    init
  };

  global.uiPagos = uiPagos;

})(typeof window !== 'undefined' ? window : this);
