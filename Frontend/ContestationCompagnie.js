const API_BASE = (() => {
    const origin = window.location.origin;
    return origin.includes(':5002') ? origin : 'http://localhost:5002';
})();
let SERVER_INVOICES = [];

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

async function fetchWithAuth(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            ...(options.headers || {})
        }
    });

    if (res.status === 401) {
        window.location.href = 'login.html';
        throw new Error('Non authentifié');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Erreur serveur');

    return data;
}

// ====================================================================
//  CHARGER NOM + LOGO DE LA COMPAGNIE CONNECTÉE
// ====================================================================
async function loadCompanyInfo() {
    try {
        const data = await fetchWithAuth(`${API_BASE}/api/companies/me`);

        const company = data.company;

        document.getElementById("company-name").textContent =
            company.company_name || "Compagnie";

        document.getElementById("company-logo").src =
            company.logo_url || "https://placehold.co/40x40";
    } catch (err) {
        console.error(err);
    }
}

/**
 * Remplit le menu déroulant de la vue Contestations avec les factures contestables.
 */
async function renderContestationsView() {
    const select = document.getElementById('invoice-select-contestation');
    if (!select) return;

    let url = `${API_BASE}/api/factures/company`;
    let resp;

    try {
        resp = await fetch(url, {
            credentials: 'include' // 🔥 ENVOI AUTOMATIQUE DU COOKIE
        });
    } catch (e) {
        // 🔁 fallback local
        resp = await fetch(`http://localhost:5002/api/factures/company`, {
            credentials: 'include'
        });
    }

    // ❌ Non authentifié
    if (resp.status === 401) {
        select.innerHTML = '<option value="">Session expirée</option>';
        window.location.href = 'login.html';
        return;
    }

    const data = await resp.json().catch(() => []);
    const invoices = Array.isArray(data) ? data : [];

    // ✅ FILTRE : UNIQUEMENT IMPAYÉES
    const unpaidInvoices = invoices.filter(inv =>
        inv.status &&
        ['impayée', 'impayee'].includes(inv.status.toLowerCase())
    );

    let options = '<option value="">Sélectionnez une facture impayée...</option>';

    if (!unpaidInvoices.length) {
        options += '<option value="">Aucune facture impayée</option>';
    } else {
        unpaidInvoices.forEach(invoice => {
            const formattedAmount = Number(invoice.amount || 0).toLocaleString('fr-CM', {
                style: 'currency',
                currency: 'XAF',
                minimumFractionDigits: 0
            });

            options += `
                <option value="${invoice.id}">
                    ${invoice.numero_facture} (${formattedAmount})
                </option>
            `;
        });
    }

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
    contestationForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const invoiceId = document.getElementById('invoice-select-contestation').value;
        const explanation = document.getElementById('dispute-explanation').value;
        const files = fileInputContestation.files
            ? Array.from(fileInputContestation.files)
            : [];

        if (!invoiceId || !explanation) {
            showModal(
                'Erreur de Formulaire',
                'Veuillez remplir tous les champs obligatoires (Facture, Explication).'
            );
            return;
        }

        try {
            const fd = new FormData();
            fd.append('numero_facture', invoiceId);
            fd.append('explication', explanation);
            files.forEach(f => fd.append('files', f));

            let resp;
            try {
                resp = await fetch(`${API_BASE}/api/contestations/upload_contestation`, {
                    method: 'POST',
                    credentials: 'include', // 🔥 COOKIE ENVOYÉ ICI
                    body: fd
                });
            } catch {
                // 🔁 fallback local
                resp = await fetch(`http://localhost:5002/api/contestations/upload_contestation`, {
                    method: 'POST',
                    credentials: 'include',
                    body: fd
                });
            }

            // ❌ session expirée / non authentifiée
            if (resp.status === 401) {
                showModal(
                    'Session expirée',
                    'Veuillez vous reconnecter.'
                );
                window.location.href = 'login.html';
                return;
            }

            const payload = await resp.json().catch(() => ({}));

            if (!resp.ok) {
                showModal(
                    'Erreur',
                    payload.message || 'Échec de la soumission'
                );
                return;
            }

            showModal(
                'Contestation Soumise',
                `Votre contestation pour la facture <strong>${invoiceId}</strong> a été soumise.`
            );

            contestationForm.reset();
            if (fileDisplayContestation) {
                fileDisplayContestation.textContent =
                    'PDF, PNG, JPG (MAX. 5 fichiers)';
                fileDisplayContestation.classList.remove('file-selected');
            }

        } catch (err) {
            console.error('Erreur soumission contestation:', err);
            showModal(
                'Erreur',
                'Une erreur est survenue lors de la soumission.'
            );
        }
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

    loadCompanyInfo();  // ⬅️ ICI AJOUTÉ
});
