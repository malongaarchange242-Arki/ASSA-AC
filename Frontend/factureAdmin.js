const API_URL = "https://assa-ac-jyn4.onrender.com/api/factures";
const token = localStorage.getItem("jwtTokenAdmin");

if (!token) {
    alert("Votre session a expiré. Veuillez vous reconnecter.");
    window.location.href = "Index.html";
}

/* ============================================================
   VARIABLES GLOBALES
   ============================================================ */
let FACTURES = [];   // Stocke toutes les factures
let COMPAGNIES = []; // Stocke la liste unique des compagnies

/* ============================================================
   1️⃣ CHARGER LES FACTURES
   ============================================================ */
async function chargerFactures() {
    try {
        const res = await fetch(API_URL, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Erreur chargement factures");
        }

        FACTURES = Array.isArray(data) ? data : data.factures || [];

        console.log("FACTURES REÇUES :", FACTURES);

        extraireCompagnies();
        remplirListeCompagnies();
        remplirTableau(FACTURES);

    } catch (err) {
        console.error("ERREUR CHARGEMENT:", err);
        alert("Impossible de charger les factures.");
    }
}

/* ============================================================
   2️⃣ EXTRAIRE LA LISTE DES COMPAGNIES
   ============================================================ */
function extraireCompagnies() {
    COMPAGNIES = [...new Set(FACTURES.map(f => f.client).filter(Boolean))];
    console.log("COMPAGNIES :", COMPAGNIES);
}

/* ============================================================
   3️⃣ REMPLIR LA LISTE DÉROULANTE DES COMPAGNIES
   ============================================================ */
function remplirListeCompagnies() {
    const select = document.querySelectorAll(".report-select")[1]; // 2e select = compagnie

    select.innerHTML = `<option value="">Par compagnies</option>`;

    COMPAGNIES.forEach(comp => {
        select.innerHTML += `<option value="${comp}">${comp}</option>`;
    });

    select.addEventListener("change", filtrerFactures);
}

/* ============================================================
   4️⃣ REMPLIR LE TABLEAU
   ============================================================ */
function remplirTableau(factures) {
    const tbody = document.getElementById("factureTableBody");
    tbody.innerHTML = "";

    factures.forEach(fact => {

        const id = fact.id;
        const compagnie = fact.client;
        const dateEmission = fact.date;
        const montant = fact.amount;
        const statut = fact.status;

        const statutClass =
            statut === "Payée" ? "payee" :
            statut === "Contestée" ? "contester" :
            "en-attente";

        const action =
            statut === "Payée"
                ? `<span class="action-btn-confirmed">Confirmée</span>`
                : statut === "Contestée"
                    ? `<button class="action-btn-delete" onclick="supprimerFacture('${id}')">Supprimer</button>`
                    : `<button class="action-btn-confirm" onclick="confirmerFacture('${id}')">Confirmer</button>`;

        tbody.innerHTML += `
            <tr data-facture-id="${id}" data-statut="${statut.toLowerCase()}">

                <td>${id}</td>
                <td>${compagnie}</td>
                <td>${dateEmission}</td>
                <td>${Number(montant).toLocaleString()} XAF</td>

                <td>
                    <span class="status-badge ${statutClass}" id="statut-${id}">
                        ${statut}
                    </span>
                </td>

                <td style="text-align:center;">
                    <button class="action-btn-view" onclick="voirFacture('${id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>

                <td style="text-align:right;">
                    <div class="action-button-group" id="actions-${id}">
                        ${action}
                    </div>
                </td>
            </tr>
        `;
    });
}

/* ============================================================
   5️⃣ FILTRAGE LOCAL PAR COMPAGNIE + RECHERCHE
   ============================================================ */
function filtrerFactures() {
    const selectComp = document.querySelectorAll(".report-select")[1];
    const recherche = document.getElementById("searchInput").value.toLowerCase();

    const compagnieFiltre = selectComp.value;

    const result = FACTURES.filter(f => {
        const matchComp = compagnieFiltre ? f.client === compagnieFiltre : true;
        const matchRecherche =
            f.client.toLowerCase().includes(recherche) ||
            f.id.toLowerCase().includes(recherche) ||
            f.date.toLowerCase().includes(recherche);

        return matchComp && matchRecherche;
    });

    remplirTableau(result);
}

// Quand on tape dans la recherche
function appliquerRecherche() {
    filtrerFactures();
}

/* ============================================================
   6️⃣ CONFIRMER FACTURE
   ============================================================ */
   async function confirmerFacture(numero) {
    if (!confirm("Confirmer cette facture comme payée ?")) return;

    try {
        const encoded = encodeURIComponent(numero);

        const res = await fetch(`${API_URL}/confirm/${encoded}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Erreur API");

        alert("Facture confirmée !");
        chargerFactures();

    } catch (err) {
        console.error("Erreur confirmation:", err);
        alert("Erreur lors de la confirmation.");
    }
}


/* ============================================================
   7️⃣ SUPPRIMER FACTURE
   ============================================================ */
async function supprimerFacture(numero) {
    if (!confirm("Supprimer définitivement cette facture ?")) return;

    try {
        const res = await fetch(`${API_URL}/delete/${numero}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message);

        alert("Facture supprimée !");
        chargerFactures();

    } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression.");
    }
}

/* ============================================================
   8️⃣ VOIR FACTURE
   ============================================================ */
function voirFacture(numero) {
    window.location.href = `detailsFactureAdmin.html?facture=${numero}`;
}

/* ============================================================
   9️⃣ LANCEMENT
   ============================================================ */
window.onload = chargerFactures;
