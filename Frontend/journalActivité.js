document.addEventListener('DOMContentLoaded', async () => {

    /* =====================================================
       1. CONFIGURATION API & AUTH (Cookies HTTP-Only)
    ===================================================== */
    const API_BASE = 'https://assa-ac-jyn4.onrender.com';

    /**
     * Tente de rafraîchir le token via le cookie de session
     */
    async function refreshToken() {
        try {
            const res = await fetch(`${API_BASE}/admins/token/refresh`, {
                method: 'POST',
                credentials: 'include'
            });
            return res.ok;
        } catch (err) {
            console.error("Échec rafraîchissement session:", err);
            return false;
        }
    }

    /**
     * Wrapper Fetch sécurisé avec gestion automatique du 401 (Expire)
     */
    async function fetchWithAuth(url, options = {}) {
        options.credentials = 'include';
        options.headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        try {
            let res = await fetch(url, options);

            // Si le token est expiré (401)
            if (res.status === 401) {
                const refreshed = await refreshToken();
                if (refreshed) {
                    // Deuxième tentative après refresh
                    res = await fetch(url, options);
                } else {
                    // Redirection si refresh échoue
                    window.location.href = 'login.html';
                    return null;
                }
            }
            return res;
        } catch (err) {
            console.error("Erreur réseau (vérifiez votre connexion ou l'état du serveur):", err);
            throw err;
        }
    }

    /* =====================================================
       2. UI CONFIG & HELPERS
    ===================================================== */
    const TYPE_UI = {
        create:  { class: 'create',  icon: 'fas fa-plus-circle' },
        update:  { class: 'update',  icon: 'fas fa-pen' },
        delete:  { class: 'delete',  icon: 'fas fa-trash-alt' },
        archive: { class: 'delete',  icon: 'fas fa-archive' },
        system:  { class: 'system',  icon: 'fas fa-cog' }
    };

    function getUtilisateur(act) {
        return act.utilisateur_nom || act.utilisateur_email || 'Système';
    }

    /* =====================================================
       3. ELEMENTS DOM
    ===================================================== */
    const activityList = document.querySelector('.activity-list');
    const filterUser   = document.getElementById('filter-user');
    const filterAction = document.getElementById('filter-action');
    const filterDate   = document.getElementById('filter-date');
    const refreshBtn   = document.querySelector('.filter-actions-bar button');
    const searchInput  = document.querySelector('.search-bar input');

    let allActivities = [];

    /* =====================================================
       4. LOGIQUE DE CHARGEMENT
    ===================================================== */
    async function chargerActivites() {
        try {
            const response = await fetchWithAuth(`${API_BASE}/api/journal/recent?limit=50`);
            
            if (!response) return; // Arrive si redirection login
            if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);

            const result = await response.json();
            
            if (result?.success && Array.isArray(result.activites)) {
                allActivities = result.activites;
                remplirFiltreUtilisateurs(allActivities);
                appliquerFiltres();
            }
        } catch (err) {
            console.error('Erreur journal:', err);
            if (activityList) {
                activityList.innerHTML = `<li style="text-align:center; color:var(--danger); padding:20px;">
                    <i class="fas fa-exclamation-triangle"></i> Erreur de connexion au serveur.
                </li>`;
            }
        }
    }

    /* =====================================================
       5. FILTRES & PAGINATION
    ===================================================== */
    function appliquerFiltres() {
        let filtered = [...allActivities];
        
        const userVal   = filterUser?.value.toLowerCase() || "";
        const actionVal = filterAction?.value || "";
        const dateVal   = filterDate?.value || "";
        const query     = searchInput?.value.toLowerCase().trim() || "";

        // Filtre Utilisateur
        if (userVal) {
            filtered = filtered.filter(act => getUtilisateur(act).toLowerCase() === userVal);
        }

        // Filtre Action
        if (actionVal) {
            filtered = filtered.filter(act => act.type_activite === actionVal);
        }
        
        // Filtre Date
        if (dateVal) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayMs = today.getTime();

            filtered = filtered.filter(act => {
                const actDate = new Date(act.date_activite);
                actDate.setHours(0, 0, 0, 0);
                const actMs = actDate.getTime();

                if (dateVal === 'yesterday') return actMs === (todayMs - 86400000);
                if (dateVal === 'last7') return actMs >= (todayMs - 7 * 86400000);
                return actMs === todayMs; // 'today' par défaut
            });
        }

        // Recherche textuelle
        if (query) {
            filtered = filtered.filter(act => 
                getUtilisateur(act).toLowerCase().includes(query) || 
                (act.description || '').toLowerCase().includes(query) ||
                (act.module || '').toLowerCase().includes(query)
            );
        }

        afficherActivites(filtered);
    }

    function paginateList({ data, container, renderItem, paginationContainer, itemsPerPage, emptyMessage }) {
        let currentPage = 1;

        const renderPage = () => {
            container.innerHTML = "";
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageData = data.slice(start, end);

            if (!pageData.length) {
                container.innerHTML = `<li style="text-align:center; padding:30px; color:gray;">${emptyMessage}</li>`;
                return;
            }

            pageData.forEach(item => container.appendChild(renderItem(item)));
        };

        const renderPagination = () => {
            if (!paginationContainer) return;
            paginationContainer.innerHTML = "";
            const totalPages = Math.ceil(data.length / itemsPerPage);
            if (totalPages <= 1) return;

            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement("button");
                btn.textContent = i;
                btn.className = (i === currentPage) ? "active" : "";
                btn.onclick = () => {
                    currentPage = i;
                    renderPage();
                    renderPagination();
                };
                paginationContainer.appendChild(btn);
            }
        };

        renderPage();
        renderPagination();
    }

    function afficherActivites(activites) {
        const pagination = document.getElementById('activity-pagination');
        if (!activityList) return;

        paginateList({
            data: activites,
            container: activityList,
            paginationContainer: pagination,
            itemsPerPage: 8,
            emptyMessage: "Aucune activité trouvée pour ces critères.",
            renderItem: (act) => {
                const type = TYPE_UI[act.type_activite] || TYPE_UI.system;
                const user = getUtilisateur(act);
                const li = document.createElement('li');
                li.className = 'activity-item';
                li.innerHTML = `
                    <div class="log-icon ${type.class}"><i class="${type.icon}"></i></div>
                    <div class="log-details">
                        <p><strong>${user}</strong> — ${act.description || '-'}</p>
                        <div class="log-metadata">
                            <span><i class="fas fa-layer-group"></i> ${act.module || 'Général'}</span>
                            <span><i class="far fa-clock"></i> ${new Date(act.date_activite).toLocaleString('fr-FR')}</span>
                        </div>
                    </div>`;
                return li;
            }
        });
    }

    function remplirFiltreUtilisateurs(activites) {
        if (!filterUser) return;
        const currentVal = filterUser.value;
        filterUser.innerHTML = `<option value="">Tous les agents</option>`;
        
        const uniques = [...new Set(activites.map(act => getUtilisateur(act)))];
        uniques.sort().forEach(nom => {
            const option = document.createElement('option');
            option.value = nom.toLowerCase();
            option.textContent = nom;
            filterUser.appendChild(option);
        });
        filterUser.value = currentVal;
    }

    /* =====================================================
       6. INITIALISATION & LISTENERS
    ===================================================== */
    [filterUser, filterAction, filterDate].forEach(el => el?.addEventListener('change', appliquerFiltres));
    searchInput?.addEventListener('input', appliquerFiltres);
    refreshBtn?.addEventListener('click', () => {
        refreshBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
        chargerActivites().finally(() => {
            refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Actualiser';
        });
    });

    // Lancement initial
    await chargerActivites();
    
    // Auto-refresh toutes les 60 secondes
    setInterval(chargerActivites, 60000);
});