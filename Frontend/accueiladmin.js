document.addEventListener('DOMContentLoaded', async () => {
    // ==========================================
    // 1. GESTION DU THÈME (Préférences UI)
    // ==========================================
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            if (themeToggle) {
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                themeToggle.title = "Passer au Mode Clair";
            }
        } else {
            body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
            if (themeToggle) {
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                themeToggle.title = "Passer au Mode Sombre";
            }
        }
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }

    // ==========================================
    // 2. CONFIGURATION API & AUTHENTIFICATION (COOKIES)
    // ==========================================
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002') ? origin : 'https://assa-ac-jyn4.onrender.com';
    })();

    // On ne garde que les infos publiques dans le localStorage (ex: email pour l'affichage)
    // Les tokens (JWT) sont désormais gérés par les cookies du navigateur.
    const userEmail = localStorage.getItem('userEmail'); 

    const userNameSpan = document.getElementById('user-name');
    if (userNameSpan) {
        userNameSpan.innerHTML = `${userEmail || 'Utilisateur'} <i class="fas fa-caret-down"></i>`;
    }

    /**
     * fetchAuth : Remplace les appels fetch classiques pour inclure les cookies
     */
    async function fetchAuth(url, options = {}) {
        // 'include' permet d'envoyer les cookies (et d'en recevoir de nouveaux)
        options.credentials = 'include';
        
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json'
        };

        let res = await fetch(url, options);

        // GESTION DU REFRESH TOKEN (Côté serveur via Cookies)
        if (res.status === 401) {
            try {
                // On tente d'appeler la route de refresh. 
                // Le navigateur enverra le cookie de refresh automatiquement avec 'include'.
                const refreshRes = await fetch(`${API_BASE}/api/admins/token/refresh`, { 
                    method: 'POST', 
                    credentials: 'include' 
                });
                
                if (refreshRes.ok) {
                    // Si le serveur a renouvelé le cookie de session, on relance la requête initiale
                    res = await fetch(url, options);
                } else {
                    throw new Error('Session expirée');
                }
            } catch (err) {
                console.warn("Authentification échouée, redirection...");
                window.location.href = 'login.html';
                return;
            }
        }

        if (res.status === 403) throw new Error('Accès interdit (droits insuffisants)');

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Erreur HTTP ${res.status}`);

        return data;
    }

    // ==========================================
    // 3. CHARGEMENT DYNAMIQUE DU FORMULAIRE (ASIDE)
    // ==========================================
    const aside = document.getElementById('facture-aside');
    const toggleAsideBtn = document.getElementById('toggleAside');

    if (toggleAsideBtn && aside) {
        toggleAsideBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                const res = await fetch('enregistrefacture.html');
                const html = await res.text();

                aside.innerHTML = html + `
                    <div class="p-4 text-center">
                        <button id="closeAside" class="icon-btn bg-red-600 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-times"></i> Fermer
                        </button>
                    </div>
                `;
                aside.classList.add('open');

                document.getElementById('closeAside').addEventListener('click', () => {
                    aside.classList.remove('open');
                });
            } catch (err) {
                aside.innerHTML = '<p class="p-4 text-red-600">Erreur lors du chargement.</p>';
                aside.classList.add('open');
            }
        });
    }
});