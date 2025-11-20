// ======================= CONSTANTES =======================
const CURRENCY = 'Frs CFA';
const PRICE_CEMAC = 1000;
const PRICE_HORS_CEMAC = 1500;

const itemsContainer = document.getElementById('items-container');
const grandTotalSpan = document.getElementById('grand-total');
const totalInWords = document.getElementById('total-in-words');
const formMessage = document.getElementById('form-message');

const modalWrapper = document.getElementById('modal-wrapper');
const modalContainer = document.getElementById('modal-container'); 
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
    // ... implémente ta fonction existante ici
    return n; // placeholder si non défini
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
        const response = await fetch('http://localhost:5002/api/companies/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Erreur ${response.status}`);

        const resData = await response.json();
        const companies = resData.companies || resData; // support array direct

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
        const response = await fetch('http://localhost:5002/api/factures/generate-ref', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Impossible de générer la référence');

        const data = await response.json();
        invoiceIdInput.value = data.numero_facture;
    } catch (err) {
        console.error(err);
        invoiceIdInput.value = 'N°XXXX/XX/XX/ASSA-AC/DAF';
        showMessage('Impossible de générer la référence. Vérifiez votre connexion.', 'error');
    }
}

// ======================= INITIALISATION =======================
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
