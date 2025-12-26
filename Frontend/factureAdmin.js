/* ========================================================= */
/* 💡 GESTION DU THÈME (LIGHT/DARK MODE) */
/* ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.getElementById("theme-toggle");
    const body = document.body;

    function applyTheme(theme) {
        if (theme === "dark") {
            body.classList.add("dark-mode");
            localStorage.setItem("theme", "dark");
            themeToggle && (themeToggle.innerHTML = '<i class="fas fa-sun"></i>');
        } else {
            body.classList.remove("dark-mode");
            localStorage.setItem("theme", "light");
            themeToggle && (themeToggle.innerHTML = '<i class="fas fa-moon"></i>');
        }
    }

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) applyTheme(savedTheme);
    else applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

    themeToggle?.addEventListener("click", () => {
        applyTheme(body.classList.contains("dark-mode") ? "light" : "dark");
    });
});

/* ========================================================= */
/* 🌐 CONFIG API */
/* ========================================================= */

const API_URL = "https://assa-ac-jyn4.onrender.com/api/factures";

/* ============================================================ */
/* VARIABLES GLOBALES */
/* ============================================================ */

let FACTURES = [];
let COMPAGNIES = [];

/* ============================================================ */
/* 1️⃣ CHARGER LES FACTURES (COOKIE AUTH) */
/* ============================================================ */

