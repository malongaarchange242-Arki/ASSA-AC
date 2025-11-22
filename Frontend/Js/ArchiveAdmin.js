document.addEventListener('DOMContentLoaded', async () => {

    const TOKEN_KEY = 'jwtTokenAdmin';
    const REFRESH_KEY = 'refreshTokenAdmin';

    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        alert("Vous n'êtes pas connecté !");
        window.location.href = 'login.html';
        return;
    }

    // ===== Fonction pour rafraîchir le token =====
    async function refreshToken() {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (!refreshToken) return false;

        try {
            const res = await fetch('https://assa-ac.onrender.com/api/admins/token/refresh', {
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

    // ===== Fetch sécurisé avec gestion automatique du token =====
    async function fetchWithAuth(url, options = {}) {
        if (!options.headers) options.headers = {};
        options.headers['Content-Type'] = 'application/json';
        options.headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch(url, options);

        // Si token expiré, tenter un refresh
        if (res.status === 401) {
            console.warn('Token expiré, tentative de rafraîchissement...');
            const refreshed = await refreshToken();
            if (!refreshed) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(REFRESH_KEY);
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

    // ================== Formatage ==================
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return (
            date.toLocaleDateString('fr-FR') +
            ' ' +
            date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        );
    }

    function formatAmount(amount) {
        if (!amount || isNaN(amount)) return '-';
        return Number(amount).toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' });
    }

    // ================== Charger les archives ==================
    async function chargerArchives() {
        try {
            const archives = await fetchWithAuth('https://assa-ac.onrender.com/api/archives');
            archivesData = Array.isArray(archives.archives) ? archives.archives : [];
            afficherArchives(archivesData);
        } catch (err) {
            console.error('Erreur fetch archives :', err);
            archiveTableBody.innerHTML = '<tr><td colspan="6">Impossible de récupérer les archives</td></tr>';
        }
    }

    // ================== Afficher les archives ==================
    function afficherArchives(data) {
        archiveTableBody.innerHTML = '';

        if (data.length === 0) {
            archiveTableBody.innerHTML = '<tr><td colspan="6">Aucune archive disponible</td></tr>';
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
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
            archiveTableBody.appendChild(row);
        });

        ajouterActions();
    }

    // ================== Actions Vue / PDF ==================
    function ajouterActions() {
        const viewButtons = document.querySelectorAll('.table-actions .view-btn');
        const pdfButtons = document.querySelectorAll('.table-actions .pdf-btn');

        viewButtons.forEach(btn => {
            btn.onclick = (e) => {
                const row = e.target.closest('tr');
                const type = row.children[0].textContent;
                const ref = row.children[1].textContent;
                alert(`Voir ${type} : ${ref}`);
            };
        });

        pdfButtons.forEach(btn => {
            btn.onclick = (e) => {
                const row = e.target.closest('tr');
                const type = row.children[0].textContent;
                const ref = row.children[1].textContent;
                alert(`Télécharger PDF pour ${type} : ${ref}`);
            };
        });
    }

    // ================== Filtrage ==================
    filterButton.addEventListener('click', () => {
        const type = prompt('Filtrer par type (Facture, Compagnie, Devis) ou laisser vide :');
        const monthValue = selectMonth.value;

        const filtered = archivesData.filter(item => {
            const matchType = !type || item.type.toLowerCase() === type.toLowerCase();
            let matchMonth = true;
            if (monthValue !== 'current') {
                const itemMonth = item.date_cloture?.slice(0,7);
                matchMonth = itemMonth === monthValue;
            }
            return matchType && matchMonth;
        });

        afficherArchives(filtered);
    });

    // ================== Restaurer les filtres ==================
    restoreButton.addEventListener('click', () => {
        selectMonth.value = 'current';
        afficherArchives(archivesData);
    });

    // ================== Impression ==================
    printButton.addEventListener('click', () => {
        const monthValue = selectMonth.value;
        const filtered = archivesData.filter(item => {
            if (monthValue === 'current') return true;
            const itemMonth = item.date_cloture?.slice(0,7);
            return itemMonth === monthValue;
        });

        alert(`Impression de ${filtered.length} archives pour : ${monthValue}`);
    });

    // ================== Initialisation ==================
    await chargerArchives();

});
