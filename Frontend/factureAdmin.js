/* ========================================================= */
/* 💡 GESTION DU THÈME (LIGHT/DARK MODE) */
/* ========================================================= */

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
   
const API_URL = "https://assa-ac-duzn.onrender.com";
const token = localStorage.getItem("jwtTokenAdmin");

if (!token) {
    alert(window.t('session_expired_redirect'));
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
        const res = await fetch(`${API_URL}/api/factures`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || window.t('unable_load_invoices'));
        }

        FACTURES = Array.isArray(data)
            ? data
            : data.factures || [];

        console.log("✅ FACTURES REÇUES :", FACTURES);

        extraireCompagnies();
        remplirListeCompagnies();
        paginateFactures(FACTURES, 8);

    } catch (err) {
        console.error("❌ ERREUR CHARGEMENT:", err);
        alert(window.t('unable_load_invoices'));
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
    // 🔥 1. Charger les factures supprimées stockées dans localStorage
    const hidden = JSON.parse(localStorage.getItem("factures_supprimees") || "[]");

    // 🔥 2. Filtrer AVANT d'afficher
    factures = factures.filter(f => !hidden.includes(f.numero_facture));

    const tbody = document.getElementById("factureTableBody");
    tbody.innerHTML = "";

    factures.forEach(fact => {
        const numeroFacture = fact.numero_facture;
        const compagnie = fact.client;
        const dateEmission = fact.date;
        const montant = fact.amount;
        const statut = fact.status;
        const fichierUrl = fact.fichier_url || "";

        const statutClass =
            statut === "Payée" ? "payee" :
            statut === "Contestée" ? "contester" :
            "en-attente";

        const action =
            statut === "Payée"
                ? `<span class="action-btn-confirmed">Confirmée</span>`
                : statut === "Contestée"
                    ? `
                        <button class="action-btn-delete" onclick="refaireFacture('${numeroFacture}')">
                            Refaire
                        </button>
                        <button class="action-btn-remove" onclick="supprimerFacture('${numeroFacture}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    `
                    : `
                        <button class="action-btn-confirm" onclick="confirmerFacture('${numeroFacture}')">
                            Confirmer
                        </button>
                    `;

        tbody.innerHTML += `
            <tr data-facture-id="${numeroFacture}" data-statut="${statut.toLowerCase()}">

                <td>${numeroFacture}</td>
                <td>${compagnie}</td>
                <td>${dateEmission}</td>
                <td>${Number(montant).toLocaleString()} XAF</td>

                <td>
                    <span class="status-badge ${statutClass}" id="statut-${numeroFacture}">
                        ${statut}
                    </span>
                </td>

                <td style="text-align:center;">
                    <button class="action-btn-view" onclick="voirFacture('${numeroFacture}', '${fichierUrl}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}



/* ============================================================
   5️⃣ FILTRAGE LOCAL PAR COMPAGNIE + RECHERCHE
   ============================================================ */
   function filtrerFactures() {
    const selectStatut = document.getElementById("filter-statut");
    const statutFiltre = selectStatut ? selectStatut.value : "";

    const selectMois = document.querySelectorAll(".report-select")[0];  // filtre par mois
    const selectComp = document.querySelectorAll(".report-select")[1];  // filtre par compagnie
    const recherche = document.getElementById("searchInput").value.toLowerCase();

    const moisFiltre = selectMois.value;       // "12", "11", "10"
    const compagnieFiltre = selectComp.value;

    const result = FACTURES.filter(f => {

        // --- 📅 Filtre par mois ---
        let matchMois = true;
        if (moisFiltre && f.date) {
            const moisFacture = new Date(f.date).getMonth() + 1;
            matchMois = moisFacture.toString() === moisFiltre;
        }
    
        // --- 🏢 Filtre par compagnie ---
        const matchComp = compagnieFiltre ? f.client === compagnieFiltre : true;
    
        // --- 💳 Filtre par statut ---
        let matchStatut = true;
        if (statutFiltre) {
            matchStatut = f.status?.toLowerCase() === statutFiltre;
        }
    
        // --- 🔍 Recherche ---
        const matchRecherche =
            f.client.toLowerCase().includes(recherche) ||
            f.numero_facture.toLowerCase().includes(recherche) ||
            f.date.toLowerCase().includes(recherche);
    
        return matchMois && matchComp && matchStatut && matchRecherche;
    });
    
    paginateFactures(result, 8);

}


function refaireFacture(numero) {
    // Ajoute le numéro dans la session pour préremplir si besoin
    sessionStorage.setItem("factureARefaire", numero);

    // Redirection vers la page de création/modification
    window.location.href = "EnregistreFacture.html";
}

// Quand on tape dans la recherche
function appliquerRecherche() {
    filtrerFactures();
}


/* ============================================================
   6️⃣ CONFIRMER FACTURE
   ============================================================ */
 async function confirmerFacture(id) {
    if (!confirm(window.t('confirm_invoice_paid'))) return;

    try {
        const res = await fetch(`${API_URL}/confirm/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const contentType = res.headers.get("content-type");

        let data;

        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        } else {
            const text = await res.text();
            throw new Error(window.t('json_response_error') + " " + text.substring(0, 100));
        }

        if (!res.ok) {
            throw new Error(data.message || window.t('api_error'));
        }

        alert(window.t('invoice_confirmed'));
        chargerFactures();

    } catch (err) {
        console.error("❌ Erreur confirmation:", err);
        alert(window.t('error_confirmation') + " " + err.message);
    }
}

