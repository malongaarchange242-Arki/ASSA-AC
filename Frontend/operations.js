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

    const detailPanel = document.getElementById('detailPanel');
    const closePanel = document.getElementById('closePanel');
    const dId = document.getElementById('detail-id');
    const dType = document.getElementById('detail-type');
    const dDate = document.getElementById('detail-date');
    const dDemandeur = document.getElementById('detail-demandeur');
    const dStatut = document.getElementById('detail-status');
    const dMotif = document.getElementById('detail-motif');
    const btnValider = document.getElementById('detail-validate');
    const btnRejeter = document.getElementById('detail-reject');

    /* ---------- STATE ---------- */
    let filtered = [...operations];
    let currentPage = 1;
    let pageSize = parseInt(pageSizeSelect.value || 10, 10);

    /* ---------- UTIL ---------- */
    function debounce(fn, wait = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; }

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
            <td>${op.type}</td>
            <td>${op.date}</td>
            <td>${op.client}</td>
            <td>${op.statut}</td>
            <td class="actions-col">
                <button class="table-btn validate" data-id="${op.id}" type="button">${t('validate')}</button>
                <button class="table-btn reject" data-id="${op.id}" type="button">${t('reject')}</button>
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
        paginationEl.innerHTML = `
      <div class="controls">
        <button ${currentPage === 1 ? 'disabled' : ''} id="prevBtn" type="button">${t('prev')}</button>
        <button ${currentPage === totalPages ? 'disabled' : ''} id="nextBtn" type="button">${t('next')}</button>
      </div>
      <div class="info">${t('page')} ${currentPage} / ${totalPages} — ${total} ${t('items')}</div>
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
            const matchDate = !d || op.date === d;
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

        // Re-render (do not re-apply filters so the row remains)
        render();

        // Persist change to backend (optimistic update: UI already updated)
        const numero = existing.ref || existing.id;
        updateStatusInDB(numero, statut).then(() => {
            // Success: show a confirmation if detail panel open
            showDetailConfirmation(`Statut enregistré en base : ${statut}`);
        }).catch(err => {
            // Revert optimistic update on failure
            console.error('Erreur mise à jour statut en base :', err);
            // revert operations
            operations = operations.map(op => op.id === id ? { ...op, statut: existing.statut } : op);
            filtered = filtered.map(op => op.id === id ? { ...op, statut: existing.statut } : op);
            render();
            showDetailConfirmation(`Échec enregistrement: ${err.message || err}`);
        });
    }

    // Persist status change to backend API
    async function updateStatusInDB(numero_facture, statut) {
        // Determine API base (same heuristic as other frontend modules)
        const API_BASE = (() => {
            const origin = window.location.origin;
            return origin.includes(':5002') ? origin : 'https://assa-ac-duzn.onrender.com';
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
    function showDetailConfirmation(msg) {
        if (!detailPanel) return;
        let el = detailPanel.querySelector('#detail-confirm');
        if (!el) {
            el = document.createElement('div');
            el.id = 'detail-confirm';
            el.className = 'detail-confirm';
            el.style.marginTop = '8px';
            el.style.padding = '8px';
            el.style.borderRadius = '4px';
            el.style.background = '#e6ffed';
            el.style.color = '#094a09';
            el.style.fontWeight = '600';
            detailPanel.querySelector('.detail-body').appendChild(el);
        }
        el.textContent = msg;
        el.style.display = 'block';
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 2500);
    }

    function openDetail(op) {
        dId.textContent = op.ref || op.id;
        dType.textContent = op.type;
        dDate.textContent = op.date;
        dDemandeur.textContent = op.client;
        dStatut.textContent = op.statut;
        dMotif.textContent = op.motif || '';
        // Load proofs for this operation into the detail panel
        try { viewProofs(op.ref || op.id); } catch (e) { console.warn('viewProofs failed', e); }
        btnValider.onclick = () => {
            changeStatus(op.id, 'Payée');
            // update panel immediately and show confirmation
            dStatut.textContent = 'Payée';
            showDetailConfirmation('Statut mis à jour — Payée');
        };
        btnRejeter.onclick = () => changeStatus(op.id, 'Rejetée');
        detailPanel.classList.add('open');
        detailPanel.setAttribute('aria-hidden', 'false');
    }

    if (closePanel) closePanel.addEventListener('click', () => { detailPanel.classList.remove('open'); detailPanel.setAttribute('aria-hidden', 'true'); });

    // Fetch and render payment proofs into the detail panel's proof area
    async function viewProofs(numero) {
        const proofsEl = detailPanel ? detailPanel.querySelector('#detail-proofs') : null;
        if (!numero) { if (proofsEl) proofsEl.innerHTML = '<div class="notice">Référence invalide</div>'; return; }

        if (proofsEl) proofsEl.innerHTML = '<div class="notice">Chargement des preuves…</div>';

        const API_BASE = (() => { const origin = window.location.origin; return origin.includes(':5002') ? origin : 'https://assa-ac-duzn.onrender.com'; })();
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
            detailPanel.classList.add('open'); detailPanel.setAttribute('aria-hidden', 'false');
            return;
        }

        const preuves = (data && data.preuves) ? data.preuves : [];
        if (!preuves.length) {
            if (proofsEl) proofsEl.innerHTML = `<div class="notice">Aucune preuve trouvée pour ${numero}.</div>`;
            detailPanel.classList.add('open'); detailPanel.setAttribute('aria-hidden', 'false');
            return;
        }

        // Render list of proofs
        const container = document.createElement('div');
        container.className = 'proofs-list';

        preuves.forEach(p => {
            const item = document.createElement('div');
            item.className = 'proof-item';
            const url = p.fichier_url || p.url || p.file || p.path || p.link;

            const title = p.nom_fichier || p.filename || (url ? url.split('/').pop() : 'Preuve');

            if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = title;
                a.className = 'proof-link';
                item.appendChild(a);

                const img = document.createElement('img');
                img.src = url;
                img.alt = title;
                img.style.maxWidth = '100%';
                img.style.marginTop = '8px';
                item.appendChild(img);
            } else {
                const t = document.createElement('div');
                t.textContent = JSON.stringify(p);
                item.appendChild(t);
            }

            container.appendChild(item);
        });

        if (proofsEl) {
            proofsEl.innerHTML = '';
            proofsEl.appendChild(container);
        }

        // Open panel so user sees proofs
        detailPanel.classList.add('open'); detailPanel.setAttribute('aria-hidden', 'false');
    }

    /* ---------- EXPORT ---------- */
    function exportCSV(list) {
        if (!list || !list.length) { alert('Aucune opération à exporter'); return; }
        const headers = ['Ref', 'Type', 'Date', 'Client', 'Statut', 'Motif'];
        const rows = list.map(o => [o.ref || o.id, o.type, o.date, o.client, o.statut, o.motif || '']);
        const csv = [headers, ...rows].map(r => r.map(cell => {
            const s = String(cell || '');
            return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `operations_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    /* ---------- EVENTS ---------- */
    filterType.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    filterStatus.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    filterDate.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    resetFilters.addEventListener('click', () => { filterType.value = ''; filterStatus.value = ''; filterDate.value = ''; searchInput.value = ''; currentPage = 1; applyFilters(); });
    searchInput.addEventListener('input', debounce(() => { currentPage = 1; applyFilters(); }, 250));
    exportBtn.addEventListener('click', () => exportCSV(filtered));
    pageSizeSelect.addEventListener('change', () => { pageSize = parseInt(pageSizeSelect.value, 10); currentPage = 1; render(); });

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
            return {
                id: idVal || refVal,
                ref: refVal,
                type: item.objet || item.type || 'Facture',
                date: item.date_emission || item.date || item.createdAt || item.dateFacture || item.date_debut || '',
                client: item.nom_client || item.client || item.demandeur || item.fournisseur || item.supplier || item.nom || '',
                statut: normalizeStatus(item.statut || item.status || item.etat),
                motif: item.motif || item.reason || item.commentaire || item.note || ''
            };
        });
    }

    async function loadData() {
        try {
            const el = document.getElementById('facturesData');

            if (el && el.textContent && el.textContent.trim()) {
                const data = JSON.parse(el.textContent);

                operations = normalizeFactures(data);
                filtered = [...operations];

                console.info('Operations chargées (inline):', operations.length);

                render();
                // continue to attempt loading authoritative data from the API
            }
        } catch (err) {
            console.error('Erreur chargement JSON inline:', err);
        }

        // Try to fetch the full list from the API to ensure we display all factures
        try {
            const API_BASE = (() => { const origin = window.location.origin; return origin.includes(':5002') ? origin : 'https://assa-ac-duzn.onrender.com'; })();
            const token = localStorage.getItem('jwtTokenSuperviseur') || localStorage.getItem('jwtTokenAdmin') || localStorage.getItem('jwtToken');
            const url = `${API_BASE}/api/factures`;
            console.info('Fetching factures from API:', url);

            const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } });
            let data = null;
            try { data = await res.json(); } catch (e) { data = null; }

            if (!res.ok) {
                console.warn('API factures returned not-ok:', res.status, data && data.message);
                return;
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
            if (arr && arr.length) {
                operations = normalizeFactures(arr);
                filtered = [...operations];
                console.info('Operations chargées (API):', operations.length);
                // Log unique normalized statuses present (debug)
                try {
                    const uniq = Array.from(new Set(operations.map(o => o.statut))).sort();
                    console.info('Unique normalized statuses:', uniq, 'counts:', uniq.map(s => ({ s, n: operations.filter(o=>o.statut===s).length }))); 
                } catch (e) { console.warn('Erreur listing statuses', e); }
                render();
            } else {
                console.info('Aucune facture reçue depuis l\'API (arr length 0).');
            }

        } catch (err) {
            console.error('Erreur fetch factures API:', err);
        }
    }

    /* ---------- INIT ---------- */
    await loadData();
});