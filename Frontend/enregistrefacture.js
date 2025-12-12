// ======================= CONSTANTES =======================
const API_BASE = 'https://assa-ac-jyn4.onrender.com'; // Base URL pour tous les appels API
const CURRENCY = 'Frs CFA';
const PRICE_CEMAC = 1000;
const PRICE_HORS_CEMAC = 1500;

// === IMPORTANT : REMPLACEZ CECI PAR LE CHEMIN D'ACCÈS RÉEL DE VOTRE LOGO ===
const LOGO_URL = 'logo.jpeg'; 
// =========================================================================

const itemsContainer = document.getElementById('items-container');
const grandTotalSpan = document.getElementById('grand-total');
const totalInWords = document.getElementById('total-in-words');
const formMessage = document.getElementById('form-message');

const modalWrapper = document.getElementById('modal-wrapper');
const previewContent = document.getElementById('preview-content');

const invoiceIdInput = document.getElementById('invoice-id');
const clientSelect = document.getElementById('client-name');
const issueLocationInput = document.getElementById('issue-location');
const airportInput = document.getElementById('airport');

let rowCounter = 0;
let companiesData = {}; // mapping: company_name -> { id, airport, city }

// ======================= UTILITAIRES =======================
function showMessage(msg, type='info') {
    formMessage.textContent = msg;
    const baseClasses = 'text-center p-3 mb-6 rounded-xl font-medium border transition-opacity duration-300';
    let typeClasses = '';
    
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-100 border-green-400 text-green-700';
            break;
        case 'error':
            typeClasses = 'bg-red-100 border-red-400 text-red-700';
            break;
        case 'info':
        default:
            typeClasses = 'bg-blue-100 border-blue-400 text-blue-700';
            break;
    }
    
    formMessage.className = `${baseClasses} ${typeClasses}`;
    formMessage.classList.remove('hidden');
    setTimeout(() => formMessage.classList.add('hidden'), 5000); 
}

function getAdminToken() {
    const token = localStorage.getItem('jwtTokenAdmin');
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Date.now() / 1000;
        if (payload.exp < now) throw new Error("Token expiré.");
        return token;
    } catch (err) {
        if (token) console.error("Token invalide:", err.message);
        return null; 
    }
}

function formatNumber(number) {
    if (isNaN(number) || number === null) return '0';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(number);
}

// Fonction améliorée pour la conversion de nombre en lettres
function numberToWords(n) {
    const num = Math.round(n);
    if (num === 0) return 'Zéro';

    const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const dizaines = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
    const exceptions = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];

    function convertSmall(n) {
        if (n < 10) return unites[n];
        if (n >= 10 && n <= 16) return exceptions[n - 10];
        if (n < 20) return dizaines[1] + (n % 10 !== 0 ? '-' + unites[n % 10] : '');
        
        let d = Math.floor(n / 10);
        let u = n % 10;
        
        if (d === 7 || d === 9) { // 70-79 et 90-99
            d--;
            u += 10; 
            let mots = dizaines[d];
            if (d === 8 && u === 0) mots = dizaines[8]; 
            else if (d === 8 && u > 0) mots = dizaines[8] + '-' + convertSmall(u);
            else mots += '-' + convertSmall(u);
            return mots.replace('dix-dix', 'dix').replace('dix-un', 'onze'); 
        }
        
        let mots = dizaines[d];
        if (u === 1 && d !== 8) mots += ' et un';
        else if (u > 0) mots += '-' + unites[u];
        
        return mots;
    }
    
    function convertHundreds(n) {
        if (n === 0) return '';
        if (n < 100) return convertSmall(n);

        let c = Math.floor(n / 100);
        let r = n % 100;
        let mots = c === 1 ? 'cent' : unites[c] + ' cents';
        
        if (r > 0) {
            if (c > 1 && r === 0) mots = mots.slice(0, -1); 
            mots += ' ' + convertSmall(r);
        } else if (c > 1 && r === 0) {
            mots = unites[c] + ' cents'; 
        }
        return mots.replace('un cents', 'cent');
    }

    if (num < 1000) return convertHundreds(num);

    if (num < 1000000) {
        let m = Math.floor(num / 1000);
        let r = num % 1000;
        let mots = convertHundreds(m).replace('cent ', 'cent').replace('cents ', 'cents') + ' mille';
        
        if (r > 0) {
            mots += ' ' + convertHundreds(r);
        } else if (m === 1) {
            mots = 'mille';
        }

        return mots.replace('un mille', 'mille'); 
    }
    
    return formatNumber(num); 
}


