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
   
const API_URL = "http://localhost:5002";
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
const compagnieCible = new URLSearchParams(window.location.search).get("company")?.trim() || "";
const highlightDisputedInvoices = new URLSearchParams(window.location.search).get("highlight") === "disputed";

/* ============================================================
   1️⃣ CHARGER LES FACTURES
   ============================================================ */
   async function chargerFactures() {
    const tbody = document.getElementById("factureTableBody");
    tbody.setAttribute('aria-busy', 'true');
    tbody.innerHTML = Array.from({ length: 3 }, () => `
        <tr class="admin-skeleton-row">
            ${Array.from({ length: 7 }, () => '<td><span class="admin-skeleton admin-skeleton-block"></span></td>').join('')}
        </tr>
    `).join('');
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
        const requestedCompany = new URLSearchParams(window.location.search).get("company");
        if (requestedCompany) {
            const companySelect = document.querySelectorAll(".report-select")[1];
            const existingOption = Array.from(companySelect.options)
                .some(option => option.value === requestedCompany);
            if (!existingOption) companySelect.add(new Option(requestedCompany, requestedCompany));
            companySelect.value = requestedCompany;
            filtrerFactures();
        } else {
            paginateFactures(FACTURES, 8);
        }
        tbody.setAttribute('aria-busy', 'false');
        if (highlightDisputedInvoices) {
            const firstDisputedInvoice = tbody.querySelector('.invoice-disputed.animate-disputed');
            firstDisputedInvoice?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                block: 'center'
            });
        }

    } catch (err) {
        console.error("❌ ERREUR CHARGEMENT:", err);
        tbody.setAttribute('aria-busy', 'false');
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.textContent = `${window.t('unable_load_invoices')} `;
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.textContent = 'Réessayer';
        retryButton.addEventListener('click', chargerFactures);
        cell.appendChild(retryButton);
        row.appendChild(cell);
        tbody.replaceChildren(row);
        alert(window.t('unable_load_invoices'));
    }
}

/* ============================================================
   2️⃣ EXTRAIRE LA LISTE DES COMPAGNIES
   ============================================================ */
