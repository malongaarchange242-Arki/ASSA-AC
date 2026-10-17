document.addEventListener('DOMContentLoaded', function () {
    
    // ============================================================
    // 1. GESTION DES ONGLETS (NAVIGATION INTERNE)
    // ============================================================
    const navLinks = document.querySelectorAll('.settings-nav a');
    const sections = document.querySelectorAll('.settings-section');

    function showSection(targetId) {
        // 1. Mettre à jour la classe active sur le lien
        navLinks.forEach(link => link.classList.remove('settings-active'));
        const activeLink = document.querySelector(`.settings-nav a[href="${targetId}"]`);
        if (activeLink) {
            activeLink.classList.add('settings-active');
            activeLink.setAttribute('aria-current', 'page');
        }
        navLinks.forEach(link => {
            if (link !== activeLink) link.removeAttribute('aria-current');
        });

        // 2. Masquer toutes les sections
        sections.forEach(section => (section.style.display = 'none'));

        // 3. Afficher la section cible
        const targetSection = document.querySelector(targetId);
        if (targetSection) targetSection.style.display = 'block';

        // 4. Si on va sur l'onglet thèmes, on réapplique le thème pour mettre à jour les boutons
        if (targetId === '#themes') {
            const currentTheme = localStorage.getItem('theme') || 'light';
            applyTheme(currentTheme);
        }
    }

    // Écouteur sur les liens de navigation
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            showSection(targetId);
        });
    });

    // Afficher la section Général par défaut au chargement
    showSection('#general');


    // ============================================================
    // 2. GESTION DU MODE NUIT (DARK MODE)
    // ============================================================
    const themeOptions = document.querySelectorAll('.theme-option');

    function applyTheme(theme) {
        const body = document.body;
        const themeToggle = document.getElementById('theme-toggle');
        
        // Retirer la classe dark-mode par précaution
        body.classList.remove('dark-mode');

        // Appliquer la logique
        if (theme === 'dark') {
            body.classList.add('dark-mode');
        } else if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) body.classList.add('dark-mode');
        }
        // Si 'light', on ne fait rien car la classe est déjà retirée

        // Sauvegarde
        localStorage.setItem('theme', theme);

        if (themeToggle) {
            const isDark = body.classList.contains('dark-mode');
            themeToggle.innerHTML = `<i class="fas fa-${isDark ? 'sun' : 'moon'}" aria-hidden="true"></i>`;
            themeToggle.title = isDark ? t('theme_toggle_light') : t('theme_toggle_dark');
            themeToggle.setAttribute('aria-label', themeToggle.title);
        }

        // Mise à jour visuelle des boutons de sélection
        themeOptions.forEach(option => {
            option.classList.remove('selected');
            option.setAttribute('aria-pressed', 'false');
        });
        const selectedBtn = document.querySelector(`.theme-option[data-theme="${theme}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
            selectedBtn.setAttribute('aria-pressed', 'true');
        }
    }

    function updateThemeToggleLabel() {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;
        const label = document.body.classList.contains('dark-mode')
            ? t('theme_toggle_light')
            : t('theme_toggle_dark');
        themeToggle.title = label;
        themeToggle.setAttribute('aria-label', label);
    }

    window.addEventListener('app-language-change', updateThemeToggleLabel);

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        applyTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark');
    });

    // Écouteur sur les boutons de thème
    themeOptions.forEach(option => {
        option.addEventListener('click', function () {
            applyTheme(this.dataset.theme);
        });
    });

    // Initialisation au chargement de la page
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Écouter les changements système si le mode est sur 'system'
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (localStorage.getItem('theme') === 'system') {
            applyTheme('system');
        }
    });


    // ============================================================
    // 3. UTILITAIRE API (FETCH AVEC TOKEN)
    // ============================================================
    async function fetchWithAdmin(url, options = {}) {
        const token = localStorage.getItem('jwtTokenAdmin');
        
        if (!token) {
            alert(t('settings_session_invalid'));
            window.location.href = 'Index.html'; // Redirection vers login
            throw new Error('Token manquant');
        }

        if (!options.headers) options.headers = {};
        options.headers['Content-Type'] = 'application/json';
        options.headers['Authorization'] = `Bearer ${token}`;

        try {
            const res = await fetch(url, options);

            // Gestion des erreurs d'authentification
            if (res.status === 401 || res.status === 403) {
                alert(res.status === 401 ? t('settings_session_expired') : t('settings_unauthorized'));
                window.location.href = 'Index.html';
                throw new Error('Non autorisé');
            }

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.message || 'Erreur serveur');
            }

            return data;
        } catch (error) {
            console.error("Erreur API:", error);
            throw error;
        }
    }


    // ============================================================
    // 4. FORMULAIRE : SÉCURITÉ (MOT DE PASSE)
    // ============================================================
    const passwordForm = document.querySelector('#security form');
    
    if (passwordForm) {
        // Création d'une zone de message dynamique
        const messageBox = document.createElement('div');
        messageBox.style.marginBottom = '15px';
        messageBox.style.fontWeight = 'bold';
        passwordForm.prepend(messageBox);

        passwordForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Récupération des valeurs
            const currentPassword = document.querySelector('#current-password').value.trim();
            const newPassword = document.querySelector('#new-password').value.trim();
            const confirmPassword = document.querySelector('#confirm-password').value.trim();

            // Reset message
            messageBox.textContent = '';
            messageBox.className = '';

            // Validation locale
            if (!currentPassword || !newPassword || !confirmPassword) {
                messageBox.textContent = t('settings_required_fields');
                messageBox.style.color = 'var(--alert-red)';
                return;
            }

            if (newPassword !== confirmPassword) {
                messageBox.textContent = t('settings_password_mismatch');
                messageBox.style.color = 'var(--alert-red)';
                return;
            }

            // Envoi API
            try {
                const data = await fetchWithAdmin('https://assa-ac-api.onrender.com/api/admins/update-password', {
                    method: 'POST',
                    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
                });

                messageBox.textContent = t('settings_password_updated');
                messageBox.style.color = '#34A853'; // Vert
                passwordForm.reset();
            } catch (err) {
                console.error('Password update failed:', err);
                messageBox.textContent = t('settings_password_update_failed');
                messageBox.style.color = 'var(--alert-red)';
            }
        });
    }


    // ============================================================
    // 5. FORMULAIRE : PARAMÈTRES GÉNÉRAUX
    // ============================================================
    const generalForm = document.querySelector('#general form');
    
    if (generalForm) {
        const generalMsg = document.createElement('div');
        generalMsg.style.marginBottom = '15px';
        generalMsg.style.fontWeight = 'bold';
        generalForm.prepend(generalMsg);

        generalForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const companyName = document.querySelector('#company-name').value.trim();
            const address = document.querySelector('#address').value.trim();
            const email = document.querySelector('#email').value.trim();

            generalMsg.textContent = '';

            if (!companyName || !address || !email) {
                generalMsg.textContent = t('settings_required_fields');
                generalMsg.style.color = 'var(--alert-red)';
                return;
            }

            try {
                // Note : Vérifiez si cette route API existe bien sur votre backend
                const data = await fetchWithAdmin('https://assa-ac-api.onrender.com/api/parametres', {
                    method: 'PUT',
                    body: JSON.stringify({ companyName, address, email })
                });

                generalMsg.textContent = t('settings_general_saved');
                generalMsg.style.color = '#34A853'; // Vert
            } catch (err) {
                console.error('Saving general settings failed:', err);
                generalMsg.textContent = t('settings_general_save_failed');
                generalMsg.style.color = 'var(--alert-red)';
            }
        });
    }

});