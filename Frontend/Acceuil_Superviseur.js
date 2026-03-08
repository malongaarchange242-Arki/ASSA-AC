// ================== Menu actif ==================
(function() {
    const currentPage = window.location.pathname.split("/").pop();
    document.querySelectorAll(".nav-menu a").forEach(link => {
        link.classList.toggle("active", link.getAttribute("href") === currentPage);
    });
})();

// ================== Dashboard ==================
document.addEventListener('DOMContentLoaded', async () => {

    // Base API dynamique
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002') ? origin : 'https://assa-ac-duzn.onrender.com';
    })();

    // Gestion des tokens
    const TOKEN_KEY = 'jwtTokenSuperviseur';
    // Le refresh token pour le superviseur est stocké sous 'refreshTokenSuperviseur'
    const REFRESH_KEY = 'refreshTokenSuperviseur';
    let token = localStorage.getItem(TOKEN_KEY);

    // Diagnostic: afficher rapidement les clés locales utiles (débogage)
    console.log('Auth keys:', {
        jwtTokenSuperviseur: localStorage.getItem('jwtTokenSuperviseur'),
        jwtTokenAdmin: localStorage.getItem('jwtTokenAdmin'),
        jwtToken: localStorage.getItem('jwtToken'),
        refreshTokenSuperviseur: localStorage.getItem('refreshTokenSuperviseur'),
        refreshTokenAdmin: localStorage.getItem('refreshTokenAdmin')
    });

    if (!token) {
        alert(t('not_connected'));
        window.location.href = 'Index.html';
        return;
    }

    // ================== Sélecteurs des cartes ==================
    // On prend explicitement les 4 cartes présentes dans le HTML
    const statCards = {
        companies: document.querySelector('.stat-card:nth-child(1) .stat-value'),
        factures: document.querySelector('.stat-card:nth-child(2) .stat-value'),
        contestees: document.querySelector('.stat-card:nth-child(3) .stat-value'),
        validated: document.querySelector('.stat-card:nth-child(4) .stat-value')
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
                alert(t('session_expired'));
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

            // Use reported total when available, otherwise fall back to the companies array length
            const companiesArr = Array.isArray(data.companies) ? data.companies : (Array.isArray(data) ? data : []);
            if (companiesArr.length) {
                statCards.companies.textContent = (typeof data.total === 'number' && data.total >= 0) ? data.total : companiesArr.length;
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
            const raw = await fetchWithAuth(`${API_BASE}/api/factures`);
            console.log('Données factures reçues:', raw);

            if (!statCards.factures) return;

            // L'API peut retourner directement un tableau ou un objet contenant le tableau
            const facturesArr = Array.isArray(raw)
                ? raw
                : (Array.isArray(raw.factures) ? raw.factures : (Array.isArray(raw.data) ? raw.data : []));

            statCards.factures.textContent = facturesArr.length || '0';

            // Normalisation utilitaire (supprime accents et met en lowercase)
            const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

            if (statCards.contestees) {
                const contestees = facturesArr.filter(f => {
                    const statut = normalize(f.statut || f.status || f.etat || f.state);
                    return statut.includes('contest'); // couvre 'contestee' / 'contestée'
                });
                statCards.contestees.textContent = contestees.length;
            }

            if (statCards.validated) {
                const valides = facturesArr.filter(f => {
                    const statut = normalize(f.statut || f.status || f.etat || f.state);
                    return statut.includes('pay'); // couvre 'payee', 'payée', 'pay'
                });
                statCards.validated.textContent = valides.length;
            }

        } catch (err) {
            console.error('Erreur récupération factures :', err);

            statCards.factures.textContent = '0';
            if (statCards.contestees) statCards.contestees.textContent = '0';
            if (statCards.validated) statCards.validated.textContent = '0';
        }
    }
    
    // ================== Récupération du journal d'activités ==================
    async function chargerActivites() {
        const tbody = document.querySelector('.ops-table tbody');
        if (!tbody) return;

        const formatDate = (dstr) => {
            if (!dstr) return '-';
            // Try to make the string ISO-compatible then format
            try {
                const iso = dstr.replace(' ', 'T');
                const d = new Date(iso);
                if (isNaN(d)) return dstr;
                return d.toLocaleString();
            } catch (e) {
                return dstr;
            }
        };

        try {
            // Prefer recent activities endpoint (lighter)
            let data = await fetchWithAuth(`${API_BASE}/api/journal/recent`).catch(() => null);
            if (!data || (Array.isArray(data) && data.length === 0) || (data && Array.isArray(data.activites) && data.activites.length === 0)) {
                // fallback to full journal
                data = await fetchWithAuth(`${API_BASE}/api/journal`);
            }
            console.log('Activités reçues:', data);

            const list = Array.isArray(data)
                ? data
                : (Array.isArray(data.activites) ? data.activites : (Array.isArray(data.activities) ? data.activities : (Array.isArray(data.data) ? data.data : [])));

            tbody.innerHTML = '';
            if (!list || list.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align:center">Aucune activité trouvée</td>
                    </tr>`;
                return;
            }

            // Afficher seulement les N dernières entrées pour éviter d'inonder l'UI
            const MAX = 10;
            const display = list.slice(0, MAX);

            display.forEach(item => {
                const tr = document.createElement('tr');

                const agent = item.utilisateur_nom || item.utilisateur_email || item.admin_name || item.created_by_name || item.user_name || item.user || item.admin || item.actor || item.username || item.name || item.id_admin || item.id_user || item.created_by || '-';

                const action = item.type_activite || item.action || item.type || item.event || item.verb || '-';

                const cible = item.reference || item.ref || item.numero_facture || item.numero || item.target || (item.id_companie || item.id || item.description) || '-';

                const rawDate = item.date_activite || item.created_at || item.createdAt || item.date || item.timestamp || item.when || item.datetime || '-';
                const date = formatDate(rawDate);

                tr.innerHTML = `
                    <td>${agent}</td>
                    <td>${action}</td>
                    <td>${cible}</td>
                    <td>${date}</td>
                `;

                // Attach click handler to open detail panel (keeps behavior working for dynamically added rows)
                tr.addEventListener('click', () => {
                    const detAgent = document.getElementById('det-agent');
                    const detAction = document.getElementById('det-action');
                    const detId = document.getElementById('det-id');
                    const detDate = document.getElementById('det-date');
                    const detailPanel = document.getElementById('detailPanel');

                    if (detAgent) detAgent.innerText = agent;
                    if (detAction) detAction.innerText = action;
                    if (detId) detId.innerText = cible;
                    if (detDate) detDate.innerText = date;
                    if (detailPanel) detailPanel.classList.add('open');
                });

                tbody.appendChild(tr);
            });

        } catch (err) {
            console.error('Erreur récupération activités :', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center">Erreur lors du chargement du journal</td>
                </tr>`;
        }
    }

    // ================== Initialisation ==================
    await chargerCompanies();
    await chargerFactures();
    await chargerActivites();

    // Rafraîchissement toutes les 10 minutes
    setInterval(async () => {
        await chargerCompanies();
        await chargerFactures();
        await chargerActivites();
    }, 600000);
});


