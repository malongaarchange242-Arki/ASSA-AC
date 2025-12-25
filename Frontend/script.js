// ================== Menu actif ==================
const currentPage = window.location.pathname.split("/").pop();
document.querySelectorAll(".nav-menu a").forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === currentPage);
});

// ================== Dashboard ==================
document.addEventListener('DOMContentLoaded', async () => {

    // ================== Base API ==================
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002') ? origin : 'https://assa-ac-jyn4.onrender.com';
    })();

    // ================== Sélecteurs ==================
    const statCards = {
        companies: document.querySelector('.stat-card:nth-child(1) .stat-value'),
        factures: document.querySelector('.stat-card:nth-child(2) .stat-value'),
        contestees: document.querySelector('#facturesContesteesValue')
    };

    // ================== FETCH AVEC COOKIES ==================
    async function fetchWithAuth(url, options = {}) {
        const res = await fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                'Content-Type': 'application/json'
            },
            credentials: 'include' // 🔥 COOKIE JWT
        });

        if (res.status === 401) {
            alert("Session expirée ou non authentifiée.");
            window.location.href = 'Index.html';
            throw new Error('Non authentifié');
        }

        if (res.status === 403) {
            alert("Accès refusé : permissions insuffisantes.");
            throw new Error('Accès interdit');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Erreur API');

        return data;
    }

    // ================== Compagnies ==================
    async function chargerCompanies() {
        try {
            const data = await fetchWithAuth(`${API_BASE}/api/companies/all`);

            if (!statCards.companies) return;

            const activeCompanies = Array.isArray(data.companies)
                ? data.companies.filter(c =>
                    typeof c.status === 'string' &&
                    c.status.trim().toLowerCase() === 'actif'
                )
                : [];

            statCards.companies.textContent = activeCompanies.length;

        } catch (err) {
            console.error('Erreur récupération compagnies :', err);
            statCards.companies.textContent = '0';
        }
    }

    // ================== Factures ==================
    async function chargerFactures() {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/factures`);

        if (!statCards.factures) return;

        // 🔥 EXTRACTION CORRECTE
        const factures = Array.isArray(response)
            ? response
            : Array.isArray(response.factures)
                ? response.factures
                : [];

        // TOTAL
        statCards.factures.textContent = factures.length;

        // CONTESTÉES
        if (statCards.contestees) {
            const contestees = factures.filter(f => {
                const statut = (f.status || '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .trim()
                    .toLowerCase();

                return statut === 'contestee';
            });

            statCards.contestees.textContent = contestees.length;
        }

    } catch (err) {
        console.error('Erreur récupération factures :', err);
        statCards.factures.textContent = '0';
        if (statCards.contestees) statCards.contestees.textContent = '0';
    }
}

    // ================== INIT ==================
    await chargerCompanies();
    await chargerFactures();

    // Rafraîchissement toutes les 10 minutes
    setInterval(async () => {
        await chargerCompanies();
        await chargerFactures();
    }, 600000);
});