/* ============================================================
   7️⃣ SUPPRIMER FACTURE
   ============================================================ */
   async function supprimerFacture(numero) {
    if (!confirm(window.t('confirm_delete_invoice'))) return;

    try {
        const encodedNumero = encodeURIComponent(numero);

        const res = await fetch(`${API_URL}/delete/${encodedNumero}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        // 🔥 1. Stocker ce numéro comme "supprimé"
        let hidden = JSON.parse(localStorage.getItem("factures_supprimees") || "[]");
        if (!hidden.includes(numero)) hidden.push(numero);
        localStorage.setItem("factures_supprimees", JSON.stringify(hidden));

        // 🔥 2. Supprimer la ligne du tableau
        const row = document.querySelector(`tr[data-facture-id="${numero}"]`);
        if (row) row.remove();

        alert(window.t('invoice_removed'));
    } catch (err) {
        console.error("Erreur front :", err);
        alert(window.t('error_deletion'));
    }
}



// /* ============================================================
//    8️⃣ VOIR FACTURE
//    ============================================================ */
async function voirFacture(numeroFacture) {
    const token = localStorage.getItem("jwtTokenAdmin");

    console.log("🔍 voirFacture() appelé pour :", numeroFacture);

    try {
        // 1️⃣ Preuves de paiement classiques
        console.log("📡 → Recherche des preuves de paiement…");

        const response = await fetch(
            `https://assa-ac-duzn.onrender.com/api/preuves/by-facture/${encodeURIComponent(numeroFacture)}`,
            { headers: { "Authorization": `Bearer ${token}` } }
        );

        const result = await response.json();

        console.log("📥 Réponse API PREUVES :", result);

        if (response.ok && result.preuves && result.preuves.length > 0) {
            const preuve = result.preuves[result.preuves.length - 1];

            console.log("🧾 Preuve trouvée :", preuve);

            if (preuve.fichier_url) {
                console.log("📄 Ouverture fichier preuve :", preuve.fichier_url);
                window.open(preuve.fichier_url, "_blank");
                return;
            } else {
                console.warn("⚠️ La preuve n’a pas de fichier_url !");
            }
        } else {
            console.log("ℹ️ Aucune preuve classique trouvée.");
        }

        // 2️⃣ Vérifier la contestation liée à la facture
        console.log("📡 → Recherche de la contestation dans FACTURES…");

        const facture = FACTURES.find(f => f.numero_facture === numeroFacture);

        console.log("🧾 Facture trouvée :", facture);

        if (facture && facture.contestation) {
            const contest = facture.contestation;

            console.log("📄 Contestation trouvée :", contest);
            console.log("📦 Champ fichiers :", contest.fichiers);

            // 🟢 S'assurer que c'est un tableau
            const files = Array.isArray(contest.fichiers) ? contest.fichiers : [];

            console.log("🗂️ fichiers[] normalisé :", files);

            if (files.length > 0) {
                console.log("📁 Premier fichier :", files[0]);

                if (files[0].file_url) {
                    console.log("📄 Ouverture fichier contestation :", files[0].file_url);
                    window.open(files[0].file_url, "_blank");
                    return;
                } else {
                    console.warn("⚠️ Fichier trouvé mais pas de file_url !");
                }
            }

            alert(window.t('dispute_no_file'));
            return;
        } else {
            console.log("ℹ️ Aucune contestation trouvée.");
        }

        // 3️⃣ Aucun fichier
        alert(window.t('no_proof_uploaded'));

    } catch (err) {
        console.error("❌ Erreur voirFacture :", err);
        alert(window.t('unable_open_proof'));
    }
}

