/**
 * serializacionDatos.js
 * ======================
 * Módulo de serialización y deserialización de datos del formulario.
 * Permite guardar y cargar el estado completo del formulario en archivos .dta
 *
 * @module serializacionDatos
 * @requires limpiaDatos
 */
(function (global) {
  'use strict';

  // =========================================================================
  // VERSIÓN DEL ESQUEMA (se obtiene de datos.json al inicializar)
  // =========================================================================
  let VERSION_ESQUEMA = null;

  /**
   * Inicializa el módulo con la versión del esquema desde datos.json
   * @param {string} version - Versión del esquema desde window.__sgtriDatos
   */
  function inicializar(version) {
    VERSION_ESQUEMA = version;
    console.log(`[serializacionDatos] Inicializado con versión esquema: ${VERSION_ESQUEMA}`);
  }

  // =========================================================================
  // UTILIDADES
  // =========================================================================

  /**
   * Genera nombre de archivo por defecto: Liquidacion DDMMYY-HHMM.dta
   * @returns {string}
   */
  function generarNombreArchivo() {
    const ahora = new Date();
    const dd = String(ahora.getDate()).padStart(2, '0');
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const yy = String(ahora.getFullYear()).slice(-2);
    const hh = String(ahora.getHours()).padStart(2, '0');
    const min = String(ahora.getMinutes()).padStart(2, '0');
    return `Liquidacion ${dd}${mm}${yy}-${hh}${min}.dta`;
  }

  /**
   * Obtiene el valor de un campo del DOM
   * @param {string} id - ID del elemento
   * @param {string} [tipo='text'] - Tipo de valor esperado
   * @returns {*}
   */
  function obtenerValorCampo(id, tipo = 'text') {
    const el = document.getElementById(id);
    if (!el) return tipo === 'checkbox' ? false : '';
    
    if (tipo === 'checkbox') return el.checked;
    if (tipo === 'number') return parseFloat(el.value) || 0;
    return el.value || '';
  }

  /**
   * Establece el valor de un campo del DOM
   * @param {string} id - ID del elemento
   * @param {*} valor - Valor a establecer
   * @param {string} [tipo='text'] - Tipo de valor
   */
  function establecerValorCampo(id, valor, tipo = 'text') {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (tipo === 'checkbox') {
      el.checked = !!valor;
    } else {
      el.value = valor ?? '';
    }
  }

  // =========================================================================
  // RECOPILACIÓN DE DATOS (DOM → Objeto)
  // =========================================================================

  /**
   * Recopila los datos del beneficiario
   * @returns {Object}
   */
  function recopilarBeneficiario() {
    const categoriaSelect = document.getElementById('categoria');
    const categoriaValor = categoriaSelect ? categoriaSelect.value : '';
    const categoriaNombre = categoriaSelect ? categoriaSelect.options[categoriaSelect.selectedIndex]?.text : '';
    
    return {
      nombre: obtenerValorCampo('nombre-benef'),
      dni: obtenerValorCampo('dni'),
      entidad: obtenerValorCampo('entidad'),
      categoria: categoriaValor,
      categoriaNombre: categoriaNombre
    };
  }

  /**
   * Recopila los datos de pago
   * @returns {Object}
   */
  function recopilarPago() {
    const tipoPagoSelect = document.getElementById('tipo-pago');
    const tipoPago = tipoPagoSelect ? tipoPagoSelect.value : '';
    const tipoPagoNombre = tipoPagoSelect ? tipoPagoSelect.options[tipoPagoSelect.selectedIndex]?.text : '';
    
    const datos = {
      tipo: tipoPago,
      tipoNombre: tipoPagoNombre
    };

    // IBAN según tipo de cuenta
    if (tipoPago === 'CE') {
      datos.iban = obtenerValorCampo('iban');
    }
    if (tipoPago === 'CI') {
      // Cuenta extranjera usa iban-ext
      datos.iban = obtenerValorCampo('iban-ext');
      datos.swift = obtenerValorCampo('swift');
    }
    if (tipoPago === 'TJ') {
      datos.tarjeta = obtenerValorCampo('numero-tarjeta');
    }

    return datos;
  }

  /**
   * Recopila los datos del proyecto
   * @returns {Object}
   */
  function recopilarProyecto() {
    const tipoSelect = document.getElementById('tipoProyecto');
    const tipoValor = tipoSelect ? tipoSelect.value : '';
    const tipoNombre = tipoSelect ? tipoSelect.options[tipoSelect.selectedIndex]?.text : '';
    
    // Determinar normativa aplicable según tipo de proyecto
    const datos = window.__sgtriDatos;
    const rdList = (datos && datos.normativasPorTipoProyecto && datos.normativasPorTipoProyecto.rd) || [];
    const normativa = rdList.includes(tipoValor) ? 'rd' : 'decreto';
    
    return {
      tipo: tipoValor,
      tipoNombre: tipoNombre,
      normativa: normativa,
      responsable: obtenerValorCampo('responsable'),
      organica: obtenerValorCampo('organica'),
      referencia: obtenerValorCampo('referencia')
    };
  }

  /**
   * Recopila los otros gastos de un desplazamiento
   * @param {number} despId - ID del desplazamiento
   * @returns {Array}
   */
  function recopilarOtrosGastos(despId) {
    const contenedor = document.getElementById(`otros-gastos-${despId}`);
    if (!contenedor) return [];

    const gastos = [];
    // Nota: la clase es .otros-gasto-line (singular)
    const lineas = contenedor.querySelectorAll('.otros-gasto-line');
    
    lineas.forEach((linea) => {
      const tipo = linea.querySelector('.otros-gasto-tipo')?.value || '';
      const concepto = linea.querySelector('.otros-gasto-desc')?.value || '';
      const importe = linea.querySelector('.otros-gasto-importe')?.value || '';
      
      if (tipo || concepto || importe) {
        gastos.push({ tipo, concepto, importe });
      }
    });

    return gastos;
  }

  /**
   * Recopila los datos de todos los desplazamientos
   * @returns {Array}
   */
  function recopilarDesplazamientos() {
    const contenedor = document.getElementById('desplazamientos-container');
    if (!contenedor) return [];

    const desplazamientos = [];
    // Excluir el desplazamiento especial de la recopilación
    const grupos = contenedor.querySelectorAll('.desplazamiento-grupo:not(.desplazamiento-especial)');

    grupos.forEach(grupo => {
      const id = parseInt(grupo.dataset.desplazamientoId, 10);
      
      // Obtener detalles calculados del registro centralizado
      const registro = global.__sgtriTotales?.desplazamientos?.[String(id)];
      const detalles = registro?.detalles || null;
      
      desplazamientos.push({
        id,
        fechaIda: obtenerValorCampo(`fecha-ida-${id}`),
        horaIda: obtenerValorCampo(`hora-ida-${id}`),
        fechaRegreso: obtenerValorCampo(`fecha-regreso-${id}`),
        horaRegreso: obtenerValorCampo(`hora-regreso-${id}`),
        ticketCena: obtenerValorCampo(`ticket-cena-${id}`, 'checkbox'),
        origen: obtenerValorCampo(`origen-${id}`),
        destino: obtenerValorCampo(`destino-${id}`),
        paisDestino: obtenerValorCampo(`pais-destino-${id}`),
        cruceIda: obtenerValorCampo(`cruce-ida-${id}`),
        cruceVuelta: obtenerValorCampo(`cruce-vuelta-${id}`),
        motivo: obtenerValorCampo(`motivo-${id}`),
        km: obtenerValorCampo(`km-${id}`),
        alojamiento: obtenerValorCampo(`alojamiento-${id}`),
        noManutencion: obtenerValorCampo(`no-manutencion-${id}`, 'checkbox'),
        otrosGastos: recopilarOtrosGastos(id),
        // Datos calculados (de salidaDesp)
        datosCalculados: detalles ? {
          // Manutención
          numManutenciones: detalles.numManutenciones,
          precioManutencion: detalles.precioManutencion,
          importeManutencion: detalles.importeManutencion,
          // Alojamiento
          numNoches: detalles.numNoches,
          precioNoche: detalles.precioNoche,
          importeMaxAlojamiento: detalles.importeMaxAlojamiento,
          excedeMaxAlojamiento: detalles.excedeMaxAlojamiento,
          // Kilometraje
          precioPorKm: detalles.precioPorKm,
          importeKm: detalles.importeKm,
          // Residencia eventual
          residenciaEventual: detalles.residenciaEventual,
          // IRPF
          irpfSujeto: detalles.irpfSujeto,
          // Total del desplazamiento
          importeTotal: detalles.importeTotal,
          // Segmentos (solo para desplazamientos internacionales)
          segmentos: detalles.segmentos ? detalles.segmentos.map(seg => ({
            titulo: seg.titulo,
            pais: seg.pais,
            numManutenciones: seg.numManutenciones,
            precioManutencion: seg.precioManutencion,
            importeManutencion: seg.importeManutencion,
            numNoches: seg.numNoches,
            precioNoche: seg.precioNoche,
            importeMaxAlojamiento: seg.importeMaxAlojamiento
          })) : null
        } : null
      });
    });

    return desplazamientos;
  }

  /**
   * Recopila los datos del vehículo particular
   * @returns {Object|null}
   */
  function recopilarVehiculo() {
    const tipoVehiculo = document.querySelector('input[name="vehiculo-tipo"]:checked');
    if (!tipoVehiculo) return null;

    return {
      tipo: tipoVehiculo.value,
      marca: obtenerValorCampo('veh-marca'),
      modelo: obtenerValorCampo('veh-modelo'),
      matricula: obtenerValorCampo('veh-matricula'),
      justificarPernocta: obtenerValorCampo('justificar-pernocta', 'checkbox')
    };
  }

  /**
   * Recopila los datos del evento/congreso
   * @returns {Object}
   */
  function recopilarEvento() {
    return {
      nombre: obtenerValorCampo('evento-nombre'),
      lugar: obtenerValorCampo('evento-lugar'),
      fechaDesde: obtenerValorCampo('evento-del'),
      fechaHasta: obtenerValorCampo('evento-al'),
      gastosInscripcion: obtenerValorCampo('evento-gastos'),
      comidasIncluidas: obtenerValorCampo('evento-num-comidas', 'number'),
      desplazamientoAsociado: obtenerValorCampo('evento-asociado'),
      descuentoComidas: obtenerValorCampo('descuento-manut-congreso', 'number')
    };
  }

  /**
   * Recopila los datos de honorarios
   * @returns {Object}
   */
  function recopilarHonorarios() {
    return {
      importe: obtenerValorCampo('honorarios-importe'),
      beneficiario: obtenerValorCampo('honorarios-beneficiario'),
      situacion: obtenerValorCampo('honorarios-situacion'),
      concepto: obtenerValorCampo('honorarios-concepto'),
      domicilio: obtenerValorCampo('honorarios-domicilio')
    };
  }

  /**
   * Recopila los datos de ajustes de liquidación
   * @returns {Object}
   */
  function recopilarAjustes() {
    const ajustes = {
      financiacionMaxima: obtenerValorCampo('financiacion-maxima'),
      descuentos: []
    };

    // Recopilar líneas de descuentos
    const container = document.getElementById('otros-descuentos-container');
    if (container) {
      const lineas = container.querySelectorAll('.descuento-line');
      lineas.forEach(linea => {
        const selectTipo = linea.querySelector('.descuento-tipo');
        const inputMotivo = linea.querySelector('.descuento-motivo');
        const inputImporte = linea.querySelector('.descuento-importe');

        if (selectTipo || inputMotivo || inputImporte) {
          ajustes.descuentos.push({
            tipo: selectTipo?.value || '',
            motivo: inputMotivo?.value || '',
            importe: inputImporte?.value || ''
          });
        }
      });
    }

    return ajustes;
  }

  /**
   * Recopila los datos del resultado de la liquidación.
   * @returns {Object} { totalLiquidacion, irpfTotal }
   */
  function recopilarResultadoLiquidacion() {
    if (!global.resultadoLiquidacion || typeof global.resultadoLiquidacion.calcularResultado !== 'function') {
      return {
        totalLiquidacion: 0,
        irpfTotal: 0
      };
    }
    const resultado = global.resultadoLiquidacion.calcularResultado();
    return {
      totalLiquidacion: resultado.totalLiquidacion || 0,
      irpfTotal: resultado.irpfTotal || 0
    };
  }

  /**
   * Recopila los datos de la fecha de firma
   * @returns {Object}
   */
  function recopilarFechaFirma() {
    const tipo = document.querySelector('input[name="fecha-firma-tipo"]:checked')?.value || 'momento';
    const fechado = tipo === 'fijar';
    
    const resultado = {
      fechado: fechado,
      ciudad: fechado ? obtenerValorCampo('fecha-firma-ciudad') : '',
      fecha: fechado ? obtenerValorCampo('fecha-firma-fecha') : ''
    };
    
    return resultado;
  }

  /**
   * Recopila todos los datos del formulario
   * @returns {Object} Objeto con todos los datos serializados
   */
  function recopilarTodo() {
    return {
      versionEsquema: VERSION_ESQUEMA,
      guardadoEl: new Date().toISOString(),
      
      beneficiario: recopilarBeneficiario(),
      pago: recopilarPago(),
      proyecto: recopilarProyecto(),
      desplazamientos: recopilarDesplazamientos(),
      desplazamientoEspecial: recopilarDesplazamientoEspecial(),
      vehiculo: recopilarVehiculo(),
      evento: recopilarEvento(),
      honorarios: recopilarHonorarios(),
      imputacion: recopilarImputacion(),
      ajustes: recopilarAjustes(),
      resultadoLiquidacion: recopilarResultadoLiquidacion(),
      fechaFirma: recopilarFechaFirma()
    };
  }

  /**
   * Parsea un string numérico en formato europeo (1.234,56 €) a número.
   * @param {string|number} val
   * @returns {number}
   */
  function parseEuroStr(val) {
    if (typeof val === 'number') return val;
    if (!val || typeof val !== 'string') return 0;
    const cleaned = val.replace(/€/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return Number(cleaned) || 0;
  }

  /**
   * Recopila los datos del desplazamiento especial.
   * Calcula y añade el campo `total` (suma de lineas[n].total).
   * @returns {Object|null}
   */
  function recopilarDesplazamientoEspecial() {
    if (global.uiDesplazamientoEspecial && typeof global.uiDesplazamientoEspecial.recopilarDatos === 'function') {
      const datos = global.uiDesplazamientoEspecial.recopilarDatos();
      if (datos && datos.lineas) {
        let suma = 0;
        for (const linea of datos.lineas) {
          if (linea.tipo === 'normal' && linea.total) {
            suma += parseEuroStr(linea.total);
          }
        }
        datos.total = Math.round(suma * 100) / 100;
      }
      return datos;
    }
    return null;
  }

  /**
   * Recopila las líneas de imputación
   * @returns {Array} Array de líneas de imputación
   */
  function recopilarImputacion() {
    if (global.uiImputacion && typeof global.uiImputacion.obtenerLineas === 'function') {
      return global.uiImputacion.obtenerLineas();
    }
    return [];
  }

  // =========================================================================
  // RESTAURACIÓN DE DATOS (Objeto → DOM)
  // =========================================================================

  /**
   * Restaura los datos del beneficiario
   * @param {Object} datos
   */
  function restaurarBeneficiario(datos) {
    if (!datos) return;
    establecerValorCampo('nombre-benef', datos.nombre);
    establecerValorCampo('dni', datos.dni);
    establecerValorCampo('entidad', datos.entidad);
    establecerValorCampo('categoria', datos.categoria);
  }

  /**
   * Restaura los datos de pago
   * @param {Object} datos
   */
  function restaurarPago(datos) {
    if (!datos) return;
    establecerValorCampo('tipo-pago', datos.tipo);
    
    // Disparar evento change para que se actualice la UI
    const tipoPagoEl = document.getElementById('tipo-pago');
    if (tipoPagoEl) {
      tipoPagoEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Esperar a que la UI se actualice antes de establecer IBAN/SWIFT
    setTimeout(() => {
      if (datos.tipo === 'CE' && datos.iban) {
        establecerValorCampo('iban', datos.iban);
      }
      if (datos.tipo === 'CI') {
        if (datos.iban) establecerValorCampo('iban-ext', datos.iban);
        if (datos.swift) establecerValorCampo('swift', datos.swift);
      }
      if (datos.tipo === 'TJ' && datos.tarjeta) {
        establecerValorCampo('numero-tarjeta', datos.tarjeta);
      }
    }, 50);
  }

  /**
   * Restaura los datos del proyecto
   * @param {Object} datos
   */
  function restaurarProyecto(datos) {
    if (!datos) return;
    establecerValorCampo('tipoProyecto', datos.tipo);
    establecerValorCampo('responsable', datos.responsable);
    establecerValorCampo('organica', datos.organica);
    establecerValorCampo('referencia', datos.referencia);

    // Disparar evento change para actualizar info decreto
    const tipoProyectoEl = document.getElementById('tipoProyecto');
    if (tipoProyectoEl) {
      tipoProyectoEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Restaura los otros gastos de un desplazamiento
   * @param {number} despId - ID del desplazamiento
   * @param {Array} gastos - Array de gastos
   */
  function restaurarOtrosGastos(despId, gastos) {
    if (!gastos || gastos.length === 0) return;

    const uiDesp = global.uiDesplazamientos;
    const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${despId}"]`);
    if (!desp || !uiDesp?.crearLineaOtroGasto) return;

    // Asegurar que el contenedor sea visible
    const container = desp.querySelector('.otros-gastos-container');
    if (container) {
      container.style.display = 'block';
    }

    gastos.forEach((gasto) => {
      // Crear línea usando la función del módulo
      const linea = uiDesp.crearLineaOtroGasto(desp);
      if (linea) {
        const selectTipo = linea.querySelector('.otros-gasto-tipo');
        const inputDesc = linea.querySelector('.otros-gasto-desc');
        const inputImporte = linea.querySelector('.otros-gasto-importe');
        
        if (selectTipo) selectTipo.value = gasto.tipo;
        if (inputDesc) inputDesc.value = gasto.concepto;
        if (inputImporte) inputImporte.value = gasto.importe;
      }
    });
  }

  /**
   * Restaura los datos de un desplazamiento
   * @param {Object} desp - Datos del desplazamiento
   * @param {number} indice - Índice en el array (0-based)
   */
  function restaurarDesplazamiento(desp, indice) {
    const id = desp.id;
    
    establecerValorCampo(`fecha-ida-${id}`, desp.fechaIda);
    establecerValorCampo(`hora-ida-${id}`, desp.horaIda);
    establecerValorCampo(`fecha-regreso-${id}`, desp.fechaRegreso);
    establecerValorCampo(`hora-regreso-${id}`, desp.horaRegreso);
    establecerValorCampo(`ticket-cena-${id}`, desp.ticketCena, 'checkbox');
    establecerValorCampo(`origen-${id}`, desp.origen);
    establecerValorCampo(`destino-${id}`, desp.destino);
    establecerValorCampo(`pais-destino-${id}`, desp.paisDestino);
    establecerValorCampo(`cruce-ida-${id}`, desp.cruceIda);
    establecerValorCampo(`cruce-vuelta-${id}`, desp.cruceVuelta);
    establecerValorCampo(`motivo-${id}`, desp.motivo);
    establecerValorCampo(`km-${id}`, desp.km);
    establecerValorCampo(`alojamiento-${id}`, desp.alojamiento);
    establecerValorCampo(`no-manutencion-${id}`, desp.noManutencion, 'checkbox');

    // Disparar evento change en país para mostrar/ocultar fronteras
    const paisEl = document.getElementById(`pais-destino-${id}`);
    if (paisEl) {
      paisEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Restaurar otros gastos
    restaurarOtrosGastos(id, desp.otrosGastos);
  }

  /**
   * Restaura todos los desplazamientos
   * @param {Array} desplazamientos
   * @returns {Promise} Promesa que se resuelve cuando todos los desplazamientos están restaurados
   */
  function restaurarDesplazamientos(desplazamientos) {
    return new Promise((resolve) => {
      if (!desplazamientos || desplazamientos.length === 0) {
        resolve();
        return;
      }

      const uiDesp = global.uiDesplazamientos;
      const contenedor = document.getElementById('desplazamientos-container');
      if (!contenedor) {
        resolve();
        return;
      }

      // Eliminar todos los desplazamientos existentes antes de crear los nuevos
      const gruposExistentes = contenedor.querySelectorAll('.desplazamiento-grupo');
      gruposExistentes.forEach(grupo => {
        const id = grupo.dataset.desplazamientoId;
        // Eliminar del registro de totales
        if (id && global.resultadoLiquidacion?.eliminarDesplazamiento) {
          global.resultadoLiquidacion.eliminarDesplazamiento(id);
        }
        // Eliminar del DOM sin animación
        grupo.remove();
      });

      // Resetear el contador para que los nuevos IDs empiecen desde 1
      if (uiDesp && uiDesp.resetCounter) {
        uiDesp.resetCounter();
      }

      // Crear todos los desplazamientos necesarios
      for (let i = 0; i < desplazamientos.length; i++) {
        if (uiDesp && uiDesp.crearNuevoDesplazamiento) {
          uiDesp.crearNuevoDesplazamiento();
        }
      }

      // Esperar a que se creen los elementos en el DOM
      setTimeout(() => {
        // Obtener los grupos de desplazamiento reales del DOM
        const grupos = contenedor.querySelectorAll('.desplazamiento-grupo');
        
        // Mapa de IDs originales a índices reales (para evento-asociado)
        const mapeoIds = {};
        
        desplazamientos.forEach((desp, idx) => {
          const grupo = grupos[idx];
          if (grupo) {
            // Quitar clase entry para asegurar visibilidad
            grupo.classList.remove('entry');
            
            const idReal = parseInt(grupo.dataset.desplazamientoId, 10);
            
            // Guardar mapeo: "despX" original → "despY" real
            mapeoIds[`desp${desp.id}`] = `desp${idx + 1}`;
            
            // Crear copia del objeto con el ID correcto
            const despConIdReal = { ...desp, id: idReal };
            restaurarDesplazamiento(despConIdReal, idx);
          }
        });

        // Actualizar números
        if (uiDesp && uiDesp.actualizarNumerosDesplazamientos) {
          uiDesp.actualizarNumerosDesplazamientos();
        }
        
        // Devolver el mapeo para uso posterior
        global.__tempMapeoDesplazamientos = mapeoIds;
        
        resolve();
      }, 150);
    });
  }

  /**
   * Restaura los datos del vehículo
   * @param {Object} datos
   * @param {number} delay - Tiempo de espera antes de restaurar
   */
  function restaurarVehiculo(datos, delay = 150) {
    if (!datos) return;

    // El contenedor de vehículo se genera dinámicamente por evaluarKmParaMostrarFicha
    setTimeout(() => {
      const radio = document.querySelector(`input[name="vehiculo-tipo"][value="${datos.tipo}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
      establecerValorCampo('veh-marca', datos.marca);
      establecerValorCampo('veh-modelo', datos.modelo);
      establecerValorCampo('veh-matricula', datos.matricula);
      establecerValorCampo('justificar-pernocta', datos.justificarPernocta, 'checkbox');
    }, delay);
  }

  /**
   * Restaura los datos del evento
   * @param {Object} datos
   */
  function restaurarEvento(datos) {
    if (!datos) return;
    establecerValorCampo('evento-nombre', datos.nombre);
    establecerValorCampo('evento-lugar', datos.lugar);
    establecerValorCampo('evento-del', datos.fechaDesde);
    establecerValorCampo('evento-al', datos.fechaHasta);
    establecerValorCampo('evento-gastos', datos.gastosInscripcion);
    establecerValorCampo('evento-num-comidas', datos.comidasIncluidas);
    establecerValorCampo('descuento-manut-congreso', datos.descuentoComidas);
    
    // Usar el mapeo de IDs si existe
    let desplazamientoAsociado = datos.desplazamientoAsociado;
    if (global.__tempMapeoDesplazamientos && datos.desplazamientoAsociado) {
      const mapeado = global.__tempMapeoDesplazamientos[datos.desplazamientoAsociado];
      if (mapeado) {
        desplazamientoAsociado = mapeado;
      }
    }
    establecerValorCampo('evento-asociado', desplazamientoAsociado);
  }

  /**
   * Restaura los datos de honorarios
   * @param {Object} datos
   */
  function restaurarHonorarios(datos) {
    if (!datos) return;
    establecerValorCampo('honorarios-importe', datos.importe);
    establecerValorCampo('honorarios-beneficiario', datos.beneficiario);
    establecerValorCampo('honorarios-situacion', datos.situacion);
    establecerValorCampo('honorarios-concepto', datos.concepto);
    establecerValorCampo('honorarios-domicilio', datos.domicilio);
  }

  /**
   * Restaura los datos de ajustes de liquidación
   * @param {Object} datos
   */
  function restaurarAjustes(datos) {
    if (!datos) return;

    // Restaurar financiación máxima
    establecerValorCampo('financiacion-maxima', datos.financiacionMaxima);

    // Restaurar líneas de descuentos
    if (datos.descuentos && Array.isArray(datos.descuentos) && datos.descuentos.length > 0) {
      const container = document.getElementById('otros-descuentos-container');
      if (container && global.uiAjustes) {
        // Limpiar líneas existentes
        container.innerHTML = '';

        datos.descuentos.forEach(descuento => {
          const linea = global.uiAjustes.crearLineaDescuento();
          container.appendChild(linea);

          // Establecer valores
          const selectTipo = linea.querySelector('.descuento-tipo');
          const inputMotivo = linea.querySelector('.descuento-motivo');
          const inputImporte = linea.querySelector('.descuento-importe');

          if (selectTipo) selectTipo.value = descuento.tipo || '';
          if (inputMotivo) inputMotivo.value = descuento.motivo || '';
          if (inputImporte) inputImporte.value = descuento.importe || '';
        });

        // Actualizar visibilidad del botón según límites
        if (global.uiAjustes.actualizarBotonAddDescuento) {
          global.uiAjustes.actualizarBotonAddDescuento();
        }
      }
    }

    // Actualizar registro de descuentos y recalcular el resultado
    if (global.resultadoLiquidacion) {
      if (global.resultadoLiquidacion.actualizarFinanciacionMaxima) {
        global.resultadoLiquidacion.actualizarFinanciacionMaxima();
      }
      if (global.resultadoLiquidacion.actualizarDescuentosAjustes) {
        global.resultadoLiquidacion.actualizarDescuentosAjustes();
      }
      if (global.resultadoLiquidacion.renderResultado) {
        global.resultadoLiquidacion.renderResultado();
      }
    }
  }

  /**
   * Restaura los datos de la fecha de firma
   * @param {Object} datos
   */
  function restaurarFechaFirma(datos) {
    if (!datos) return;
    
    // Restaurar tipo de fecha de firma basado en el booleano 'fechado'
    const fechado = datos.fechado === true;
    const radioMomento = document.getElementById('fecha-firma-momento');
    const radioFijar = document.getElementById('fecha-firma-fijar');
    
    if (fechado && radioFijar) {
      radioFijar.checked = true;
    } else if (!fechado && radioMomento) {
      radioMomento.checked = true;
    }
    
    // Restaurar campos de fecha fija si es necesario
    if (fechado) {
      establecerValorCampo('fecha-firma-ciudad', datos.ciudad);
      establecerValorCampo('fecha-firma-fecha', datos.fecha);
      // Mostrar los campos
      const camposDiv = document.getElementById('fecha-firma-campos');
      if (camposDiv) {
        camposDiv.style.display = '';
      }
    } else {
      // Ocultar los campos si es momento
      const camposDiv = document.getElementById('fecha-firma-campos');
      if (camposDiv) {
        camposDiv.style.display = 'none';
      }
    }
  }

  /**
   * Verifica si una sección tiene contenido
   * @param {string} sectionId - Identificador de la sección
   * @param {Object} datos - Datos cargados
   * @returns {boolean}
   */
  function seccionTieneContenido(sectionId, datos) {
    if (sectionId === 'evento' || sectionId === 'congresos') {
      const e = datos.evento;
      return e && (e.nombre || e.lugar || e.fechaDesde || e.fechaHasta || e.gastosInscripcion);
    }
    if (sectionId === 'honorarios') {
      const h = datos.honorarios;
      return h && (h.importe || h.concepto);
    }
    if (sectionId === 'ajustes') {
      const a = datos.ajustes;
      return a && (a.financiacionMaxima || (a.descuentos && a.descuentos.length > 0));
    }
    return false;
  }

  /**
   * Abre una sección colapsada
   * @param {HTMLElement} sectionTitle - Elemento .section-title
   */
  function abrirSeccion(sectionTitle) {
    if (!sectionTitle) return;
    const wrapper = sectionTitle.nextElementSibling;
    const icon = sectionTitle.querySelector('.toggle-section');
    const content = wrapper?.querySelector('.section-content');
    
    if (wrapper && content) {
      wrapper.classList.remove('collapsed');
      wrapper.style.maxHeight = content.scrollHeight + 'px';
      if (icon) icon.classList.add('open');
      sectionTitle.setAttribute('aria-expanded', 'true');
      wrapper.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Despliega las secciones que tienen contenido
   * @param {Object} datos - Datos restaurados
   */
  function desplegarSeccionesConContenido(datos) {
    // Buscar secciones colapsables
    const secciones = document.querySelectorAll('.section-title[data-start-collapsed="true"]');
    
    secciones.forEach(title => {
      const texto = title.textContent.toLowerCase();
      let tieneContenido = false;
      
      if (texto.includes('congreso') || texto.includes('evento')) {
        tieneContenido = seccionTieneContenido('evento', datos);
      } else if (texto.includes('honorario')) {
        tieneContenido = seccionTieneContenido('honorarios', datos);
      } else if (texto.includes('ajuste')) {
        tieneContenido = seccionTieneContenido('ajustes', datos);
      }
      
      if (tieneContenido) {
        abrirSeccion(title);
      }
    });
  }

  /**
   * Restaura los datos del resultado de la liquidación.
   * Nota: Los valores son calculados automáticamente, esta función es un placeholder.
   * @param {Object} datos
   */
  function restaurarResultadoLiquidacion(datos) {
    // Los valores de resultado de liquidación se calculan automáticamente
    // por resultadoLiquidacion.js cuando se actualiza cualquier campo
    // Esta función es un placeholder para mantener consistencia
  }

  /**
   * Restaura todos los datos del formulario
   * @param {Object} datos - Objeto con todos los datos
   * @returns {Promise<boolean>} true si se restauró correctamente
   */
  async function restaurarTodo(datos) {
    if (!datos) {
      console.error('[serializacionDatos] No hay datos para restaurar');
      return false;
    }

    // Verificar versión del esquema
    if (datos.versionEsquema !== VERSION_ESQUEMA) {
      console.warn(`[serializacionDatos] Versión diferente: archivo=${datos.versionEsquema}, app=${VERSION_ESQUEMA}`);
      const continuar = confirm(
        `El archivo fue guardado con una versión diferente del esquema.\n` +
        `Archivo: ${datos.versionEsquema}\n` +
        `Aplicación: ${VERSION_ESQUEMA}\n\n` +
        `¿Desea intentar cargarlo de todos modos?`
      );
      if (!continuar) return false;
    }

    // Limpiar formulario completo antes de restaurar
    if (global.formLogic?.limpiarFormularioCompleto) {
      global.formLogic.limpiarFormularioCompleto();
    }

    // Restaurar cada sección (orden importante)
    restaurarBeneficiario(datos.beneficiario);
    restaurarPago(datos.pago);
    restaurarProyecto(datos.proyecto);
    
    // Restaurar desplazamientos (asíncrono)
    await restaurarDesplazamientos(datos.desplazamientos);
    
    // Esperar un poco más para que el DOM se actualice completamente
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Restaurar evento (después de desplazamientos para tener el mapeo)
    restaurarEvento(datos.evento);
    restaurarHonorarios(datos.honorarios);
    restaurarAjustes(datos.ajustes);

    // Restaurar desplazamiento especial
    if (datos.desplazamientoEspecial && global.uiDesplazamientoEspecial?.restaurarDatos) {
      global.uiDesplazamientoEspecial.restaurarDatos(datos.desplazamientoEspecial);
    }

    // Restaurar resultado de liquidación (recalculará automáticamente)
    restaurarResultadoLiquidacion(datos.resultadoLiquidacion);

    // Restaurar fecha de firma
    restaurarFechaFirma(datos.fechaFirma);

    // Tareas post-restauración
    setTimeout(() => {
      // 1. Mostrar ficha de vehículo si hay km (o si hay desplazamiento especial)
      if (global.uiDesplazamientos?.evaluarKmParaMostrarFicha) {
        global.uiDesplazamientos.evaluarKmParaMostrarFicha();
      }
      
      // 2. Restaurar vehículo DESPUÉS de que la ficha esté visible
      restaurarVehiculo(datos.vehiculo, 100);
      
      // 3. Desplegar secciones con contenido
      desplegarSeccionesConContenido(datos);
      
      // 4. Calcular descuento por comidas de congreso
      if (typeof global.computeDescuentoManutencion === 'function') {
        global.computeDescuentoManutencion();
      }
      
      // 5. Actualizar registro de honorarios y gastos de inscripción
      if (global.resultadoLiquidacion) {
        if (typeof global.resultadoLiquidacion.actualizarHonorarios === 'function') {
          global.resultadoLiquidacion.actualizarHonorarios();
        }
        if (typeof global.resultadoLiquidacion.actualizarGastosInscripcion === 'function') {
          global.resultadoLiquidacion.actualizarGastosInscripcion();
        }
      }
      
      // 6. Recalcular todo
      if (global.logicaDesp?.scheduleFullRecalc) {
        global.logicaDesp.scheduleFullRecalc(0);
      }
      
      // 7. Restaurar imputación (después de recalcular para tener el total correcto)
      setTimeout(() => {
        if (global.uiImputacion && typeof global.uiImputacion.restaurarLineas === 'function') {
          global.uiImputacion.restaurarLineas(datos.imputacion);
        }
      }, 100);
      
      // 8. Limpiar mapeo temporal
      delete global.__tempMapeoDesplazamientos;
      
      console.log('[serializacionDatos] Datos restaurados y recalculados correctamente');
    }, 300);

    return true;
  }

  // =========================================================================
  // EXPORTAR / IMPORTAR ARCHIVO
  // =========================================================================

  /**
   * Exporta los datos a un archivo .dta mostrando diálogo para el nombre
   */
  async function exportarArchivo() {
    const datos = recopilarTodo();
    const json = JSON.stringify(datos, null, 2);
    
    // Generar nombre por defecto sin extensión
    const nombreCompleto = generarNombreArchivo();
    const nombreSinExt = nombreCompleto.replace(/\.dta$/, '');
    
    // Mostrar diálogo para que el usuario pueda cambiar el nombre
    const showPrompt = global.showPrompt || global.confirmDialog?.showPrompt;
    if (!showPrompt) {
      console.error('[serializacionDatos] showPrompt no disponible');
      return;
    }
    
    const nombreUsuario = await showPrompt('Nombre del archivo:', {
      defaultValue: nombreSinExt,
      suffix: '.dta',
      confirmText: 'Guardar',
      cancelText: 'Cancelar',
      maxLength: 80
    });
    
    // Si el usuario canceló, no hacer nada
    if (nombreUsuario === null) {
      console.log('[serializacionDatos] Guardado cancelado por el usuario');
      return;
    }
    
    // Construir nombre final
    const nombreFinal = `${nombreUsuario}.dta`;
    
    // Descargar archivo
    const blob = new Blob([json], { type: 'application/json' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombreFinal;
    
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    
    URL.revokeObjectURL(enlace.href);
    
    console.log(`[serializacionDatos] Archivo exportado: ${nombreFinal}`);
  }

  /**
   * Importa datos desde un archivo .dta
   * @param {File} archivo - Archivo seleccionado
   * @returns {Promise<boolean>}
   */
  function importarArchivo(archivo) {
    return new Promise((resolve, reject) => {
      if (!archivo) {
        reject(new Error('No se seleccionó ningún archivo'));
        return;
      }

      // Verificar extensión (.dta o .json para compatibilidad con Android)
      const nombreLower = archivo.name.toLowerCase();
      if (!nombreLower.endsWith('.dta') && !nombreLower.endsWith('.json')) {
        reject(new Error('El archivo debe tener extensión .dta o .json'));
        return;
      }

      const lector = new FileReader();
      
      lector.onload = async (e) => {
        try {
          const datos = JSON.parse(e.target.result);
          const exito = await restaurarTodo(datos);
          resolve(exito);
        } catch (error) {
          reject(new Error(`Error al leer el archivo: ${error.message}`));
        }
      };

      lector.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };

      lector.readAsText(archivo);
    });
  }

  /**
   * Abre el diálogo de selección de archivo para importar
   */
  function abrirDialogoImportar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dta,.json';
    
    input.onchange = async (e) => {
      const archivo = e.target.files[0];
      if (archivo) {
        try {
          await importarArchivo(archivo);
          alert('Datos cargados correctamente');
        } catch (error) {
          alert(`Error: ${error.message}`);
        }
      }
    };
    
    input.click();
  }

  // =========================================================================
  // EXPORTACIÓN DEL MÓDULO
  // =========================================================================

  const serializacionDatos = {
    inicializar,
    recopilarTodo,
    restaurarTodo,
    exportarArchivo,
    importarArchivo,
    abrirDialogoImportar,
    generarNombreArchivo
  };

  global.serializacionDatos = serializacionDatos;

})(typeof window !== 'undefined' ? window : this);
