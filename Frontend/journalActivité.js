document.addEventListener('DOMContentLoaded', () => {
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
        return act.utilisateur_nom || act.utilisateur_email || 'Système';
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

    // =============================
    // 🔄 FETCH ACTIVITÉS
    // =============================
    async function chargerActivites() {
        try {
            const response = await fetch(
                'https://assa-ac-jyn4.onrender.com/api/journal/recent?limit=50',
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) {
                throw new Error(`Erreur HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!result?.success || !Array.isArray(result.activites)) {
                console.error('Format API invalide', result);
                allActivities = [];
            } else {
                allActivities = result.activites;
            }

            remplirFiltreUtilisateurs(allActivities);
            appliquerFiltres();

        } catch (err) {
            console.error('Erreur chargement journal :', err);
            activityList.innerHTML = `
                <li style="text-align:center; color:red; padding:15px;">
                    Impossible de charger le journal d'activité
                </li>`;
        }
    }

    // =============================
    // 👥 FILTRE UTILISATEURS
    // =============================
    function remplirFiltreUtilisateurs(activites) {
        if (!filterUser) return;

        filterUser.innerHTML = `<option value="">Tous</option>`;

        const uniques = new Map();

        activites.forEach(act => {
            const nom = getUtilisateur(act);
            if (!nom) return;

            const key = nom.toLowerCase();
            if (!uniques.has(key)) {
                uniques.set(key, nom);
            }
        });

        uniques.forEach(nom => {
            const option = document.createElement('option');
            option.value = nom.toLowerCase();
            option.textContent = nom;
            filterUser.appendChild(option);
        });
    }

    // =============================
    // 🎯 FILTRES
    // =============================
    function appliquerFiltres() {
        let filtered = [...allActivities];

        // 👤 Utilisateur
        const userVal = filterUser.value.toLowerCase().trim();
        if (userVal) {
            filtered = filtered.filter(act =>
                getUtilisateur(act).toLowerCase().includes(userVal)
            );
        }

        // 🔄 Type
        const actionVal = filterAction.value;
        if (actionVal) {
            filtered = filtered.filter(act => act.type_activite === actionVal);
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
            filtered = filtered.filter(act =>
                getUtilisateur(act).toLowerCase().includes(query) ||
                (act.description || '').toLowerCase().includes(query)
            );
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
            emptyMessage: "Aucune activité disponible",
            renderItem: (act) => {
                const type = TYPE_UI[act.type_activite] || TYPE_UI.system;
                const user = getUtilisateur(act);
                const date = act.date_activite
                    ? new Date(act.date_activite).toLocaleString('fr-FR')
                    : '-';
    
                const li = document.createElement('li');
                li.className = 'activity-item';
                li.innerHTML = `
                    <div class="log-icon ${type.class}">
                        <i class="${type.icon}"></i>
                    </div>
                    <div class="log-details">
                        <strong>${user}</strong> — ${act.description || '-'}
                        <div class="log-metadata">
                            Module : ${act.module || '-'} |
                            <span class="user-name">${user}</span> |
                            <span class="time">${date}</span>
                        </div>
                    </div>
                `;
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
                container.innerHTML = `
                    <li style="text-align:center; padding:15px; color:gray;">
                        ${emptyMessage}
                    </li>`;
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

    // =============================
    // ▶️ INIT
    // =============================
    await chargerActivites();
    setInterval(chargerActivites, 15000);
});
