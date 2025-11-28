/**
 * uiProyectos.js
 * ===============
 * Módulo de gestión de fichas de proyecto.
 * Maneja la creación, eliminación y numeración de proyectos.
 *
 * @module uiProyectos
 * @requires confirmDialog
 * @requires limpiaDatos
 */
(function (global) {
  'use strict';

  // Dependencias
  const showConfirm = global.showConfirm || ((msg) => Promise.resolve(confirm(msg)));

  // Estado del módulo
  let proyectoCounter = 1;
  let proyectosContainer = null;
  let btnAddProyecto = null;

  // =========================================================================
  // GESTIÓN DE PROYECTOS
  // =========================================================================

  /**
   * Crea un nuevo grupo de proyecto y lo añade al contenedor.
   * @returns {HTMLElement} El elemento del nuevo proyecto
   */
  function crearNuevoProyecto() {
    if (!proyectosContainer) {
      proyectosContainer = document.getElementById('proyectos-container');
    }
    if (!proyectosContainer) return null;

    proyectoCounter++;
    const nuevoProyecto = document.createElement('div');
    nuevoProyecto.className = 'proyecto-grupo';
    nuevoProyecto.dataset.proyectoId = proyectoCounter;

    // Título numerado
    const titulo = document.createElement('h3');
    titulo.className = 'proyecto-titulo';
    titulo.textContent = `Proyecto ${proyectoCounter}`;
    nuevoProyecto.appendChild(titulo);

    nuevoProyecto.innerHTML += `
      <div class="form-group">
        <label for="responsable-${proyectoCounter}">Responsable: D./D.ª</label>
        <input type="text" id="responsable-${proyectoCounter}" name="responsable-${proyectoCounter}" class="responsable" maxlength="70" required />
      </div>
      <div class="form-row two-cols-50-50">
        <div class="form-group">
          <label for="organica-${proyectoCounter}">Orgánica</label>
          <input type="text" id="organica-${proyectoCounter}" name="organica-${proyectoCounter}" class="organica"
                 pattern="^[A-Za-z0-9]{2}(\\.[A-Za-z0-9]{2}){0,4}$" required />
        </div>
        <div class="form-group">
          <label for="referencia-${proyectoCounter}">Referencia del proyecto</label>
          <input type="text" id="referencia-${proyectoCounter}" name="referencia-${proyectoCounter}" class="referencia-proyecto" maxlength="50" required />
        </div>
      </div>
      <button type="button" class="btn-eliminar-proyecto" aria-label="Eliminar proyecto ${proyectoCounter}">
        <span class="btn-icon btn-icon-minus" aria-hidden="true">−</span>Eliminar
      </button>
    `;

    // Animación de entrada
    nuevoProyecto.classList.add('entry');
    proyectosContainer.appendChild(nuevoProyecto);
    nuevoProyecto.addEventListener('transitionend', () => nuevoProyecto.classList.remove('entry'), { once: true });

    // Mostrar botón eliminar en el primer proyecto si es el segundo
    if (proyectoCounter === 2) {
      const primerProyecto = proyectosContainer.querySelector('.proyecto-grupo');
      const primerBotonEliminar = primerProyecto?.querySelector('.btn-eliminar-proyecto');
      if (primerBotonEliminar) primerBotonEliminar.style.display = 'block';
    }

    actualizarNumerosProyectos();
    return nuevoProyecto;
  }

  /**
   * Actualiza la numeración visible de todos los proyectos.
   */
  function actualizarNumerosProyectos() {
    if (!proyectosContainer) {
      proyectosContainer = document.getElementById('proyectos-container');
    }
    if (!proyectosContainer) return;

    const proyectos = proyectosContainer.querySelectorAll('.proyecto-grupo');
    
    proyectos.forEach((p, idx) => {
      const t = p.querySelector('.proyecto-titulo');
      if (proyectos.length > 1) {
        if (t) {
          t.textContent = `Proyecto ${idx + 1}`;
          t.style.display = 'block';
        }
      } else {
        if (t) t.style.display = 'none';
      }
    });

    // Mostrar/ocultar botones eliminar
    if (proyectos.length > 1) {
      proyectos.forEach((p, idx) => {
        const btn = p.querySelector('.btn-eliminar-proyecto');
        if (btn) {
          btn.style.display = 'block';
          btn.setAttribute('aria-label', `Eliminar proyecto ${idx + 1}`);
        }
      });
    } else if (proyectos.length === 1) {
      const btn = proyectos[0].querySelector('.btn-eliminar-proyecto');
      if (btn) btn.style.display = 'none';
    }
  }

  /**
   * Elimina un proyecto con confirmación.
   * @param {HTMLElement} grupo - Elemento del proyecto a eliminar
   */
  async function eliminarProyecto(grupo) {
    if (!grupo || !proyectosContainer) return;

    const proyectosList = Array.from(proyectosContainer.querySelectorAll('.proyecto-grupo'));
    const idx = proyectosList.indexOf(grupo) + 1;

    const confirmed = await showConfirm(`¿Eliminar el proyecto ${idx}?`);
    if (!confirmed) return;

    grupo.remove();
    actualizarNumerosProyectos();

    // Ocultar botón eliminar si solo queda uno
    const proyectosRestantes = proyectosContainer.querySelectorAll('.proyecto-grupo');
    if (proyectosRestantes.length === 1) {
      const botonEliminar = proyectosRestantes[0].querySelector('.btn-eliminar-proyecto');
      if (botonEliminar) botonEliminar.style.display = 'none';
    }
  }

  /**
   * Inicializa los listeners de proyectos.
   */
  function init() {
    proyectosContainer = document.getElementById('proyectos-container');
    btnAddProyecto = document.getElementById('btn-add-proyecto');

    if (!proyectosContainer || !btnAddProyecto) return;

    // Evento para añadir proyecto
    btnAddProyecto.addEventListener('click', () => {
      const nuevo = crearNuevoProyecto();
      if (nuevo) {
        const firstInput = nuevo.querySelector('input, select');
        if (firstInput) {
          nuevo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => firstInput.focus(), 220);
        }
      }
    });

    // Delegación de eventos para eliminar
    proyectosContainer.addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-eliminar-proyecto') || 
          e.target.closest('.btn-eliminar-proyecto')) {
        const btn = e.target.classList.contains('btn-eliminar-proyecto') 
          ? e.target 
          : e.target.closest('.btn-eliminar-proyecto');
        const grupo = btn.closest('.proyecto-grupo');
        await eliminarProyecto(grupo);
      }
    });

    // Actualizar numeración inicial
    actualizarNumerosProyectos();
  }

  /**
   * Obtiene el contador actual de proyectos.
   * @returns {number}
   */
  function getCounter() {
    return proyectoCounter;
  }

  /**
   * Establece el contador de proyectos.
   * @param {number} value
   */
  function setCounter(value) {
    proyectoCounter = value;
  }

  // =========================================================================
  // EXPORTACIÓN
  // =========================================================================

  const uiProyectos = {
    crearNuevoProyecto,
    actualizarNumerosProyectos,
    eliminarProyecto,
    init,
    getCounter,
    setCounter
  };

  global.uiProyectos = uiProyectos;

})(typeof window !== 'undefined' ? window : this);
