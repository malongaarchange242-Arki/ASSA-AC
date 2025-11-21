// ======================= CONSTANTES =======================
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

let rowCounter = 0;
let companiesData = {}; // mapping: company_name -> { id, airport, city }

// ======================= UTILITAIRES =======================
function showMessage(msg, type='info') {
    formMessage.textContent = msg;
    formMessage.className = `form-message ${type}`;
    setTimeout(() => formMessage.textContent = '', 5000);
}

function getAdminToken() {
    const token = localStorage.getItem('jwtTokenAdmin');
    if (!token) throw new Error("Token admin manquant");
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Date.now() / 1000;
        if (payload.exp < now) throw new Error("Token expiré");
        return token;
    } catch (err) {
        throw new Error("Token invalide");
    }
}

function formatNumber(number) {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(number);
}

// Convertit un nombre en lettres (simplifié)
function numberToWords(n) {
    // Ici, tu peux remplacer par une vraie fonction en lettres si tu veux
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
        row.querySelector('input[name="price_value"]').value = price;

        const lineTotal = qty * price;
        grandTotal += lineTotal;

        const totalSpan = row.querySelector('span[name="line-total-value"]');
        if (totalSpan) totalSpan.textContent = `${formatNumber(lineTotal)} ${CURRENCY}`;
    });

    grandTotalSpan.textContent = `${formatNumber(grandTotal)} ${CURRENCY}`;
    totalInWords.textContent = `Arrêtée la présente facture à la somme de ${numberToWords(Math.round(grandTotal))} (${formatNumber(Math.round(grandTotal))}) ${CURRENCY}.`;
}

function addItemRow() {
    rowCounter++;
    const newRow = document.createElement('tr');
    newRow.className = "hover:bg-gray-50 transition duration-100";
    newRow.innerHTML = `
        <td class="px-2 py-2 text-center text-sm font-medium border-r border-formal-border">${rowCounter}</td>
        <td class="px-3 py-2 border-r border-formal-border">
            <input type="text" name="designation" class="form-input bg-gray-200" value="Redevance de Sécurité Aérienne" readonly required>
        </td>
        <td class="px-3 py-2 border-r border-formal-border">
            <input type="number" name="qty" class="form-input text-center" value="1" min="0" oninput="calculateTotals()" required>
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
            <button type="button" onclick="removeItemRow(this)" class="text-danger hover:text-red-700 transition duration-150">x</button>
        </td>
    `;
    itemsContainer.appendChild(newRow);
    calculateTotals();
}

function removeItemRow(btn) {
    if (itemsContainer.children.length <= 1) {
        alert("Vous devez conserver au moins une ligne de redevance.");
        return;
    }
    btn.closest('tr').remove();
    calculateTotals();
}

// ======================= CLIENTS =======================
async function loadClients() {
    try {
        const token = getAdminToken();
        const response = await fetch('https://assa-ac.onrender.com/api/companies/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Erreur ${response.status}`);

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
                city: c.city || ''
            };
        });
    } catch (err) {
        console.error(err);
        showMessage('Erreur: impossible de charger les compagnies.', 'error');
    }
}

clientSelect.addEventListener('change', e => {
    const selected = e.target.value;
    if (companiesData[selected]) {
        document.getElementById('airport').value = companiesData[selected].airport;
        document.getElementById('issue-location').value = companiesData[selected].city || "N'Djamena";
    }
});

