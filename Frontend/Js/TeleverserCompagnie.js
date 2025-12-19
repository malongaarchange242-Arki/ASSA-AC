// ------------------- CONFIG -------------------
const API_BASE = (() => {
    const origin = window.location.origin;
    return origin.includes(':5002') ? origin : 'http://localhost:5002';
})();
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
        const token = localStorage.getItem('jwtTokenCompany');
        const id_companie = localStorage.getItem('id_companie'); // récupéré au login
        if (!token || !id_companie) {
            console.warn("Token ou id_companie manquant pour charger les factures");
            return;
        }

        let base = API_BASE;
        let url = `${base}/api/factures/company`;
        let resp;
        try {
            resp = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        } catch (e) {
            base = 'https://assa-ac-jyn4.onrender.com';
            url = `${base}/api/factures/company`;
            resp = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
        }

        if (!resp.ok) {
            console.error("Erreur serveur :", resp.status);
            return;
        }

        const data = await resp.json().catch(() => []);
        if (!Array.isArray(data)) {
            console.warn("Réponse API inattendue :", data);
            return;
        }

        // Mapping factures pour l'UI
        SERVER_INVOICES = data.map(f => ({
            id: f.id,
            date: f.date,
            amount: Number(f.amount),
            status: f.status,
            due_date: f.due_date,
            client: f.client
        }));

        console.log("Factures filtrées pour cette compagnie :", SERVER_INVOICES);

        // Rendu du select (uniquement impayées)
        renderInvoiceSelect('paiement', inv => inv.status === 'Impayée');

    } catch (err) {
        console.error("Erreur loadCompanyInvoices:", err);
    }
}


// ------------------- RENDER FACTURES -------------------
function renderInvoiceSelect(viewId, filterFn = inv => true) {
    const select = document.getElementById(`invoice-select-${viewId}`);
    if (!select) return;

    const targetInvoices = SERVER_INVOICES.filter(filterFn);

    let options = `<option value="">Sélectionnez la facture...</option>`;
    targetInvoices.forEach(inv => {
        const amount = Number(inv.amount).toLocaleString('fr-CM', { style: 'currency', currency: 'XAF' });
        options += `<option value="${inv.id}">${inv.id} (${amount} - Statut: ${inv.status})</option>`;
    });

    select.innerHTML = options;
}

// ------------------- THÈME -------------------
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

// ------------------- MODALES -------------------
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

// ------------------- NAVIGATION -------------------
function changeView(view) {
    const mainTitle = document.getElementById('main-title');
    const views = {
        'paiements': document.getElementById('paiements-view'),
        'contestations': document.getElementById('contestations-view'),
        'factures': document.getElementById('factures-view'),
    };

    let titleMap = {
        'factures': 'Consultation des Factures',
        'paiements': 'Téléverser Preuve de Paiement',
        'contestations': 'Soumettre une Contestation',
        'messagerie': 'Messagerie',
        'profil': 'Mon Compte',
    };

    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('bg-indigo-100', 'dark:bg-indigo-900/50', 'font-semibold', 'text-primary');
        l.classList.add('font-medium', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
        if (l.getAttribute('data-view') === view) {
            l.classList.add('bg-indigo-100', 'dark:bg-indigo-900/50', 'font-semibold', 'text-primary');
            l.classList.remove('font-medium', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
        }
    });

    Object.values(views).forEach(v => { if(v) v.classList.add('hidden'); });
    if(views[view]) views[view].classList.remove('hidden');
    if(mainTitle) mainTitle.textContent = titleMap[view] || 'Portail Client';

    if (view === 'paiements') {
        renderInvoiceSelect('paiement', inv => inv.status === 'Impayée');
    }

    const sidebar = document.getElementById('sidebar');
    if(sidebar) sidebar.classList.add('-translate-x-full');
}