function extraireCompagnies() {
    COMPAGNIES = [...new Set(FACTURES.map(f => f.client).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
}

/* ============================================================
   3️⃣ REMPLIR LA LISTE DÉROULANTE DES COMPAGNIES
   ============================================================ */
function remplirListeCompagnies() {
    const select = document.querySelectorAll(".report-select")[1]; // 2e select = compagnie

    select.replaceChildren(new Option("Par compagnies", ""));

    COMPAGNIES.forEach(comp => {
        select.add(new Option(comp, comp));
    });

    select.onchange = filtrerFactures;
}

/* ============================================================
   4️⃣ REMPLIR LE TABLEAU
============================================================ */
function remplirTableau(factures) {
    const hidden = JSON.parse(localStorage.getItem("factures_supprimees") || "[]");
    factures = factures.filter(f => !hidden.includes(f.numero_facture));

    const tbody = document.getElementById("factureTableBody");
    tbody.innerHTML = "";

    if (!factures.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-message">Aucune facture disponible.</td></tr>`;
        return;
    }

    factures.forEach(fact => {
        const numeroFacture = String(fact.numero_facture || "");
        const compagnie = String(fact.client || "—");
        const dateEmission = formatInvoiceDate(fact.date);
        const montant = Number(fact.amount) || 0;
        const statut = String(fact.status || "Impayée");
        const estContestee = statut.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "contestee";
        const encodedNumero = encodeURIComponent(numeroFacture);
        const preuveEnvoyee = Boolean(fact.preuve_paiement_url);

        const statutClass =
            statut.toLowerCase() === "payée" ? "payee" :
            estContestee ? "contested" :
            "en-attente";

        tbody.innerHTML += `
            <tr class="${[
                compagnieCible && compagnie.trim().toLocaleLowerCase() === compagnieCible.toLocaleLowerCase() ? "invoice-company-highlight" : "",
                estContestee ? "invoice-disputed" : "",
                estContestee && highlightDisputedInvoices ? "animate-disputed" : ""
            ].filter(Boolean).join(" ")}" data-facture-id="${escapeHtml(encodedNumero)}" data-statut="${escapeHtml(statut.toLowerCase())}">
                <td>${escapeHtml(numeroFacture)}</td>
                <td>${escapeHtml(compagnie)}</td>
                <td>${escapeHtml(dateEmission)}</td>
                <td>${Number(montant).toLocaleString()} XAF</td>
                <td>
                    <span class="status-badge ${statutClass}">
                        ${escapeHtml(statut)}
                    </span>
                </td>
                <td class="payment-proof-cell">
                    <span class="payment-proof-badge ${preuveEnvoyee ? "is-sent" : "is-missing"}">
                        <i class="fas ${preuveEnvoyee ? "fa-circle-check" : "fa-circle-minus"}" aria-hidden="true"></i>
                        ${window.t(preuveEnvoyee ? "payment_proof_sent" : "payment_proof_not_sent")}
                    </span>
                </td>
                <td style="text-align:center;">
                    <button class="action-btn-view" type="button" data-view-invoice="${escapeHtml(encodedNumero)}" aria-label="Consulter la facture ${escapeHtml(numeroFacture)}" title="Consulter la facture">
                        <i class="fas fa-eye" aria-hidden="true"></i>
                    </button>
                    <button class="action-btn-view action-btn-proof" type="button" data-view-proof="${escapeHtml(encodedNumero)}" aria-label="Consulter le justificatif de ${escapeHtml(numeroFacture)}" title="Justificatif de paiement">
                        <i class="fas fa-paperclip" aria-hidden="true"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatInvoiceAmount(value) {
    return (Number(value) || 0).toLocaleString("fr-FR");
}

function formatInvoiceDate(value) {
    if (!value) return "—";
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString("fr-FR");
}

function renderInvoiceDetails(facture, lignes) {
    const content = document.getElementById("invoice-view-content");
    const reference = String(facture.numero_facture || "");
    document.getElementById("invoice-view-reference").textContent = reference;

    const linesHtml = lignes.length
        ? lignes.map((ligne, index) => {
            const qty = Number(ligne.nombre_passagers) || 0;
            const unit = Number(ligne.cout_unitaire) || 0;
            const lineTotal = Number(ligne.cout_total) || qty * unit;
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(ligne.designation || "—")}</td>
                    <td>${escapeHtml(ligne.destination || "—")}</td>
                    <td>${formatInvoiceAmount(qty)}</td>
                    <td>${formatInvoiceAmount(unit)}</td>
                    <td>${formatInvoiceAmount(lineTotal)}</td>
                </tr>`;
        }).join("")
        : '<tr><td colspan="6" class="invoice-empty-lines">Aucune ligne de détail enregistrée.</td></tr>';

    content.innerHTML = `
        <article class="invoice-detail-sheet">
            <header class="invoice-detail-heading">
                <div class="invoice-institution">
                    <strong>COMMUNAUTÉ ÉCONOMIQUE ET MONÉTAIRE DE L’AFRIQUE CENTRALE</strong>
                    <span>UNION ÉCONOMIQUE DE L’AFRIQUE CENTRALE</span>
                    <strong>AGENCE DE SUPERVISION DE LA SÉCURITÉ AÉRIENNE EN AFRIQUE CENTRALE</strong>
                    <span>ASSA-AC · La Direction Générale</span>
                </div>
                <img src="logo.jpeg" alt="Logo CEMAC ASSA-AC">
                <div class="invoice-vision">Vision CEMAC 2025 : « Faire de la CEMAC en 2025 un espace économique intégré et émergent, où règnent la sécurité, la solidarité et la bonne gouvernance, au service du développement humain ».</div>
            </header>
            <h3 class="invoice-detail-title">FACTURE ${escapeHtml(reference)}</h3>
            <dl class="invoice-detail-meta">
                <div><dt>Client</dt><dd>${escapeHtml(facture.nom_client || "—")}</dd></div>
                <div><dt>Objet</dt><dd>${escapeHtml(facture.objet || "—")}</dd></div>
                <div><dt>Période</dt><dd>${escapeHtml(facture.periode || "—")}</dd></div>
                <div><dt>Aéroport</dt><dd>${escapeHtml(facture.aeroport || "—")}</dd></div>
                <div><dt>Date d’émission</dt><dd>${formatInvoiceDate(facture.date_emission)}</dd></div>
            </dl>
            <div class="invoice-detail-table-wrap">
                <table class="invoice-detail-table">
                    <thead><tr><th>N°</th><th>Désignation</th><th>Zone</th><th>Passagers</th><th>Coût unitaire</th><th>Coût total</th></tr></thead>
                    <tbody>${linesHtml}</tbody>
                    <tfoot><tr><td colspan="5">TOTAL (${escapeHtml(facture.devise || "Frs CFA")})</td><td>${formatInvoiceAmount(facture.montant_total)}</td></tr></tfoot>
                </table>
            </div>
            <p class="invoice-detail-words">${escapeHtml(facture.montant_en_lettres || "")}</p>
            <div class="invoice-detail-signature">Fait à ${escapeHtml(facture.lieu_emission || "—")}, le ${formatInvoiceDate(facture.date_emission)}<br><strong>La Direction Générale</strong></div>
            <section class="invoice-detail-payment">
                <strong><u>Conditions de paiement :</u></strong>
                <ul>
                    <li>Par virement bancaire suivant RIB joint en annexe, à trente jours échus ;</li>
                    <li>Au-delà des trente jours une pénalité de 5% est facturée par tranche de 15 jours de retard ;</li>
                    <li>Chaque quinzaine entamée est due.</li>
                </ul>
            </section>
            <div class="invoice-detail-status">Statut : ${escapeHtml(facture.statut || "Impayée")}</div>
        </article>`;
}

async function ouvrirApercuFacture(numeroFacture) {
    const modal = document.getElementById("invoice-view-modal");
    const content = document.getElementById("invoice-view-content");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("invoice-view-open");
    content.innerHTML = '<p class="invoice-view-loading" role="status">Chargement de la facture…</p>';

    try {
        const response = await fetch(`${API_URL}/api/factures/${encodeURIComponent(numeroFacture)}`, {
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Impossible de charger cette facture.");
        if (!result.facture || !Array.isArray(result.lignes)) throw new Error("La réponse de la facture est incomplète.");
        renderInvoiceDetails(result.facture, result.lignes);
    } catch (error) {
        console.error("Erreur ouverture facture :", error);
        content.innerHTML = `<p class="invoice-view-error" role="alert">${escapeHtml(error.message)}</p>`;
    }
}

function fermerApercuFacture() {
    const modal = document.getElementById("invoice-view-modal");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("invoice-view-open");
}

async function voirPreuveFacture(numeroFacture) {
    try {
        const response = await fetch(
            `${API_URL}/api/preuves/by-facture/${encodeURIComponent(numeroFacture)}`,
            { headers: { "Authorization": `Bearer ${token}` } }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Impossible de charger le justificatif.");

        const preuves = Array.isArray(result.preuves) ? result.preuves : [];
        const preuve = preuves[preuves.length - 1];
        if (preuve?.fichier_url) {
            window.open(preuve.fichier_url, "_blank", "noopener");
            return;
        }

        const facture = FACTURES.find(item => item.numero_facture === numeroFacture);
        const files = Array.isArray(facture?.contestation?.fichiers) ? facture.contestation.fichiers : [];
        const contestationUrl = files.find(file => file?.file_url)?.file_url;
        if (contestationUrl) {
            window.open(contestationUrl, "_blank", "noopener");
            return;
        }
        alert(window.t('no_proof_uploaded'));
    } catch (error) {
        console.error("Erreur ouverture justificatif :", error);
        alert(`${window.t('unable_open_proof')} ${error.message}`);
    }
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
            String(f.client || "").toLowerCase().includes(recherche) ||
            String(f.numero_facture || "").toLowerCase().includes(recherche) ||
            String(f.date || "").toLowerCase().includes(recherche);
    
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
            `http://localhost:5002/api/preuves/by-facture/${encodeURIComponent(numeroFacture)}`,
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

document.getElementById("factureTableBody").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;

    const encodedNumero = button.dataset.viewInvoice || button.dataset.viewProof;
    if (!encodedNumero) return;

    const numeroFacture = decodeURIComponent(encodedNumero);
    if (button.hasAttribute("data-view-invoice")) {
        ouvrirApercuFacture(numeroFacture);
    } else {
        voirPreuveFacture(numeroFacture);
    }
});

document.querySelectorAll("[data-close-invoice-view]").forEach(element => {
    element.addEventListener("click", fermerApercuFacture);
});

document.getElementById("invoice-view-print").addEventListener("click", () => window.print());

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.getElementById("invoice-view-modal").classList.contains("is-open")) {
        fermerApercuFacture();
    }
});
