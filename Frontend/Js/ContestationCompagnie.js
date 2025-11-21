// --- DATA SIMULÉE ---
const INVOICES = [
    // Simuler des montants en XAF
    { id: 'FCT-2025-001', date: '2025-10-01', amount: 452050, status: 'Impayée', due_date: '2025-10-31', pdf_url: '#' },
    { id: 'FCT-2025-002', date: '2025-09-15', amount: 1200000, status: 'En Retard', due_date: '2025-10-15', pdf_url: '#' },
    { id: 'FCT-2025-003', date: '2025-09-01', amount: 80000, status: 'Payée', due_date: '2025-09-30', pdf_url: '#' },
    { id: 'FCT-2025-004', date: '2025-08-20', amount: 50990, status: 'Contestée', due_date: '2025-09-20', pdf_url: '#' },
    { id: 'FCT-2025-005', date: '2025-08-05', amount: 250000, status: 'Payée', due_date: '2025-08-31', pdf_url: '#' },
];

// --- GESTION DU THÈME ---

/**
 * Applique le thème spécifié ('light' ou 'dark') et met à jour localStorage.
 * @param {string} mode - 'light' ou 'dark'.
 */
function setTheme(mode) {
    const htmlElement = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');

    if (mode === 'dark') {
        htmlElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        
        // Icône Soleil pour basculer vers le mode jour
        if(themeIcon) themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>`;
        if(themeText) themeText.textContent = 'Mode Jour';
    } else {
        htmlElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        
        // Icône Lune pour basculer vers le mode nuit
        if(themeIcon) themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>`;
        if(themeText) themeText.textContent = 'Mode Nuit';
    }
}

/**
 * Bascule entre le mode clair et le mode sombre.
 */
function toggleTheme() {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}


/**
 * Remplit le menu déroulant de la vue Contestations avec les factures contestables.
 */
function renderContestationsView() {
    const select = document.getElementById('invoice-select-contestation');
    if (!select) return;

    // Filtrer pour n'inclure que les factures pouvant être contestées (non Payée)
    const contestableInvoices = INVOICES.filter(inv => 
        inv.status === 'Impayée' || 
        inv.status === 'En Retard' || 
        inv.status === 'Contestée'
    );
    
    let options = '<option value="">Sélectionnez une facture à contester...</option>';
    
    contestableInvoices.forEach(invoice => {
        // Utiliser le format XAF pour la devise affichée
        const formattedAmount = invoice.amount.toLocaleString('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 });
        options += `
            <option value="${invoice.id}">
                ${invoice.id} (${formattedAmount} - Statut: ${invoice.status})
            </option>
        `;
    });
    
    select.innerHTML = options;
}

/**
 * Ouvre la modal d'état.
 * @param {string} title - Titre de la modal.
 * @param {string} message - Message (supporte le HTML).
 */
function showModal(title, message) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').innerHTML = message;
    const modal = document.getElementById('status-modal');
    modal.classList.remove('invisible', 'opacity-0');
    modal.classList.add('visible', 'opacity-100');
    modal.querySelector('button').focus();
}

/**
 * Ferme la modal d'état.
 */
function closeModal() {
    const modal = document.getElementById('status-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('invisible');
    }, 300);
}

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Rendre les fonctions disponibles globalement (pour les événements 'onclick' dans le HTML)
    window.toggleTheme = toggleTheme;
    window.showModal = showModal;
    window.closeModal = closeModal;

    // 1. Initialiser le Thème
    const storedTheme = localStorage.getItem('theme') || 'light';
    setTheme(storedTheme);
    
    // 2. Rendu des données
    renderContestationsView(); 

    // 3. Gestion du menu mobile
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
    
    // 4. Gestionnaire pour le formulaire de Contestations
    const contestationForm = document.getElementById('contestations-form');
    const fileInputContestation = document.getElementById('file-upload-contestation');
    const fileDisplayContestation = document.getElementById('file-upload-display-contestation');

    if (contestationForm) {
        contestationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const invoiceId = document.getElementById('invoice-select-contestation').value;
            // Suppression de la référence à dispute-category.value
            const explanation = document.getElementById('dispute-explanation').value;
            const fileCount = fileInputContestation.files.length;

            // La validation ne vérifie plus la catégorie
            if (!invoiceId || !explanation) {
                showModal('Erreur de Formulaire', 'Veuillez remplir tous les champs obligatoires (Facture, Explication).');
                return;
            }

            // Simulation de succès
            const message = `
                Simulation: Votre contestation pour la facture **${invoiceId}** a été soumise. <br>
                Pièces jointes: ${fileCount} fichier(s). <br><br>
                ASSA-AC vous recontactera dans les 48h.
            `;
            showModal('Contestation Soumise', message);

            // Réinitialiser le formulaire
            contestationForm.reset();
            fileDisplayContestation.textContent = 'PDF, PNG, JPG (MAX. 5 fichiers)';
            fileDisplayContestation.classList.remove('file-selected');
        });
    }

    // 5. Affichage du nom du fichier (Contestations)
    if (fileInputContestation && fileDisplayContestation) {
        fileInputContestation.addEventListener('change', () => {
            if (fileInputContestation.files.length > 0) {
                const count = fileInputContestation.files.length;
                const firstName = fileInputContestation.files[0].name;
                
                if (count === 1) {
                    fileDisplayContestation.textContent = firstName;
                } else {
                    fileDisplayContestation.textContent = `${count} fichiers sélectionnés (ex: ${firstName})`;
                }
                fileDisplayContestation.classList.add('file-selected');
            } else {
                fileDisplayContestation.textContent = 'PDF, PNG, JPG (MAX. 5 fichiers)';
                fileDisplayContestation.classList.remove('file-selected');
            }
        });
    }
});