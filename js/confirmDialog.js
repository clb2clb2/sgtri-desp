/**
 * confirmDialog.js
 * =================
 * Modal de confirmación reutilizable basado en promesas.
 * Proporciona una alternativa elegante a window.confirm().
 *
 * @module confirmDialog
 */
(function (global) {
  'use strict';

  /**
   * Muestra un diálogo modal de confirmación.
   * @param {string} message - Mensaje a mostrar en el diálogo
   * @param {Object} [options] - Opciones de configuración
   * @param {string} [options.confirmText='Eliminar'] - Texto del botón de confirmar
   * @param {string} [options.cancelText='Cancelar'] - Texto del botón de cancelar
   * @param {string} [options.confirmClass='btn-confirm-yes'] - Clase CSS del botón confirmar
   * @param {string} [options.cancelClass='btn-confirm-no'] - Clase CSS del botón cancelar
   * @returns {Promise<boolean>} Promesa que resuelve a true si se confirma, false si se cancela
   *
   * @example
   * const confirmed = await showConfirm('¿Eliminar este elemento?');
   * if (confirmed) {
   *   // Proceder con la eliminación
   * }
   */
  /**
   * Escapa texto para insertarlo en HTML (contenido o atributo).
   * @param {*} valor
   * @returns {string}
   */
  function escapeHtml(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escapa un mensaje y convierte los saltos de línea en <br>.
   * @param {*} mensaje
   * @returns {string}
   */
  function mensajeHtml(mensaje) {
    return escapeHtml(mensaje).replace(/\r?\n/g, '<br>');
  }

  /**
   * HTML del icono de un diálogo: 'aviso' (triángulo) o 'exito' (círculo con ✓), de Lucide.
   * Se aceptan también los emojis antiguos ⚠️ y ✅; cualquier otro texto se muestra tal cual.
   * @param {string} icon
   * @returns {string}
   */
  function iconoDialogoHtml(icon) {
    if (icon === 'aviso' || icon === '⚠️') return global.utils.iconoSvg('triangle-alert');
    if (icon === 'exito' || icon === '✅') return global.utils.iconoSvg('circle-check');
    return escapeHtml(icon);
  }

  function showConfirm(message, options = {}) {
    return new Promise(resolve => {
      const {
        confirmText = 'Eliminar',
        cancelText = 'Cancelar',
        confirmClass = 'btn-confirm-yes',
        cancelClass = 'btn-confirm-no',
        icon = ''
      } = options;

      // Crear overlay
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.tabIndex = -1;
      const iconHtml = icon ? `<div class="confirm-icon">${iconoDialogoHtml(icon)}</div>` : '';
      overlay.innerHTML = `
        <div class="confirm-dialog" role="dialog" aria-modal="true">
          ${iconHtml}
          <div class="confirm-body">${mensajeHtml(message)}</div>
          <div class="confirm-actions">
            <button class="${escapeHtml(confirmClass)}" data-accion="confirmar">${escapeHtml(confirmText)}</button>
            <button class="${escapeHtml(cancelClass)}" data-accion="cancelar">${escapeHtml(cancelText)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const yesBtn = overlay.querySelector('[data-accion="confirmar"]');
      const noBtn = overlay.querySelector('[data-accion="cancelar"]');

      // Prevenir scroll del body
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Animación de entrada
      requestAnimationFrame(() => {
        overlay.classList.add('visible');
      });

      /**
       * Limpia el diálogo y resuelve la promesa.
       * @param {boolean} result - Resultado de la confirmación
       */
      function cleanup(result) {
        // Iniciar animación de salida
        overlay.classList.remove('visible');

        const onTransitionEnd = () => {
          document.body.style.overflow = originalOverflow;
          if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          resolve(result);
        };

        // Esperar transición o timeout de fallback
        overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
        setTimeout(onTransitionEnd, 220);
      }

      // Event listeners
      yesBtn.addEventListener('click', () => cleanup(true));
      noBtn.addEventListener('click', () => cleanup(false));

      // Click fuera del diálogo
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });

      // Tecla Escape
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cleanup(false);
        // Tab trap básico
        if (e.key === 'Tab') {
          const focusables = overlay.querySelectorAll('button');
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });

      // Enfocar el botón de confirmar
      setTimeout(() => yesBtn.focus(), 120);
    });
  }

  /**
   * Muestra un diálogo modal con un campo de entrada de texto.
   * @param {string} message - Mensaje/etiqueta a mostrar
   * @param {Object} [options] - Opciones de configuración
   * @param {string} [options.defaultValue=''] - Valor por defecto del campo
   * @param {string} [options.placeholder=''] - Placeholder del campo
   * @param {string} [options.suffix=''] - Sufijo fijo (ej: extensión de archivo)
   * @param {string} [options.confirmText='Aceptar'] - Texto del botón de confirmar
   * @param {string} [options.cancelText='Cancelar'] - Texto del botón de cancelar
   * @param {string} [options.confirmClass='btn-confirm-yes'] - Clase CSS del botón confirmar
   * @param {string} [options.cancelClass='btn-confirm-no'] - Clase CSS del botón cancelar
   * @param {number} [options.maxLength=100] - Longitud máxima del campo
   * @returns {Promise<string|null>} Valor introducido o null si se cancela
   *
   * @example
   * const nombre = await showPrompt('Nombre del archivo:', { 
   *   defaultValue: 'documento', 
   *   suffix: '.txt' 
   * });
   * if (nombre !== null) {
   *   // Usar nombre + '.txt'
   * }
   */
  function showPrompt(message, options = {}) {
    return new Promise(resolve => {
      const {
        defaultValue = '',
        placeholder = '',
        suffix = '',
        confirmText = 'Aceptar',
        cancelText = 'Cancelar',
        confirmClass = 'btn-confirm-yes',
        cancelClass = 'btn-confirm-no',
        maxLength = 100
      } = options;

      // Crear overlay
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.tabIndex = -1;
      overlay.innerHTML = `
        <div class="confirm-dialog prompt-dialog" role="dialog" aria-modal="true">
          <div class="confirm-body">
            <label for="prompt-input">${mensajeHtml(message)}</label>
            <div class="prompt-input-wrapper">
              <input type="text" id="prompt-input" class="prompt-input" 
                     value="${escapeHtml(defaultValue)}" 
                     placeholder="${escapeHtml(placeholder)}"
                     maxlength="${escapeHtml(maxLength)}" />
              ${suffix ? `<span class="prompt-suffix">${escapeHtml(suffix)}</span>` : ''}
            </div>
          </div>
          <div class="confirm-actions">
            <button class="${escapeHtml(confirmClass)}" data-accion="confirmar">${escapeHtml(confirmText)}</button>
            <button class="${escapeHtml(cancelClass)}" data-accion="cancelar">${escapeHtml(cancelText)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#prompt-input');
      const yesBtn = overlay.querySelector('[data-accion="confirmar"]');
      const noBtn = overlay.querySelector('[data-accion="cancelar"]');

      // Prevenir scroll del body
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Animación de entrada
      requestAnimationFrame(() => {
        overlay.classList.add('visible');
      });

      /**
       * Limpia el diálogo y resuelve la promesa.
       * @param {string|null} result - Valor del input o null si se cancela
       */
      function cleanup(result) {
        overlay.classList.remove('visible');

        const onTransitionEnd = () => {
          document.body.style.overflow = originalOverflow;
          if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          resolve(result);
        };

        overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
        setTimeout(onTransitionEnd, 220);
      }

      /**
       * Confirma con el valor actual del input
       */
      function confirm() {
        const value = input.value.trim();
        if (value) {
          cleanup(value);
        } else {
          input.focus();
          input.classList.add('input-error');
          setTimeout(() => input.classList.remove('input-error'), 500);
        }
      }

      // Event listeners
      yesBtn.addEventListener('click', confirm);
      noBtn.addEventListener('click', () => cleanup(null));

      // Enter para confirmar
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirm();
        }
      });

      // Click fuera del diálogo
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(null);
      });

      // Tecla Escape
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cleanup(null);
      });

      // Enfocar el input y seleccionar el texto
      setTimeout(() => {
        input.focus();
        input.select();
      }, 120);
    });
  }

  /**
   * Muestra un diálogo modal con icono, mensaje centrado, una lista de opciones (radio)
   * y los botones Aceptar / Cancelar. Escape y el clic fuera equivalen a cancelar.
   * @param {string} message - Mensaje (texto plano; los saltos de línea se respetan)
   * @param {Object} options
   * @param {string} [options.pregunta] - Pregunta destacada bajo el mensaje (estilo .desplazamiento-titulo)
   * @param {Array<{id: string, texto: string}>} options.opciones - Opciones en orden
   * @param {string} [options.seleccion] - id de la opción marcada al abrir (por defecto, la primera)
   * @param {string} [options.icon='aviso'] - 'aviso', 'exito' o texto (ver iconoDialogoHtml)
   * @param {string} [options.confirmText='Aceptar']
   * @param {string} [options.cancelText='Cancelar']
   * @returns {Promise<string|null>} id de la opción elegida, o null si se cancela
   */
  function showChoice(message, options = {}) {
    return new Promise(resolve => {
      const {
        opciones = [],
        pregunta = '',
        seleccion = opciones[0] && opciones[0].id,
        icon = 'aviso',
        confirmText = 'Aceptar',
        cancelText = 'Cancelar'
      } = options;

      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.tabIndex = -1;
      const grupo = `choice-${Date.now()}`;
      const radios = opciones.map(op => `
            <label class="choice-opcion">
              <input type="radio" name="${grupo}" value="${escapeHtml(op.id)}"${op.id === seleccion ? ' checked' : ''} />
              <span>${escapeHtml(op.texto)}</span>
            </label>`).join('');
      overlay.innerHTML = `
        <div class="confirm-dialog choice-dialog" role="dialog" aria-modal="true">
          ${icon ? `<div class="confirm-icon">${iconoDialogoHtml(icon)}</div>` : ''}
          <div class="confirm-body choice-body">${mensajeHtml(message)}</div>
          ${pregunta ? `<div class="desplazamiento-titulo choice-pregunta">${escapeHtml(pregunta)}</div>` : ''}
          <div class="choice-opciones" role="radiogroup">${radios}
          </div>
          <div class="confirm-actions">
            <button type="button" class="btn-message-ok" data-accion="confirmar">${escapeHtml(confirmText)}</button>
            <button type="button" class="btn-confirm-no" data-accion="cancelar">${escapeHtml(cancelText)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => overlay.classList.add('visible'));

      let resuelto = false;
      function cleanup(result) {
        if (resuelto) return;
        resuelto = true;
        overlay.classList.remove('visible');
        const fin = () => {
          document.body.style.overflow = originalOverflow;
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };
        overlay.addEventListener('transitionend', fin, { once: true });
        setTimeout(fin, 220);
        resolve(result);
      }

      const elegida = () => {
        const marcado = overlay.querySelector(`input[name="${grupo}"]:checked`);
        return marcado ? marcado.value : null;
      };
      const btnAceptar = overlay.querySelector('[data-accion="confirmar"]');
      const btnCancelar = overlay.querySelector('[data-accion="cancelar"]');
      btnAceptar.addEventListener('click', () => cleanup(elegida()));
      btnCancelar.addEventListener('click', () => cleanup(null));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(null);
      });
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cleanup(null);
        // Enter sobre una opción equivale a Aceptar
        if (e.key === 'Enter' && e.target.type === 'radio') {
          e.preventDefault();
          cleanup(elegida());
        }
        if (e.key === 'Tab') {
          const focusables = [overlay.querySelector(`input[name="${grupo}"]:checked`) || overlay.querySelector('input[type="radio"]'), btnAceptar, btnCancelar].filter(Boolean);
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });

      setTimeout(() => (overlay.querySelector(`input[name="${grupo}"]:checked`) || btnAceptar).focus(), 120);
    });
  }

  /**
   * Muestra un modal de mensaje con un botón Aceptar (icono de éxito o de aviso).
   * @param {string} mensaje - Texto plano; los saltos de línea se respetan
   * @param {boolean} [esError=false]
   * @param {Object} [options]
   * @param {boolean} [options.html=false] - El mensaje es HTML fijo del programa (<b>, <i>…) y no se escapa.
   *   Nunca con texto que venga del usuario o de un archivo.
   * @returns {Promise<void>} Se resuelve al cerrar el modal
   */
  function showMessage(mensaje, esError = false, options = {}) {
    return new Promise((resolve) => {
      // Crear overlay si no existe
      let overlay = document.querySelector('.message-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'message-overlay';
        overlay.innerHTML = `
          <div class="message-dialog" role="dialog" aria-modal="true">
            <div class="message-icon" data-rol="icono"></div>
            <div class="message-body"></div>
            <div class="message-actions">
              <button type="button" class="btn-message-ok">Aceptar</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      }

      const dialog = overlay.querySelector('.message-dialog');
      const iconEl = overlay.querySelector('[data-rol="icono"]');
      const bodyEl = overlay.querySelector('.message-body');
      const btnOk = overlay.querySelector('.btn-message-ok');

      dialog.className = 'message-dialog ' + (esError ? 'message-error' : 'message-success');
      // El aviso usa el mismo icono que los diálogos de confirmación
      iconEl.className = esError ? 'confirm-icon' : 'message-icon';
      iconEl.innerHTML = iconoDialogoHtml(esError ? 'aviso' : 'exito');
      bodyEl.innerHTML = options.html
        ? String(mensaje).replace(/\r?\n/g, '<br>')
        : mensajeHtml(mensaje);

      overlay.classList.add('visible');
      btnOk.focus();

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
  // EXPORTACIÓN
  // =========================================================================

  const confirmDialog = {
    showConfirm,
    showPrompt,
    showChoice,
    showMessage
  };

  global.confirmDialog = confirmDialog;

  // Alias de conveniencia
  global.showConfirm = showConfirm;
  global.showPrompt = showPrompt;
  global.showChoice = showChoice;
  global.showMessage = showMessage;

})(typeof window !== 'undefined' ? window : this);
