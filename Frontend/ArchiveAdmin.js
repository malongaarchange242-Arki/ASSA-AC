document.addEventListener('DOMContentLoaded', async () => {
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

    /* =====================================================
       CONFIG
    ===================================================== */
    const TOKEN_KEY = 'jwtTokenAdmin';
    const REFRESH_KEY = 'refreshTokenAdmin';
    const API_BASE = 'https://assa-ac-api.onrender.com';

    /* =====================================================
       AUTH
    ===================================================== */
    let token = localStorage.getItem(TOKEN_KEY);
    const getLocale = () => localStorage.getItem('lang') === 'en' ? 'en-US' : 'fr-FR';
    const archiveTypeKeys = {
        'creation de facture': 'archive_type_invoice_created',
        'création de facture': 'archive_type_invoice_created',
        'creation de compagnie': 'archive_type_company_created',
        'création de compagnie': 'archive_type_company_created',
        'mise a jour de compagnie': 'archive_type_company_updated',
        'mise à jour de compagnie': 'archive_type_company_updated',
        'archivage de compagnie': 'archive_type_company_archived',
        'restauration de compagnie': 'archive_type_company_restored',
        "archivage d'administrateur": 'archive_type_admin_archived',
        'archivage d’administrateur': 'archive_type_admin_archived',
        "restauration d'administrateur": 'archive_type_admin_restored',
        'restauration d’administrateur': 'archive_type_admin_restored',
        'archivage de facture': 'archive_type_invoice_archived',
        'restauration de facture': 'archive_type_invoice_restored',
        'confirmation de paiement': 'archive_type_payment_confirmed'
    };

    const localizeArchiveType = type => {
        const key = archiveTypeKeys[String(type || '').trim().toLocaleLowerCase('fr-FR')];
        return key ? t(key) : (type || '-');
    };

    const localizeArchiveStatus = status => {
        const normalized = String(status || '').trim().toLocaleLowerCase('fr-FR');
        const statusKeys = {
            payée: 'archive_status_paid',
            paye: 'archive_status_paid',
            impayée: 'archive_status_unpaid',
            impayee: 'archive_status_unpaid',
            contestée: 'archive_status_disputed',
            contestee: 'archive_status_disputed',
            validée: 'archive_status_validated',
            validee: 'archive_status_validated',
            rejetée: 'archive_status_rejected',
            rejetee: 'archive_status_rejected'
        };
        const key = statusKeys[normalized];
        return key ? t(key) : (status || '-');
    };

    if (!token) {
        alert(t('not_connected'));
        window.location.href = 'login.html';
        return;
    }

    const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

    const setToken = (newToken) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        token = newToken;
    };

    const clearTokens = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
    };

    async function refreshToken() {
        try {
            const res = await fetch(`${API_BASE}/admins/token/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: getRefreshToken() })
            });

            if (!res.ok) return false;

            const data = await res.json();
            if (data.token) {
                setToken(data.token);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    async function fetchWithAuth(url, options = {}) {
        options.headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        };

        let res = await fetch(url, options);

        if (res.status === 401) {
            const refreshed = await refreshToken();
            if (!refreshed) {
                clearTokens();
                alert(t('session_expired'));
                window.location.href = 'login.html';
                throw new Error('Token expiré');
            }
            options.headers.Authorization = `Bearer ${token}`;
            res = await fetch(url, options);
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Erreur API');

        return data;
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
        return date.toLocaleDateString(getLocale()) + ' ' +
            date.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
    };

    const formatAmount = (n) => {
        if (!n) return '-';
        return new Intl.NumberFormat(getLocale()).format(n) + ' XAF';
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
    
        const now = new Date();
        const options = [
            new Option(`${t('current_month')} (${now.toLocaleString(getLocale(), { month: 'long', year: 'numeric' })})`, 'current'),
            new Option(t('last_month'), 'last')
        ];

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
                const label = new Date(y, m - 1).toLocaleString(getLocale(), {
                    month: 'long',
                    year: 'numeric'
                });
                options.push(new Option(label, key));
            });

        select.replaceChildren(...options);
        select.value = selectedValue;
    }
    
    

    /* =====================================================
       TABLE
    ===================================================== */
    const createArchiveRow = (a) => {
        const tr = document.createElement('tr');

        [localizeArchiveType(a.type), a.ref || '-', a.compagnie_nom || '-', formatDate(a.date_cloture)].forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            tr.appendChild(cell);
        });

        const actionsCell = document.createElement('td');
        actionsCell.className = 'table-actions';
        const viewButton = document.createElement('button');
        viewButton.type = 'button';
        viewButton.className = 'view-btn';
        viewButton.title = t('archive_view_details');
        viewButton.setAttribute('aria-label', t('archive_view_details_of'));
        viewButton.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i>';
        const pdfButton = document.createElement('button');
        pdfButton.type = 'button';
        pdfButton.className = 'pdf-btn';
        pdfButton.title = t('archive_download_pdf');
        pdfButton.setAttribute('aria-label', t('archive_download_pdf_of'));
        pdfButton.innerHTML = '<i class="fas fa-file-pdf" aria-hidden="true"></i>';
        actionsCell.append(viewButton, pdfButton);
        tr.appendChild(actionsCell);

        viewButton.addEventListener('click', () => openModal(a));
        pdfButton.addEventListener('click', () => generateArchivePDF(a));

        return tr;
    };

    const renderTable = (data) => {
        archiveTableBody.innerHTML = '';

        if (!data.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.className = 'archive-empty-cell';
            cell.colSpan = 5;
            cell.textContent = t('archive_empty');
            row.appendChild(cell);
            archiveTableBody.replaceChildren(row);
            return;
        }

        data.forEach(a => archiveTableBody.appendChild(createArchiveRow(a)));
    };

    /* =====================================================
       LOAD ARCHIVES
    ===================================================== */
    const loadArchives = async (monthValue = 'current') => {
        archiveTableBody.setAttribute('aria-busy', 'true');
        archiveTableBody.innerHTML = Array.from({ length: 3 }, () => `
            <tr class="admin-skeleton-row">
                ${Array.from({ length: 5 }, () => '<td><span class="admin-skeleton admin-skeleton-block"></span></td>').join('')}
            </tr>
        `).join('');
        try {
            const { mois, annee } = getMonthParams(monthValue);
            const res = await fetchWithAuth(
                `${API_BASE}/api/archives?mois=${mois}&annee=${annee}`
            );
    
            archivesData = res.archives || [];
    
            populateMonthSelect(archivesData, monthValue);
            paginateArchives(archivesData, 6);
            archiveTableBody.setAttribute('aria-busy', 'false');

        } catch (error) {
            console.error('Erreur chargement archives :', error);
            archiveTableBody.setAttribute('aria-busy', 'false');
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.className = 'archive-error-cell';
            cell.textContent = `${t('archive_load_error')} `;
            const retryButton = document.createElement('button');
            retryButton.type = 'button';
            retryButton.textContent = t('archive_retry');
            retryButton.addEventListener('click', () => loadArchives(monthValue));
            cell.appendChild(retryButton);
            row.appendChild(cell);
            archiveTableBody.replaceChildren(row);
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
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.className = 'archive-empty-cell';
                cell.colSpan = 5;
                cell.textContent = t('archive_empty');
                row.appendChild(cell);
                archiveTableBody.replaceChildren(row);
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
        modalTitle.textContent = localizeArchiveType(a.type);
        modalContent.innerHTML = renderArchiveDetails(a);
        
        // CORRECTION : Utilisez 'open' pour correspondre au CSS du Side Panel
        modal.classList.add('open'); 
    };
    
    // Écouteur sur le modal (Side Panel)
    modal.addEventListener('click', (e) => {
        // 1. Détection du bouton PDF
        // On utilise e.currentTarget si besoin, mais closest est très bien
        const pdfBtn = e.target.closest('.btn-pdf') || e.target.closest('.pdf-btn');
        
        if (pdfBtn) {
            // Empêche la fermeture du modal lors du clic sur le bouton
            e.preventDefault();
            e.stopPropagation(); 
            
            if (!currentArchive) return alert(t('archive_no_selection'));
            generateArchivePDF(currentArchive);
            return; 
        }
    
        // 2. Gestion de la fermeture
        if (
            e.target.closest('.close-btn') || 
            e.target === modal // Clic sur l'overlay (fond gris)
        ) {
            modal.classList.remove('open');
        }
    });
    const renderArchiveDetails = (a) => `
        <div class="modal-section">
            <h4>${t('archive_general_info')}</h4>
            <div class="modal-row"><span>${t('archive_type')}</span><span>${localizeArchiveType(a.type)}</span></div>
            <div class="modal-row"><span>${t('archive_date')}</span><span>${formatDate(a.date_cloture)}</span></div>
            <div class="modal-row"><span>${t('archive_administrator')}</span><span>${a.admin_nom || '-'}</span></div>
        </div>

        ${a.compagnie_nom ? `
        <div class="modal-section">
            <h4>${t('archive_company')}</h4>
            <div class="modal-row"><span>${t('archive_name')}</span><span>${a.compagnie_nom}</span></div>
        </div>` : ''}

        ${a.ref ? `
        <div class="modal-section">
            <h4>${t('archive_invoice')}</h4>
            <div class="modal-row"><span>${t('archive_reference')}</span><span>${a.ref}</span></div>
            <div class="modal-row"><span>${t('archive_amount')}</span><span>${formatAmount(a.montant)}</span></div>
            <div class="modal-row"><span>${t('archive_status')}</span><span>${localizeArchiveStatus(a.statut)}</span></div>
        </div>` : ''}

        <div class="modal-footer">
            <button class="btn-primary btn-pdf">
                <i class="fas fa-file-pdf"></i> ${t('archive_download_pdf_button')}
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
            doc.text(t('archive_pdf_agency'), marginLeft, y);
    
            y += 5;
            doc.text(t('archive_pdf_country'), marginLeft, y);
    
            y += 6;
            doc.line(marginLeft, y, 190, y);
    
            /* =========================
               TITLE
            ========================= */
            y += 15;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(t('archive_pdf_title'), 105, y, { align: 'center' });
    
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
    
            drawRow(`${t('archive_type')} :`, localizeArchiveType(a.type));
            drawRow(`${t('archive_date')} :`, formatDate(a.date_cloture));
            drawRow(`${t('archive_administrator')} :`, a.admin_nom);
            drawRow(`${t('archive_company')} :`, a.compagnie_nom);
            drawRow(`${t('archive_reference')} :`, a.ref || '-');
            drawRow(`${t('archive_amount')} :`, a.montant ? formatAmount(a.montant) : '-');
            drawRow(`${t('archive_status')} :`, localizeArchiveStatus(a.statut));
    
            /* =========================
               FOOTER
            ========================= */
            y += 10;
            doc.line(marginLeft, y, 190, y);
    
            y += 8;
            doc.setFontSize(9);
            doc.text(
                t('archive_pdf_footer').replace('{date}', new Date().toLocaleDateString(getLocale())),
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
            alert(t('archive_pdf_error'));
        };
    };
    
    selectMonth.addEventListener("change", () => {
        loadArchives(selectMonth.value);
    });
    
    document.getElementById("csv-btn").addEventListener("click", downloadArchiveCSV);

window.addEventListener('app-language-change', () => {
    populateMonthSelect(archivesData, selectMonth.value || 'current');
    paginateArchives(archivesData, 6);
    if (modal.classList.contains('open') && currentArchive) {
        modalTitle.textContent = localizeArchiveType(currentArchive.type);
        modalContent.innerHTML = renderArchiveDetails(currentArchive);
    }
});

function downloadArchiveCSV() {
    if (!archivesData.length) {
        alert(t('archive_no_data_export'));
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
        alert(t('archive_no_month_export'));
        return;
    }

    // 🔥 Génération CSV
    const headers = [
        t('archive_csv_type'),
        t('archive_csv_administrator'),
        t('archive_csv_company'),
        t('archive_csv_date'),
        t('archive_csv_reference'),
        t('archive_csv_amount'),
        t('archive_csv_status')
    ];

    const rows = filtered.map(a => [
        localizeArchiveType(a.type),
        a.admin_nom || "",
        a.compagnie_nom || "",
        new Date(a.date_cloture).toLocaleDateString(getLocale()),
        a.ref || "",
        a.montant || "",
        localizeArchiveStatus(a.statut)
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
