/**
 * tipoLiquidacion.js
 * ==================
 * Gestión del modo/tipo de liquidación y menú inicial.
 *
 * Tipos soportados:
 * - DESPL: solo desplazamientos
 * - CONGR: congresos + 1 desplazamiento
 * - HONOR: honorarios + 1 desplazamiento
 * - GNRAL: modo completo
 */
(function (global) {
  'use strict';

  const TIPOS = {
    DESPL: 'DESPL',
    CONGR: 'CONGR',
    HONOR: 'HONOR',
    GNRAL: 'GNRAL'
  };

  const CONFIG = {
    DESPL: { mostrarEventos: false, mostrarHonorarios: false, maxDesplazamientos: null, permitirEspecial: false },
    CONGR: { mostrarEventos: true, mostrarHonorarios: false, maxDesplazamientos: 1, permitirEspecial: false },
    HONOR: { mostrarEventos: false, mostrarHonorarios: true, maxDesplazamientos: 1, permitirEspecial: false },
    GNRAL: { mostrarEventos: true, mostrarHonorarios: true, maxDesplazamientos: null, permitirEspecial: true }
  };

  let tipoActual = null;

  function normalizarTipo(tipo) {
    if (!tipo) return TIPOS.GNRAL;
    const t = String(tipo).trim().toUpperCase();
    if (t === TIPOS.DESPL || t === TIPOS.CONGR || t === TIPOS.HONOR || t === TIPOS.GNRAL) {
      return t;
    }
    return TIPOS.GNRAL;
  }

  function getSectionById(sectionId) {
    return document.querySelector(`.form-section[data-section-id="${sectionId}"]`);
  }

  function mostrarFormulario() {
    const actionsBar = document.getElementById('actions-bar');
    const formWrapper = document.getElementById('form-sections-wrapper');
    const menuInicio = document.getElementById('tipo-liquidacion-inicio');

    if (actionsBar) actionsBar.classList.remove('app-hidden');
    if (formWrapper) formWrapper.classList.remove('app-hidden');
    if (menuInicio) menuInicio.style.display = 'none';
  }

  function mostrarMenuInicial() {
    const actionsBar = document.getElementById('actions-bar');
    const formWrapper = document.getElementById('form-sections-wrapper');
    const menuInicio = document.getElementById('tipo-liquidacion-inicio');

    if (actionsBar) actionsBar.classList.add('app-hidden');
    if (formWrapper) formWrapper.classList.add('app-hidden');
    if (menuInicio) {
      menuInicio.classList.add('fade-enter');
      menuInicio.style.display = '';
      void menuInicio.offsetWidth;
      requestAnimationFrame(() => {
        menuInicio.classList.remove('fade-enter');
      });
    }
  }

  function aplicarModoUI(tipo) {
    const tipoNormalizado = normalizarTipo(tipo);
    const cfg = CONFIG[tipoNormalizado];

    const secEventos = getSectionById('eventos');
    const secHonorarios = getSectionById('honorarios');

    if (secEventos) secEventos.style.display = cfg.mostrarEventos ? '' : 'none';
    if (secHonorarios) secHonorarios.style.display = cfg.mostrarHonorarios ? '' : 'none';

    if (global.uiDesplazamientos?.setMaxDesplazamientosOverride) {
      global.uiDesplazamientos.setMaxDesplazamientosOverride(cfg.maxDesplazamientos);
    }

    if (global.uiDesplazamientos?.setPermitirDesplazamientoEspecial) {
      global.uiDesplazamientos.setPermitirDesplazamientoEspecial(cfg.permitirEspecial);
    }

    if (!cfg.permitirEspecial && global.uiDesplazamientoEspecial?.existe?.()) {
      if (global.uiDesplazamientoEspecial?.reset) {
        global.uiDesplazamientoEspecial.reset();
      }
    }

    if (global.uiDesplazamientos?.actualizarBotonAddDesplazamiento) {
      global.uiDesplazamientos.actualizarBotonAddDesplazamiento();
    }

    tipoActual = tipoNormalizado;
    global.__sgtriTipoLiquidacion = tipoActual;
  }

  function seleccionarTipo(tipo) {
    aplicarModoUI(tipo);
    mostrarFormulario();
  }

  function aplicarModoDesdeArchivo(tipo) {
    seleccionarTipo(tipo);
  }

  function getTipoActual() {
    return normalizarTipo(tipoActual || global.__sgtriTipoLiquidacion || TIPOS.GNRAL);
  }

  function volverAlMenuInicial() {
    tipoActual = null;
    delete global.__sgtriTipoLiquidacion;
    mostrarMenuInicial();
  }

  function init() {
    const btnDespl = document.getElementById('btn-inicio-despl');
    const btnCongr = document.getElementById('btn-inicio-congr');
    const btnHonor = document.getElementById('btn-inicio-honor');
    const btnCargar = document.getElementById('btn-inicio-cargar');

    if (btnDespl) {
      btnDespl.addEventListener('click', (e) => {
        if (e.shiftKey) {
          seleccionarTipo(TIPOS.GNRAL);
          return;
        }
        seleccionarTipo(TIPOS.DESPL);
      });
    }

    if (btnCongr) {
      btnCongr.addEventListener('click', () => {
        seleccionarTipo(TIPOS.CONGR);
      });
    }

    if (btnHonor) {
      btnHonor.addEventListener('click', () => {
        seleccionarTipo(TIPOS.HONOR);
      });
    }

    if (btnCargar) {
      btnCargar.addEventListener('click', () => {
        if (global.serializacionDatos?.abrirDialogoImportar) {
          global.serializacionDatos.abrirDialogoImportar();
        }
      });
    }
  }

  global.tipoLiquidacion = {
    TIPOS,
    init,
    normalizarTipo,
    seleccionarTipo,
    aplicarModoUI,
    aplicarModoDesdeArchivo,
    getTipoActual,
    volverAlMenuInicial
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : this);
