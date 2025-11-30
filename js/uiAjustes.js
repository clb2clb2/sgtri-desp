/**
 * uiAjustes.js
 * =============
 * Módulo para gestionar la sección "Ajustes de la liquidación".
 * Maneja la creación y eliminación de líneas de descuentos.
 *
 * @module uiAjustes
 */
(function (global) {
  'use strict';

  // =========================================================================
  // ESTADO
  // =========================================================================

  let descuentoCounter = 0;

  // =========================================================================
  // FUNCIONES PRIVADAS
  // =========================================================================

  /**
   * Crea una nueva línea de descuento
   * @returns {HTMLElement} El elemento de la línea creada
   */
  function crearLineaDescuento() {
    descuentoCounter++;
    const id = descuentoCounter;

    const linea = document.createElement('div');
    linea.className = 'descuento-line';
    linea.dataset.descuentoId = id;

    // Columna 1: Select "Descontar de"
    const colTipo = document.createElement('div');
    colTipo.className = 'form-group';
    const labelTipo = document.createElement('label');
    labelTipo.textContent = 'Descontar de:';
    labelTipo.setAttribute('for', `descuento-tipo-${id}`);
    const selectTipo = document.createElement('select');
    selectTipo.id = `descuento-tipo-${id}`;
    selectTipo.name = `descuento-tipo-${id}`;
    selectTipo.className = 'descuento-tipo';

    // Poblar select desde datos.json
    const descuentos = (window.__sgtriDatos && window.__sgtriDatos.otrosDescuentos) 
      ? window.__sgtriDatos.otrosDescuentos : [];
    descuentos.forEach((item, index) => {
      const opt = document.createElement('option');
      opt.value = item[1] || item[0];
      opt.textContent = item[0];
      if (index === 0) opt.selected = true;
      selectTipo.appendChild(opt);
    });

    colTipo.appendChild(labelTipo);
    colTipo.appendChild(selectTipo);

    // Columna 2: Input "Motivo"
    const colMotivo = document.createElement('div');
    colMotivo.className = 'form-group';
    const labelMotivo = document.createElement('label');
    labelMotivo.textContent = 'Motivo:';
    labelMotivo.setAttribute('for', `descuento-motivo-${id}`);
    const inputMotivo = document.createElement('input');
    inputMotivo.type = 'text';
    inputMotivo.id = `descuento-motivo-${id}`;
    inputMotivo.name = `descuento-motivo-${id}`;
    inputMotivo.className = 'descuento-motivo';
    inputMotivo.maxLength = 60;
    colMotivo.appendChild(labelMotivo);
    colMotivo.appendChild(inputMotivo);

    // Columna 3: Input "Importe" + botón eliminar
    const colImporte = document.createElement('div');
    colImporte.className = 'form-group';
    const labelImporte = document.createElement('label');
    labelImporte.textContent = 'Importe:';
    labelImporte.setAttribute('for', `descuento-importe-${id}`);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'descuento-importe-wrapper';
    
    const inputImporte = document.createElement('input');
    inputImporte.type = 'text';
    inputImporte.id = `descuento-importe-${id}`;
    inputImporte.name = `descuento-importe-${id}`;
    inputImporte.className = 'format-alojamiento descuento-importe';
    inputImporte.placeholder = '0,00 €';
    inputImporte.maxLength = 12;

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn-remove-descuento';
    btnRemove.setAttribute('aria-label', 'Eliminar descuento');
    const spanIcon = document.createElement('span');
    spanIcon.className = 'btn-icon btn-icon-minus';
    spanIcon.setAttribute('aria-hidden', 'true');
    spanIcon.textContent = '+';
    btnRemove.appendChild(spanIcon);

    // Evento eliminar
    btnRemove.addEventListener('click', () => {
      linea.remove();
    });

    wrapper.appendChild(inputImporte);
    wrapper.appendChild(btnRemove);
    colImporte.appendChild(labelImporte);
    colImporte.appendChild(wrapper);

    // Ensamblar línea
    linea.appendChild(colTipo);
    linea.appendChild(colMotivo);
    linea.appendChild(colImporte);

    return linea;
  }

  /**
   * Añade una línea de descuento al contenedor
   */
  function agregarDescuento() {
    const container = document.getElementById('otros-descuentos-container');
    if (!container) return;

    const linea = crearLineaDescuento();
    container.appendChild(linea);
  }

  /**
   * Inicializa el módulo
   */
  function init() {
    const btnAdd = document.getElementById('btn-add-descuento');
    if (btnAdd) {
      btnAdd.addEventListener('click', agregarDescuento);
    }
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const uiAjustes = {
    init,
    agregarDescuento,
    crearLineaDescuento,
    getDescuentoCounter: () => descuentoCounter,
    setDescuentoCounter: (val) => { descuentoCounter = val; }
  };

  global.uiAjustes = uiAjustes;

})(typeof window !== 'undefined' ? window : this);
