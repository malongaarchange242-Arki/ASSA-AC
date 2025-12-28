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
        if (activeLink) activeLink.classList.add('settings-active');

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

        // Mise à jour visuelle des boutons de sélection
        themeOptions.forEach(option => option.classList.remove('selected'));
        const selectedBtn = document.querySelector(`.theme-option[data-theme="${theme}"]`);
        if (selectedBtn) selectedBtn.classList.add('selected');
    }

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
            alert('Session expirée ou invalide. Veuillez vous reconnecter.');
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
                alert('Session expirée. Veuillez vous reconnecter.');
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
                messageBox.textContent = 'Tous les champs sont requis.';
                messageBox.style.color = 'var(--alert-red)';
                return;
            }

            if (newPassword !== confirmPassword) {
                messageBox.textContent = 'Le nouveau mot de passe et la confirmation ne correspondent pas.';
                messageBox.style.color = 'var(--alert-red)';
                return;
            }

            // Envoi API
            try {
                const data = await fetchWithAdmin('http://localhost:5002/api/admins/update-password', {
                    method: 'POST',
                    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
                });

                messageBox.textContent = 'Mot de passe mis à jour avec succès.';
                messageBox.style.color = '#34A853'; // Vert
                passwordForm.reset();
            } catch (err) {
                messageBox.textContent = err.message || "Erreur lors de la mise à jour.";
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
                generalMsg.textContent = 'Tous les champs sont requis.';
                generalMsg.style.color = 'var(--alert-red)';
                return;
            }

            try {
                // Note : Vérifiez si cette route API existe bien sur votre backend
                const data = await fetchWithAdmin('http://localhost:5002/api/parametres', {
                    method: 'PUT',
                    body: JSON.stringify({ companyName, address, email })
                });

                generalMsg.textContent = 'Paramètres généraux sauvegardés avec succès.';
                generalMsg.style.color = '#34A853'; // Vert
            } catch (err) {
                generalMsg.textContent = err.message || "Erreur lors de la sauvegarde.";
                generalMsg.style.color = 'var(--alert-red)';
            }
        });
    }

});