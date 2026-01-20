// DOM ready + theme toggle + page logic

document.addEventListener('DOMContentLoaded', () => {

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

    /* ---------- SAMPLE DATA ---------- */
    let operations = [
        { id: "OP-001", type: "Contestation", date: "2025-12-17", demandeur: "Client A", statut: "En attente", motif: "Contestation de la facture n°025/12/25 pour double facturation présumée." },
        { id: "OP-002", type: "Suppression", date: "2025-12-16", demandeur: "Client B", statut: "En attente", motif: "Demande de suppression d'une facture erronée suite à une saisie incorrecte." },
        { id: "OP-003", type: "Contestation", date: "2025-12-15", demandeur: "Client C", statut: "Validée", motif: "Contestation du montant facturé par rapport au contrat initial." },
        { id: "OP-004", type: "Suppression", date: "2025-12-14", demandeur: "Client D", statut: "Rejetée", motif: "Demande de suppression non conforme aux règles internes." }
    ];

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
        const start = (currentPage - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);

        pageItems.forEach(op => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${op.id}</td>
        <td>${op.type}</td>
        <td>${op.date}</td>
        <td>${op.demandeur}</td>
        <td>${op.statut}</td>
        <td class="actions-col">
          <button class="table-btn validate" data-id="${op.id}" type="button">Valider</button>
          <button class="table-btn reject" data-id="${op.id}" type="button">Rejeter</button>
        </td>
      `;
            tr.addEventListener('click', e => { if (e.target.closest('button')) return; openDetail(op); });

            tr.querySelector('.validate').addEventListener('click', e => { e.stopPropagation(); changeStatus(op.id, 'Validée'); });
            tr.querySelector('.reject').addEventListener('click', e => { e.stopPropagation(); changeStatus(op.id, 'Rejetée'); });

            tbody.appendChild(tr);
        });

        renderPagination();
    }

    function renderPagination() {
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        paginationEl.innerHTML = `
      <div class="controls">
        <button ${currentPage === 1 ? 'disabled' : ''} id="prevBtn" type="button">Préc</button>
        <button ${currentPage === totalPages ? 'disabled' : ''} id="nextBtn" type="button">Suiv</button>
      </div>
      <div class="info">Page ${currentPage} / ${totalPages} — ${total} éléments</div>
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

        filtered = operations.filter(op => {
            const matchType = !t || op.type === t;
            const matchStatus = !s || op.statut === s;
            const matchDate = !d || op.date === d;
            const matchQuery = !q || (
                op.id.toLowerCase().includes(q) ||
                op.type.toLowerCase().includes(q) ||
                op.demandeur.toLowerCase().includes(q) ||
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
        operations = operations.map(op => op.id === id ? { ...op, statut } : op);
        applyFilters();
    }

    function openDetail(op) {
        dId.textContent = op.id;
        dType.textContent = op.type;
        dDate.textContent = op.date;
        dDemandeur.textContent = op.demandeur;
        dStatut.textContent = op.statut;
        dMotif.textContent = op.motif || '';
        btnValider.onclick = () => changeStatus(op.id, 'Validée');
        btnRejeter.onclick = () => changeStatus(op.id, 'Rejetée');
        detailPanel.classList.add('open');
        detailPanel.setAttribute('aria-hidden', 'false');
    }

    if (closePanel) closePanel.addEventListener('click', () => { detailPanel.classList.remove('open'); detailPanel.setAttribute('aria-hidden', 'true'); });

    /* ---------- EXPORT ---------- */
    function exportCSV(list) {
        if (!list || !list.length) { alert('Aucune opération à exporter'); return; }
        const headers = ['ID', 'Type', 'Date', 'Demandeur', 'Statut', 'Motif'];
        const rows = list.map(o => [o.id, o.type, o.date, o.demandeur, o.statut, o.motif || '']);
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

    /* ---------- INIT ---------- */
    applyFilters();
});
