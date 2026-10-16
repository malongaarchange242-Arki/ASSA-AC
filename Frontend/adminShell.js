(() => {
    const navigationKey = 'assaac-admin-navigation-pending';
    let canPersistNavigation = true;
    try {
        if (sessionStorage.getItem(navigationKey) === '1') {
            document.body.classList.add('admin-navigating');
        }
    } catch (error) {
        canPersistNavigation = false;
        console.error('Unable to restore Admin navigation state.', error);
    }

    function finishNavigation() {
        document.body.classList.remove('admin-navigating');
        if (!canPersistNavigation) return;
        try {
            sessionStorage.removeItem(navigationKey);
        } catch (error) {
            console.error('Unable to clear Admin navigation state.', error);
        }
    }

    if (document.readyState === 'complete') {
        finishNavigation();
    } else {
        window.addEventListener('load', finishNavigation, { once: true });
    }
    window.addEventListener('pageshow', finishNavigation);

    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const link = event.target.closest('a[href]');
        if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;

        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin ||
            !destination.pathname.toLocaleLowerCase().endsWith('.html') ||
            normalizePath(destination.pathname) === normalizePath(window.location.pathname)) {
            return;
        }

        if (canPersistNavigation) {
            try {
                sessionStorage.setItem(navigationKey, '1');
            } catch (error) {
                canPersistNavigation = false;
                console.error('Unable to persist Admin navigation state.', error);
            }
        }
        document.body.classList.add('admin-navigating');
    }, true);

    const scriptUrl = document.currentScript?.src || new URL('adminShell.js', window.location.href).href;
    const sidebarUrl = new URL('adminSidebar.html', scriptUrl);
    const sidebarMarkupPromise = fetch(sidebarUrl).then((response) => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} while loading ${sidebarUrl}`);
        }
        return response.text();
    });

    document.addEventListener('DOMContentLoaded', async () => {
        const mount = document.getElementById('admin-sidebar-root');
        if (!mount) {
            console.error('Admin sidebar mount point #admin-sidebar-root is missing.');
            return;
        }

        try {
            const template = document.createElement('template');
            template.innerHTML = await sidebarMarkupPromise;

            const sidebar = template.content.querySelector('.sidebar');
            const backdrop = template.content.querySelector('.sidebar-backdrop');
            const openButton = document.getElementById('open-sidebar-btn');
            const closeButton = template.content.querySelector('#close-sidebar-btn');
            if (!sidebar || !backdrop || !openButton || !closeButton) {
                throw new Error('The shared Admin sidebar fragment is incomplete.');
            }

            mount.replaceWith(template.content);
            requestAnimationFrame(() => sidebar.classList.add('sidebar-ready'));

            const currentPath = normalizePath(window.location.pathname);
            sidebar.querySelectorAll('.nav-menu a').forEach((link) => {
                const isCurrentPage = normalizePath(new URL(link.href).pathname) === currentPath;
                link.classList.toggle('active', isCurrentPage);
                if (isCurrentPage) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });

            function setSidebarOpen(isOpen) {
                document.body.classList.toggle('sidebar-open', isOpen);
                openButton.setAttribute('aria-expanded', String(isOpen));
            }

            openButton.addEventListener('click', () => setSidebarOpen(true));
            closeButton.addEventListener('click', () => setSidebarOpen(false));
            backdrop.addEventListener('click', () => setSidebarOpen(false));
            sidebar.querySelectorAll('a').forEach((link) => {
                link.addEventListener('click', () => setSidebarOpen(false));
            });

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') setSidebarOpen(false);
            });

            window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
                if (event.matches) setSidebarOpen(false);
            });

            if (typeof window.setLanguage === 'function') {
                window.setLanguage(localStorage.getItem('lang') || 'fr');
            }
        } catch (error) {
            console.error('Unable to initialize the shared Admin sidebar.', error);
            const message = document.createElement('p');
            message.setAttribute('role', 'alert');
            message.textContent = "Le menu d'administration n'a pas pu être chargé.";
            const errorTarget = document.getElementById('admin-sidebar-root') || document.body;
            errorTarget.replaceChildren(message);
        }
    });

    function normalizePath(path) {
        return decodeURIComponent(path).replace(/\/+$/, '').toLocaleLowerCase();
    }
})();
