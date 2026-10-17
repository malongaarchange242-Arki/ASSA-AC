document.addEventListener('DOMContentLoaded', () => {
    // 1. Référence au bouton de bascule
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    function updateThemeToggleLabel() {
        if (!themeToggle) return;
        const label = body.classList.contains('dark-mode')
            ? t('theme_toggle_light')
            : t('theme_toggle_dark');
        themeToggle.title = label;
        themeToggle.setAttribute('aria-label', label);
    }

    // 2. Fonction pour appliquer le thème
    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            if (themeToggle) {
                // Icône Soleil pour passer au mode clair
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            }
        } else {
            body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
            if (themeToggle) {
                // Icône Lune pour passer au mode sombre
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }
        }
        updateThemeToggleLabel();
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
    window.addEventListener('app-language-change', updateThemeToggleLabel);
});

document.addEventListener('DOMContentLoaded', async () => {

    // =============================
    // 🔐 AUTH
    // =============================
    const token = localStorage.getItem('jwtTokenAdmin');
    if (!token) {
        console.error('Token admin manquant');
        return;
    }

    // =============================
    // 🎨 TYPES UI
    // =============================
    const TYPE_UI = {
        create:  { class: 'create',  icon: 'fas fa-file-invoice-dollar' },
        update:  { class: 'update',  icon: 'fas fa-pen' },
        delete:  { class: 'delete',  icon: 'fas fa-archive' },
        archive: { class: 'delete',  icon: 'fas fa-archive' },
        system:  { class: 'system',  icon: 'fas fa-sign-in-alt' }
    };

    // =============================
    // 👤 UTILISATEUR
    // =============================
    function getUtilisateur(act) {
        const user = act.utilisateur_nom || act.utilisateur_email || 'Système';
        if (user === 'Administrateur') return t('activity_user_administrator');
        if (user === 'Système') return t('activity_user_system');
        return user;
    }

    function localizeActivityDescription(description) {
        const source = String(description || '');
        const statusMatch = source.match(/^Statut de la facture mis à jour\s*:\s*(.+)$/i);
        if (statusMatch) {
            const statuses = {
                impayée: 'activity_status_unpaid',
                impayee: 'activity_status_unpaid',
                payée: 'activity_status_paid',
                payee: 'activity_status_paid',
                contestée: 'activity_status_disputed',
                contestee: 'activity_status_disputed',
                validée: 'activity_status_approved',
                validee: 'activity_status_approved',
                rejetée: 'activity_status_rejected',
                rejetee: 'activity_status_rejected'
            };
            const status = statusMatch[1].trim();
            const statusKey = statuses[status.toLocaleLowerCase('fr-FR')];
            return t('activity_invoice_status').replace('{status}', statusKey ? t(statusKey) : status);
        }

        const patterns = [
            [/^Connexion de la compagnie (.+)$/i, 'activity_company_login', ['company']],
            [/^Création de la facture (.+) pour (.+)$/i, 'activity_invoice_created', ['invoice', 'company']],
            [/^Mise à jour de la facture (.+) \((.+)\)$/i, 'activity_invoice_updated', ['invoice', 'company']],
            [/^Compagnie (.+) créée$/i, 'activity_company_created', ['company']],
            [/^Compagnie (.+) mise à jour$/i, 'activity_company_updated', ['company']],
            [/^Compagnie (.+) archivée$/i, 'activity_company_archived', ['company']],
            [/^Compagnie (.+) restaurée$/i, 'activity_company_restored', ['company']],
            [/^Suppression définitive de la compagnie (.+)$/i, 'activity_company_deleted', ['company']],
            [/^Soumission de la facture (.+) au DAF pour validation$/i, 'activity_invoice_submitted', ['invoice']],
            [/^Validation de la facture (.+) par DAF$/i, 'activity_invoice_validated', ['invoice']],
            [/^Rejet de la facture (.+) par DAF\. Motif:\s*(.+)$/i, 'activity_invoice_rejected', ['invoice', 'reason']],
            [/^Facture (.+) archivée$/i, 'activity_invoice_archived', ['invoice']],
            [/^L'administrateur (.+) a archivé la facture (.+)\.$/i, 'activity_invoice_archived_by', ['user', 'invoice']],
            [/^Confirmation du paiement de la facture (.+)$/i, 'activity_payment_confirmed', ['invoice']],
            [/^OTP de première connexion généré pour la compagnie (.+)$/i, 'activity_company_otp', ['company']],
            [/^Activation automatique du compte et définition du mot de passe$/i, 'activity_company_activated', []],
            [/^Connexion opérateur$/i, 'activity_operator_login', []],
            [/^Mise à jour opérateur (.+)$/i, 'activity_operator_updated', ['operator']],
            [/^Désactivation opérateur (.+)$/i, 'activity_operator_disabled', ['operator']],
            [/^Création initiale du Super Admin$/i, 'activity_super_admin_created', []],
            [/^Connexion Super Admin par secret$/i, 'activity_super_admin_login', []],
            [/^Connexion administrateur$/i, 'activity_admin_login', []],
            [/^Mot de passe administrateur modifié$/i, 'activity_admin_password', []],
            [/^Activité système$/i, 'activity_description_system', []],
            [/^(.+) créé par Super Admin$/i, 'activity_profile_created', ['profile']]
        ];

        for (const [pattern, key, placeholders] of patterns) {
            const match = source.match(pattern);
            if (!match) continue;
            return placeholders.reduce((text, placeholder, index) =>
                text.replace(`{${placeholder}}`, match[index + 1]), t(key));
        }

        return source || '-';
    }

    function localizeActivityModule(module) {
        const moduleKeys = {
            auth: 'activity_module_authentication',
            authentification: 'activity_module_authentication',
            authentication: 'activity_module_authentication',
            factures: 'activity_module_invoices',
            invoices: 'activity_module_invoices',
            compagnies: 'activity_module_companies',
            companies: 'activity_module_companies',
            système: 'activity_module_system',
            system: 'activity_module_system',
            admins: 'activity_module_admins',
            operateurs: 'activity_module_operators',
            'super-admin': 'activity_module_super_admin',
            'super-admin-login': 'activity_module_super_admin_login',
            'auth-management': 'activity_module_auth_management',
            login: 'activity_module_login'
        };
        const value = String(module || '').trim();
        const key = moduleKeys[value.toLocaleLowerCase('fr-FR')];
        return key ? t(key) : (value || '-');
    }

    // =============================
    // 📌 ELEMENTS DOM
    // =============================
    const activityList = document.querySelector('.activity-list');
    const filterUser   = document.getElementById('filter-user');
    const filterAction = document.getElementById('filter-action');
    const filterDate   = document.getElementById('filter-date');
    const refreshBtn   = document.querySelector('.filter-actions-bar button');
    const searchInput  = document.querySelector('.search-bar input');

    if (!activityList) {
        console.error('Liste activité introuvable');
        return;
    }

    // =============================
    // 🗃️ DATA
    // =============================
    let allActivities = [];
    let activityLoadFailed = false;

    function afficherErreurChargement() {
        activityList.setAttribute('aria-busy', 'false');
        const item = document.createElement('li');
        item.style.cssText = 'text-align:center; color:red; padding:15px;';
        item.append(`${t('activity_load_error')} `);
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.textContent = t('activity_retry');
        retryButton.addEventListener('click', chargerActivites);
        item.appendChild(retryButton);
        activityList.replaceChildren(item);
    }

    // =============================
    // 🔄 FETCH ACTIVITÉS
    // =============================
    async function chargerActivites() {
        activityList.setAttribute('aria-busy', 'true');
        try {
            const response = await fetch(
                'http://localhost:5002/api/journal/recent?limit=50',
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) {
                throw new Error(`Erreur HTTP ${response.status}`);
            }

            const result = await response.json();
            activityLoadFailed = false;

            if (!result?.success || !Array.isArray(result.activites)) {
                console.error('Format API invalide', result);
                allActivities = [];
            } else {
                allActivities = result.activites;
            }

            remplirFiltreUtilisateurs(allActivities);
            appliquerFiltres();
            activityList.setAttribute('aria-busy', 'false');

        } catch (err) {
            console.error('Erreur chargement journal :', err);
            activityLoadFailed = true;
            afficherErreurChargement();
        }
    }

    // =============================
    // 👥 FILTRE UTILISATEURS
    // =============================
    function remplirFiltreUtilisateurs(activites) {
        if (!filterUser) return;

        const selectedUser = filterUser.value;
        filterUser.replaceChildren();
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = t('all');
        filterUser.appendChild(allOption);

        const uniques = new Map();

        activites.forEach(act => {
            const sourceName = act.utilisateur_nom || act.utilisateur_email || 'Système';
            if (!sourceName) return;

            const key = sourceName.toLocaleLowerCase('fr-FR');
            if (!uniques.has(key)) {
                uniques.set(key, getUtilisateur(act));
            }
        });

        uniques.forEach((nom, key) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = nom;
            filterUser.appendChild(option);
        });
        filterUser.value = selectedUser;
    }

    // =============================
    // 🎯 FILTRES
    // =============================
    function appliquerFiltres() {
        let filtered = [...allActivities];

        // 👤 Utilisateur
        const userVal = filterUser.value.toLocaleLowerCase('fr-FR').trim();
        if (userVal) {
            filtered = filtered.filter(act =>
                (act.utilisateur_nom || act.utilisateur_email || 'Système')
                    .toLocaleLowerCase('fr-FR').includes(userVal)
            );
        }

        // 🔄 Type
        const actionVal = filterAction.value;
        if (actionVal) {
            const actionTypes = {
                create: ['create'],
                update: ['update', 'validate', 'reject', 'submit', 'disable'],
                delete: ['delete', 'archive'],
                system: ['system', 'login', 'security']
            };
            const acceptedTypes = actionTypes[actionVal] || [actionVal];
            filtered = filtered.filter(act => acceptedTypes.includes(act.type_activite));
        }

        // 📅 Date
        const dateVal = filterDate.value;
        if (dateVal) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            filtered = filtered.filter(act => {
                if (!act.date_activite) return false;

                const d = new Date(act.date_activite);
                d.setHours(0, 0, 0, 0);

                if (dateVal === 'yesterday') {
                    const y = new Date(today);
                    y.setDate(today.getDate() - 1);
                    return d.getTime() === y.getTime();
                }

                if (dateVal === 'last7') {
                    const last7 = new Date(today);
                    last7.setDate(today.getDate() - 7);
                    return d >= last7;
                }

                return d.getTime() === today.getTime();
            });
        }

        // 🔎 Recherche
        const query = searchInput.value.toLowerCase().trim();
        if (query) {
            filtered = filtered.filter(act => [
                act.description,
                localizeActivityDescription(act.description),
                getUtilisateur(act),
                act.module,
                localizeActivityModule(act.module),
                act.type_activite
            ].filter(Boolean).join(' ').toLowerCase().includes(query));
        }

        afficherActivites(filtered);
    }

    // =============================
    // 🖥️ AFFICHAGE
    // =============================
    function afficherActivites(activites) {
        const pagination = document.getElementById('activity-pagination');
    
        paginateList({
            data: activites,
            container: activityList,
            paginationContainer: pagination,
            itemsPerPage: 8,
            emptyMessage: t('activity_empty'),
            renderItem: (act) => {
                const type = TYPE_UI[act.type_activite] || TYPE_UI.system;
                const user = getUtilisateur(act);
                const description = localizeActivityDescription(act.description);
                const module = localizeActivityModule(act.module);
                const date = act.date_activite
                    ? new Date(act.date_activite).toLocaleString(
                        localStorage.getItem('lang') === 'en' ? 'en-US' : 'fr-FR'
                    )
                    : '-';
    
                const li = document.createElement('li');
                li.className = 'activity-item';
                const icon = document.createElement('div');
                icon.className = `log-icon ${type.class}`;
                const iconElement = document.createElement('i');
                iconElement.className = type.icon;
                icon.appendChild(iconElement);

                const details = document.createElement('div');
                details.className = 'log-details';
                const userName = document.createElement('strong');
                userName.textContent = user;
                details.append(userName, document.createTextNode(` — ${description}`));

                const metadata = document.createElement('div');
                metadata.className = 'log-metadata';
                metadata.append(`${t('module')} : ${module} | `);
                const metadataUser = document.createElement('span');
                metadataUser.className = 'user-name';
                metadataUser.textContent = user;
                metadata.append(metadataUser, document.createTextNode(' | '));
                const time = document.createElement('span');
                time.className = 'time';
                time.textContent = date;
                metadata.appendChild(time);
                details.appendChild(metadata);
                li.append(icon, details);
                return li;
            }
        });
    }
    

    function paginateList({
        data,
        container,
        renderItem,
        paginationContainer,
        itemsPerPage = 8,
        emptyMessage = "Aucune donnée"
    }) {
        let currentPage = 1;
    
        function renderPage() {
            container.innerHTML = "";
    
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageData = data.slice(start, end);
    
            if (!pageData.length) {
                const emptyItem = document.createElement('li');
                emptyItem.style.cssText = 'text-align:center; padding:15px; color:gray;';
                emptyItem.textContent = emptyMessage;
                container.appendChild(emptyItem);
                return;
            }
    
            pageData.forEach(item => {
                container.appendChild(renderItem(item));
            });
        }
    
        function renderPagination() {
            paginationContainer.innerHTML = "";
            const totalPages = Math.ceil(data.length / itemsPerPage);
    
            if (totalPages <= 1) return;
    
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement("button");
                btn.textContent = i;
                btn.classList.toggle("active", i === currentPage);
    
                btn.onclick = () => {
                    currentPage = i;
                    renderPage();
                    renderPagination();
                };
    
                paginationContainer.appendChild(btn);
            }
        }
    
        renderPage();
        renderPagination();
    }
    

    function actualiserJournal() {
        // Reset filtres
        filterUser.value = '';
        filterAction.value = '';
        filterDate.value = '';
        searchInput.value = '';
    
        // Reload data
        chargerActivites();
    }
    

    // =============================
    // 🎧 EVENTS
    // =============================
    [filterUser, filterAction, filterDate].forEach(el =>
        el.addEventListener('change', appliquerFiltres)
    );

    searchInput.addEventListener('input', appliquerFiltres);
    refreshBtn.addEventListener('click', actualiserJournal);
    window.addEventListener('app-language-change', () => {
        remplirFiltreUtilisateurs(allActivities);
        if (activityLoadFailed) {
            afficherErreurChargement();
        } else {
            appliquerFiltres();
        }
    });

    // =============================
    // ▶️ INIT
    // =============================
    await chargerActivites();
    setInterval(chargerActivites, 15000);
});
