// ================== Menu actif ==================
const currentPage = window.location.pathname.split("/").pop();
document.querySelectorAll(".nav-menu a").forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === currentPage);
});

// ================== Dashboard ==================
document.addEventListener('DOMContentLoaded', async () => {

    const TOKEN_KEY = 'jwtTokenAdmin';
    const REFRESH_KEY = 'refreshTokenAdmin';
    let token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        alert("Vous n'êtes pas connecté !");
        window.location.href = 'login.html';
        return;
    }

    // ================== Sélecteurs des cartes statistiques ==================
    const statCards = {
        companies: document.querySelector('.stat-card:nth-child(1) .stat-value'),
        factures: document.querySelector('.stat-card:nth-child(2) .stat-value')
    };

    // ===== Fonction pour rafraîchir le token =====
    async function refreshToken() {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (!refreshToken) return false;

        try {
            const res = await fetch('https://assa-ac.onrender.com/api/admins/token/refresh', {
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

    // ===== Fetch sécurisé avec gestion automatique du token =====
    async function fetchWithAuth(url, options = {}) {
        if (!options.headers) options.headers = {};
        options.headers['Content-Type'] = 'application/json';
        options.headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch(url, options);

        if (res.status === 401) {
            console.warn('Token expiré ou invalide, tentative de rafraîchissement...');
            const refreshed = await refreshToken();
            if (!refreshed) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(REFRESH_KEY);
                alert('Token expiré. Veuillez vous reconnecter.');
                window.location.href = 'login.html';
                throw new Error('Token expiré');
            }
            options.headers['Authorization'] = `Bearer ${token}`;
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
            const data = await fetchWithAuth('https://assa-ac.onrender.com/api/companies/all');
            console.log('Données compagnies reçues:', data);

            if (!statCards.companies) {
                console.warn('Élément stat-card pour les compagnies introuvable');
                return;
            }

            if (Array.isArray(data.companies)) {
                const activeCompanies = data.companies.filter(c =>
                    typeof c.status === 'string' && c.status.trim().toLowerCase() === 'actif'
                );
                statCards.companies.textContent = activeCompanies.length;
            } else {
                statCards.companies.textContent = '0';
            }
        } catch (err) {
            console.error('Impossible de récupérer les compagnies actives :', err);
            if (statCards.companies) statCards.companies.textContent = '0';
        }
    }

    // ================== Récupération des factures ==================
    async function chargerFactures() {
        try {
            const factures = await fetchWithAuth('https://assa-ac.onrender.com/api/factures');
            console.log('Données factures reçues:', factures);

            if (!statCards.factures) {
                console.warn('Élément stat-card pour les factures introuvable');
                return;
            }

            statCards.factures.textContent = Array.isArray(factures) ? factures.length : '0';
        } catch (err) {
            console.error('Impossible de récupérer les factures :', err);
            if (statCards.factures) statCards.factures.textContent = '0';
        }
    }

    // ================== Initialisation ==================
    await chargerCompanies();
    await chargerFactures();

    // Rafraîchir les stats toutes les 10 minutes
    setInterval(async () => {
        await chargerCompanies();
        await chargerFactures();
    }, 600000); // 600000ms = 10 minutes

});