function getPriceByZone(zone) {
    if (zone === 'CEMAC') return PRICE_CEMAC;
    if (zone === 'HORS CEMAC') return PRICE_HORS_CEMAC;
    return 0;
}

// ======================= LIGNES =======================
function calculateTotals() {
    let grandTotal = 0;
    itemsContainer.querySelectorAll('tr').forEach(row => {
        const qty = parseFloat(row.querySelector('input[name="qty"]')?.value) || 0;
        const zone = row.querySelector('select[name="zone"]')?.value;
        
        const price = getPriceByZone(zone);
        
        const priceValueInput = row.querySelector('input[name="price_value"]');
        if (priceValueInput) priceValueInput.value = price;

        const lineTotal = qty * price;
        grandTotal += lineTotal;

        const totalSpan = row.querySelector('span[name="line-total-value"]');
        if (totalSpan) totalSpan.textContent = `${formatNumber(lineTotal)} ${CURRENCY}`;
    });

    grandTotalSpan.textContent = `${formatNumber(grandTotal)} ${CURRENCY}`;
    const totalNum = Math.round(grandTotal);
    
    const totalWords = numberToWords(totalNum).replace(/-/g, ' '); 
    totalInWords.textContent = `Arrêtée la présente facture à la somme de ${totalWords.toUpperCase()} (${formatNumber(totalNum)}) ${CURRENCY}.`;
}

function addItemRow() {
    rowCounter++;
    const newRow = document.createElement('tr');
    newRow.className = "hover:bg-gray-50 transition duration-100";
    
    newRow.innerHTML = `
        <td class="px-2 py-2 text-center text-sm font-medium border-r border-formal-border cell-numero">
            <span name="line-number">${itemsContainer.children.length + 1}</span>
        </td>
        <td class="px-3 py-2 border-r border-formal-border cell-designation">
            <input type="text" name="designation" class="form-input bg-gray-100 text-xs" value="Redevance de Sécurité Aérienne" readonly required>
        </td>
        <td class="px-3 py-2 border-r border-formal-border">
            <input type="number" name="qty" class="form-input text-center text-sm" value="1" min="0" oninput="calculateTotals()" required>
        </td>
        <td class="px-3 py-2 border-r border-formal-border">
            <select name="zone" class="form-select text-sm p-1.5 w-full" onchange="calculateTotals()" required>
                <option value="" selected disabled>Choisir la Zone</option>
                <option value="CEMAC">CEMAC</option>
                <option value="HORS CEMAC">HORS CEMAC</option>
            </select>
            <input type="hidden" name="price_value" value="0">
        </td>
        <td class="px-3 py-2 line-total-cell text-end font-bold text-blue-600">
            <span name="line-total-value">0 ${CURRENCY}</span>
        </td>
        <td class="px-1 py-2 text-center">
            <button type="button" onclick="removeItemRow(this)" class="text-red-500 hover:text-red-700 transition duration-150">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </td>
    `;
    itemsContainer.appendChild(newRow);
    calculateTotals();
}

function removeItemRow(btn) {
    if (itemsContainer.children.length <= 1) {
        showMessage("Vous devez conserver au moins une ligne de redevance.", 'error');
        return;
    }
    btn.closest('tr').remove();
    calculateTotals();
    Array.from(itemsContainer.querySelectorAll('tr')).forEach((r, idx) => {
        const lineNumberSpan = r.querySelector('[name="line-number"]');
        if (lineNumberSpan) lineNumberSpan.textContent = idx + 1;
    });
}

