document.addEventListener('DOMContentLoaded', () => {

    // =========================
    // CONFIG
    // =========================
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002') ? origin : 'http://localhost:5002';
    })();

    const tableBody = document.querySelector('#table-activites tbody');
    const searchInput = document.querySelector('.search-bar input');

    // Si la page n'a pas de tableau → on sort sans erreur
    if (!tableBody) {
        console.warn('Journal activité : tableau non présent sur cette page');
        return;
    }

    // =========================
    // UI - Libellés & icônes
    // =========================
    const TYPE_UI = {
        create: { label: 'Création', icon: 'fa-plus-circle' },
        update: { label: 'Modification', icon: 'fa-pen' },
        delete: { label: 'Suppression', icon: 'fa-trash' },
        system: { label: 'Système', icon: 'fa-cog' }
};


    // =========================
    // AUTH SIMPLE (lecture seule)
    // =========================
    const adminToken = localStorage.getItem('jwtTokenAdmin');
    const companyToken = localStorage.getItem('jwtTokenCompany');

    const token = adminToken || companyToken;
    const role = adminToken ? 'admin' : companyToken ? 'company' : null;

    if (!token || !role) {
        tableBody.innerHTML =
            `<tr><td colspan="4" style="text-align:center;color:red;">
                Session expirée. Veuillez vous reconnecter.
            </td></tr>`;
        return;
    }

    // =========================
    // FETCH AUTH (sans refresh)
    // =========================
    async function fetchAuth(url) {
        const res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-access-token': token
            }
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Erreur serveur');

        return data;
    }

    // =========================
    // CHARGER ACTIVITÉS
    // =========================
    async function chargerActivites() {
        try {
            const url =
                role === 'admin'
                    ? `${API_BASE}/api/journal/recent?limit=5`
                    : `${API_BASE}/api/companies/journal/recent?limit=5`;

            const result = await fetchAuth(url);

            if (!result.success || !Array.isArray(result.activites)) {
                throw new Error('Format de données invalide');
            }

            renderTable(result.activites);
        } catch (err) {
            console.error('Journal activité:', err);
            tableBody.innerHTML =
                `<tr><td colspan="4" style="text-align:center;color:red;">
                    ${err.message}
                </td></tr>`;
        }
    }

    // =========================
    // RENDER TABLE
    // =========================
    function renderTable(activites) {
        tableBody.innerHTML = '';

        if (!activites.length) {
            tableBody.innerHTML =
                `<tr><td colspan="4" style="text-align:center;">
                    Aucune activité trouvée
                </td></tr>`;
            return;
        }

        activites.forEach(act => {
            const tr = document.createElement('tr');
        
            const type = TYPE_UI[act.type_activite] || {
                label: act.type_activite || '-',
                icon: 'fa-info-circle'
            };
        
            tr.innerHTML = `
                <td>
                    <i class="fas ${type.icon}"></i> ${type.label}
                </td>
                <td>${act.description || act.objet || '-'}</td>
                <td>${act.utilisateur || '-'}</td>
                <td>${act.date_activite
                    ? new Date(act.date_activite).toLocaleString()
                    : '-'}
                </td>
            `;
        
            tableBody.appendChild(tr);
        });
        

        if (searchInput?.value) {
            filtrer(searchInput.value);
        }
    }

    // =========================
    // FILTRE
    // =========================
    function filtrer(texte) {
        const t = texte.toLowerCase();
        Array.from(tableBody.rows).forEach(row => {
            row.style.display =
                row.innerText.toLowerCase().includes(t) ? '' : 'none';
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', e => filtrer(e.target.value));
    }

    // =========================
    // INIT
    // =========================
    chargerActivites();
});
