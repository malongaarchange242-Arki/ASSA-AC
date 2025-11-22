document.addEventListener('DOMContentLoaded', function () {
    // =========================
    // 1. Onglet des paramètres
    // =========================
    const navLinks = document.querySelectorAll('.settings-nav a');
    const sections = document.querySelectorAll('.settings-section');
    const themeOptions = document.querySelectorAll('.theme-option');

    function showSection(targetId) {
        navLinks.forEach(link => link.classList.remove('settings-active'));
        const activeLink = document.querySelector(`.settings-nav a[href="${targetId}"]`);
        if (activeLink) activeLink.classList.add('settings-active');

        sections.forEach(section => (section.style.display = 'none'));
        const targetSection = document.querySelector(targetId);
        if (targetSection) targetSection.style.display = 'block';

        const currentTheme = localStorage.getItem('theme') || 'light';
        if (targetId === '#themes') applyTheme(currentTheme);
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            showSection(this.getAttribute('href'));
        });
    });

    showSection('#general'); // section par défaut

    // =========================
    // 2. Gestion des thèmes
    // =========================
    function applyTheme(theme) {
        const body = document.body;
        body.classList.remove('dark-mode');

        if (theme === 'dark') body.classList.add('dark-mode');
        else if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) body.classList.add('dark-mode');
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

    // Appliquer thème sauvegardé
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    if (savedTheme === 'system') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme('system'));
    }

    // =========================
    // 3. Utilitaire fetch avec token admin
    // =========================
    async function fetchWithAdmin(url, options = {}) {
        const token = localStorage.getItem('jwtTokenAdmin');
        if (!token) throw new Error('Vous devez être connecté en tant qu\'admin.');

        if (!options.headers) options.headers = {};
        options.headers['Content-Type'] = 'application/json';
        options.headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(url, options);
        if (res.status === 401) throw new Error('Token expiré, reconnectez-vous');
        if (res.status === 403) throw new Error('Accès interdit : permissions insuffisantes');

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text || 'Erreur serveur' };
        }

        if (!res.ok) throw new Error(data.message || 'Erreur API');
        return data;
    }

    // =========================
    // 4. Formulaire sécurité / mot de passe
    // =========================
    const passwordForm = document.querySelector('#security form');
    if (passwordForm) {
        const messageBox = document.createElement('div');
        messageBox.style.marginBottom = '15px';
        passwordForm.prepend(messageBox);

        passwordForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const currentPassword = document.querySelector('#current-password').value.trim();
            const newPassword = document.querySelector('#new-password').value.trim();
            const confirmPassword = document.querySelector('#confirm-password').value.trim();

            messageBox.textContent = '';
            messageBox.style.color = '';

            if (!currentPassword || !newPassword || !confirmPassword) {
                messageBox.textContent = 'Tous les champs sont requis.';
                messageBox.style.color = 'red';
                return;
            }

            if (newPassword !== confirmPassword) {
                messageBox.textContent = 'Le nouveau mot de passe et sa confirmation ne correspondent pas.';
                messageBox.style.color = 'red';
                return;
            }

            try {
                const data = await fetchWithAdmin(' https://assa-ac.onrender.com/api/admins/update-password', {
                    method: 'POST',
                    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
                });

                messageBox.textContent = data.message;
                messageBox.style.color = 'green';
                passwordForm.reset();
            } catch (err) {
                console.error(err);
                messageBox.textContent = err.message;
                messageBox.style.color = 'red';
            }
        });
    }

    // =========================
    // 5. Formulaire paramètres généraux
    // =========================
    const generalForm = document.querySelector('#general form');
    if (generalForm) {
        const generalMsg = document.createElement('div');
        generalMsg.style.marginBottom = '15px';
        generalForm.prepend(generalMsg);

        generalForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const companyName = document.querySelector('#company-name').value.trim();
            const address = document.querySelector('#address').value.trim();
            const email = document.querySelector('#email').value.trim();

            if (!companyName || !address || !email) {
                generalMsg.textContent = 'Tous les champs sont requis.';
                generalMsg.style.color = 'red';
                return;
            }

            try {
                const data = await fetchWithAdmin(' https://assa-ac.onrender.com/api/parametres', {
                    method: 'PUT',
                    body: JSON.stringify({ companyName, address, email })
                });

                generalMsg.textContent = 'Paramètres généraux sauvegardés';
                generalMsg.style.color = 'green';
            } catch (err) {
                console.error(err);
                generalMsg.textContent = err.message;
                generalMsg.style.color = 'red';
            }
        });
    }
});
