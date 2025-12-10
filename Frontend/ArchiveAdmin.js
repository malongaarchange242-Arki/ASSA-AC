document.addEventListener('DOMContentLoaded', async () => {

    // ================== Constants ==================
    const TOKEN_KEY = 'jwtTokenAdmin';
    const REFRESH_KEY = 'refreshTokenAdmin';
    const API_BASE = 'http://localhost:5002';

    // ================== Token Management ==================
    let token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        alert("Vous n'êtes pas connecté !");
        window.location.href = 'login.html';
        return;
    }

    const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
    const setToken = (newToken) => { localStorage.setItem(TOKEN_KEY, newToken); token = newToken; };
    const clearTokens = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
    };

    // ================== Refresh Token ==================
    async function refreshToken() {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return false;

        try {
            const res = await fetch(`${API_BASE}/admins/token/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (!res.ok) throw new Error('Impossible de rafraîchir le token');

            const data = await res.json();
            if (data.token) {
                setToken(data.token);
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
        if (!options.headers) options.headers = {};
        options.headers['Content-Type'] = 'application/json';
        options.headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch(url, options);

        if (res.status === 401) {
            const refreshed = await refreshToken();
            if (!refreshed) {
                clearTokens();
                alert('Token expiré. Veuillez vous reconnecter.');
                window.location.href = 'login.html';
                throw new Error('Token expiré');
            }
            options.headers['Authorization'] = `Bearer ${token}`;
            res = await fetch(url, options);
        }

        if (res.status === 403) throw new Error('Accès interdit');

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Erreur API : ${res.status}`);
        return data;
    }

    // ================== Sélecteurs ==================
    const archiveTableBody = document.querySelector('.archive-table tbody');
    const filterButton = document.querySelector('.action-buttons button:first-child');
    const restoreButton = document.querySelector('.action-buttons button:nth-child(2)');
    const printButton = document.querySelector('.print-selector-group .print-btn');
    const selectMonth = document.getElementById('select-month');

    let archivesData = [];

    // ================== Helpers ==================
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR') + ' ' +
               date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatAmount = (amount) => {
        if (!amount || isNaN(amount)) return '-';
        return Number(amount).toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' });
    };

    const createArchiveRow = (item) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.type}</td>
            <td>${item.ref}</td>      
            <td>${item.compagnie}</td>
            <td>${formatAmount(item.montant)}</td>
            <td>${formatDate(item.date_cloture)}</td>
            <td class="table-actions">
                <button class="view-btn" title="Voir Fiche"><i class="fas fa-eye"></i></button>
                <button class="pdf-btn" title="Télécharger PDF"><i class="fas fa-download"></i></button>
            </td>
        `;
        tr.querySelector('.view-btn').onclick = () => alert(`Voir ${item.type} : ${item.ref}`);
        tr.querySelector('.pdf-btn').onclick = () => alert(`Télécharger PDF pour ${item.type} : ${item.ref}`);
        return tr;
    };

    const afficherArchives = (data) => {
        archiveTableBody.innerHTML = '';
        if (!data.length) {
            archiveTableBody.innerHTML = '<tr><td colspan="6">Aucune archive disponible</td></tr>';
            return;
        }
        data.forEach(item => archiveTableBody.appendChild(createArchiveRow(item)));
    };

    const filterArchives = (type = '', month = 'current') => {
        return archivesData.filter(item => {
            const matchType = !type || item.type.toLowerCase() === type.toLowerCase();
            const matchMonth = month === 'current' || item.date_cloture?.slice(0,7) === month;
            return matchType && matchMonth;
        });
    };

    // ================== Charger les archives ==================
    const chargerArchives = async () => {
        try {
            const archives = await fetchWithAuth(`${API_BASE}/archives`);
            archivesData = Array.isArray(archives.archives) ? archives.archives : [];
            afficherArchives(archivesData);
        } catch (err) {
            console.error('Erreur fetch archives :', err);
            archiveTableBody.innerHTML = '<tr><td colspan="6">Impossible de récupérer les archives</td></tr>';
        }
    };

    // ================== Events ==================
    filterButton.addEventListener('click', () => {
        const type = prompt('Filtrer par type (Facture, Compagnie, Devis) ou laisser vide :');
        afficherArchives(filterArchives(type, selectMonth.value));
    });

    restoreButton.addEventListener('click', () => {
        selectMonth.value = 'current';
        afficherArchives(archivesData);
    });

    printButton.addEventListener('click', () => {
        const filtered = filterArchives('', selectMonth.value);
        alert(`Impression de ${filtered.length} archives pour : ${selectMonth.value}`);
    });

    // ================== Init ==================
    await chargerArchives();

});
