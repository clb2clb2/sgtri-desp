/**
 * uiDesplazamientoEspecial.js
 * ============================
 * Módulo para gestionar el "Desplazamiento Especial".
 * Permite crear líneas de gastos personalizadas con cálculos automáticos.
 *
 * @module uiDesplazamientoEspecial
 */
(function (global) {
  'use strict';

  // =========================================================================
  // ESTADO DEL MÓDULO
  // =========================================================================

  let especialCreado = false;
  let lineaCounter = 0;
  let seccionCounter = 0;
  let contenedorLineas = null;
  let contenedorResultado = null;

  // =========================================================================
  // UTILIDADES
  // =========================================================================

  /**
   * Formatea número a string con 2 decimales y formato europeo.
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
    if (typeof value === 'number') return value;
    if (!value) return 0;
    let s = String(value).replace(/[^0-9,.\-]/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      s = s.replace(/,/g, '');
    } else if (lastComma !== -1) {
      s = s.replace(',', '.');
    }
    return parseFloat(s) || 0;
  }

  /**
   * Redondea a 2 decimales.
   */
  function round2(n) {
    if (global.utils && typeof global.utils.round2 === 'function') {
      return global.utils.round2(n);
    }
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  // =========================================================================
  // CREACIÓN DE LÍNEAS
  // =========================================================================

  /**
   * Crea una línea de sección (solo descripción).
   * @returns {HTMLElement}
   */
  function crearLineaSeccion() {
    seccionCounter++;
    const id = `esp-seccion-${seccionCounter}`;

    const linea = document.createElement('div');
    linea.className = 'esp-linea esp-linea-seccion';
    linea.dataset.tipo = 'seccion';
    linea.dataset.id = id;

    // Campo descripción (100% menos botón eliminar)
    const inputDesc = document.createElement('input');
    inputDesc.type = 'text';
    inputDesc.className = 'esp-desc esp-desc-seccion';
    inputDesc.placeholder = 'Descripción';
    inputDesc.maxLength = 100;
    inputDesc.addEventListener('blur', actualizarResultado);

    // Botón eliminar
    const btnRemove = crearBotonEliminar(linea);

    linea.appendChild(inputDesc);
    linea.appendChild(btnRemove);

    return linea;
  }

  /**
   * Crea una línea normal con campos numéricos.
   * @returns {HTMLElement}
   */
  function crearLineaNormal() {
    lineaCounter++;
    const id = `esp-linea-${lineaCounter}`;

    const linea = document.createElement('div');
    linea.className = 'esp-linea esp-linea-normal';
    linea.dataset.tipo = 'normal';
    linea.dataset.id = id;

    // Campo descripción (75%)
    const inputDesc = document.createElement('input');
    inputDesc.type = 'text';
    inputDesc.className = 'esp-desc';
    inputDesc.placeholder = 'Descripción';
    inputDesc.maxLength = 100;
    inputDesc.addEventListener('blur', actualizarResultado);

    // Contenedor de campos numéricos
    const numWrapper = document.createElement('div');
    numWrapper.className = 'esp-num-wrapper';

    // Corchete izquierdo
    const bracketL = document.createElement('span');
    bracketL.className = 'esp-bracket';
    bracketL.textContent = '[';

    // Campo importe unitario (€)
    const inputImporte = document.createElement('input');
    inputImporte.type = 'text';
    inputImporte.className = 'esp-importe format-alojamiento';
    inputImporte.placeholder = '0,00 €';
    inputImporte.maxLength = 12;
    inputImporte.addEventListener('blur', () => {
      formatearCampoImporte(inputImporte);
      recalcularDesdeImporteYCantidad(linea);
    });
    inputImporte.addEventListener('input', () => {
      recalcularDesdeImporteYCantidad(linea);
    });

    // Símbolo multiplicación
    const multiply = document.createElement('span');
    multiply.className = 'esp-multiply';
    multiply.textContent = '×';

    // Campo cantidad (número, puede tener decimales)
    const inputCantidad = document.createElement('input');
    inputCantidad.type = 'text';
    inputCantidad.className = 'esp-cantidad';
    inputCantidad.placeholder = '0';
    inputCantidad.maxLength = 8;
    inputCantidad.addEventListener('blur', () => {
      formatearCampoCantidad(inputCantidad);
      recalcularDesdeImporteYCantidad(linea);
    });
    inputCantidad.addEventListener('input', () => {
      recalcularDesdeImporteYCantidad(linea);
    });

    // Corchete derecho
    const bracketR = document.createElement('span');
    bracketR.className = 'esp-bracket';
    bracketR.textContent = ']';

    // Símbolo igual
    const equals = document.createElement('span');
    equals.className = 'esp-equals';
    equals.textContent = '=';

    // Campo total (€)
    const inputTotal = document.createElement('input');
    inputTotal.type = 'text';
    inputTotal.className = 'esp-total format-alojamiento';
    inputTotal.placeholder = '0,00 €';
    inputTotal.maxLength = 12;
    inputTotal.addEventListener('blur', () => {
      formatearCampoImporte(inputTotal);
      recalcularDesdeTotal(linea);
    });
    inputTotal.addEventListener('input', () => {
      // Solo recalcular si el usuario está editando manualmente
    });

    // Botón eliminar
    const btnRemove = crearBotonEliminar(linea);

    // Ensamblar
    numWrapper.appendChild(bracketL);
    numWrapper.appendChild(inputImporte);
    numWrapper.appendChild(multiply);
    numWrapper.appendChild(inputCantidad);
    numWrapper.appendChild(bracketR);
    numWrapper.appendChild(equals);
    numWrapper.appendChild(inputTotal);

    linea.appendChild(inputDesc);
    linea.appendChild(numWrapper);
    linea.appendChild(btnRemove);

    return linea;
  }

  /**
   * Crea un botón de eliminar línea.
   * @param {HTMLElement} linea - Línea padre
   * @returns {HTMLButtonElement}
   */
  function crearBotonEliminar(linea) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-remove-esp-linea';
    btn.setAttribute('aria-label', 'Eliminar línea');
    
    const icon = document.createElement('span');
    icon.className = 'btn-icon btn-icon-minus';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '+';
    btn.appendChild(icon);

    btn.addEventListener('click', () => {
      linea.remove();
      actualizarResultado();
    });

    return btn;
  }

  // =========================================================================
  // FORMATEO Y CÁLCULOS
  // =========================================================================

  /**
   * Formatea un campo de importe al estilo europeo.
   */
  function formatearCampoImporte(input) {
    const valor = parseNumber(input.value);
    if (valor !== 0 || input.value.trim() !== '') {
      input.value = fmt(valor) + ' €';
    }
  }

  /**
   * Formatea el campo de cantidad (sin decimales innecesarios).
   */
  function formatearCampoCantidad(input) {
    let valor = parseNumber(input.value);
    // No permitir negativos en cantidad
    if (valor < 0) valor = Math.abs(valor);
    if (valor !== 0 || input.value.trim() !== '') {
      // Mostrar decimales solo si existen
      if (Number.isInteger(valor)) {
        input.value = String(valor);
      } else {
        input.value = valor.toLocaleString('de-DE', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });
      }
    }
  }

  /**
   * Recalcula el total desde importe × cantidad.
   * Si cantidad es 0, no se recalcula el total.
   */
  function recalcularDesdeImporteYCantidad(linea) {
    const inputImporte = linea.querySelector('.esp-importe');
    const inputCantidad = linea.querySelector('.esp-cantidad');
    const inputTotal = linea.querySelector('.esp-total');

    if (!inputImporte || !inputCantidad || !inputTotal) return;

    const importe = parseNumber(inputImporte.value);
    let cantidad = parseNumber(inputCantidad.value);
    
    // Cantidad no puede ser negativa
    if (cantidad < 0) cantidad = Math.abs(cantidad);
    
    // Si cantidad es 0, no recalcular total
    if (cantidad === 0) {
      actualizarResultado();
      return;
    }
    
    const total = round2(importe * cantidad);
    inputTotal.value = fmt(total) + ' €';

    actualizarResultado();
  }

  /**
   * Recalcula el importe desde el total (si el usuario modifica el total).
   * Si cantidad es 0, no se recalcula el importe.
   */
  function recalcularDesdeTotal(linea) {
    const inputImporte = linea.querySelector('.esp-importe');
    const inputCantidad = linea.querySelector('.esp-cantidad');
    const inputTotal = linea.querySelector('.esp-total');

    if (!inputImporte || !inputCantidad || !inputTotal) return;

    const total = parseNumber(inputTotal.value);
    let cantidad = parseNumber(inputCantidad.value);
    
    // Si cantidad es 0, no recalcular importe
    if (cantidad === 0) {
      actualizarResultado();
      return;
    }
    
    const importe = round2(total / cantidad);
    inputImporte.value = fmt(importe) + ' €';

    actualizarResultado();
  }

  // =========================================================================
  // RESULTADO
  // =========================================================================

  /**
   * Actualiza el cuadro de resultados del desplazamiento especial.
   */
  function actualizarResultado() {
    if (!contenedorResultado || !contenedorLineas) return;

    const lineas = contenedorLineas.querySelectorAll('.esp-linea');
    
    if (lineas.length === 0) {
      contenedorResultado.style.display = 'none';
      return;
    }

    contenedorResultado.style.display = 'block';
    let html = '';
    let totalGeneral = 0;

    lineas.forEach(linea => {
      const tipo = linea.dataset.tipo;
      
      if (tipo === 'seccion') {
        const desc = linea.querySelector('.esp-desc')?.value || '';
        if (desc.trim()) {
          html += `<div class="calc-seg-title">${escapeHtml(desc)}</div>`;
        }
      } else if (tipo === 'normal') {
        const desc = linea.querySelector('.esp-desc')?.value || '';
        const importe = parseNumber(linea.querySelector('.esp-importe')?.value);
        const cantidad = parseNumber(linea.querySelector('.esp-cantidad')?.value);
        const total = parseNumber(linea.querySelector('.esp-total')?.value);

        totalGeneral += total;

        // Construir label
        let labelText = escapeHtml(desc);
        if (importe !== 0 || cantidad !== 0) {
          const importeStr = fmt(importe);
          const cantidadStr = cantidad !== 0 ? formatCantidadDisplay(cantidad) : '';
          if (cantidadStr) {
            labelText += ` <span class="esp-calc-formula">[${importeStr} × ${cantidadStr}]</span>`;
          }
        }

        html += `<div class="calc-line">
          <span class="label">${labelText}</span>
          <span class="leader"></span>
          <span class="amount">${fmt(total)} €</span>
        </div>`;
      }
    });

    // Total general
    html += `<div class="calc-total">
      <span class="label">Total:</span>
      <span class="amount"><strong>${fmt(totalGeneral)} €</strong></span>
    </div>`;

    // Retención IRPF (si tiene valor)
    const irpfInput = document.getElementById('esp-irpf');
    const irpfValue = irpfInput ? parseNumber(irpfInput.value) : 0;
    if (irpfValue !== 0) {
      html += `<div class="calc-irpf">
        <span class="label">Sujeto a retención por IRPF:</span>
        <span class="amount">${fmt(irpfValue)} €</span>
      </div>`;
    }

    contenedorResultado.innerHTML = html;

    // Actualizar resultado de la liquidación
    if (global.resultadoLiquidacion?.renderResultado) {
      global.resultadoLiquidacion.renderResultado();
    }
  }

  /**
   * Formatea cantidad para mostrar en resultado.
   */
  function formatCantidadDisplay(cantidad) {
    if (Number.isInteger(cantidad)) {
      return String(cantidad);
    }
    return cantidad.toLocaleString('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  /**
   * Escapa HTML para evitar XSS.
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // =========================================================================
  // CREACIÓN/ELIMINACIÓN DEL DESPLAZAMIENTO ESPECIAL
  // =========================================================================

  /**
   * Crea el desplazamiento especial.
   * @returns {HTMLElement|null}
   */
  function crearDesplazamientoEspecial() {
    if (especialCreado) return null;

    const container = document.getElementById('desplazamientos-container');
    if (!container) return null;

    especialCreado = true;
    lineaCounter = 0;
    seccionCounter = 0;

    // Crear el grupo
    const grupo = document.createElement('div');
    grupo.className = 'desplazamiento-grupo desplazamiento-especial';
    grupo.id = 'desplazamiento-especial';

    // Header con título y botón eliminar
    const header = document.createElement('div');
    header.className = 'esp-header';

    const titulo = document.createElement('h3');
    titulo.className = 'desplazamiento-titulo esp-titulo';
    titulo.textContent = 'Desplazamiento Especial';

    const btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'btn-eliminar-desplazamiento';
    btnEliminar.setAttribute('aria-label', 'Eliminar desplazamiento especial');
    btnEliminar.innerHTML = '<span class="btn-icon btn-icon-minus" aria-hidden="true">−</span> Eliminar';
    btnEliminar.addEventListener('click', eliminarDesplazamientoEspecial);

    header.appendChild(titulo);
    header.appendChild(btnEliminar);

    // Botones de añadir
    const botonesWrapper = document.createElement('div');
    botonesWrapper.className = 'esp-botones-wrapper';

    const btnAddLinea = document.createElement('button');
    btnAddLinea.type = 'button';
    btnAddLinea.className = 'btn-otros-gastos';
    btnAddLinea.innerHTML = '<span class="btn-icon btn-icon-add" aria-hidden="true">+</span> Añadir línea';
    btnAddLinea.addEventListener('click', () => {
      const linea = crearLineaNormal();
      contenedorLineas.appendChild(linea);
      linea.querySelector('.esp-desc')?.focus();
      actualizarResultado();
    });

    const btnAddSeccion = document.createElement('button');
    btnAddSeccion.type = 'button';
    btnAddSeccion.className = 'btn-otros-gastos';
    btnAddSeccion.innerHTML = '<span class="btn-icon btn-icon-add" aria-hidden="true">+</span> Añadir sección';
    btnAddSeccion.addEventListener('click', () => {
      const linea = crearLineaSeccion();
      contenedorLineas.appendChild(linea);
      linea.querySelector('.esp-desc')?.focus();
      actualizarResultado();
    });

    botonesWrapper.appendChild(btnAddLinea);
    botonesWrapper.appendChild(btnAddSeccion);

    // Campo Retención IRPF (alineado a la derecha)
    const irpfWrapper = document.createElement('div');
    irpfWrapper.className = 'esp-irpf-wrapper';

    const irpfLabel = document.createElement('label');
    irpfLabel.textContent = 'Retención IRPF:';
    irpfLabel.className = 'esp-irpf-label';

    const irpfInput = document.createElement('input');
    irpfInput.type = 'text';
    irpfInput.className = 'formato-importe esp-irpf-input';
    irpfInput.id = 'esp-irpf';
    irpfInput.placeholder = '0,00 €';
    irpfInput.addEventListener('blur', () => {
      // Formatear como importe
      const valor = parseNumber(irpfInput.value);
      if (valor !== 0) {
        irpfInput.value = fmt(valor) + ' €';
      } else {
        irpfInput.value = '';
      }
      actualizarResultado();
    });

    irpfWrapper.appendChild(irpfLabel);
    irpfWrapper.appendChild(irpfInput);
    botonesWrapper.appendChild(irpfWrapper);

    // Contenedor de líneas
    contenedorLineas = document.createElement('div');
    contenedorLineas.className = 'esp-lineas-container';
    contenedorLineas.id = 'esp-lineas-container';

    // Contenedor de resultado
    contenedorResultado = document.createElement('div');
    contenedorResultado.className = 'calc-result esp-resultado';
    contenedorResultado.id = 'esp-resultado';
    contenedorResultado.style.display = 'none';

    // Ensamblar
    grupo.appendChild(header);
    grupo.appendChild(botonesWrapper);
    grupo.appendChild(contenedorLineas);
    grupo.appendChild(contenedorResultado);

    // Insertar al final del contenedor
    container.appendChild(grupo);

    // Mostrar ficha de vehículo
    if (global.uiDesplazamientos?.mostrarFichaVehiculo) {
      global.uiDesplazamientos.mostrarFichaVehiculo();
    }

    // Actualizar numeración de desplazamientos (para mostrar botones eliminar)
    if (global.uiDesplazamientos?.actualizarNumerosDesplazamientos) {
      global.uiDesplazamientos.actualizarNumerosDesplazamientos();
    }

    return grupo;
  }

  /**
   * Elimina el desplazamiento especial.
   */
  function eliminarDesplazamientoEspecial() {
    const grupo = document.getElementById('desplazamiento-especial');
    if (grupo) {
      grupo.remove();
    }
    
    especialCreado = false;
    contenedorLineas = null;
    contenedorResultado = null;
    lineaCounter = 0;
    seccionCounter = 0;

    // Evaluar si debe ocultarse la ficha de vehículo
    if (global.uiDesplazamientos?.evaluarKmParaMostrarFicha) {
      global.uiDesplazamientos.evaluarKmParaMostrarFicha();
    }

    // Actualizar numeración de desplazamientos (para ocultar botones eliminar si solo queda 1)
    if (global.uiDesplazamientos?.actualizarNumerosDesplazamientos) {
      global.uiDesplazamientos.actualizarNumerosDesplazamientos();
    }

    // Actualizar resultado de la liquidación
    if (global.resultadoLiquidacion?.renderResultado) {
      global.resultadoLiquidacion.renderResultado();
    }
  }

  /**
   * Verifica si existe el desplazamiento especial.
   * @returns {boolean}
   */
  function existeDesplazamientoEspecial() {
    return especialCreado;
  }

  // =========================================================================
  // SERIALIZACIÓN
  // =========================================================================

  /**
   * Recopila los datos del desplazamiento especial.
   * @returns {Object|null}
   */
  function recopilarDatos() {
    if (!especialCreado || !contenedorLineas) return null;

    const lineas = [];
    contenedorLineas.querySelectorAll('.esp-linea').forEach(linea => {
      const tipo = linea.dataset.tipo;
      const desc = linea.querySelector('.esp-desc')?.value || '';

      if (tipo === 'seccion') {
        lineas.push({ tipo: 'seccion', descripcion: desc });
      } else if (tipo === 'normal') {
        lineas.push({
          tipo: 'normal',
          descripcion: desc,
          importe: linea.querySelector('.esp-importe')?.value || '',
          cantidad: linea.querySelector('.esp-cantidad')?.value || '',
          total: linea.querySelector('.esp-total')?.value || ''
        });
      }
    });

    // Retención IRPF
    const irpfInput = document.getElementById('esp-irpf');
    const irpf = irpfInput ? irpfInput.value : '';

    return { lineas, irpf };
  }

  /**
   * Restaura los datos del desplazamiento especial.
   * @param {Object} datos
   */
  function restaurarDatos(datos) {
    if (!datos || !datos.lineas || datos.lineas.length === 0) return;

    // Crear el desplazamiento especial si no existe
    if (!especialCreado) {
      crearDesplazamientoEspecial();
    }

    if (!contenedorLineas) return;

    // Limpiar líneas existentes
    contenedorLineas.innerHTML = '';

    // Restaurar cada línea
    datos.lineas.forEach(lineaDatos => {
      if (lineaDatos.tipo === 'seccion') {
        const linea = crearLineaSeccion();
        contenedorLineas.appendChild(linea);
        const input = linea.querySelector('.esp-desc');
        if (input) input.value = lineaDatos.descripcion || '';
      } else if (lineaDatos.tipo === 'normal') {
        const linea = crearLineaNormal();
        contenedorLineas.appendChild(linea);
        
        const inputDesc = linea.querySelector('.esp-desc');
        const inputImporte = linea.querySelector('.esp-importe');
        const inputCantidad = linea.querySelector('.esp-cantidad');
        const inputTotal = linea.querySelector('.esp-total');

        if (inputDesc) inputDesc.value = lineaDatos.descripcion || '';
        
        // Formatear importe y total como moneda
        if (inputImporte && lineaDatos.importe) {
          const valorImporte = parseNumber(lineaDatos.importe);
          inputImporte.value = valorImporte !== 0 ? fmt(valorImporte) + ' €' : '';
        }
        if (inputCantidad) inputCantidad.value = lineaDatos.cantidad || '';
        if (inputTotal && lineaDatos.total) {
          const valorTotal = parseNumber(lineaDatos.total);
          inputTotal.value = valorTotal !== 0 ? fmt(valorTotal) + ' €' : '';
        }
      }
    });

    // Restaurar IRPF (formateado)
    const irpfInput = document.getElementById('esp-irpf');
    if (irpfInput && datos.irpf) {
      const valorIrpf = parseNumber(datos.irpf);
      irpfInput.value = valorIrpf !== 0 ? fmt(valorIrpf) + ' €' : '';
    }

    actualizarResultado();
  }

  // =========================================================================
  // DATOS PARA LIQUIDACIÓN
  // =========================================================================

  /**
   * Obtiene los datos del desplazamiento especial para la liquidación final.
   * @returns {Object|null} { lineasHtml: string[], total: number, irpf: number } o null si no existe
   */
  function getDatosParaLiquidacion() {
    if (!especialCreado || !contenedorLineas) return null;

    const lineas = contenedorLineas.querySelectorAll('.esp-linea');
    if (lineas.length === 0) return null;

    const lineasHtml = [];
    let totalGeneral = 0;

    lineas.forEach(linea => {
      const tipo = linea.dataset.tipo;
      
      if (tipo === 'seccion') {
        const desc = linea.querySelector('.esp-desc')?.value || '';
        if (desc.trim()) {
          lineasHtml.push(`<div class="calc-seg-title">${escapeHtml(desc)}</div>`);
        }
      } else if (tipo === 'normal') {
        const desc = linea.querySelector('.esp-desc')?.value || '';
        const importe = parseNumber(linea.querySelector('.esp-importe')?.value);
        const cantidad = parseNumber(linea.querySelector('.esp-cantidad')?.value);
        const total = parseNumber(linea.querySelector('.esp-total')?.value);

        totalGeneral += total;

        // Construir label
        let labelText = escapeHtml(desc);
        if (importe !== 0 || cantidad !== 0) {
          const importeStr = fmt(importe);
          const cantidadStr = cantidad !== 0 ? formatCantidadDisplay(cantidad) : '';
          if (cantidadStr) {
            labelText += ` <span class="esp-calc-formula">[${importeStr} × ${cantidadStr}]</span>`;
          }
        }

        lineasHtml.push(`<div class="resultado-line">
          <span class="resultado-label">${labelText}</span>
          <span class="resultado-leader" aria-hidden="true"></span>
          <span class="resultado-amount">${fmt(total)} €</span>
        </div>`);
      }
    });

    // Obtener IRPF
    const irpfInput = document.getElementById('esp-irpf');
    const irpfValue = irpfInput ? parseNumber(irpfInput.value) : 0;

    return {
      lineasHtml,
      total: round2(totalGeneral),
      irpf: round2(irpfValue)
    };
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const uiDesplazamientoEspecial = {
    crear: crearDesplazamientoEspecial,
    eliminar: eliminarDesplazamientoEspecial,
    existe: existeDesplazamientoEspecial,
    recopilarDatos,
    restaurarDatos,
    actualizarResultado,
    getDatosParaLiquidacion
  };

  global.uiDesplazamientoEspecial = uiDesplazamientoEspecial;

})(typeof window !== 'undefined' ? window : this);
