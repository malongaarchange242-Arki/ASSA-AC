// --- DATA SIMULÉE ---
const API_BASE = window.location.origin;
let SERVER_INVOICES = [];

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(escape(atob(base64))));
    } catch {
        return null;
    }
}

async function loadCompanyInvoices() {
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
            console.warn('Token manquant pour charger les factures');
            return;
        }
        const payload = parseJwt(token) || {};
        const profile = payload.profile || 'Company';
        let url = `${API_BASE}/api/factures/company`;
        const companyNameParam = (payload.company_name || window.targetCompanyName || '');
        if (companyNameParam) {
            const sep = url.includes('?') ? '&' : '?';
            url += `${sep}company_name=${encodeURIComponent(companyNameParam)}`;
        }
        const resp = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json().catch(() => []);
        console.log(`🟢 Status fetch: ${resp.status}`, data);
        if (!resp.ok) {
            return;
        }
        SERVER_INVOICES = Array.isArray(data) ? data.map(f => ({
            id: f.numero_facture,
            date: f.date_emission || '',
            amount: Number(f.montant_total || 0),
            status: 'Impayée',
            due_date: '',
            pdf_url: '#'
        })) : [];
    } catch (err) {
        console.error('Erreur loadCompanyInvoices:', err);
    }
}

const INVOICES = [
    { id: 'FCT-2025-001', date: '2025-10-01', amount: 4520.50, status: 'Impayée', due_date: '2025-10-31', pdf_url: '#' },
    { id: 'FCT-2025-002', date: '2025-09-15', amount: 12000.00, status: 'En Retard', due_date: '2025-10-15', pdf_url: '#' },
    { id: 'FCT-2025-003', date: '2025-09-01', amount: 800.00, status: 'Payée', due_date: '2025-09-30', pdf_url: '#' },
    { id: 'FCT-2025-004', date: '2025-08-20', amount: 50.99, status: 'Contestée', due_date: '2025-09-20', pdf_url: '#' },
    { id: 'FCT-2025-005', date: '2025-08-05', amount: 2500.00, status: 'Payée', due_date: '2025-08-31', pdf_url: '#' },
];

// Vues qui restent des simulations
const SIMULATED_VIEWS = ['factures', 'contestations', 'messagerie', 'profil']; 

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


/**
 * Remplit le menu déroulant des factures pour les vues Paiements et Contestations.
 */
function renderInvoiceSelect(viewId, filterFn = (inv) => true) {
    const select = document.getElementById(`invoice-select-${viewId}`);
    if(!select) return;

    const source = (window.SERVER_INVOICES && window.SERVER_INVOICES.length)
      ? window.SERVER_INVOICES
      : INVOICES;

    const targetInvoices = source.filter(filterFn);
    
    let options = `<option value="">Sélectionnez la facture...</option>`;
    
    targetInvoices.forEach(invoice => {
        // Formatage en XAF
        const amount = Number(invoice.amount || 0).toLocaleString('fr-CM', { style: 'currency', currency: 'XAF' });
        const status = invoice.status || '—';
        options += `
            <option value="${invoice.id}">
                ${invoice.id} (${amount} - Statut: ${status})
            </option>
        `;
    });
    
    select.innerHTML = options;
}


// --- FONCTIONS DE NAVIGATION/ACTION SIMULÉES ---

/**
 * Gère la redirection simulée ou l'affichage de vue et surtout l'état ACTIF du menu.
 * @param {string} view - La vue à activer.
 */
