// --- DONNÉES FACTURES ---
const INVOICES = [
    { id: 'FCT-2025-001', date: '2025-10-01', amount: 4520.50, status: 'Impayée', due_date: '2025-10-31', pdf_url: '#' },
    { id: 'FCT-2025-002', date: '2025-09-15', amount: 12000.00, status: 'En Retard', due_date: '2025-10-15', pdf_url: '#' },
    { id: 'FCT-2025-003', date: '2025-09-01', amount: 800.00, status: 'Payée', due_date: '2025-09-30', pdf_url: '#' },
    { id: 'FCT-2025-004', date: '2025-08-20', amount: 50.99, status: 'Contestée', due_date: '2025-09-20', pdf_url: '#' },
    { id: 'FCT-2025-005', date: '2025-08-05', amount: 2500.00, status: 'Payée', due_date: '2025-08-31', pdf_url: '#' },
];

// --- GESTION DU THÈME ---
function setTheme(mode) {
    const htmlElement = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    if (mode === 'dark') {
        htmlElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if(themeIcon) themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>`;
        if(themeText) themeText.textContent = 'Mode Jour';
    } else {
        htmlElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        if(themeIcon) themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>`;
        if(themeText) themeText.textContent = 'Mode Nuit';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// --- GESTION DES MODALES ---
function showModal(title, message) {
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modal = document.getElementById('status-modal');
    
    if(modalTitle) modalTitle.textContent = title;
    if(modalMessage) modalMessage.innerHTML = message;
    
    if(modal) {
        modal.classList.remove('invisible', 'opacity-0');
        modal.classList.add('visible', 'opacity-100');
    }
}

function closeModal() {
    const modal = document.getElementById('status-modal');
    if(modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('invisible');
        }, 300);
    }
}

// --- RENDU TABLEAU FACTURES ---
function renderInvoices() {
    const tableBody = document.getElementById('invoices-table-body');
    if (!tableBody) return; // Sécurité si on n'est pas sur la page factures

    let invoiceRows = '';
    let totalUnpaid = 0, overdueCount = 0, disputeCount = 0;

    INVOICES.forEach(invoice => {
        let statusClass = '';
        let actionButtons = '';

        // Calcul des KPIs
        if (invoice.status === 'Impayée' || invoice.status === 'En Retard') totalUnpaid += invoice.amount;
        if (invoice.status === 'En Retard') overdueCount++;
        if (invoice.status === 'Contestée') disputeCount++;

        // Logique d'affichage par statut
        switch(invoice.status){
            case 'Payée':
                statusClass = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
                actionButtons = `<a href="${invoice.pdf_url}" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">PDF</a>`;
                break;
            case 'En Retard':
                statusClass = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
                actionButtons = `
                    <a href="${invoice.pdf_url}" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 mr-3">PDF</a>
                    <a href="facturcompa.html" class="text-green-600 hover:text-green-900 dark:text-green-400 font-semibold">Payer</a>
                `;
                break;
            case 'Impayée':
                statusClass = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
                actionButtons = `
                    <a href="${invoice.pdf_url}" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 mr-3">PDF</a>
                    <a href="facturcompa.html" class="text-green-600 hover:text-green-900 dark:text-green-400 font-semibold">Payer</a>
                `;
                break;
            case 'Contestée':
                statusClass = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
                actionButtons = `
                    <a href="${invoice.pdf_url}" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 mr-3">PDF</a>
                    <a href="soumettrecontestation.html" class="text-orange-600 hover:text-orange-900 dark:text-orange-400">Voir</a>
                `;
                break;
        }

        invoiceRows += `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${invoice.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${invoice.date}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-semibold">${invoice.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${invoice.due_date}</td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="${statusClass}">${invoice.status}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">${actionButtons}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = invoiceRows;

    // Mise à jour des KPIs dans le DOM
    const kpiUnpaid = document.getElementById('kpi-total-unpaid');
    const kpiOverdue = document.getElementById('kpi-overdue-count');
    const kpiDispute = document.getElementById('kpi-dispute-count');

    if(kpiUnpaid) kpiUnpaid.textContent = totalUnpaid.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    if(kpiOverdue) kpiOverdue.textContent = overdueCount;
    if(kpiDispute) kpiDispute.textContent = disputeCount;
}

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Initialiser le Thème
    const storedTheme = localStorage.getItem('theme') || 'light';
    setTheme(storedTheme);

    // 2. Initialiser la Sidebar Mobile
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');

    if (openBtn && sidebar) {
        openBtn.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
        });
    }

    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
        });
    }

    // 3. Rendu des factures (si on est sur la page factures)
    renderInvoices();
    
    // 4. Exposer les fonctions globales
    window.toggleTheme = toggleTheme;
    window.showModal = showModal;
    window.closeModal = closeModal;
});