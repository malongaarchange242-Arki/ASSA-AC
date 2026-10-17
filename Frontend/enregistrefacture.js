// ======================= CONSTANTES =======================
const API_BASE = 'https://assa-ac-api.onrender.com'; // Base URL pour tous les appels API
const INVOICE_TOKEN_KEY = document.body.dataset.userRole === 'operateur'
    ? 'jwtTokenOperateur'
    : 'jwtTokenAdmin';
const isOperatorInvoicePage = INVOICE_TOKEN_KEY === 'jwtTokenOperateur';
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
const modalContainer = document.getElementById('modal-container');
const mainContent = document.querySelector('.main-content');

const invoiceIdInput = document.getElementById('invoice-id');
const clientSelect = document.getElementById('client-name');
const issueLocationInput = document.getElementById('issue-location');
const airportInput = document.getElementById('airport');

let rowCounter = 0;
let companiesData = {}; // mapping: company_name -> { id, airport, city }
let previewZoom = 100;
let previewScrollTop = 0;
let previousMainOverflowY = '';
let previewOpener = null;

// ======================= UTILITAIRES =======================
function showMessage(msg, type = 'info') {
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

function resetInvoiceForm() {
    invoiceIdInput.value = '';
    clientSelect.value = '';
    issueLocationInput.value = '';
    airportInput.value = '';

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    document.getElementById('issue-date').value = today;
    document.getElementById('period').value = getPreviousMonthPeriod();

    itemsContainer.replaceChildren();
    rowCounter = 0;
    addItemRow();

    formMessage.textContent = '';
    formMessage.className = 'hidden';
    const previewMessage = document.getElementById('preview-message');
    if (previewMessage) {
        previewMessage.textContent = '';
        delete previewMessage.dataset.messageKey;
        delete previewMessage.dataset.referenceId;
        previewMessage.style.display = 'none';
    }
}

function getInvoiceToken() {
    const token = localStorage.getItem(INVOICE_TOKEN_KEY);
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

function getInvoiceAuthHeaders(token, includeContentType = true) {
    const headers = { Authorization: `Bearer ${token}` };
    if (includeContentType) headers['Content-Type'] = 'application/json';
    if (isOperatorInvoicePage) {
        const operateurId = localStorage.getItem('operateurId');
        if (operateurId) headers['X-Operateur-Id'] = operateurId;
    }
    return headers;
}

function formatNumber(number) {
    if (isNaN(number) || number === null) return '0';
    const locale = localStorage.getItem('lang') === 'en' ? 'en-US' : 'fr-FR';
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(number);
}

function formatCurrency(number) {
    return `${formatNumber(number)} ${t('xaf_currency')}`;
}

function numberToWordsEnglish(number) {
    const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    function underThousand(value) {
        if (value < 20) return small[value];
        if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? `-${small[value % 10]}` : ''}`;
        return `${small[Math.floor(value / 100)]} hundred${value % 100 ? ` ${underThousand(value % 100)}` : ''}`;
    }

    if (number < 1000) return underThousand(number);
    const scales = [[1_000_000_000, 'billion'], [1_000_000, 'million'], [1000, 'thousand']];
    for (const [scale, label] of scales) {
        if (number >= scale) {
            const quotient = Math.floor(number / scale);
            const remainder = number % scale;
            return `${numberToWordsEnglish(quotient)} ${label}${remainder ? ` ${numberToWordsEnglish(remainder)}` : ''}`;
        }
    }
    return underThousand(number);
}

function updateInvoiceTotalWords(total) {
    const words = localStorage.getItem('lang') === 'en'
        ? numberToWordsEnglish(total)
        : numberToWords(total).replace(/-/g, ' ').toUpperCase();
    totalInWords.textContent = t('invoice_amount_words')
        .replace('{words}', words)
        .replace('{amount}', formatNumber(total))
        .replace('{currency}', t('xaf_currency'));
}

function getCanonicalAmountWords(total) {
    return numberToWords(total).replace(/-/g, ' ').toUpperCase();
}

function formatInvoicePeriod(period) {
    if (localStorage.getItem('lang') !== 'en') return period;
    const match = period.match(/^Mois de (.+) (\d{4})$/i);
    if (!match) return period;
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const monthIndex = monthNames.indexOf(match[1].toLocaleLowerCase('fr-FR'));
    if (monthIndex < 0) return period;
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2020, monthIndex, 1));
    return `${t('month_of')} ${monthName} ${match[2]}`;
}

function getCanonicalDesignation(input) {
    return input.dataset.canonicalValue || input.value;
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
        if (totalSpan) totalSpan.textContent = formatCurrency(lineTotal);
    });

    grandTotalSpan.textContent = formatCurrency(grandTotal);
    const totalNum = Math.round(grandTotal);

    updateInvoiceTotalWords(totalNum);
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
            <input type="text" name="designation" class="form-input bg-gray-100 text-xs" value="${t('invoice_fee_designation')}" data-canonical-value="Redevance de Sécurité Aérienne" readonly required>
        </td>
        <td class="px-3 py-2 border-r border-formal-border">
            <input type="number" name="qty" class="form-input text-center text-sm" value="1" min="0" oninput="calculateTotals()" required>
        </td>
        <td class="px-3 py-2 border-r border-formal-border">
            <select name="zone" class="form-select text-sm p-1.5 w-full" onchange="calculateTotals()" required>
                <option value="" selected disabled>${t('choose_zone')}</option>
                <option value="CEMAC">CEMAC</option>
                <option value="HORS CEMAC">HORS CEMAC</option>
            </select>
            <input type="hidden" name="price_value" value="0">
        </td>
        <td class="px-3 py-2 line-total-cell text-end font-bold text-blue-600">
            <span name="line-total-value">0 ${CURRENCY}</span>
        </td>
        <td class="px-1 py-2 text-center">
            <button type="button" onclick="removeItemRow(this)" class="text-red-500 hover:text-red-700 transition duration-150" title="${t('delete')}" aria-label="${t('delete')}">
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
        showMessage(t('invoice_minimum_row'), 'error');
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
    const token = getInvoiceToken();
    clientSelect.innerHTML = `<option value="" disabled selected>${t('select_company')}</option>`;

    if (!token) {
        // Données de simulation si pas de token
        ['Asky', 'Camerco', 'Air France', 'Ethiopian Airlines', 'Autre'].forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            if (name === 'Autre') {
                opt.dataset.i18n = 'other';
                opt.textContent = t('other');
            } else {
                opt.textContent = name;
            }
            clientSelect.appendChild(opt);

            companiesData[name] = { id: Math.floor(Math.random() * 100), airport: name === 'Asky' ? 'Lomé' : '', city: "Pointe-Noire" };
        });
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/companies/all`, {
            headers: getInvoiceAuthHeaders(token, false)
        });

        if (!response.ok) throw new Error(`Erreur ${response.status} lors du chargement des compagnies.`);

        const resData = await response.json();
        const companies = resData.companies || resData;

        companies.filter(c => ['actif', 'active'].includes(String(c.status || '').trim().toLowerCase())).forEach(c => {
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
        showMessage(t('invoice_companies_load_failed'), 'error');
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

function updateInvoiceLanguage() {
    document.title = `${t('invoice_create_title')} - ASSA-AC`;
    clientSelect.querySelector('option[value=""]')?.replaceChildren(document.createTextNode(t('select_company')));
    itemsContainer.querySelectorAll('tr').forEach(row => {
        const designation = row.querySelector('input[name="designation"]');
        if (designation) designation.value = t('invoice_fee_designation');
        const zonePlaceholder = row.querySelector('select[name="zone"] option[value=""]');
        if (zonePlaceholder) zonePlaceholder.textContent = t('choose_zone');
        const deleteButton = row.querySelector('button');
        if (deleteButton) {
            deleteButton.title = t('delete');
            deleteButton.setAttribute('aria-label', t('delete'));
        }
    });
    calculateTotals();

    const previewButton = document.getElementById('preview-button');
    if (previewButton?.getAttribute('aria-busy') === 'true') {
        previewButton.innerHTML = `<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i><span>${t('invoice_preparing_preview')}</span>`;
    }
    const previewMessage = document.getElementById('preview-message');
    if (previewMessage?.dataset.messageKey) {
        previewMessage.textContent = t(previewMessage.dataset.messageKey)
            .replace('{reference}', previewMessage.dataset.referenceId
                ? ` (${t('invoice_reference_label').replace('{reference}', previewMessage.dataset.referenceId)})`
                : '');
    }
    const previewWords = previewContent.querySelector('.invoice-amount-words');
    if (previewWords) previewWords.textContent = totalInWords.textContent;
    const signatureDate = previewContent.querySelector('.invoice-signature-date');
    if (signatureDate) {
        const date = new Date(document.getElementById('issue-date').value);
        const locale = localStorage.getItem('lang') === 'en' ? 'en-US' : 'fr-FR';
        signatureDate.textContent = t('invoice_signature_date')
            .replace('{location}', issueLocationInput.value || 'Pointe-Noire')
            .replace('{date}', date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase());
    }
    const periodValue = previewContent.querySelector('.invoice-period-value');
    if (periodValue) periodValue.textContent = formatInvoicePeriod(document.getElementById('period').value);
    previewContent.querySelectorAll('.invoice-currency-value').forEach(value => {
        value.textContent = formatCurrency(Number(value.dataset.amount));
    });
    const fullscreenButton = document.getElementById('preview-fullscreen-button');
    if (fullscreenButton) {
        fullscreenButton.textContent = modalWrapper.classList.contains('is-fullscreen')
            ? t('invoice_exit_fullscreen')
            : t('invoice_fullscreen');
    }
}

window.addEventListener('app-language-change', updateInvoiceLanguage);

async function fetchNextInvoiceId() {
    let token = getInvoiceToken();
    if (!token) {
        invoiceIdInput.value = "REF-TEST-0001";
        return;
    }

    try {
        // determine airport and period; prefer explicit airport input, otherwise derive from selected client
        const airportVal = (airportInput && airportInput.value) ? airportInput.value : (clientSelect && companiesData[clientSelect.value] ? companiesData[clientSelect.value].airport : '');
        const periodVal = document.getElementById('period')?.value || '';

        if (!airportVal) {
            showMessage(t('invoice_airport_required'), 'error');
            return;
        }
        if (!periodVal) {
            showMessage(t('invoice_period_required'), 'error');
            return;
        }

        const airport = encodeURIComponent(airportVal);
        const period = encodeURIComponent(periodVal);
        const companyId = (clientSelect && companiesData[clientSelect.value]) ? companiesData[clientSelect.value].id : '';
        const url = `${API_BASE}/api/factures/generate-ref?airport=${airport}&period=${period}&id_companie=${encodeURIComponent(companyId)}`;
        const response = await fetch(url, {
            method: "GET",
            headers: getInvoiceAuthHeaders(token)
        });

        if (!response.ok) {
            if (response.status === 401) {
                try {
                    const err = await response.json().catch(() => ({}));
                    console.warn('API 401 response:', err);
                } catch (e) {}

                // Clear local token and prompt re-login to avoid repeated 401s
                localStorage.removeItem(INVOICE_TOKEN_KEY);
                showMessage(t('invoice_session_expired'), 'error');

                // Optional: redirect to login page after short delay if a login page exists
                setTimeout(() => {
                    if (window.location.pathname.indexOf('login') === -1) {
                        // adjust path if your app uses a different login route
                        // window.location.href = '/login.html';
                    }
                }, 1200);

                return;
            }
            throw new Error(`Impossible de générer la référence (Statut: ${response.status})`);
        }

        const data = await response.json();
        invoiceIdInput.value = data.numero_facture;

    } catch (error) {
        console.error(error);
        showMessage(t('invoice_reference_error').replace('{error}', error.message), 'error');
    }
}

// ======================= APERÇU =======================
function validateForm() {
    const requiredInputs = document.querySelectorAll('#invoice-form [required]');
    for (const input of requiredInputs) {
        if (!input.value || (input.tagName === 'SELECT' && input.value === '') || (input.type === 'number' && parseFloat(input.value) < 0)) {
            showMessage(t('invoice_field_required'), 'error');
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
        showMessage(t('invoice_line_required'), 'error');
        return false;
    }
    return true;
}

// Build payload for create/update invoice
function buildInvoicePayload() {
    const items = Array.from(itemsContainer.querySelectorAll('tr')).map((row, idx) => ({
        numero_ligne: idx + 1,
        designation: getCanonicalDesignation(row.querySelector('input[name="designation"]')),
        destination: row.querySelector('select[name="zone"]')?.value || '',
        nombre_passagers: parseFloat(row.querySelector('input[name="qty"]')?.value) || 0,
        cout_unitaire: parseFloat(row.querySelector('input[name="price_value"]')?.value) || 0,
        cout_total: ((parseFloat(row.querySelector('input[name="qty"]')?.value) || 0) * (parseFloat(row.querySelector('input[name="price_value"]')?.value) || 0))
    }));

    const totalNumeric = items.reduce((sum, item) => sum + (Number(item.cout_total) || 0), 0);
    const compagnie = companiesData[clientSelect.value];

    return {
        nom_client: clientSelect.value,
        objet: document.getElementById('purpose')?.value || 'Redevance de Sécurité Aérienne Régionale (RSAR)',
        periode: document.getElementById('period')?.value || '',
        aeroport: document.getElementById('airport')?.value || '',
        date_emission: document.getElementById('issue-date')?.value || new Date().toISOString().split('T')[0],
        lieu_emission: issueLocationInput.value || 'Pointe-Noire',
        montant_total: totalNumeric,
        devise: CURRENCY,
        montant_en_lettres: getCanonicalAmountWords(totalNumeric),
        lignes: items,
        id_companie: compagnie?.id || 1
    };
}

// Create or update invoice on server; returns the invoice reference (numero_facture) or null on failure
async function createInvoiceDraft() {
    if (!validateForm()) return null;

    const payload = buildInvoicePayload();
    const token = getInvoiceToken();

    if (!token) {
        // Simulation mode: return a realistic example reference
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const airportCode = (String(airportInput.value || (companiesData[clientSelect.value]?.airport) || 'NDJ').trim().substring(0, 3)).toUpperCase();
        const sampleRef = `${airportCode}-012/${month}/${year}/ASSA-AC/DAF`;
        invoiceIdInput.value = sampleRef;
        showMessage(t('invoice_simulation_reference'), 'info');
        return sampleRef;
    }

    try {
        if (invoiceIdInput.value) {
            // update existing
            const resp = await fetch(`${API_BASE}/api/factures/${encodeURIComponent(invoiceIdInput.value)}`, {
                method: 'PUT',
                headers: getInvoiceAuthHeaders(token),
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(`Erreur ${resp.status}: ${JSON.stringify(errData)}`);
            }

            const data = await resp.json();
            if (data.numero_facture) invoiceIdInput.value = data.numero_facture;
            return invoiceIdInput.value;
        } else {
            // create new
            const resp = await fetch(`${API_BASE}/api/factures`, {
                method: 'POST',
                headers: getInvoiceAuthHeaders(token),
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(`Erreur ${resp.status}: ${JSON.stringify(errData)}`);
            }

            const data = await resp.json();
            if (data.numero_facture) invoiceIdInput.value = data.numero_facture;
            return data.numero_facture || invoiceIdInput.value;
        }
    } catch (err) {
        console.error('Erreur enregistrement facture :', err);
        showMessage(t('invoice_save_error').replace('{error}', err.message), 'error');
        return null;
    }
}

function setPreviewButtonLoading(isLoading) {
    const previewBtn = document.getElementById('preview-button');
    if (!previewBtn) return;

    if (isLoading) {
        if (!previewBtn.dataset.idleContent) {
            previewBtn.dataset.idleContent = previewBtn.innerHTML;
        }
        previewBtn.disabled = true;
        previewBtn.classList.add('btn-disabled', 'is-loading');
        previewBtn.setAttribute('aria-disabled', 'true');
        previewBtn.setAttribute('aria-busy', 'true');
        previewBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i><span>${t('invoice_preparing_preview')}</span>`;
        return;
    }

    previewBtn.disabled = false;
    previewBtn.classList.remove('btn-disabled', 'is-loading');
    previewBtn.removeAttribute('aria-disabled');
    previewBtn.removeAttribute('aria-busy');
    if (previewBtn.dataset.idleContent) {
        previewBtn.innerHTML = `<span data-i18n="invoice_preview">${t('invoice_preview')}</span> <i class="fas fa-arrow-right" aria-hidden="true"></i>`;
        delete previewBtn.dataset.idleContent;
    }
}

async function showPreview() {
    if (!validateForm()) return;

    setPreviewButtonLoading(true);

    try {
        // Save (create or update) the invoice first, then use the returned reference
        const ref = await createInvoiceDraft();
        if (!ref) {
            showMessage(t('invoice_draft_failed'), 'error');
            return;
        }
        // 1. Génération des lignes du tableau de détails
        const itemsHTML = Array.from(itemsContainer.querySelectorAll('tr')).map((row, idx) => {
            const designation = getCanonicalDesignation(row.querySelector('input[name="designation"]')) === "Redevance de Sécurité Aérienne"
                ? "RSAR"
                : getCanonicalDesignation(row.querySelector('input[name="designation"]'));
            const qty = row.querySelector('input[name="qty"]').value;
            const lineTotal = (parseFloat(qty) || 0) * (parseFloat(row.querySelector('input[name="price_value"]').value) || 0);
            const price = row.querySelector('input[name="price_value"]').value;

            // 5 colonnes pour l'aperçu
            return `<tr class="border-b border-gray-200">
                <td class="text-center">${idx + 1}</td>
                <td class="text-left">${designation}</td>
                <td class="text-center">${formatNumber(qty)}</td>
                <td class="text-right invoice-currency-value" data-amount="${Number(price)}">${formatCurrency(Number(price))}</td>
                <td class="text-right font-bold invoice-currency-value" data-amount="${lineTotal}">${formatCurrency(lineTotal)}</td>
            </tr>`;
        }).join('');

        // 2. Variables
        const clientName = clientSelect.value || t('unspecified');
        const airport = airportInput.value || t('unspecified');
        const issueLocation = issueLocationInput.value || "Pointe-Noire";
        const issueDate = document.getElementById('issue-date').value;
        const period = document.getElementById('period').value;
        const invoiceNumber = invoiceIdInput.value;
        const formattedDate = new Date(issueDate).toLocaleDateString(
            localStorage.getItem('lang') === 'en' ? 'en-US' : 'fr-FR',
            { day: 'numeric', month: 'long', year: 'numeric' }
        );

        // 3. EN-TÊTE (CODE CORRIGÉ : Largeurs ajustées et Logo centré)
        const headerHTML = `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px;">
                <tr>
                    <td style="width: 45%; vertical-align: top; text-align: center; font-size: 8pt; line-height: 1.2;">
                        <div style="font-weight: bold; margin-bottom: 2px;" data-i18n="invoice_cemac_name">COMMUNAUTÉ ÉCONOMIQUE ET MONÉTAIRE DE L’AFRIQUE CENTRALE</div>
                        <div style="border-bottom: 1px dashed #000; width: 60%; margin: 2px auto;"></div>
                        
                        <div style="font-weight: bold; margin: 2px 0;" data-i18n="invoice_cemac_union">UNION ÉCONOMIQUE DE L'AFRIQUE CENTRALE</div>
                        <div style="border-bottom: 1px dashed #000; width: 60%; margin: 2px auto;"></div>

                        <div style="margin: 2px 0;"><span data-i18n="invoice_agency_name">AGENCE DE SUPERVISION DE LA SÉCURITÉ AÉRIENNE EN AFRIQUE CENTRALE</span><br><span style="font-weight: bold;">ASSA-AC</span></div>
                        <div style="border-bottom: 1px dashed #000; width: 60%; margin: 2px auto;"></div>

                        <div style="font-family: 'Brush Script MT', cursive; font-size: 14pt; font-weight: bold; margin-top: 5px;" data-i18n="invoice_general_management">La Direction Générale</div>
                        <div style="border-bottom: 1px dashed #000; width: 40%; margin: 2px auto;"></div>
                    </td>

                    <td style="width: 20%; vertical-align: top; text-align: center; padding-top: 10px;">
                        <img src="${LOGO_URL}" alt="Logo CEMAC ASSA-AC" data-i18n-alt="invoice_logo_alt" style="max-width: 90px; height: auto; margin: 0 auto; display: block;">
                    </td>

                    <td style="width: 35%; vertical-align: top; text-align: center; padding-top: 5px;">
                        <div style="border: 1px solid #000; padding: 5px; font-size: 7pt; font-style: italic; text-align: center; border-radius: 2px; line-height: 1.2;">
                            <span data-i18n="invoice_cemac_vision">Vision CEMAC 2025 : « Faire de la CEMAC en 2025 un espace économique intégré et émergent, où règnent la sécurité, la solidarité et la bonne gouvernance, au service du développement humain ».</span>
                        </div>
                    </td>
                </tr>
            </table>
        `;

        // 4. HTML complet
        const previewHTML = `
            <div class="preview-toolbar print-controls">
                <div class="preview-heading">
                    <h2 id="preview-title" data-i18n="invoice_preview_title">Aperçu de la facture</h2>
                    <p id="preview-description" data-i18n="invoice_preview_description">Vérifiez le document avant de l’envoyer ou de l’imprimer.</p>
                </div>
                <div class="preview-tools" aria-label="Outils d’affichage" data-i18n-aria-label="invoice_preview_tools">
                    <div class="preview-zoom-controls" aria-label="Zoom du document" data-i18n-aria-label="invoice_zoom">
                        <button type="button" onclick="adjustPreviewZoom(-10)" aria-label="Réduire le zoom" data-i18n-aria-label="invoice_zoom_out">−</button>
                        <output id="preview-zoom-level" aria-live="polite">100%</output>
                        <button type="button" onclick="adjustPreviewZoom(10)" aria-label="Augmenter le zoom" data-i18n-aria-label="invoice_zoom_in">+</button>
                    </div>
                    <button type="button" id="preview-fullscreen-button" class="preview-tool-button" onclick="togglePreviewFullscreen()" aria-pressed="false" data-i18n="invoice_fullscreen">Plein écran</button>
                    <button type="button" onclick="closePreview()" class="preview-close-button" aria-label="Fermer l’aperçu" title="Fermer l’aperçu" data-i18n-aria-label="invoice_close_preview" data-i18n-title="invoice_close_preview">×</button>
                </div>
                <div class="preview-actions">
                    <button type="button" onclick="closePreview()" class="preview-action-button preview-back-button" data-i18n="invoice_edit_back">Modifier / Retour</button>
                    <button type="button" onclick="sendInvoice(this)" id="send-invoice-button" class="preview-action-button preview-send-button" data-i18n="invoice_send_save">Envoyer & Enregistrer</button>
                    <button type="button" onclick="printPreview()" class="preview-action-button preview-print-button" data-i18n="print">Imprimer</button>
                </div>
            </div>
            <div class="invoice-viewer" id="invoice-viewer" tabindex="0" aria-label="Zone de lecture de la facture" data-i18n-aria-label="invoice_viewer">
                <div class="invoice-sheet-viewport">
                    <div class="invoice-document">
                ${headerHTML}

                <div id="preview-message" style="display:none; margin-bottom:8px; padding:8px; border-radius:6px; font-weight:600;"></div>

            <div class="invoice-title" style="margin-top: 10px; font-size: 14pt; font-weight: bold; text-align: center;">
                <span data-i18n="invoice_label">FACTURE</span> ${invoiceNumber}
            </div>

            <div class="client-details" style="margin-top: 20px; font-size: 10pt;">
                <table style="border: none;">
                    <tr>
                        <td style="width: 80px; font-weight: bold; border: none; text-align: left;" data-i18n="client">Client</td>
                        <td style="border: none; text-align: left;">: ${clientName}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; border: none; text-align: left;" data-i18n="invoice_for">Pour</td>
                        <td style="border: none; text-align: left;">: <span data-i18n="invoice_purpose">Redevance de Sécurité Aérienne Régionale (RSAR)</span></td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; border: none; text-align: left;" data-i18n="invoice_period">Période</td>
                        <td style="border: none; text-align: left;">: <span class="invoice-period-value">${formatInvoicePeriod(period)}</span></td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; border: none; text-align: left;" data-i18n="airport">Aéroport</td>
                        <td style="border: none; text-align: left;">: ${airport}</td>
                    </tr>
                </table>
            </div>

            <div class="preview-details" style="margin-top: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #e0e0e0;">
                            <th style="border: 1px solid #000; padding: 5px;" data-i18n="number">N°</th>
                            <th style="border: 1px solid #000; padding: 5px; text-align: left;" data-i18n="designation">Désignation</th>
                            <th style="border: 1px solid #000; padding: 5px;" data-i18n="invoice_passengers">Nbre de Passagers</th>
                            <th style="border: 1px solid #000; padding: 5px;" data-i18n="invoice_unit_cost">Coût unitaire</th>
                            <th style="border: 1px solid #000; padding: 5px;" data-i18n="invoice_total_cost">Coût total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                        <tr>
                            <td colspan="4" style="border: 1px solid #000; padding: 5px; text-align: right; font-weight: bold; background-color: #e0e0e0;" data-i18n="total">TOTAL</td>
                            <td class="invoice-currency-value" data-amount="${Array.from(itemsContainer.querySelectorAll('tr')).reduce((sum, row) => sum + (parseFloat(row.querySelector('input[name="qty"]').value) || 0) * (parseFloat(row.querySelector('input[name="price_value"]').value) || 0), 0)}" style="border: 1px solid #000; padding: 5px; text-align: right; font-weight: bold; background-color: #e0e0e0;">${formatCurrency(Array.from(itemsContainer.querySelectorAll('tr')).reduce((sum, row) => sum + (parseFloat(row.querySelector('input[name="qty"]').value) || 0) * (parseFloat(row.querySelector('input[name="price_value"]').value) || 0), 0))}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="invoice-amount-words" style="margin-top: 15px; font-size: 10pt; font-weight: bold;">
                ${totalInWords.textContent}
            </div>

            <div class="signature-block" style="margin-top: 30px; text-align: right; margin-right: 50px; font-size: 10pt;">
                <div style="display: inline-block; text-align: center;">
                    <div class="invoice-signature-date" style="font-weight: bold; margin-bottom: 50px;">${t('invoice_signature_date').replace('{location}', issueLocation).replace('{date}', formattedDate.toUpperCase())}</div>
                    <div style="margin-bottom: 40px; text-decoration: underline;" data-i18n="invoice_general_management">La Direction Générale</div>
                </div>
            </div>

            <div class="payment-conditions" style="margin-top: 40px; font-size: 9pt; border-top: none;">
                <u style="font-weight: bold;" data-i18n="invoice_payment_terms">Conditions de paiement :</u>
                <ul style="list-style-type: disc; padding-left: 20px; margin-top: 5px;">
                    <li data-i18n="invoice_payment_transfer">Par virement bancaire suivant le RIB joint en annexe, à trente jours échus ;</li>
                    <li data-i18n="invoice_payment_penalty">Au-delà de trente jours, une pénalité de 5 % est facturée par tranche de 15 jours de retard ;</li>
                    <li data-i18n="invoice_payment_fortnight">Chaque quinzaine entamée est due.</li>
                </ul>
            </div>

                    </div>
                </div>
            </div>
        `;

        previewContent.innerHTML = previewHTML;
        window.setLanguage(localStorage.getItem('lang') || 'fr');
        document.getElementById('form-area').classList.add('hidden');
        previewZoom = 100;
        updatePreviewZoomLabel();
        openPreview();
        modalWrapper.classList.remove('hidden');
        modalWrapper.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => {
            updateInvoiceSheetScale();
            document.getElementById('preview-fullscreen-button')?.focus({ preventScroll: true });
        });

    } catch (error) {
        showMessage(t('invoice_validation_error').replace('{error}', error.message), 'error');
        console.error(error);
    } finally {
        if (modalWrapper.classList.contains('hidden')) {
            setPreviewButtonLoading(false);
        }
    }
}

function updateInvoiceSheetScale() {
    const sheetViewport = previewContent.querySelector('.invoice-sheet-viewport');
    const invoiceDocument = previewContent.querySelector('.invoice-document');
    if (!sheetViewport || !invoiceDocument || modalWrapper.classList.contains('hidden')) return;

    invoiceDocument.style.transform = 'none';
    const scale = previewZoom / 100;
    const documentWidth = invoiceDocument.offsetWidth;
    const documentHeight = invoiceDocument.scrollHeight;
    invoiceDocument.style.transform = `scale(${scale})`;
    sheetViewport.style.width = `${documentWidth * scale}px`;
    sheetViewport.style.height = `${documentHeight * scale}px`;

    const logo = invoiceDocument.querySelector('img');
    if (logo && !logo.complete && !logo.dataset.scaleListener) {
        logo.dataset.scaleListener = 'true';
        const rescale = () => {
            delete logo.dataset.scaleListener;
            updateInvoiceSheetScale();
        };
        logo.addEventListener('load', rescale, { once: true });
        logo.addEventListener('error', rescale, { once: true });
    }
}

function updatePreviewZoomLabel() {
    const zoomLabel = document.getElementById('preview-zoom-level');
    if (zoomLabel) zoomLabel.value = `${previewZoom}%`;
}

function adjustPreviewZoom(change) {
    previewZoom = Math.min(150, Math.max(50, previewZoom + change));
    updatePreviewZoomLabel();
    requestAnimationFrame(updateInvoiceSheetScale);
}

function togglePreviewFullscreen() {
    const fullscreenButton = document.getElementById('preview-fullscreen-button');
    const isFullscreen = modalWrapper.classList.toggle('is-fullscreen');
    modalContainer.classList.toggle('is-fullscreen', isFullscreen);
    if (fullscreenButton) {
        fullscreenButton.textContent = isFullscreen ? t('invoice_exit_fullscreen') : t('invoice_fullscreen');
        fullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
    }
    requestAnimationFrame(updateInvoiceSheetScale);
}

function openPreview() {
    previewOpener = document.activeElement;
    previewScrollTop = mainContent?.scrollTop || 0;
    if (mainContent) {
        previousMainOverflowY = mainContent.style.overflowY;
        mainContent.style.overflowY = 'hidden';
    }
}

window.addEventListener('resize', () => requestAnimationFrame(updateInvoiceSheetScale));
new ResizeObserver(() => requestAnimationFrame(updateInvoiceSheetScale)).observe(previewContent);
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modalWrapper.classList.contains('hidden')) {
        closePreview();
    }
});

// ======================= IMPRESSION ET GESTION VUE (inchangé) =======================
function printPreview() {
    try {
        const contentToPrint = document.getElementById('preview-content').innerHTML;

        if (!contentToPrint.trim()) {
            return alert(t('invoice_print_empty'));
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
                    @page { size: A4; margin: 0; }
                    html, body { display: block; width: 210mm; min-height: 0; height: auto; overflow: visible; font-family: Arial, sans-serif; font-size: 11pt; color: #000; margin: 0; padding: 0; }
                    .print-controls { display: none !important; }
                    .invoice-viewer { display: block !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
                    .invoice-sheet-viewport { display: block !important; width: 210mm !important; height: auto !important; margin: 0 !important; }
                    .invoice-document {
                        box-sizing: border-box !important;
                        width: 210mm !important;
                        max-height: none !important;
                        overflow: visible !important;
                        border: 0 !important;
                        padding: 15mm !important;
                        min-height: 297mm !important;
                        box-shadow: none !important;
                        transform: none !important;
                        page-break-after: auto;
                    }
                    table { border-collapse: collapse; width: 100%; }
                    img { max-width: 100%; }
                    tr, .payment-conditions, .signature-block { break-inside: avoid; page-break-inside: avoid; }
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
        alert(t('invoice_print_error'));
    }
}

function closePreview() {
    modalWrapper.classList.add('hidden');
    modalWrapper.setAttribute('aria-hidden', 'true');
    modalWrapper.classList.remove('is-fullscreen');
    modalContainer.classList.remove('is-fullscreen');
    document.getElementById('form-area').classList.remove('hidden');
    if (mainContent) {
        mainContent.style.overflowY = previousMainOverflowY;
        mainContent.scrollTop = previewScrollTop;
    }

    setPreviewButtonLoading(false);
    if (previewOpener instanceof HTMLElement) {
        previewOpener.focus({ preventScroll: true });
    }
}


// ======================= ENVOI (inchangé) =======================
// ======================= ENVOI =======================
// La fonction accepte maintenant 'buttonElement' comme argument
async function sendInvoice(buttonElement) {
    if (!validateForm()) return;

    // --- LOGIQUE ANTI-DOUBLE CLIC (Ajout) ---
    if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.textContent = t('invoice_saving');
        buttonElement.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        buttonElement.classList.add('bg-gray-400', 'cursor-not-allowed');
    }
    // ------------------------------------------

    const items = Array.from(itemsContainer.querySelectorAll('tr')).map((row, idx) => ({
        numero_ligne: idx + 1,
        designation: getCanonicalDesignation(row.querySelector('input[name="designation"]')),
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
        montant_en_lettres: getCanonicalAmountWords(totalNumeric),
        lignes: items,
        id_companie: compagnie?.id || 1
    };

    try {
        const token = getInvoiceToken();
        if (!token) {
            console.log("Facture à enregistrer (SIMULATION):", invoiceData);
            // show message inside preview modal if present
            const previewMsg = document.getElementById('preview-message');
            if (previewMsg) {
                previewMsg.dataset.messageKey = 'invoice_simulation_saved_short';
                previewMsg.textContent = t('invoice_simulation_saved_short');
                previewMsg.style.display = 'block';
                previewMsg.style.background = '#ecfdf5';
                previewMsg.style.color = '#065f46';
                previewMsg.style.border = '1px solid #34d399';
                setTimeout(() => { previewMsg.style.display = 'none'; }, 4500);
            } else {
                showMessage(t('invoice_simulation_saved'), 'success');
            }
            setTimeout(() => {
                closePreview();
                resetInvoiceForm();
            }, 700);
            return;
        }

        let response;
        if (invoiceIdInput.value) {
            // If invoice reference exists, update the existing invoice to avoid duplicates
            response = await fetch(`${API_BASE}/api/factures/${encodeURIComponent(invoiceIdInput.value)}`, {
                method: 'PUT',
                headers: getInvoiceAuthHeaders(token),
                body: JSON.stringify(invoiceData)
            });
        } else {
            // Create new invoice
            response = await fetch(`${API_BASE}/api/factures`, {
                method: 'POST',
                headers: getInvoiceAuthHeaders(token),
                body: JSON.stringify(invoiceData)
            });
        }

        // Read the response body once and only show success when the server confirms the save.
        const resData = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(resData.message || `Erreur API ${response.status}`);
        }
        if (resData && resData.numero_facture) {
            invoiceIdInput.value = resData.numero_facture;
        }

        const refShown = invoiceIdInput.value
            ? ` (${t('invoice_reference_label').replace('{reference}', invoiceIdInput.value)})`
            : '';
        // Show message inside preview modal (always show success per request)
        const previewMsg = document.getElementById('preview-message');
        if (previewMsg) {
            previewMsg.dataset.messageKey = 'invoice_saved_success';
            previewMsg.dataset.referenceId = invoiceIdInput.value || '';
            previewMsg.textContent = t('invoice_saved_success').replace('{reference}', refShown);
            previewMsg.style.display = 'block';
            previewMsg.style.background = '#ecfdf5';
            previewMsg.style.color = '#065f46';
            previewMsg.style.border = '1px solid #34d399';
            setTimeout(() => { previewMsg.style.display = 'none'; }, 4500);
        } else {
            showMessage(t('invoice_saved_success').replace('{reference}', refShown), 'success');
        }
        // Close the preview after the confirmation is visible, then prepare a blank invoice.
        setTimeout(() => {
            closePreview();
            resetInvoiceForm();
        }, 800);

    } catch (err) {
        console.error('Erreur lors de l’envoi de la facture:', err);
        const previewMsgErr = document.getElementById('preview-message');
        if (previewMsgErr) {
            previewMsgErr.textContent = t('invoice_send_error').replace('{error}', err.message);
            previewMsgErr.style.display = 'block';
            previewMsgErr.style.background = '#fff1f2';
            previewMsgErr.style.color = '#9f1239';
            previewMsgErr.style.border = '1px solid #fca5a5';
            setTimeout(() => { previewMsgErr.style.display = 'none'; }, 6000);
        } else {
            showMessage(t('invoice_send_error').replace('{error}', err.message), 'error');
        }

    } finally {
        // --- LOGIQUE ANTI-DOUBLE CLIC (Ajout - Réactivation) ---
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.textContent = t('invoice_send_save');
            buttonElement.classList.remove('bg-gray-400', 'cursor-not-allowed');
            buttonElement.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
        // --------------------------------------------------------
    }
}


// ======================= INITIALISATION (inchangé) =======================
function initialiserMenuOperateur() {
    if (!isOperatorInvoicePage) return;

    const sidebar = document.getElementById('sidebar');
    const openButton = document.getElementById('open-sidebar-btn');
    const closeButton = document.getElementById('close-sidebar-btn');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !openButton || !closeButton || !backdrop) return;

    function setSidebarOpen(isOpen) {
        document.body.classList.toggle('sidebar-open', isOpen);
        openButton.setAttribute('aria-expanded', String(isOpen));
    }

    openButton.addEventListener('click', () => setSidebarOpen(true));
    closeButton.addEventListener('click', () => setSidebarOpen(false));
    backdrop.addEventListener('click', () => setSidebarOpen(false));
    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => setSidebarOpen(false));
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') setSidebarOpen(false);
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', event => {
        if (event.matches) setSidebarOpen(false);
    });
}

window.onload = () => {
    try {
        initialiserMenuOperateur();
        updateInvoiceLanguage();
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
        showMessage(t('invoice_validation_error').replace('{error}', err.message), 'error');
    }
};

function getPreviousMonthPeriod() {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - 1);
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    return `Mois de ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}
// Appliquer la préférence au chargement
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

// Bascule et sauvegarde
const toggle = document.getElementById('theme-toggle');
function updateThemeToggleLabel() {
    if (!toggle) return;
    const label = document.body.classList.contains('dark-mode')
        ? t('theme_toggle_light')
        : t('theme_toggle_dark');
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
}

toggle?.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeToggleLabel();
});
window.addEventListener('app-language-change', updateThemeToggleLabel);
updateThemeToggleLabel();