document.addEventListener('DOMContentLoaded', () => {

    // 1. THEME TOGGLE
    const toggle = document.getElementById('toggleTheme');
    const themeIcon = toggle.querySelector('i');

    const updateThemeUI = (isDark) => {
        document.body.classList.toggle('dark-mode', isDark);
        themeIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    };

    if (localStorage.getItem('theme') === 'dark') updateThemeUI(true);

    toggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeUI(isDark);
    });

    // 2. ANIMATION DES COMPTEURS
    const counters = document.querySelectorAll('.stat-value');
    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const duration = 1000;
        const increment = target / (duration / 16);
        let current = 0;

        const update = () => {
            current += increment;
            if (current < target) {
                counter.innerText = Math.ceil(current).toLocaleString();
                requestAnimationFrame(update);
            } else {
                counter.innerText = target.toLocaleString();
            }
        };
        update();
    });

    // 3. PANNEAU DE DÉTAILS
    const detailPanel = document.getElementById('detailPanel');
    const closeDetail = document.getElementById('closeDetail');
    const rows = document.querySelectorAll('.ops-table tbody tr');

    rows.forEach(row => {
        row.addEventListener('click', () => {
            const cells = row.querySelectorAll('td');
            document.getElementById('det-agent').innerText = cells[0].innerText;
            document.getElementById('det-action').innerText = cells[1].innerText;
            document.getElementById('det-id').innerText = cells[2].innerText;
            document.getElementById('det-date').innerText = cells[3].innerText;
            detailPanel.classList.add('open');
        });
    });

    closeDetail.addEventListener('click', () => {
        detailPanel.classList.remove('open');
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll('.nav a');

    navLinks.forEach(link => {
        // On retire la classe active partout
        link.parentElement.classList.remove('active');

        // Si le href du lien correspond au nom du fichier actuel
        if (link.getAttribute('href') === currentPath) {
            link.parentElement.classList.add('active');
        }
    });
});

