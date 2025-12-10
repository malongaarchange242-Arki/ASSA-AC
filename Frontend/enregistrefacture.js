// ======================= CONSTANTES =======================
const API_BASE = 'https://assa-ac-jyn4.onrender.com'; // Base URL pour tous les appels API
const CURRENCY = 'Frs CFA';
const PRICE_CEMAC = 1000;
const PRICE_HORS_CEMAC = 1500;

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
    formMessage.className = `form-message ${type}`;
    formMessage.classList.remove('hidden');
    setTimeout(() => formMessage.classList.add('hidden'), 5000);
}

function getAdminToken() {
    // Tente de récupérer le token Admin. 
    const token = localStorage.getItem('jwtTokenAdmin');
    if (!token) {
        // En mode développement, vous pouvez simuler un token pour tester
        // throw new Error("Token d'administrateur manquant. Veuillez vous connecter en tant qu'administrateur.");
    }
    try {
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Date.now() / 1000;
        if (payload.exp < now) {
            throw new Error("Token d'administrateur expiré. Réauthentification nécessaire.");
        }
        return token;
    } catch (err) {
        // Ignorer l'erreur d'invalide si token non défini pour permettre le test front-end
        if (token) console.error("Token invalide:", err.message);
        return null; 
    }
}

function formatNumber(number) {
    if (isNaN(number) || number === null) return '0';
    // Utilisation de la virgule comme séparateur décimal si nécessaire (bien que l'unité soit souvent entière)
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(number);
}

function numberToWords(n) {
    // Ceci reste une fonction placeholder tant que l'API de conversion n'est pas intégrée ou que la bibliothèque n'est pas ajoutée.
    return n;
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
        
        // Mise à jour de l'input caché pour le prix unitaire (important pour l'envoi API)
        const priceValueInput = row.querySelector('input[name="price_value"]');
        if (priceValueInput) priceValueInput.value = price;

        const lineTotal = qty * price;
        grandTotal += lineTotal;

        const totalSpan = row.querySelector('span[name="line-total-value"]');
        if (totalSpan) totalSpan.textContent = `${formatNumber(lineTotal)} ${CURRENCY}`;
    });

    grandTotalSpan.textContent = `${formatNumber(grandTotal)} ${CURRENCY}`;
    const totalNum = Math.round(grandTotal);
    
    // Mise à jour du total en lettres
    // Note : numberToWords() est un placeholder et pourrait retourner un nombre non converti
    totalInWords.textContent = `Arrêtée la présente facture à la somme de ${numberToWords(totalNum)} (${formatNumber(totalNum)}) ${CURRENCY}.`;
}