// ======================= NUMERO FACTURE =======================
async function fetchNextInvoiceId() {
    try {
        const token = getAdminToken();
        const response = await fetch('https://assa-ac.onrender.com/api/factures/generate-ref', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Impossible de générer la référence (${response.status})`);

        const data = await response.json();

        // 🔹 Vérifie la clé renvoyée par le serveur
        invoiceIdInput.value = data.numero_facture || data.invoice_id || 'N°XXXX/XX/XX/ASSA-AC/DAF';

        console.log('Référence générée:', invoiceIdInput.value);
    } catch (err) {
        console.error('Erreur fetchNextInvoiceId:', err);
        invoiceIdInput.value = 'N°XXXX/XX/XX/ASSA-AC/DAF';
        showMessage('Impossible de générer la référence. Vérifiez votre connexion.', 'error');
    }
}


// ======================= APERÇU =======================
function validateForm() {
    const requiredInputs = document.querySelectorAll('#invoice-form [required]');
    for (const input of requiredInputs) {
        if (!input.value || (input.tagName === 'SELECT' && input.value === '')) {
            showMessage(`Veuillez remplir le champ requis : ${input.name}`, 'error');
            input.focus();
            return false;
        }
    }
    return true;
}

function showPreview() {
    if (!validateForm()) return;

    try {
        // Générer les lignes de la facture
        const itemsHTML = Array.from(itemsContainer.querySelectorAll('tr')).map((row, idx) => {
            const designation = row.querySelector('input[name="designation"]').value;
            const qty = row.querySelector('input[name="qty"]').value;
            const zone = row.querySelector('select[name="zone"]').value;
            const total = row.querySelector('span[name="line-total-value"]').textContent;
            return `<tr>
                <td class="text-center px-2 py-1 border">${idx + 1}</td>
                <td class="px-2 py-1 border">${designation}</td>
                <td class="text-center px-2 py-1 border">${qty}</td>
                <td class="text-center px-2 py-1 border">${zone}</td>
                <td class="text-right px-2 py-1 border font-bold">${total}</td>
            </tr>`;
        }).join('');

        // HTML complet de l'aperçu
        const previewHTML = `
        <div class="p-6 font-sans text-gray-800" style="max-width:800px; margin:auto; background:white; border:1px solid #ccc;">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h1 class="text-2xl font-bold">ASSA-AC</h1>
                    <p>Direction Administrative et Financière</p>
                    <p>N'Djamena, Tchad</p>
                    <p>Email: contact@assa-ac.com</p>
                </div>
                <div class="text-right">
                    <h2 class="text-xl font-semibold">FACTURE</h2>
                    <p><strong>N°:</strong> ${invoiceIdInput.value}</p>
                    <p><strong>Date:</strong> ${document.getElementById('issue-date').value}</p>
                    <p><strong>Période:</strong> ${document.getElementById('period').value}</p>
                </div>
            </div>

            <div class="mb-4">
                <h3 class="font-semibold mb-1">Facturé à :</h3>
                <p><strong>Client:</strong> ${clientSelect.value}</p>
                <p><strong>Aéroport:</strong> ${document.getElementById('airport').value}</p>
                <p><strong>Lieu d'émission:</strong> ${document.getElementById('issue-location').value}</p>
            </div>

            <table class="w-full border-collapse mb-4 text-sm">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="border px-2 py-1">N°</th>
                        <th class="border px-2 py-1">Désignation</th>
                        <th class="border px-2 py-1">Quantité</th>
                        <th class="border px-2 py-1">Zone</th>
                        <th class="border px-2 py-1">Total</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>

            <div class="flex justify-end mb-4">
                <div class="text-right">
                    <p class="text-lg font-bold">Total Général: ${grandTotalSpan.textContent}</p>
                    <p class="text-sm italic">${totalInWords.textContent}</p>
                </div>
            </div>

            <div class="mt-4 p-3 border-t border-gray-300 text-sm text-gray-700">
                <strong>Conditions de paiement :</strong>
                <ul class="list-disc ml-5">
                    <li>Par virement bancaire suivant RIB joint en annexe, à trente jours échus ;</li>
                    <li>Au-delà des trente jours, une pénalité de 5% est facturée par tranche de 15 jours de retard ;</li>
                    <li>Chaque quinzaine entamée est due.</li>
                </ul>
            </div>

            <p class="mt-6 text-center text-gray-600 text-sm">Merci pour votre confiance. Cette facture est générée électroniquement et est valide sans signature.</p>

            <div class="mt-4 flex justify-center gap-2">
                <button onclick="closePreview()" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Retour</button>
                <button onclick="sendInvoice()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Envoyer</button>
                <button onclick="printPreview()" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Imprimer</button>
            </div>
        </div>
        `;

        previewContent.innerHTML = previewHTML;
        modalWrapper.classList.remove('hidden');
        modalWrapper.scrollTop = 0;

    } catch (error) {
        showMessage(`Erreur de validation: ${error.message}`, 'error');
        console.error(error);
    }
}

function printPreview() {
    try {
        // Vérifie qu’il y a un aperçu
        if (!previewContent.innerHTML.trim()) {
            return alert("Aucune facture à imprimer.");
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Facture ${invoiceIdInput.value}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #333; padding: 5px; text-align: center; }
                    th { background-color: #f0f0f0; }
                    .text-end { text-align: right; }
                </style>
            </head>
            <body>
                ${previewContent.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    } catch (err) {
        console.error(err);
        alert("Impossible d'imprimer la facture.");
    }
}


function closePreview() {
    modalWrapper.classList.add('hidden');
}


// ======================= ENVOI =======================
async function sendInvoice() {
    if (!validateForm()) return;

    const items = Array.from(itemsContainer.querySelectorAll('tr')).map(row => ({
        designation: row.querySelector('input[name="designation"]').value,
        qty: parseFloat(row.querySelector('input[name="qty"]').value),
        zone: row.querySelector('select[name="zone"]').value,
        price: parseFloat(row.querySelector('input[name="price_value"]').value)
    }));

    const totalNumeric = items.reduce((sum, item) => sum + item.qty * item.price, 0);

    const invoiceData = {
        invoice_id: invoiceIdInput.value || 'N°XXXX/XX/XX/ASSA-AC/DAF',
        nom_client: clientSelect.value,
        period: document.getElementById('period')?.value || '',
        issue_date: document.getElementById('issue-date')?.value || new Date().toISOString().split('T')[0],
        items,
        montant_total: totalNumeric,
        currency: CURRENCY,
        statut: 'Impayée'
    };

    console.log('Invoice payload:', invoiceData);

    try {
        const token = getAdminToken();
        const response = await fetch('https://assa-ac.onrender.com/api/factures', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(invoiceData)
        });

        const resData = await response.json();

        if (!response.ok) {
            throw new Error(`Erreur ${response.status}: ${JSON.stringify(resData)}`);
        }

        // ✅ Met à jour la référence générée côté serveur
        if (resData?.invoice_id) {
            invoiceIdInput.value = resData.invoice_id;
            console.log('Référence de la facture:', resData.invoice_id);
        }

        showMessage(`Facture envoyée avec succès ! Réf: ${invoiceIdInput.value}`, 'success');
        closePreview();
    } catch (err) {
        console.error('Erreur lors de l’envoi de la facture:', err);
        showMessage(`Erreur lors de l’envoi de la facture: ${err.message}`, 'error');
    }
}


// ======================= INITIALISATION =======================
window.onload = async () => {
    try {
        getAdminToken();

        // Date et période par défaut
        const today = new Date();
        document.getElementById('issue-date').value = today.toISOString().split('T')[0];
        document.getElementById('period').value = getPreviousMonthPeriod();

        // 🔹 Attendre que la référence et les clients soient chargés
        await fetchNextInvoiceId();
        await loadClients();

        // Ajouter une ligne par défaut si nécessaire
        if (!itemsContainer.children.length) addItemRow();
        else calculateTotals();

        modalWrapper.classList.add('hidden');
    } catch (err) {
        console.error('Erreur d\'initialisation:', err);
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
