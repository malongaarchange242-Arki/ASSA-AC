// DOM ready + theme toggle + page logic

document.addEventListener('DOMContentLoaded', async () => {

    // 1. THEME TOGGLE
    const toggle = document.getElementById('toggleTheme');
    const themeIcon = toggle.querySelector('i');

    const updateThemeUI = (isDark) => {
        document.body.classList.toggle('dark-mode', isDark);
        themeIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    };

    if (localStorage.getItem('theme') === 'dark') updateThemeUI(true);

    toggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeUI(isDark);
    });

    /* ---------- DATA (vide au départ) ---------- */
    let operations = [];

    /* ---------- REFS ---------- */
    const tbody = document.getElementById('operation-list');
    const filterType = document.getElementById('filterType');
    const filterStatus = document.getElementById('filterStatus');
    const filterDate = document.getElementById('filterDate');
    const resetFilters = document.getElementById('resetFilters');
    const searchInput = document.getElementById('globalSearch');
    const paginationEl = document.getElementById('pagination');
    const exportBtn = document.getElementById('exportBtn');
    const pageSizeSelect = document.getElementById('pageSize');

    function getLocalDateInputValue(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const today = getLocalDateInputValue();
    filterDate.value = today;

    const detailPanel = document.getElementById('detailPanel');
    const closePanel = document.getElementById('closePanel');
    const dId = document.getElementById('detail-id');
    const dType = document.getElementById('detail-type');
    const dDate = document.getElementById('detail-date');
    const dDemandeur = document.getElementById('detail-demandeur');
    const dStatut = document.getElementById('detail-status');
    const dMotif = document.getElementById('detail-motif');
    const dContestation = document.getElementById('detail-contestation');
    const dContestationReason = document.getElementById('detail-contestation-reason');
    const dContestationFiles = document.getElementById('detail-contestation-files');
    const dCompanyLogo = document.getElementById('detail-company-logo');
    const dCompanyLogoFallback = document.getElementById('detail-company-logo-fallback');
    const dCompanyName = document.getElementById('operation-detail-title');
    const dCompanyStatus = document.getElementById('detail-company-status');
    const dCompanyRepresentative = document.getElementById('detail-company-representative');
    const dCompanyEmail = document.getElementById('detail-company-email');
    const dCompanyPhone = document.getElementById('detail-company-phone');
    const dCompanyAddress = document.getElementById('detail-company-address');
    const dCompanyAirport = document.getElementById('detail-company-airport');
    const dCompanyMessage = document.getElementById('detail-company-message');
    const btnValider = document.getElementById('detail-validate');
    const btnRejeter = document.getElementById('detail-reject');

    /* ---------- STATE ---------- */
    let filtered = [...operations];
    let companiesById = new Map();
    let companyDirectoryState = 'loading';
    let companyDirectoryError = '';
    let currentDetailOperationId = null;
    let currentPage = 1;
    let pageSize = parseInt(pageSizeSelect.value || 10, 10);

    /* ---------- UTIL ---------- */
    function debounce(fn, wait = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; }
    function isPaidStatus(status) {
        return String(status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'payee';
    }

    function translateOperationValue(value, translations) {
        const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        const key = translations[normalized];
        return key ? t(key) : value;
    }

    function translateOperationType(type) {
        return translateOperationValue(type, {
            facture: 'invoice',
            contestation: 'dispute',
            suppression: 'deletion'
        });
    }

    function translateOperationStatus(status) {
        return translateOperationValue(status, {
            'en attente': 'status_pending',
            payee: 'status_paid',
            impayee: 'status_unpaid',
            contestee: 'status_disputed',
            validee: 'status_approved',
            rejetee: 'status_rejected'
        });
    }

    function updateDetailActionState(operation) {
        const disabled = isPaidStatus(operation.statut);
        btnValider.disabled = disabled;
        btnRejeter.disabled = disabled;
        const actionLabel = disabled ? t('paid_invoice_action_unavailable') : '';
        btnValider.title = actionLabel;
        btnRejeter.title = actionLabel;
    }

    /* ---------- RENDER ---------- */
    function render() {
        tbody.innerHTML = '';
        pageSize = parseInt(pageSizeSelect.value, 10) || 10;

        if (!filtered.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center">
                        ${t('no_operations')}
                    </td>
                </tr>
            `;
            renderPagination();
            return;
        }

        const start = (currentPage - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);

        pageItems.forEach(op => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td>${op.ref}</td>
            <td>${translateOperationType(op.type)}</td>
            <td>${op.date}</td>
            <td>${op.client}</td>
            <td>${translateOperationStatus(op.statut)}</td>
            <td class="actions-col">
                <div class="table-actions">
                    <button class="table-btn validate" data-id="${op.id}" type="button" ${isPaidStatus(op.statut) ? `disabled title="${t('paid_invoice_action_unavailable')}"` : ''}>${t('validate')}</button>
                    <button class="table-btn reject" data-id="${op.id}" type="button" ${isPaidStatus(op.statut) ? `disabled title="${t('paid_invoice_action_unavailable')}"` : ''}>${t('reject')}</button>
                </div>
            </td>
        `;

            tr.addEventListener('click', e => { 
                if (e.target.closest('button')) return; 
                openDetail(op); 
            });

            tr.querySelector('.validate').addEventListener('click', e => { 
                e.stopPropagation(); 
                changeStatus(op.id, 'Payée'); 
            });

            tr.querySelector('.reject').addEventListener('click', e => { 
                e.stopPropagation(); 
                changeStatus(op.id, 'Rejetée'); 
            });

            tbody.appendChild(tr);
        });

        renderPagination();
    }

    function renderPagination() {
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const start = total ? (currentPage - 1) * pageSize + 1 : 0;
        const end = Math.min(currentPage * pageSize, total);
        const summary = t('pagination_summary')
            .replace('{start}', String(start))
            .replace('{end}', String(end))
            .replace('{total}', String(total));
        paginationEl.innerHTML = `
            <div class="pagination-summary" aria-live="polite">${summary}</div>
            <div class="pagination-controls" aria-label="${t('pagination_navigation')}">
                <button ${currentPage === 1 ? 'disabled' : ''} id="prevBtn" type="button" aria-label="${t('pagination_previous')}">
                    <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                    <span>${t('pagination_previous')}</span>
                </button>
                <span class="pagination-page">${t('page')} <strong>${currentPage}</strong> ${t('pagination_of')} ${totalPages}</span>
                <button ${currentPage === totalPages ? 'disabled' : ''} id="nextBtn" type="button" aria-label="${t('pagination_next')}">
                    <span>${t('pagination_next')}</span>
                    <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                </button>
            </div>
        `;
        document.getElementById('prevBtn').addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); render(); });
        document.getElementById('nextBtn').addEventListener('click', () => { currentPage = Math.min(totalPages, currentPage + 1); render(); });
    }

    /* ---------- FILTERS & SEARCH ---------- */
    function applyFilters() {
        const t = filterType.value;
        const s = filterStatus.value;
        const d = filterDate.value;
        const q = (searchInput.value || '').trim().toLowerCase();

        // helper to compare strings in a case-insensitive and accent-insensitive way
        const normalizeForFilter = (s) => {
            if (!s) return '';
            // Use NFD + unicode combining marks range for broad browser support
            return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        };

        const normSelectedStatus = normalizeForFilter(s);
        console.log('Filter status selected (raw -> normalized):', s, '->', normSelectedStatus);

        filtered = operations.filter(op => {
            const matchType = !t || op.type === t;
            const matchStatus = !s || normalizeForFilter(op.statut) === normSelectedStatus;
            const matchDate = !d || String(op.date || '').slice(0, 10) === d;
            const matchQuery = !q || (
                (op.ref && op.ref.toLowerCase().includes(q)) ||
                (op.id && op.id.toLowerCase().includes(q)) ||
                (op.type && op.type.toLowerCase().includes(q)) ||
                (op.client && op.client.toLowerCase().includes(q)) ||
                (op.motif && op.motif.toLowerCase().includes(q))
            );
            return matchType && matchStatus && matchDate && matchQuery;
        });

        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;
        render();
    }

    /* ---------- ACTIONS ---------- */
    function changeStatus(id, statut) {
        const existing = operations.find(o => o.id === id);
        if (!existing) return;
        if (isPaidStatus(existing.statut)) return;

        // Special rule: when validating (setting to 'Payée'), only change
        // invoices that are currently in 'En attente' (case-insensitive).
        if (statut === 'Payée') {
            const cur = String(existing.statut || '').toLowerCase();
            if (!/en\s*attente/.test(cur)) return; // no-op if not 'en attente'
        }

        // Update master list
        operations = operations.map(op => op.id === id ? { ...op, statut } : op);

        // Also update the currently visible filtered list so the row is not removed
        filtered = filtered.map(op => op.id === id ? { ...op, statut } : op);

        if (currentDetailOperationId === id) {
            dStatut.textContent = translateOperationStatus(statut);
            updateDetailActionState({ ...existing, statut });
        }

        // Re-render (do not re-apply filters so the row remains)
        render();

        // Persist change to backend (optimistic update: UI already updated)
        const numero = existing.ref || existing.id;
        updateStatusInDB(numero, statut).then(data => {
            const emailFailed = ['failed', 'missing_recipient'].includes(data?.email_status);
            showDetailConfirmation(
                data?.email_message || `Statut enregistré en base : ${statut}`,
                emailFailed
            );
        }).catch(err => {
            // Revert optimistic update on failure
            console.error('Erreur mise à jour statut en base :', err);
            // revert operations
            operations = operations.map(op => op.id === id ? { ...op, statut: existing.statut } : op);
            filtered = filtered.map(op => op.id === id ? { ...op, statut: existing.statut } : op);
            if (currentDetailOperationId === id) {
                dStatut.textContent = translateOperationStatus(existing.statut);
                updateDetailActionState(existing);
            }
            render();
            showDetailConfirmation(`Échec enregistrement: ${err.message || err}`);
        });
    }

    // Persist status change to backend API
    async function updateStatusInDB(numero_facture, statut) {
        // Determine API base (same heuristic as other frontend modules)
        const API_BASE = (() => {
            const origin = window.location.origin;
            if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                return 'http://localhost:5002';
            }
            return 'http://localhost:5002';
        })();

        const token = localStorage.getItem('jwtTokenSuperviseur') || localStorage.getItem('jwtTokenSuperviseur');
        let res;
        if (String(statut).toLowerCase().includes('pay')) {
            // Use the dedicated confirmation endpoint which does not require
            // req.user.id_companie match in the controller.
            const confirmUrl = `${API_BASE}/api/factures/confirm/${encodeURIComponent(numero_facture)}`;
            res = await fetch(confirmUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
        } else {
            const url = `${API_BASE}/api/factures/statut`;
            const body = { numero_facture, statut };
            res = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(body)
            });
        }

        let data;
        try { data = await res.json(); } catch (e) { data = null; }

        if (!res.ok) {
            const msg = (data && data.message) ? data.message : `Erreur API ${res.status}`;
            throw new Error(msg);
        }

        return data;
    }

    // Show a short confirmation message inside the detail panel
    function showDetailConfirmation(msg, isError = false) {
        if (!detailPanel) return;
        let el = detailPanel.querySelector('#detail-confirm');
        if (!el) {
            el = document.createElement('div');
            el.id = 'detail-confirm';
            el.className = 'detail-confirm';
            el.style.marginTop = '8px';
            el.style.padding = '8px';
            el.style.borderRadius = '6px';
            el.style.fontWeight = '600';
            detailPanel.querySelector('.operation-detail-layout').prepend(el);
        }
        el.style.background = isError ? '#fef2f2' : '#e6ffed';
        el.style.color = isError ? '#b91c1c' : '#094a09';
        el.textContent = msg;
        el.style.display = 'block';
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 8000);
    }

    function openDetail(op) {
        currentDetailOperationId = op.id;
        dId.textContent = op.ref || op.id;
        dType.textContent = translateOperationType(op.type);
        dDate.textContent = op.date;
        dDemandeur.textContent = op.client;
        dStatut.textContent = translateOperationStatus(op.statut);
        dMotif.textContent = op.contestation?.explication || op.motif || '';
        updateDetailActionState(op);
        renderContestationDetails(op);
        renderCompanyDetails(op);
        // Load proofs for this operation into the detail panel
        try { viewProofs(op.ref || op.id); } catch (e) { console.warn('viewProofs failed', e); }
        btnValider.onclick = () => changeStatus(op.id, 'Payée');
        btnRejeter.onclick = () => changeStatus(op.id, 'Rejetée');
        if (!detailPanel.open) detailPanel.showModal();
    }

    function renderContestationDetails(operation) {
        const contestation = operation.contestation;
        const isContested = String(operation.statut || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('contest');
        const files = Array.isArray(contestation?.fichiers) && contestation.fichiers.length
            ? contestation.fichiers
            : contestation?.fichier_url
                ? [{ file_url: contestation.fichier_url, file_name: contestation.file_name }]
                : [];
        dContestation.hidden = !isContested && !contestation;
        dContestationReason.textContent = contestation?.explication || operation.motif || 'Aucun motif communiqué.';
        dContestationFiles.replaceChildren();
        if (files.length) {
            renderAttachmentCards(dContestationFiles, files);
        } else {
            const notice = document.createElement('div');
            notice.className = 'notice';
            notice.textContent = 'Aucune pièce jointe fournie avec cette contestation.';
            dContestationFiles.appendChild(notice);
        }
    }

    function buildCompanyLogoUrl(value) {
        const logo = typeof value === 'string' ? value.trim() : '';
        if (!logo) return '';
        if (/^(https?:\/\/|data:|blob:)/i.test(logo)) return logo;
        const filename = logo.replace(/^logos\//i, '').replace(/^\/+/, '');
        const encodedFilename = filename.split('/').map(encodeURIComponent).join('/');
        return `https://ulmwuzpjfbkxkkvdzaoi.supabase.co/storage/v1/object/public/company-logos/${encodedFilename}`;
    }

    function setCompanyText(element, value) {
        element.textContent = value == null || String(value).trim() === '' ? '—' : String(value);
    }

    function renderCompanyDetails(operation) {
        const company = operation.company || companiesById.get(String(operation.companyId || ''));
        const companyName = company?.company_name || operation.companyName || '';
        setCompanyText(dCompanyName, companyName || 'Compagnie non renseignée');
        setCompanyText(dCompanyStatus, company?.status);
        dCompanyStatus.className = 'operation-company-status';
        if (company?.status) {
            const normalizedStatus = String(company.status).trim().toLowerCase();
            if (['actif', 'active', 'activa'].includes(normalizedStatus)) dCompanyStatus.classList.add('is-active');
            else if (['en attente', 'pending', 'attente'].includes(normalizedStatus)) dCompanyStatus.classList.add('is-pending');
            else if (['suspendu', 'suspendue', 'suspended'].includes(normalizedStatus)) dCompanyStatus.classList.add('is-suspended');
            else dCompanyStatus.classList.add('is-inactive');
        }
        setCompanyText(dCompanyRepresentative, company?.representative_name);
        setCompanyText(dCompanyEmail, company?.email);
        setCompanyText(dCompanyPhone, company?.phone_number);
        setCompanyText(dCompanyAddress, [company?.full_address, company?.city, company?.country].filter(Boolean).join(', '));
        setCompanyText(dCompanyAirport, company?.airport_code);
        dCompanyMessage.hidden = true;
        dCompanyLogo.hidden = true;
        dCompanyLogo.removeAttribute('src');
        dCompanyLogoFallback.hidden = false;
        dCompanyLogoFallback.textContent = companyName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';

        const logoUrl = buildCompanyLogoUrl(company?.logo_url || company?.logo);
        if (logoUrl) {
            dCompanyLogo.onload = () => {
                dCompanyLogo.hidden = false;
                dCompanyLogoFallback.hidden = true;
            };
            dCompanyLogo.onerror = () => {
                dCompanyLogo.hidden = true;
                dCompanyLogoFallback.hidden = false;
            };
            dCompanyLogo.src = logoUrl;
        }

        if (companyDirectoryState === 'loading') {
            dCompanyMessage.textContent = 'Chargement des informations de la compagnie…';
            dCompanyMessage.hidden = false;
        } else if (companyDirectoryError && !company) {
            dCompanyMessage.textContent = `Impossible de charger les coordonnées de la compagnie : ${companyDirectoryError}`;
            dCompanyMessage.hidden = false;
        } else if (!company && !operation.companyName) {
            dCompanyMessage.textContent = 'Aucune compagnie associée à cette facture.';
            dCompanyMessage.hidden = false;
        } else if (!company) {
            dCompanyMessage.textContent = 'Les coordonnées complètes de cette compagnie sont indisponibles.';
            dCompanyMessage.hidden = false;
        }
    }

    if (closePanel) closePanel.addEventListener('click', () => detailPanel.close());
    detailPanel?.addEventListener('click', event => {
        if (event.target === detailPanel) detailPanel.close();
    });

    // Fetch and render payment proofs into the detail panel's proof area
    async function viewProofs(numero) {
        const proofsEl = detailPanel ? detailPanel.querySelector('#detail-proofs') : null;
        if (!numero) { if (proofsEl) proofsEl.innerHTML = '<div class="notice">Référence invalide</div>'; return; }

        if (proofsEl) proofsEl.innerHTML = '<div class="notice">Chargement des preuves…</div>';

        const API_BASE = (() => { const origin = window.location.origin; if (origin.includes('localhost') || origin.includes('127.0.0.1')) { return 'http://localhost:5002'; } return 'http://localhost:5002'; })();
        const token = localStorage.getItem('jwtTokenSuperviseur') || localStorage.getItem('jwtTokenAdmin') || localStorage.getItem('jwtToken');
        const url = `${API_BASE}/api/preuves/by-facture/${encodeURIComponent(numero)}`;

        let res;
        try { res = await fetch(url, { headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } }); }
        catch (err) {
            console.error('Erreur fetch preuves:', err);
            if (proofsEl) proofsEl.innerHTML = '<div class="notice error">Erreur de connexion au serveur des preuves.</div>';
            return;
        }

        let data = null;
        try { data = await res.json(); } catch (e) { data = null; }

        if (!res.ok) {
            const msg = (data && data.message) ? data.message : `Erreur ${res.status}`;
            if (proofsEl) proofsEl.innerHTML = `<div class="notice error">${msg}</div>`;
            return;
        }

        const preuves = (data && data.preuves) ? data.preuves : [];
        if (!preuves.length) {
            if (proofsEl) proofsEl.innerHTML = `<div class="notice">Aucune preuve trouvée pour ${numero}.</div>`;
            return;
        }

        // Render list of proofs
        renderAttachmentCards(proofsEl, preuves);
    }

    function renderAttachmentCards(target, files) {
        const container = document.createElement('div');
        container.className = 'proofs-list';

        files.forEach(p => {
            const item = document.createElement('article');
            item.className = 'payment-proof-card';
            const url = p.fichier_url || p.file_url || p.url || p.file || p.path || p.link;
            let fileName = p.nom_fichier || p.file_name || p.filename || '';
            if (!fileName && url) {
                try {
                    fileName = decodeURIComponent(new URL(url, window.location.href).pathname.split('/').pop() || '');
                } catch {
                    fileName = url.split('/').pop() || '';
                }
            }
            const displayName = String(fileName || 'Preuve de paiement')
                .replace(/^[0-9a-f]{8}-[0-9a-f-]{27,}_/i, '')
                .replace(/\.[^.]+$/, '')
                .replace(/[_-]+/g, ' ')
                .trim() || 'Preuve de paiement';
            const extension = String(fileName).split('.').pop().toLowerCase();
            const isImage = p.type?.startsWith?.('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(extension);

            if (url) {
                const previewLink = document.createElement('a');
                previewLink.href = url;
                previewLink.target = '_blank';
                previewLink.rel = 'noopener noreferrer';
                previewLink.className = 'payment-proof-preview';
                previewLink.setAttribute('aria-label', `Ouvrir la preuve : ${displayName}`);

                if (isImage) {
                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = `Aperçu de la preuve ${displayName}`;
                    img.loading = 'lazy';
                    img.addEventListener('error', () => {
                        const icon = document.createElement('i');
                        icon.className = 'fa-regular fa-image';
                        icon.setAttribute('aria-hidden', 'true');
                        previewLink.replaceChildren(icon);
                        previewLink.classList.add('payment-proof-preview-unavailable');
                    }, { once: true });
                    previewLink.appendChild(img);
                    const zoomIcon = document.createElement('span');
                    zoomIcon.className = 'payment-proof-zoom';
                    zoomIcon.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>';
                    previewLink.appendChild(zoomIcon);
                } else {
                    const icon = document.createElement('i');
                    icon.className = extension === 'pdf' ? 'fa-regular fa-file-pdf' : 'fa-regular fa-file-lines';
                    icon.setAttribute('aria-hidden', 'true');
                    previewLink.appendChild(icon);
                }

                const details = document.createElement('div');
                details.className = 'payment-proof-details';
                const name = document.createElement('span');
                name.className = 'payment-proof-name';
                name.textContent = displayName;
                const fileType = document.createElement('span');
                fileType.className = 'payment-proof-type';
                fileType.textContent = extension ? extension.toUpperCase() : 'DOCUMENT';
                details.append(name, fileType);

                const openLink = document.createElement('a');
                openLink.href = url;
                openLink.target = '_blank';
                openLink.rel = 'noopener noreferrer';
                openLink.className = 'payment-proof-open';
                openLink.setAttribute('aria-label', `Ouvrir ${displayName}`);
                openLink.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>';
                item.append(previewLink, details, openLink);
            } else {
                const icon = document.createElement('i');
                icon.className = 'fa-regular fa-file-lines payment-proof-file-icon';
                icon.setAttribute('aria-hidden', 'true');
                const label = document.createElement('span');
                label.className = 'payment-proof-name';
                label.textContent = displayName;
                item.append(icon, label);
            }

            container.appendChild(item);
        });
        target.replaceChildren(container);
    }

    /* ---------- EXPORT ---------- */
    function exportExcel(list) {
        if (!list || !list.length) {
            alert(t('no_operations_to_export'));
            return;
        }
        if (!window.XLSX) {
            console.error('La bibliothèque Excel n’a pas pu être chargée.');
            alert(t('excel_export_unavailable'));
            return;
        }

        try {
            const headers = [
                t('export_col_ref'),
                t('export_col_type'),
                t('export_col_date'),
                t('export_col_client'),
                t('export_col_status'),
                t('export_col_reason')
            ];
            const rows = list.map(operation => [
                operation.ref || operation.id || '',
                operation.type || '',
                operation.date || '',
                operation.client || '',
                operation.statut || '',
                operation.contestation?.explication || operation.motif || ''
            ]);
            const worksheet = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
            worksheet['!cols'] = [
                { wch: 34 },
                { wch: 18 },
                { wch: 16 },
                { wch: 24 },
                { wch: 18 },
                { wch: 48 }
            ];
            worksheet['!autofilter'] = { ref: worksheet['!ref'] };
            worksheet['!freeze'] = {
                xSplit: 0,
                ySplit: 1,
                topLeftCell: 'A2',
                activePane: 'bottomLeft',
                state: 'frozen'
            };

            const workbook = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(workbook, worksheet, t('export_sheet_name'));
            workbook.Props = {
                Title: t('export_workbook_title'),
                Subject: t('export_workbook_subject'),
                CreatedDate: new Date()
            };
            window.XLSX.writeFile(workbook, `operations_${getLocalDateInputValue()}.xlsx`);
        } catch (error) {
            console.error('Erreur lors de la création du fichier Excel :', error);
            alert(t('excel_export_failed'));
        }
    }

    /* ---------- EVENTS ---------- */
    filterType.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    filterStatus.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    filterDate.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    resetFilters.addEventListener('click', () => { filterType.value = ''; filterStatus.value = ''; filterDate.value = today; searchInput.value = ''; currentPage = 1; applyFilters(); });
    searchInput.addEventListener('input', debounce(() => { currentPage = 1; applyFilters(); }, 250));
    exportBtn.addEventListener('click', () => exportExcel(filtered));
    pageSizeSelect.addEventListener('change', () => { pageSize = parseInt(pageSizeSelect.value, 10); currentPage = 1; render(); });
    window.addEventListener('app-language-change', () => {
        render();
        if (detailPanel.open && currentDetailOperationId) {
            const operation = operations.find(item => item.id === currentDetailOperationId);
            if (operation) {
                dType.textContent = translateOperationType(operation.type);
                dStatut.textContent = translateOperationStatus(operation.statut);
                updateDetailActionState(operation);
            }
        }
    });

    /* ---------- DATA LOADER & NORMALIZATION ---------- */
    function normalizeFactures(data) {
        if (!Array.isArray(data)) return [];
        const statusMap = {
            'en attente': 'En attente',
            'en attente': 'En attente',
            'enattente': 'En attente',
            'en attente': 'En attente',
            'payée': 'Payée',
            'payee': 'Payée',
            'payé': 'Payée',
            'payé': 'Payée',
            'contestée': 'Contestée',
            'contested': 'Contestée',
            'contestee': 'Contestée',
            'impayée': 'Impayée',
            'impayee': 'Impayée',
            'validée': 'Validée',
            'validee': 'Validée',
            'rejetée': 'Rejetée',
            'rejetee': 'Rejetée'
        };

        function normalizeStatus(s) {
            if (!s) return 'En attente';
            const key = String(s).trim().toLowerCase();
            // Prefer exact matches and longer keys first to avoid substrings like
            // 'impayée' matching 'payée'.
            const keys = Object.keys(statusMap).sort((a, b) => b.length - a.length);
            for (const k of keys) {
                if (key === k) return statusMap[k];
            }
            for (const k of keys) {
                if (key.includes(k)) return statusMap[k];
            }
            return String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase();
        }

        return data.map(item => {
            const idVal = String(item.id || item._id || item.idx || '');
            const refVal = String(item.numero_facture || item.reference || item.ref || item.num || item.numero || idVal || 'N/A');
            const company = item.company && typeof item.company === 'object'
                ? item.company
                : item.companies && typeof item.companies === 'object' && !Array.isArray(item.companies)
                    ? item.companies
                    : null;
            return {
                id: idVal || refVal,
                ref: refVal,
                type: item.objet || item.type || 'Facture',
                date: item.date_emission || item.date || item.createdAt || item.dateFacture || item.date_debut || '',
                client: item.nom_client || item.client || item.demandeur || item.fournisseur || item.supplier || item.nom || '',
                companyId: item.id_companie || item.company_id || company?.id || '',
                company,
                companyName: item.company_name || '',
                statut: normalizeStatus(item.statut || item.status || item.etat),
                motif: item.motif || item.reason || item.commentaire || item.note || '',
                contestation: item.contestation && typeof item.contestation === 'object' ? item.contestation : null
            };
        });
    }

    async function loadData() {
        tbody.setAttribute('aria-busy', 'true');
        tbody.replaceChildren();
        try {
            const API_BASE = (() => { const origin = window.location.origin; if (origin.includes('localhost') || origin.includes('127.0.0.1')) { return 'http://localhost:5002'; } return 'http://localhost:5002'; })();
            const token = localStorage.getItem('jwtTokenSuperviseur') || localStorage.getItem('jwtTokenAdmin') || localStorage.getItem('jwtToken');
            const url = `${API_BASE}/api/factures`;
            console.info('Fetching factures from API:', url);

            const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } });
            let data;
            try {
                data = await res.json();
            } catch {
                throw new Error('Réponse invalide du serveur');
            }

            if (!res.ok) {
                throw new Error(data.message || `Erreur API : ${res.status}`);
            }

            // extract array from various shapes
            const extractArray = (raw) => {
                if (Array.isArray(raw)) return raw;
                if (!raw || typeof raw !== 'object') return [];
                const candidates = ['factures', 'data', 'rows', 'items', 'results'];
                for (const k of candidates) if (Array.isArray(raw[k])) return raw[k];
                for (const key of Object.keys(raw)) if (Array.isArray(raw[key])) return raw[key];
                return [];
            };

            const arr = extractArray(data);
            operations = normalizeFactures(arr);
            currentPage = 1;
            await loadCompanyDirectory(API_BASE, token);
            tbody.setAttribute('aria-busy', 'false');
            applyFilters();

        } catch (err) {
            console.error('Erreur fetch factures API:', err);
            operations = [];
            filtered = [];
            currentPage = 1;
            tbody.setAttribute('aria-busy', 'false');
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.className = 'operations-load-error';
            td.append(document.createTextNode(t('operations_load_error')));

            const retryButton = document.createElement('button');
            retryButton.type = 'button';
            retryButton.className = 'activity-retry';
            retryButton.textContent = t('retry');
            retryButton.addEventListener('click', loadData);
            td.append(' ', retryButton);
            tr.appendChild(td);
            tbody.replaceChildren(tr);
            renderPagination();
        }
    }

    async function loadCompanyDirectory(apiBase, token) {
        companyDirectoryState = 'loading';
        companyDirectoryError = '';
        try {
            const headers = new Headers({ 'Content-Type': 'application/json' });
            if (token) headers.set('Authorization', 'Bearer ' + token);
            const response = await fetch(`${apiBase}/api/companies/all`, {
                headers
            });
            let data;
            try {
                data = await response.json();
            } catch {
                throw new Error('Réponse invalide du serveur');
            }
            if (!response.ok) {
                throw new Error(data.message || `Erreur API : ${response.status}`);
            }
            const companies = Array.isArray(data) ? data : data?.companies;
            if (!Array.isArray(companies)) {
                throw new Error('Format de la liste des compagnies invalide');
            }
            companiesById = new Map(companies.filter(company => company?.id != null).map(company => [String(company.id), company]));
            companyDirectoryState = 'loaded';
        } catch (error) {
            console.error('Erreur chargement des compagnies pour le détail des opérations :', error);
            companyDirectoryError = error.message || String(error);
            companyDirectoryState = 'error';
        }
    }

    /* ---------- INIT ---------- */
    await loadData();
});