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
      return String(value || '').replace(/[^0-9A-Za-z\u00C0-\u017F\u0180-\u024F .,\-()&']/g, '').slice(0, maxLen || undefined);
    } catch (err) { return String(value || '').slice(0, maxLen || undefined); }
  }

  function sanitizeReferencia(value, maxLen) {
    try {
      return String(value || '').replace(/[^0-9A-Za-z\u00C0-\u017F\u0180-\u024F\/ .,\-()&']/g, '').slice(0, maxLen || undefined);
    } catch (err) { return String(value || '').slice(0, maxLen || undefined); }
  }

  function sanitizeIBAN(value, maxLen) {
    try {
      const raw = String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, maxLen || 24);
      const parts = raw.match(/.{1,4}/g) || [];
      return parts.join(' ');
    } catch (err) { return String(value || '').slice(0, maxLen || undefined).toUpperCase(); }
  }

  function sanitizeDNI(value, maxLen) {
    try {
      return String(value || '').replace(/[^A-Za-z0-9.-]/g, '').slice(0, maxLen || 20).toUpperCase();
    } catch (err) { return String(value || '').slice(0, maxLen || 20).toUpperCase(); }
  }

  function formatOrganica(value) {
    try {
      const only = String(value || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase();
      const parts = only.match(/.{1,2}/g) || [];
      return parts.join('.');
    } catch (err) { return String(value || '').slice(0, 14).toUpperCase(); }
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
  <button type="button" class="btn-eliminar-proyecto" aria-label="Eliminar proyecto ${proyectoCounter}"><span class="btn-icon btn-icon-minus" aria-hidden="true">−</span>Eliminar</button>
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
      // Exponer los datos cargados para que otros módulos (calculoDesp, etc.) puedan consultarlos
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
        try {
          // Cambio mínimo: iterar fichas y llamar al calculador directamente.
          // Evita añadir lógica extra y garantiza render inmediato.
          const groups = document.querySelectorAll('.desplazamiento-grupo');
          groups.forEach(g => {
            try {
              const id = g && g.dataset && g.dataset.desplazamientoId ? g.dataset.desplazamientoId : null;
              if (!id) return;
              if (window && window.calculoDesp && typeof window.calculoDesp.calculaDesplazamientoFicha === 'function') {
                window.calculoDesp.calculaDesplazamientoFicha(g);
              }
            } catch (e) { /* ignore single ficha errors */ }
          });
        } catch (e) { /* noop */ }
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
      // Re-validate cruces; validation decides whether to hide or keep calc-result
      try {
        validateCrucesAndUpdateUI(desplazamientoId);
      } catch (e) {}
      // No insertamos avisos aquí. Si faltan cruces, la validación marcará
      // el desplazamiento como inválido; el flujo de recálculo forzará la
      // exclusión de manutención (manutención = 0) sin mostrar mensajes.
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
        const id = desplazamientoId; setTimeout(() => { validateDateTimePairAndUpdateUI(id); /* recalc delegated to logicaDesp */ }, 60);
      } catch (e) {}
    }
    // After handling the UI specifics for this desplazamiento, recalculate ALL desplazamientos
    // because country-specific rates/limits may affect other fichas.
    try {
      // Debounce y time-slice del recálculo completo para evitar bloqueos UI
      scheduleFullRecalc(120);
    } catch (e) { /* ignore */ }
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

  // Helper: parse numeric values — delegate to central parser if available
  function parseNumericLoose(str) {
    try {
      if (window && window.calculoDesp && typeof window.calculoDesp.parseNumber === 'function') {
        return window.calculoDesp.parseNumber(str);
      }
    } catch (e) {}
    // Fallback parsing (original behavior)
    if (!str && str !== 0) return 0;
    try {
      const s = String(str || '').trim();
      if (s === '') return 0;
      let cleaned = s.replace(/€/g, '').replace(/km/g, '').replace(/\s/g, '');
      if (/,/.test(cleaned) && /\./.test(cleaned)) cleaned = cleaned.replace(/\./g, '');
      cleaned = cleaned.replace(/,/g, '.');
      cleaned = cleaned.replace(/[^0-9.\-]/g, '');
      const n = parseFloat(cleaned);
      if (isNaN(n)) return 0;
      return n;
    } catch (e) { return 0; }
  }

  // Helper: suma de importes que no son manutención (km, alojamiento y otros gastos) para un desplazamiento
  function sumNonManutencionAmounts(desp) {
    try {
      if (!desp) return 0;
      if (window && window.calculoDesp && typeof window.calculoDesp.collectDataFromFicha === 'function') {
        const data = window.calculoDesp.collectDataFromFicha(desp) || {};
        const parse = (window.calculoDesp && typeof window.calculoDesp.parseNumber === 'function') ? window.calculoDesp.parseNumber : (v => {
          try { return parseFloat(String(v||'').replace(/[^0-9,\.\-]/g,'').replace(/,/g,'.'))||0; } catch(e){return 0}
        });
        const km = Math.abs(parse(data.km || 0));
        const aloj = Math.abs(parse(data.alojamiento || 0));
        const otros = (Array.isArray(data.otrosGastos) ? data.otrosGastos.reduce((a,v)=>a+Math.abs(parse(v)),0) : 0);
        return km + aloj + otros;
      }
      return 0;
    } catch (e) { return 0; }
  }

  // --- Scheduler stubs (aggressive cleanup) ---
  // The old full and per-id schedulers have been replaced by the new
  // `logicaDesp` / `calculoDesp` pipeline. Keep tiny delegating stubs
  // to avoid runtime errors while we migrate the rest of the code.
  function scheduleFullRecalc(debounceMs = 120) {
    try {
      if (window && window.logicaDesp && typeof window.logicaDesp.scheduleFullRecalc === 'function') {
        try { window.logicaDesp.scheduleFullRecalc(debounceMs); return; } catch (e) {}
      }
    } catch (e) {}
    // no-op fallback
  }

  // Per-id debounce stub: delegates to logicaDesp if available, otherwise calls the calculator directly
  function scheduleRecalcForId(id, ms = 60) {
    try {
      if (!id) return;
      if (window && window.logicaDesp && typeof window.logicaDesp.scheduleRecalcForId === 'function') {
        try { window.logicaDesp.scheduleRecalcForId(id, ms); return; } catch (e) {}
      }
      // fallback: call the central calculator immediately (no debounce)
      const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
      if (desp && window.calculoDesp && typeof window.calculoDesp.calculaDesplazamientoFicha === 'function') {
        try { window.calculoDesp.calculaDesplazamientoFicha(desp); } catch (e) {}
      }
    } catch (e) {}
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

      // If any of the fields are partially filled or invalid, mark invalid.
      // Instead of hiding the calc-result unconditionally, we keep it visible when
      // existen otros importes (km, alojamiento u otros gastos) y forzamos manutención a 0.
      const calc = desp ? desp.querySelector('.calc-result') : null;
      const anyInvalidFormat = (!fId && fechaIdEl.value) || (!fReg && fechaRegEl.value) || (!tId && horaIdEl.value) || (!tReg && horaRegEl.value);
      if (anyInvalidFormat) {
        if (desp) { desp.dataset.dtInvalid = '1'; }
        const otherSum = desp ? sumNonManutencionAmounts(desp) : 0;
        if (otherSum > 0) {
          // show calc and trigger recalc which will zero manutenciones when dtInvalid flag present
          if (calc) calc.style.display = '';
          const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;
          if (just) just.style.display = 'none';
          /* recalc delegated to logicaDesp */
        } else {
          if (calc) calc.style.display = 'none';
          const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;
          if (just) just.style.display = 'none';
        }
        return false;
      }

      // If any are empty (not provided) and there is a dtInvalid flag, keep calc hidden until corrected
      if (!fId || !fReg || !tId || !tReg) {
        if (desp && desp.dataset && desp.dataset.dtInvalid === '1') {
          const otherSum = desp ? sumNonManutencionAmounts(desp) : 0;
          if (otherSum > 0) {
            // keep visible and force manutención=0 via recalc
            if (calc) calc.style.display = '';
            const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;
            if (just) just.style.display = 'none';
            /* recalc delegated to logicaDesp */
            return false;
          }
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
        // invalid order: marcar desplazamiento como inválido para abortar cálculos.
        if (desp) { desp.dataset.dtInvalid = '1'; }
        // invalid order: mark fields in red. Decide visibility based on other amounts
        [fechaIdEl, horaIdEl, fechaRegEl, horaRegEl].forEach(n => n && n.classList && n.classList.add('field-error'));
        const otherSum = desp ? sumNonManutencionAmounts(desp) : 0;
        if (otherSum > 0) {
          // keep calc visible and force manutencion 0 via recalc
          if (calc) calc.style.display = '';
          const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;
          if (just) just.style.display = 'none';
          /* recalc delegated to logicaDesp */
        } else {
          if (calc) calc.style.display = 'none';
          const just = desp ? desp.querySelector('.justificar-pernocta-field') : null;
          if (just) just.style.display = 'none';
        }
        // No insertamos mensajes por orden incorrecta; marcamos campos con
        // .field-error y dejamos que el recálculo muestre otros importes si procede.
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
  // trigger recalculation to ensure calc-result is in sync (debounced)
  /* recalc delegated to logicaDesp */
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
        // mark as invalid and show message. Keep calc visible if other amounts exist.
        if (desp) { desp.dataset.dtInvalid = '1'; }
        const otherSum = desp ? sumNonManutencionAmounts(desp) : 0;
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
          /* recalc delegated to logicaDesp */
        } else {
          if (calc) calc.style.display = 'none';
        }
        // No insertamos mensajes por cruces ausentes; la validación marca
        // dtInvalid y el recálculo forzará manutención=0 si hay otros importes.
        return false;
      }

      // If international and cruces exist but are empty -> consider invalid but keep calc visible
      if (isInternational && (String(cruceIdEl.value || '').trim() === '' || String(cruceVueltaEl.value || '').trim() === '')) {
        if (desp) { desp.dataset.dtInvalid = '1'; }
        const otherSum = desp ? sumNonManutencionAmounts(desp) : 0;
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
          /* recalc delegated to logicaDesp */
        } else {
          if (calc) calc.style.display = 'none';
        }
        // Do not show an inline error message for blank cruces; wait for user input
        return false;
      }

      const fId = parseDateStrict(fechaIdEl && fechaIdEl.value);
      const fReg = parseDateStrict(fechaRegEl && fechaRegEl.value);
      const cId = parseDateStrict(cruceIdEl && cruceIdEl.value);
      const cV = parseDateStrict(cruceVueltaEl && cruceVueltaEl.value);

      // If any cruce field has partial/invalid format -> mark invalid. Keep calc visible if other amounts exist
      const anyInvalidFormat = ((!cId && cruceIdEl.value) || (!cV && cruceVueltaEl.value));
      if (anyInvalidFormat) {
        if (desp) { desp.dataset.dtInvalid = '1'; }
        const otherSum = desp ? sumNonManutencionAmounts(desp) : 0;
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
          /* recalc delegated to logicaDesp */
        } else {
          if (calc) calc.style.display = 'none';
        }
        // No insertamos mensajes por formato inválido; marcamos dtInvalid y
        // continuamos para que recálculo pueda mostrar otros importes con
        // manutención a 0.
        return false;
      }

      // If any of the cruce fields are empty and dtInvalid flagged, keep calc hidden unless other amounts exist
      if (!cId || !cV) {
        if (desp && desp.dataset && desp.dataset.dtInvalid === '1') {
          const otherSum = desp ? sumNonManutencionAmounts(desp) : 0;
          if (otherSum > 0) {
            if (calc) calc.style.display = '';
            /* recalc delegated to logicaDesp */
            return false;
          }
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
        // mark cruces in red and hide calc unless other amounts present
        [cruceIdEl, cruceVueltaEl].forEach(n => n && n.classList && n.classList.add('field-error'));
        const otherSum = desp ? sumNonManutencionAmounts(desp) : 0;
        if (otherSum > 0) {
          if (calc) calc.style.display = '';
          /* recalc delegated to logicaDesp */
        } else {
          if (calc) calc.style.display = 'none';
        }
        // No insertamos mensajes por orden incorrecta; marcar campos con .field-error
        // y dejar que el recálculo muestre totales no relacionados si procede.
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
          if (desp) {
            desp.dataset.dtInvalid = '1';
            const otherSum = sumNonManutencionAmounts(desp);
            const calc = desp.querySelector('.calc-result');
            const just = desp.querySelector('.justificar-pernocta-field');
              if (otherSum > 0) {
              if (calc) calc.style.display = '';
              if (just) just.style.display = 'none';
              /* recalc delegated to logicaDesp */
            } else {
              if (calc) calc.style.display = 'none';
              if (just) just.style.display = 'none';
            }
          }
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
          if (desp) {
            desp.dataset.dtInvalid = '1';
            const otherSum = sumNonManutencionAmounts(desp);
            const calc = desp.querySelector('.calc-result');
            const just = desp.querySelector('.justificar-pernocta-field');
              if (otherSum > 0) {
              if (calc) calc.style.display = '';
              if (just) just.style.display = 'none';
              /* recalc delegated to logicaDesp */
            } else {
              if (calc) calc.style.display = 'none';
              if (just) just.style.display = 'none';
            }
          }
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
          if (desp) {
            desp.dataset.dtInvalid = '1';
            const otherSum = sumNonManutencionAmounts(desp);
            const calc = desp.querySelector('.calc-result');
            const just = desp.querySelector('.justificar-pernocta-field');
              if (otherSum > 0) {
              if (calc) calc.style.display = '';
              if (just) just.style.display = 'none';
              /* recalc delegated to logicaDesp */
            } else {
              if (calc) calc.style.display = 'none';
              if (just) just.style.display = 'none';
            }
          }
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
      // If the field is empty (user didn't type anything), restore empty so placeholder shows
      if (raw.trim() === '') { el.value = ''; return; }
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

  // Limitar inputs con clase 'limit-2digits' a un máximo de 2 dígitos y forzar min/max
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || !el.classList) return;
    if (el.classList.contains('limit-2digits')) {
      // Only apply to number-like inputs
      let v = el.value || '';
      // Remove non-digit characters
      v = String(v).replace(/[^0-9]/g, '');
      if (v.length > 2) v = v.slice(0,2);
      // Apply back to element; if empty, keep empty
      el.value = v;
    }
  }, true);

  // On blur, ensure number inputs respect min/max
  document.addEventListener('blur', (e) => {
    const el = e.target;
    if (!el || !el.classList) return;
    if (el.classList.contains('limit-2digits')) {
      const min = (el.min !== undefined && el.min !== '') ? Number(el.min) : null;
      const max = (el.max !== undefined && el.max !== '') ? Number(el.max) : null;
      let v = el.value === '' ? '' : Number(el.value);
      if (v === '' || isNaN(v)) { el.value = ''; return; }
      if (min !== null && v < min) v = min;
      if (max !== null && v > max) v = max;
      el.value = String(v);
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

      <!-- Otros gastos: botón y contenedor (las nuevas líneas irán debajo del botón) por desplazamiento -->
      <div class="otros-gastos-wrapper">
        <div class="otros-gastos-row">
          <div class="otros-gastos-left">
            <label for="no-manutencion-${desplazamientoCounter}" class="no-manut-label"><input type="checkbox" id="no-manutencion-${desplazamientoCounter}" class="no-manutencion"> No incluir gastos de manutención:</label>
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

  <button type="button" class="btn-eliminar-desplazamiento" aria-label="Eliminar desplazamiento ${desplazamientoCounter}"><span class="btn-icon btn-icon-minus" aria-hidden="true">−</span>Eliminar</button>
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

  // Crear una línea de "otros gastos" dentro de una ficha de desplazamiento
  function crearLineaOtroGasto(despEl) {
    const cont = despEl.querySelector('.otros-gastos-container');
    if (!cont) return null;
    // Crear elementos de forma programática para evitar malformaciones HTML
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

    // Poblamos el select desde los datos cargados
    const otros = (window.__sgtriDatos && window.__sgtriDatos.otrosGastos) ? window.__sgtriDatos.otrosGastos : [];
    otros.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item[1] || item[0];
      opt.textContent = item[0];
      selectTipo.appendChild(opt);
    });

    cont.appendChild(linea);

    // Añadir listener para recalcular cuando cambie el importe en esta línea
    try {
      const grupo = cont.closest && cont.closest('.desplazamiento-grupo');
      const gid = grupo && grupo.dataset && grupo.dataset.desplazamientoId ? grupo.dataset.desplazamientoId : null;
      if (gid) {
        // pequeño debounce -> recálculo delegado al pipeline central (logicaDesp)
        inputImp.addEventListener('input', () => {
          /* recalc delegated to logicaDesp */
        });
      }
    } catch (e) { /* ignore */ }

    return linea;
  }

  // Manejo por delegación de eventos dentro de desplazamientosContainer para otros gastos
  desplazamientosContainer.addEventListener('click', (e) => {
    // Pulsar el botón '+ Otros gastos'
    const targetAdd = e.target.closest && e.target.closest('.btn-otros-gastos');
    if (targetAdd) {
      const grupo = targetAdd.closest('.desplazamiento-grupo');
      if (!grupo) return;
      const cont = grupo.querySelector('.otros-gastos-container');
      if (cont.style.display === 'none' || cont.style.display === '') {
        cont.style.display = 'block';
      }
      // Añadir una línea nueva
      const nueva = crearLineaOtroGasto(grupo);
      if (nueva) {
        // Autoenfocar el campo descripción
        const inp = nueva.querySelector('.otros-gasto-desc');
        if (inp) setTimeout(() => inp.focus(), 80);
        // Recalcular para actualizar totales (incluyendo 'Otros gastos')
        try { const gid = grupo.dataset && grupo.dataset.desplazamientoId ? grupo.dataset.desplazamientoId : null; /* if (gid) scheduleRecalcForId(gid); - recalc delegated to logicaDesp */ } catch(e) {}
      }
      return;
    }

    // Pulsar el botón '-' para eliminar una línea de otros gastos
    const targetRemove = e.target.closest && e.target.closest('.btn-remove-otros-gasto');
    if (targetRemove) {
      const linea = targetRemove.closest('.otros-gasto-line');
      if (linea && linea.parentNode) {
        const grupo = linea.closest('.desplazamiento-grupo');
        const gid = grupo && grupo.dataset && grupo.dataset.desplazamientoId ? grupo.dataset.desplazamientoId : null;
        linea.parentNode.removeChild(linea);
        try { /* if (gid) scheduleRecalcForId(gid); - recalc delegated to logicaDesp */ } catch(e) {}
      }
      return;
    }
  });

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

    // Actualizar el select "Evento asociado al desplazamiento" en la sección de congresos
    try {
      const eventoSelect = document.getElementById('evento-asociado');
      const eventoContainer = document.getElementById('evento-asociado-container');
      if (eventoSelect && eventoContainer) {
        // Limpiar opciones actuales
        eventoSelect.innerHTML = '';
        if (desplazamientos.length > 1) {
          // Mostrar el contenedor y añadir las opciones; seleccionar desp1 por defecto
          eventoContainer.style.display = '';
          desplazamientos.forEach((d, idx) => {
            const opt = document.createElement('option');
            opt.value = `desp${idx + 1}`;
            opt.textContent = `Desplazamiento ${idx + 1}`;
            eventoSelect.appendChild(opt);
          });
          try { eventoSelect.value = 'desp1'; } catch(e) {}
        } else {
          // Ocultar cuando no hay múltiple desplazamiento
          eventoContainer.style.display = 'none';
        }
      }
    } catch (e) {
      // no hacer nada si no existe el select
    }
    // Recomponer descuento si procede
    try { if (typeof computeDescuentoManutencion === 'function') computeDescuentoManutencion(); } catch (e) {}
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

  // --- Cálculo de descuento por comidas incluidas en inscripción (congreso) ---
  function computeDescuentoManutencion() {
    try {
      const numEl = document.getElementById('evento-num-comidas');
      const hidden = document.getElementById('descuento-manut-congreso');
      const msg = document.getElementById('descuento-manut-message');
      const msgAmount = document.getElementById('descuento-manut-amount');
      if (!numEl || !hidden) return;
      const n = Number(numEl.value) || 0;
      if (n <= 0) { hidden.value = '0.00'; if (msg) msg.style.display = 'none'; if (msgAmount) msgAmount.textContent = '0,00 €'; return; }

      const desplazamientos = Array.from(document.querySelectorAll('.desplazamiento-grupo'));
      if (desplazamientos.length === 0) { hidden.value = '0.00'; return; }

      let paisIndex = 0;
      if (desplazamientos.length === 1) {
        const paisSelect = desplazamientos[0].querySelector('select[id^="pais-destino"]');
        if (paisSelect) paisIndex = paisSelect.selectedIndex >= 0 ? paisSelect.selectedIndex : 0;
      } else {
        const eventoSelect = document.getElementById('evento-asociado');
        if (!eventoSelect) { hidden.value = '0.00'; return; }
        const val = eventoSelect.value || '';
        const m = val.match(/^desp(\d+)$/);
        if (!m) { hidden.value = '0.00'; return; }
        const idx = parseInt(m[1], 10) - 1;
        const target = desplazamientos[idx];
        if (!target) { hidden.value = '0.00'; return; }
        const paisSelect = target.querySelector('select[id^="pais-destino"]');
        if (paisSelect) paisIndex = paisSelect.selectedIndex >= 0 ? paisSelect.selectedIndex : 0;
      }

      // Use the centralized calculation engine to obtain the per-day manutencion price
      if (window && window.calculoDesp && typeof window.calculoDesp.calculateDesplazamiento === 'function') {
        try {
          const tipoProj = (document.getElementById('tipoProyecto') || {}).value;
          const res = window.calculoDesp.calculateDesplazamiento({ paisIndex, tipoProyecto: tipoProj }) || {};
          const precio = (res && typeof res.precioManutencion === 'number') ? res.precioManutencion : (res && res.precioManutencion ? Number(res.precioManutencion) : 0);
          const descuento = Math.round((precio * 0.5 * n + Number.EPSILON) * 100) / 100;
          hidden.value = descuento.toFixed(2);
          if (msg && descuento > 0) {
            // format with comma as decimal separator and show
            const txt = descuento.toFixed(2).replace('.', ',') + ' €';
            if (msgAmount) msgAmount.textContent = txt;
            msg.style.display = '';
          } else if (msg) {
            msg.style.display = 'none';
            if (msgAmount) msgAmount.textContent = '0,00 €';
          }
          return;
        } catch (err) { /* fallthrough to zero */ }
      }
      hidden.value = '0.00';
    } catch (e) { /* ignore */ }
  }

  // attach listeners for Congreso fields
  const eventoNumEl = document.getElementById('evento-num-comidas');
  if (eventoNumEl) {
    eventoNumEl.addEventListener('input', computeDescuentoManutencion);
    eventoNumEl.addEventListener('change', computeDescuentoManutencion);
  }
  const eventoSel = document.getElementById('evento-asociado');
  if (eventoSel) eventoSel.addEventListener('change', computeDescuentoManutencion);
  // Initial compute in case defaults set
  try { computeDescuentoManutencion(); } catch (e) {}

  // Recompute discount when project type changes (affects per-day manutencion price)
  try {
    var tipoProyectoEl = document.getElementById('tipoProyecto');
    if (tipoProyectoEl) {
      tipoProyectoEl.addEventListener('change', computeDescuentoManutencion);
      tipoProyectoEl.addEventListener('input', computeDescuentoManutencion);
    }
  } catch (e) { /* ignore */ }


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
      // Recalcular todos los desplazamientos de forma debounced y time-sliced
      try { scheduleFullRecalc(60); } catch(e) {}
      // Evaluar visibilidad de ficha de vehículo (no costosa)
      try { evaluarKmParaMostrarFicha(); } catch(e) {}
    }
  });

    // -------------------------
    // Integración con calculoDesp: recopilación de datos y render de resultados
    // -------------------------
    // Delegador: usar la recolección centralizada en `calculoDesp` cuando exista.
    // Mantener un wrapper aquí evita romper código que pudiera llamar a
    // `collectDesplazamientoData` mientras migramos totalmente.
    function collectDesplazamientoData(despEl) {
      try {
        if (window && window.calculoDesp && typeof window.calculoDesp.collectDataFromFicha === 'function') {
          return window.calculoDesp.collectDataFromFicha(despEl) || {};
        }
      } catch (e) {}
      // Fallback conservador: devolver un objeto mínimo para evitar excepciones
      return { fechaIda: '', horaIda: '', fechaRegreso: '', horaRegreso: '', cruceIda: '', cruceVuelta: '', pais: '', paisIndex: -1, km: '', alojamiento: '', ticketCena: false, tipoProyecto: '', excludeManutencion: false };
    }

    function renderCalcResult(despEl, result) {
      // Legacy renderer removed: delegate to centralized renderer `salidaDesp` when available.
      try {
        if (window && window.salidaDesp && typeof window.salidaDesp.renderSalida === 'function') {
          // compute otrosSum to pass as displayContext
          const otrosInputs = (despEl && despEl.querySelectorAll) ? Array.from(despEl.querySelectorAll('.otros-gasto-importe')) : [];
          const parseAmountInput = (val) => {
            if (!val && val !== 0) return 0;
            let s = String(val || '').trim(); if (s === '') return 0;
            s = s.replace(/[^0-9,\.\-]/g, '');
            if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) { s = s.replace(/\./g, ''); s = s.replace(/,/g, '.'); }
            else if (s.indexOf(',') !== -1) s = s.replace(/,/g, '.');
            const n = parseFloat(s); return isNaN(n) ? 0 : n;
          };
          const otrosSumNum = otrosInputs.reduce((acc, inp) => acc + parseAmountInput(inp.value), 0);
          const displayContext = { otrosSum: otrosSumNum, id: (despEl && despEl.dataset) ? despEl.dataset.desplazamientoId : undefined };
          try { window.salidaDesp.renderSalida(despEl, result, displayContext); } catch (e) { /* ignore render errors */ }
        }
      } catch (e) { /* ignore */ }
    }

    // If a user previously checked justificar-pernocta and a full recalc happens,
    // reapply the visual + model change so the checkbox selection persists.
    // This hook will be used by recalculateDesplazamientoById.
    try {
      const prevChecked = despEl && despEl.dataset && despEl.dataset.justificarPernocta === '1';
      if (prevChecked) {
        // If the checkbox was previously checked, ensure it is present and checked now
        const currChk = despEl.querySelector(`#justificar-pernocta-${id}`);
        if (currChk && !currChk.checked) { currChk.checked = true; try { currChk.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){} }
      }
    } catch(e) {}

  // CSS-only tooltip mode: do not move inline tooltips into a JS portal.
  // The user prefers CSS for display/position, so keep inline
  // `.warn-tooltip` spans in-place and let CSS hover/focus show them.
  function ensureGlobalWarnTooltip() {
    // Cleanup any previously created global tooltip portal elements that
    // could have been injected by earlier versions of the script. We
    // intentionally remove them to ensure CSS-only inline tooltips are
    // the single source of truth.
    try {
      if (typeof document !== 'undefined') {
        const existing = Array.from(document.querySelectorAll('.global-warn-tooltip')) || [];
        existing.forEach(e => { if (e && e.parentNode) e.parentNode.removeChild(e); });
      }
    } catch (e) { /* ignore */ }
    return;
  }

  function attachWarnHandlers(wrapper) {
    if (!wrapper) return;
    if (wrapper.__warnAttached) return; wrapper.__warnAttached = true;
    // Ensure the inline tooltip element is left visible so CSS can control it
    try {
      const tooltipTextEl = wrapper.querySelector('.warn-tooltip');
      if (tooltipTextEl) tooltipTextEl.style.display = '';
    } catch (e) { /* ignore */ }
    // No JS positioning/portal; CSS :hover and :focus-within handle visibility
  }

  // Attach handlers to any static warn-wrapper elements present on page
  // (e.g. the congress section tooltips added in HTML). This ensures all
  // warn-tooltip instances are rendered through the global portal and
  // behave consistently (no duplicates, consistent width/positioning).
  try {
    if (typeof document !== 'undefined') {
      const staticWrappers = Array.from(document.querySelectorAll('.warn-wrapper')) || [];
      staticWrappers.forEach(w => {
        try { attachWarnHandlers(w); } catch (e) {}
      });
    }
  } catch (e) {}

    // Lightweight delegating wrapper: central pipeline handles calculations now.
    function recalculateDesplazamientoById(id) {
      try {
        const desp = document.querySelector(`.desplazamiento-grupo[data-desplazamiento-id="${id}"]`);
        if (!desp) return;
        if (window && window.calculoDesp && typeof window.calculoDesp.calculaDesplazamientoFicha === 'function') {
          try { window.calculoDesp.calculaDesplazamientoFicha(desp); } catch (e) {}
        }
      } catch (e) {}
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
          // If this select is the country selector, handle via manejarCambioPais so
          // that changing country forces recalculation of ALL desplazamientos.
          if (n.id && n.id.indexOf('pais-destino-') === 0) {
            n.addEventListener('change', () => { validateDateTimePairAndUpdateUI(id); try { manejarCambioPais(id); } catch(e){}; actualizarTicketCena(); try { if (typeof computeDescuentoManutencion === 'function') computeDescuentoManutencion(); } catch(e){} });
            } else {
            n.addEventListener('change', () => { validateDateTimePairAndUpdateUI(id); actualizarTicketCena(); try { if (typeof computeDescuentoManutencion === 'function') computeDescuentoManutencion(); } catch(e){} });
          }
        } else {
          // On change we defer to blur to avoid flicker while typing
          n.addEventListener('change', () => { /* noop: defer to blur */ });
          // On blur we perform validation, recalc and update visibility
          n.addEventListener('blur', () => { validateDateTimePairAndUpdateUI(id); actualizarTicketCena(); });
        }
      });
      // Specifically watch km input to decide vehicle card visibility
      const kmInput = desp.querySelector(`#km-${id}`);
      if (kmInput) {
        // Do not toggle vehicle ficha or recalc while typing; act on blur only
        kmInput.addEventListener('blur', () => {
          evaluarKmParaMostrarFicha();
          actualizarTicketCena();
        });
      }
      // Watch ticket-cena checkbox: recalc on change so manutenciones update immediately
      const ticketCheckbox = desp.querySelector(`#ticket-cena-${id}`);
      if (ticketCheckbox) {
        ticketCheckbox.addEventListener('change', () => {
          // Changing ticket affects only validation-dependent UI; actual recalculation
          // is handled by delegated listeners in `logicaDesp` which will call calculoDesp.
          validateDateTimePairAndUpdateUI(id);
          actualizarTicketCena();
        });
      }
      // Watch 'No incluir gastos de manutención' checkbox: force manutención to 0
      const noManut = desp.querySelector(`#no-manutencion-${id}`);
      if (noManut) {
        noManut.addEventListener('change', () => {
          // Recalculation handled by delegated listeners (logicaDesp). No-op here to avoid duplicate recalcs.
        });
      }
      // calcular inicialmente via calculoDesp so rendering flow is centralized
      setTimeout(() => { evaluarKmParaMostrarFicha(); try { if (window.calculoDesp && typeof window.calculoDesp.calculaDesplazamientoFicha === 'function') window.calculoDesp.calculaDesplazamientoFicha(desp); } catch(e){} }, 100);
    }

    // Attach to existing desplazamientos on load
    document.querySelectorAll('.desplazamiento-grupo').forEach(el => {
      const id = el.dataset.desplazamientoId;
      if (id) attachCalcListenersToDesplazamiento(id);
    });

    // Listener para cambio de tipo de proyecto (actualizar ticket cena)
    tipoProyecto.addEventListener('change', () => {
      actualizarTicketCena();
      // cambios en el tipo de proyecto pueden afectar a todas las fichas; programar recálculo no bloqueante
      try { scheduleFullRecalc(60); } catch(e) {}
    });

  // (Paises ya se cargan en la petición principal arriba)

});
