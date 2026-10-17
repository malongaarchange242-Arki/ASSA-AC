// ==========================================================================
// ASSA-AC - COMPOSANTS COMMUNS ESPACE SUPERVISEUR
// (Sidebar, Topbar, Thème Sombre, Menu Profil, Navigation Responsive & Auth)
// ==========================================================================

(function () {
    // 1. Vérification d'authentification
    const TOKEN_KEY = 'jwtTokenSuperviseur';
    const token = localStorage.getItem(TOKEN_KEY);

    // Fonction de traduction sécurisée
    const getI18n = (key, fallback = '') => {
        if (typeof window.t === 'function') {
            const res = window.t(key);
            if (res && res !== key) return res;
        }
        return fallback || key;
    };

    if (!token && !window.location.pathname.toLowerCase().includes('index.html')) {
        console.warn('Superviseur non connecté, redirection vers Index.html');
        // Redirection différée si pas de token
        setTimeout(() => {
            if (!localStorage.getItem(TOKEN_KEY)) {
                alert(getI18n('dashboard_not_connected', 'Vous n’êtes pas connecté !'));
                window.location.href = 'Index.html';
            }
        }, 100);
    }

    document.addEventListener('DOMContentLoaded', () => {

        // 2. Gestion globale du Thème Sombre / Clair
        const toggleTheme = document.getElementById('toggleTheme');
        
        const updateThemeUI = (isDark) => {
            document.body.classList.toggle('dark-mode', isDark);
            const icon = toggleTheme?.querySelector('i');
            if (icon) {
                icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
            if (toggleTheme) {
                const label = isDark ? 'Passer au mode clair' : 'Passer au mode sombre';
                toggleTheme.setAttribute('aria-label', label);
                toggleTheme.title = label;
                toggleTheme.setAttribute('aria-pressed', String(isDark));
            }
        };

        if (localStorage.getItem('theme') === 'dark') {
            updateThemeUI(true);
        }

        toggleTheme?.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeUI(isDark);
        });

        // 3. Navigation mobile (Drawer Sidebar & Backdrop)
        const menuToggle = document.getElementById('mobileMenuToggle');
        const sidebar = document.getElementById('supervisorSidebar') || document.querySelector('.sidebar');
        const sidebarBackdrop = document.getElementById('sidebarBackdrop');

        const setSidebarOpen = open => {
            document.body.classList.toggle('sidebar-open', open);
            menuToggle?.setAttribute('aria-expanded', String(open));
            const icon = menuToggle?.querySelector('i');
            if (icon) icon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
            if (sidebarBackdrop) {
                sidebarBackdrop.hidden = !open;
            }
        };

        menuToggle?.addEventListener('click', () => {
            const isOpen = document.body.classList.contains('sidebar-open');
            setSidebarOpen(!isOpen);
        });

        sidebarBackdrop?.addEventListener('click', () => setSidebarOpen(false));
        sidebar?.querySelectorAll('.nav a').forEach(link => {
            link.addEventListener('click', () => setSidebarOpen(false));
        });

        // 4. Initiales et avatar du Superviseur
        const email = localStorage.getItem('userEmailSuperviseur') || '';
        if (email) {
            const cleanEmail = email.split('@')[0];
            const initials = cleanEmail.split(/[._\s-]+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'SA';
            document.querySelectorAll('#supervisorAvatar, .avatar, #topbarAvatarInitials').forEach(el => {
                el.textContent = initials;
            });
        }

        // 5. Menu Profil Dropdown
        const userMenu = document.getElementById('userMenu');
        const avatarButton = userMenu?.querySelector('.avatar-btn');
        const dropdown = document.getElementById('userDropdown');

        const setProfileMenuOpen = open => {
            dropdown?.classList.toggle('show', open);
            dropdown?.setAttribute('aria-hidden', String(!open));
            avatarButton?.setAttribute('aria-expanded', String(open));
        };

        avatarButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown?.classList.contains('show');
            setProfileMenuOpen(!isOpen);
        });

        document.addEventListener('click', (e) => {
            if (userMenu && !userMenu.contains(e.target)) {
                setProfileMenuOpen(false);
            }
        });

        // Actions du dropdown profil
        document.querySelectorAll('#userDropdown .dropdown-item').forEach(button => {
            const action = button.getAttribute('data-action');
            if (action === 'profile') {
                button.addEventListener('click', () => setProfileMenuOpen(false));
            } else if (action === 'settings') {
                button.addEventListener('click', () => window.location.assign('parametres_Superviseur.html'));
            } else if (action === 'logout') {
                button.addEventListener('click', () => {
                    ['jwtTokenSuperviseur', 'refreshTokenSuperviseur', 'userRoleSuperviseur', 'userEmailSuperviseur', 'superviseurId'].forEach(k => localStorage.removeItem(k));
                    window.location.assign('Index.html');
                });
            }
        });

        // 6. Fermeture via la touche Échap
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                setSidebarOpen(false);
                setProfileMenuOpen(false);
                const detailPanel = document.getElementById('detailPanel');
                if (detailPanel) detailPanel.classList.remove('open');
            }
        });

        // 7. Détection automatique du lien actif dans la sidebar
        const currentPath = window.location.pathname.split("/").pop() || 'Acceuil_Superviseur.html';
        document.querySelectorAll('.sidebar .nav a').forEach(link => {
            const href = link.getAttribute('href');
            const li = link.parentElement;
            if (href === currentPath || (href.includes('Acceuil') && currentPath.includes('Accueil'))) {
                li.classList.add('active');
            } else {
                li.classList.remove('active');
            }
        });
    });
})();
