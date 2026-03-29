/**
 * tipoLiquidacion.js
 * ==================
 * Gestión del modo/tipo de liquidación y menú inicial.
 *
 * Tipos soportados:
 * - DESPL: solo desplazamientos
 * - CONGR: congresos + 1 desplazamiento
 * - HONOR: honorarios + 1 desplazamiento
 * - AECC: igual que DESPL pero sin sección de desplazamientos
 * - GNRAL: modo completo
 */
(function (global) {
  'use strict';

  const TIPOS = {
    DESPL: 'DESPL',
    CONGR: 'CONGR',
    HONOR: 'HONOR',
    AECC: 'AECC',
    GNRAL: 'GNRAL'
  };

  const AECC_PROYECTO = {
    value: 'Reto AECC 70% Supervivencia',
    label: 'Reto AECC 70% Supervivencia'
  };

  const CONFIG = {
    DESPL: { mostrarEventos: false, mostrarHonorarios: false, mostrarDesplazamientos: true, mostrarAeccDesplazamiento: false, maxDesplazamientos: null, permitirEspecial: false },
    CONGR: { mostrarEventos: true, mostrarHonorarios: false, mostrarDesplazamientos: true, mostrarAeccDesplazamiento: false, maxDesplazamientos: 1, permitirEspecial: false },
    HONOR: { mostrarEventos: false, mostrarHonorarios: true, mostrarDesplazamientos: true, mostrarAeccDesplazamiento: false, maxDesplazamientos: 1, permitirEspecial: false },
    AECC: { mostrarEventos: false, mostrarHonorarios: false, mostrarDesplazamientos: false, mostrarAeccDesplazamiento: true, maxDesplazamientos: null, permitirEspecial: false },
    GNRAL: { mostrarEventos: true, mostrarHonorarios: true, mostrarDesplazamientos: true, mostrarAeccDesplazamiento: false, maxDesplazamientos: null, permitirEspecial: true }
  };

  let tipoActual = null;

  function normalizarTipo(tipo) {
    if (!tipo) return TIPOS.GNRAL;
    const t = String(tipo).trim().toUpperCase();
    if (t === TIPOS.DESPL || t === TIPOS.CONGR || t === TIPOS.HONOR || t === TIPOS.AECC || t === TIPOS.GNRAL) {
      return t;
    }
    return TIPOS.GNRAL;
  }

  function getSectionById(sectionId) {
    return document.querySelector(`.form-section[data-section-id="${sectionId}"]`);
  }

  function abrirSeccion(sectionId) {
    const section = getSectionById(sectionId);
    if (!section) return;

    const title = section.querySelector('.section-title');
    const wrapper = section.querySelector('.section-content-wrapper');
    const content = wrapper?.querySelector('.section-content');
    const icon = title?.querySelector('.toggle-section');

    if (!title || !wrapper || !content) return;

    wrapper.classList.remove('collapsed');
    wrapper.style.maxHeight = content.scrollHeight + 'px';
    wrapper.setAttribute('aria-hidden', 'false');
    title.setAttribute('aria-expanded', 'true');
    if (icon) icon.classList.add('open');
  }

  function reordenarSeccionesPrincipales() {
    const wrapper = document.getElementById('form-sections-wrapper');
    const secDesplazamientos = getSectionById('desplazamientos');
    const secEventos = getSectionById('eventos');
    const secHonorarios = getSectionById('honorarios');

    if (!wrapper || !secDesplazamientos || !secEventos || !secHonorarios) return;

    wrapper.insertBefore(secEventos, secDesplazamientos);
    wrapper.insertBefore(secHonorarios, secDesplazamientos);
  }

  function aplicarRestriccionesProyectoPorTipo(tipo) {
    const tipoNormalizado = normalizarTipo(tipo);
    const tipoProyectoEl = document.getElementById('tipoProyecto');
    const infoDecretoEl = document.getElementById('infoDecreto');
    if (!tipoProyectoEl) return;

    if (tipoNormalizado === TIPOS.AECC) {
      const previo = tipoProyectoEl.dataset.prevTipoProyecto;
      if (typeof previo === 'undefined') {
        tipoProyectoEl.dataset.prevTipoProyecto = tipoProyectoEl.value || '';
      }

      let optAecc = tipoProyectoEl.querySelector('option[data-aecc-proyecto="true"]');
      if (!optAecc) {
        optAecc = document.createElement('option');
        optAecc.value = AECC_PROYECTO.value;
        optAecc.textContent = AECC_PROYECTO.label;
        optAecc.dataset.aeccProyecto = 'true';
        tipoProyectoEl.appendChild(optAecc);
      }

      tipoProyectoEl.value = AECC_PROYECTO.value;
      tipoProyectoEl.disabled = true;
      if (infoDecretoEl) {
        infoDecretoEl.style.display = 'none';
      }
      tipoProyectoEl.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    tipoProyectoEl.disabled = false;
    if (infoDecretoEl) {
      infoDecretoEl.style.display = '';
    }

    const previo = tipoProyectoEl.dataset.prevTipoProyecto;
    if (previo) {
      const existePrevio = Array.from(tipoProyectoEl.options).some((o) => o.value === previo);
      if (existePrevio) {
        tipoProyectoEl.value = previo;
      }
    }

    delete tipoProyectoEl.dataset.prevTipoProyecto;
    tipoProyectoEl.dispatchEvent(new Event('change', { bubbles: true }));
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
    const secDesplazamientos = getSectionById('desplazamientos');
    const secAeccDesplazamiento = getSectionById('aecc-desplazamiento');

    if (secEventos) secEventos.style.display = cfg.mostrarEventos ? '' : 'none';
    if (secHonorarios) secHonorarios.style.display = cfg.mostrarHonorarios ? '' : 'none';
    if (secDesplazamientos) secDesplazamientos.style.display = cfg.mostrarDesplazamientos ? '' : 'none';
    if (secAeccDesplazamiento) secAeccDesplazamiento.style.display = cfg.mostrarAeccDesplazamiento ? '' : 'none';

    if (!cfg.mostrarAeccDesplazamiento && global.uiDesplazamientoAecc?.reset) {
      global.uiDesplazamientoAecc.reset();
    }

    if (tipoNormalizado === TIPOS.CONGR) {
      abrirSeccion('eventos');
    }
    if (tipoNormalizado === TIPOS.HONOR) {
      abrirSeccion('honorarios');
    }
    if (tipoNormalizado === TIPOS.AECC) {
      abrirSeccion('aecc-desplazamiento');
    }

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

    aplicarRestriccionesProyectoPorTipo(tipoNormalizado);

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
    reordenarSeccionesPrincipales();

    const btnDespl = document.getElementById('btn-inicio-despl');
    const btnCongr = document.getElementById('btn-inicio-congr');
    const btnHonor = document.getElementById('btn-inicio-honor');
    const btnAecc = document.getElementById('btn-inicio-aecc');
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

    if (btnAecc) {
      btnAecc.addEventListener('click', (e) => {
        if (!e.shiftKey) {
          return;
        }
        seleccionarTipo(TIPOS.AECC);
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
