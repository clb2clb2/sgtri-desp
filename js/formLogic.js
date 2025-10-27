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
        // Determine max raw length from attribute or maxlength (fallback to 34)
        const attrMax = parseInt(el.getAttribute && el.getAttribute('data-raw-max')) || parseInt(el.getAttribute && el.getAttribute('maxlength')) || 34;
        // Si justo antes del caret hay un espacio (usuario acaba de teclear espacio), respetamos el espacio y no reagrupamos
        if (selStart > 0 && v[selStart - 1] === ' ') {
          // Permitimos espacios escritos por el usuario; limpiamos otros caracteres inválidos y forzamos mayúsculas
          const cleaned = v.replace(/[^A-Za-z0-9 ]/g, '').toUpperCase();
          // Limitar al número máximo de caracteres alfanuméricos
          const onlyAlnum = cleaned.replace(/[^A-Za-z0-9]/g, '');
          const limitedAlnum = onlyAlnum.slice(0, attrMax);
          // Reconstruir manteniendo los espacios lo más posible: simple fallback — quitar exceso al final
          if (onlyAlnum.length <= attrMax) return cleaned.toUpperCase();
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
        const raw = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, attrMax);
        const parts = raw.match(/.{1,4}/g) || [];
        return parts.join(' ').toUpperCase();
      });
      return;
    }

    // SWIFT/BIC: sólo alfanumérico, mayúsculas, hasta 11 caracteres
    if (el.id === 'swift' || el.classList.contains('swift')) {
      applyWithCaretPreserved(el, (val) => {
        const v = String(val || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return v.slice(0, 11);
      });
      return;
    }

    // Número de tarjeta (Tarjeta UEx): sólo dígitos, agrupar en bloques de 4, hasta 19 dígitos
    if (el.id === 'numero-tarjeta' || el.classList.contains('card-number')) {
      // Use processGroupedInput for caret-preserving grouping
      processGroupedInput(el, { groupSize: 4, sep: ' ', maxRawLen: 19, validPattern: '\\d' });
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
      // Exponer los datos cargados para que otros módulos (dietasCalc, etc.) puedan consultarlos
      try { window.__sgtriDatos = data; } catch (e) {}
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
  //     Ahora usamos el array `dietasPorPais.paises` desde datos.json
  // -------------------------
  paisesData = (data.dietasPorPais && data.dietasPorPais.paises) ? data.dietasPorPais.paises : [];
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
      // Render inicial de campos de pago según la opción seleccionada
      renderPagoFields(tipoPagoSelect.value);
      // Escuchar cambios en el select de pago para render dinámico
      tipoPagoSelect.addEventListener('change', (e) => {
        renderPagoFields(e.target.value);
      });
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
        <strong>Decreto 42/2025 (Junta de Extremadura)</strong>.  
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
    const esRD462 = ["G24", "PEI", "NAL"].includes(tipoProyectoValor);
    // Para cada desplazamiento: mostrar sólo si es RD462 y la hora de regreso es > 22:00 (a partir de 22:01)
    document.querySelectorAll('.desplazamiento-grupo').forEach(desp => {
      const id = desp.dataset.desplazamientoId;
      const field = desp.querySelector(`#ticket-cena-field-${id}`);
      if (!field) return;
      if (!esRD462) { field.style.display = 'none'; return; }
      const horaRegresoEl = desp.querySelector(`#hora-regreso-${id}`);
      const valor = (horaRegresoEl && horaRegresoEl.value) ? horaRegresoEl.value.trim() : '';
      let mostrar = false;
      const m = valor.match(/^(\d{1,2}):(\d{2})$/);
      if (m) {
        const hh = parseInt(m[1], 10);
        // const mm = parseInt(m[2], 10);
        // Mostrar ticket-cena para RD462/2002 cuando la hora de regreso sea >= 22:00
        if (hh >= 22) mostrar = true;
      }
      field.style.display = mostrar ? 'block' : 'none';
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
      // Immediately remove/hide any existing calc-result until cruces are valid
      try {
        const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${desplazamientoId}"]`);
        if (desp) {
          const calc = desp.querySelector('.calc-result'); if (calc && calc.parentNode) calc.parentNode.removeChild(calc);
          const just = desp.querySelector('.justificar-pernocta-field'); if (just && just.parentNode) just.parentNode.removeChild(just);
        }
        // Then run validation which will insert the specific error message under fronteras
        validateCrucesAndUpdateUI(desplazamientoId);
      } catch (e) {}
    } else {
      fronterasFields.style.display = 'none';
      cruceIda.required = false;
      cruceVuelta.required = false;
      cruceIda.value = '';
      cruceVuelta.value = '';
      // Clear any cruce-related error message and allow recalculation
      try {
        const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${desplazamientoId}"]`);
        if (desp && desp.dataset && desp.dataset.dtInvalid) delete desp.dataset.dtInvalid;
        const existingMsg = document.getElementById(`cruce-order-error-${desplazamientoId}`);
        if (existingMsg && existingMsg.parentNode) existingMsg.parentNode.removeChild(existingMsg);
        // trigger recalculation to show calc-result again if dates/times present
        const id = desplazamientoId; setTimeout(() => { validateDateTimePairAndUpdateUI(id); recalculateDesplazamientoById(id); }, 60);
      } catch (e) {}
    }
  }

  // Función para poblar select de países
  function poblarSelectPaises(selectElement) {
    // Limpiar opciones existentes para evitar duplicados
    if (!selectElement) return;
    selectElement.innerHTML = '';
    paisesData.forEach(pais => {
      const option = document.createElement("option");
      option.value = pais;
      option.textContent = pais;
      selectElement.appendChild(option);
    });
    // Seleccionar España por defecto si existe
    try {
      const tieneEspaña = paisesData.indexOf('España') !== -1;
      if (tieneEspaña) selectElement.value = 'España';
      else if (selectElement.options.length > 0) selectElement.selectedIndex = 0;
    } catch (e) {}
  }

  // -------------------------
  // FICHA VEHÍCULO PARTICULAR
  // -------------------------
  const vehiculoContainer = document.getElementById('vehiculo-particular-container');
  let vehiculoVisible = false;

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
                <input type="text" id="veh-marca" name="veh-marca" class="veh-text" />
              </div>
              <div class="form-group">
                <label for="veh-modelo">Modelo:</label>
                <input type="text" id="veh-modelo" name="veh-modelo" class="veh-text" />
              </div>
              <div class="form-group">
                <label for="veh-matricula">Matrícula:</label>
                <input type="text" id="veh-matricula" name="veh-matricula" class="veh-text" />
              </div>
        </div>
      </div>
    `;

    // Sanear inputs de vehículo
    const vehTextHandler = (e) => {
      const el = e.target;
      if (!el) return;
      // permitir sólo letras/números/espacios/.-
      const cleaned = String(el.value || '').replace(/[^0-9A-Za-z\u00C0-\u017F .\-]/g, '');
      // matrícula en mayúsculas
      if (el.id === 'veh-matricula') el.value = cleaned.toUpperCase(); else el.value = cleaned;
    };

    vehiculoContainer.querySelectorAll('.veh-text').forEach(inp => {
      inp.addEventListener('input', vehTextHandler);
    });

    // Listener para cambio de tipo de vehículo para recalcular todos los desplazamientos
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

  function mostrarFichaVehiculo() {
    if (!vehiculoContainer) return;
    if (!vehiculoVisible) {
      crearFichaVehiculo();
      vehiculoVisible = true;
    }
    vehiculoContainer.style.display = '';
  }

  function ocultarFichaVehiculo() {
    if (!vehiculoContainer) return;
    vehiculoContainer.style.display = 'none';
    vehiculoVisible = false;
  }

  // Comprobar si algún desplazamiento tiene km > 0 y mostrar/ocultar ficha
  function evaluarKmParaMostrarFicha() {
    const anyKm = Array.from(document.querySelectorAll('.desplazamiento-grupo .format-km')).some(inp => {
      const v = (inp.value || '').toString().replace(/[^0-9,\.]/g, '').replace(/\./g, '').replace(/,/g, '.');
      const n = parseFloat(v) || 0;
      return n > 0;
    });
    if (anyKm) mostrarFichaVehiculo(); else ocultarFichaVehiculo();
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

  // Devuelve Date|null para dd/mm/aa string; requiere dd/mm/aa completo
  function parseDateStrict(ddmmaa) {
    if (!ddmmaa) return null;
    const parts = String(ddmmaa).split('/').map(p => p.trim());
    if (parts.length !== 3) return null;
    if (parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 2) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = 2000 + parseInt(parts[2], 10);
    if (!isValidDate(d, m, y)) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  // Devuelve objeto {hh,mm} o null para hora en formato hh:mm (requiere dos dígitos o 1+):
  function parseTimeStrict(hhmm) {
    if (!hhmm) return null;
    const raw = String(hhmm).trim();
    // Accept formats: H, HH, H:MM, HH:MM. If minutes omitted, assume 00.
    const m = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m) return null;
    const hh = parseInt(m[1], 10);
    let mm = (typeof m[2] !== 'undefined' && m[2] !== '') ? parseInt(m[2], 10) : 0;
    if (isNaN(hh) || isNaN(mm)) return null;
    // If minutes provided with one digit, treat as tens (e.g., '9:5' -> '09:05') handled elsewhere
    if (mm >= 0 && mm <= 9 && m[2] && m[2].length === 1) {
      // keep as is (05), parseInt already correct
    }
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { hh, mm };
  }

  // Comprueba que fecha/hora de regreso es posterior a salida para un desplazamiento
  // y actualiza la UI: aplica/remueve clase de campo-error y oculta el calc-result si hay error.
  function validateDateTimePairAndUpdateUI(id) {
    try {
      const fechaIdEl = document.getElementById(`fecha-ida-${id}`);
      const horaIdEl = document.getElementById(`hora-ida-${id}`);
      const fechaRegEl = document.getElementById(`fecha-regreso-${id}`);
      const horaRegEl = document.getElementById(`hora-regreso-${id}`);
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (!fechaIdEl || !horaIdEl || !fechaRegEl || !horaRegEl) return true;

      // parse strict
      const fId = parseDateStrict(fechaIdEl.value);
      const fReg = parseDateStrict(fechaRegEl.value);
      const tId = parseTimeStrict(horaIdEl.value);
      const tReg = parseTimeStrict(horaRegEl.value);

      // If any of the fields are partially filled or invalid, hide calc-result and mark invalid
      const calc = desp ? desp.querySelector('.calc-result') : null;
      const anyInvalidFormat = (!fId && fechaIdEl.value) || (!fReg && fechaRegEl.value) || (!tId && horaIdEl.value) || (!tReg && horaRegEl.value);
      if (anyInvalidFormat) {
        // If user left an invalid format which we've cleared on blur, hide calc-result
        // but DO NOT mark the fields in red (red is reserved for ordering errors).
        if (desp) { desp.dataset.dtInvalid = '1'; }
        if (calc) calc.style.display = 'none';
        const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;
        if (just) just.style.display = 'none';
        return false;
      }

      // If any are empty (not provided) and there is a dtInvalid flag, keep calc hidden until corrected
      if (!fId || !fReg || !tId || !tReg) {
        if (desp && desp.dataset && desp.dataset.dtInvalid === '1') {
          if (calc) calc.style.display = 'none';
          const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;
          if (just) just.style.display = 'none';
          return false;
        }
        // remove error state
        [fechaIdEl, horaIdEl, fechaRegEl, horaRegEl].forEach(n => n && n.classList && n.classList.remove('field-error'));
        if (calc) calc.style.display = ''; // leave visibility decision to recalc
        // ensure justificar visible only if calc visible
        const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;
        if (just) just.style.display = '';
        return true;
      }

      // build full Date objects including times
      const dtId = new Date(fId.getFullYear(), fId.getMonth(), fId.getDate(), tId.hh, tId.mm, 0, 0);
      const dtReg = new Date(fReg.getFullYear(), fReg.getMonth(), fReg.getDate(), tReg.hh, tReg.mm, 0, 0);

      if (dtReg <= dtId) {
        // invalid order: mark fields in red and hide calc-result
        [fechaIdEl, horaIdEl, fechaRegEl, horaRegEl].forEach(n => n && n.classList && n.classList.add('field-error'));
        if (calc) calc.style.display = 'none';
        const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;
        if (just) just.style.display = 'none';
        // Insert inline message near the top row of this desplazamiento
        try {
          const existingMsg = desp ? desp.querySelector(`#dt-order-error-${id}`) : null;
          if (!existingMsg && desp) {
            const topRow = desp.querySelector('.form-row.four-cols-25');
            const msg = document.createElement('div');
            msg.id = `dt-order-error-${id}`;
            msg.className = 'dt-order-error';
            msg.textContent = 'El regreso debe ser posterior a la salida.';
            if (topRow && topRow.parentNode) topRow.parentNode.insertBefore(msg, topRow.nextSibling);
            else if (calc && calc.parentNode) calc.parentNode.insertBefore(msg, calc);
          }
        } catch (e) {}
        return false;
      }

  // Ok: remove error classes, clear dtInvalid flag and show calc-result
  if (desp && desp.dataset && desp.dataset.dtInvalid) delete desp.dataset.dtInvalid;
  [fechaIdEl, horaIdEl, fechaRegEl, horaRegEl].forEach(n => n && n.classList && n.classList.remove('field-error'));
  if (calc) calc.style.display = '';
  const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;
  if (just) just.style.display = '';
  // Remove any inline order message if present
  try { const existingMsg = desp ? desp.querySelector(`#dt-order-error-${id}`) : null; if (existingMsg && existingMsg.parentNode) existingMsg.parentNode.removeChild(existingMsg); } catch(e) {}
  // trigger recalculation to ensure calc-result is in sync
  recalculateDesplazamientoById(id);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Validate cruce-ida and cruce-vuelta dates relative to salida/regreso.
  // Marks fields with .field-error when inconsistent and hides calc-result until corrected.
  function validateCrucesAndUpdateUI(id) {
    try {
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (!desp) return true;
      const fechaIdEl = document.getElementById(`fecha-ida-${id}`);
      const fechaRegEl = document.getElementById(`fecha-regreso-${id}`);
      const cruceIdEl = document.getElementById(`cruce-ida-${id}`);
      const cruceVueltaEl = document.getElementById(`cruce-vuelta-${id}`);
      const calc = desp.querySelector('.calc-result');
      // Determine if this desplazamiento is marked as international by the pais select
      const paisEl = desp.querySelector(`#pais-destino-${id}`);
      const isInternational = paisEl && paisEl.value && String(paisEl.value).trim() !== '' && String(paisEl.value).trim() !== 'España';
      // If cruce fields not present and not international, clear state
      if (!cruceIdEl || !cruceVueltaEl) {
        if (!isInternational) return true;
        // International but cruces inputs missing: treat as invalid until provided
        // mark as invalid and show message
        if (desp) { desp.dataset.dtInvalid = '1'; }
        if (calc) calc.style.display = 'none';
        try {
          const existingMsg = desp.querySelector(`#cruce-order-error-${id}`);
          if (!existingMsg && desp) {
            const fronteras = desp.querySelector(`#fronteras-fields-${id}`);
            const msg = document.createElement('div');
            msg.id = `cruce-order-error-${id}`;
            msg.className = 'dt-order-error';
            msg.textContent = 'Por favor, revisa las fechas.';
            // Insertar como hermano siguiente del contenedor de fronteras para que quede debajo, no dentro
            if (fronteras && fronteras.insertAdjacentElement) fronteras.insertAdjacentElement('afterend', msg);
            else if (fronteras && fronteras.parentNode) fronteras.parentNode.insertBefore(msg, fronteras.nextSibling);
            else if (calc && calc.parentNode) calc.parentNode.insertBefore(msg, calc);
          }
        } catch (e) {}
        return false;
      }

      // If international and cruces exist but are empty -> hide calculations and wait (no message)
      if (isInternational && (String(cruceIdEl.value || '').trim() === '' || String(cruceVueltaEl.value || '').trim() === '')) {
        if (desp) { desp.dataset.dtInvalid = '1'; }
        if (calc) calc.style.display = 'none';
        // Do not show an inline error message for blank cruces; wait for user input
        return false;
      }

      const fId = parseDateStrict(fechaIdEl && fechaIdEl.value);
      const fReg = parseDateStrict(fechaRegEl && fechaRegEl.value);
      const cId = parseDateStrict(cruceIdEl && cruceIdEl.value);
      const cV = parseDateStrict(cruceVueltaEl && cruceVueltaEl.value);

      // If any cruce field has partial/invalid format -> hide calc and set dtInvalid
      const anyInvalidFormat = ((!cId && cruceIdEl.value) || (!cV && cruceVueltaEl.value));
      if (anyInvalidFormat) {
        if (desp) { desp.dataset.dtInvalid = '1'; }
        if (calc) calc.style.display = 'none';
        // Insert inline message telling user to review dates
        try {
          const existingMsg = desp.querySelector(`#cruce-order-error-${id}`);
          if (!existingMsg && desp) {
            const fronteras = desp.querySelector(`#fronteras-fields-${id}`);
            const msg = document.createElement('div');
            msg.id = `cruce-order-error-${id}`;
            msg.className = 'dt-order-error';
            msg.textContent = 'Por favor, revisa las fechas.';
            if (fronteras && fronteras.insertAdjacentElement) fronteras.insertAdjacentElement('afterend', msg);
            else if (fronteras && fronteras.parentNode) fronteras.parentNode.insertBefore(msg, fronteras.nextSibling);
            else if (calc && calc.parentNode) calc.parentNode.insertBefore(msg, calc);
          }
        } catch (e) {}
        // mark but do not set red unless ordering wrong
        return false;
      }

      // If any of the cruce fields are empty and dtInvalid flagged, keep calc hidden
      if (!cId || !cV) {
        if (desp && desp.dataset && desp.dataset.dtInvalid === '1') {
          if (calc) calc.style.display = 'none';
          return false;
        }
        // remove any previous error markers
        [cruceIdEl, cruceVueltaEl].forEach(n => n && n.classList && n.classList.remove('field-error'));
        return true;
      }

      // Now check logical ordering: fechaId <= cruceId <= cruceVuelta <= fechaRegreso
      let orderingOk = true;
      if (fId && cId && cId < fId) orderingOk = false;
      if (fReg && cV && cV > fReg) orderingOk = false;
      if (cId && cV && cV < cId) orderingOk = false;

      if (!orderingOk) {
        // mark cruces in red and hide calc
        [cruceIdEl, cruceVueltaEl].forEach(n => n && n.classList && n.classList.add('field-error'));
        if (calc) calc.style.display = 'none';
        try {
          const existingMsg = desp.querySelector(`#cruce-order-error-${id}`);
          if (!existingMsg && desp) {
            const fronteras = desp.querySelector(`#fronteras-fields-${id}`);
            const msg = document.createElement('div');
            msg.id = `cruce-order-error-${id}`;
            msg.className = 'dt-order-error';
            msg.textContent = 'Por favor, revisa las fechas.';
            // Preferir insertar justo después del contenedor de fronteras para que el mensaje quede debajo
            if (fronteras && fronteras.insertAdjacentElement) fronteras.insertAdjacentElement('afterend', msg);
            else if (fronteras && fronteras.parentNode) fronteras.parentNode.insertBefore(msg, fronteras.nextSibling);
            else if (calc && calc.parentNode) calc.parentNode.insertBefore(msg, calc);
          }
        } catch (e) {}
        return false;
      }

      // OK: remove error classes and allow calc to show (visibility controlled elsewhere)
      [cruceIdEl, cruceVueltaEl].forEach(n => n && n.classList && n.classList.remove('field-error'));
      if (desp && desp.dataset && desp.dataset.dtInvalid) delete desp.dataset.dtInvalid;
      try { const existingMsg = desp.querySelector(`#cruce-order-error-${id}`); if (existingMsg && existingMsg.parentNode) existingMsg.parentNode.removeChild(existingMsg); } catch(e) {}
      return true;
    } catch (e) { return true; }
  }

  // Delegación para formatear inputs de fecha al perder foco
  document.addEventListener('blur', (e) => {
    const el = e.target;
    if (el && el.classList && el.classList.contains('input-fecha')) {
      // On blur: we only keep the value if it can be interpreted as a full valid dd/mm/aa date.
      const v = (el.value || '').trim();
      const digits = (v.replace(/[^0-9]/g, '') || '');
      let final = '';
      if (digits.length === 4) {
        // If user typed ddmm, complete with current year (last two digits)
        const yy = (new Date()).getFullYear().toString().slice(-2);
        const candidate = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + yy;
        const parts = candidate.split('/');
        const d = parseInt(parts[0],10);
        const m = parseInt(parts[1],10);
        const y = 2000 + parseInt(parts[2],10);
        if (isValidDate(d,m,y)) final = parts[0].padStart(2,'0') + '/' + parts[1].padStart(2,'0') + '/' + parts[2];
      } else {
        // Try to normalize full date and require full dd/mm/aa
        const formatted = formatFechaValue(v);
        const parts = (formatted || '').split('/').map(p => p || '');
        if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 2) {
          const d = parseInt(parts[0],10);
          const m = parseInt(parts[1],10);
          const y = 2000 + parseInt(parts[2],10);
          if (isValidDate(d,m,y)) final = parts[0].padStart(2,'0') + '/' + parts[1].padStart(2,'0') + '/' + parts[2];
        }
      }
      // If final is empty -> invalid date, clear field to show placeholder
      el.value = final;
      // After blur, validate the date/time pair ordering and visibility of calc-result
      // Find desplazamiento id from element id (expects pattern fecha-ida-N or fecha-regreso-N)
      const match = (el.id || '').match(/(fecha|hora)-(ida|regreso)-(\d+)/);
      if (match) {
        const id = match[3];
        const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
        if (final === '') {
          // mark this desplazamiento as having an invalid date/time input (cleared on blur)
          if (desp) { desp.dataset.dtInvalid = '1'; const calc = desp.querySelector('.calc-result'); if (calc) calc.style.display = 'none'; const just = desp.querySelector('.justificar-pernocta-field'); if (just) just.style.display = 'none'; }
        }
        validateDateTimePairAndUpdateUI(id);
      }
    }

    // Hora: validar hh/mm cuando se pierda foco
    if (el && el.classList && el.classList.contains('input-hora')) {
      const v = (el.value || '').trim();
      // If the user left the field completely empty, keep it empty so the placeholder shows (hh:mm)
      if (v === '') {
        el.value = '';
        const matchEmpty = (el.id || '').match(/(fecha|hora)-(ida|regreso)-(\d+)/);
        if (matchEmpty) {
          const id = matchEmpty[3];
          const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
          if (desp) { desp.dataset.dtInvalid = '1'; const calc = desp.querySelector('.calc-result'); if (calc) calc.style.display = 'none'; const just = desp.querySelector('.justificar-pernocta-field'); if (just) just.style.display = 'none'; }
          validateDateTimePairAndUpdateUI(id);
        }
        return;
      }

  const parts = v.split(':').map(p => p.replace(/[^0-9]/g, ''));
  let hh = parts[0] || '';
  let mm = (typeof parts[1] !== 'undefined') ? (parts[1] || '') : '';
  // If user provided only hours (e.g. "9" or "18"), assume minutes = '00'
  if (mm === '') mm = '00';
  if (hh.length === 1) hh = '0' + hh;
  if (mm.length === 1) mm = '0' + mm;
      // validar rangos
      const hnum = parseInt(hh, 10);
      const mnum = parseInt(mm, 10);
      let valid = true;
      if (!isNaN(hnum) && hnum >= 0 && hnum <= 23) {
        // ok
      } else {
        valid = false;
      }
      if (!isNaN(mnum) && mnum >= 0 && mnum <= 59) {
        // ok
      } else {
        valid = false;
      }
      if (valid) el.value = (hh || '00') + ':' + (mm || '00'); else el.value = '';
      // After blur, validate the date/time pair ordering and visibility of calc-result
      const match = (el.id || '').match(/(fecha|hora)-(ida|regreso)-(\d+)/);
      if (match) {
        const id = match[3];
        const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
        if (!valid) {
          if (desp) { desp.dataset.dtInvalid = '1'; const calc = desp.querySelector('.calc-result'); if (calc) calc.style.display = 'none'; const just = desp.querySelector('.justificar-pernocta-field'); if (just) just.style.display = 'none'; }
        }
        validateDateTimePairAndUpdateUI(id);
      }
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

  // Keydown handler: cuando el usuario pulsa ':' dentro de un campo de hora
  // y el valor actual son solo horas, autocompletamos a ':00' inmediatamente.
  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (!el || !el.classList || !el.classList.contains('input-hora')) return;
    if (e.key === ':') {
      const v = (el.value || '').trim();
      // si el valor actual es solo 1-2 dígitos (horas), interceptar
      if (/^\d{1,2}$/.test(v)) {
        e.preventDefault();
        let hh = v;
        if (hh.length === 1) hh = '0' + hh;
        // dejar el ':' y posicionar el cursor después para que el usuario escriba minutos
        el.value = hh + ':';
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (err) {}
      }
    }
  });

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

  <!-- Ticket Cena (oculto por defecto, se mostrará según tipo de proyecto y hora de regreso) -->
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
          <input type="text" id="origen-${desplazamientoCounter}" name="origen-${desplazamientoCounter}" class="general-text" required />
        </div>
        <div class="form-group">
          <label for="destino-${desplazamientoCounter}">Destino</label>
          <input type="text" id="destino-${desplazamientoCounter}" name="destino-${desplazamientoCounter}" class="general-text" required />
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

  // Adjuntar listeners de cálculo al nuevo desplazamiento
  if (desplazamientoCounter) attachCalcListenersToDesplazamiento(desplazamientoCounter);

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


  // -------------------------
  // Render dinámico de campos de pago según #tipo-pago
  // -------------------------
  function renderPagoFields(tipo) {
    const mid = document.getElementById('pago-iban-container');
    const right = document.getElementById('pago-swift-container');
    const tipoPagoEl = document.getElementById('tipo-pago');
    // parent row that wraps the select + mid + right
    const parentRow = (tipoPagoEl && tipoPagoEl.closest) ? tipoPagoEl.closest('.form-row') : null;
    if (!mid || !right) return;
    // Clear both containers
    mid.innerHTML = '';
    right.innerHTML = '';

    // Helper to set layout mode
    function setLayoutThreeCols() {
      if (parentRow) parentRow.className = 'form-row three-cols-25-50-25';
      right.style.display = '';
      // avoid visual overflow
      right.style.overflow = 'hidden';
    }
    function setLayoutTwoCols() {
      if (parentRow) parentRow.className = 'form-row two-cols-25-75';
      // hide right column so grid with two columns applies cleanly
      right.style.display = 'none';
      right.style.overflow = '';
    }

    if (tipo === 'CE' || tipo === 'Cuenta Española' || tipo === 'CuentaEsp') {
      // Cuenta Española: layout de dos columnas 25-75, un solo IBAN en el medio (raw max 20)
      setLayoutTwoCols();
      mid.innerHTML = `
        <label for="iban">IBAN:</label>
        <input type="text" id="iban" name="iban" class="iban" />
      `;
      // set display maxlength accounting for grouping (groups of 4 -> separators every 4 chars)
      (function(){
        const rawMax = 24;
        const sepCount = Math.floor((rawMax - 1) / 4);
        const displayMax = rawMax + sepCount;
        const inp = mid.querySelector('input');
        if (inp) { inp.setAttribute('maxlength', String(displayMax)); inp.setAttribute('data-raw-max', String(rawMax)); }
      })();
      return;
    }

    if (tipo === 'CI' || tipo === 'Cuenta Extranjera' || tipo === 'CuentaExtranjera') {
      // Cuenta Extranjera: layout de tres columnas 25-50-25; IBAN-ext en el medio (raw max 34), SWIFT a la derecha
      setLayoutThreeCols();
      mid.innerHTML = `
        <label for="iban-ext">IBAN:</label>
        <input type="text" id="iban-ext" name="iban-ext" class="iban" />
      `;
      // compute display maxlength for raw 34
      (function(){
        const rawMax = 34;
        const sepCount = Math.floor((rawMax - 1) / 4);
        const displayMax = rawMax + sepCount;
        const inp = mid.querySelector('input');
        if (inp) { inp.setAttribute('maxlength', String(displayMax)); inp.setAttribute('data-raw-max', String(rawMax)); }
      })();
      right.innerHTML = `
        <label for="swift">SWIFT/BIC:</label>
        <input type="text" id="swift" name="swift" class="swift" maxlength="11" />
      `;
      // rely on CSS to handle input overflow; do not force container clipping here
      return;
    }

    if (tipo === 'TJ' || tipo === 'Tarjeta UEx' || tipo === 'TarjetaUEx') {
      // Tarjeta: usar layout de dos columnas 25-75 (select + tarjeta en medio)
      setLayoutTwoCols();
      mid.innerHTML = `
        <label for="numero-tarjeta">Número de tarjeta:</label>
        <input type="text" id="numero-tarjeta" name="numero-tarjeta" class="card-number" maxlength="23" />
      `;
      // Attach immediate grouping for any prefilled value
      setTimeout(() => {
        const cardEl = document.getElementById('numero-tarjeta');
        if (cardEl) processGroupedInput(cardEl, { groupSize: 4, sep: ' ', maxRawLen: 19, validPattern: '\\d' });
      }, 10);
      return;
    }

    // Fallback: IBAN simple en el medio
    mid.innerHTML = `
      <label for="iban">IBAN:</label>
      <input type="text" id="iban" name="iban" class="iban" maxlength="34" data-raw-max="34" />
    `;
  }

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

      // Re-evaluar visibilidad de ficha de vehículo y recalcular desplazamientos restantes
      const desplazamientos = desplazamientosContainer.querySelectorAll('.desplazamiento-grupo');
      // ocultar botón eliminar si sólo queda uno
      if (desplazamientos.length === 1) {
        const botonEliminar = desplazamientos[0].querySelector('.btn-eliminar-desplazamiento');
        if (botonEliminar) botonEliminar.style.display = 'none';
      }
      // Recalcular todos los desplazamientos y evaluar ficha vehiculo
      setTimeout(() => {
        document.querySelectorAll('.desplazamiento-grupo').forEach(el => {
          const id = el.dataset.desplazamientoId;
          if (id) recalculateDesplazamientoById(id);
        });
        evaluarKmParaMostrarFicha();
      }, 60);
    }
  });

    // -------------------------
    // Integración con dietasCalc: recopilación de datos y render de resultados
    // -------------------------
    function collectDesplazamientoData(despEl) {
      const id = despEl && despEl.dataset && despEl.dataset.desplazamientoId;
      const safeVal = (sel) => (sel ? sel.value : '');
      return {
        fechaIda: safeVal(despEl.querySelector(`#fecha-ida-${id}`)),
        horaIda: safeVal(despEl.querySelector(`#hora-ida-${id}`)),
        fechaRegreso: safeVal(despEl.querySelector(`#fecha-regreso-${id}`)),
        horaRegreso: safeVal(despEl.querySelector(`#hora-regreso-${id}`)),
        // fechas de cruce de fronteras (opcional, usadas para viajes internacionales)
        cruceIda: safeVal(despEl.querySelector(`#cruce-ida-${id}`)),
        cruceVuelta: safeVal(despEl.querySelector(`#cruce-vuelta-${id}`)),
        pais: safeVal(despEl.querySelector(`#pais-destino-${id}`)),
        // include the selectedIndex of the pais select so the calc can use the index directly
        paisIndex: (function(){ const el = despEl.querySelector(`#pais-destino-${id}`); return (el && typeof el.selectedIndex === 'number') ? el.selectedIndex : -1; })(),
        km: safeVal(despEl.querySelector(`#km-${id}`)),
        alojamiento: safeVal(despEl.querySelector(`#alojamiento-${id}`)),
        // include whether the ticket-cena checkbox is checked for this desplazamiento
        ticketCena: !!(despEl.querySelector(`#ticket-cena-${id}`) && despEl.querySelector(`#ticket-cena-${id}`).checked),
        // include global tipoProyecto selection so calc can pick normative rules
        tipoProyecto: (document.getElementById('tipoProyecto') ? document.getElementById('tipoProyecto').value : '')
      };
    }

    function renderCalcResult(despEl, result) {
      if (!despEl || !result) return;
      let out = despEl.querySelector('.calc-result');
      // Format numbers with '.' as thousands separator and ',' as decimal (de-DE)
      const fmt = (n, opts) => (Number(n) || 0).toLocaleString('de-DE', Object.assign({ minimumFractionDigits: 2, maximumFractionDigits: 2 }, opts || {}));
      const fmtInt = (n) => (Number(n) || 0).toLocaleString('de-DE');

      // detect tipo de vehículo para formateo de tarifa en el texto
      let tipoVehiculo = 'coche';
      try { const rv = document.querySelector('input[name="vehiculo-tipo"]:checked'); if (rv && rv.value) tipoVehiculo = rv.value; } catch(e){}

  // Use per-country per-unit manutención price if provided by calc
  const precioManUnit = (result && result.precioManutencion) ? Number(result.precioManutencion) : 50.55;
  const precioManTxt = precioManUnit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const manutLabel = `Manutención: ${fmtInt(result.manutenciones)} × ${precioManTxt} €`;
  const manutAmount = fmt(result.manutencionesAmount);

  // Show appropriate alojamiento max depending on ambiguity:
  // - If ambiguous: by default show the 'not counted' value (checkbox unchecked),
  //   the checkbox will allow switching to the counted value.
  // - If not ambiguous: show the actual computed noches and amount.
  let alojamientoLabel = '';
  // Use per-country per-unit alojamiento price if provided by calc
  const precioNocheUnit = (result && result.precioNoche) ? Number(result.precioNoche) : 98.88;
  const precioNocheTxt = precioNocheUnit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (result.nochesAmbiguous) {
    alojamientoLabel = `Alojamiento: <em>[ máx: ${fmtInt(result.nochesIfNotCounted || 0)} noches × ${precioNocheTxt} € = ${fmt(result.nochesAmountIfNotCounted || 0)} € ]</em>`;
  } else {
    alojamientoLabel = `Alojamiento: <em>[ máx: ${fmtInt(result.noches || 0)} noches × ${precioNocheTxt} € = ${fmt(result.nochesAmount || 0)} € ]</em>`;
  }
  const alojamientoAmount = fmt(Number(result.alojamiento || 0));

      const tarifa = (result && result.precioKm) ? Number(result.precioKm) : 0.26;
      const tarifaTxt = (tipoVehiculo === 'motocicleta') ? tarifa.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : tarifa.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const kmLabel = `Km. en vehículo propio: ${fmtInt(result.km)} × ${tarifaTxt} €`;
      const kmAmount = fmt(result.kmAmount);

      // IRPF: importe sujeto a retención (si viene en result, mostrar desglose)
          const irpfSujetoVal = (result && result.irpf && typeof result.irpf.sujeto !== 'undefined') ? Number(result.irpf.sujeto) : 0;
          const irpfSujetoStr = fmt(irpfSujetoVal);
          // Build a detailed per-day operations string (always present when breakdown exists)
          let irpfDetailsHtml = '';
          // Also show which limits were applied (helpful to debug esp vs ext)
          let irpfLimitsNote = '';
          try {
            if (result && result.irpf && Array.isArray(result.irpf.limitesUsed)) {
              const lims = result.irpf.limitesUsed;
              const src = result.irpfSource || (result.paisIndex === 0 ? 'esp' : 'ext');
              irpfLimitsNote = `<div class="irpf-limits-note">límites aplicados: <strong>${src}</strong> [sin pernocta: ${fmt(lims[0])} € / con pernocta: ${fmt(lims[1])} €] (paisIndex: ${typeof result.paisIndex !== 'undefined' ? result.paisIndex : 'n/a'})</div>`;
            }
          } catch (e) { irpfLimitsNote = ''; }
          try {
            if (result && result.irpf && Array.isArray(result.irpf.breakdown) && result.irpf.breakdown.length > 0) {
              const rows = result.irpf.breakdown.map(d => {
                const unitsTxt = (d.units % 1 === 0) ? String(d.units) : String(d.units).replace('.', ',');
                const brutoTxt = fmt(d.bruto);
                const exentoTxt = fmt(d.exento);
                const sujetoTxt = fmt(d.sujeto);
                const diaLabel = d.isLast ? 'último día' : `día ${d.dayIndex}`;
                return `<div class="irpf-row">${diaLabel}: ${unitsTxt} × ${precioManTxt} € = <strong>${brutoTxt} €</strong>; exento: ${exentoTxt} € → sujeto: <strong>${sujetoTxt} €</strong></div>`;
              });
              irpfDetailsHtml = `<div class="irpf-breakdown">${rows.join('')}</div>`;
            }
          } catch (e) { irpfDetailsHtml = ''; }

          // Total: sumar manutencionesAmount + alojamiento (real) + kmAmount
          const totalVal = (Number(result.manutencionesAmount || 0) + Number(result.kmAmount || 0) + Number(result.alojamiento || 0));
          const totalStr = fmt(totalVal);

  // Check if alojamiento exceeds max allowed. For ambiguous cases the default
  // allowed amount is the 'not counted' nights amount (checkbox unchecked).
  const defaultAllowedAloj = result.nochesAmbiguous ? Number(result.nochesAmountIfNotCounted || 0) : Number(result.nochesAmount || 0);
  const alojamientoExceedsMax = Number(result.alojamiento || 0) > defaultAllowedAloj;
      // Determine normative label based on selected project
      let normativaLabel = 'Decreto 42/2025';
      try {
        const tp = document.getElementById('tipo-proyecto');
        const tpv = tp ? tp.value : (typeof tipoProyecto !== 'undefined' ? tipoProyecto.value : '');
        if (["G24", "PEI", "NAL"].includes(tpv)) normativaLabel = 'RD 462/2002';
      } catch (e) {}
      // Build a stylized tooltip icon that appears to the LEFT of the amount
      const warnHtml = alojamientoExceedsMax ? `
        <span class="warn-wrapper" tabindex="0" aria-live="polite">
          <span class="warn-icon" aria-hidden="true">⚠️</span>
          <span class="warn-tooltip" role="tooltip">¡Atención! El importe del alojamiento supera el máximo permitido, conforme al ${normativaLabel}.</span>
        </span>
      ` : '';
      const alojamientoAmountHtml = `${warnHtml}<span class="amount${alojamientoExceedsMax ? ' error-amount' : ''}">${alojamientoAmount} €</span>`;

      const id = despEl.dataset && despEl.dataset.desplazamientoId ? despEl.dataset.desplazamientoId : Math.random().toString(36).slice(2,8);

      // If we received segmentsResults, render each segment separately and then show km
      if (result && Array.isArray(result.segmentsResults)) {
        const segs = result.segmentsResults;
        const segHtml = segs.map((r, idx) => {
    const segTitle = r && r.segTitle ? r.segTitle : `Tramo ${idx + 1} — ${r.pais || (r.paisIndex === 0 ? 'España' : 'Extranjero')}`;
          const precioManUnitSeg = (r && r.precioManutencion) ? Number(r.precioManutencion) : precioManUnit;
          const precioNocheUnitSeg = (r && r.precioNoche) ? Number(r.precioNoche) : precioNocheUnit;
          const manutLabelSeg = `Manutención: ${fmtInt(r.manutenciones)} × ${precioManUnitSeg.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`;
          const manutAmountSeg = fmt(Number(r.manutencionesAmount || 0));
          // Alojamiento máx formatted left-aligned (no '= total' here; total shown after leader)
          const alojMaxTxt = `${fmtInt(r.noches || 0)} noches × ${precioNocheUnitSeg.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`;
          const irpfValSeg = (r && r.irpf && typeof r.irpf.sujeto !== 'undefined') ? Number(r.irpf.sujeto) : 0;
          const irpfStrSeg = fmt(irpfValSeg);
          // Build IRPF line only if > 0
          const irpfLineSeg = (irpfValSeg && Number(irpfValSeg) > 0) ? `<div class="calc-line irpf-line"><span class="label">Sujeto a retención:</span><span class="leader" aria-hidden="true"></span><span class="amount irpf">${irpfStrSeg} €</span></div>` : '';
          // For domestic segments (paisIndex === 0) we do not render per-day IRPF breakdown/details elsewhere; here only show the total sujeto per segment when >0
          return `
            <div class="calc-result-segment">
              <div class="calc-seg-title">${segTitle}</div>
              <div class="calc-line"><span class="label">${manutLabelSeg}</span><span class="leader" aria-hidden="true"></span><span class="amount manut">${manutAmountSeg} €</span></div>
              ${irpfLineSeg}
              <div class="calc-line aloj-line"><span class="label">Alojamiento máx: ${alojMaxTxt}</span><span class="leader" aria-hidden="true"></span><span class="amount aloj">${fmt(Number(r.nochesAmount || 0))} €</span></div>
            </div>
          `;
        }).join('');

  // Sum IRPF across segments and conditionally build IRPF total (omit if zero)
  const totalIrpfValue = segs.reduce((acc, r) => acc + (r && r.irpf && typeof r.irpf.sujeto !== 'undefined' ? Number(r.irpf.sujeto) : 0), 0);
  const totalIrpfStr = fmt(Math.round((totalIrpfValue + Number.EPSILON) * 100) / 100);
  // If total IRPF is zero, omit the line entirely; otherwise render aligned-right like .calc-total
  const irpfTotalHtml = (totalIrpfValue && Number(totalIrpfValue) > 0) ? `<div class="calc-total"><span class="label">Sujeto a retención:</span><span class="amount"><span class="irpf-total-val">${totalIrpfStr} €</span></span></div>` : '';

  // Kilometraje line separately (render like in national: 'XXX × Y,YY €' on the label, amount right)
  const tarifaTxtSeg = (tipoVehiculo === 'motocicleta') ? (result.precioKm || tarifa).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : (result.precioKm || tarifa).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kmAmountSeg = (typeof result.kmAmount !== 'undefined') ? fmt(result.kmAmount) : kmAmount;
  const kmCountTxt = (typeof result.km !== 'undefined') ? fmtInt(result.km) : fmtInt(0);
  const kmLineHtml = `<div class="calc-line"><span class="label">Km. en vehículo propio: ${kmCountTxt} × ${tarifaTxtSeg} €</span><span class="leader" aria-hidden="true"></span><span class="amount km">${kmAmountSeg} €</span></div>`;
        // Compute aggregated alojamiento máx across segments (use nochesAmount or nochesAmountIfNotCounted depending on segment)
        const totalAlojMax = segs.reduce((acc, r) => {
          const v = (r && typeof r.nochesAmount !== 'undefined') ? Number(r.nochesAmount || 0) : 0;
          return acc + v;
        }, 0);
        const totalAlojMaxStr = fmt(totalAlojMax);
        // Sum manutenciones across segments for the TOTALES block
        const totalManut = segs.reduce((acc, r) => acc + (r && typeof r.manutencionesAmount !== 'undefined' ? Number(r.manutencionesAmount || 0) : 0), 0);
        const totalManutStr = fmt(totalManut);
        const manutTotalHtml = `<div class="calc-line"><span class="label">Total manutención</span><span class="leader" aria-hidden="true"></span><span class="amount manut">${totalManutStr} €</span></div>`;
        // user-provided alojamiento (numeric) is in result.alojamientoUser
        const alojUserNum = (typeof result.alojamientoUser !== 'undefined') ? Number(result.alojamientoUser) : 0;
        const alojUserStr = fmt(alojUserNum);
        const alojWarn = (alojUserNum > totalAlojMax) ? `
          <span class="warn-wrapper" tabindex="0" aria-live="polite">
            <span class="warn-icon" aria-hidden="true">⚠️</span>
            <span class="warn-tooltip" role="tooltip">¡Atención! El importe del alojamiento supera el máximo permitido, conforme al ${normativaLabel}.</span>
          </span>` : '';
        // Determine if user alojamiento exceeds the aggregated maximum
        const alojExceeds = alojUserNum > totalAlojMax;
  // Aggregated alojamiento line: show max inside brackets (italic) at left, user amount aligned to right; mark error-line if exceeded
  const alojAggregatedHtml = `<div class="calc-line aloj-aggregated${alojExceeds ? ' error-line' : ''}"><span class="label">Alojamiento: <em>[ máx. ${totalAlojMaxStr} € ]</em></span><span class="leader" aria-hidden="true"></span><span class="aloj-user">${alojWarn}<span class="amount aloj-user${alojExceeds ? ' error-amount' : ''}">${alojUserStr} €</span></span></div>`;

        const htmlSeg = `
          <div class="calc-result composite" data-desp-id="${id}">
            ${segHtml}
            <div class="calc-seg-title">TOTALES:</div>
            ${manutTotalHtml}
            ${alojAggregatedHtml}
            ${kmLineHtml}
            <div class="calc-total"><span class="label">Total:</span><span class="amount"><strong class="slight total-val">${fmt((segs.reduce((a,s) => a + (Number(s.manutencionesAmount || 0) || 0), 0) + Number(result.kmAmount || 0) + alojUserNum))} €</strong></span></div>
            ${irpfTotalHtml}
          </div>
        `;
        if (out) out.outerHTML = htmlSeg; else despEl.insertAdjacentHTML('beforeend', htmlSeg);
      } else {
        // Single-result rendering (existing behavior)
        // Build IRPF single-result line (aligned right under Total) only if sujeto > 0
        const irpfSingleHtml = (irpfSujetoVal && Number(irpfSujetoVal) > 0) ? `<div class="calc-total"><span class="label">Sujeto a retención:</span><span class="amount"><span class="irpf-total-val">${irpfSujetoStr} €</span></span></div>` : '';

        const html = `
          <div class="calc-result" aria-live="polite" data-desp-id="${id}">
            <div class="calc-line"><span class="label">${manutLabel}</span><span class="leader" aria-hidden="true"></span><span class="amount manut">${manutAmount} €</span></div>
            <div class="calc-line aloj-line${alojamientoExceedsMax ? ' error-line' : ''}"><span class="label">${alojamientoLabel}</span><span class="leader" aria-hidden="true"></span>${alojamientoAmountHtml.replace('class="amount', 'class="amount aloj')}</div>
            
            <div class="calc-line"><span class="label">${kmLabel}</span><span class="leader" aria-hidden="true"></span><span class="amount km">${kmAmount} €</span></div>
            <div class="calc-total"><span class="label">Total:</span><span class="amount"><strong class="slight total-val">${totalStr} €</strong></span></div>
            ${irpfSingleHtml}
            ${ (irpfSujetoVal && Number(irpfSujetoVal) > 0) ? ( (result && typeof result.paisIndex !== 'undefined' && Number(result.paisIndex) === 0) ? '' : irpfLimitsNote ) : '' }
            ${ (irpfSujetoVal && Number(irpfSujetoVal) > 0) ? ( (result && typeof result.paisIndex !== 'undefined' && Number(result.paisIndex) === 0) ? '' : irpfDetailsHtml ) : '' }
          </div>`;
        if (out) out.outerHTML = html; else despEl.insertAdjacentHTML('beforeend', html);
      }

      // --- Tooltip portal handling: move tooltip to body to avoid clipping by overflow on ancestors
      ensureGlobalWarnTooltip();
      // attach handlers to warn-wrapper inside this desplazamiento
      const wrappers = (despEl.querySelectorAll ? Array.from(despEl.querySelectorAll('.warn-wrapper')) : []);
      wrappers.forEach(w => attachWarnHandlers(w));

      // If ambiguous pernocta, render the justificar checkbox as a sibling under the ticket-cena-field
      // and wire it to update amounts and total dynamically
      // First remove any existing justificar div for this desplazamiento to avoid duplicates
      const existingJust = despEl.querySelector('.justificar-pernocta-field');
      if (existingJust) existingJust.parentNode.removeChild(existingJust);
      if (result.nochesAmbiguous) {
        try {
          const calcDiv = despEl.querySelector('.calc-result[data-desp-id="' + id + '"]');
          // Create checkbox block AFTER the ticket-cena-field to match requested placement
          const ticketField = despEl.querySelector(`#ticket-cena-field-${id}`);
          const justHtml = `<div class="ticket-cena-field conditional-row justificar-pernocta-field" id="justificar-container-${id}"><div class="form-group"><label><input type="checkbox" id="justificar-pernocta-${id}" /> Justifica haber pernoctado la noche del ${result.nochesAmbiguousFrom} al ${result.nochesAmbiguousTo}.</label></div></div>`;
          if (ticketField && ticketField.insertAdjacentHTML) {
            ticketField.insertAdjacentHTML('afterend', justHtml);
          } else if (despEl) {
            // fallback: append after calcDiv
            calcDiv.insertAdjacentHTML('afterend', justHtml);
          }
          const checkbox = despEl.querySelector(`#justificar-pernocta-${id}`);
          const alojAmountSpan = calcDiv.querySelector('.amount.aloj');
          const alojLine = calcDiv.querySelector('.aloj-line');
          const manutNum = Number(result.manutencionesAmount || 0);
          const kmNum = Number(result.kmAmount || 0);
          const alojNum = Number(result.alojamiento || 0);
          const allowedYes = Number(result.nochesAmountIfCounted || 0);
          const allowedNo = Number(result.nochesAmountIfNotCounted || 0);
          const totalStrong = calcDiv.querySelector('.total-val');
          const alojLabelSpan = calcDiv.querySelector('.aloj-line .label');

          function updateForCheckbox() {
            const checked = !!(checkbox && checkbox.checked);
            const allowed = checked ? allowedYes : allowedNo;
            // actualizar etiqueta máxima de alojamiento (noches y cantidad)
            try {
              if (alojLabelSpan) {
                alojLabelSpan.innerHTML = `Alojamiento: <em>[ máx: ${fmtInt(checked ? result.nochesIfCounted : result.nochesIfNotCounted)} noches × ${precioNocheTxt} € = ${fmt(checked ? result.nochesAmountIfCounted : result.nochesAmountIfNotCounted)} € ]</em>`;
              }
            } catch (e) {}
            // Manage warn icon/tooltip dynamically: create or remove warn-wrapper
            try {
              const existingWarn = calcDiv.querySelector('.warn-wrapper');
              if (alojNum > allowed) {
                // Add visual error classes
                alojAmountSpan.classList.add('error-amount');
                alojLine.classList.add('error-line');
                // If there's no warn icon, create it and attach handlers
                if (!existingWarn && alojAmountSpan && alojAmountSpan.parentNode) {
                  const warnEl = document.createElement('span');
                  warnEl.className = 'warn-wrapper';
                  warnEl.tabIndex = 0;
                  warnEl.setAttribute('aria-live','polite');
                  warnEl.innerHTML = `<span class="warn-icon" aria-hidden="true">⚠️</span><span class="warn-tooltip" role="tooltip">¡Atención! El importe del alojamiento supera el máximo permitido, conforme al ${normativaLabel}.</span>`;
                  alojAmountSpan.parentNode.insertBefore(warnEl, alojAmountSpan);
                  // Attach tooltip handlers so it behaves like the original ones
                  try { attachWarnHandlers(warnEl); } catch(e) {}
                }
              } else {
                // Remove visual error classes and any warn icon
                alojAmountSpan.classList.remove('error-amount');
                alojLine.classList.remove('error-line');
                if (existingWarn && existingWarn.parentNode) existingWarn.parentNode.removeChild(existingWarn);
              }
            } catch (e) {
              // fallback: toggle classes
              if (alojNum > allowed) { alojAmountSpan.classList.add('error-amount'); alojLine.classList.add('error-line'); }
              else { alojAmountSpan.classList.remove('error-amount'); alojLine.classList.remove('error-line'); }
            }
            // IMPORTANT: the displayed Total must always include the actual alojamiento
            // even if it exceeds the allowed reimbursable amount. The allowed amount
            // only affects the error styling and internal reimbursement calculation,
            // but the monetary Total shown to the user sums the full alojamiento.
            const total = (manutNum + kmNum + alojNum) || 0;
            totalStrong.textContent = (Number(total) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
          }
          // initial update (checkbox default unchecked -> subtract one night)
          if (checkbox) {
            checkbox.addEventListener('change', updateForCheckbox);
            updateForCheckbox();
          }
        } catch (e) { /* ignore */ }
      } else {
        // If not ambiguous, ensure any justificar container is removed
        const existing = despEl.querySelector('.justificar-pernocta-field');
        if (existing) existing.parentNode.removeChild(existing);
      }
    }

  // Singleton tooltip element appended to body
  let __globalWarnTooltip = null;
  function ensureGlobalWarnTooltip() {
    if (typeof document === 'undefined') return;
    if (__globalWarnTooltip && document.body.contains(__globalWarnTooltip)) return;
    __globalWarnTooltip = document.createElement('div');
    __globalWarnTooltip.className = 'global-warn-tooltip';
    __globalWarnTooltip.setAttribute('role','tooltip');
    __globalWarnTooltip.style.position = 'absolute';
    __globalWarnTooltip.style.left = '0px';
    __globalWarnTooltip.style.top = '0px';
    __globalWarnTooltip.style.display = 'none';
    document.body.appendChild(__globalWarnTooltip);
  }

  function attachWarnHandlers(wrapper) {
    if (!wrapper) return;
    // prevent double attaching
    if (wrapper.__warnAttached) return; wrapper.__warnAttached = true;
    const tooltipTextEl = wrapper.querySelector('.warn-tooltip');
    const text = tooltipTextEl ? tooltipTextEl.textContent || tooltipTextEl.innerText : '';
    function show() {
      if (!__globalWarnTooltip) ensureGlobalWarnTooltip();
      __globalWarnTooltip.innerHTML = text;
      __globalWarnTooltip.style.display = 'block';
      // position: try align horizontally center to wrapper
      const rect = wrapper.getBoundingClientRect();
      const ttRect = __globalWarnTooltip.getBoundingClientRect();
      let left = rect.left + window.scrollX;
      // prefer align left, but ensure it fits in viewport
      left = Math.max(8, Math.min(left, window.scrollX + document.documentElement.clientWidth - ttRect.width - 8));
      const top = rect.bottom + window.scrollY + 8;
      __globalWarnTooltip.style.left = left + 'px';
      __globalWarnTooltip.style.top = top + 'px';
      __globalWarnTooltip.classList.add('visible');
    }
    function hide() {
      if (!__globalWarnTooltip) return;
      __globalWarnTooltip.classList.remove('visible');
      // keep in DOM but hide after transition
      setTimeout(() => { if (__globalWarnTooltip) __globalWarnTooltip.style.display = 'none'; }, 140);
    }
    wrapper.addEventListener('mouseenter', show);
    wrapper.addEventListener('focus', show, true);
    wrapper.addEventListener('mouseleave', hide);
    wrapper.addEventListener('blur', hide, true);
  }

    function recalculateDesplazamientoById(id) {
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (!desp || !window.dietasCalc || !window.dietasCalc.calculateDesplazamiento) return;
      // If this desplazamiento is marked invalid due to date/time parsing or ordering,
      // ensure the calc-result is removed/hidden and avoid recalculation to prevent flicker/recreation.
      try {
        if (desp.dataset && desp.dataset.dtInvalid === '1') {
          const existing = desp.querySelector('.calc-result');
          if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
          const just = desp.querySelector('.justificar-pernocta-field'); if (just && just.parentNode) just.parentNode.removeChild(just);
          return;
        }
        const orderErr = desp.querySelector(`#dt-order-error-${id}`);
        if (orderErr) {
          const existing = desp.querySelector('.calc-result');
          if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
          const just = desp.querySelector('.justificar-pernocta-field'); if (just && just.parentNode) just.parentNode.removeChild(just);
          return;
        }
      } catch (e) { /* ignore and continue if DOM check fails */ }
    const data = collectDesplazamientoData(desp);
    // Show calculations if both dates/times provided OR if user provided km/alojamiento
    const hasDatesTimes = data.fechaIda && data.horaIda && data.fechaRegreso && data.horaRegreso;
    const hasKmOrAlojamiento = (Number(data.km) > 0) || (data.alojamiento && String(data.alojamiento).trim() !== '');
    if (!hasDatesTimes && !hasKmOrAlojamiento) {
      const existing = desp.querySelector('.calc-result');
      if (existing) existing.remove();
      return;
    }
    // Determinar tipo de vehículo y tarifa km (si la ficha está visible)
    let tipoVehiculo = 'coche';
    let kmTarifa = (window.__sgtriDatos && window.__sgtriDatos.kmTarifas && window.__sgtriDatos.kmTarifas.coche) ? window.__sgtriDatos.kmTarifas.coche : 0.26;
    try {
      const rv = document.querySelector('input[name="vehiculo-tipo"]:checked');
      if (rv && rv.value) tipoVehiculo = rv.value;
      if (window.__sgtriDatos && window.__sgtriDatos.kmTarifas && window.__sgtriDatos.kmTarifas[tipoVehiculo]) {
        kmTarifa = window.__sgtriDatos.kmTarifas[tipoVehiculo];
      }
    } catch (e) {}

    data.tipoVehiculo = tipoVehiculo;
    data.kmTarifa = kmTarifa;

    // Si es viaje internacional y se han indicado fechas de cruce, dividir en segmentos
    const isInternational = (data.pais && String(data.pais).trim() !== '' && String(data.pais).trim() !== 'España');
    const hasCruces = data.cruceIda && data.cruceVuelta;
    // Validate cruces before doing any segmentation; if invalid or missing for international, hide/clear results
    if (isInternational) {
      const okCruces = validateCrucesAndUpdateUI(id);
      if (!okCruces) {
        const existing = desp.querySelector('.calc-result'); if (existing) existing.parentNode.removeChild(existing);
        const just = desp.querySelector('.justificar-pernocta-field'); if (just && just.parentNode) just.parentNode.removeChild(just);
        return;
      }
    }
    if (isInternational && hasCruces) {
      // Build up to 3 segments according to the rules:
      // 1) España (si cruceIda != fechaIda): desde fechaIda/horaIda hasta cruceIda 07:00 (España rates)
      // 2) País destino: desde cruceIda (hora: horaIda si fechaIda===cruceIda else 07:00) hasta cruceVuelta 07:00
      // 3) España: desde cruceVuelta 07:00 hasta fechaRegreso/horaRegreso (España rates)
      const segments = [];
      const fmt07 = '07:00';
      const fechaIda = data.fechaIda;
      const fechaRegreso = data.fechaRegreso;
      const cruceIda = data.cruceIda;
      const cruceVuelta = data.cruceVuelta;

      // Helper to create an input object for a segment. We set km and alojamiento to 0 so that
      // per-segment results show computed manutenciones/noches/irpf without duplicating km/alojamiento.
      function makeSegInput(fIni, hIni, fFin, hFin, paisIdx, paisLabel) {
        return {
          fechaIda: fIni,
          horaIda: hIni || '',
          fechaRegreso: fFin,
          horaRegreso: hFin || '',
          pais: paisLabel || '',
          paisIndex: typeof paisIdx === 'number' ? paisIdx : -1,
          km: 0,
          alojamiento: 0,
          ticketCena: !!data.ticketCena,
          tipoProyecto: data.tipoProyecto || '',
          kmTarifa: data.kmTarifa || kmTarifa
        };
      }

      // If cruceIda is different date than fechaIda -> first Spain segment
      if (cruceIda && fechaIda && cruceIda !== fechaIda) {
        segments.push(makeSegInput(fechaIda, data.horaIda || '', cruceIda, fmt07, 0, 'España'));
      }

      // Middle segment: destination country
      // startHour = horaIda if fechaIda === cruceIda, otherwise 07:00
      const midStartHora = (cruceIda === fechaIda) ? (data.horaIda || '') : fmt07;
      segments.push(makeSegInput(cruceIda, midStartHora, cruceVuelta, fmt07, data.paisIndex, data.pais));

      // Final Spain segment: from cruceVuelta 07:00 to fechaRegreso/horaRegreso
      segments.push(makeSegInput(cruceVuelta, fmt07, fechaRegreso, data.horaRegreso || '', 0, 'España'));

      // Filter out any segments that have equal start and end date/time or missing dates
      function segHasDuration(s) {
        if (!s || !s.fechaIda || !s.fechaRegreso) return false;
        // if dates equal but times missing or equal, treat as zero-length and skip
        if (s.fechaIda === s.fechaRegreso) {
          const hi = s.horaIda || '';
          const hf = s.horaRegreso || '';
          if (!hi || !hf) return false;
          if (hi === hf) return false;
        }
        return true;
      }
      const realSegments = segments.filter(segHasDuration);

      // Compute each segment via dietasCalc
      const segResults = realSegments.map(seg => {
        try {
          return window.dietasCalc.calculateDesplazamiento(seg);
        } catch (e) { return null; }
      }).filter(Boolean);

      // Build human-readable titles per segment using the original user inputs (only show times the user provided)
      segResults.forEach((r, idx) => {
        const seg = realSegments[idx];
        const startDate = seg && seg.fechaIda ? seg.fechaIda : '';
        const endDate = seg && seg.fechaRegreso ? seg.fechaRegreso : '';
        let startTimePart = '';
        let endTimePart = '';
        // show start time only if the start date equals the user's fechaIda and user provided horaIda
        if (startDate && data.fechaIda && data.horaIda && startDate === data.fechaIda) startTimePart = ` a las ${data.horaIda} h`;
        // show end time only if the end date equals the user's fechaRegreso and user provided horaRegreso
        if (endDate && data.fechaRegreso && data.horaRegreso && endDate === data.fechaRegreso) endTimePart = ` a las ${data.horaRegreso} h`;
        const paisLabel = seg && seg.pais ? seg.pais : (seg && seg.paisIndex === 0 ? 'España' : 'Extranjero');
        r.segTitle = `Tramo ${idx + 1}. ${paisLabel}, del ${startDate}${startTimePart} al ${endDate}${endTimePart}:`;
      });

      // Build a composite result object for rendering: include segmentsResults and overall km info
      const composite = {
        segmentsResults: segResults,
        // pass through km info so renderCalcResult can show it after segments
        km: (function(){ try { if (typeof data.km === 'number') return data.km; const s = String(data.km || '').replace(/[^0-9,\.]/g,'').replace(/\./g,'').replace(/,/g,'.'); return parseFloat(s) || 0; } catch(e){ return 0; } })(),
        precioKm: data.kmTarifa || kmTarifa,
        kmAmount: (function(){ try { const s = (typeof data.km === 'number') ? data.km : String(data.km || '').replace(/[^0-9,\.]/g,'').replace(/\./g,'').replace(/,/g,'.'); const k = parseFloat(s) || 0; const t = Number(data.kmTarifa || kmTarifa) || 0; return Math.round((k * t + Number.EPSILON) * 100) / 100; } catch(e){ return 0; } })(),
        // user-provided alojamiento (numeric) for final aggregation
        alojamientoUser: (function(){
          if (!data.alojamiento) return 0;
          if (typeof data.alojamiento === 'number') return data.alojamiento;
          try { const s = String(data.alojamiento).replace(/[^0-9,\.]/g,'').replace(/\./g,'').replace(/,/g,'.'); return parseFloat(s) || 0; } catch(e){ return 0; }
        })()
      };
      renderCalcResult(desp, composite);
      return;
    }

    // Default single calculation (domestic or no cruces provided)
    const res = window.dietasCalc.calculateDesplazamiento(data);
    renderCalcResult(desp, res);
    }

    function attachCalcListenersToDesplazamiento(id) {
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (!desp) return;
  const selector = [`#fecha-ida-${id}`, `#hora-ida-${id}`, `#fecha-regreso-${id}`, `#hora-regreso-${id}`, `#cruce-ida-${id}`, `#cruce-vuelta-${id}`, `#pais-destino-${id}`, `#km-${id}`, `#alojamiento-${id}`].join(',');
      const nodes = desp.querySelectorAll(selector);
      // IMPORTANT: only recalculate and toggle visibility on blur of the implicated fields.
      // While the user is typing (input) we avoid showing/hiding calc-result or ticket fields.
      nodes.forEach(n => {
        // keep input handlers lightweight (formatting is handled elsewhere)
        n.addEventListener('input', () => { /* do not recalc/show-hide on input */ });
        // For selects, apply change immediately (more natural UX). For other inputs, defer to blur.
        if (n.tagName === 'SELECT') {
          n.addEventListener('change', () => { validateDateTimePairAndUpdateUI(id); recalculateDesplazamientoById(id); actualizarTicketCena(); });
        } else {
          // On change we defer to blur to avoid flicker while typing
          n.addEventListener('change', () => { /* noop: defer to blur */ });
          // On blur we perform validation, recalc and update visibility
          n.addEventListener('blur', () => { validateDateTimePairAndUpdateUI(id); recalculateDesplazamientoById(id); actualizarTicketCena(); });
        }
      });
      // Specifically watch km input to decide vehicle card visibility
      const kmInput = desp.querySelector(`#km-${id}`);
      if (kmInput) {
        // Do not toggle vehicle ficha or recalc while typing; act on blur only
        kmInput.addEventListener('blur', () => {
          evaluarKmParaMostrarFicha();
          recalculateDesplazamientoById(id);
          actualizarTicketCena();
        });
      }
      // Watch ticket-cena checkbox: recalc on change so manutenciones update immediately
      const ticketCheckbox = desp.querySelector(`#ticket-cena-${id}`);
      if (ticketCheckbox) {
        ticketCheckbox.addEventListener('change', () => {
          // Changing ticket affects both validation-dependent rules and amounts
          validateDateTimePairAndUpdateUI(id);
          recalculateDesplazamientoById(id);
          actualizarTicketCena();
        });
      }
      // calcular inicialmente
      setTimeout(() => { evaluarKmParaMostrarFicha(); recalculateDesplazamientoById(id); }, 100);
    }

    // Attach to existing desplazamientos on load
    document.querySelectorAll('.desplazamiento-grupo').forEach(el => {
      const id = el.dataset.desplazamientoId;
      if (id) attachCalcListenersToDesplazamiento(id);
    });

    // Listener para cambio de tipo de proyecto (actualizar ticket cena)
    tipoProyecto.addEventListener('change', () => {
      actualizarTicketCena();
      document.querySelectorAll('.desplazamiento-grupo').forEach(el => {
        const id = el.dataset.desplazamientoId;
        if (id) recalculateDesplazamientoById(id);
      });
    });

  // (Paises ya se cargan en la petición principal arriba)
});
