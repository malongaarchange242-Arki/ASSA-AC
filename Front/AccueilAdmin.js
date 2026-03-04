document.addEventListener('DOMContentLoaded', async () => {
    // 1. Référence au bouton de bascule
       const themeToggle = document.getElementById('theme-toggle');
       const body = document.body;
   
       // 2. Fonction pour appliquer le thème
       function applyTheme(theme) {
           if (theme === 'dark') {
               body.classList.add('dark-mode');
               localStorage.setItem('theme', 'dark');
               if (themeToggle) {
                   // Icône Soleil pour passer au mode clair
                   themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                   themeToggle.title = "Passer au Mode Clair";
               }
           } else {
               body.classList.remove('dark-mode');
               localStorage.setItem('theme', 'light');
               if (themeToggle) {
                   // Icône Lune pour passer au mode sombre
                   themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                   themeToggle.title = "Passer au Mode Sombre";
               }
           }
       }
   
       // 3. Détecter et appliquer le thème au chargement
       const savedTheme = localStorage.getItem('theme');
       if (savedTheme) {
           applyTheme(savedTheme);
       } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
           // Utiliser la préférence système si aucune n'est enregistrée
           applyTheme('dark');
       } else {
           applyTheme('light'); // Par défaut au mode clair
       }
   
       // 4. Écouteur d'événement pour le basculement
       if (themeToggle) {
           themeToggle.addEventListener('click', () => {
               const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
               const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
               applyTheme(newTheme);
           });
       }
   });
   

document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002') ? origin : 'https://assa-ac-jyn4.onrender.com';
    })();

    const adminTokenKey = 'jwtTokenAdmin';
    const adminRefreshKey = 'refreshTokenAdmin';
    const companyTokenKey = 'jwtTokenCompany';
    const companyRefreshKey = 'refreshTokenCompany';

    let token = localStorage.getItem(adminTokenKey) || localStorage.getItem(companyTokenKey);
    let refreshKey = localStorage.getItem(adminTokenKey) ? adminRefreshKey : companyRefreshKey;
    let role = localStorage.getItem(adminTokenKey)
        ? 'admin'
        : localStorage.getItem(companyTokenKey)
        ? 'company'
        : null;

    let userEmail =
        role === 'admin'
            ? localStorage.getItem('userEmailAdmin')
            : localStorage.getItem('userEmailCompany');

    if (!token || !role) {
        alert("Vous n'êtes pas connecté !");
        window.location.href = 'login.html';
        return;
    }

    // Affichage utilisateur
    const userNameSpan = document.getElementById('user-name');
    if (userNameSpan) {
        userNameSpan.innerHTML = `${userEmail || 'Utilisateur'} <i class="fas fa-caret-down"></i>`;
    }

    // =========================
    // REFRESH TOKEN
    // =========================
    async function refreshToken() {
        const refreshToken = localStorage.getItem(refreshKey);
        if (!refreshToken || role !== 'admin') return false;

        try {
            const res = await fetch(`${API_BASE}/api/admins/token/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            const newToken = data.token || data.accessToken || data.access_token;
            if (!newToken) throw new Error('Token manquant');

            localStorage.setItem(adminTokenKey, newToken);
            token = newToken;
            return true;
        } catch (err) {
            console.error('Erreur refresh token :', err);
            return false;
        }
    }

    // =========================
    // FETCH AUTH
    // =========================
    async function fetchAuth(url, options = {}) {
        if (!token) throw new Error('Token manquant');

        options.headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-access-token': token
        };

        let res = await fetch(url, options);

        if (res.status === 401) {
            const refreshed = await refreshToken();
            if (!refreshed) throw new Error('Session expirée');

            options.headers.Authorization = `Bearer ${token}`;
            options.headers['x-access-token'] = token;
            res = await fetch(url, options);
        }

        if (res.status === 403) throw new Error('Accès interdit');

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Erreur HTTP ${res.status}`);

        return data;
    }
});
