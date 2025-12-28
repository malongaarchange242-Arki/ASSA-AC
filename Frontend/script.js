// ================== Menu actif ==================
const currentPage = window.location.pathname.split("/").pop();
document.querySelectorAll(".nav-menu a").forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === currentPage);
});

// ================== Dashboard ==================
document.addEventListener('DOMContentLoaded', async () => {

    // Base API dynamique
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002') ? origin : 'https://assa-ac-jyn4.onrender.com';
    })();

    // Gestion des tokens
    const TOKEN_KEY = 'jwtTokenAdmin';
    const REFRESH_KEY = 'refreshTokenAdmin';
    let token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        alert("Vous n'êtes pas connecté !");
        window.location.href = 'Index.html';
        return;
    }

    // ================== Sélecteurs des cartes ==================
    const statCards = {
        companies: document.querySelector('.stat-card:nth-child(1) .stat-value'),
        factures: document.querySelector('.stat-card:nth-child(2) .stat-value'),
        contestees: document.querySelector('#facturesContesteesValue') // 👈 AJOUT
    };

    // ================== Refresh Token ==================
    async function refreshToken() {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (!refreshToken) return false;

        try {
            const res = await fetch(`${API_BASE}/api/admins/token/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (!res.ok) throw new Error('Impossible de rafraîchir le token');

            const data = await res.json();

            if (data.token) {
                localStorage.setItem(TOKEN_KEY, data.token);
                token = data.token;
                console.log('Token rafraîchi avec succès !');
                return true;
            }

            return false;

        } catch (err) {
            console.error('Erreur lors du refresh token :', err);
            return false;
        }
    }

    // ================== Fetch sécurisé ==================
    async function fetchWithAuth(url, options = {}) {
        options.headers = {
            ...(options.headers || {}),
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-access-token': token
        };

        let res = await fetch(url, options);

        // Token expiré → on tente un refresh
        if (res.status === 401) {
            console.warn('Token expiré, tentative de rafraîchissement...');
            const refreshed = await refreshToken();

            if (!refreshed) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(REFRESH_KEY);
                alert('Session expirée. Veuillez vous reconnecter.');
                window.location.href = 'login.html';
                throw new Error('Token expiré');
            }

            // Retenter la requête
            options.headers.Authorization = `Bearer ${token}`;
            options.headers['x-access-token'] = token;
            res = await fetch(url, options);
        }

        if (res.status === 403) throw new Error('Accès interdit : permissions insuffisantes');

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Erreur API : ${res.status}`);

        return data;
    }

    // ================== Récupération des compagnies ==================
    async function chargerCompanies() {
        try {
            const data = await fetchWithAuth(`${API_BASE}/api/companies/all`);
            console.log('Données compagnies reçues:', data);

            if (!statCards.companies) return;

            if (Array.isArray(data.companies)) {
                const activeCompanies = data.companies.filter(c =>
                    typeof c.status === 'string' &&
                    c.status.trim().toLowerCase() === 'actif'
                );

                statCards.companies.textContent = activeCompanies.length;
            } else {
                statCards.companies.textContent = '0';
            }

        } catch (err) {
            console.error('Erreur récupération compagnies :', err);
            statCards.companies.textContent = '0';
        }
    }

    // ================== Récupération des factures ==================
    async function chargerFactures() {
        try {
            const factures = await fetchWithAuth(`${API_BASE}/api/factures`);
            console.log('Données factures reçues:', factures);
    
            if (!statCards.factures) return;
    
            // Total factures
            statCards.factures.textContent = Array.isArray(factures) ? factures.length : '0';
    
          // Factures contestées
            if (statCards.contestees) {

                const contestees = Array.isArray(factures)
                    ? factures.filter(f => {
                        const statut = (f.status || "")
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .trim()
                            .toLowerCase();

                        return statut === "contestee";
                    })
                    : [];

                statCards.contestees.textContent = contestees.length;
            }

    
        } catch (err) {
            console.error('Erreur récupération factures :', err);
    
            statCards.factures.textContent = '0';
            if (statCards.contestees) statCards.contestees.textContent = '0';
        }
    }
    
    // ================== Initialisation ==================
    await chargerCompanies();
    await chargerFactures();

    // Rafraîchissement toutes les 10 minutes
    setInterval(async () => {
        await chargerCompanies();
        await chargerFactures();
    }, 600000);
});
