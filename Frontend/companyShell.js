document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const openButton = document.getElementById('open-sidebar-btn');
    const closeButton = document.getElementById('close-sidebar-btn');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (!sidebar || !openButton || !closeButton || !backdrop) return;

    const currentPage = window.location.pathname.split('/').pop().toLowerCase();
    sidebar.querySelectorAll('.nav-link').forEach((link) => {
        const linkedPage = new URL(link.href, window.location.href).pathname.split('/').pop().toLowerCase();
        const isCurrentPage = linkedPage === currentPage;
        link.classList.toggle('active', isCurrentPage);
        if (isCurrentPage) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });

    const desktopMedia = window.matchMedia('(min-width: 1024px)');

    function setSidebarOpen(isOpen) {
        const isDesktop = desktopMedia.matches;
        sidebar.classList.toggle('-translate-x-full', !isOpen);
        document.body.classList.toggle('company-sidebar-open', isOpen && !isDesktop);
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

    desktopMedia.addEventListener('change', (event) => {
        setSidebarOpen(event.matches);
    });

    setSidebarOpen(desktopMedia.matches);
});