// ------------------- DOMContentLoaded -------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. Thème
    setTheme(localStorage.getItem('theme') || 'light');

    // 2. Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            const view = e.currentTarget.getAttribute('data-view');
            const href = e.currentTarget.getAttribute('href');
            if (view === 'paiements') {
                e.preventDefault();
                changeView('paiements');
            } else {
                window.location.href = href;
            }
        });
    });

    // 3. Menu mobile
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');
    if(openBtn) openBtn.addEventListener('click', () => sidebar.classList.remove('-translate-x-full'));
    if(closeBtn) closeBtn.addEventListener('click', () => sidebar.classList.add('-translate-x-full'));

    // 4. Formulaire paiements
    const paiementForm = document.getElementById('paiements-form');
    const fileInputPaiement = document.getElementById('file-upload-paiement');
    const fileDisplayPaiement = document.getElementById('file-upload-display-paiement');

    if(paiementForm) {
        paiementForm.addEventListener('submit', async e => {
            e.preventDefault();
            const invoiceId = document.getElementById('invoice-select-paiement').value;
            const note = document.getElementById('paiement-note').value || '';
            const file = fileInputPaiement.files[0];

            if (!invoiceId || !file) {
                showModal('Erreur de Formulaire', 'Veuillez sélectionner la facture et joindre la preuve de paiement.');
                return;
            }

            const token = localStorage.getItem('jwtTokenCompany');
            if (!token) {
                showModal('Authentification requise', 'Veuillez vous reconnecter pour envoyer la preuve.');
                return;
            }

            try {
                const formData = new FormData();
                formData.append('numero_facture', invoiceId);
                formData.append('commentaire', note);
                formData.append('file', file);
                const jwt = localStorage.getItem('jwtTokenCompany');
                const payload = parseJwt(jwt) || {};
                const cid = localStorage.getItem('id_companie') || payload.id_companie || payload.company_id;
                if (cid) formData.append('id_companie', cid);

                const resp = await fetch(`${API_BASE}/api/preuves/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const data = await resp.json().catch(() => ({}));
                if(!resp.ok) {
                    showModal('Erreur', data.message || "Échec de l’envoi de la preuve");
                    return;
                }

                const updatedFromUpload = data && data.facture && data.facture.statut === 'Payée';
                if (updatedFromUpload) {
                    SERVER_INVOICES = SERVER_INVOICES.map(inv => inv.id === invoiceId ? { ...inv, status: 'Payée' } : inv);
                    renderInvoiceSelect('paiement', inv => inv.status === 'Impayée');
                } else {
                    try {
                        const statutResp = await fetch(`${API_BASE}/api/factures/statut`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ numero_facture: invoiceId, statut: 'Payée' })
                        });
                        const statutData = await statutResp.json().catch(() => ({}));
                        if (statutResp.ok) {
                            SERVER_INVOICES = SERVER_INVOICES.map(inv => inv.id === invoiceId ? { ...inv, status: 'Payée' } : inv);
                            renderInvoiceSelect('paiement', inv => inv.status === 'Impayée');
                        } else {
                            console.warn('Échec mise à jour statut:', statutData && statutData.message ? statutData.message : statutResp.status);
                        }
                    } catch (e) {
                        console.warn('Erreur mise à jour statut facture:', e);
                    }
                }

                const proofId = data?.preuve?.id;
                const fileName = data?.preuve?.fichier_nom || file.name;
                try {
                    const meta = {
                        id: proofId || null,
                        url: data?.preuve?.fichier_url || null,
                        name: data?.preuve?.fichier_nom || file.name,
                        invoiceId
                    };
                    localStorage.setItem('lastProofAttachment', JSON.stringify(meta));
                } catch {}
                showModal('Succès', `Preuve "${fileName}" enregistrée pour la facture ${invoiceId}. Ouverture de la messagerie...`);

                paiementForm.reset();
                if(fileDisplayPaiement) {
                    fileDisplayPaiement.textContent = 'PDF, PNG, JPG (MAX. 1 fichier)';
                    fileDisplayPaiement.classList.remove('file-selected');
                }

                setTimeout(() => {
                    const url = `messagerieCompagnie.html?invoice=${encodeURIComponent(invoiceId)}${proofId ? `&proofId=${encodeURIComponent(proofId)}` : ''}`;
                    window.location.href = url;
                }, 800);
            } catch (err) {
                console.error('Erreur upload preuve:', err);
                showModal('Erreur', 'Une erreur est survenue lors de l’envoi de la preuve.');
            }
        });
    }

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

    // 5. Vue initiale
    changeView('paiements');

    // 6. Charger les factures
    loadCompanyInvoices();
});
