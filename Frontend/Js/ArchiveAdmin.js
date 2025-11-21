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
            console.warn('Token expiré ou invalide, tentative de rafraîchissement...');
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

        if (res.status === 403) throw new Error('Accès interdit : permissions insuffisantes');

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Erreur API : ${res.status}`);
        return data;
    }

    // ================== Récupération des archives ==================
    const archiveTableBody = document.querySelector('.archive-table tbody');

    async function chargerArchives() {
        try {
            const archives = await fetchWithAuth('https://assa-ac.onrender.com/api/archives');
            console.log('Archives reçues :', archives);

            if (!Array.isArray(archives)) {
                archiveTableBody.innerHTML = '<tr><td colspan="6">Aucune archive disponible</td></tr>';
                return;
            }

            archiveTableBody.innerHTML = '';
            archives.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.type}</td>
                    <td>${item.reference}</td>
                    <td>${item.compagnie}</td>
                    <td>${item.montant ?? '-'}</td>
                    <td>${item.date_cloture ?? '-'}</td>
                    <td class="table-actions">
                        <button class="view-btn">Voir</button>
                        <button class="pdf-btn">PDF</button>
                    </td>
                `;
                archiveTableBody.appendChild(row);
            });

            // Ajouter les actions Vue / PDF
            ajouterActions();
        } catch (err) {
            console.error('Erreur fetch archives :', err);
            archiveTableBody.innerHTML = '<tr><td colspan="6">Impossible de récupérer les archives</td></tr>';
        }
    }

    // ================== Actions Vue / PDF ==================
    function ajouterActions() {
        const viewButtons = document.querySelectorAll('.table-actions .view-btn');
        const pdfButtons = document.querySelectorAll('.table-actions .pdf-btn');

        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const type = row.children[0].textContent;
                const ref = row.children[1].textContent;
                alert(`Voir ${type} : ${ref}`);
            });
        });

        pdfButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const type = row.children[0].textContent;
                const ref = row.children[1].textContent;
                alert(`Télécharger PDF pour ${type} : ${ref}`);
            });
        });
    }

    // ================== Filtrage par type ==================
    const filterButton = document.querySelector('.action-buttons button:first-child');
    filterButton.addEventListener('click', () => {
        const type = prompt('Filtrer par type (Facture, Compagnie, Devis) ou laisser vide pour tout afficher :');
        document.querySelectorAll('.archive-table tbody tr').forEach(row => {
            if (!type || row.children[0].textContent.trim() === type) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });

    // ================== Restaurer tous les éléments ==================
    const restoreButton = document.querySelector('.action-buttons button:nth-child(2)');
    restoreButton.addEventListener('click', () => {
        document.querySelectorAll('.archive-table tbody tr').forEach(row => row.style.display = '');
    });

    // ================== Impression par mois ==================
    const printButton = document.querySelector('.print-selector-group .print-btn');
    const selectMonth = document.getElementById('select-month');

    printButton.addEventListener('click', () => {
        const month = selectMonth.value;
        alert(`Impression des archives pour : ${month}`);
    });

    // ================== Initialisation ==================
    await chargerArchives();
});
