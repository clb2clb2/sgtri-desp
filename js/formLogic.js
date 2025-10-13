document.addEventListener("DOMContentLoaded", () => {
  const categoriaSelect = document.getElementById("categoria");
  const tipoPagoSelect = document.getElementById("tipo-pago");
  const tipoProyecto = document.getElementById("tipoProyecto");
  const infoDecreto = document.getElementById("infoDecreto");
  const btnAddProyecto = document.getElementById("btn-add-proyecto");
  const proyectosContainer = document.getElementById("proyectos-container");

  let proyectoCounter = 1;
  let paisesData = [];

  // -------------------------
  // -------------------------
  // Helpers para saneamiento y formato
  // -------------------------
  // Wrappers that delegate sanitization/formatting to the centralized module (js/sanitizers.js).
  // We keep the same function names to avoid changing call sites in this file.
  function sanitizeGeneralText(value, maxLen) {
    try {
      const s = (window.sanitizers || sanitizers);
      return s.sanitizeGeneralText(value, maxLen);
    } catch (err) {
      return String(value || '').replace(/[^0-9A-Za-z\u00C0-\u017F\u0180-\u024F .,\-()&']/g, '').slice(0, maxLen || undefined);
    }
  }

  function sanitizeReferencia(value, maxLen) {
    try {
      const s = (window.sanitizers || sanitizers);
      return s.sanitizeReferencia(value, maxLen);
    } catch (err) {
      return String(value || '').replace(/[^0-9A-Za-z\u00C0-\u017F\u0180-\u024F\/ .,\-()&']/g, '').slice(0, maxLen || undefined);
    }
  }

  function sanitizeIBAN(value, maxLen) {
    try {
      const s = (window.sanitizers || sanitizers);
      return s.sanitizeIBAN(value, maxLen);
    } catch (err) {
      const raw = String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, maxLen || 24);
      const parts = raw.match(/.{1,4}/g) || [];
      return parts.join(' ');
    }
  }

  function sanitizeDNI(value, maxLen) {
    try {
      const s = (window.sanitizers || sanitizers);
      return s.sanitizeDNI(value, maxLen);
    } catch (err) {
      return String(value || '').replace(/[^A-Za-z0-9.-]/g, '').slice(0, maxLen || 20).toUpperCase();
    }
  }

  function formatOrganica(value) {
    try {
      const s = (window.sanitizers || sanitizers);
      return s.formatOrganica(value);
    } catch (err) {
      const only = String(value || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase();
      const parts = only.match(/.{1,2}/g) || [];
      return parts.join('.');
    }
  }

  // Delegación para sanear entradas en tiempo real
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || el.tagName !== 'INPUT') return;

    // Helper: aplicar transformación al valor preservando la posición del caret
    function applyWithCaretPreserved(inputEl, transformFn) {
      try {
        const selectionStart = inputEl.selectionStart;
        const selectionEnd = inputEl.selectionEnd;
        const oldValue = inputEl.value;
        // Pass selection positions to transformFn so it can decide based on caret
        const newValue = transformFn(oldValue, selectionStart, selectionEnd);
        if (newValue === oldValue) return false;

        // Calcular delta en longitud para intentar ajustar caret
        const lenDiff = newValue.length - oldValue.length;
        inputEl.value = newValue;

        // Intentar restaurar caret en una posición razonable
        const basePos = (selectionEnd != null ? selectionEnd : selectionStart) || 0;
        const newPos = Math.max(0, basePos + lenDiff);
        inputEl.setSelectionRange(newPos, newPos);
        return true;
      } catch (err) {
        // Fallback simple
        try { inputEl.value = transformFn(inputEl.value, inputEl.selectionStart, inputEl.selectionEnd); } catch(e) { inputEl.value = transformFn(inputEl.value); }
        return true;
      }
    }

    // Nombre beneficiario
    if (el.id === 'nombre-benef') {
      const v = sanitizeGeneralText(el.value, 70);
      if (v !== el.value) el.value = v;
      return;
    }

    // Entidad contratante
    if (el.id === 'entidad') {
      const v = sanitizeGeneralText(el.value, 50);
      if (v !== el.value) el.value = v;
      return;
    }

    // DNI
    if (el.id === 'dni') {
      applyWithCaretPreserved(el, (v) => sanitizeDNI(v, 20));
      return;
    }

    // IBAN: permitir que el usuario escriba espacios; si no ha escrito un separador, agrupar automáticamente
    if (el.id === 'iban' || el.classList.contains('iban')) {
      applyWithCaretPreserved(el, (val, selStart) => {
        const v = val || '';
        // Si justo antes del caret hay un espacio (usuario acaba de teclear espacio), respetamos el espacio y no reagrupamos
        if (selStart > 0 && v[selStart - 1] === ' ') {
          // Permitimos espacios escritos por el usuario; limpiamos otros caracteres inválidos y forzamos mayúsculas
          const cleaned = v.replace(/[^A-Za-z0-9 ]/g, '').toUpperCase();
          // Limitar al número máximo de caracteres alfanuméricos (24)
          const onlyAlnum = cleaned.replace(/[^A-Za-z0-9]/g, '');
          const limitedAlnum = onlyAlnum.slice(0, 24);
          // Reconstruir manteniendo los espacios lo más posible: simple fallback — quitar exceso al final
          // Si hay más letras que el límite, acortamos desde el final
          if (onlyAlnum.length <= 24) return cleaned.toUpperCase();
          // cortar exceso: reconstruir a partir de cleaned dejando sólo primeros limitedAlnum y respetando espacios antes
          let result = '';
          let taken = 0;
          for (let ch of cleaned) {
            if (/[A-Za-z0-9]/.test(ch)) {
              if (taken < limitedAlnum.length) { result += ch; taken++; } else break;
            } else {
              result += ch; // espacio
            }
          }
          return result.toUpperCase();
        }

        // De lo contrario, agrupamos automáticamente: sólo alfanuméricos, mayúsculas y grupos de 4
        const raw = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 24);
        const parts = raw.match(/.{1,4}/g) || [];
        return parts.join(' ').toUpperCase();
      });
      return;
    }

    // Responsables (dinámicos y estáticos)
    if (el.classList.contains('responsable') || /^responsable-/.test(el.name || '')) {
      const v = sanitizeGeneralText(el.value, 70);
      if (v !== el.value) el.value = v;
      return;
    }

    // Campos de texto general (origen, destino, motivo, etc.)
    if (el.classList && el.classList.contains('general-text')) {
      applyWithCaretPreserved(el, (v) => sanitizeGeneralText(v, 90));
      return;
    }

    // Orgánica: permitir que el usuario escriba puntos; si no ha escrito un separador, agrupar automáticamente
    if (el.classList.contains('organica') || /^organica-/.test(el.id || '')) {
      applyWithCaretPreserved(el, (val, selStart) => {
        const v = val || '';
        if (selStart > 0 && v[selStart - 1] === '.') {
          // Usuario escribió el punto: respetarlo, forzamos mayúsculas y limpiamos caracteres inválidos
          const cleaned = v.replace(/[^A-Za-z0-9.]/g, '').toUpperCase();
          // Limitar al máximo de caracteres (incluyendo puntos): 14
          return cleaned.slice(0, 14);
        }
        // Sino, agrupamos por pares automáticamente
        const only = v.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase();
        const parts = only.match(/.{1,2}/g) || [];
        return parts.join('.');
      });
      return;
    }

    // Referencia proyecto
    if (el.classList.contains('referencia-proyecto') || /^referencia-/.test(el.name || '')) {
      applyWithCaretPreserved(el, (v) => sanitizeReferencia(v, 50));
      return;
    }

    // Fecha (live): permitir números y '/', insertar '/' después de dd y mm si el usuario no lo hace
    if (el.classList && el.classList.contains('input-fecha')) {
      applyWithCaretPreserved(el, (val, selStart) => {
        const v = val || '';
        // Normalizar entrada (sólo dígitos y '/'), dejamos para decidir
        const cleaned = v.replace(/[^0-9\/]/g, '');

        // Si el usuario acaba de escribir '/' justo antes del caret, respetamos sus separadores
        if (selStart > 0 && v[selStart - 1] === '/') {
          const single = cleaned.replace(/\/{2,}/g, '/');
          const trimmed = single.replace(/^\//, '');
          // Si termina en '/' comprobamos si el segmento anterior tiene 1 dígito y lo rellenamos con 0
          if (single.endsWith('/') && single.length > 1) {
            const parts = single.split('/');
            if (parts.length >= 2) {
              const prev = parts[parts.length - 2] || '';
              if (prev.length === 1) {
                parts[parts.length - 2] = prev.padStart(2, '0');
                // Reconstruir, manteniendo la barra final
                const res = parts.join('/');
                return res.slice(0, 8);
              }
            }
          }
          return trimmed.slice(0, 8);
        }

        // Sino, auto-insertar separadores: construir dd/mm/aa parcialmente a partir de dígitos
        const digits = (cleaned.replace(/[^0-9]/g, '') || '');
        let out = '';
        if (digits.length <= 2) out = digits;
        else if (digits.length <= 4) out = digits.slice(0,2) + '/' + digits.slice(2);
        else out = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4,6);
        return out.slice(0, 8);
      });
      return;
    }

    // Hora (live): permitir dígitos y ':'; insertar ':' tras hh si el usuario no lo hace
    if (el.classList && el.classList.contains('input-hora')) {
      applyWithCaretPreserved(el, (val, selStart) => {
        const v = val || '';
        const cleaned = v.replace(/[^0-9:]/g, '');
        const single = cleaned.replace(/:{2,}/g, ':').replace(/^:/, '');
        const digits = single.replace(/[^0-9]/g, '');
        if (digits.length <= 2) return digits.slice(0,2);
        const hh = digits.slice(0,2);
        const mm = digits.slice(2,4);
        let out = hh;
        if (digits.length > 2) out = hh + ':' + mm;
        return out.slice(0,5);
      });
      return;
    }

    // Km: permitir sólo dígitos y comas en tiempo real; convertir puntos a comas
    if (el.classList && el.classList.contains('format-km')) {
      applyWithCaretPreserved(el, (val, selStart) => {
        const v = (val || '');
        // convertir puntos a comas
        let s = v.replace(/\./g, ',');
        // permitir sólo dígitos y comas
        s = s.replace(/[^0-9,]/g, '');
        // permitir una sola coma (para evitar entradas erróneas)
        const parts = s.split(',');
        if (parts.length > 2) s = parts[0] + ',' + parts.slice(1).join('');
        return s;
      });
      return;
    }

    // Alojamiento: durante la edición permitir dígitos y UNA coma decimal; convertir puntos a comas
    // Al perder foco seguirá aplicándose el formateo con miles y decimales.
    if (el.classList && el.classList.contains('format-alojamiento')) {
      applyWithCaretPreserved(el, (val, selStart) => {
        const v = (val || '');
        // convertir puntos a comas (usuario puede escribir punto como separador accidental)
        let s = v.replace(/\./g, ',');
        // eliminar espacios y caracteres no numéricos/coma
        s = s.replace(/[^0-9,]/g, '');
        // permitir sólo una coma
        const parts = s.split(',');
        if (parts.length > 2) s = parts[0] + ',' + parts.slice(1).join('');
        return s;
      });
      return;
    }
  });

  // --- Confirm modal helper (promise-based) ---
  function showConfirm(message, options = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.tabIndex = -1;
      overlay.innerHTML = `
        <div class="confirm-dialog" role="dialog" aria-modal="true">
          <div class="confirm-body">${message}</div>
          <div class="confirm-actions">
            <button class="btn-confirm-yes">Eliminar</button>
            <button class="btn-confirm-no">Cancelar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const yes = overlay.querySelector('.btn-confirm-yes');
      const no = overlay.querySelector('.btn-confirm-no');

      // Prevent background scroll
      document.body.style.overflow = 'hidden';

      // Show animation: add visible class after insertion
      requestAnimationFrame(() => {
        overlay.classList.add('visible');
      });

      function cleanup(result) {
        // Start hide animation
        overlay.classList.remove('visible');
        // restore body scroll after animation ends
        const onTransitionEnd = () => {
          document.body.style.overflow = '';
          if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(result);
        };
        // If transitionend supported, wait, otherwise remove immediately
        overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
        // Fallback timeout in case transitionend doesn't fire
        setTimeout(onTransitionEnd, 220);
      }

      yes.addEventListener('click', () => cleanup(true));
      no.addEventListener('click', () => cleanup(false));

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });

      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cleanup(false);
      });

      // Focus the confirm button for keyboard users
      setTimeout(() => yes.focus(), 120);
    });
  }
  // Formateo agrupado reutilizable (raw -> groups)
  function formatGroupedRaw(raw, groupSize, sep, includeTrailingSep = false, maxRawLen) {
    if (!raw) return '';
    const parts = raw.match(new RegExp('.{1,' + groupSize + '}', 'g')) || [];
    let out = parts.join(sep);
    // Añadir separador final si se solicita (por ejemplo: al completar un bloque)
    if (includeTrailingSep && raw.length > 0 && raw.length % groupSize === 0) {
      // no añadir si ya alcanzó el máximo raw permitido
      if (!maxRawLen || raw.length < maxRawLen) out = out + sep;
    }
    return out;
  }

  // Procesa un input agrupado (IBAN, Orgánica) preservando caret y añadiendo separador justo al completar un bloque
  function processGroupedInput(inputEl, opts) {
    // opts: { groupSize, sep, maxRawLen, validPattern, transformRaw (optional) }
    try {
      const { groupSize, sep, maxRawLen, validPattern, transformRaw } = opts;
      const oldValue = inputEl.value || '';
      const selStart = inputEl.selectionStart || 0;

      // Raw antes: contar caracteres válidos hasta la posición del caret
      const validRegex = new RegExp(validPattern, 'g');
      const charsBefore = (oldValue.slice(0, selStart).match(validRegex) || []).length;

      // Construir raw nuevo a partir del valor actual del input (el usuario ya ha escrito)
      const rawAll = (oldValue.match(validRegex) || []).join('');
      const newRaw = (rawAll || '').slice(0, maxRawLen || rawAll.length);
      const finalRaw = transformRaw ? transformRaw(newRaw) : newRaw;

  // Formatear. Si el usuario acaba de completar un bloque y no ha llegado al max, incluimos separador final
  const justCompletedGroup = (finalRaw.length > 0) && (finalRaw.length % groupSize === 0) && (finalRaw.length < (maxRawLen || Infinity));
  const formatted = formatGroupedRaw(finalRaw, groupSize, sep, justCompletedGroup, maxRawLen);

      // Determinar si fue una inserción (raw más largo que antes)
      const oldRawAll = (inputEl._lastRawValue) || '';
      const wasInsert = finalRaw.length > (oldRawAll.length || 0);

      // Calcular nueva posición lógica en raw
      let rawPos = charsBefore;
      if (wasInsert && rawPos > 0 && rawPos % groupSize === 0) {
        // el usuario acaba de completar un grupo: colocar caret después del separador
        rawPos = rawPos + 1;
      }

      // Mapear rawPos a índice en formatted
      function rawPosToFormattedIndex(rPos) {
        if (rPos <= 0) return 0;
        const fullGroups = Math.floor(rPos / groupSize);
        const rem = rPos % groupSize;
        let idx = fullGroups * (groupSize + sep.length) + rem;
        return Math.min(idx, formatted.length);
      }

      // Asignar nuevo valor y selección
      inputEl.value = formatted;
      const newIndex = rawPosToFormattedIndex(rawPos);
      inputEl.setSelectionRange(newIndex, newIndex);

      // Guardar raw para comparación en próximas llamadas
      inputEl._lastRawValue = finalRaw;
      return true;
    } catch (err) {
      // Fallback: simple formateo
      try {
        const raw = ((inputEl.value || '').match(new RegExp(opts.validPattern, 'g')) || []).join('').slice(0, opts.maxRawLen || undefined);
        inputEl.value = formatGroupedRaw(raw, opts.groupSize, opts.sep);
      } catch (e) {}
      return false;
    }
  }

  // Función para crear un nuevo grupo de proyecto
  function crearNuevoProyecto() {
    proyectoCounter++;
    const nuevoProyecto = document.createElement("div");
    nuevoProyecto.className = "proyecto-grupo";
    nuevoProyecto.dataset.proyectoId = proyectoCounter;
    // Añadir título numerado
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
                   pattern="^[A-Za-z0-9]{2}(\.[A-Za-z0-9]{2}){0,4}$" required />
          </div>
          <div class="form-group">
            <label for="referencia-${proyectoCounter}">Referencia del proyecto</label>
            <input type="text" id="referencia-${proyectoCounter}" name="referencia-${proyectoCounter}" class="referencia-proyecto" maxlength="50" required />
          </div>
        </div>
  <button type="button" class="btn-eliminar-proyecto" aria-label="Eliminar proyecto ${proyectoCounter}"><svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18v2H3V6zm2 3h14l-1.2 11.3A2 2 0 0 1 15.8 22H8.2a2 2 0 0 1-1.99-1.7L5 9zm5-7h4l1 1H9l1-1z"/></svg>Eliminar</button>
    `;

    // Añadir clase de entrada para animación
  nuevoProyecto.classList.add('entry');
  proyectosContainer.appendChild(nuevoProyecto);
  // Quitar clase de entrada tras la transición
  nuevoProyecto.addEventListener('transitionend', () => nuevoProyecto.classList.remove('entry'), { once: true });
    
    // Mostrar el botón de eliminar en el primer proyecto
    if (proyectoCounter === 2) {
      const primerProyecto = proyectosContainer.querySelector('.proyecto-grupo');
      const primerBotonEliminar = primerProyecto.querySelector('.btn-eliminar-proyecto');
      primerBotonEliminar.style.display = 'block';
    }

    // Actualizar numeración de proyectos
    actualizarNumerosProyectos();
    return nuevoProyecto;
  }

  function actualizarNumerosProyectos() {
    const proyectos = proyectosContainer.querySelectorAll('.proyecto-grupo');
    proyectos.forEach((p, idx) => {
      const t = p.querySelector('.proyecto-titulo');
      // Si hay más de un proyecto mostramos el título numerado, si no lo ocultamos
      if (proyectos.length > 1) {
        if (t) t.textContent = `Proyecto ${idx + 1}`;
        if (t) t.style.display = 'block';
      } else {
        if (t) t.style.display = 'none';
      }
    });

    // Mostrar/ocultar botones eliminar según número de proyectos
    if (proyectos.length > 1) {
      proyectos.forEach(p => {
        const btn = p.querySelector('.btn-eliminar-proyecto');
        if (btn) { btn.style.display = 'block'; btn.setAttribute('aria-label', `Eliminar proyecto ${[...proyectos].indexOf(p)+1}`); }
      });
    } else if (proyectos.length === 1) {
      const btn = proyectos[0].querySelector('.btn-eliminar-proyecto');
      if (btn) btn.style.display = 'none';
    }
  }

  // Eventos para añadir/eliminar proyectos
  btnAddProyecto.addEventListener("click", () => {
    const nuevo = crearNuevoProyecto();
    // Auto-scroll y enfocar el primer input
    const firstInput = nuevo.querySelector('input, select');
    if (firstInput) {
      nuevo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => firstInput.focus(), 220);
    }
  });

  proyectosContainer.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-eliminar-proyecto")) {
      const grupo = e.target.closest(".proyecto-grupo");
      // obtener índice visible (1-based)
  const proyectosList = Array.from(proyectosContainer.querySelectorAll('.proyecto-grupo'));
  const idx = proyectosList.indexOf(grupo) + 1;
      const confirmed = await showConfirm(`¿Eliminar el proyecto ${idx}?`);
      if (!confirmed) return;
      grupo.remove();
      // Renumerar proyectos
      actualizarNumerosProyectos();
      // Si solo queda un proyecto, ocultar su botón de eliminar
      const proyectosNodeList = proyectosContainer.querySelectorAll('.proyecto-grupo');
      if (proyectosNodeList.length === 1) {
        const botonEliminar = proyectosNodeList[0].querySelector('.btn-eliminar-proyecto');
        botonEliminar.style.display = 'none';
      }
    }
  });

  // Cargar datos desde el JSON
  fetch("assets/data/datos.json")
    .then(response => {
      if (!response.ok) throw new Error("No se pudo cargar el JSON");
      return response.json();
    })
    .then(data => {
      // -------------------------
      // 1️⃣ Rellenar "En calidad de"
      // -------------------------
      data.categorias.forEach(([text, value], index) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        if (index === 0) option.selected = true; // seleccionar primera
        categoriaSelect.appendChild(option);
      });

      // -------------------------
      // 2️⃣ Rellenar "Pago en"
      // -------------------------
      data.pagos.forEach(([text, value], index) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        if (index === 0) option.selected = true; // seleccionar primera
        tipoPagoSelect.appendChild(option);
      });

      // -------------------------
      // 3️⃣ Rellenar "Tipo de proyecto"
      // -------------------------
      data.tiposProyecto.forEach(([text, value], index) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        if (index === 0) option.selected = true; // seleccionar primera
        tipoProyecto.appendChild(option);
      });

      // -------------------------
      // 4️⃣ Texto informativo inicial (según la primera opción)
      // -------------------------
      actualizarTextoDecreto(tipoProyecto.value);

      // -------------------------
      // 5️⃣ Actualizar al cambiar el tipo de proyecto
      // -------------------------
      tipoProyecto.addEventListener("change", () => {
        actualizarTextoDecreto(tipoProyecto.value);
      });

      // -------------------------
      // 6️⃣ Paises: guardar y poblar select inicial de desplazamientos
      // -------------------------
      paisesData = data.paises || [];
      const primerSelectPais = document.getElementById('pais-destino-1');
      if (primerSelectPais && paisesData.length > 0) {
        poblarSelectPaises(primerSelectPais);
      }
      if (primerSelectPais) {
        primerSelectPais.addEventListener('change', () => {
          manejarCambioPais(1);
        });
      }

      // Actualizar visibilidad inicial del ticket cena
      actualizarTicketCena();
      // Asegurar numeración/visibilidad inicial de proyectos y desplazamientos
      actualizarNumerosProyectos();
      actualizarNumerosDesplazamientos();
    })
    .catch(error => console.error("Error cargando datos del JSON:", error));

  // 🔹 Función auxiliar para cambiar el texto según el tipo de proyecto
  function actualizarTextoDecreto(valor) {
    if (["G24", "PEI", "NAL"].includes(valor)) {
      infoDecreto.innerHTML = `
        Los cálculos se efectuarán en base al 
        <strong>RD 462/2002 (Gobierno de España)</strong>.  
        <a href="https://www.boe.es/buscar/act.php?id=BOE-A-2002-10337"
           target="_blank" rel="noopener noreferrer">
           Ver Real Decreto
        </a>
      `;
    } else if (valor) {
      infoDecreto.innerHTML = `
        Los cálculos se efectuarán en base al 
        <strong>Decreto 42/2005 (Junta de Extremadura)</strong>.  
        <a href="https://doe.juntaex.es/otrosFormatos/html.php?xml=2025040078&anio=2025&doe=1010o"
           target="_blank" rel="noopener noreferrer">
           Ver Decreto
        </a>
      `;
    } else {
      infoDecreto.textContent = "";
    }
  }

  // =========================================
  // GESTIÓN DE DESPLAZAMIENTOS
  // =========================================
  
  const btnAddDesplazamiento = document.getElementById("btn-add-desplazamiento");
  const desplazamientosContainer = document.getElementById("desplazamientos-container");
  let desplazamientoCounter = 1;

  // Función para actualizar visibilidad del campo Ticket Cena según tipo de proyecto
  function actualizarTicketCena() {
    const tipoProyectoValor = tipoProyecto.value;
    const mostrarTicketCena = ["G24", "PEI", "NAL"].includes(tipoProyectoValor);
    
    // Actualizar todos los desplazamientos existentes
    document.querySelectorAll('.ticket-cena-field').forEach(field => {
      field.style.display = mostrarTicketCena ? 'block' : 'none';
    });
  }

  // Función para manejar cambio de país en un desplazamiento
  function manejarCambioPais(desplazamientoId) {
    const paisSelect = document.getElementById(`pais-destino-${desplazamientoId}`);
    const fronterasFields = document.getElementById(`fronteras-fields-${desplazamientoId}`);
    const cruceIda = document.getElementById(`cruce-ida-${desplazamientoId}`);
    const cruceVuelta = document.getElementById(`cruce-vuelta-${desplazamientoId}`);
    
    if (paisSelect.value !== "España") {
      fronterasFields.style.display = 'block';
      cruceIda.required = true;
      cruceVuelta.required = true;
    } else {
      fronterasFields.style.display = 'none';
      cruceIda.required = false;
      cruceVuelta.required = false;
      cruceIda.value = '';
      cruceVuelta.value = '';
    }
  }

  // Función para poblar select de países
  function poblarSelectPaises(selectElement) {
    paisesData.forEach(pais => {
      const option = document.createElement("option");
      option.value = pais;
      option.textContent = pais;
      selectElement.appendChild(option);
    });
  }

  // Formateo simple para campos de fecha: dd/mm/aa
  function formatFechaValue(value) {
    if (!value) return '';
    // Accept separators - / or - or no separator
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length < 6) return value; // not enough info
    const d = digits.slice(0,2);
    const m = digits.slice(2,4);
    let a = digits.slice(4,6);
    // if user typed 4-digit year, keep last two digits
    if (digits.length >= 8) a = digits.slice(6,8);
    return `${d}/${m}/${a}`;
  }

  // Validar fecha real (día, mes, año) teniendo en cuenta meses y bisiestos
  function isValidDate(d, m, y) {
    if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1) return false;
    const daysInMonth = [31, ( (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0) ) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= daysInMonth[m-1];
  }

  // Delegación para formatear inputs de fecha al perder foco
  document.addEventListener('blur', (e) => {
    const el = e.target;
    if (el && el.classList && el.classList.contains('input-fecha')) {
      // On blur: si user typed ddmm (4 digits) completar con año actual (últimos 2 dígitos)
      const v = (el.value || '').trim();
      const digits = (v.replace(/[^0-9]/g, '') || '');
      if (digits.length === 4) {
        const yy = (new Date()).getFullYear().toString().slice(-2);
        const candidate = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + yy;
        // validar fecha
        const parts = candidate.split('/');
        const d = parseInt(parts[0],10);
        const m = parseInt(parts[1],10);
        const y = 2000 + parseInt(parts[2],10);
        if (isValidDate(d,m,y)) el.value = parts[0].padStart(2,'0') + '/' + parts[1].padStart(2,'0') + '/' + parts[2]; else el.value = '';
      } else {
        // intentar formatear y validar fecha completa
        const formatted = formatFechaValue(v);
        // formatted puede ser "dd/mm/aa" o parcial
        const parts = (formatted || '').split('/').map(p => p || '');
        if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 2) {
          const d = parseInt(parts[0],10);
          const m = parseInt(parts[1],10);
          const y = 2000 + parseInt(parts[2],10);
          if (isValidDate(d,m,y)) {
            el.value = parts[0].padStart(2,'0') + '/' + parts[1].padStart(2,'0') + '/' + parts[2];
          } else {
            el.value = '';
          }
        } else {
          // no hay fecha completa: dejar lo que haya (o vaciar si está claramente inválido)
          el.value = formatted;
        }
      }
    }

    // Hora: validar hh/mm cuando se pierda foco
    if (el && el.classList && el.classList.contains('input-hora')) {
      const v = el.value || '';
      const parts = v.split(':').map(p => p.replace(/[^0-9]/g, ''));
      let hh = parts[0] || '';
      let mm = parts[1] || '';
      if (hh.length === 1) hh = '0' + hh;
      if (mm.length === 1) mm = '0' + mm;
      // validar rangos
      const hnum = parseInt(hh || '0', 10);
      const mnum = parseInt(mm || '0', 10);
      if (!isNaN(hnum) && hnum >= 0 && hnum <= 23) {
        // ok
      } else {
        hh = '';
      }
      if (!isNaN(mnum) && mnum >= 0 && mnum <= 59) {
        // ok
      } else {
        mm = '';
      }
      if (hh || mm) el.value = (hh || '00') + ':' + (mm || '00'); else el.value = '';
    }

    // Formateo Km y Alojamiento al perder foco
    if (el && el.classList && el.classList.contains('format-km')) {
      const raw = (el.value || '').toString();
      if (!raw) { el.value = ''; return; }
      // Accept both comma and dot as decimal separators; normalize to comma
      const cleaned = raw.replace(/[^0-9,\.]/g, '').replace(/\./g, ',');
      // Parse number for rounding: replace comma with dot for parseFloat
      const num = parseFloat(cleaned.replace(/,/g, '.'));
      if (isNaN(num)) { el.value = ''; return; }
      // Round to nearest integer as requested
      const rounded = Math.round(num);
      // Mostrar con separador de miles y añadir unidad ' km'
      el.value = Number(rounded).toLocaleString('de-DE') + ' km';
    }

    if (el && el.classList && el.classList.contains('format-alojamiento')) {
      const raw = (el.value || '').toString();
      // Accept both comma and dot as decimal separator from user input
      const cleaned = raw.replace(/[^0-9,\.]/g, '').replace(/,/g, '.');
      const num = parseFloat(cleaned || '0');
      if (isNaN(num)) { el.value = ''; return; }
      // format: thousands with dot, decimals with comma, 2 decimals, append €
      const parts = num.toFixed(2).split('.');
      parts[0] = Number(parts[0]).toLocaleString('de-DE');
      el.value = parts[0] + ',' + parts[1] + ' €';
    }
  }, true);

  // Al entrar en un campo km, quitar la unidad y desformatear para permitir edición
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el && el.classList && el.classList.contains('format-km')) {
      // Si el valor termina en ' km', lo quitamos y desformateamos
      const v = (el.value || '').toString().trim();
      if (v.endsWith(' km')) {
        const core = v.slice(0, -3).replace(/\./g, ''); // quitar puntos de miles
        el.value = core;
        // colocar caret al final
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
      }
    }

    // Al entrar en Alojamiento, quitar símbolo € y separadores de miles para edición
    if (el && el.classList && el.classList.contains('format-alojamiento')) {
      const v = (el.value || '').toString().trim();
      // Quitar sufijo ' €' si existe y cualquier espacio
      let core = v.replace(/\s*€\s*$/, '');
      // Eliminar puntos de miles
      core = core.replace(/\./g, '');
      // Si el usuario o el formato usa punto decimal, convertirlo a coma
      core = core.replace(/,/g, ',');
      // Dejar sólo dígitos y una coma decimal (si existe)
      core = core.replace(/[^0-9,]/g, '');
      const parts = core.split(',');
      if (parts.length > 2) core = parts[0] + ',' + parts.slice(1).join('');
      if (core !== el.value) el.value = core;
      try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
    }
  });

  // Función para crear un nuevo desplazamiento
  function crearNuevoDesplazamiento() {
    desplazamientoCounter++;
    const nuevoDesplazamiento = document.createElement("div");
    nuevoDesplazamiento.className = "desplazamiento-grupo";
    nuevoDesplazamiento.dataset.desplazamientoId = desplazamientoCounter;

    const tipoProyectoValor = tipoProyecto.value;
    const mostrarTicketCena = ["G24", "PEI", "NAL"].includes(tipoProyectoValor);

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

      <div class="form-row three-cols-33">
        <div class="form-group">
          <label for="origen-${desplazamientoCounter}">Origen</label>
          <input type="text" id="origen-${desplazamientoCounter}" name="origen-${desplazamientoCounter}" class="general-text" required />
        </div>
        <div class="form-group">
          <label for="destino-${desplazamientoCounter}">Destino</label>
          <input type="text" id="destino-${desplazamientoCounter}" name="destino-${desplazamientoCounter}" class="general-text" required />
        </div>
        <div class="form-group">
          <label for="pais-destino-${desplazamientoCounter}">País de Destino</label>
          <select id="pais-destino-${desplazamientoCounter}" name="pais-destino-${desplazamientoCounter}" required>
            <option value="España">España</option>
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

      <!-- tercera fila eliminada: Día/Hora redundantes (se mantiene la fila inicial con fechas y horas) -->

      <div class="form-group">
        <label for="motivo-${desplazamientoCounter}">Motivo del desplazamiento:</label>
        <input type="text" id="motivo-${desplazamientoCounter}" name="motivo-${desplazamientoCounter}" class="general-text" maxlength="90" required />
      </div>

      <div class="form-row two-cols-50-50">
        <div class="form-group">
          <label for="km-${desplazamientoCounter}">Km:</label>
          <input type="text" id="km-${desplazamientoCounter}" name="km-${desplazamientoCounter}" class="format-km" placeholder="0 km" />
        </div>
        <div class="form-group">
          <label for="alojamiento-${desplazamientoCounter}">Alojamiento (€):</label>
          <input type="text" id="alojamiento-${desplazamientoCounter}" name="alojamiento-${desplazamientoCounter}" class="format-alojamiento" placeholder="0,00 €" />
        </div>
      </div>

  <div class="ticket-cena-field conditional-row" id="ticket-cena-field-${desplazamientoCounter}" style="display: ${mostrarTicketCena ? 'block' : 'none'};">
        <div class="form-group">
          <label>
            <input type="checkbox" id="ticket-cena-${desplazamientoCounter}" name="ticket-cena-${desplazamientoCounter}" />
            Ticket Cena
          </label>
        </div>
      </div>

  <button type="button" class="btn-eliminar-desplazamiento" aria-label="Eliminar desplazamiento ${desplazamientoCounter}"><svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18v2H3V6zm2 3h14l-1.2 11.3A2 2 0 0 1 15.8 22H8.2a2 2 0 0 1-1.99-1.7L5 9zm5-7h4l1 1H9l1-1z"/></svg>Eliminar</button>
    `;

  // Animación de entrada
  nuevoDesplazamiento.classList.add('entry');
  desplazamientosContainer.appendChild(nuevoDesplazamiento);
  nuevoDesplazamiento.addEventListener('transitionend', () => nuevoDesplazamiento.classList.remove('entry'), { once: true });

    // Poblar el select de países del nuevo desplazamiento
    const nuevoSelectPais = document.getElementById(`pais-destino-${desplazamientoCounter}`);
    poblarSelectPaises(nuevoSelectPais);

    // Añadir listener para cambio de país
    nuevoSelectPais.addEventListener('change', () => {
      manejarCambioPais(desplazamientoCounter);
    });

    // Mostrar el botón de eliminar en el primer desplazamiento si es el segundo
    if (desplazamientoCounter === 2) {
      const primerDesplazamiento = desplazamientosContainer.querySelector('.desplazamiento-grupo');
      const primerBotonEliminar = primerDesplazamiento.querySelector('.btn-eliminar-desplazamiento');
      primerBotonEliminar.style.display = 'block';
    }

    // Asegurar que la numeración y visibilidad de títulos/botones se actualiza inmediatamente
    actualizarNumerosDesplazamientos();

    return nuevoDesplazamiento;
  }

  // Función para actualizar los números de los desplazamientos
  function actualizarNumerosDesplazamientos() {
    const desplazamientos = desplazamientosContainer.querySelectorAll('.desplazamiento-grupo');
    desplazamientos.forEach((desp, index) => {
      const titulo = desp.querySelector('.desplazamiento-titulo');
      if (desplazamientos.length > 1) {
        if (titulo) { titulo.textContent = `Desplazamiento ${index + 1}`; titulo.style.display = 'block'; }
      } else {
        if (titulo) { titulo.style.display = 'none'; }
      }
    });

    // Mostrar/ocultar botones eliminar
    if (desplazamientos.length > 1) {
      desplazamientos.forEach(d => {
        const btn = d.querySelector('.btn-eliminar-desplazamiento');
        if (btn) { btn.style.display = 'block'; btn.setAttribute('aria-label', `Eliminar desplazamiento ${[...desplazamientos].indexOf(d)+1}`); }
      });
    } else if (desplazamientos.length === 1) {
      const btn = desplazamientos[0].querySelector('.btn-eliminar-desplazamiento');
      if (btn) btn.style.display = 'none';
    }
  }

  // Evento para añadir desplazamiento (con auto-scroll + autofocus)
  btnAddDesplazamiento.addEventListener("click", () => {
    const nuevo = crearNuevoDesplazamiento();
    const firstInput = nuevo.querySelector('input, select');
    if (firstInput) {
      nuevo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => firstInput.focus(), 220);
    }
  });

  // Evento para eliminar desplazamiento (confirmación modal)
  desplazamientosContainer.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-eliminar-desplazamiento")) {
      const grupo = e.target.closest(".desplazamiento-grupo");
      const titulo = grupo.querySelector('.desplazamiento-titulo')?.textContent || '';
      const confirmed = await showConfirm(`¿Eliminar ${titulo}?`);
      if (!confirmed) return;
      grupo.remove();

      // Actualizar numeración
      actualizarNumerosDesplazamientos();

      // Si solo queda un desplazamiento, ocultar su botón de eliminar
      const desplazamientos = desplazamientosContainer.querySelectorAll('.desplazamiento-grupo');
      if (desplazamientos.length === 1) {
        const botonEliminar = desplazamientos[0].querySelector('.btn-eliminar-desplazamiento');
        botonEliminar.style.display = 'none';
      }
    }
  });

  // Listener para cambio de tipo de proyecto (actualizar ticket cena)
  tipoProyecto.addEventListener('change', actualizarTicketCena);

  // (Paises ya se cargan en la petición principal arriba)
});