function addItemRow() {
    rowCounter++;
    const newRow = document.createElement('tr');
    newRow.className = "hover:bg-gray-50 transition duration-100";
    // ATTENTION: La désignation est désormais cachée et non modifiable, et le cout unitaire est absent du formulaire.
    newRow.innerHTML = `
        <td class="px-2 py-2 text-center text-sm font-medium border-r border-formal-border">
            <span name="line-number">${rowCounter}</span>
        </td>
        <td class="px-3 py-2 border-r border-formal-border">
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
        <td class="px-3 py-2 line-total-cell text-end font-bold text-primary">
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
    // Re-numéroter les lignes
    Array.from(itemsContainer.querySelectorAll('tr')).forEach((r, idx) => {
        const lineNumberSpan = r.querySelector('[name="line-number"]');
        if (lineNumberSpan) lineNumberSpan.textContent = idx + 1;
    });
}

// ======================= CLIENTS =======================
async function loadClients() {
    const token = getAdminToken();
    if (!token) {
        showMessage("Token Admin manquant. Les compagnies n'ont pas été chargées.", 'error');
        // Ajouter les options de base pour permettre le test sans API
        ['Asky', 'Camerco', 'Air France', 'Ethiopian Airlines', 'Autre'].forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            clientSelect.appendChild(opt);
        });
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/companies/all`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Erreur ${response.status} lors du chargement des compagnies.`);
        }

        const resData = await response.json();
        const companies = resData.companies || resData;

        clientSelect.innerHTML = '<option value="" disabled selected>Sélectionner un client</option>';
        companies.filter(c => c.status === 'Actif').forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.company_name;
            opt.textContent = c.company_name;
            clientSelect.appendChild(opt);

            companiesData[c.company_name] = {
                id: c.id,
                airport: c.airport_code || '',
                city: c.city || "N'Djamena"
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
        issueLocationInput.value = companiesData[selected].city;
    } else {
        // Option 'Autre' ou client non trouvé dans les données API
        airportInput.value = '';
        issueLocationInput.value = "N'Djamena";
    }
});

async function fetchNextInvoiceId() {
    let token = getAdminToken();
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE}/api/factures/generate-ref`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error("Token expiré ou non autorisé (401).");
            }
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
        if (!input.value || (input.tagName === 'SELECT' && input.value === '') || (input.type === 'number' && parseFloat(input.value) <= 0)) {
            showMessage(`Veuillez remplir correctement le champ requis.`, 'error');
            input.focus();
            return false;
        }
    }
    // Valider les lignes de redevance (quantité > 0 et zone sélectionnée)
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
            const zone = row.querySelector('select[name="zone"]')?.value; // <-- Récupération de la ZONE

            // **MODIFIÉ : 6 colonnes**
            return `<tr class="border-b border-gray-200">
                <td class="text-center">${idx + 1}</td>
                <td class="text-left">${designation}</td>
                <td class="text-center">${zone || '-'}</td>  <td class="text-center">${formatNumber(qty)}</td>
                <td class="text-right">${formatNumber(price)}</td>
                <td class="text-right font-bold">${total.split(' ')[0]}</td>
            </tr>`;
        }).join('');
        
        // 2. Variables
        const clientName = clientSelect.value || "Non spécifié";
        const airport = airportInput.value || "Non spécifié";
        const issueLocation = issueLocationInput.value || "N'Djamena";
        const issueDate = document.getElementById('issue-date').value;
        const period = document.getElementById('period').value;
        const invoiceNumber = invoiceIdInput.value;
        const totalText = grandTotalSpan.textContent;
        const formattedDate = new Date(issueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

        // 3. EN-TÊTE EXACT
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
                            <th style="border: 1px solid #000; padding: 5px;">Zone</th>          <th style="border: 1px solid #000; padding: 5px;">Nbre de Passagers</th>
                            <th style="border: 1px solid #000; padding: 5px;">Cout Unitaire</th>
                            <th style="border: 1px solid #000; padding: 5px;">Cout Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                        <tr>
                            <td colspan="5" style="border: 1px solid #000; padding: 5px; text-align: left; font-weight: bold; background-color: #e0e0e0;">TOTAL</td>
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
                    <div style="font-weight: bold; margin-bottom: 10px;">Fait à ${issueLocation}, le ${formattedDate.toUpperCase()}</div>
                    <div style="margin-bottom: 40px; text-decoration: underline;">Le Directeur Général</div>
                    
                    <div style="font-weight: bold; text-decoration: underline; margin-top: 5px;">Eugène APOMBI</div>
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
                <button type="button" onclick="sendInvoice()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Envoyer & Enregistrer</button>
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

// ======================= IMPRESSION ET GESTION VUE =======================
function printPreview() {
    try {
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
        
        const formalPrintStyles = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
                
                body { 
                    font-family: Arial, sans-serif; 
                    font-size: 11pt; 
                    color: #000;
                    margin: 0;
                    padding: 15mm; 
                }
                
                .print-controls { display: none !important; }

                table { border-collapse: collapse; width: 100%; }
                td, th { vertical-align: top; }

                .preview-details th, .preview-details td {
                    border: 1px solid #000 !important;
                    padding: 5px;
                    font-size: 10pt;
                }
                
                @font-face {
                    font-family: 'Brush Script MT';
                    src: local('Brush Script MT'), local('Brush Script Std'), local('Brush Script');
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .text-left { text-align: left; }
                .font-bold { font-weight: bold; }
                img { max-width: 100%; }
            </style>
        `;

        doc.open();
        doc.write(`
            <html>
            <head>
                <title>Facture ${document.getElementById('invoice-id').value}</title>
                ${formalPrintStyles}
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


// ======================= ENVOI =======================
async function sendInvoice() {
    if (!validateForm()) return;

    const items = Array.from(itemsContainer.querySelectorAll('tr')).map((row, idx) => ({
        numero_ligne: idx + 1,
        designation: row.querySelector('input[name="designation"]').value,
        destination: row.querySelector('select[name="zone"]').value, // Destination est la Zone
        nombre_passagers: parseFloat(row.querySelector('input[name="qty"]').value),
        cout_unitaire: parseFloat(row.querySelector('input[name="price_value"]').value),
        cout_total: (parseFloat(row.querySelector('input[name="qty"]').value) || 0) * (parseFloat(row.querySelector('input[name="price_value"]').value) || 0)
    }));

    const totalNumeric = items.reduce((sum, item) => sum + (Number(item.cout_total) || 0), 0);

    const compagnie = companiesData[clientSelect.value];
    if (!compagnie || !compagnie.id) {
        showMessage('Impossible de déterminer la compagnie sélectionnée. Réessayez.', 'error');
        // Si le token était null au départ, cette erreur est attendue, mais on peut la bypasser pour le test
        // return;
    }

    const invoiceData = {
        nom_client: clientSelect.value,
        objet: document.getElementById('purpose')?.value || 'Redevance de Sécurité Aérienne Régionale (RSAR)',
        periode: document.getElementById('period')?.value || '',
        aeroport: document.getElementById('airport')?.value || '',
        date_emission: document.getElementById('issue-date')?.value || new Date().toISOString().split('T')[0],
        lieu_emission: document.getElementById('issue-location')?.value || '',
        montant_total: totalNumeric,
        devise: CURRENCY,
        montant_en_lettres: totalInWords.textContent || '',
        lignes: items,
        id_companie: compagnie?.id || 1 // Fallback à ID 1 pour le test si token manquant
    };

    try {
        const token = getAdminToken();
        if (!token) {
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
    }
}


// ======================= INITIALISATION =======================
window.onload = () => {
    try {
        // Définir la date et la période
        const today = new Date();
        document.getElementById('issue-date').value = today.toISOString().split('T')[0];
        document.getElementById('period').value = getPreviousMonthPeriod();

        // Remplir les données (nécessite un token)
        fetchNextInvoiceId();
        loadClients();
        
        // Valeurs par défaut si non remplies par API
        if (!issueLocationInput.value) issueLocationInput.value = "N'Djamena";

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