function changeView(view) {
    const mainTitle = document.getElementById('main-title');
    const views = {
        'paiements': document.getElementById('paiements-view'),
        'contestations': document.getElementById('contestations-view'),
        'factures': document.getElementById('factures-view'),
    };
    
    let titleMap = {
        'factures': 'Consultation des Factures (Simulation)',
        'paiements': 'Téléverser Preuve de Paiement',
        'contestations': 'Soumettre une Contestation (Simulation)', 
        'messagerie': 'Messagerie (Simulation)',
        'profil': 'Mon Compte (Simulation)',
    };
    
    // 1. Mettre à jour l'état visuel ACTIF de la sidebar
    document.querySelectorAll('.nav-link').forEach(l => {
        // Retirer les classes actives et restaurer les classes par défaut/hover
        l.classList.remove('bg-indigo-100', 'dark:bg-indigo-900/50', 'font-semibold', 'text-primary');
        l.classList.add('font-medium', 'hover:bg-gray-100', 'dark:hover:bg-gray-700'); 
        
        if (l.getAttribute('data-view') === view) {
            // Appliquer les classes actives
            l.classList.add('bg-indigo-100', 'dark:bg-indigo-900/50', 'font-semibold', 'text-primary'); 
            // Retirer les classes neutres/hover pour s'assurer que l'état actif persiste
            l.classList.remove('font-medium', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
        }
    });

    // 2. Gérer l'affichage des vues (masquer toutes les vues)
    Object.values(views).forEach(v => { if(v) v.classList.add('hidden'); });
    
    if (SIMULATED_VIEWS.includes(view)) {
        mainTitle.textContent = titleMap[view] || 'ASSA-AC Portail Client';
        simulateRedirect(view);
    } else if(views[view]) {
        // Afficher la vue demandée
        views[view].classList.remove('hidden');
        mainTitle.textContent = titleMap[view];
        
        // Préparer les données spécifiques à la vue
        if (view === 'paiements') {
            renderInvoiceSelect('paiement', inv => inv.status === 'Impayée' || inv.status === 'En Retard');
        } 
    }
    
    // 3. Masquer la sidebar sur mobile après la navigation
    const sidebar = document.getElementById('sidebar');
    if(sidebar) sidebar.classList.add('-translate-x-full');
}

// Fonction principale de simulation de redirection
function simulateRedirect(view) {
     let message = '';
     let title = 'Accès Simulé';

     switch(view) {
         case 'factures':
             message = `Simulation: Redirection vers le module de **Consultation des Factures**.<br>Cette fonctionnalité est en cours de développement.`;
             break;
         case 'contestations':
             message = `Simulation: Redirection vers l'outil de **Messagerie** pour contacter ASSA-AC au sujet d'une contestation.`;
             break;
         case 'messagerie':
             message = `Simulation: Redirection vers l'outil de **Messagerie** pour contacter ASSA-AC.`;
             break;
         case 'profil':
             message = `Simulation: Chargement de la vue **Mon Compte** (Espace Personnel).`;
             break;
         default:
             message = `Simulation: Tentative d'accès à la vue **${view}**.`;
     }
     showModal(title, message);
}

// --- GESTION DES MODALES (pour remplacer les alertes) ---

function showModal(title, message) {
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    
    if(modalTitle) modalTitle.textContent = title;
    if(modalMessage) modalMessage.innerHTML = message;
    
    const modal = document.getElementById('status-modal');
    if(modal) {
        modal.classList.remove('invisible', 'opacity-0');
        modal.classList.add('visible', 'opacity-100');
        const btn = modal.querySelector('button');
        if(btn) btn.focus();
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

// --- INITIALISATION ET GESTION MOBILE ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Initialiser le Thème
    const storedTheme = localStorage.getItem('theme') || 'light';
    setTheme(storedTheme);
    
    // 2. Gestionnaires de la navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const view = e.currentTarget.getAttribute('data-view');
            const href = e.currentTarget.getAttribute('href');
            
            // Si l'utilisateur clique sur le lien de la page courante (paiements)
            if (view === 'paiements') {
                e.preventDefault(); 
                // Mettre à jour l'état actif (ce qui corrige le clignotement)
                changeView('paiements'); 
            } else {
                // Redirection réelle vers la page (pour les autres liens)
                window.location.href = href;
            }
        });
    });
    
    // 3. Gestion du menu mobile
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');

    if(openBtn) {
        openBtn.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
        });
    }

    if(closeBtn) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
        });
    }

    // 4. Gestionnaire pour le formulaire de PAIEMENTS
    const paiementForm = document.getElementById('paiements-form');
    const fileInputPaiement = document.getElementById('file-upload-paiement');
    const fileDisplayPaiement = document.getElementById('file-upload-display-paiement');
    
    if(paiementForm) {
        paiementForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const invoiceId = document.getElementById('invoice-select-paiement').value;
            const note = document.getElementById('paiement-note').value || '';
            const file = fileInputPaiement.files[0];

            if (!invoiceId || !file) {
                if (typeof showModal === 'function') {
                    showModal('Erreur de Formulaire', 'Veuillez sélectionner la facture et joindre la preuve de paiement.');
                } else {
                    alert('Veuillez sélectionner la facture et joindre la preuve de paiement.');
                }
                return;
            }

            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (!token) {
                if (typeof showModal === 'function') {
                    showModal('Authentification requise', 'Veuillez vous reconnecter pour envoyer la preuve.');
                } else {
                    alert('Veuillez vous reconnecter pour envoyer la preuve.');
                }
                return;
            }

            const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result || '';
                    const base64 = String(result).includes(',') ? String(result).split(',')[1] : String(result);
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            try {
                const file_data = await readFileAsBase64(file);
                const payload = {
                    numero_facture: invoiceId,
                    note,
                    file_name: file.name,
                    file_type: file.type,
                    file_data
                };

                const resp = await fetch(`${API_BASE}/api/factures/proofs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await resp.json().catch(() => ({}));
                console.log('Upload proof response:', resp.status, data);

                if (!resp.ok) {
                    if (typeof showModal === 'function') {
                        showModal('Erreur', data.message || "Échec de l’envoi de la preuve");
                    } else {
                        alert(data.message || "Échec de l’envoi de la preuve");
                    }
                    return;
                }

                // Reset formulaire
                paiementForm.reset();
                fileDisplayPaiement.textContent = 'PDF, PNG, JPG (MAX. 1 fichier)';
                fileDisplayPaiement.classList.remove('file-selected');

                // Simulation: Rediriger vers la messagerie compagnie avec la facture concernée
                window.location.href = `/messa_comp.html?invoice=${encodeURIComponent(invoiceId)}`;
            } catch (err) {
                console.error('Erreur upload preuve:', err);
                if (typeof showModal === 'function') {
                    showModal('Erreur', 'Une erreur est survenue lors de l’envoi de la preuve.');
                } else {
                    alert('Une erreur est survenue lors de l’envoi de la preuve.');
                }
            }
        });
    }

    // Affichage du nom du fichier (Paiements)
    if(fileInputPaiement) {
        fileInputPaiement.addEventListener('change', () => {
            if (fileInputPaiement.files.length > 0) {
                fileDisplayPaiement.textContent = fileInputPaiement.files[0].name;
                fileDisplayPaiement.classList.add('file-selected');
            } else {
                fileDisplayPaiement.textContent = 'PDF, PNG, JPG (MAX. 1 fichier)';
                fileDisplayPaiement.classList.remove('file-selected');
            }
        });
    }
    
    // 5. Démarrer IMMÉDIATEMENT sur la vue 'paiements' et définir l'état actif
    changeView('paiements');

    // Ensuite, charger les factures en arrière-plan
    loadCompanyInvoices().then(() => {
        // Une fois chargé, on rafraîchit le menu déroulant
        const select = document.getElementById('invoice-select-paiement');
        if (select) {
            renderInvoiceSelect('paiement', inv => inv.status === 'Impayée' || inv.status === 'En Retard');
        }
    });
});