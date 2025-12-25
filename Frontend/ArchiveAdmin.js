document.addEventListener('DOMContentLoaded', async () => {

    /* =============================
       THEME (OK avec localStorage)
    ============================= */
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    function applyTheme(theme) {
        body.classList.toggle('dark-mode', theme === 'dark');
        localStorage.setItem('theme', theme);
        if (themeToggle) {
            themeToggle.innerHTML =
                theme === 'dark'
                    ? '<i class="fas fa-sun"></i>'
                    : '<i class="fas fa-moon"></i>';
        }
    }

    applyTheme(
        localStorage.getItem('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    );

    themeToggle?.addEventListener('click', () => {
        applyTheme(body.classList.contains('dark-mode') ? 'light' : 'dark');
    });

    /* =============================
       CONFIG API
    ============================= */
    const API_BASE = 'https://assa-ac-jyn4.onrender.com';

    /* =============================
       FETCH AUTH (COOKIE)
    ============================= */
    async function fetchWithAuth(url, options = {}) {
        const res = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        });

        if (res.status === 401) {
            window.location.href = 'login.html';
            throw new Error('Non authentifié');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Erreur serveur');

        return data;
    }

    /* =============================
       SESSION CHECK
    ============================= */
    try {
        await fetchWithAuth(`${API_BASE}/auth/me`);
    } catch {
        return;
    }


    /* =====================================================
       DOM
    ===================================================== */
    const archiveTableBody = document.querySelector('.archive-table tbody');
    const filterBtn = document.querySelector('.action-buttons button:first-child');
    const resetBtn = document.querySelector('.action-buttons button:nth-child(2)');
    const printBtn = document.querySelector('.print-btn');
    const selectMonth = document.getElementById('select-month');

    const modal = document.getElementById('archiveModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    /* =====================================================
       STATE
    ===================================================== */
    let archivesData = [];
    let currentArchive = null;

    /* =====================================================
       HELPERS
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
    
        // 🔹 Mois en cours
        if (value === 'current') {
            return {
                mois: now.getMonth() + 1,
                annee: now.getFullYear()
            };
        }
    
        // 🔹 Mois dernier
        if (value === 'last') {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return {
                mois: lastMonth.getMonth() + 1,
                annee: lastMonth.getFullYear()
            };
        }
    
        // 🔹 Mois précis (ex: 2025-09)
        const [annee, mois] = value.split('-');
        return {
            mois: Number(mois),
            annee: Number(annee)
        };
    };
    

    function populateMonthSelect(archives = [], selectedValue = 'current') {
        const select = document.getElementById("select-month");
        if (!select) return;
    
        select.innerHTML = "";
    
        const now = new Date();
    
        // Mois en cours
        select.innerHTML += `
            <option value="current">
                Mois en cours (${now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })})
            </option>
            <option value="last">Mois dernier</option>
        `;
    
        const months = new Set();
    
        archives.forEach(a => {
            const d = new Date(a.date_cloture);
            if (!isNaN(d)) {
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                months.add(key);
            }
        });
    
        [...months]
            .sort((a, b) => b.localeCompare(a))
            .forEach(key => {
                const [y, m] = key.split("-");
                const label = new Date(y, m - 1).toLocaleString('fr-FR', {
                    month: 'long',
                    year: 'numeric'
                });
    
                select.innerHTML += `<option value="${key}">${label}</option>`;
            });
    
        // 🔥 RESTAURATION DE LA SÉLECTION
        select.value = selectedValue;
    }
    
    

    /* =====================================================
       TABLE
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

    const renderTable = (data) => {
        archiveTableBody.innerHTML = '';

        if (!data.length) {
            archiveTableBody.innerHTML =
                `<tr><td colspan="6">Aucune archive disponible</td></tr>`;
            return;
        }

        data.forEach(a => archiveTableBody.appendChild(createArchiveRow(a)));
    };

    /* =====================================================
       LOAD ARCHIVES
    ===================================================== */
    const loadArchives = async (monthValue = 'current') => {
        try {
            const { mois, annee } = getMonthParams(monthValue);
            const res = await fetchWithAuth(
                `${API_BASE}/api/archives?mois=${mois}&annee=${annee}`
            );
    
            archivesData = res.archives || [];
    
            populateMonthSelect(archivesData, monthValue);
            paginateArchives(archivesData, 6);

    
        } catch {
            archiveTableBody.innerHTML =
                `<tr><td colspan="6">Erreur chargement archives</td></tr>`;
        }
    };
    

    function paginateArchives(data, rowsPerPage = 5) {
        const pagination = document.getElementById("pagination");
        let currentPage = 1;
    
        function renderPage() {
            archiveTableBody.innerHTML = "";
    
            const start = (currentPage - 1) * rowsPerPage;
            const end = start + rowsPerPage;
            const pageData = data.slice(start, end);
    
            if (!pageData.length) {
                archiveTableBody.innerHTML =
                    `<tr><td colspan="5">Aucune archive disponible</td></tr>`;
                return;
            }
    
            pageData.forEach(a => {
                archiveTableBody.appendChild(createArchiveRow(a));
            });
        }
    
        function renderPagination() {
            pagination.innerHTML = "";
            const totalPages = Math.ceil(data.length / rowsPerPage);
    
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
    
                pagination.appendChild(btn);
            }
        }
    
        renderPage();
        renderPagination();
    }
    

    /* =====================================================
       MODAL
    ===================================================== */
    const openModal = (a) => {
        currentArchive = a;
        modalTitle.textContent = a.type;
        modalContent.innerHTML = renderArchiveDetails(a);
        modal.classList.add('active');
    };

    modal.addEventListener('click', (e) => {

        if (e.target.closest('.btn-pdf')) {
            if (!currentArchive) return alert('Aucune archive sélectionnée');
            generateArchivePDF(currentArchive);
        }

        if (
            e.target.classList.contains('close-modal') ||
            e.target.classList.contains('close-btn')
        ) {
            modal.classList.remove('active');
        }
    });

    const renderArchiveDetails = (a) => `
        <div class="modal-section">
            <h4>Informations générales</h4>
            <div class="modal-row"><span>Type</span><span>${a.type}</span></div>
            <div class="modal-row"><span>Date</span><span>${formatDate(a.date_cloture)}</span></div>
            <div class="modal-row"><span>Administrateur</span><span>${a.admin_nom || '-'}</span></div>
        </div>

        ${a.compagnie_nom ? `
        <div class="modal-section">
            <h4>Compagnie</h4>
            <div class="modal-row"><span>Nom</span><span>${a.compagnie_nom}</span></div>
        </div>` : ''}

        ${a.ref ? `
        <div class="modal-section">
            <h4>Facture</h4>
            <div class="modal-row"><span>Référence</span><span>${a.ref}</span></div>
            <div class="modal-row"><span>Montant</span><span>${formatAmount(a.montant)}</span></div>
            <div class="modal-row"><span>Statut</span><span>${a.statut}</span></div>
        </div>` : ''}

        <div class="modal-footer">
            <button class="btn-primary btn-pdf">
                <i class="fas fa-file-pdf"></i> Télécharger PDF
            </button>
        </div>
    `;

    /* =====================================================
       PDF
    ===================================================== */
    const generateArchivePDF = (a) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
    
        const marginLeft = 20;
        let y = 20;
    
        /* =========================
           LOGO (TOP RIGHT)
        ========================= */
        const logo = new Image();
        logo.src = 'logo.jpeg';
    
        logo.onload = () => {
    
            doc.addImage(logo, 'PNG', 160, 10, 30, 30);
    
            /* =========================
               HEADER ASSA-AC
            ========================= */
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text("ASSA-AC", marginLeft, y);
    
            y += 6;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(
                "Agence de Supervision de la Sécurité de l’Aviation Civile",
                marginLeft,
                y
            );
    
            y += 5;
            doc.text("République du Congo", marginLeft, y);
    
            y += 6;
            doc.line(marginLeft, y, 190, y);
    
            /* =========================
               TITLE
            ========================= */
            y += 15;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("RAPPORT D’ARCHIVE", 105, y, { align: 'center' });
    
            y += 15;
    
            /* =========================
               CONTENT
            ========================= */
            const drawRow = (label, value) => {
                doc.setFont('helvetica', 'bold');
                doc.text(label, marginLeft, y);
    
                doc.setFont('helvetica', 'normal');
                doc.text(
                    value ? String(value) : '-',
                    marginLeft + 55,
                    y,
                    { maxWidth: 110 }
                );
    
                y += 8;
            };
    
            drawRow("Type :", a.type);
            drawRow("Date :", formatDate(a.date_cloture));
            drawRow("Administrateur :", a.admin_nom);
            drawRow("Compagnie :", a.compagnie_nom);
            drawRow("Référence :", a.ref || '-');
            drawRow("Montant :", a.montant ? formatAmount(a.montant) : '-');
            drawRow("Statut :", a.statut || '-');
    
            /* =========================
               FOOTER
            ========================= */
            y += 10;
            doc.line(marginLeft, y, 190, y);
    
            y += 8;
            doc.setFontSize(9);
            doc.text(
                `Document officiel – Usage interne | Généré le ${new Date().toLocaleDateString('fr-FR')}`,
                105,
                y,
                { align: 'center' }
            );
    
            /* =========================
               SAVE
            ========================= */
            doc.save(`archive_${a.ref || Date.now()}.pdf`);
        };
    
        logo.onerror = () => {
            alert("Logo introuvable : /assets/logo-assaac.png");
        };
    };
    
    selectMonth.addEventListener("change", () => {
        loadArchives(selectMonth.value);
    });
    
    document.getElementById("csv-btn").addEventListener("click", downloadArchiveCSV);

function downloadArchiveCSV() {
    if (!archivesData.length) {
        alert("Aucune donnée à exporter");
        return;
    }

    const select = document.getElementById("select-month");
    const value = select.value;
    const now = new Date();

    let startDate, endDate;

    // 📌 Mois en cours
    if (value === "current") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    // 📌 Mois dernier
    else if (value === "last") {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    }
    // 📌 Mois spécifique
    else {
        const [year, month] = value.split("-");
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
    }

    // 🔥 Filtrage des archives
    const filtered = archivesData.filter(a => {
        const d = new Date(a.date_cloture);
        return d >= startDate && d <= endDate;
    });

    if (!filtered.length) {
        alert("Aucune archive pour ce mois");
        return;
    }

    // 🔥 Génération CSV
    const headers = [
        "Type",
        "Administrateur",
        "Compagnie",
        "Date",
        "Référence",
        "Montant",
        "Statut"
    ];

    const rows = filtered.map(a => [
        a.type,
        a.admin_nom || "",
        a.compagnie_nom || "",
        new Date(a.date_cloture).toLocaleDateString("fr-FR"),
        a.ref || "",
        a.montant || "",
        a.statut || ""
    ]);

    let csv = headers.join(";") + "\n";
    rows.forEach(r => {
        csv += r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";") + "\n";
    });

    // 📥 Téléchargement
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `archives_${startDate.getFullYear()}_${startDate.getMonth() + 1}.csv`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


    /* =====================================================
       INIT
    ===================================================== */
    await loadArchives();
   
});
