
// ====================================================================
// 📌 CONFIG API
// ====================================================================
const API_BASE = "https://assa-ac-jyn4.onrender.com";

let ALL_INVOICES = []; 
let currentSortColumn = null;
let currentSortDirection = 'asc';



// ====================================================================
// 📌 RÉCUPÉRER L’ID DE LA COMPAGNIE VIA jwtTokenCompany
// ====================================================================
function getCompanyIdFromToken() {
    const token = localStorage.getItem("jwtTokenCompany");
    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.id; // ton backend renvoie "id"
    } catch (err) {
        console.error("❌ Erreur décodage JWT", err);
        return null;
    }
}


// ====================================================================
//  CHARGER NOM + LOGO DE LA COMPAGNIE CONNECTÉE
// ====================================================================
async function loadCompanyInfo() {
    const token = localStorage.getItem("jwtTokenCompany");
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE}/api/companies/me`, {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (!response.ok) {
            console.error("❌ Erreur API /companies/me :", response.status);
            return;
        }

        const data = await response.json();
        console.log("🏢 Compagnie connectée :", data);

        // 👉 Les vrais données sont dans data.company
        const company = data.company;

        const nameEl = document.getElementById("company-name");
        const logoEl = document.getElementById("company-logo");

        if (nameEl) {
            nameEl.textContent = company.company_name || "Compagnie";
        }

        if (logoEl) {
            // 👉 TON logo_url est déjà une URL complète => NE PAS prefixer API_BASE
            logoEl.src = company.logo_url
                ? company.logo_url
                : "https://placehold.co/40x40/1e40af/ffffff?text=?";

            logoEl.alt = company.company_name || "Logo compagnie";
        }

    } catch (err) {
        console.error("❌ Erreur loadCompanyInfo() :", err);
    }
}


// ====================================================================
// 📌 GESTION DU THÈME
// ====================================================================
function setTheme(mode) {
    const html = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    const isDark = mode === 'dark';
    html.classList.toggle('dark', isDark);
    localStorage.setItem('theme', mode);

    if (themeIcon) {
        themeIcon.innerHTML = isDark
            ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
               d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707
                  M6.343 6.343l-.707-.707m12.728 0l-.707.707
                  M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>`
            : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
               d="M20.354 15.354A9 9 0 018.646 3.646
                  9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>`;
    }

    if (themeText) {
        themeText.textContent = isDark ? 'Mode Jour' : 'Mode Nuit';
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
}


// ====================================================================
// 📌 CHARGER LES FACTURES
// ====================================================================
async function loadInvoices() {
    const companyId = getCompanyIdFromToken();
    if (!companyId) return;

    try {
        const response = await fetch(`${API_BASE}/api/factures?compagnie_id=${companyId}`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("jwtTokenCompany") }
        });

        if (!response.ok) {
            console.error("❌ Erreur API:", response.status);
            return;
        }

        ALL_INVOICES = await response.json(); // ⬅️ ON STOCKE TOUTES LES FACTURES

        renderInvoices(ALL_INVOICES);
        applySearch(); // ⬅️ Après chargement, on active la recherche

    } catch (err) {
        console.error("❌ Erreur loadInvoices() :", err);
    }
}

function applySearch() {
    const searchValue = document.getElementById("search-input").value.trim().toLowerCase();

    let filtered = ALL_INVOICES.filter(inv => {
        return (
            (inv.id + "").toLowerCase().includes(searchValue) ||
            (inv.date + "").toLowerCase().includes(searchValue) ||
            (inv.amount + "").toLowerCase().includes(searchValue) ||
            (inv.status + "").toLowerCase().includes(searchValue)
        );
    });

    // On applique le tri actuel si existant
    if (currentSortColumn) {
        filtered = sortInvoices(filtered, currentSortColumn);
    }

    renderInvoices(filtered);
}

function sortInvoices(invoices, column) {
    currentSortDirection = (currentSortColumn === column && currentSortDirection === 'asc')
        ? 'desc'
        : 'asc';

    currentSortColumn = column;

    return invoices.sort((a, b) => {
        let x = a[column];
        let y = b[column];

        // Montant = nombre
        if (column === 'amount') {
            x = Number(x);
            y = Number(y);
        }

        // Comparaison par défaut
        if (x < y) return currentSortDirection === 'asc' ? -1 : 1;
        if (x > y) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

function triggerSort(column) {
    let sorted = sortInvoices([...ALL_INVOICES], column);

    // On applique aussi la recherche active
    const searchValue = document.getElementById("search-input").value.trim();
    if (searchValue !== "") {
        sorted = sorted.filter(inv => {
            return (
                (inv.id + "").includes(searchValue) ||
                (inv.date + "").includes(searchValue) ||
                (inv.amount + "").includes(searchValue) ||
                (inv.status + "").includes(searchValue)
            );
        });
    }

    renderInvoices(sorted);
}


// ====================================================================
// 📌 RENDU DES FACTURES + KPI
// ====================================================================
function renderInvoices(INVOICES = []) {
    const tableBody = document.getElementById('invoices-table-body');
    if (!tableBody) return;

    let rowsHTML = '';
    let totalInvoices = 0;
    let disputeCount = 0;

    INVOICES.forEach(inv => {
        totalInvoices++;

        const montant = Number(inv.amount) || 0;
        const formattedXAF = montant.toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'XAF',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

        let displayStatus = inv.status || '—';
        let statusClass = '';

        switch (displayStatus.toLowerCase()) {
            case 'payée':
            case 'payee':
                statusClass = 'bg-green-100 text-green-800';
                break;

            case 'impayée':
            case 'impayee':
                statusClass = 'bg-yellow-100 text-yellow-800';
                break;

            case 'contestée':
            case 'conteste':
                disputeCount++;
                statusClass = 'bg-orange-100 text-orange-800';
                break;

            default:
                statusClass = 'bg-gray-200 text-gray-700';
        }

        let actionButton = '-';

        if (displayStatus.toLowerCase() === 'impayée' || displayStatus.toLowerCase() === 'impayee') {
            actionButton = `
                <a href="TeleverserCompagnie.html?facture=${encodeURIComponent(inv.id)}"
                   class="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 font-semibold transition hover:scale-105">
                   Téléverser Preuve
                </a>`;
        } 
        else if (displayStatus.toLowerCase() === 'payée' || displayStatus.toLowerCase() === 'payee') {
            actionButton = `<span class="text-green-600 dark:text-green-400 font-medium">Réglée</span>`;
        } 
        else if (displayStatus.toLowerCase() === 'contestée' || displayStatus.toLowerCase() === 'conteste') {
            actionButton = `<span class="text-orange-600 dark:text-orange-400 font-medium">En revue</span>`;
        }

        rowsHTML += `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <td class="px-6 py-4 text-sm font-medium">${inv.id || '-'}</td>
                <td class="px-6 py-4 text-sm">${inv.date || '-'}</td>
                <td class="px-6 py-4 text-sm">${formattedXAF}</td>
                <td class="px-6 py-4"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">${displayStatus}</span></td>
                <td class="px-6 py-4 text-center font-medium">${actionButton}</td>
            </tr>`;
    });

    tableBody.innerHTML = rowsHTML;

    // -------------------------------
    // ✔ KPI CORRIGÉ
    // -------------------------------
    const validInvoices = INVOICES.filter(inv =>
        inv.status &&
        ["payée", "payee"].includes(inv.status.toLowerCase())
    ).length;

    document.getElementById('kpi-total-unpaid').textContent = validInvoices;
    document.getElementById('kpi-overdue-count').textContent = totalInvoices;
    document.getElementById('kpi-dispute-count').textContent = disputeCount;
}


// ====================================================================
// 📌 MODAL
// ====================================================================
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}


// ====================================================================
// 📌 INIT
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    setTheme(localStorage.getItem('theme') || 'light');

    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');

    openBtn?.addEventListener('click', () =>
        sidebar.classList.remove('-translate-x-full')
    );

    closeBtn?.addEventListener('click', () =>
        sidebar.classList.add('-translate-x-full')
    );

    document.getElementById("search-input").addEventListener("input", applySearch);


    loadCompanyInfo();  // ⬅️ ICI AJOUTÉ
    loadInvoices();

    window.toggleTheme = toggleTheme;
    window.showModal = showModal;
    window.closeModal = closeModal;
});
