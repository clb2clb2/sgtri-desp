/**
 * calendarioFechas.js
 * ====================
 * Añade a cada campo de fecha (.input-fecha) un botón que abre el calendario nativo
 * del navegador. La escritura con teclado no cambia: el campo sigue siendo de texto,
 * no se le añade ningún listener y el botón queda fuera del orden de tabulación.
 *
 * Al elegir un día se escribe dd/mm/aa en el campo y se le da y quita el foco, para
 * que el formateo, las validaciones y el recálculo sean los mismos que al teclear.
 *
 * @module calendarioFechas
 * @requires limpiaDatos
 */
(function (global) {
  'use strict';

  // Sin showPicker() (navegadores antiguos) no se añade nada: el formulario queda como antes
  const soportado = typeof HTMLInputElement !== 'undefined' &&
    typeof HTMLInputElement.prototype.showPicker === 'function';

  const ICONO = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  /** Date → 'yyyy-mm-dd' (valor de input[type=date]) */
  function aIso(fecha) {
    return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}-${pad2(fecha.getDate())}`;
  }

  /** 'yyyy-mm-dd' → 'dd/mm/aa' (formato de los campos de la app) */
  function deIso(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(-2)}`;
  }

  /**
   * Fecha con la que se abre el calendario: la del propio campo o, si está vacío,
   * la primera fecha ya escrita en la misma ficha o formulario (normalmente la de salida).
   */
  function fechaInicial(campo) {
    const parse = global.limpiaDatos.parseDateStrict;
    const propia = parse(campo.value);
    if (propia) return propia;
    const ambito = campo.closest('.desplazamiento-grupo, form');
    if (!ambito) return null;
    for (const otro of ambito.querySelectorAll('.input-fecha')) {
      const f = otro !== campo && parse(otro.value);
      if (f) return f;
    }
    return null;
  }

  /**
   * Crea el <input type="date"> oculto de un campo. Va dentro del propio recuadro del campo,
   * así el navegador abre el calendario junto a él sin tener que recolocar nada al hacer clic.
   */
  function crearSelector(campo) {
    const selector = document.createElement('input');
    selector.type = 'date';
    selector.className = 'calendario-selector';
    selector.tabIndex = -1;
    selector.setAttribute('aria-hidden', 'true');
    selector.addEventListener('change', () => {
      if (!selector.value) return;
      campo.value = deIso(selector.value);
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      // Mismo recorrido que al terminar de escribir: foco y salida del campo
      campo.focus();
      campo.blur();
    });
    return selector;
  }

  function abrirCalendario(campo, selector) {
    if (campo.disabled || campo.readOnly) return;
    const inicial = fechaInicial(campo);
    selector.value = inicial ? aIso(inicial) : '';
    try {
      selector.showPicker();
    } catch (e) {
      console.warn('[calendarioFechas] No se pudo abrir el calendario:', e);
    }
  }

  /** Envuelve el campo y le añade el botón del calendario (una sola vez por campo). */
  function decorarCampo(campo) {
    if (campo.dataset.calendario === '1') return;
    campo.dataset.calendario = '1';

    const envoltorio = document.createElement('span');
    envoltorio.className = 'fecha-con-calendario';
    campo.parentNode.insertBefore(envoltorio, campo);
    envoltorio.appendChild(campo);

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn-calendario';
    boton.tabIndex = -1;
    boton.title = 'Elegir en el calendario';
    boton.setAttribute('aria-label', 'Elegir fecha en el calendario');
    boton.innerHTML = ICONO;
    // mousedown sin foco: el campo no pierde ni gana el foco al pulsar el botón
    boton.addEventListener('mousedown', (e) => e.preventDefault());
    const selector = crearSelector(campo);
    boton.addEventListener('click', () => abrirCalendario(campo, selector));
    envoltorio.appendChild(boton);
    envoltorio.appendChild(selector);
  }

  function decorar(raiz) {
    if (raiz.nodeType !== 1) return;
    if (raiz.matches('.input-fecha')) decorarCampo(raiz);
    raiz.querySelectorAll('.input-fecha').forEach(decorarCampo);
  }

  function init() {
    if (!soportado) return;
    decorar(document.body);
    // Fichas y campos que se crean después (desplazamientos nuevos, carga de .dta)
    new MutationObserver((cambios) => {
      cambios.forEach(c => c.addedNodes.forEach(decorar));
    }).observe(document.body, { childList: true, subtree: true });
  }

  global.calendarioFechas = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : this);