async function chargerFactures() {
    try {
        const res = await fetch(API_URL, { credentials: "include" });

        if (res.status === 401) {
            window.location.href = "Index.html";
            return;
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        FACTURES = Array.isArray(data) ? data : data.factures || [];

        extraireCompagnies();
        remplirListeCompagnies();
        paginateFactures(FACTURES, 8);

    } catch (err) {
        console.error(err);
        alert("Impossible de charger les factures.");
    }
}

/* ============================================================ */
/* 2️⃣ EXTRAIRE COMPAGNIES */
/* ============================================================ */

function extraireCompagnies() {
    COMPAGNIES = [...new Set(FACTURES.map(f => f.client).filter(Boolean))];
}

/* ============================================================ */
/* 3️⃣ SELECT COMPAGNIES */
/* ============================================================ */

function remplirListeCompagnies() {
    const select = document.querySelectorAll(".report-select")[1];
    select.innerHTML = `<option value="">Par compagnies</option>`;

    COMPAGNIES.forEach(c => {
        select.innerHTML += `<option value="${c}">${c}</option>`;
    });

    select.addEventListener("change", filtrerFactures);
}

/* ============================================================ */
/* 4️⃣ TABLEAU */
/* ============================================================ */

function remplirTableau(factures) {
    const hidden = JSON.parse(localStorage.getItem("factures_supprimees") || "[]");
    const tbody = document.getElementById("factureTableBody");
    tbody.innerHTML = "";

    factures
        .filter(f => !hidden.includes(f.numero_facture))
        .forEach(f => {
            const statutClass =
                f.status === "Payée" ? "payee" :
                f.status === "Contestée" ? "contester" : "en-attente";

            const action =
                f.status === "Payée"
                    ? `<span class="action-btn-confirmed">Confirmée</span>`
                    : f.status === "Contestée"
                        ? `
                          <button class="btn-refaire" onclick="refaireFacture('${f.numero_facture}')">
                              Refaire
                          </button>
                          <button class="btn-delete" onclick="supprimerFacture('${f.numero_facture}')">
                              🗑
                          </button>`
                        : `
                          <button class="btn-confirmer" onclick="confirmerFacture('${f.numero_facture}')">
                              Confirmer
                          </button>`;

            tbody.innerHTML += `
                <tr data-facture-id="${f.numero_facture}">
                    <td>${f.numero_facture}</td>
                    <td>${f.client}</td>
                    <td>${f.date}</td>
                    <td>${Number(f.amount).toLocaleString()} XAF</td>
                    <td>
                        <span class="status-badge ${statutClass}">
                            ${f.status}
                        </span>
                    </td>
                    <td>
                        <button class="btn-view" onclick="voirFacture('${f.numero_facture}')">👁</button>
                    </td>
                    <td>${action}</td>
                </tr>`;
        });
}
/* ============================================================ */
/* 5️⃣ FILTRAGE */
/* ============================================================ */

function filtrerFactures() {
    const statut = document.getElementById("filter-statut")?.value || "";
    const mois = document.querySelectorAll(".report-select")[0].value;
    const comp = document.querySelectorAll(".report-select")[1].value;
    const search = document.getElementById("searchInput").value.toLowerCase();

    const result = FACTURES.filter(f => {
        const matchMois = !mois || new Date(f.date).getMonth() + 1 == mois;
        const matchComp = !comp || f.client === comp;
        const matchStatut = !statut || f.status?.toLowerCase() === statut;
        const matchSearch =
            f.client?.toLowerCase().includes(search) ||
            f.numero_facture?.toLowerCase().includes(search);

        return matchMois && matchComp && matchStatut && matchSearch;
    });

    paginateFactures(result, 8);
}

/* ============================================================ */
/* 6️⃣ ACTIONS */
/* ============================================================ */

async function confirmerFacture(id) {
    if (!confirm("Confirmer cette facture ?")) return;

    const res = await fetch(`${API_URL}/confirm/${encodeURIComponent(id)}`, {
        method: "PUT",
        credentials: "include"
    });

    if (res.status === 401) return location.href = "Index.html";
    await res.json();
    chargerFactures();
}

async function supprimerFacture(id) {
    if (!confirm("Supprimer cette facture ?")) return;

    const res = await fetch(`${API_URL}/delete/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include"
    });

    if (res.status === 401) return location.href = "Index.html";

    let hidden = JSON.parse(localStorage.getItem("factures_supprimees") || "[]");
    hidden.push(id);
    localStorage.setItem("factures_supprimees", JSON.stringify(hidden));

    document.querySelector(`tr[data-facture-id="${id}"]`)?.remove();
}

function refaireFacture(id) {
    sessionStorage.setItem("factureARefaire", id);
    window.location.href = "EnregistreFacture.html";
}

/* ============================================================ */
/* 7️⃣ VOIR FACTURE */
/* ============================================================ */

async function voirFacture(numero) {
    try {
        const res = await fetch(
            `https://assa-ac-jyn4.onrender.com/api/preuves/by-facture/${encodeURIComponent(numero)}`,
            {
                credentials: "include"
            }
        );

        if (res.status === 401 || res.status === 403) {
            alert("Session expirée. Veuillez vous reconnecter.");
            window.location.href = "Index.html";
            return;
        }

        const data = await res.json();
        const preuve = data?.preuves?.at(-1);

        if (preuve?.fichier_url) {
            window.open(preuve.fichier_url, "_blank");
        } else {
            alert("Aucune preuve disponible.");
        }

    } catch (err) {
        console.error(err);
        alert("Erreur ouverture facture.");
    }
}


/* ============================================================ */
/* 8️⃣ PAGINATION */
/* ============================================================ */

function paginateFactures(data, size) {
    let page = 1;
    const pag = document.getElementById("facture-pagination");

    function render() {
        remplirTableau(data.slice((page - 1) * size, page * size));
    }

    pag.innerHTML = "";
    const pages = Math.ceil(data.length / size);

    for (let i = 1; i <= pages; i++) {
        const b = document.createElement("button");
        b.textContent = i;
        b.onclick = () => { page = i; render(); };
        pag.appendChild(b);
    }

    render();
}

/* ============================================================ */
/* 🚀 LANCEMENT */
/* ============================================================ */

window.onload = chargerFactures;
document.getElementById("filter-statut")?.addEventListener("change", filtrerFactures);
document.querySelectorAll(".report-select")[0]?.addEventListener("change", filtrerFactures);
