// js/main.js
document.addEventListener("DOMContentLoaded", () => {
    // Helper: abrir una sección (establece max-height según el contenido)
    function openSection(wrapper, icon, titleEl) {
        const content = wrapper.querySelector('.section-content');
        // Forzar cálculo de altura actual
        const height = content.scrollHeight;
        wrapper.style.maxHeight = height + 'px';
        wrapper.classList.remove('collapsed');
        icon.textContent = '−';
        if (titleEl) titleEl.setAttribute('aria-expanded', 'true');
    }

    // Helper: cerrar una sección
    function closeSection(wrapper, icon, titleEl) {
        wrapper.style.maxHeight = '0px';
        wrapper.classList.add('collapsed');
        icon.textContent = '+';
        if (titleEl) titleEl.setAttribute('aria-expanded', 'false');
    }

        // Inicializar acordeón para cada sección
        document.querySelectorAll('.section-title').forEach((title, index) => {
            const icon = title.querySelector('.toggle-section');
            const wrapper = title.nextElementSibling; // section-content-wrapper
            const content = wrapper.querySelector('.section-content');

            // Ensure elements have ids for aria attributes
            if (!title.id) title.id = `section-title-${index + 1}`;
            if (!content.id) content.id = `section-content-${index + 1}`;
            if (!wrapper.id) wrapper.id = `section-wrapper-${index + 1}`;

            // Accessibility: make title focusable and set aria attributes
            title.setAttribute('role', 'button');
            title.setAttribute('tabindex', '0');
            title.setAttribute('aria-controls', content.id);
            title.setAttribute('aria-expanded', 'true');

            // Mark content region for assistive tech
            wrapper.setAttribute('role', 'region');
            wrapper.setAttribute('aria-labelledby', title.id);
            wrapper.setAttribute('aria-hidden', 'false');

            // Ensure initial state: open
            wrapper.classList.remove('collapsed');
            wrapper.style.maxHeight = content.scrollHeight + 'px';
            icon.textContent = '−';

            // Toggle handler
            function toggle() {
                const isCollapsed = wrapper.classList.contains('collapsed') || wrapper.style.maxHeight === '0px';
                if (isCollapsed) {
                    openSection(wrapper, icon, title);
                    wrapper.setAttribute('aria-hidden', 'false');
                } else {
                    closeSection(wrapper, icon, title);
                    wrapper.setAttribute('aria-hidden', 'true');
                }
            }

            // Click and keyboard support (Enter, Space to toggle; Escape to close)
            title.addEventListener('click', toggle);
            title.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    toggle();
                } else if (e.key === 'Escape' || e.key === 'Esc') {
                    // Close the section on Escape
                    if (!wrapper.classList.contains('collapsed')) {
                        closeSection(wrapper, icon, title);
                        wrapper.setAttribute('aria-hidden', 'true');
                    }
                }
            });

            // Observe content size changes (useful when adding/removing dynamic fields)
            if (window.ResizeObserver) {
                const ro = new ResizeObserver(() => {
                    // If open, update maxHeight to match new content height
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

    // Asegurar que todas las etiquetas de formulario terminen con ':'
    try {
        document.querySelectorAll('label').forEach(lbl => {
            // No modificar labels que contienen HTML complejo (por ejemplo, inputs dentro)
            if (lbl.querySelector('*')) return;
            const text = lbl.textContent || '';
            // Trim y comprobar último carácter visible (ignorar espacios)
            const trimmed = text.replace(/\s+$/,'');
            if (trimmed.length === 0) return;
            if (!trimmed.endsWith(':')) {
                lbl.textContent = trimmed + ':';
            }
        });
    } catch (e) {
        // Silenciar fallos aquí para no romper el resto del script
        console.warn('No se pudo normalizar labels:', e);
    }
});