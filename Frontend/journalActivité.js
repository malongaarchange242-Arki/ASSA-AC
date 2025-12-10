document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('jwtTokenAdmin'); // JWT Admin
    const nomUtilisateur = localStorage.getItem('userEmailAdmin') || 'Admin';

    const activityList = document.querySelector('.activity-list');
    if (!activityList) return console.error("Liste d'activités introuvable");

    const filterUser = document.getElementById('filter-user');
    const filterAction = document.getElementById('filter-action');
    const filterDate = document.getElementById('filter-date');
    const refreshBtn = document.querySelector('.filter-actions-bar button');
    const searchInput = document.querySelector('.search-bar input');

    let allActivities = []; // Stocke toutes les activités récupérées

    async function chargerActivites() {
        try {
            const response = await fetch('http://localhost:5002/api/journal/', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

            const data = await response.json();

            if (!Array.isArray(data)) {
                console.warn("Les activités reçues ne sont pas un tableau :", data);
                allActivities = [];
            } else {
                allActivities = data;
            }

            appliquerFiltres();
        } catch (err) {
            console.error('Erreur lors du chargement des activités :', err);
            allActivities = [];
            activityList.innerHTML = `<li style="text-align:center; color:red; padding:15px;">
                Impossible de charger les activités. Réessayez plus tard.
            </li>`;
        }
    }

    function appliquerFiltres() {
        if (!Array.isArray(allActivities)) {
            activityList.innerHTML = `<li style="text-align:center; color:gray; padding:15px;">Aucune activité disponible</li>`;
            return;
        }

        let filtered = [...allActivities];

        const userVal = filterUser?.value || '';
        if (userVal) filtered = filtered.filter(act => act.utilisateur?.toLowerCase().includes(userVal.toLowerCase()));

        const actionVal = filterAction?.value || '';
        if (actionVal) filtered = filtered.filter(act => act.type_activite === actionVal);

        const dateVal = filterDate?.value || '';
        if (dateVal) {
            const now = new Date();
            filtered = filtered.filter(act => {
                if (!act.date_activite) return false;
                const actDate = new Date(act.date_activite);
                switch (dateVal) {
                    case 'yesterday':
                        const yesterday = new Date();
                        yesterday.setDate(now.getDate() - 1);
                        return actDate.toDateString() === yesterday.toDateString();
                    case 'last7':
                        const sevenDaysAgo = new Date();
                        sevenDaysAgo.setDate(now.getDate() - 7);
                        return actDate >= sevenDaysAgo && actDate <= now;
                    default:
                        return actDate.toDateString() === now.toDateString();
                }
            });
        }

        const query = searchInput?.value.trim().toLowerCase() || '';
        if (query) {
            filtered = filtered.filter(act => {
                const utilisateur = act.utilisateur?.toLowerCase() || '';
                const description = act.description?.toLowerCase() || '';
                return utilisateur.includes(query) || description.includes(query);
            });
        }

        afficherActivites(filtered);
    }

    function afficherActivites(activites) {
        if (!activityList) return;
        activityList.innerHTML = '';

        if (!activites.length) {
            activityList.innerHTML = `<li style="text-align:center; color:gray; padding:15px;">
                Aucune activité disponible
            </li>`;
            return;
        }

        activites.forEach(act => {
            let iconClass = 'system';
            let icon = 'fas fa-info-circle';
            switch (act.type_activite) {
                case 'create': iconClass = 'create'; icon = 'fas fa-file-invoice-dollar'; break;
                case 'update': iconClass = 'update'; icon = 'fas fa-pen'; break;
                case 'delete': iconClass = 'delete'; icon = 'fas fa-archive'; break;
                case 'system': iconClass = 'system'; icon = 'fas fa-sign-in-alt'; break;
            }

            const utilisateur = act.utilisateur || nomUtilisateur;
            const dateAct = act.date_activite ? new Date(act.date_activite).toLocaleString() : '-';

            const li = document.createElement('li');
            li.classList.add('activity-item');
            li.innerHTML = `
                <div class="log-icon ${iconClass}"><i class="${icon}"></i></div>
                <div class="log-details">
                    <strong>${utilisateur}</strong> : ${act.description || '-'}
                    <div class="log-metadata">
                        Module : ${act.module || '-'} | <span class="user-name">${utilisateur}</span> | <span class="time">${dateAct}</span>
                    </div>
                </div>
            `;
            activityList.appendChild(li);
        });
    }

    [filterUser, filterAction, filterDate].forEach(select => {
        if (select) select.addEventListener('change', appliquerFiltres);
    });

    if (searchInput) searchInput.addEventListener('input', appliquerFiltres);
    if (refreshBtn) refreshBtn.addEventListener('click', chargerActivites);

    await chargerActivites();
    setInterval(chargerActivites, 10000);
});
