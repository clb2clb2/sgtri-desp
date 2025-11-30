/**
 * uiDesplazamientos.js
 * =====================
 * Módulo de gestión de fichas de desplazamiento.
 * Maneja la creación, eliminación, numeración y lógica de UI de desplazamientos.
 *
 * @module uiDesplazamientos
 * @requires confirmDialog
 * @requires limpiaDatos
 * @requires validaciones
 */
(function (global) {
  'use strict';

  // Dependencias
  const showConfirm = global.showConfirm || ((msg) => Promise.resolve(confirm(msg)));
  const ld = global.limpiaDatos || {};
  const val = global.validaciones || {};

  // Estado del módulo
  let desplazamientoCounter = 1;
  let desplazamientosContainer = null;
  let btnAddDesplazamiento = null;
  let vehiculoContainer = null;
  let vehiculoVisible = false;
  let paisesData = [];

  // Callbacks externos (se configuran desde formLogic)
  let onDesplazamientoCreated = null;
  let onDesplazamientoDeleted = null;
  let onPaisChanged = null;

  // =========================================================================
  // FICHA DE VEHÍCULO
  // =========================================================================

  /**
   * Crea el contenido de la ficha de vehículo.
   */
  function crearFichaVehiculo() {
    if (!vehiculoContainer) return;
    
    vehiculoContainer.innerHTML = `
      <div class="vehiculo-ficha">
        <div class="form-row">
          <div class="form-group">
            <div class="veh-row">
              <h3 class="veh-label">Vehículo particular:</h3>
              <label class="veh-radio-label">
                <input type="radio" name="vehiculo-tipo" value="coche" checked class="veh-radio"/>
                <span>Automóvil</span>
              </label>
              <label class="veh-radio-label">
                <input type="radio" name="vehiculo-tipo" value="motocicleta" class="veh-radio"/>
                <span>Motocicleta</span>
              </label>
            </div>
          </div>
        </div>
        <div class="form-row three-cols-33" id="veh-datos-row" name="vehiculo-datos-row">
          <div class="form-group">
            <label for="veh-marca">Marca:</label>
            <input type="text" id="veh-marca" name="veh-marca" class="veh-text" maxlength="25" />
          </div>
          <div class="form-group">
            <label for="veh-modelo">Modelo:</label>
            <input type="text" id="veh-modelo" name="veh-modelo" class="veh-text" maxlength="25" />
          </div>
          <div class="form-group">
            <label for="veh-matricula">Matrícula:</label>
            <input type="text" id="veh-matricula" name="veh-matricula" class="veh-text" maxlength="25" />
          </div>
        </div>
      </div>
    `;

    // Sanear inputs de vehículo
    const vehTextHandler = (e) => {
      const el = e.target;
      if (!el) return;
      const cleaned = String(el.value || '').replace(/[^0-9A-Za-z\u00C0-\u017F .\-]/g, '');
      el.value = el.id === 'veh-matricula' ? cleaned.toUpperCase() : cleaned;
    };

    vehiculoContainer.querySelectorAll('.veh-text').forEach(inp => {
      inp.addEventListener('input', vehTextHandler);
    });

    // Listener para cambio de tipo de vehículo
    vehiculoContainer.querySelectorAll('input[name="vehiculo-tipo"]').forEach(r => {
      r.addEventListener('change', () => {
        // Recalcular todos los desplazamientos
        document.querySelectorAll('.desplazamiento-grupo').forEach(el => {
          const id = el.dataset.desplazamientoId;
          if (id) recalculateDesplazamientoById(id);
        });
      });
    });
  }

  /**
   * Muestra la ficha de vehículo.
   */
  function mostrarFichaVehiculo() {
    if (!vehiculoContainer) return;
    if (!vehiculoVisible) {
      crearFichaVehiculo();
      vehiculoVisible = true;
    }
    vehiculoContainer.style.display = '';
  }

  /**
   * Oculta la ficha de vehículo.
   */
  function ocultarFichaVehiculo() {
    if (!vehiculoContainer) return;
    vehiculoContainer.style.display = 'none';
    vehiculoVisible = false;
  }

  /**
   * Evalúa si algún desplazamiento tiene km > 0 y muestra/oculta la ficha.
   */
  function evaluarKmParaMostrarFicha() {
    const anyKm = Array.from(document.querySelectorAll('.desplazamiento-grupo .format-km')).some(inp => {
      const v = (inp.value || '').toString().replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(/,/g, '.');
      const n = parseFloat(v) || 0;
      return n > 0;
    });
    if (anyKm) mostrarFichaVehiculo();
    else ocultarFichaVehiculo();
  }

  // =========================================================================
  // GESTIÓN DE PAÍSES
  // =========================================================================

  /**
   * Pobla un select con la lista de países.
   * @param {HTMLSelectElement} selectElement
   */
  function poblarSelectPaises(selectElement) {
    if (!selectElement) return;
    selectElement.innerHTML = '';
    
    paisesData.forEach(pais => {
      const option = document.createElement('option');
      option.value = pais;
      option.textContent = pais;
      selectElement.appendChild(option);
    });

    // Seleccionar España por defecto
    try {
      const tieneEspaña = paisesData.indexOf('España') !== -1;
      if (tieneEspaña) selectElement.value = 'España';
      else if (selectElement.options.length > 0) selectElement.selectedIndex = 0;
    } catch (e) { /* ignore */ }
  }

  /**
   * Establece los datos de países.
   * @param {Array<string>} data
   */
  function setPaisesData(data) {
    paisesData = data || [];
  }

  /**
   * Maneja el cambio de país en un desplazamiento.
   * @param {string|number} desplazamientoId
   */
  function manejarCambioPais(desplazamientoId) {
    const paisSelect = document.getElementById(`pais-destino-${desplazamientoId}`);
    const fronterasFields = document.getElementById(`fronteras-fields-${desplazamientoId}`);
    const cruceIda = document.getElementById(`cruce-ida-${desplazamientoId}`);
    const cruceVuelta = document.getElementById(`cruce-vuelta-${desplazamientoId}`);

    if (!paisSelect || !fronterasFields) return;

    if (paisSelect.value !== 'España') {
      fronterasFields.style.display = 'block';
      if (cruceIda) cruceIda.required = true;
      if (cruceVuelta) cruceVuelta.required = true;
      
      try {
        if (val.validateCrucesAndUpdateUI) {
          val.validateCrucesAndUpdateUI(desplazamientoId);
        }
      } catch (e) { /* ignore */ }
    } else {
      fronterasFields.style.display = 'none';
      if (cruceIda) {
        cruceIda.required = false;
        cruceIda.value = '';
      }
      if (cruceVuelta) {
        cruceVuelta.required = false;
        cruceVuelta.value = '';
      }
      
      // Limpiar errores
      try {
        const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${desplazamientoId}"]`);
        if (desp && desp.dataset && desp.dataset.dtInvalid) delete desp.dataset.dtInvalid;
        const existingMsg = document.getElementById(`cruce-order-error-${desplazamientoId}`);
        if (existingMsg && existingMsg.parentNode) existingMsg.parentNode.removeChild(existingMsg);
        
        setTimeout(() => {
          if (val.validateDateTimePairAndUpdateUI) {
            val.validateDateTimePairAndUpdateUI(desplazamientoId);
          }
        }, 60);
      } catch (e) { /* ignore */ }
    }

    // Callback externo
    if (typeof onPaisChanged === 'function') {
      onPaisChanged(desplazamientoId);
    }

    // Recalcular todos los desplazamientos
    scheduleFullRecalc(120);
  }

  // =========================================================================
  // TICKET CENA
  // =========================================================================

  /**
   * Actualiza la visibilidad del campo Ticket Cena según tipo de proyecto y hora.
   */
  function actualizarTicketCena() {
    const tipoProyecto = document.getElementById('tipoProyecto');
    const tipoProyectoValor = tipoProyecto ? tipoProyecto.value : '';
    const esRD462 = ['G24', 'PEI', 'NAL'].includes(tipoProyectoValor);

    document.querySelectorAll('.desplazamiento-grupo').forEach(desp => {
      const id = desp.dataset.desplazamientoId;
      const field = desp.querySelector(`#ticket-cena-field-${id}`);
      if (!field) return;

      if (!esRD462) {
        field.style.display = 'none';
        return;
      }

      const horaRegresoEl = desp.querySelector(`#hora-regreso-${id}`);
      const valor = (horaRegresoEl && horaRegresoEl.value) ? horaRegresoEl.value.trim() : '';
      let mostrar = false;

      const m = valor.match(/^(\d{1,2}):(\d{2})$/);
      if (m) {
        const hh = parseInt(m[1], 10);
        if (hh >= 22) mostrar = true;
      }

      field.style.display = mostrar ? 'block' : 'none';
    });
  }

  // =========================================================================
  // OTROS GASTOS
  // =========================================================================

  /**
   * Crea una línea de "otros gastos" dentro de una ficha de desplazamiento.
   * @param {HTMLElement} despEl - Elemento del desplazamiento
   * @returns {HTMLElement|null} La línea creada
   */
  function crearLineaOtroGasto(despEl) {
    const cont = despEl.querySelector('.otros-gastos-container');
    if (!cont) return null;

    const linea = document.createElement('div');
    linea.className = 'otros-gasto-line form-row three-cols-25-50-25';

    // Columna: Tipo
    const colTipo = document.createElement('div');
    colTipo.className = 'form-group';
    const labelTipo = document.createElement('label');
    labelTipo.textContent = 'Tipo de gasto:';
    const selectTipo = document.createElement('select');
    selectTipo.className = 'otros-gasto-tipo';
    selectTipo.setAttribute('aria-label', 'Tipo de gasto');
    colTipo.appendChild(labelTipo);
    colTipo.appendChild(selectTipo);

    // Columna: Descripción
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

    // Columna: Importe + botón eliminar
    const colImporte = document.createElement('div');
    colImporte.className = 'form-group';
    const labelImp = document.createElement('label');
    labelImp.textContent = 'Importe:';
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '0.5rem';
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

    wrapper.appendChild(inputImp);
    wrapper.appendChild(btnRemove);
    colImporte.appendChild(labelImp);
    colImporte.appendChild(wrapper);

    linea.appendChild(colTipo);
    linea.appendChild(colDesc);
    linea.appendChild(colImporte);

    // Poblar el select desde los datos cargados
    const otros = (global.__sgtriDatos && global.__sgtriDatos.otrosGastos) ? global.__sgtriDatos.otrosGastos : [];
    otros.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item[1] || item[0];
      opt.textContent = item[0];
      selectTipo.appendChild(opt);
    });

    cont.appendChild(linea);
    return linea;
  }

  // =========================================================================
  // CREAR DESPLAZAMIENTO
  // =========================================================================

  /**
   * Crea un nuevo desplazamiento y lo añade al contenedor.
   * @returns {HTMLElement} El elemento del nuevo desplazamiento
   */
  function crearNuevoDesplazamiento() {
    if (!desplazamientosContainer) {
      desplazamientosContainer = document.getElementById('desplazamientos-container');
    }
    if (!desplazamientosContainer) return null;

    desplazamientoCounter++;
    const nuevoDesplazamiento = document.createElement('div');
    nuevoDesplazamiento.className = 'desplazamiento-grupo';
    nuevoDesplazamiento.dataset.desplazamientoId = desplazamientoCounter;

    const tipoProyecto = document.getElementById('tipoProyecto');
    const tipoProyectoValor = tipoProyecto ? tipoProyecto.value : '';
    const mostrarTicketCena = ['G24', 'PEI', 'NAL'].includes(tipoProyectoValor);

    nuevoDesplazamiento.innerHTML = `
      <h3 class="desplazamiento-titulo">Desplazamiento ${desplazamientoCounter}</h3>
      
      <div class="form-row four-cols-25">
        <div class="form-group">
          <label for="fecha-ida-${desplazamientoCounter}">Salida el día:</label>
          <input type="text" class="input-fecha" id="fecha-ida-${desplazamientoCounter}" name="fecha-ida-${desplazamientoCounter}" placeholder="dd/mm/aa" required />
        </div>
        <div class="form-group">
          <label for="hora-ida-${desplazamientoCounter}">a las:</label>
          <input type="text" class="input-hora" id="hora-ida-${desplazamientoCounter}" name="hora-ida-${desplazamientoCounter}" placeholder="hh:mm" maxlength="5" required />
        </div>
        <div class="form-group">
          <label for="fecha-regreso-${desplazamientoCounter}">Regreso el día:</label>
          <input type="text" class="input-fecha" id="fecha-regreso-${desplazamientoCounter}" name="fecha-regreso-${desplazamientoCounter}" placeholder="dd/mm/aa" required />
        </div>
        <div class="form-group">
          <label for="hora-regreso-${desplazamientoCounter}">a las:</label>
          <input type="text" class="input-hora" id="hora-regreso-${desplazamientoCounter}" name="hora-regreso-${desplazamientoCounter}" placeholder="hh:mm" maxlength="5" required />
        </div>
      </div>

      <div class="ticket-cena-field conditional-row" id="ticket-cena-field-${desplazamientoCounter}" style="display: none;">
        <div class="form-group">
          <label>
            <input type="checkbox" id="ticket-cena-${desplazamientoCounter}" name="ticket-cena-${desplazamientoCounter}" />
            Aporta justificante de pago por la cena del último día
          </label>
        </div>
      </div>

      <div class="form-row three-cols-33">
        <div class="form-group">
          <label for="origen-${desplazamientoCounter}">Origen</label>
          <input type="text" id="origen-${desplazamientoCounter}" name="origen-${desplazamientoCounter}" class="general-text" maxlength="40" required />
        </div>
        <div class="form-group">
          <label for="destino-${desplazamientoCounter}">Destino</label>
          <input type="text" id="destino-${desplazamientoCounter}" name="destino-${desplazamientoCounter}" class="general-text" maxlength="40" required />
        </div>
        <div class="form-group">
          <label for="pais-destino-${desplazamientoCounter}">País de Destino</label>
          <select id="pais-destino-${desplazamientoCounter}" name="pais-destino-${desplazamientoCounter}" required>
          </select>
        </div>
      </div>

      <div class="fronteras-fields conditional-row" id="fronteras-fields-${desplazamientoCounter}" style="display: none;">
        <div class="form-row">
          <div class="form-group">
            <label for="cruce-ida-${desplazamientoCounter}">Cruce de fronteras Ida</label>
            <input type="text" class="input-fecha" id="cruce-ida-${desplazamientoCounter}" name="cruce-ida-${desplazamientoCounter}" placeholder="dd/mm/aa" />
          </div>
          <div class="form-group">
            <label for="cruce-vuelta-${desplazamientoCounter}">Cruce de fronteras Vuelta</label>
            <input type="text" class="input-fecha" id="cruce-vuelta-${desplazamientoCounter}" name="cruce-vuelta-${desplazamientoCounter}" placeholder="dd/mm/aa" />
          </div>
        </div>
      </div>

      <div class="form-group">
        <label for="motivo-${desplazamientoCounter}">Motivo del desplazamiento:</label>
        <input type="text" id="motivo-${desplazamientoCounter}" name="motivo-${desplazamientoCounter}" class="general-text" maxlength="90" required />
      </div>

      <div class="form-row two-cols-50-50">
        <div class="form-group">
          <label for="km-${desplazamientoCounter}">Km:</label>
          <input type="text" id="km-${desplazamientoCounter}" name="km-${desplazamientoCounter}" class="format-km" maxlength="12" placeholder="0 km" />
        </div>
        <div class="form-group">
          <label for="alojamiento-${desplazamientoCounter}">Alojamiento (€):</label>
          <input type="text" id="alojamiento-${desplazamientoCounter}" name="alojamiento-${desplazamientoCounter}" class="format-alojamiento" maxlength="12" placeholder="0,00 €" />
        </div>
      </div>

      <div class="otros-gastos-wrapper">
        <div class="otros-gastos-row">
          <div class="otros-gastos-left">
            <label for="no-manutencion-${desplazamientoCounter}" class="no-manut-label">
              <input type="checkbox" id="no-manutencion-${desplazamientoCounter}" class="no-manutencion"> 
              No incluir gastos de manutención:
            </label>
          </div>
          <div class="otros-gastos-right">
            <button type="button" class="btn-otros-gastos">
              <span class="btn-icon btn-icon-add" aria-hidden="true">+</span>
              Otros gastos
            </button>
            <span class="warn-wrapper" tabindex="0" aria-label="Información sobre otros gastos">
              <span class="warn-icon" aria-hidden="true">ℹ️</span>
              <span class="warn-tooltip">Recuerde comprobar que el gasto es elegible según el tipo de proyecto que financia esta liquidación</span>
            </span>
          </div>
        </div>
        <div class="otros-gastos-container" id="otros-gastos-${desplazamientoCounter}"></div>
      </div>

      <button type="button" class="btn-eliminar-desplazamiento" aria-label="Eliminar desplazamiento ${desplazamientoCounter}">
        <span class="btn-icon btn-icon-minus" aria-hidden="true">−</span>Eliminar
      </button>
    `;

    // Animación de entrada
    nuevoDesplazamiento.classList.add('entry');
    desplazamientosContainer.appendChild(nuevoDesplazamiento);
    nuevoDesplazamiento.addEventListener('transitionend', () => nuevoDesplazamiento.classList.remove('entry'), { once: true });

    // Poblar select de países
    const nuevoSelectPais = document.getElementById(`pais-destino-${desplazamientoCounter}`);
    poblarSelectPaises(nuevoSelectPais);

    // Listener para cambio de país
    if (nuevoSelectPais) {
      nuevoSelectPais.addEventListener('change', () => {
        manejarCambioPais(desplazamientoCounter);
      });
    }

    // Mostrar botón eliminar en el primero si es el segundo
    if (desplazamientoCounter === 2) {
      const primerDesplazamiento = desplazamientosContainer.querySelector('.desplazamiento-grupo');
      const primerBotonEliminar = primerDesplazamiento?.querySelector('.btn-eliminar-desplazamiento');
      if (primerBotonEliminar) primerBotonEliminar.style.display = 'block';
    }

    actualizarNumerosDesplazamientos();

    // Adjuntar listeners de cálculo
    attachCalcListenersToDesplazamiento(desplazamientoCounter);

    // Callback externo
    if (typeof onDesplazamientoCreated === 'function') {
      onDesplazamientoCreated(nuevoDesplazamiento, desplazamientoCounter);
    }

    return nuevoDesplazamiento;
  }

  // =========================================================================
  // NUMERACIÓN Y ACTUALIZACIÓN
  // =========================================================================

  /**
   * Actualiza la numeración visible de todos los desplazamientos.
   */
  function actualizarNumerosDesplazamientos() {
    if (!desplazamientosContainer) {
      desplazamientosContainer = document.getElementById('desplazamientos-container');
    }
    if (!desplazamientosContainer) return;

    const desplazamientos = desplazamientosContainer.querySelectorAll('.desplazamiento-grupo');
    
    desplazamientos.forEach((desp, index) => {
      const titulo = desp.querySelector('.desplazamiento-titulo');
      if (desplazamientos.length > 1) {
        if (titulo) {
          titulo.textContent = `Desplazamiento ${index + 1}`;
          titulo.style.display = 'block';
        }
      } else {
        if (titulo) titulo.style.display = 'none';
      }
    });

    // Mostrar/ocultar botones eliminar
    if (desplazamientos.length > 1) {
      desplazamientos.forEach((d, idx) => {
        const btn = d.querySelector('.btn-eliminar-desplazamiento');
        if (btn) {
          btn.style.display = 'block';
          btn.setAttribute('aria-label', `Eliminar desplazamiento ${idx + 1}`);
        }
      });
    } else if (desplazamientos.length === 1) {
      const btn = desplazamientos[0].querySelector('.btn-eliminar-desplazamiento');
      if (btn) btn.style.display = 'none';
    }

    // Actualizar select de evento asociado (congresos)
    try {
      const eventoSelect = document.getElementById('evento-asociado');
      const eventoContainer = document.getElementById('evento-asociado-container');
      if (eventoSelect && eventoContainer) {
        eventoSelect.innerHTML = '';
        if (desplazamientos.length > 1) {
          eventoContainer.style.display = '';
          desplazamientos.forEach((d, idx) => {
            const opt = document.createElement('option');
            opt.value = `desp${idx + 1}`;
            opt.textContent = `Desplazamiento ${idx + 1}`;
            eventoSelect.appendChild(opt);
          });
          try { eventoSelect.value = 'desp1'; } catch (e) { /* ignore */ }
        } else {
          eventoContainer.style.display = 'none';
        }
      }
    } catch (e) { /* ignore */ }

    // Recomputar descuento si existe
    try {
      if (typeof global.computeDescuentoManutencion === 'function') {
        global.computeDescuentoManutencion();
      }
    } catch (e) { /* ignore */ }
  }

  /**
   * Elimina un desplazamiento con confirmación.
   * @param {HTMLElement} grupo - Elemento del desplazamiento a eliminar
   */
  async function eliminarDesplazamiento(grupo) {
    if (!grupo || !desplazamientosContainer) return;

    const titulo = grupo.querySelector('.desplazamiento-titulo')?.textContent || '';
    const confirmed = await showConfirm(`¿Eliminar ${titulo}?`);
    if (!confirmed) return;

    grupo.remove();
    actualizarNumerosDesplazamientos();

    // Callback externo
    if (typeof onDesplazamientoDeleted === 'function') {
      onDesplazamientoDeleted();
    }

    // Ocultar botón eliminar si solo queda uno
    const desplazamientos = desplazamientosContainer.querySelectorAll('.desplazamiento-grupo');
    if (desplazamientos.length === 1) {
      const botonEliminar = desplazamientos[0].querySelector('.btn-eliminar-desplazamiento');
      if (botonEliminar) botonEliminar.style.display = 'none';
    }

    // Recalcular y evaluar vehículo
    scheduleFullRecalc(60);
    evaluarKmParaMostrarFicha();
  }

  // =========================================================================
  // SCHEDULERS DE RECÁLCULO
  // =========================================================================

  let fullRecalcTimer = null;

  /**
   * Programa un recálculo completo de todos los desplazamientos.
   * @param {number} [debounceMs=120] - Milisegundos de debounce
   */
  function scheduleFullRecalc(debounceMs = 120) {
    if (fullRecalcTimer) clearTimeout(fullRecalcTimer);
    fullRecalcTimer = setTimeout(() => {
      try {
        if (global.logicaDesp && typeof global.logicaDesp.scheduleFullRecalc === 'function') {
          global.logicaDesp.scheduleFullRecalc(0);
          return;
        }
        // Fallback: recalcular cada ficha directamente
        document.querySelectorAll('.desplazamiento-grupo').forEach(el => {
          if (global.calculoDesp && typeof global.calculoDesp.calculaDesplazamientoFicha === 'function') {
            try { global.calculoDesp.calculaDesplazamientoFicha(el); } catch (e) { /* ignore */ }
          }
        });
      } catch (e) { /* ignore */ }
    }, debounceMs);
  }

  /**
   * Recalcula un desplazamiento específico por ID.
   * @param {string|number} id
   */
  function recalculateDesplazamientoById(id) {
    try {
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (!desp) return;
      if (global.calculoDesp && typeof global.calculoDesp.calculaDesplazamientoFicha === 'function') {
        global.calculoDesp.calculaDesplazamientoFicha(desp);
      }
    } catch (e) { /* ignore */ }
  }

  // =========================================================================
  // LISTENERS DE CÁLCULO
  // =========================================================================

  /**
   * Adjunta listeners de cálculo a un desplazamiento.
   * @param {string|number} id - ID del desplazamiento
   */
  function attachCalcListenersToDesplazamiento(id) {
    const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
    if (!desp) return;

    const selector = [
      `#fecha-ida-${id}`, `#hora-ida-${id}`,
      `#fecha-regreso-${id}`, `#hora-regreso-${id}`,
      `#cruce-ida-${id}`, `#cruce-vuelta-${id}`,
      `#pais-destino-${id}`, `#km-${id}`, `#alojamiento-${id}`
    ].join(',');

    const nodes = desp.querySelectorAll(selector);

    nodes.forEach(n => {
      n.addEventListener('input', () => { /* no recalc on input */ });

      if (n.tagName === 'SELECT') {
        if (n.id && n.id.indexOf('pais-destino-') === 0) {
          n.addEventListener('change', () => {
            if (val.validateDateTimePairAndUpdateUI) val.validateDateTimePairAndUpdateUI(id);
            try { manejarCambioPais(id); } catch (e) { /* ignore */ }
            actualizarTicketCena();
            try {
              if (typeof global.computeDescuentoManutencion === 'function') {
                global.computeDescuentoManutencion();
              }
            } catch (e) { /* ignore */ }
          });
        } else {
          n.addEventListener('change', () => {
            if (val.validateDateTimePairAndUpdateUI) val.validateDateTimePairAndUpdateUI(id);
            actualizarTicketCena();
            try {
              if (typeof global.computeDescuentoManutencion === 'function') {
                global.computeDescuentoManutencion();
              }
            } catch (e) { /* ignore */ }
          });
        }
      } else {
        n.addEventListener('change', () => { /* defer to blur */ });
        n.addEventListener('blur', () => {
          if (val.validateDateTimePairAndUpdateUI) val.validateDateTimePairAndUpdateUI(id);
          actualizarTicketCena();
        });
      }
    });

    // Watch km input
    const kmInput = desp.querySelector(`#km-${id}`);
    if (kmInput) {
      kmInput.addEventListener('blur', () => {
        evaluarKmParaMostrarFicha();
        actualizarTicketCena();
      });
    }

    // Watch ticket-cena checkbox
    const ticketCheckbox = desp.querySelector(`#ticket-cena-${id}`);
    if (ticketCheckbox) {
      ticketCheckbox.addEventListener('change', () => {
        if (val.validateDateTimePairAndUpdateUI) val.validateDateTimePairAndUpdateUI(id);
        actualizarTicketCena();
      });
    }

    // Watch no-manutencion checkbox
    const noManut = desp.querySelector(`#no-manutencion-${id}`);
    if (noManut) {
      noManut.addEventListener('change', () => { /* handled by logicaDesp */ });
    }

    // Cálculo inicial
    setTimeout(() => {
      evaluarKmParaMostrarFicha();
      try {
        if (global.calculoDesp && typeof global.calculoDesp.calculaDesplazamientoFicha === 'function') {
          global.calculoDesp.calculaDesplazamientoFicha(desp);
        }
      } catch (e) { /* ignore */ }
    }, 100);
  }

  // =========================================================================
  // INICIALIZACIÓN
  // =========================================================================

  /**
   * Inicializa el módulo de desplazamientos.
   * @param {Object} [options] - Opciones de configuración
   * @param {Function} [options.onCreated] - Callback al crear un desplazamiento
   * @param {Function} [options.onDeleted] - Callback al eliminar un desplazamiento
   * @param {Function} [options.onPaisChanged] - Callback al cambiar el país
   */
  function init(options = {}) {
    desplazamientosContainer = document.getElementById('desplazamientos-container');
    btnAddDesplazamiento = document.getElementById('btn-add-desplazamiento');
    vehiculoContainer = document.getElementById('vehiculo-particular-container');

    onDesplazamientoCreated = options.onCreated || null;
    onDesplazamientoDeleted = options.onDeleted || null;
    onPaisChanged = options.onPaisChanged || null;

    if (!desplazamientosContainer) return;

    // Evento para añadir desplazamiento
    if (btnAddDesplazamiento) {
      btnAddDesplazamiento.addEventListener('click', () => {
        const nuevo = crearNuevoDesplazamiento();
        if (nuevo) {
          const firstInput = nuevo.querySelector('input, select');
          if (firstInput) {
            nuevo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => firstInput.focus(), 220);
          }
        }
      });
    }

    // Delegación de eventos
    desplazamientosContainer.addEventListener('click', async (e) => {
      // Eliminar desplazamiento
      if (e.target.classList.contains('btn-eliminar-desplazamiento') ||
          e.target.closest('.btn-eliminar-desplazamiento')) {
        const btn = e.target.classList.contains('btn-eliminar-desplazamiento')
          ? e.target
          : e.target.closest('.btn-eliminar-desplazamiento');
        const grupo = btn.closest('.desplazamiento-grupo');
        await eliminarDesplazamiento(grupo);
        return;
      }

      // Añadir línea de otros gastos
      const targetAdd = e.target.closest && e.target.closest('.btn-otros-gastos');
      if (targetAdd) {
        const grupo = targetAdd.closest('.desplazamiento-grupo');
        if (!grupo) return;
        const cont = grupo.querySelector('.otros-gastos-container');
        if (cont.style.display === 'none' || cont.style.display === '') {
          cont.style.display = 'block';
        }
        const nueva = crearLineaOtroGasto(grupo);
        if (nueva) {
          const inp = nueva.querySelector('.otros-gasto-desc');
          if (inp) setTimeout(() => inp.focus(), 80);
        }
        return;
      }

      // Eliminar línea de otros gastos
      const targetRemove = e.target.closest && e.target.closest('.btn-remove-otros-gasto');
      if (targetRemove) {
        const linea = targetRemove.closest('.otros-gasto-line');
        if (linea && linea.parentNode) {
          linea.parentNode.removeChild(linea);
        }
        return;
      }
    });

    // Adjuntar listeners a desplazamientos existentes
    document.querySelectorAll('.desplazamiento-grupo').forEach(el => {
      const id = el.dataset.desplazamientoId;
      if (id) attachCalcListenersToDesplazamiento(id);
    });

    // Actualizar numeración inicial
    actualizarNumerosDesplazamientos();
  }

  /**
   * Obtiene el contador actual de desplazamientos.
   * @returns {number}
   */
  function getCounter() {
    return desplazamientoCounter;
  }

  /**
   * Establece el contador de desplazamientos.
   * @param {number} value
   */
  function setCounter(value) {
    desplazamientoCounter = value;
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const uiDesplazamientos = {
    // Creación y gestión
    crearNuevoDesplazamiento,
    actualizarNumerosDesplazamientos,
    eliminarDesplazamiento,
    crearLineaOtroGasto,

    // Vehículo
    crearFichaVehiculo,
    mostrarFichaVehiculo,
    ocultarFichaVehiculo,
    evaluarKmParaMostrarFicha,

    // Países
    poblarSelectPaises,
    setPaisesData,
    manejarCambioPais,

    // Ticket cena
    actualizarTicketCena,

    // Recálculo
    scheduleFullRecalc,
    recalculateDesplazamientoById,
    attachCalcListenersToDesplazamiento,

    // Inicialización
    init,
    getCounter,
    setCounter
  };

  global.uiDesplazamientos = uiDesplazamientos;

})(typeof window !== 'undefined' ? window : this);
