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
        'suppression définitive de compagnie': 'archive_type_company_deleted',
        "archivage d'administrateur": 'archive_type_admin_archived',
        'archivage d’administrateur': 'archive_type_admin_archived',
        "restauration d'administrateur": 'archive_type_admin_restored',
        'restauration d’administrateur': 'archive_type_admin_restored',
        'archivage de facture': 'archive_type_invoice_archived',
        'restauration de facture': 'archive_type_invoice_restored',
        'confirmation de paiement': 'archive_type_payment_confirmed',
        'create:facture': 'archive_type_invoice_created',
        'create:company': 'archive_type_company_created',
        'create:compagnie': 'archive_type_company_created',
        'update:company': 'archive_type_company_updated',
        'update:compagnie': 'archive_type_company_updated',
        'update:facture': 'activity_updated',
        'création:company': 'archive_type_company_created',
        'création:compagnie': 'archive_type_company_created',
        'création:facture': 'archive_type_invoice_created',
        'modification:company': 'archive_type_company_updated',
        'modification:compagnie': 'archive_type_company_updated',
        'archive:company': 'archive_type_company_archived',
        'archive:compagnie': 'archive_type_company_archived',
        'restore:company': 'archive_type_company_restored',
        'restore:compagnie': 'archive_type_company_restored',
        'delete:company': 'archive_type_company_deleted',
        'delete:compagnie': 'archive_type_company_deleted',
        'validate:facture': 'archive_type_invoice_validated',
        'reject:facture': 'archive_type_invoice_rejected',
        'submit:facture': 'archive_type_invoice_submitted',
        'delete:facture': 'archive_type_invoice_deleted',
        'login:auth': 'archive_type_login',
        'login:operateur': 'archive_type_login',
        'system:auth': 'archive_type_login',
        'security:sécurité': 'archive_type_security',
        'disable:operateur': 'archive_type_operator_disabled',
        create: 'activity_created',
        update: 'activity_updated',
        delete: 'activity_deleted',
        validate: 'activity_validated',
        reject: 'activity_rejected',
        submit: 'activity_submitted',
        system: 'activity_system_event',
        security: 'archive_type_security',
        disable: 'archive_type_operator_disabled',
        login: 'archive_type_login'
    };

    const getActionDomain = (action, reference = '') => {
        const category = String(action.categorie || '').trim().toLocaleLowerCase('fr-FR');
        const module = String(action.module || '').trim().toLocaleLowerCase('fr-FR');
        const description = String(action.description || '').trim().toLocaleLowerCase('fr-FR');
        if (category.includes('facture') || category.includes('invoice') ||
            module.includes('facture') || module.includes('invoice') ||
            description.includes('facture') || description.includes('invoice')) return 'facture';
        if (category.includes('company') || category.includes('compagn') ||
            module.includes('company') || module.includes('compagn') ||
            description.includes('compagnie') || description.includes('company') ||
            (action.compagnie_nom && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(reference)))) {
            return 'company';
        }
        if (category.includes('operateur') || category.includes('operator') ||
            module.includes('operateur') || module.includes('operator') ||
            description.includes('opérateur') || description.includes('operateur')) return 'operateur';
        if (category.includes('sécurité') || category.includes('security') ||
            module.includes('security') || description.includes('sécurité')) return 'sécurité';
        if (category.includes('auth') || module.includes('auth')) return 'auth';
        return category;
    };

    const getArchiveTypeTranslationKey = (action, reference = action.ref) => {
        const normalizedType = String(action.type || '').trim().toLocaleLowerCase('fr-FR');
        const domain = getActionDomain(action, reference);
        const specificKey = archiveTypeKeys[`${normalizedType}:${domain}`];
        if (specificKey) return specificKey;
        const exactKey = archiveTypeKeys[normalizedType];
        if (exactKey && !['activity_created', 'activity_updated', 'activity_deleted', 'activity_validated', 'activity_rejected', 'activity_submitted'].includes(exactKey)) {
            return exactKey;
        }
        return exactKey;
    };

    const localizeArchiveType = (type, category = '', context = {}) => {
        const normalizedType = String(type || '').trim().toLocaleLowerCase('fr-FR');
        const normalizedCategory = String(category || '').trim().toLocaleLowerCase('fr-FR');
        const action = { ...context, type, categorie: category || context.categorie };
        const key = archiveTypeKeys[`${normalizedType}:${normalizedCategory}`] ||
            getArchiveTypeTranslationKey(action, context.ref);
        return key ? t(key) : (type || '-');
    };

    const getInvoiceReferenceFromDescription = description =>
        String(description || '').match(/\b[A-Z0-9]+-\d{3}\/\d{2}\/\d{4}\/ASSA-AC\/DAF\b/i)?.[0] || null;

    const isCompanyAction = action => {
        const type = String(action.type || '').trim().toLocaleLowerCase('fr-FR');
        return type.includes('compagnie') || getActionDomain(action, action.ref) === 'company';
    };

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);

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

    function populateMonthSelect(archives = [], selectedValue = 'all') {
        const select = document.getElementById("select-month");
        if (!select) return;
    
        const now = new Date();
        const options = [
            new Option(t('all_periods'), 'all'),
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

    const getActionTypeKey = action => {
        const translationKey = getArchiveTypeTranslationKey(action);
        if (translationKey) return `translation:${translationKey}`;
        const type = String(action.type || '').trim().toLocaleLowerCase('fr-FR');
        const category = String(action.categorie || '').trim().toLocaleLowerCase('fr-FR');
        return `type:${type}:${category}`;
    };

    const populateActionTypeSelect = (actions = [], selectedValue = 'all') => {
        const optionsByKey = new Map();
        actions.forEach(action => {
            const key = getActionTypeKey(action);
            if (!optionsByKey.has(key)) {
                optionsByKey.set(key, localizeArchiveType(action.type, action.categorie, action));
            }
        });

        const options = [new Option(t('all_action_types'), 'all')];
        [...optionsByKey.entries()]
            .sort((a, b) => a[1].localeCompare(b[1], getLocale()))
            .forEach(([key, label]) => options.push(new Option(label, key)));
        selectActionType.replaceChildren(...options);
        selectActionType.value = selectedValue === 'all' || optionsByKey.has(selectedValue)
            ? selectedValue
            : 'all';
    };
    
    

    /* =====================================================
       TABLE
    ===================================================== */
    const createArchiveRow = (a) => {
        const tr = document.createElement('tr');
        const referenceOrCompany = isCompanyAction(a)
            ? a.compagnie_nom || a.company_name || a.ref || '-'
            : a.ref || '-';

        [localizeArchiveType(a.type, a.categorie, a), referenceOrCompany, a.admin_nom || a.compagnie_nom || '-', formatDate(a.date_cloture)].forEach(value => {
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
    const applyFilters = () => {
        const period = selectMonth.value || 'all';
        const selectedActionType = selectActionType.value || 'all';
        const searchTerm = searchActions.value.trim().toLocaleLowerCase(getLocale());
        let periodActions;
        if (period === 'all') {
            periodActions = allActionsData;
        } else {
            const now = new Date();
            let year = now.getFullYear();
            let month = now.getMonth();

            if (period === 'last') {
                const lastMonth = new Date(year, month - 1, 1);
                year = lastMonth.getFullYear();
                month = lastMonth.getMonth();
            } else if (period !== 'current') {
                const [selectedYear, selectedMonth] = period.split('-').map(Number);
                year = selectedYear;
                month = selectedMonth - 1;
            }

            periodActions = allActionsData.filter(action => {
                const date = new Date(action.date_cloture);
                return !Number.isNaN(date.getTime()) &&
                    date.getFullYear() === year &&
                    date.getMonth() === month;
            });
        }

        archivesData = periodActions.filter(action => {
            if (selectedActionType !== 'all' && getActionTypeKey(action) !== selectedActionType) return false;
            if (!searchTerm) return true;

            const searchableValues = [
                localizeArchiveType(action.type, action.categorie, action),
                action.ref,
                action.admin_nom,
                action.compagnie_nom,
                action.description,
                action.module,
                action.categorie
            ];
            return searchableValues.some(value =>
                String(value || '').toLocaleLowerCase(getLocale()).includes(searchTerm)
            );
        });

        paginateArchives(archivesData, 6);
    };

    let allActionsData = [];

    const loadArchives = async () => {
        archiveTableBody.setAttribute('aria-busy', 'true');
        archiveTableBody.innerHTML = Array.from({ length: 3 }, () => `
            <tr class="admin-skeleton-row">
                ${Array.from({ length: 5 }, () => '<td><span class="admin-skeleton admin-skeleton-block"></span></td>').join('')}
            </tr>
        `).join('');
        try {
            const [archiveResponse, activityResponse] = await Promise.all([
                fetchWithAuth(`${API_BASE}/api/archives`),
                fetchWithAuth(`${API_BASE}/api/journal`)
            ]);
            if (!Array.isArray(archiveResponse.archives) || !Array.isArray(activityResponse.activites)) {
                throw new Error('Les réponses des actions ou des archives sont incomplètes.');
            }

            const archiveActions = archiveResponse.archives.map(action => ({
                ...action,
                date_cloture: action.date_cloture,
                source: 'archive'
            }));
            const journalActions = activityResponse.activites.map(action => ({
                type: action.type_activite,
                categorie: action.categorie,
                module: action.module,
                ref: action.numero_facture || getInvoiceReferenceFromDescription(action.description) || action.reference || action.id,
                compagnie_id: action.id_companie,
                compagnie_nom: action.compagnie_nom || action.company_name || null,
                admin_nom: action.utilisateur || action.utilisateur_nom || action.utilisateur_email || '-',
                montant: action.montant ?? null,
                objet: action.description || null,
                statut: action.statut || null,
                date_cloture: action.date_activite || action.created_at,
                description: action.description || '',
                role_utilisateur: action.role_utilisateur || '',
                source: 'activity'
            }));

            const duplicateOfJournal = archiveAction => journalActions.some(activity => {
                const archiveType = String(archiveAction.type || '').toLocaleLowerCase('fr-FR');
                const activityType = String(activity.type || '').toLocaleLowerCase('fr-FR');
                const archiveDate = new Date(archiveAction.date_cloture).getTime();
                const activityDate = new Date(activity.date_cloture).getTime();
                const withinSameOperation = Number.isFinite(archiveDate) &&
                    Number.isFinite(activityDate) &&
                    Math.abs(archiveDate - activityDate) < 5 * 60 * 1000;
                if (!withinSameOperation) return false;

                if (archiveType === 'création de facture') {
                    return activityType === 'create' &&
                        String(activity.categorie || '').toLocaleLowerCase('fr-FR') === 'facture' &&
                        String(activity.ref || '') === String(archiveAction.ref || '');
                }

                if (archiveType === 'création de compagnie' || archiveType === 'mise à jour de compagnie') {
                    const expectedType = archiveType === 'création de compagnie' ? 'create' : 'update';
                    return activityType === expectedType &&
                        ['company', 'compagnie'].includes(String(activity.categorie || '').toLocaleLowerCase('fr-FR')) &&
                        String(activity.compagnie_id || '') === String(archiveAction.compagnie_id || '');
                }

                if (archiveType === 'confirmation de paiement') {
                    return activityType === 'update' &&
                        String(activity.categorie || '').toLocaleLowerCase('fr-FR') === 'facture' &&
                        String(activity.ref || '') === String(archiveAction.ref || '') &&
                        String(activity.description || '').toLocaleLowerCase('fr-FR').includes('paiement');
                }

                const archiveEventTypes = {
                    'archivage de compagnie': 'archive',
                    'restauration de compagnie': 'restore',
                    'suppression définitive de compagnie': 'delete',
                    "archivage d'administrateur": 'archive',
                    'archivage d’administrateur': 'archive',
                    "restauration d'administrateur": 'restore',
                    'restauration d’administrateur': 'restore',
                    'archivage de facture': 'archive',
                    'restauration de facture': 'restore'
                };
                const expectedEventType = archiveEventTypes[archiveType];
                if (expectedEventType) {
                    return activityType === expectedEventType &&
                        String(activity.ref || '') === String(archiveAction.ref || '');
                }

                return false;
            });

            allActionsData = [...archiveActions.filter(action => !duplicateOfJournal(action)), ...journalActions]
                .sort((a, b) => new Date(b.date_cloture) - new Date(a.date_cloture));

            const selectedPeriod = selectMonth.value || 'all';
            populateMonthSelect(allActionsData, selectedPeriod);
            populateActionTypeSelect(allActionsData, selectActionType.value || 'all');
            applyFilters();
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
            retryButton.addEventListener('click', () => loadArchives());
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
                cell.textContent = t('archive_no_matching_actions');
                row.appendChild(cell);
                archiveTableBody.replaceChildren(row);
                return;
            }
    
            pageData.forEach(a => {
                archiveTableBody.appendChild(createArchiveRow(a));
            });
        }
    
        function renderPagination() {
            const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
            pagination.innerHTML = `
                <button id="archive-prev-page" type="button" aria-label="${t('pagination_previous')}" ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left" aria-hidden="true"></i>
                    <span>${t('pagination_previous')}</span>
                </button>
                <span class="pagination-page" aria-live="polite">
                    ${t('page')} <strong>${currentPage}</strong> ${t('pagination_of')} ${totalPages}
                </span>
                <button id="archive-next-page" type="button" aria-label="${t('pagination_next')}" ${currentPage === totalPages ? 'disabled' : ''}>
                    <span>${t('pagination_next')}</span>
                    <i class="fas fa-chevron-right" aria-hidden="true"></i>
                </button>
            `;

            pagination.querySelector("#archive-prev-page").addEventListener("click", () => {
                currentPage = Math.max(1, currentPage - 1);
                renderPage();
                renderPagination();
            });
            pagination.querySelector("#archive-next-page").addEventListener("click", () => {
                currentPage = Math.min(totalPages, currentPage + 1);
                renderPage();
                renderPagination();
            });
        }
    
        renderPage();
        renderPagination();
    }
    

    /* =====================================================
       MODAL
    ===================================================== */
    const openModal = (a) => {
        currentArchive = a;
        modalTitle.textContent = localizeArchiveType(a.type, a.categorie, a);
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
            <div class="modal-row"><span>${t('archive_type')}</span><span>${escapeHtml(localizeArchiveType(a.type, a.categorie, a))}</span></div>
            <div class="modal-row"><span>${t('archive_date')}</span><span>${escapeHtml(formatDate(a.date_cloture))}</span></div>
            <div class="modal-row"><span>${t('activity_actor')}</span><span>${escapeHtml(a.admin_nom || '-')}</span></div>
        </div>

        ${a.compagnie_nom ? `
        <div class="modal-section">
            <h4>${t('archive_company')}</h4>
            <div class="modal-row"><span>${t('archive_name')}</span><span>${escapeHtml(a.compagnie_nom)}</span></div>
        </div>` : ''}

        ${a.ref ? `
        <div class="modal-section">
            <h4>${t('archive_invoice')}</h4>
            <div class="modal-row"><span>${t('archive_reference')}</span><span>${escapeHtml(a.ref)}</span></div>
            <div class="modal-row"><span>${t('archive_amount')}</span><span>${escapeHtml(formatAmount(a.montant))}</span></div>
            <div class="modal-row"><span>${t('archive_status')}</span><span>${escapeHtml(localizeArchiveStatus(a.statut))}</span></div>
        </div>` : ''}

        ${a.description ? `<div class="modal-section"><h4>${t('activity_description')}</h4><p>${escapeHtml(a.description)}</p></div>` : ''}
        ${a.role_utilisateur ? `<div class="modal-row"><span>${t('activity_role')}</span><span>${escapeHtml(a.role_utilisateur)}</span></div>` : ''}

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
    
            drawRow(`${t('archive_type')} :`, localizeArchiveType(a.type, a.categorie, a));
            drawRow(`${t('archive_date')} :`, formatDate(a.date_cloture));
            drawRow(`${t('activity_actor')} :`, a.admin_nom);
            drawRow(`${t('archive_company')} :`, a.compagnie_nom);
            drawRow(`${t('archive_reference')} :`, a.ref || '-');
            drawRow(`${t('activity_description')} :`, a.description || '-');
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
    
    selectMonth.addEventListener("change", applyFilters);
    selectActionType.addEventListener("change", applyFilters);
    searchActions.addEventListener("input", applyFilters);
    clearFiltersButton.addEventListener("click", () => {
        selectMonth.value = 'all';
        selectActionType.value = 'all';
        searchActions.value = '';
        applyFilters();
    });
    
    document.getElementById("csv-btn").addEventListener("click", downloadArchiveCSV);

window.addEventListener('app-language-change', () => {
    populateMonthSelect(allActionsData, selectMonth.value || 'all');
    populateActionTypeSelect(allActionsData, selectActionType.value || 'all');
    applyFilters();
    if (modal.classList.contains('open') && currentArchive) {
        modalTitle.textContent = localizeArchiveType(currentArchive.type, currentArchive.categorie, currentArchive);
        modalContent.innerHTML = renderArchiveDetails(currentArchive);
    }
});

function downloadArchiveCSV() {
    if (!archivesData.length) {
        alert(t('archive_no_data_export'));
        return;
    }

    // 🔥 Génération CSV
    const headers = [
        t('archive_csv_type'),
        t('activity_actor'),
        t('archive_csv_company'),
        t('archive_csv_date'),
        t('archive_csv_reference'),
        t('activity_description'),
        t('archive_csv_amount'),
        t('archive_csv_status')
    ];

    const rows = archivesData.map(a => [
        localizeArchiveType(a.type, a.categorie, a),
        a.admin_nom || "",
        a.compagnie_nom || "",
        formatDate(a.date_cloture),
        a.ref || "",
        a.description || "",
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
    a.download = `actions_${selectMonth.value || 'all'}.csv`;
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
