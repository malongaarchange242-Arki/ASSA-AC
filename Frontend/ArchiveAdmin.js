document.addEventListener('DOMContentLoaded', async () => {

    /* =====================================================
       1. GESTION DU THÈME (Interface)
    ===================================================== */
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            if (themeToggle) {
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                themeToggle.title = "Passer au Mode Clair";
            }
        } else {
            body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
            if (themeToggle) {
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                themeToggle.title = "Passer au Mode Sombre";
            }
        }
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }

    /* =====================================================
       2. CONFIGURATION API & AUTH (Cookies HTTP-Only)
    ===================================================== */
    const API_BASE = 'https://assa-ac-jyn4.onrender.com';

    // Note: Plus de TOKEN_KEY ni de setToken manuel. 
    // Le navigateur gère les cookies via credentials: 'include'.

    async function refreshToken() {
        try {
            const res = await fetch(`${API_BASE}/admins/token/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include' // Envoie le Refresh Cookie au serveur
            });
            return res.ok; 
        } catch {
            return false;
        }
    }

    async function fetchWithAuth(url, options = {}) {
        // Obligatoire pour envoyer/recevoir des cookies HTTP-Only
        options.credentials = 'include';
        
        options.headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        let res = await fetch(url, options);

        // Si 401 (Non autorisé/Expiré), on tente le refresh
        if (res.status === 401) {
            const refreshed = await refreshToken();
            if (!refreshed) {
                alert('Session expirée. Veuillez vous reconnecter.');
                window.location.href = 'login.html';
                throw new Error('Session expirée');
            }
            // Deuxième tentative après refresh réussi
            res = await fetch(url, options);
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Erreur API');

        return data;
    }

    /* =====================================================
       3. ÉLÉMENTS DU DOM & ÉTAT
    ===================================================== */
    const archiveTableBody = document.querySelector('.archive-table tbody');
    const selectMonth = document.getElementById('select-month');
    const modal = document.getElementById('archiveModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    let archivesData = [];
    let currentArchive = null;

    /* =====================================================
       4. HELPERS
    ===================================================== */
    const formatDate = (d) => {
        if (!d) return '-';
        const date = new Date(d);
        return date.toLocaleDateString('fr-FR') + ' ' +
            date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatAmount = (n) => {
        if (!n) return '-';
        return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
    };

    const getMonthParams = (value) => {
        const now = new Date();
        if (value === 'current') return { mois: now.getMonth() + 1, annee: now.getFullYear() };
        if (value === 'last') {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return { mois: lastMonth.getMonth() + 1, annee: lastMonth.getFullYear() };
        }
        const [annee, mois] = value.split('-');
        return { mois: Number(mois), annee: Number(annee) };
    };

    function populateMonthSelect(archives = [], selectedValue = 'current') {
        if (!selectMonth) return;
        selectMonth.innerHTML = "";
        const now = new Date();
        
        selectMonth.innerHTML += `
            <option value="current">Mois en cours (${now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })})</option>
            <option value="last">Mois dernier</option>
        `;

        const months = new Set();
        archives.forEach(a => {
            const d = new Date(a.date_cloture);
            if (!isNaN(d)) months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        });

        [...months].sort((a, b) => b.localeCompare(a)).forEach(key => {
            const [y, m] = key.split("-");
            const label = new Date(y, m - 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
            selectMonth.innerHTML += `<option value="${key}">${label}</option>`;
        });
        selectMonth.value = selectedValue;
    }

    /* =====================================================
       5. LOGIQUE TABLEAU & PAGINATION
    ===================================================== */
    const createArchiveRow = (a) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${a.type}</td>
            <td>${a.admin_nom || '-'}</td>
            <td>${a.compagnie_nom || '-'}</td>
            <td>${formatDate(a.date_cloture)}</td>
            <td class="table-actions">
                <button class="view-btn"><i class="fas fa-eye"></i></button>
                <button class="pdf-btn"><i class="fas fa-file-pdf"></i></button>
            </td>
        `;
        tr.querySelector('.view-btn').onclick = () => openModal(a);
        tr.querySelector('.pdf-btn').onclick = () => generateArchivePDF(a);
        return tr;
    };

    function paginateArchives(data, rowsPerPage = 6) {
        const pagination = document.getElementById("pagination");
        let currentPage = 1;

        const renderPage = () => {
            archiveTableBody.innerHTML = "";
            const pageData = data.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
            if (!pageData.length) {
                archiveTableBody.innerHTML = `<tr><td colspan="5">Aucune archive disponible</td></tr>`;
                return;
            }
            pageData.forEach(a => archiveTableBody.appendChild(createArchiveRow(a)));
        };

        const renderPagination = () => {
            if (!pagination) return;
            pagination.innerHTML = "";
            const totalPages = Math.ceil(data.length / rowsPerPage);
            if (totalPages <= 1) return;

            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement("button");
                btn.textContent = i;
                btn.classList.toggle("active", i === currentPage);
                btn.onclick = () => { currentPage = i; renderPage(); renderPagination(); };
                pagination.appendChild(btn);
            }
        };

        renderPage();
        renderPagination();
    }

    const loadArchives = async (monthValue = 'current') => {
        try {
            const { mois, annee } = getMonthParams(monthValue);
            const res = await fetchWithAuth(`${API_BASE}/api/archives?mois=${mois}&annee=${annee}`);
            archivesData = res.archives || [];
            populateMonthSelect(archivesData, monthValue);
            paginateArchives(archivesData, 6);
        } catch (err) {
            console.error(err);
            archiveTableBody.innerHTML = `<tr><td colspan="6">Erreur lors du chargement</td></tr>`;
        }
    };

  const openModal = (a) => {
    currentArchive = a;
    modalTitle.textContent = "Détails de l'opération";
    
    // On prépare l'affichage du montant
    const montantAffiche = a.montant_total ? formatAmount(a.montant_total) : (a.montant ? formatAmount(a.montant) : '0 FCFA');

    modalContent.innerHTML = `
        <div class="modal-section">
            <h4><i class="fas fa-info-circle"></i> Informations</h4>
            <div class="modal-row">
                <span>Type d'opération</span>
                <span>${a.type}</span>
            </div>
            <div class="modal-row">
                <span>Date et heure</span>
                <span>${formatDate(a.date_cloture)}</span>
            </div>
            <div class="modal-row">
                <span>Agent responsable</span>
                <span>${a.admin_nom || '-'}</span>
            </div>
        </div>

        ${a.compagnie_nom ? `
        <div class="modal-section">
            <h4><i class="fas fa-building"></i> Compagnie</h4>
            <div class="modal-row">
                <span>Nom de l'entité</span>
                <span>${a.compagnie_nom}</span>
            </div>
        </div>` : ''}

        <div class="modal-section">
            <h4><i class="fas fa-file-invoice"></i> Détails Financiers</h4>
            <div class="modal-row">
                <span>N° Facture</span>
                <span>${a.numero_facture || a.ref || 'N/A'}</span>
            </div>
            <div class="modal-row">
                <span>Montant Total</span>
                <span style="color: var(--accent); font-size: 1.1rem; font-weight: 700;">
                    ${montantAffiche}
                </span>
            </div>
            <div class="modal-row">
                <span>Statut final</span>
                <span class="status-badge ${String(a.statut).toLowerCase()}">${a.statut || 'Inactif'}</span>
            </div>
        </div>

        <div class="modal-footer">
            <button class="btn-primary btn-pdf" style="width: 100%; justify-content: center; padding: 12px; gap: 10px;">
                <i class="fas fa-file-pdf"></i> Télécharger le rapport complet
            </button>
        </div>
    `;
    
    const modalOverlay = document.getElementById('archiveModal');
    modalOverlay.classList.add('active');
};
    modal.addEventListener('click', (e) => {
        if (e.target.closest('.btn-pdf')) generateArchivePDF(currentArchive);
        if (e.target.classList.contains('close-modal') || e.target.classList.contains('close-btn')) modal.classList.remove('active');
    });

    const generateArchivePDF = (a) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const logo = new Image();
        logo.src = 'logo.jpeg';

        logo.onload = () => {
            doc.addImage(logo, 'PNG', 160, 10, 30, 30);
            doc.setFont('helvetica', 'bold').setFontSize(12).text("ASSA-AC", 20, 20);
            doc.setFontSize(10).setFont('helvetica', 'normal').text("Agence de Supervision de la Sécurité de l’Aviation Civile", 20, 26);
            doc.text("République du Congo", 20, 31);
            doc.line(20, 37, 190, 37);
            doc.setFontSize(14).setFont('helvetica', 'bold').text("RAPPORT D’ARCHIVE", 105, 52, { align: 'center' });

            let y = 67;
            const drawRow = (label, value) => {
                doc.setFont('helvetica', 'bold').text(label, 20, y);
                doc.setFont('helvetica', 'normal').text(value ? String(value) : '-', 75, y, { maxWidth: 110 });
                y += 8;
            };

            drawRow("Type :", a.type);
            drawRow("Date :", formatDate(a.date_cloture));
            drawRow("Administrateur :", a.admin_nom);
            drawRow("Compagnie :", a.compagnie_nom);
            drawRow("Référence :", a.ref);
            drawRow("Montant :", a.montant ? formatAmount(a.montant) : '-');
            drawRow("Statut :", a.statut);

            doc.save(`archive_${a.ref || Date.now()}.pdf`);
        };
        logo.onerror = () => alert("Erreur chargement logo");
    };

    function downloadArchiveCSV() {
        if (!archivesData.length) return alert("Aucune donnée");
        const headers = ["Type", "Administrateur", "Compagnie", "Date", "Référence", "Montant", "Statut"];
        let csv = "\uFEFF" + headers.join(";") + "\n";
        
        archivesData.forEach(a => {
            const row = [a.type, a.admin_nom, a.compagnie_nom, formatDate(a.date_cloture), a.ref, a.montant, a.statut];
            csv += row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(";") + "\n";
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `archives_export.csv`;
        link.click();
    }

    /* =====================================================
       7. INITIALISATION & LISTENERS
    ===================================================== */
    selectMonth?.addEventListener("change", () => loadArchives(selectMonth.value));
    document.getElementById("csv-btn")?.addEventListener("click", downloadArchiveCSV);

    // Lancement initial
    await loadArchives();
});