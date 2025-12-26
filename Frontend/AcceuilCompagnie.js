// ====================================================================
// 📌 CONFIG API
// ====================================================================
const API_BASE = "https://assa-ac-jyn4.onrender.com";

let ALL_INVOICES = [];
let currentSortColumn = null;
let currentSortDirection = "asc";
let CURRENT_PAGE = 1;
const ITEMS_PER_PAGE = 6;

// ====================================================================
// 📌 PAGINATION
// ====================================================================
function getPaginatedInvoices() {
    const start = (CURRENT_PAGE - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return ALL_INVOICES.slice(start, end);
}

function renderPaginationControls() {
    const container = document.getElementById("pagination-controls");
    if (!container) return;

    const totalPages = Math.ceil(ALL_INVOICES.length / ITEMS_PER_PAGE);

    container.innerHTML = `
        <div class="flex items-center justify-between mt-4">
            <button 
                onclick="changePage(${CURRENT_PAGE - 1})"
                ${CURRENT_PAGE === 1 ? "disabled" : ""}
                class="px-4 py-2 rounded-md text-sm font-medium
                ${CURRENT_PAGE === 1
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300"}">
                ← Précédent
            </button>

            <span class="text-sm text-gray-600 dark:text-gray-400">
                Page ${CURRENT_PAGE} / ${totalPages || 1}
            </span>

            <button 
                onclick="changePage(${CURRENT_PAGE + 1})"
                ${CURRENT_PAGE === totalPages ? "disabled" : ""}
                class="px-4 py-2 rounded-md text-sm font-medium
                ${CURRENT_PAGE === totalPages
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300"}">
                Suivant →
            </button>
        </div>
    `;
}

function changePage(page) {
    const totalPages = Math.ceil(ALL_INVOICES.length / ITEMS_PER_PAGE);
    if (page < 1 || page > totalPages) return;

    CURRENT_PAGE = page;
    renderInvoices(getPaginatedInvoices());
    renderPaginationControls();
}

// ====================================================================
// 🏢 INFOS COMPAGNIE (COOKIE AUTH)
// ====================================================================
async function loadCompanyInfo() {
    try {
        const response = await fetch(`${API_BASE}/api/companies/me`, {
            credentials: "include"
        });

        if (!response.ok) {
            console.error("❌ Erreur /companies/me :", response.status);
            return;
        }

        const { company } = await response.json();
        if (!company) return;

        document.getElementById("company-name").textContent =
            company.company_name || "Compagnie";

        const logoEl = document.getElementById("company-logo");
        if (logoEl) {
            logoEl.src = company.logo_url?.trim()
                ? company.logo_url
                : "https://placehold.co/40x40/1e40af/ffffff?text=?";
        }

    } catch (err) {
        console.error("❌ loadCompanyInfo()", err);
    }
}

// ====================================================================
// 📌 THÈME (localStorage OK)
// ====================================================================
function setTheme(mode) {
    const html = document.documentElement;
    html.classList.toggle("dark", mode === "dark");
    localStorage.setItem("theme", mode);
}

function toggleTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
}

// ====================================================================
// 📌 FACTURES (COOKIE AUTH)
// ====================================================================
async function loadInvoices() {
    try {
        const response = await fetch(`${API_BASE}/api/factures`, {
            credentials: "include"
        });

        if (!response.ok) {
            console.error("❌ Erreur API factures :", response.status);
            return;
        }

        ALL_INVOICES = await response.json();
        renderInvoices(ALL_INVOICES);
        applySearch();
        renderPaginationControls();

    } catch (err) {
        console.error("❌ loadInvoices()", err);
    }
}

// ====================================================================
// 🔍 SEARCH + TRI
// ====================================================================
function applySearch() {
    const searchValue = document.getElementById("search-input").value.toLowerCase();

    let filtered = ALL_INVOICES.filter(inv =>
        Object.values(inv).some(v =>
            String(v).toLowerCase().includes(searchValue)
        )
    );

    if (currentSortColumn) {
        filtered = sortInvoices(filtered, currentSortColumn);
    }

    renderInvoices(filtered);
}

function sortInvoices(invoices, column) {
    currentSortDirection =
        currentSortColumn === column && currentSortDirection === "asc"
            ? "desc"
            : "asc";

    currentSortColumn = column;

    return invoices.sort((a, b) => {
        let x = a[column];
        let y = b[column];

        if (column === "amount") {
            x = Number(x);
            y = Number(y);
        }

        return currentSortDirection === "asc" ? x - y : y - x;
    });
}

// ====================================================================
// 📊 RENDU FACTURES + KPI
// ====================================================================
function renderInvoices(INVOICES = []) {
    const tableBody = document.getElementById("invoices-table-body");
    if (!tableBody) return;

    let rowsHTML = "";
    let disputeCount = 0;

    INVOICES.forEach(inv => {
        const montant = Number(inv.amount) || 0;
        const formattedXAF = montant.toLocaleString("fr-FR", {
            style: "currency",
            currency: "XAF",
            maximumFractionDigits: 0
        });

        const status = (inv.status || "").toLowerCase();
        if (status === "contestée" || status === "conteste") disputeCount++;

        rowsHTML += `
<tr>
    <td>${inv.numero_facture || "-"}</td>
    <td>${inv.date || "-"}</td>
    <td>${formattedXAF}</td>
    <td>${inv.status || "-"}</td>
    <td>
        <button onclick="openInvoicePage('${inv.numero_facture}', '${inv.status}')">
            Voir
        </button>
    </td>
</tr>`;
    });

    tableBody.innerHTML = rowsHTML;

    document.getElementById("kpi-dispute-count").textContent = disputeCount;
}

// ====================================================================
// 📌 INIT
// ====================================================================
document.addEventListener("DOMContentLoaded", () => {
    setTheme(localStorage.getItem("theme") || "light");

    document
        .getElementById("search-input")
        ?.addEventListener("input", applySearch);

    loadCompanyInfo();
    loadInvoices();

    window.toggleTheme = toggleTheme;
});
