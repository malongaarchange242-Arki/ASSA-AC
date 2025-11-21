// ======================= CONSTANTES ET RÉFÉRENCES DOM =======================
const CURRENCY = 'Frs CFA';
const PRICE_CEMAC = 1000;
const PRICE_HORS_CEMAC = 1500;

const itemsContainer = document.getElementById('items-container');
const grandTotalSpan = document.getElementById('grand-total');
const totalInWords = document.getElementById('total-in-words');
const formMessage = document.getElementById('form-message');

const modalWrapper = document.getElementById('modal-wrapper');
const previewContent = document.getElementById('preview-content');
const formArea = document.getElementById('form-area'); 

const invoiceIdInput = document.getElementById('invoice-id');
const clientSelect = document.getElementById('client-name');

let rowCounter = 0;
let companiesData = { // Données initiales pour les exemples sans API
    "Asky": { id: 1, airport: "LFW", city: "Lomé" },
    "Camerco": { id: 2, airport: "NSI", city: "Yaoundé" },
    "Air France": { id: 3, airport: "CDG", city: "Paris" },
    "Ethiopian Airlines": { id: 4, airport: "ADD", city: "Addis-Abeba" },
};

// ======================= UTILITAIRES =======================
function showMessage(msg, type='info') {
    formMessage.textContent = msg;
    formMessage.className = `text-center p-3 mb-6 rounded-xl font-medium border transition-opacity duration-300 ${type === 'error' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-green-100 text-green-700 border-green-300'}`;
    formMessage.classList.remove('hidden');
    setTimeout(() => formMessage.classList.add('hidden'), 5000);
}

function getAdminToken() {
    try {
        const token = localStorage.getItem('jwtTokenAdmin');
        if (!token) throw new Error("Token admin manquant (Simulation)");
        return token;
    } catch (err) {
        return null;
    }
}

function formatNumber(number) {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(number);
}

function numberToWords(n) {
    // Implémentation SIMPLIFIÉE du montant en lettres
    const units = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf'];
    const s = formatNumber(n);
    if (n === 0) return "Zéro";
    if (n > 1000000000) return s + " (Montant très élevé)"; 
    return s.replace(/\s/g, ' ').trim() + " (Montant en chiffres)"; 
}

function getPriceByZone(zone) {
    if (zone === 'CEMAC') return PRICE_CEMAC;
    if (zone === 'HORS CEMAC') return PRICE_HORS_CEMAC;
    return 0;
}

// ======================= LIGNES ET CALCULS =======================
function calculateTotals() {
    let grandTotal = 0;
    let currentLine = 0;
    itemsContainer.querySelectorAll('tr').forEach(row => {
        currentLine++;
        row.querySelector('td:first-child').textContent = currentLine; 
        
        const qty = parseFloat(row.querySelector('input[name="qty"]')?.value) || 0;
        const zone = row.querySelector('select[name="zone"]')?.value;
        const price = getPriceByZone(zone);
        
        const priceInput = row.querySelector('input[name="price_value"]');
        if (priceInput) priceInput.value = price;

        const lineTotal = qty * price;
        grandTotal += lineTotal;

        const totalSpan = row.querySelector('span[name="line-total-value"]');
        if (totalSpan) totalSpan.textContent = `${formatNumber(lineTotal)} ${CURRENCY}`;
    });

    grandTotalSpan.textContent = `${formatNumber(grandTotal)} ${CURRENCY}`;
    const totalRounded = Math.round(grandTotal); 
    totalInWords.textContent = `Arrêtée la présente facture à la somme de ${numberToWords(totalRounded)} (${formatNumber(totalRounded)}) ${CURRENCY}.`;
}

