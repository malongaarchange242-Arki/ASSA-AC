// ==========================================================================
// ASSA-AC - SUPERVISOR DASHBOARD (LOGIQUE MÉTIER & INTERFACE MODERNE)
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {

    // 1. Détection dynamique de l'API Base
    const API_BASE = (() => {
        const origin = window.location.origin;
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return 'http://localhost:5002';
        }
        return 'http://localhost:5002';
    })();

    // 2. Gestion des tokens d'authentification
    const TOKEN_KEY = 'jwtTokenSuperviseur';
    const REFRESH_KEY = 'refreshTokenSuperviseur';
    let token = localStorage.getItem(TOKEN_KEY);

    // Fonction de traduction sécurisée
    const getTranslation = (key, fallback = '') => {
        if (typeof window.t === 'function') {
            const res = window.t(key);
            if (res && res !== key) return res;
        }
        return fallback || key;
    };

    if (!token) {
        alert(getTranslation('dashboard_not_connected', 'Vous n’êtes pas connecté !'));
        window.location.href = 'Index.html';
        return;
    }

    // Références des cartes de statistiques
    const statCards = {
        companies: document.querySelector('[data-stat="companies"]'),
        factures: document.querySelector('[data-stat="invoices"]'),
        contestees: document.querySelector('[data-stat="disputes"]'),
        validated: document.querySelector('[data-stat="validated"]')
    };

    const statFailures = new Set();
    const statFailureLabels = {
        companies: 'dashboard_error_companies',
        invoices: 'dashboard_error_invoices'
    };

    function setStatValue(key, value, errorKey) {
        const element = statCards[key];
        if (!element) return;
        const card = element.closest('.stat-card');
        element.textContent = value;
        if (card) card.setAttribute('aria-busy', 'false');

        if (errorKey) statFailures.add(errorKey);
        else if (key === 'companies') statFailures.delete('companies');
        else if (['factures', 'contestees', 'validated'].includes(key)) statFailures.delete('invoices');

        const status = document.getElementById('statsLoadStatus');
        if (!status) return;
        if (statFailures.size) {
            const labels = Array.from(statFailures, failure => getTranslation(statFailureLabels[failure], failure));
            status.textContent = getTranslation('dashboard_load_partial', 'Certaines statistiques n’ont pas pu être chargées ({items}).').replace('{items}', labels.join(', '));
            status.hidden = false;
        } else {
            status.textContent = '';
            status.hidden = true;
        }
    }

    // 3. Rafraîchissement automatique du Token JWT
    async function refreshToken() {
        const refreshTokenValue = localStorage.getItem(REFRESH_KEY);
        if (!refreshTokenValue) return false;

        try {
            const res = await fetch(`${API_BASE}/api/admins/token/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: refreshTokenValue })
            });

            if (!res.ok) throw new Error('Impossible de rafraîchir le token');

            const data = await res.json();
            if (data.token) {
                localStorage.setItem(TOKEN_KEY, data.token);
                token = data.token;
                console.log('Token rafraîchi avec succès');
                return true;
            }
            return false;
        } catch (err) {
            console.error('Erreur lors du refresh token :', err);
            return false;
        }
    }

    // 4. Fetch authentifié sécurisé
    async function fetchWithAuth(url, options = {}) {
        options.headers = {
            ...(options.headers || {}),
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-access-token': token
        };

        let res = await fetch(url, options);

        if (res.status === 401) {
            console.warn('Token expiré, tentative de renouvellement...');
            const refreshed = await refreshToken();

            if (!refreshed) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(REFRESH_KEY);
                alert(getTranslation('session_expired', 'Session expirée. Veuillez vous reconnecter.'));
                window.location.href = 'Index.html';
                throw new Error('Token expiré');
            }

            options.headers.Authorization = `Bearer ${token}`;
            options.headers['x-access-token'] = token;
            res = await fetch(url, options);
        }

        if (res.status === 403) throw new Error('Accès interdit : permissions insuffisantes');

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Erreur API : ${res.status}`);

        return data;
    }

    // 5. Récupération des statistiques des compagnies
    async function chargerCompanies() {
        try {
            const data = await fetchWithAuth(`${API_BASE}/api/companies/all`);
            if (!statCards.companies) return;

            const companiesArr = Array.isArray(data.companies) ? data.companies : (Array.isArray(data) ? data : []);
            const total = typeof data.total === 'number' && data.total >= 0 ? data.total : companiesArr.length;
            setStatValue('companies', total.toLocaleString());
        } catch (err) {
            console.error('Erreur récupération compagnies :', err);
            setStatValue('companies', '—', 'companies');
        }
    }

    // 6. Récupération des factures, contestations et factures validées
    async function chargerFactures() {
        try {
            const raw = await fetchWithAuth(`${API_BASE}/api/factures`);
            if (!statCards.factures) return;

            const facturesArr = Array.isArray(raw)
                ? raw
                : (Array.isArray(raw.factures) ? raw.factures : (Array.isArray(raw.data) ? raw.data : []));

            setStatValue('factures', facturesArr.length.toLocaleString());

            const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

            if (statCards.contestees) {
                const contestees = facturesArr.filter(f => {
                    const statut = normalize(f.statut || f.status || f.etat || f.state);
                    return statut.includes('contest');
                });
                setStatValue('contestees', contestees.length.toLocaleString());
            }

            if (statCards.validated) {
                const valides = facturesArr.filter(f => {
                    const statut = normalize(f.statut || f.status || f.etat || f.state);
                    return statut.includes('pay') || statut.includes('valide');
                });
                setStatValue('validated', valides.length.toLocaleString());
            }
        } catch (err) {
            console.error('Erreur récupération factures :', err);
            setStatValue('factures', '—', 'invoices');
            setStatValue('contestees', '—', 'invoices');
            setStatValue('validated', '—', 'invoices');
        }
    }

    // 7. Palette de couleurs stables pour les avatars d'agents
    const avatarColorPalette = [
        { bg: '#dbeafe', text: '#1e40af' }, // Bleu
        { bg: '#ede9fe', text: '#5b21b6' }, // Violet
        { bg: '#fce7f3', text: '#9d174d' }, // Rose
        { bg: '#d1fae5', text: '#065f46' }, // Émeraude
        { bg: '#fef3c7', text: '#92400e' }, // Ambre
        { bg: '#e0f2fe', text: '#075985' }  // Cyan
    ];

    function getAvatarColors(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % avatarColorPalette.length;
        return avatarColorPalette[index];
    }

    function getInitials(name) {
        if (!name || name === '—') return 'AG';
        const clean = name.replace(/[^\w\s-]/gi, '').trim();
        const parts = clean.split(/[\s-]+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return clean.slice(0, 2).toUpperCase() || 'AG';
    }

    // 8. Gestion et affichage du Journal des Activités
    let allActivitiesList = [];

    const formatDate = value => {
        if (!value) return '—';
        const date = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat(localStorage.getItem('lang') === 'en' ? 'en-GB' : 'fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(date);
    };

    function renderActivities(list) {
        const tbody = document.querySelector('.ops-table tbody');
        const countBadge = document.getElementById('activityCount');
        if (!tbody) return;

        tbody.setAttribute('aria-busy', 'false');
        tbody.replaceChildren();

        if (countBadge) {
            countBadge.textContent = `${list.length} ${getTranslation('items', 'activités')}`;
        }

        if (!list || list.length === 0) {
            const tr = document.createElement('tr');
            tr.className = 'activity-message-row';
            const td = document.createElement('td');
            td.colSpan = 5;
            td.textContent = getTranslation('no_activity_match', 'Aucune activité trouvée');
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        const getText = (value, fallback = '—') => {
            if (value === null || value === undefined || value === '') return fallback;
            return typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value);
        };

        list.forEach(item => {
            const tr = document.createElement('tr');

            const agent = getText(item.utilisateur || item.utilisateur_nom || item.admin_name || item.created_by_name || item.user_name || item.user || item.admin || item.actor || item.username || item.name || item.utilisateur_email || item.id_admin || item.id_user || item.created_by);
            const action = getText(item.type_activite || item.action || item.type || item.event || item.verb);
            const isLogin = /^(login|connexion|sign.?in)$/i.test(String(item.type_activite || item.action || item.type || '').trim()) ||
                String(item.module || '').toLowerCase().includes('login');
            const cible = getText(
                item.cible || item.reference || item.ref || item.numero_facture || item.numero ||
                item.target || (isLogin ? item.utilisateur_email || item.utilisateur || item.utilisateur_nom : null) ||
                item.company_name || item.description
            );
            const rawDate = item.date_activite || item.created_at || item.createdAt || item.date || item.timestamp || item.when || item.datetime;
            const date = formatDate(rawDate);

            // Déduction du rôle de l'agent
            let role = item.role || item.role_utilisateur;
            if (!role) {
                const normAgent = agent.toLowerCase();
                if (item.id_admin || normAgent.includes('admin')) role = 'Administrateur';
                else if (/operateur|operator/.test(`${item.categorie || ''} ${item.module || ''} ${normAgent}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())) role = 'Opérateur';
                else if (item.id_company || normAgent.includes('compagnie') || normAgent.includes('air') || normAgent.includes('ecair')) role = 'Compagnie';
                else if (normAgent.includes('system') || normAgent.includes('système')) role = 'Système';
                else role = 'Agent';
            }

            // Normalisation de l'action et détermination de l'icône & style
            const normalizedAction = action.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            let actionClass = 'neutral';
            let actionIcon = 'fa-solid fa-circle-info';

            if (/creation|created|create/.test(normalizedAction)) {
                actionClass = 'created';
                actionIcon = 'fa-solid fa-plus';
            } else if (/suppression|deletion|deleted|delete/.test(normalizedAction)) {
                actionClass = 'deleted';
                actionIcon = 'fa-solid fa-trash-can';
            } else if (/modification|update|updated/.test(normalizedAction)) {
                actionClass = 'updated';
                actionIcon = 'fa-solid fa-pen-to-square';
            } else if (/connexion|login|sign.?in/.test(normalizedAction)) {
                actionClass = 'login';
                actionIcon = 'fa-solid fa-arrow-right-to-bracket';
            } else if (/validation|validated|approved|valide/.test(normalizedAction)) {
                actionClass = 'validated';
                actionIcon = 'fa-solid fa-check';
            } else if (/rejet|rejected/.test(normalizedAction)) {
                actionClass = 'rejected';
                actionIcon = 'fa-solid fa-xmark';
            }

            // 1. Colonne Admin / Agent (Avatar + Nom + Rôle)
            const tdAgent = document.createElement('td');
            const agentCell = document.createElement('div');
            agentCell.className = 'agent-cell-content';

            const initials = getInitials(agent);
            const colors = getAvatarColors(agent);
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'agent-avatar';
            avatarDiv.textContent = initials;
            avatarDiv.style.backgroundColor = colors.bg;
            avatarDiv.style.color = colors.text;

            const agentInfo = document.createElement('div');
            agentInfo.className = 'agent-info';
            const agentNameSpan = document.createElement('span');
            agentNameSpan.className = 'agent-name';
            agentNameSpan.textContent = agent;
            const agentRoleSpan = document.createElement('span');
            agentRoleSpan.className = 'agent-role';
            agentRoleSpan.textContent = role;

            agentInfo.appendChild(agentNameSpan);
            agentInfo.appendChild(agentRoleSpan);
            agentCell.appendChild(avatarDiv);
            agentCell.appendChild(agentInfo);
            tdAgent.appendChild(agentCell);

            // 2. Colonne Action (Badge avec icône)
            const tdAction = document.createElement('td');
            const actionBadge = document.createElement('span');
            actionBadge.className = `activity-badge is-${actionClass}`;
            actionBadge.innerHTML = `<i class="${actionIcon}"></i><span>${action}</span>`;
            tdAction.appendChild(actionBadge);

            // 3. Colonne Cible
            const tdTarget = document.createElement('td');
            const targetDiv = document.createElement('div');
            targetDiv.className = 'activity-target-text';
            targetDiv.textContent = cible;
            targetDiv.title = cible;
            tdTarget.appendChild(targetDiv);

            // 4. Colonne Date
            const tdDate = document.createElement('td');
            const dateSpan = document.createElement('span');
            dateSpan.className = 'activity-date-text';
            dateSpan.textContent = date;
            tdDate.appendChild(dateSpan);

            // 5. Colonne Détails (...)
            const tdActions = document.createElement('td');
            const moreBtn = document.createElement('button');
            moreBtn.type = 'button';
            moreBtn.className = 'activity-more-btn';
            moreBtn.setAttribute('aria-label', getTranslation('see_details', 'Voir les détails'));
            moreBtn.title = getTranslation('see_details', 'Voir les détails');
            moreBtn.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
            tdActions.appendChild(moreBtn);

            // Ouvrir les détails
            const openDetails = () => {
                const detAgent = document.getElementById('det-agent');
                const detAction = document.getElementById('det-action');
                const detId = document.getElementById('det-id');
                const detDate = document.getElementById('det-date');
                const detailPanel = document.getElementById('detailPanel');
                if (detAgent) detAgent.textContent = `${agent} (${role})`;
                if (detAction) detAction.textContent = action;
                if (detId) detId.textContent = cible;
                if (detDate) detDate.textContent = date;
                if (detailPanel) detailPanel.classList.add('open');
            };

            tr.addEventListener('click', (e) => {
                openDetails();
            });
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDetails();
            });

            tr.append(tdAgent, tdAction, tdTarget, tdDate, tdActions);
            tbody.appendChild(tr);
        });
    }

    async function chargerActivites() {
        const tbody = document.querySelector('.ops-table tbody');
        if (!tbody) return;

        tbody.setAttribute('aria-busy', 'true');
        tbody.innerHTML = Array.from({ length: 5 }, () =>
            '<tr class="activity-skeleton-row"><td><span></span></td><td><span></span></td><td><span></span></td><td><span></span></td><td><span></span></td></tr>'
        ).join('');

        try {
            let data;
            try {
                data = await fetchWithAuth(`${API_BASE}/api/journal/recent`);
            } catch (error) {
                console.warn('Fallback vers /api/journal...');
            }

            if (!data || (Array.isArray(data) && data.length === 0) || (Array.isArray(data.activites) && data.activites.length === 0)) {
                data = await fetchWithAuth(`${API_BASE}/api/journal`);
            }

            const list = Array.isArray(data)
                ? data
                : (Array.isArray(data.activites) ? data.activites : (Array.isArray(data.activities) ? data.activities : (Array.isArray(data.data) ? data.data : [])));

            allActivitiesList = list || [];
            applyFilters();
        } catch (err) {
            console.error('Erreur récupération activités :', err);
            tbody.setAttribute('aria-busy', 'false');
            tbody.replaceChildren();
            const tr = document.createElement('tr');
            tr.className = 'activity-message-row';
            const td = document.createElement('td');
            td.colSpan = 5;
            td.textContent = getTranslation('activity_load_error', 'Impossible de charger le journal d’activité.');
            const retryBtn = document.createElement('button');
            retryBtn.className = 'activity-retry';
            retryBtn.textContent = getTranslation('dashboard_retry', 'Réessayer');
            retryBtn.onclick = chargerActivites;
            td.appendChild(retryBtn);
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
    }

    // 9. Filtrage et recherche réactive
    function applyFilters() {
        const searchInput = document.getElementById('activitySearchInput');
        const actionSelect = document.getElementById('activityActionSelect');

        const query = (searchInput?.value || '').trim().toLowerCase();
        const selectedAction = actionSelect?.value || 'all';

        const filtered = allActivitiesList.filter(item => {
            const role = String(item.role || item.role_utilisateur || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const category = String(item.categorie || '').toLowerCase();
            const module = String(item.module || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const isCompanyActivity = ['compagnie', 'company', 'airline'].includes(role) ||
                (!item.id_admin && item.id_companie && category === 'auth' && module.includes('auth'));
            if (isCompanyActivity) return false;

            const agent = String(item.utilisateur || item.utilisateur_nom || item.admin_name || item.name || item.utilisateur_email || '').toLowerCase();
            const action = String(item.type_activite || item.action || item.type || '').toLowerCase();
            const cible = String(item.reference || item.numero_facture || item.description || item.target || '').toLowerCase();

            // Filtre par texte
            const matchesQuery = !query || agent.includes(query) || action.includes(query) || cible.includes(query);

            // Filtre par catégorie d'action
            let matchesAction = true;
            if (selectedAction !== 'all') {
                const normAction = action.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                matchesAction = normAction.includes(selectedAction);
            }

            return matchesQuery && matchesAction;
        });

        renderActivities(filtered.slice(0, 15));
    }

    // Écouteurs de recherche et filtrage
    const searchInput = document.getElementById('activitySearchInput');
    const actionSelect = document.getElementById('activityActionSelect');
    const globalSearchInput = document.getElementById('globalSearchInput');

    searchInput?.addEventListener('input', applyFilters);
    actionSelect?.addEventListener('change', applyFilters);

    // Recherche globale synchronisée avec la recherche activités
    globalSearchInput?.addEventListener('input', (e) => {
        if (searchInput) {
            searchInput.value = e.target.value;
            applyFilters();
        }
    });

    // Basculer la barre d'outils de filtres
    const toggleFilterBtn = document.getElementById('toggleFilterBtn');
    const tableToolbar = document.getElementById('tableToolbar');
    toggleFilterBtn?.addEventListener('click', () => {
        if (!tableToolbar) return;
        const isHidden = tableToolbar.hasAttribute('hidden');
        if (isHidden) {
            tableToolbar.removeAttribute('hidden');
            toggleFilterBtn.classList.add('active');
            searchInput?.focus();
        } else {
            tableToolbar.setAttribute('hidden', '');
            toggleFilterBtn.classList.remove('active');
        }
    });

    // Bouton de rafraîchissement manuel
    const refreshBtn = document.getElementById('refreshActivitiesBtn');
    refreshBtn?.addEventListener('click', async () => {
        refreshBtn.classList.add('is-spinning');
        try {
            await Promise.all([
                chargerCompanies(),
                chargerFactures(),
                chargerActivites()
            ]);
        } finally {
            setTimeout(() => {
                refreshBtn.classList.remove('is-spinning');
            }, 600);
        }
    });

    // 10. Date dynamique dans l'en-tête
    const dateText = document.getElementById('currentDateText');
    if (dateText) {
        const today = new Date();
        const lang = localStorage.getItem('lang') === 'en' ? 'en-US' : 'fr-FR';
        dateText.textContent = new Intl.DateTimeFormat(lang, {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(today);
    }

    // 11. Initialisation des données
    await Promise.all([
        chargerCompanies(),
        chargerFactures(),
        chargerActivites()
    ]);

    // Rafraîchissement automatique toutes les 5 minutes
    setInterval(async () => {
        await chargerCompanies();
        await chargerFactures();
        await chargerActivites();
    }, 300000);
});

// ==========================================================================
// GESTION DU THÈME, SIDEBAR RESPONSIVE & MENU PROFIL
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. Thème Sombre / Clair
    const toggleTheme = document.getElementById('toggleTheme');
    const updateThemeUI = (isDark) => {
        document.body.classList.toggle('dark-mode', isDark);
        const icon = toggleTheme?.querySelector('i');
        if (icon) {
            icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        if (toggleTheme) {
            const label = isDark ? 'Passer au mode clair' : 'Passer au mode sombre';
            toggleTheme.setAttribute('aria-label', label);
            toggleTheme.title = label;
            toggleTheme.setAttribute('aria-pressed', String(isDark));
        }
    };

    if (localStorage.getItem('theme') === 'dark') {
        updateThemeUI(true);
    }

    toggleTheme?.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeUI(isDark);
    });

    // 2. Panneau de détails latéral
    const detailPanel = document.getElementById('detailPanel');
    const closeDetail = document.getElementById('closeDetail');
    const closeDetails = () => detailPanel?.classList.remove('open');
    closeDetail?.addEventListener('click', closeDetails);
    document.querySelectorAll('[data-close-detail]').forEach(btn => btn.addEventListener('click', closeDetails));

    // 3. Navigation mobile (Drawer Sidebar)
    const menuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('supervisorSidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    const setSidebarOpen = open => {
        document.body.classList.toggle('sidebar-open', open);
        menuToggle?.setAttribute('aria-expanded', String(open));
        const icon = menuToggle?.querySelector('i');
        if (icon) icon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
        if (sidebarBackdrop) {
            sidebarBackdrop.hidden = !open;
        }
    };

    menuToggle?.addEventListener('click', () => {
        const isOpen = document.body.classList.contains('sidebar-open');
        setSidebarOpen(!isOpen);
    });

    sidebarBackdrop?.addEventListener('click', () => setSidebarOpen(false));
    sidebar?.querySelectorAll('.nav a').forEach(link => {
        link.addEventListener('click', () => setSidebarOpen(false));
    });

    // 4. Initiales et profil superviseur
    const email = localStorage.getItem('userEmailSuperviseur') || '';
    if (email) {
        const cleanEmail = email.split('@')[0];
        const initials = cleanEmail.split(/[._\s-]+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'SA';
        const avatar = document.getElementById('supervisorAvatar');
        if (avatar) avatar.textContent = initials;
    }

    // 5. Menu Profil Dropdown
    const userMenu = document.getElementById('userMenu');
    const avatarButton = userMenu?.querySelector('.avatar-btn');
    const dropdown = document.getElementById('userDropdown');

    const setProfileMenuOpen = open => {
        dropdown?.classList.toggle('show', open);
        dropdown?.setAttribute('aria-hidden', String(!open));
        avatarButton?.setAttribute('aria-expanded', String(open));
    };

    avatarButton?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown?.classList.contains('show');
        setProfileMenuOpen(!isOpen);
    });

    document.addEventListener('click', (e) => {
        if (userMenu && !userMenu.contains(e.target)) {
            setProfileMenuOpen(false);
        }
    });

    // Actions du dropdown profil
    document.querySelectorAll('#userDropdown .dropdown-item').forEach(button => {
        const action = button.getAttribute('data-action');
        if (action === 'profile') {
            button.addEventListener('click', () => setProfileMenuOpen(false));
        } else if (action === 'settings') {
            button.addEventListener('click', () => window.location.assign('parametres_Superviseur.html'));
        } else if (action === 'logout') {
            button.addEventListener('click', () => {
                ['jwtTokenSuperviseur', 'refreshTokenSuperviseur', 'userRoleSuperviseur', 'userEmailSuperviseur', 'superviseurId'].forEach(k => localStorage.removeItem(k));
                window.location.assign('Index.html');
            });
        }
    });

    // 6. Fermeture via la touche Échap
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            setSidebarOpen(false);
            closeDetails();
            setProfileMenuOpen(false);
        }
    });
});
