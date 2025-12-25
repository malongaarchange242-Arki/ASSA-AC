/* =========================================================
   🌗 THEME (inchangé – OK avec localStorage)
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
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
            const current = body.classList.contains('dark-mode') ? 'dark' : 'light';
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });
    }
});

/* =========================================================
   🔐 AUTH COOKIE-BASED
========================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002')
            ? origin
            : 'https://assa-ac-jyn4.onrender.com';
    })();

    /* -----------------------------------------
       👤 Vérifier session via cookie
    ------------------------------------------ */
    async function checkSession() {
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                method: 'GET',
                credentials: 'include' // 🔥 OBLIGATOIRE POUR COOKIES
            });

            if (!res.ok) throw new Error('Non authentifié');

            return await res.json();
        } catch (err) {
            return null;
        }
    }

    const user = await checkSession();

    if (!user) {
        alert("Session expirée, veuillez vous reconnecter.");
        window.location.href = 'login.html';
        return;
    }

    /* -----------------------------------------
       🧑 Affichage utilisateur
    ------------------------------------------ */
    const userNameSpan = document.getElementById('user-name');
    if (userNameSpan) {
        userNameSpan.innerHTML = `${user.email || 'Utilisateur'} <i class="fas fa-caret-down"></i>`;
    }

    /* -----------------------------------------
       🔄 FETCH AUTH (cookie only)
    ------------------------------------------ */
    window.fetchAuth = async (url, options = {}) => {
        const res = await fetch(url, {
            ...options,
            credentials: 'include', // ✅ cookie envoyé automatiquement
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        if (res.status === 401) {
            alert('Session expirée');
            window.location.href = 'login.html';
            throw new Error('Non authentifié');
        }

        if (res.status === 403) {
            throw new Error('Accès interdit');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || `Erreur ${res.status}`);
        }

        return data;
    };
});

/* =========================================================
   📂 ASIDE (inchangé)
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
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
                        <button id="closeAside"
                            class="icon-btn bg-red-600 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-times"></i> Fermer
                        </button>
                    </div>
                `;
                aside.classList.add('open');

                document.getElementById('closeAside')
                    .addEventListener('click', () => aside.classList.remove('open'));
            } catch {
                aside.innerHTML = '<p class="p-4 text-red-600">Erreur de chargement.</p>';
                aside.classList.add('open');
            }
        });
    }
});