function paginateFactures(factures, rowsPerPage = 8) {
    const pagination = document.getElementById("facture-pagination");
    let currentPage = 1;

    function renderPage() {
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const pageData = factures.slice(start, end);

        remplirTableau(pageData);
    }

    function renderPagination() {
        pagination.innerHTML = "";
        const totalPages = Math.ceil(factures.length / rowsPerPage);

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

/* ============================================================
   🔟 EXPORTER LA LISTE DES FACTURES (CSV)
   ============================================================ */
   function exporterFactures() {
    // 🔁 On reprend EXACTEMENT les filtres actuels
    const selectStatut = document.getElementById("filter-statut");
    const statutFiltre = selectStatut ? selectStatut.value : "";

    const selectMois = document.querySelectorAll(".report-select")[0];
    const selectComp = document.querySelectorAll(".report-select")[1];
    const recherche = document.getElementById("searchInput")?.value.toLowerCase() || "";

    const moisFiltre = selectMois.value;
    const compagnieFiltre = selectComp.value;

    const facturesFiltrees = FACTURES.filter(f => {
        let matchMois = true;
        if (moisFiltre && f.date) {
            const moisFacture = new Date(f.date).getMonth() + 1;
            matchMois = moisFacture.toString() === moisFiltre;
        }

        const matchComp = compagnieFiltre ? f.client === compagnieFiltre : true;

        let matchStatut = true;
        if (statutFiltre) {
            matchStatut = f.status?.toLowerCase() === statutFiltre;
        }

        const matchRecherche =
            f.client?.toLowerCase().includes(recherche) ||
            f.numero_facture?.toLowerCase().includes(recherche) ||
            f.date?.toLowerCase().includes(recherche);

        return matchMois && matchComp && matchStatut && matchRecherche;
    });

    if (!facturesFiltrees.length) {
        alert(window.t('no_invoices_export'));
        return;
    }

    // 🧾 En-têtes CSV
    const headers = [
        window.t('invoice_number'),
        window.t('companies'),
        window.t('emission_date'),
        window.t('amount'),
        window.t('status')
    ];

    const rows = facturesFiltrees.map(f => [
        f.numero_facture,
        f.client,
        f.date,
        f.amount,
        f.status
    ]);

    // 🔥 BOM UTF-8 POUR EXCEL
    const csvContent = "\uFEFF" + [
        headers.join(";"),
        ...rows.map(r => r.join(";"))
    ].join("\n");

    // ⬇️ Téléchargement
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `factures_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
}


/* ============================================================
   9️⃣ LANCEMENT
   ============================================================ */
window.onload = chargerFactures;

// Activation du filtre "Par mois"
document.querySelectorAll(".report-select")[0].addEventListener("change", filtrerFactures);
document
    .getElementById("filter-statut")
    .addEventListener("change", filtrerFactures);



