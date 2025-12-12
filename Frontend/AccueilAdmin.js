document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002') ? origin : 'https://assa-ac-jyn4.onrender.com';
    })();
    const adminTokenKey = 'jwtTokenAdmin';
    const adminRefreshKey = 'refreshTokenAdmin';
    const companyTokenKey = 'jwtTokenCompany';
    const companyRefreshKey = 'refreshTokenCompany';

    let token = localStorage.getItem(adminTokenKey) || localStorage.getItem(companyTokenKey);
    let refreshKey = localStorage.getItem(adminTokenKey) ? adminRefreshKey : companyRefreshKey;
    let role = localStorage.getItem(adminTokenKey) ? 'admin' : localStorage.getItem(companyTokenKey) ? 'company' : null;
    let userEmail = role === 'admin' ? localStorage.getItem('userEmailAdmin') : localStorage.getItem('userEmailCompany');

    if (!token || !role) {
        alert("Vous n'êtes pas connecté !");
        window.location.href = 'login.html';
        return;
    }

    const userNameSpan = document.getElementById('user-name');
    const tableBody = document.querySelector('#table-activites tbody');
    const searchInput = document.querySelector('.search-bar input');

    if (!tableBody) return console.error("Tableau introuvable : 'table-activites'.");
    if (userNameSpan) userNameSpan.innerHTML = `${userEmail || 'Utilisateur'} <i class="fas fa-caret-down"></i>`;

    async function refreshToken() {
        const refreshToken = localStorage.getItem(refreshKey);
        if (!refreshToken) return false;

        try {
            if (role !== 'admin') return false; // pas de refresh côté compagnie
            const url = `${API_BASE}/api/admins/token/refresh`;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Erreur rafraîchissement token');

            const newToken = data.token || data.accessToken || data.access_token;
            if (!newToken) throw new Error('Réponse refresh sans token');

            if (role === 'admin') localStorage.setItem(adminTokenKey, newToken);
            else localStorage.setItem(companyTokenKey, newToken);

            token = newToken;
            return true;
        } catch (err) {
            console.error('Impossible de rafraîchir le token :', err);
            return false;
        }
    }

    async function fetchAuth(url, options = {}) {
        if (!token) throw new Error('Token manquant');
        options.headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-access-token': token };

        let res = await fetch(url, options);
        if (res.status === 401) {
            const refreshed = await refreshToken();
            if (!refreshed) throw new Error('Token expiré');
            options.headers['Authorization'] = `Bearer ${token}`;
            options.headers['x-access-token'] = token;
            res = await fetch(url, options);
        }

        if (res.status === 403) throw new Error("Accès interdit : permissions insuffisantes");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Erreur HTTP ${res.status}`);
        return data;
    }

    async function chargerActivites() {
        try {
            const url = role === 'admin'
                ? `${API_BASE}/api/journal/recent?limit=5`
                : `${API_BASE}/api/companies/journal/recent?limit=5`;

            const resData = await fetchAuth(url);
            const activites = Array.isArray(resData) ? resData : resData.activites || [];

            tableBody.innerHTML = '';
            if (!activites.length) {
                tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Aucune activité récente</td></tr>`;
                return;
            }

            activites.forEach(act => {
                const tr = document.createElement('tr');
            
                const typeActivite = act.type_activite === 'system' ? 'Système' : act.type_activite || '-';
                const description = act.description || act.objet || '-';
            
                // 🔥 Priorité à la valeur enrichie par le backend
                const utilisateur = act.utilisateur || act.utilisateur_nom || act.utilisateur_email || '-';
            
                const date = act.date_activite ? new Date(act.date_activite).toLocaleString() : '-';
            
                tr.innerHTML = `
                    <td>${typeActivite}</td>
                    <td>${description}</td>
                    <td>${utilisateur}</td>
                    <td>${date}</td>
                `;
                tableBody.appendChild(tr);
            });
            

            if (searchInput?.value.trim() !== '') filtrerTableau(searchInput.value.trim());
        } catch (err) {
            console.error('Erreur lors du chargement du journal :', err);
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">${err.message}</td></tr>`;
        }
    }

    function filtrerTableau(texte) {
        const filter = texte.toLowerCase();
        Array.from(tableBody.rows).forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(filter) ? '' : 'none';
        });
    }

    if (searchInput) searchInput.addEventListener('input', () => filtrerTableau(searchInput.value.trim()));

    await chargerActivites();
    setInterval(chargerActivites, 10000);
});

