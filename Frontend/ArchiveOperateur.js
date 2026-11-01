document.addEventListener('DOMContentLoaded', async () => {
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

     /* =====================================================
         CONFIG (operator-only tokens)
     ===================================================== */
     const TOKEN_KEY = 'jwtTokenOperateur';
     const operateurId = localStorage.getItem('operateurId');
     const API_BASE = 'https://assa-ac-api.onrender.com';

    /* =====================================================
       AUTH
    ===================================================== */
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        alert("Session opérateur manquante. Veuillez vous reconnecter.");
        window.location.href = 'Index.html';
        return;
    }

    const clearTokens = () => {
        localStorage.removeItem(TOKEN_KEY);
    };

    // No refresh flow for operator token on this page
    async function refreshToken() {
        return false;
    }

    async function fetchWithAuth(url, options = {}) {
        options.headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        };
        if (operateurId) options.headers['X-Operateur-Id'] = operateurId;

        let res = await fetch(url, options);

        if (res.status === 401) {
            const refreshed = await refreshToken();
            if (!refreshed) {
                clearTokens();
                alert('Session expirée');
                window.location.href = 'Index.html';
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
    const archiveTableBody = document.getElementById('archive-body');
    const selectMonth = document.getElementById('select-month');
    const selectActionType = document.getElementById('select-action-type');
    const searchActions = document.getElementById('search-actions');
    const clearFiltersButton = document.getElementById('clear-filters');

    const modal = document.getElementById('archiveModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    /* =====================================================
       STATE
    ===================================================== */
    let archivesData = [];
    let filteredArchives = [];
    let currentArchive = null;
    let currentPage = 1;
    const rowsPerPage = 6;
    const today = new Date();
    selectMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    /* =====================================================
       HELPERS
    ===================================================== */
    const formatDate = (d) => {
        if (!d) return '-';
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('fr-FR') + ' ' +
            date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatAmount = (n) => {
        if (!n) return '-';
        return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
    };

    const normalizeText = value => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase('fr-FR');

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);

    function populateFilterOptions(actions) {
        const selectedType = selectActionType.value || 'all';
        const options = new Map();
        actions.forEach(action => {
            const type = String(action.type || action.type_activite || 'Activité système').trim();
            if (type) options.set(normalizeText(type), type);
        });

        selectActionType.replaceChildren(new Option('Tous les types d’action', 'all'));
        [...options.entries()]
            .sort((left, right) => left[1].localeCompare(right[1], 'fr'))
            .forEach(([key, label]) => selectActionType.add(new Option(label, key)));
        selectActionType.value = [...options.keys()].includes(selectedType) ? selectedType : 'all';
    }

    function applyFilters() {
        const selectedPeriod = selectMonth.value;
        const selectedType = selectActionType.value || 'all';
        const searchTerm = normalizeText(searchActions.value);

        filteredArchives = archivesData.filter(action => {
            const dateValue = String(action.date_cloture || action.date_activite || action.created_at || '');
            const isoDate = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
            const date = isoDate ? null : new Date(dateValue);
            const actionDate = isoDate
                ? isoDate[1]
                : date && !Number.isNaN(date.getTime())
                    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                    : '';
            const matchesPeriod = !selectedPeriod || actionDate === selectedPeriod;
            const type = String(action.type || action.type_activite || 'Activité système');
            const matchesType = selectedType === 'all' || normalizeText(type) === selectedType;
            const searchValues = [type, action.ref, action.admin_nom, action.utilisateur, action.compagnie_nom, action.description, action.module, action.categorie];
            const matchesSearch = !searchTerm || searchValues.some(value => normalizeText(value).includes(searchTerm));
            return matchesPeriod && matchesType && matchesSearch;
        });
        currentPage = 1;
        renderPage();
    }

    /* =====================================================
       TABLE
    ===================================================== */
    const createArchiveRow = (a) => {
        const tr = document.createElement('tr');
        const isCompanyAction = /company|compagn/i.test(`${a.categorie || ''} ${a.module || ''} ${a.type || ''}`);
        const reference = isCompanyAction
            ? a.compagnie_nom || a.company_name || a.ref || '-'
            : a.ref || '-';
        [a.type || 'Activité système', reference, a.admin_nom || a.utilisateur || a.compagnie_nom || '-', formatDate(a.date_cloture)].forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = String(value || '-');
            tr.appendChild(cell);
        });

        const actionsCell = document.createElement('td');
        actionsCell.className = 'table-actions';
        const viewButton = document.createElement('button');
        viewButton.type = 'button';
        viewButton.className = 'view-btn';
        viewButton.title = 'Voir les détails';
        viewButton.setAttribute('aria-label', 'Voir les détails de cette action');
        viewButton.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i>';
        const pdfButton = document.createElement('button');
        pdfButton.type = 'button';
        pdfButton.className = 'pdf-btn';
        pdfButton.title = 'Télécharger en PDF';
        pdfButton.setAttribute('aria-label', 'Télécharger cette action en PDF');
        pdfButton.innerHTML = '<i class="fas fa-file-pdf" aria-hidden="true"></i>';
        actionsCell.append(viewButton, pdfButton);
        tr.appendChild(actionsCell);

        viewButton.addEventListener('click', () => openModal(a));
        pdfButton.addEventListener('click', () => generateArchivePDF(a));

        return tr;
    };

    function renderPage() {
        archiveTableBody.replaceChildren();
        const totalPages = Math.max(1, Math.ceil(filteredArchives.length / rowsPerPage));
        currentPage = Math.min(currentPage, totalPages);
        const pageData = filteredArchives.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

        if (!pageData.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.className = 'archive-empty-cell';
            cell.colSpan = 5;
            cell.textContent = 'Aucune action ne correspond aux filtres.';
            row.appendChild(cell);
            archiveTableBody.appendChild(row);
        } else {
            pageData.forEach(action => archiveTableBody.appendChild(createArchiveRow(action)));
        }

        const pagination = document.getElementById('pagination');
        pagination.replaceChildren();
        const previousButton = document.createElement('button');
        previousButton.type = 'button';
        previousButton.disabled = currentPage === 1;
        previousButton.innerHTML = '<i class="fas fa-chevron-left" aria-hidden="true"></i><span>Précédent</span>';
        previousButton.addEventListener('click', () => {
            currentPage = Math.max(1, currentPage - 1);
            renderPage();
        });
        const pageLabel = document.createElement('span');
        pageLabel.className = 'pagination-page';
        pageLabel.setAttribute('aria-live', 'polite');
        pageLabel.textContent = `Page ${currentPage} sur ${totalPages}`;
        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.disabled = currentPage === totalPages;
        nextButton.innerHTML = '<span>Suivant</span><i class="fas fa-chevron-right" aria-hidden="true"></i>';
        nextButton.addEventListener('click', () => {
            currentPage = Math.min(totalPages, currentPage + 1);
            renderPage();
        });
        pagination.append(previousButton, pageLabel, nextButton);
    }

    const loadArchives = async () => {
        archiveTableBody.setAttribute('aria-busy', 'true');
        archiveTableBody.innerHTML = Array.from({ length: 3 }, () =>
            `<tr class="admin-skeleton-row">${Array.from({ length: 5 }, () => '<td><span class="admin-skeleton admin-skeleton-block"></span></td>').join('')}</tr>`
        ).join('');
        try {
            const [archiveResponse, journalResponse] = await Promise.all([
                fetchWithAuth(`${API_BASE}/api/archives`),
                fetchWithAuth(`${API_BASE}/api/journal/operateur/me`)
            ]);
            if (!Array.isArray(archiveResponse.archives) || !Array.isArray(journalResponse.activites)) {
                throw new Error('Les réponses des archives ou du journal sont invalides.');
            }
            const archivedActions = archiveResponse.archives.map(action => ({
                ...action,
                date_cloture: action.date_cloture || action.created_at
            }));
            const journalActions = journalResponse.activites.map(action => ({
                type: action.type_activite || 'Activité système',
                categorie: action.categorie,
                module: action.module,
                ref: action.numero_facture || action.reference || action.id,
                compagnie_id: action.id_companie,
                compagnie_nom: action.compagnie_nom || action.company_name || null,
                admin_nom: action.utilisateur || action.utilisateur_nom || action.utilisateur_email || '-',
                montant: action.montant ?? null,
                statut: action.statut || null,
                date_cloture: action.date_activite || action.created_at,
                description: action.description || '',
                role_utilisateur: action.role_utilisateur || '',
                source: 'activity'
            }));
            archivesData = [...archivedActions, ...journalActions]
                .sort((left, right) => new Date(right.date_cloture) - new Date(left.date_cloture));
            populateFilterOptions(archivesData);
            applyFilters();
        } catch (error) {
            console.error('Erreur chargement du registre opérateur :', error);
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.className = 'archive-error-cell';
            cell.colSpan = 5;
            cell.textContent = `Impossible de charger le registre : ${error.message} `;
            const retryButton = document.createElement('button');
            retryButton.type = 'button';
            retryButton.textContent = 'Réessayer';
            retryButton.addEventListener('click', loadArchives);
            cell.appendChild(retryButton);
            row.appendChild(cell);
            archiveTableBody.replaceChildren(row);
        } finally {
            archiveTableBody.setAttribute('aria-busy', 'false');
        }
    };
    

    /* =====================================================
       MODAL
    ===================================================== */
    const openModal = (a) => {
        currentArchive = a;
        modalTitle.textContent = a.type;
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
            
            if (!currentArchive) return alert('Aucune archive sélectionnée');
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
            <h4>Informations générales</h4>
            <div class="modal-row"><span>Type</span><span>${escapeHtml(a.type || 'Activité système')}</span></div>
            <div class="modal-row"><span>Date</span><span>${escapeHtml(formatDate(a.date_cloture))}</span></div>
            <div class="modal-row"><span>Utilisateur</span><span>${escapeHtml(a.admin_nom || a.utilisateur || '-')}</span></div>
        </div>

        ${a.compagnie_nom ? `
        <div class="modal-section">
            <h4>Compagnie</h4>
            <div class="modal-row"><span>Nom</span><span>${escapeHtml(a.compagnie_nom)}</span></div>
        </div>` : ''}

        ${a.ref ? `
        <div class="modal-section">
            <h4>Référence</h4>
            <div class="modal-row"><span>Référence</span><span>${escapeHtml(a.ref)}</span></div>
            <div class="modal-row"><span>Montant</span><span>${escapeHtml(formatAmount(a.montant))}</span></div>
            <div class="modal-row"><span>Statut</span><span>${escapeHtml(a.statut || '-')}</span></div>
        </div>` : ''}

        ${a.description ? `<div class="modal-section"><h4>Description</h4><p>${escapeHtml(a.description)}</p></div>` : ''}
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
    
    selectMonth.addEventListener("change", applyFilters);
    selectActionType.addEventListener("change", applyFilters);
    searchActions.addEventListener("input", applyFilters);
    clearFiltersButton.addEventListener("click", () => {
        selectMonth.value = '';
        selectActionType.value = 'all';
        searchActions.value = '';
        applyFilters();
    });
    document.getElementById("csv-btn").addEventListener("click", downloadArchiveCSV);

function downloadArchiveCSV() {
    if (!filteredArchives.length) {
        alert("Aucune donnée à exporter");
        return;
    }

    const headers = [
        "Type",
        "Utilisateur",
        "Compagnie",
        "Date",
        "Référence",
        "Description",
        "Montant",
        "Statut"
    ];

    const rows = filteredArchives.map(a => [
        a.type,
        a.admin_nom || a.utilisateur || "",
        a.compagnie_nom || "",
        formatDate(a.date_cloture),
        a.ref || "",
        a.description || "",
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
    a.download = `actions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
}


    /* =====================================================
       INIT
    ===================================================== */
    await loadArchives();
   


});
