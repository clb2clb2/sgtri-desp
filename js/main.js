// js/main.js
// ============================================
// Inicialización principal de la aplicación
// ============================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // Helpers para acordeón de secciones
    // ========================================

    /**
     * Abre una sección del acordeón
     * @param {HTMLElement} wrapper - El contenedor .section-content-wrapper
     * @param {HTMLElement} icon - El icono .toggle-section
     * @param {HTMLElement} titleEl - El elemento .section-title
     */
    function openSection(wrapper, icon, titleEl) {
        const content = wrapper.querySelector('.section-content');
        const height = content.scrollHeight;
        wrapper.style.maxHeight = height + 'px';
        wrapper.classList.remove('collapsed');
        icon.classList.add('open');
        if (titleEl) titleEl.setAttribute('aria-expanded', 'true');
    }

    /**
     * Cierra una sección del acordeón
     * @param {HTMLElement} wrapper - El contenedor .section-content-wrapper
     * @param {HTMLElement} icon - El icono .toggle-section
     * @param {HTMLElement} titleEl - El elemento .section-title
     */
    function closeSection(wrapper, icon, titleEl) {
        wrapper.style.maxHeight = '0px';
        wrapper.classList.add('collapsed');
        icon.classList.remove('open');
        if (titleEl) titleEl.setAttribute('aria-expanded', 'false');
    }

    // ========================================
    // Inicialización del acordeón
    // ========================================

    document.querySelectorAll('.section-title').forEach((title, index) => {
        // Saltar secciones no colapsables
        if (title.classList.contains('no-collapse')) {
            return;
        }

        const icon = title.querySelector('.toggle-section');
        const wrapper = title.nextElementSibling; // section-content-wrapper
        const content = wrapper.querySelector('.section-content');

        // Asegurar IDs para atributos ARIA
        if (!title.id) title.id = `section-title-${index + 1}`;
        if (!content.id) content.id = `section-content-${index + 1}`;
        if (!wrapper.id) wrapper.id = `section-wrapper-${index + 1}`;

        // Accesibilidad: hacer título focusable y configurar ARIA
        title.setAttribute('role', 'button');
        title.setAttribute('tabindex', '0');
        title.setAttribute('aria-controls', content.id);
        title.setAttribute('aria-expanded', 'true');

        // Marcar región de contenido para tecnologías asistivas
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-labelledby', title.id);
        wrapper.setAttribute('aria-hidden', 'false');

        // Estado inicial: abierto o colapsado según data-attribute
        const startCollapsed = title.dataset?.startCollapsed === 'true' || 
                               title.classList.contains('start-collapsed');
        
        if (startCollapsed) {
            closeSection(wrapper, icon, title);
            wrapper.setAttribute('aria-hidden', 'true');
        } else {
            openSection(wrapper, icon, title);
            wrapper.setAttribute('aria-hidden', 'false');
        }

        // Handler de toggle
        function toggle() {
            const isCollapsed = wrapper.classList.contains('collapsed') || 
                               wrapper.style.maxHeight === '0px';
            if (isCollapsed) {
                openSection(wrapper, icon, title);
                wrapper.setAttribute('aria-hidden', 'false');
            } else {
                closeSection(wrapper, icon, title);
                wrapper.setAttribute('aria-hidden', 'true');
            }
        }

        // Soporte para click y teclado
        title.addEventListener('click', toggle);
        title.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                toggle();
            } else if (e.key === 'Escape' || e.key === 'Esc') {
                if (!wrapper.classList.contains('collapsed')) {
                    closeSection(wrapper, icon, title);
                    wrapper.setAttribute('aria-hidden', 'true');
                }
            }
        });

        // Observar cambios de tamaño del contenido (útil con campos dinámicos)
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                if (!wrapper.classList.contains('collapsed')) {
                    wrapper.style.maxHeight = content.scrollHeight + 'px';
                }
            });
            ro.observe(content);
        } else {
            // Fallback: MutationObserver
            const mo = new MutationObserver(() => {
                if (!wrapper.classList.contains('collapsed')) {
                    wrapper.style.maxHeight = content.scrollHeight + 'px';
                }
            });
            mo.observe(content, { childList: true, subtree: true, characterData: true });
        }
    });

    // ========================================
    // Prevenir envío de formularios con Enter
    // ========================================

    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    });

    // ========================================
    // Inicialización de módulos externos
    // ========================================

    // Inicializar logicaDesp
    try {
        if (window.logicaDesp?.init) {
            window.logicaDesp.init();
        }
    } catch (e) { 
        console.warn('Error al inicializar logicaDesp:', e); 
    }

    // Inicializar resultadoLiquidacion
    try {
        if (window.resultadoLiquidacion?.init) {
            window.resultadoLiquidacion.init();
        }
    } catch (e) {
        console.warn('Error al inicializar resultadoLiquidacion:', e);
    }

    // Ejecutar cálculo inicial por cada desplazamiento
    try {
        const grupos = document.querySelectorAll('.desplazamiento-grupo');
        grupos.forEach(desp => {
            if (window.calculoDesp?.calculaDesplazamientoFicha) {
                // Usar requestAnimationFrame para esperar al siguiente frame de renderizado
                requestAnimationFrame(() => {
                    try { 
                        window.calculoDesp.calculaDesplazamientoFicha(desp); 
                    } catch (e) {
                        console.warn('Error en cálculo inicial de desplazamiento:', e);
                    }
                });
            }
        });
    } catch (e) {
        console.warn('Error al procesar desplazamientos iniciales:', e);
    }
});