// ======================= CLIENTS =======================
async function loadClients() {
    const token = getAdminToken();
    clientSelect.innerHTML = '<option value="" disabled selected>Veuillez sélectionner une compagnie</option>';

    if (!token) {
        // Données de simulation si pas de token
        ['Asky', 'Camerco', 'Air France', 'Ethiopian Airlines', 'Autre'].forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            clientSelect.appendChild(opt);

            companiesData[name] = { id: Math.floor(Math.random() * 100), airport: name === 'Asky' ? 'Lomé' : '', city: "Pointe-Noire" };
        });
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/companies/all`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Erreur ${response.status} lors du chargement des compagnies.`);

        const resData = await response.json();
        const companies = resData.companies || resData;

        companies.filter(c => c.status === 'Actif').forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.company_name;
            opt.textContent = c.company_name;
            clientSelect.appendChild(opt);

            companiesData[c.company_name] = {
                id: c.id,
                airport: c.airport_code || '',
                city: c.city || "Pointe-Noire"
            };
        });
    } catch (err) {
        console.error(err);
        showMessage('Erreur: impossible de charger les compagnies. ' + err.message, 'error');
    }
}

clientSelect.addEventListener('change', e => {
    const selected = e.target.value;
    if (companiesData[selected]) {
        airportInput.value = companiesData[selected].airport;
        issueLocationInput.value = companiesData[selected].city || ''; 
    } else {
        airportInput.value = '';
        issueLocationInput.value = ""; 
    }
});

