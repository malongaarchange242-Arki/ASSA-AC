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
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return 'http://localhost:5002';
        }
        return 'http://localhost:5002';
    })();

    // Gestion des tokens — accepter également le token du superviseur
    const TOKEN_CANDIDATES = ['jwtTokenAdmin', 'jwtTokenSuperviseur', 'jwtToken'];
    // Choisit la première clé existante dans localStorage (ordre de priorité ci-dessus)
    const TOKEN_KEY = TOKEN_CANDIDATES.find(k => localStorage.getItem(k)) || 'jwtTokenAdmin';
    // Détermine la clé de refresh associée (superviseur vs admin)
    const REFRESH_KEY = TOKEN_KEY === 'jwtTokenSuperviseur' ? 'refreshTokenSuperviseur' : 'refreshTokenAdmin';
    let token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        alert(t('dashboard_not_connected'));
        window.location.href = 'Index.html';
        return;
    }

    // ================== Sélecteurs des cartes ==================
    const statCards = {
        companies: document.querySelector('.stat-card:nth-child(1) .stat-value'),
        factures: document.querySelector('.stat-card:nth-child(2) .stat-value'),
        contestees: document.querySelector('#facturesContesteesValue') // 👈 AJOUT
    };
    const dashboardError = document.getElementById('dashboard-load-error');
    const dashboardFailures = new Map();

    function renderDashboardFailure() {
        if (!dashboardError) return;
        dashboardError.hidden = dashboardFailures.size === 0;
        dashboardError.replaceChildren();
        if (dashboardError.hidden) return;

        const items = [...dashboardFailures.values()].map(message => t(message)).join(' ; ');
        dashboardError.append(document.createTextNode(
            t('dashboard_load_partial').replace('{items}', items) + ' '
        ));
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.textContent = t('dashboard_retry');
        retryButton.addEventListener('click', async () => {
            dashboardError.hidden = true;
            await Promise.all([chargerCompanies(), chargerFactures()]);
        });
        dashboardError.appendChild(retryButton);
    }

    function updateDashboardFailure(key, message) {
        if (message) dashboardFailures.set(key, message);
        else dashboardFailures.delete(key);
        renderDashboardFailure();
    }

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
                alert(t('dashboard_session_expired'));
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

    // Like fetchWithAuth but returns both parsed JSON and the Response object
    async function fetchWithAuthFull(url, options = {}) {
        options.headers = {
            ...(options.headers || {}),
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-access-token': token
        };

        let res = await fetch(url, options);

        if (res.status === 401) {
            const refreshed = await refreshToken();
            if (!refreshed) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(REFRESH_KEY);
                alert(t('dashboard_session_expired'));
                window.location.href = 'login.html';
                throw new Error('Token expiré');
            }
            options.headers.Authorization = `Bearer ${token}`;
            options.headers['x-access-token'] = token;
            res = await fetch(url, options);
        }

        if (res.status === 403) throw new Error('Accès interdit : permissions insuffisantes');

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Erreur API : ${res.status}`);

        return { data, res };
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
            statCards.companies.classList.remove('admin-skeleton');
            statCards.companies.removeAttribute('title');
            statCards.companies.removeAttribute('aria-label');
            delete statCards.companies.dataset.errorI18n;
            updateDashboardFailure('companies', null);

        } catch (err) {
            console.error('Erreur récupération compagnies :', err);
            if (statCards.companies) {
                statCards.companies.textContent = '—';
                statCards.companies.classList.remove('admin-skeleton');
                statCards.companies.dataset.errorI18n = 'dashboard_error_company_load';
                statCards.companies.title = t('dashboard_error_company_load');
                statCards.companies.setAttribute('aria-label', t('dashboard_error_company_load'));
                if (!dashboardError) statCards.companies.textContent = '0';
            }
            updateDashboardFailure('companies', 'dashboard_error_companies');
        }
    }

    // ================== Récupération des factures ==================
    async function chargerFactures() {
        try {
            const full = await fetchWithAuthFull(`${API_BASE}/api/factures`);
            const factures = full.data;
            const resp = full.res;
            console.log('Données factures reçues:', factures, 'resp.url:', resp.url, 'status:', resp.status);
            console.log('Header x-total-count:', resp.headers.get('x-total-count'));
            // Log all response headers for debugging
            try {
                Array.from(resp.headers.entries()).forEach(h => console.log('header:', h[0], h[1]));
            } catch (e) {
                console.warn('Impossible de lister headers:', e);
            }

            if (!statCards.factures) return;

            // Robustly extract array of invoices from various possible API shapes
            const extractArray = (raw) => {
                if (Array.isArray(raw)) return raw;
                if (!raw || typeof raw !== 'object') return [];
                const candidates = ['factures', 'data', 'rows', 'items', 'results'];
                for (const k of candidates) if (Array.isArray(raw[k])) return raw[k];
                // fallback: find first array value in object
                for (const key of Object.keys(raw)) if (Array.isArray(raw[key])) return raw[key];
                return [];
            };

            const facturesArr = extractArray(factures);
            console.log('facturesArr.length:', facturesArr.length, 'sample:', (Array.isArray(facturesArr) ? facturesArr.slice(0,5) : facturesArr));
            // Prefer X-Total-Count header, then explicit total in body, then array length
            const headerTotal = resp.headers.get('x-total-count');
            const totalFromBody = (factures && typeof factures.total === 'number') ? factures.total : null;
            const count = headerTotal ? Number(headerTotal) : (totalFromBody !== null ? totalFromBody : facturesArr.length);
            console.log('Computed counts -> headerTotal:', headerTotal, 'totalFromBody:', totalFromBody, 'finalCount:', count);

            const finalText = (Number.isFinite(count) ? String(count) : String(facturesArr.length || '0'));
            console.log('Setting statCards.factures -> element:', statCards.factures, 'value:', finalText);
            statCards.factures.textContent = finalText;
            statCards.factures.classList.remove('admin-skeleton');
            statCards.factures.removeAttribute('title');
            statCards.factures.removeAttribute('aria-label');
            delete statCards.factures.dataset.errorI18n;
            // Check if something overwrites the value shortly after
            setTimeout(() => console.log('After 1s statCards.factures.textContent:', statCards.factures ? statCards.factures.textContent : 'no-element'), 1000);
            setTimeout(() => console.log('After 3s statCards.factures.textContent:', statCards.factures ? statCards.factures.textContent : 'no-element'), 3000);
    
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
                statCards.contestees.classList.remove('admin-skeleton');
                statCards.contestees.removeAttribute('title');
                statCards.contestees.removeAttribute('aria-label');
                delete statCards.contestees.dataset.errorI18n;
            }
            updateDashboardFailure('factures', null);

    
        } catch (err) {
            console.error('Erreur récupération factures :', err);
    
            if (statCards.factures) {
                statCards.factures.textContent = '—';
                statCards.factures.classList.remove('admin-skeleton');
                statCards.factures.dataset.errorI18n = 'dashboard_error_invoice_load';
                statCards.factures.title = t('dashboard_error_invoice_load');
                statCards.factures.setAttribute('aria-label', t('dashboard_error_invoice_load'));
                if (!dashboardError) statCards.factures.textContent = '0';
            }
            if (statCards.contestees) {
                statCards.contestees.textContent = '—';
                statCards.contestees.classList.remove('admin-skeleton');
                statCards.contestees.dataset.errorI18n = 'dashboard_error_disputed_load';
                statCards.contestees.title = t('dashboard_error_disputed_load');
                statCards.contestees.setAttribute('aria-label', t('dashboard_error_disputed_load'));
                if (!dashboardError) statCards.contestees.textContent = '0';
            }
            updateDashboardFailure('factures', 'dashboard_error_invoices');
        }
    }

    window.addEventListener('app-language-change', () => {
        renderDashboardFailure();
        document.querySelectorAll('[data-error-i18n]').forEach(element => {
            const message = t(element.dataset.errorI18n);
            element.title = message;
            element.setAttribute('aria-label', message);
        });
    });
    
    // ================== Initialisation ==================
    await chargerCompanies();
    await chargerFactures();

    // Rafraîchissement toutes les 10 minutes
    setInterval(async () => {
        await chargerCompanies();
        await chargerFactures();
    }, 600000);
});