function addItemRow() {
    const newRow = document.createElement('tr');
    newRow.className = "hover:bg-gray-50 transition duration-100";
    newRow.innerHTML = `
        <td class="px-2 py-2 text-center text-sm font-medium border-r border-formal-border"></td> 
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

// ======================= GESTION CLIENTS ET RÉFÉRENCES =======================
function loadClients() {
    clientSelect.innerHTML = '<option value="" disabled selected>Sélectionner un client</option>';
    for (const name in companiesData) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        clientSelect.appendChild(opt);
    }
}

clientSelect.addEventListener('change', e => {
    const selected = e.target.value;
    if (companiesData[selected]) {
        document.getElementById('airport').value = companiesData[selected].airport;
        document.getElementById('issue-location').value = companiesData[selected].city || "N'Djamena";
    }
});

async function fetchNextInvoiceId() {
    invoiceIdInput.value = 'N°1234/25/11/ASSA-AC/DAF';
}


// ======================= GESTION NAVIGATION ET VUES =======================

/**
 * Fonction liée au nouveau bouton 'Accueil' (Redirection).
 */
function goToHomepage() {
    window.location.href = '/dashboard'; 
}

/**
 * Fonction liée au bouton 'Retour' de la modale.
 */
function showForm() {
    modalWrapper.classList.add('hidden');
    formArea.classList.remove('hidden'); 
}

function validateForm() {
    const requiredInputs = document.querySelectorAll('#invoice-form [required]');
    for (const input of requiredInputs) {
        if (!input.value || input.value === "" || (input.tagName === 'SELECT' && input.value === '')) {
            showMessage(`Veuillez remplir le champ requis : ${document.querySelector(`label[for="${input.id}"]`)?.textContent || input.name}`, 'error');
            input.focus();
            return false;
        }
    }
    return true;
}

/**
 * Fonction liée au bouton 'Aperçu de la Facture'.
 */
function showPreview() {
    if (!validateForm()) {
        return;
    }
    
    // Génération du contenu HTML de l'aperçu
    previewContent.innerHTML = 
        `<div class="invoice-document">
            <p class="direction-line">Direction Générale</p>
            <h2 class="invoice-title">FACTURE DE REDEVANCE N° ${invoiceIdInput.value}</h2>
            <div class="client-details">
                <p><strong>Client:</strong> ${clientSelect.value}</p>
                <p><strong>Objet:</strong> ${document.getElementById('purpose').value}</p>
                <p><strong>Période:</strong> ${document.getElementById('period').value}</p>
            </div>
            
            <div class="preview-details">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">N°</th>
                            <th style="width: 45%;">Désignation</th>
                            <th style="width: 20%;">Quantité</th>
                            <th style="width: 30%;">Montant Total (Frs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from(itemsContainer.querySelectorAll('tr')).map((row, index) => {
                            const designation = row.querySelector('input[name="designation"]')?.value;
                            const qty = row.querySelector('input[name="qty"]')?.value;
                            const total = row.querySelector('span[name="line-total-value"]')?.textContent;
                            return `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td style="text-align: left;">${designation} - Zone ${row.querySelector('select[name="zone"]')?.value}</td>
                                    <td>${qty}</td>
                                    <td style="text-align: right;">${total}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align: right; font-weight: bold;">TOTAL À PAYER</td>
                            <td style="text-align: right; font-weight: bold;">${grandTotalSpan.textContent}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <p class="amount-in-words">${totalInWords.textContent}</p>

            <div class="signature-block">
                <div class="signature-info">
                    <p class="signature-date">Fait à ${document.getElementById('issue-location').value}, le ${new Date().toLocaleDateString('fr-FR')}</p>
                    <p class="signature-title">Le Directeur Général</p>
                </div>
            </div>
            <div class="payment-conditions">
                <p>Conditions de paiement : Net à 30 jours à réception.</p>
            </div>

        </div>`;
    
    formArea.classList.add('hidden');
    modalWrapper.classList.remove('hidden');
}

function sendInvoice() {
    alert("Fonction d'envoi de la facture vers le backend déclenchée.");
}


// ======================= INITIALISATION DU DOCUMENT =======================
window.onload = () => {
    try {
        getAdminToken(); 

        const today = new Date();
        document.getElementById('issue-date').value = today.toISOString().split('T')[0];
        document.getElementById('period').value = getPreviousMonthPeriod();

        fetchNextInvoiceId();
        loadClients();

        if (!itemsContainer.children.length) addItemRow();
        else calculateTotals();

        modalWrapper.classList.add('hidden');
        formArea.classList.remove('hidden');

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