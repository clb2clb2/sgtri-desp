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
  function showConfirm(message, options = {}) {
    return new Promise(resolve => {
      const {
        confirmText = 'Eliminar',
        cancelText = 'Cancelar',
        confirmClass = 'btn-confirm-yes',
        cancelClass = 'btn-confirm-no'
      } = options;

      // Crear overlay
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.tabIndex = -1;
      overlay.innerHTML = `
        <div class="confirm-dialog" role="dialog" aria-modal="true">
          <div class="confirm-body">${message}</div>
          <div class="confirm-actions">
            <button class="${confirmClass}">${confirmText}</button>
            <button class="${cancelClass}">${cancelText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const yesBtn = overlay.querySelector(`.${confirmClass}`);
      const noBtn = overlay.querySelector(`.${cancelClass}`);

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
   * Versión simplificada para confirmaciones de eliminación.
   * @param {string} itemName - Nombre del elemento a eliminar
   * @returns {Promise<boolean>}
   */
  function confirmDelete(itemName) {
    return showConfirm(`¿Eliminar ${itemName}?`);
  }

  /**
   * Versión con botones personalizados para acciones genéricas.
   * @param {string} message - Mensaje a mostrar
   * @param {string} confirmText - Texto del botón de acción
   * @returns {Promise<boolean>}
   */
  function confirmAction(message, confirmText) {
    return showConfirm(message, { confirmText });
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
        maxLength = 100
      } = options;

      // Crear overlay
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.tabIndex = -1;
      overlay.innerHTML = `
        <div class="confirm-dialog prompt-dialog" role="dialog" aria-modal="true">
          <div class="confirm-body">
            <label for="prompt-input">${message}</label>
            <div class="prompt-input-wrapper">
              <input type="text" id="prompt-input" class="prompt-input" 
                     value="${defaultValue}" 
                     placeholder="${placeholder}"
                     maxlength="${maxLength}" />
              ${suffix ? `<span class="prompt-suffix">${suffix}</span>` : ''}
            </div>
          </div>
          <div class="confirm-actions">
            <button class="btn-confirm-yes">${confirmText}</button>
            <button class="btn-confirm-no">${cancelText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#prompt-input');
      const yesBtn = overlay.querySelector('.btn-confirm-yes');
      const noBtn = overlay.querySelector('.btn-confirm-no');

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

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const confirmDialog = {
    showConfirm,
    confirmDelete,
    confirmAction,
    showPrompt
  };

  global.confirmDialog = confirmDialog;

  // Alias de conveniencia
  global.showConfirm = showConfirm;
  global.showPrompt = showPrompt;

})(typeof window !== 'undefined' ? window : this);