async function fetchNextInvoiceId() {
    let token = getAdminToken();
    if (!token) {
        invoiceIdInput.value = "REF-TEST-0001";
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/factures/generate-ref`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error("Token expiré ou non autorisé (401).");
            throw new Error(`Impossible de générer la référence (Statut: ${response.status})`);
        }

        const data = await response.json();
        invoiceIdInput.value = data.numero_facture;

    } catch (error) {
        console.error(error);
        showMessage("Erreur génération référence: " + error.message, 'error');
    }
}

// ======================= APERÇU =======================
function validateForm() {
    const requiredInputs = document.querySelectorAll('#invoice-form [required]');
    for (const input of requiredInputs) {
        if (!input.value || (input.tagName === 'SELECT' && input.value === '') || (input.type === 'number' && parseFloat(input.value) < 0)) {
            showMessage(`Veuillez remplir correctement le champ requis.`, 'error');
            input.focus();
            return false;
        }
    }
    const lineValidation = Array.from(itemsContainer.querySelectorAll('tr')).every(row => {
        const qty = parseFloat(row.querySelector('input[name="qty"]')?.value) || 0;
        const zone = row.querySelector('select[name="zone"]')?.value;
        return qty > 0 && !!zone;
    });

    if (!lineValidation) {
        showMessage("Assurez-vous que toutes les lignes de redevance ont une Quantité > 0 et une Zone sélectionnée.", 'error');
        return false;
    }
    return true;
}

function showPreview() {
    if (!validateForm()) return;

    try {
        // 1. Génération des lignes du tableau de détails
        const itemsHTML = Array.from(itemsContainer.querySelectorAll('tr')).map((row, idx) => {
            const designation = row.querySelector('input[name="designation"]').value === "Redevance de Sécurité Aérienne" ? "RSAR" : row.querySelector('input[name="designation"]').value;
            const qty = row.querySelector('input[name="qty"]').value;
            const total = row.querySelector('span[name="line-total-value"]').textContent;
            const price = row.querySelector('input[name="price_value"]').value;

            // 5 colonnes pour l'aperçu
            return `<tr class="border-b border-gray-200">
                <td class="text-center">${idx + 1}</td>
                <td class="text-left">${designation}</td>
                <td class="text-center">${formatNumber(qty)}</td>
                <td class="text-right">${formatNumber(price)}</td>
                <td class="text-right font-bold">${total.split(' ')[0]}</td>
            </tr>`;
        }).join('');
        
        // 2. Variables
        const clientName = clientSelect.value || "Non spécifié";
        const airport = airportInput.value || "Non spécifié";
        const issueLocation = issueLocationInput.value || "Pointe-Noire";
        const issueDate = document.getElementById('issue-date').value;
        const period = document.getElementById('period').value;
        const invoiceNumber = invoiceIdInput.value;
        const totalText = grandTotalSpan.textContent;
        const formattedDate = new Date(issueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

        // 3. EN-TÊTE (CODE CORRIGÉ : Largeurs ajustées et Logo centré)
        const headerHTML = `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px;">
                <tr>
                    <td style="width: 45%; vertical-align: top; text-align: center; font-size: 8pt; line-height: 1.2;">
                        <div style="font-weight: bold; margin-bottom: 2px;">COMMUNAUTÉ ÉCONOMIQUE ET MONÉTAIRE DE<br>L'AFRIQUE CENTRALE</div>
                        <div style="border-bottom: 1px dashed #000; width: 60%; margin: 2px auto;"></div>
                        
                        <div style="font-weight: bold; margin: 2px 0;">UNION ÉCONOMIQUE DE L'AFRIQUE CENTRALE</div>
                        <div style="border-bottom: 1px dashed #000; width: 60%; margin: 2px auto;"></div>

                        <div style="margin: 2px 0;">AGENCE DE SUPERVISION DE LA SECURITE<br>AERIENNE EN AFRIQUE CENTRALE<br><span style="font-weight: bold;">ASSA-AC</span></div>
                        <div style="border-bottom: 1px dashed #000; width: 60%; margin: 2px auto;"></div>

                        <div style="font-family: 'Brush Script MT', cursive; font-size: 14pt; font-weight: bold; margin-top: 5px;">La Direction Générale</div>
                        <div style="border-bottom: 1px dashed #000; width: 40%; margin: 2px auto;"></div>
                    </td>

                    <td style="width: 20%; vertical-align: top; text-align: center; padding-top: 10px;">
                        <img src="${LOGO_URL}" alt="Logo CEMAC ASSA-AC" style="max-width: 90px; height: auto; margin: 0 auto; display: block;">
                    </td>

                    <td style="width: 35%; vertical-align: top; text-align: center; padding-top: 5px;">
                        <div style="border: 1px solid #000; padding: 5px; font-size: 7pt; font-style: italic; text-align: center; border-radius: 2px; line-height: 1.2;">
                            Vision CEMAC 2025 : « Faire de<br>
                            la CEMAC en 2025 un espace<br>
                            économique intégré et émergent,<br>
                            où règnent la sécurité, la<br>
                            solidarité et la bonne<br>
                            gouvernance, au service du<br>
                            développement humain ».
                        </div>
                    </td>
                </tr>
            </table>
        `;

        // 4. HTML complet
        const previewHTML = `
        <div class="invoice-document print:p-0">
            
            ${headerHTML}

            <div class="invoice-title" style="margin-top: 10px; font-size: 14pt; font-weight: bold; text-align: center;">
                FACTURE ${invoiceNumber}
            </div>

            <div class="client-details" style="margin-top: 20px; font-size: 10pt;">
                <table style="border: none;">
                    <tr>
                        <td style="width: 80px; font-weight: bold; border: none; text-align: left;">Client</td>
                        <td style="border: none; text-align: left;">: ${clientName}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; border: none; text-align: left;">Pour</td>
                        <td style="border: none; text-align: left;">: Redevance de Sécurité Aérienne Régionale (RSAR)</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; border: none; text-align: left;">Période</td>
                        <td style="border: none; text-align: left;">: ${period}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; border: none; text-align: left;">Aéroport</td>
                        <td style="border: none; text-align: left;">: ${airport}</td>
                    </tr>
                </table>
            </div>

            <div class="preview-details" style="margin-top: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #e0e0e0;">
                            <th style="border: 1px solid #000; padding: 5px;">N°</th>
                            <th style="border: 1px solid #000; padding: 5px; text-align: left;">Désignation</th>
                            <th style="border: 1px solid #000; padding: 5px;">Nbre de Passagers</th>
                            <th style="border: 1px solid #000; padding: 5px;">Cout Unitaire</th>
                            <th style="border: 1px solid #000; padding: 5px;">Cout Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                        <tr>
                            <td colspan="4" style="border: 1px solid #000; padding: 5px; text-align: right; font-weight: bold; background-color: #e0e0e0;">TOTAL</td>
                            <td style="border: 1px solid #000; padding: 5px; text-align: right; font-weight: bold; background-color: #e0e0e0;">${totalText.split(' ')[0]}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 15px; font-size: 10pt; font-weight: bold;">
                ${totalInWords.textContent}
            </div>

            <div class="signature-block" style="margin-top: 30px; text-align: right; margin-right: 50px; font-size: 10pt;">
                <div style="display: inline-block; text-align: center;">
                    <div style="font-weight: bold; margin-bottom: 50px;">Fait à ${issueLocation}, le ${formattedDate.toUpperCase()}</div>
                    <div style="margin-bottom: 40px; text-decoration: underline;">La Direction Générale</div>
                </div>
            </div>

            <div class="payment-conditions" style="margin-top: 40px; font-size: 9pt; border-top: none;">
                <u style="font-weight: bold;">Conditions de paiement :</u>
                <ul style="list-style-type: disc; padding-left: 20px; margin-top: 5px;">
                    <li>Par virement bancaire suivant RIB joint en annexe, à trente jours échus ;</li>
                    <li>Au-delà des trente jours une pénalité de 5% est facturée par tranche de 15 jours de retard ;</li>
                    <li>Chaque quinzaine entamée est due.</li>
                </ul>
            </div>

            <div class="mt-8 flex justify-center gap-4 p-4 print-controls">
                <button type="button" onclick="closePreview()" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition">Modifier / Retour</button>
                <button type="button" onclick="sendInvoice(this)" id="send-invoice-button" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Envoyer & Enregistrer</button>
                <button type="button" onclick="printPreview()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">Imprimer</button>
            </div>
        </div>
        `;

        previewContent.innerHTML = previewHTML;
        document.getElementById('form-area').classList.add('hidden'); 
        modalWrapper.classList.remove('hidden');
        modalWrapper.scrollTop = 0;

    } catch (error) {
        showMessage(`Erreur de validation: ${error.message}`, 'error');
        console.error(error);
    }
}

// ======================= IMPRESSION ET GESTION VUE (inchangé) =======================
function printPreview() {
    try {
        alert("ATTENTION : Pour obtenir une facture propre, veuillez DÉSACTIVER les options 'En-têtes et pieds de page' dans les paramètres de la boîte de dialogue d'impression de votre navigateur.");
        const contentToPrint = document.getElementById('preview-content').innerHTML;

        if (!contentToPrint.trim()) {
            return alert("Aucune facture à imprimer.");
        }

        let iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        
        // Les styles de print sont inclus dans le HTML
        doc.open();
        doc.write(`
            <html>
            <head>
                <title>Facture ${document.getElementById('invoice-id').value}</title>
                <link rel="stylesheet" href="enregistrefacture.css"> 
                <style>
                    body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; margin: 0; }
                    .print-controls { display: none !important; }
                    /* Assurer que les styles du modal/aperçu sont appliqués */
                    .invoice-document {
                        padding: 15mm !important;
                        min-height: auto !important;
                        box-shadow: none !important;
                    }
                    table { border-collapse: collapse; width: 100%; }
                    img { max-width: 100%; }
                </style>
            </head>
            <body>
                ${contentToPrint}
            </body>
            </html>
        `);
        doc.close();

        iframe.contentWindow.focus();
        setTimeout(() => {
            iframe.contentWindow.print();
            
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 2000);
        }, 500);

    } catch (err) {
        console.error(err);
        alert("Erreur lors de la tentative d'impression.");
    }
}

function closePreview() {
    modalWrapper.classList.add('hidden');
    document.getElementById('form-area').classList.remove('hidden');
    window.scrollTo(0, 0);
}


// ======================= ENVOI (inchangé) =======================
// ======================= ENVOI =======================
// La fonction accepte maintenant 'buttonElement' comme argument
async function sendInvoice(buttonElement) {
    if (!validateForm()) return;

    // --- LOGIQUE ANTI-DOUBLE CLIC (Ajout) ---
    if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.textContent = 'Enregistrement...'; // Message de chargement
        buttonElement.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        buttonElement.classList.add('bg-gray-400', 'cursor-not-allowed');
    }
    // ------------------------------------------

    const items = Array.from(itemsContainer.querySelectorAll('tr')).map((row, idx) => ({
        numero_ligne: idx + 1,
        designation: row.querySelector('input[name="designation"]').value,
        destination: row.querySelector('select[name="zone"]').value,
        nombre_passagers: parseFloat(row.querySelector('input[name="qty"]').value),
        cout_unitaire: parseFloat(row.querySelector('input[name="price_value"]').value),
        cout_total: (parseFloat(row.querySelector('input[name="qty"]').value) || 0) * (parseFloat(row.querySelector('input[name="price_value"]').value) || 0)
    }));

    const totalNumeric = items.reduce((sum, item) => sum + (Number(item.cout_total) || 0), 0);

    const compagnie = companiesData[clientSelect.value];
    
    const invoiceData = {
        nom_client: clientSelect.value,
        objet: document.getElementById('purpose')?.value || 'Redevance de Sécurité Aérienne Régionale (RSAR)',
        periode: document.getElementById('period')?.value || '',
        aeroport: document.getElementById('airport')?.value || '',
        date_emission: document.getElementById('issue-date')?.value || new Date().toISOString().split('T')[0],
        lieu_emission: issueLocationInput.value || 'Pointe-Noire', 
        montant_total: totalNumeric,
        devise: CURRENCY,
        montant_en_lettres: totalInWords.textContent || '',
        lignes: items,
        id_companie: compagnie?.id || 1 
    };

    try {
        const token = getAdminToken();
        if (!token) {
            console.log("Facture à enregistrer (SIMULATION):", invoiceData);
            showMessage('Simulation : Facture enregistrée sans API (Token Admin manquant).', 'success');
            closePreview();
            return;
        }

        const response = await fetch(`${API_BASE}/api/factures`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(invoiceData)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Erreur ${response.status}: ${JSON.stringify(errData)}`);
        }

        showMessage('Facture envoyée avec succès !', 'success');
        closePreview();
        
    } catch (err) {
        console.error('Erreur lors de l’envoi de la facture:', err);
        showMessage('Erreur lors de l’envoi de la facture: ' + err.message, 'error');
        
    } finally {
        // --- LOGIQUE ANTI-DOUBLE CLIC (Ajout - Réactivation) ---
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.textContent = 'Envoyer & Enregistrer';
            buttonElement.classList.remove('bg-gray-400', 'cursor-not-allowed');
            buttonElement.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
        // --------------------------------------------------------
    }
}


// ======================= INITIALISATION (inchangé) =======================
window.onload = () => {
    try {
        const today = new Date();
        document.getElementById('issue-date').value = today.toISOString().split('T')[0];
        document.getElementById('period').value = getPreviousMonthPeriod();

        fetchNextInvoiceId();
        loadClients();
        
        if (!itemsContainer.children.length) addItemRow();
        else calculateTotals();

        modalWrapper.classList.add('hidden');
    } catch (err) {
        console.error(err);
        showMessage('Erreur d\'initialisation: ' + err.message, 'error');
    }
};

function getPreviousMonthPeriod() {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - 1);
    const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    return `Mois de ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}