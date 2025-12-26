document.addEventListener('DOMContentLoaded', async function () {
    
    const API_BASE = 'https://assa-ac-jyn4.onrender.com';

    // ============================================================
    // 1. UTILITAIRE API (FETCH AVEC COOKIES / CREDENTIALS)
    // ============================================================

    /**
     * Tente de rafraîchir le token via le cookie de refresh
     */
    async function refreshAdminToken() {
        try {
            const res = await fetch(`${API_BASE}/admins/token/refresh`, {
                method: 'POST',
                credentials: 'include'
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    /**
     * Wrapper Fetch qui utilise les cookies (credentials: include)
     */
    async function fetchWithAdmin(url, options = {}) {
        // Obligatoire pour envoyer les cookies HTTP-Only
        options.credentials = 'include';
        
        if (!options.headers) options.headers = {};
        options.headers['Content-Type'] = 'application/json';

        try {
            let res = await fetch(url, options);

            // Gestion de l'expiration de session (401)
            if (res.status === 401 || res.status === 403) {
                const refreshed = await refreshAdminToken();
                if (refreshed) {
                    // Re-tentative de la requête initiale
                    res = await fetch(url, options);
                } else {
                    alert('Votre session a expiré. Veuillez vous reconnecter.');
                    window.location.href = 'Index.html';
                    throw new Error('Session expirée');
                }
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
    // 2. GESTION DES ONGLETS
    // ============================================================
    const navLinks = document.querySelectorAll('.settings-nav a');
    const sections = document.querySelectorAll('.settings-section');

    function showSection(targetId) {
        navLinks.forEach(link => link.classList.remove('settings-active'));
        const activeLink = document.querySelector(`.settings-nav a[href="${targetId}"]`);
        if (activeLink) activeLink.classList.add('settings-active');

        sections.forEach(section => (section.style.display = 'none'));
        const targetSection = document.querySelector(targetId);
        if (targetSection) targetSection.style.display = 'block';

        if (targetId === '#themes') {
            const currentTheme = localStorage.getItem('theme') || 'light';
            applyTheme(currentTheme);
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            showSection(this.getAttribute('href'));
        });
    });

    showSection('#general');

    // ============================================================
    // 3. GESTION DU THÈME (Sauvegarde locale conservée pour le confort)
    // ============================================================
    const themeOptions = document.querySelectorAll('.theme-option');

    function applyTheme(theme) {
        const body = document.body;
        body.classList.remove('dark-mode');

        if (theme === 'dark') {
            body.classList.add('dark-mode');
        } else if (theme === 'system') {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                body.classList.add('dark-mode');
            }
        }

        localStorage.setItem('theme', theme);

        themeOptions.forEach(option => option.classList.remove('selected'));
        const selectedBtn = document.querySelector(`.theme-option[data-theme="${theme}"]`);
        if (selectedBtn) selectedBtn.classList.add('selected');
    }

    themeOptions.forEach(option => {
        option.addEventListener('click', function () {
            applyTheme(this.dataset.theme);
        });
    });

    applyTheme(localStorage.getItem('theme') || 'light');

    // ============================================================
    // 4. FORMULAIRE : SÉCURITÉ (MOT DE PASSE)
    // ============================================================
    const passwordForm = document.querySelector('#security form');
    
    if (passwordForm) {
        const messageBox = document.createElement('div');
        messageBox.className = 'form-status-message'; // Style à définir en CSS
        messageBox.style.marginBottom = '15px';
        messageBox.style.fontWeight = 'bold';
        passwordForm.prepend(messageBox);

        passwordForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const currentPassword = document.querySelector('#current-password').value;
            const newPassword = document.querySelector('#new-password').value;
            const confirmPassword = document.querySelector('#confirm-password').value;

            messageBox.textContent = '';

            if (newPassword !== confirmPassword) {
                messageBox.textContent = 'Les mots de passe ne correspondent pas.';
                messageBox.style.color = 'red';
                return;
            }

            try {
               await fetchWithAdmin(`${API_BASE}/api/parametres/update-password`, {
                    method: 'POST',
                    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
                });


                messageBox.textContent = 'Mot de passe mis à jour avec succès.';
                messageBox.style.color = 'green';
                passwordForm.reset();
            } catch (err) {
                messageBox.textContent = err.message;
                messageBox.style.color = 'red';
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

            const payload = {
                companyName: document.querySelector('#company-name').value.trim(),
                address: document.querySelector('#address').value.trim(),
                email: document.querySelector('#email').value.trim()
            };

            try {
                await fetchWithAdmin(`${API_BASE}/api/parametres`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });

                generalMsg.textContent = 'Paramètres sauvegardés.';
                generalMsg.style.color = 'green';
            } catch (err) {
                generalMsg.textContent = err.message;
                generalMsg.style.color = 'red';
            }
        });
    }
});