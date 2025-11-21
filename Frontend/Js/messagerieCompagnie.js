// ========================
// CONFIGURATION & CONSTANTES
// ========================
const DEFAULT_VIEW = 'messagerie';
const ROUTE_MAP = {
    factures: 'indexacompa.html',
    paiements: 'facturcompa.html',
    contestations: 'soumettrecontestation.html',
    messagerie: 'messa_comp.html',
    profil: 'profilcomp.html'
};

const API_BASE = (() => {
    const origin = window.location.origin;
    return origin.includes(':5002') ? origin : 'http://localhost:5002';
})();
const WS_URL = (API_BASE.startsWith('https') ? 'wss://' : 'ws://') + API_BASE.replace(/^https?:\/\//,'').replace(/\/$/,'') + '/ws';
const authToken = localStorage.getItem('token') || null;

// Variables pour l'identité (inchangé)
function parseJwt(t){ try{ return JSON.parse(atob(String(t).split('.')[1]||'')); }catch{ return {}; } }
const payload = parseJwt(authToken);
const role = payload?.profile || (payload?.company_name ? 'Company' : null);

function getStored(keys){
    for (const k of keys){
        const v = localStorage.getItem(k);
        if (v) return v;
    }
    return null;
}

let companyId = getStored(['company_id','companyId','COMPANY_ID']);
let adminId = getStored(['admin_id','adminId','ADMIN_ID']);

if (role === 'Company') {
    companyId = payload?.company_id || payload?.companyId || payload?.id || companyId;
    if (companyId) localStorage.setItem('company_id', companyId);
} else if (role === 'Administrateur' || role === 'Superviseur') {
    adminId = payload?.admin_id || payload?.id || payload?.userId || adminId;
    if (adminId) localStorage.setItem('admin_id', adminId);
}

let ws = null;
let historyLoaded = false;
let sendingMessage = false;


// ========================
// THEME (inchangé)
// ========================
function setTheme(mode) {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');

    if (mode === 'dark') {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        
        // Icône Soleil pour mode Jour
        if(icon) icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>`;
        if(text) text.textContent = 'Mode Jour';
    } else {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        
        // Icône Lune pour mode Nuit
        if(icon) icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>`;
        if(text) text.textContent = 'Mode Nuit';
    }
}

function toggleTheme() {
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
}

// ========================
// NAVIGATION & VUES (inchangé, sauf pour la messagerie)
// ========================
function changeView(viewKey) {
    if (ROUTE_MAP[viewKey] && viewKey !== 'messagerie') {
        // Redirection vers une autre page HTML (simulation)
        // Ajout d'une modale pour simuler la navigation réussie
        const titleMap = { factures: "Factures", paiements: "Preuves de Paiement", contestations: "Contestations", profil: "Mon Compte" };
        showModal('Redirection', `Simulation de navigation vers la page **${titleMap[viewKey]}**. Cette page ne nécessite pas de conversation en liste.`);
        return;
    }

    // Masquer toutes les vues, afficher la vue sélectionnée
    document.querySelectorAll('#content-area > div').forEach(div => div.classList.add('hidden'));

    let newTitle = "Messagerie"; // Titre par défaut pour la vue unique
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkView = link.getAttribute('data-view');
        if (linkView === viewKey) {
            link.classList.add('active');
            newTitle = link.textContent.trim();
        } else {
            link.classList.remove('active');
        }
    });

    const viewEl = document.getElementById(`${viewKey}-view`);
    if (viewEl) viewEl.classList.remove('hidden');
    else document.getElementById('home-view').classList.remove('hidden');

    document.getElementById('main-title').textContent = newTitle;

    if (viewKey === 'messagerie') {
        ensureIds();
        if (!historyLoaded) loadHistory().catch(() => {});
        if (!ws) connectWebSocket();
        setTimeout(scrollChatToBottom, 100);
    }

    // Masquer la sidebar sur mobile après la navigation
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth < 1024 && sidebar) sidebar.classList.add('-translate-x-full');
}

// ========================
// MESSAGERIE (Simplifiée)
// ========================
function ensureIds(){
    const bar = document.getElementById('id-setup');
    if (bar) bar.classList.add('hidden');
}

function scrollChatToBottom(){
    const chatWindow = document.getElementById('chat-messages');
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderMessage(message, attachments){
    const chatWindow = document.getElementById('chat-messages');
    if (!chatWindow) return;

    if (chatWindow.querySelector(`[data-id="${message.id}"]`)) return;

    const safe = s => String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isCompany = message.sender_role === 'company';

    const wrapper = document.createElement('div');
    wrapper.className = isCompany ? 'flex justify-end' : 'flex';
    wrapper.setAttribute('data-id', message.id);

    const bubble = document.createElement('div');
    bubble.className = isCompany
        ? 'p-3 rounded-xl rounded-br-none bg-primary text-white max-w-xs shadow'
        : 'p-3 rounded-xl rounded-bl-none bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 max-w-xs shadow';

    bubble.innerHTML = `<p class="text-sm">${safe(message.content)}</p>`;

    if (attachments && attachments.length){
        const list = document.createElement('div');
        list.className = 'mt-2 space-y-1';
        attachments.forEach(att => {
            const a = document.createElement('a');
            a.href = att.file_url || '#';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = isCompany ? 'block text-xs underline text-white' : 'block text-xs underline';
            a.textContent = att.file_name || 'Pièce jointe';
            list.appendChild(a);
        });
        bubble.appendChild(list);
    }

    wrapper.appendChild(bubble);
    chatWindow.appendChild(wrapper);
    scrollChatToBottom();
}

/**
 * Charge l'historique pour la conversation unique (Support ASSA-AC).
 */
async function loadHistory(){
    if (!companyId) { historyLoaded = true; return; }
    
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';
    
    // ⚠️ Remplacez ceci par un appel à votre véritable API d'historique ⚠️
    const history = generateSimulatedHistory();

    const separator = document.createElement('div');
    separator.className = 'text-center text-xs text-gray-400 pt-4 pb-4';
    separator.textContent = `--- Début de la discussion avec ASSA-AC ---`;
    container.appendChild(separator);

    history.forEach(item => renderMessage(item.message, item.attachments));

    historyLoaded = true;
    scrollChatToBottom();
}

/**
 * SIMULATION: Générer des messages statiques pour le support unique.
 */
function generateSimulatedHistory() {
    return [
        { message: { id: 1, content: 'Bonjour Air France. Comment pouvons-nous vous aider aujourd\'hui concernant vos factures ou contestations ?', sender_role: 'admin' }, attachments: [] },
        { message: { id: 2, content: 'Bonjour, j\'ai une question sur ma dernière facture. Le montant ne correspond pas.', sender_role: 'company' }, attachments: [] },
        { message: { id: 3, content: 'Nous allons examiner cela. Veuillez nous donner un moment pour consulter votre dossier.', sender_role: 'admin' }, attachments: [] },
    ];
}

async function sendMessage(text, files){
    if (sendingMessage || !companyId) return;
    sendingMessage = true;
    
    // Le message est envoyé au support général
    const fd = new FormData();
    if (adminId) fd.append('admin_id', adminId);
    fd.append('company_id', companyId);
    fd.append('sender_role', 'company');
    if (text) fd.append('content', text);
    if (files && files.length) files.forEach(f => fd.append('attachments', f));

    // SIMULATION D'ENVOI
    try {
        const payload = {
            message: {
                id: Date.now(),
                content: text,
                sender_role: 'company',
                timestamp: new Date().toISOString()
            },
            attachments: files.map(f => ({ file_name: f.name, file_url: '#' }))
        };

        renderMessage(payload.message, payload.attachments);
        
        // Simuler la réponse de l'administrateur
        setTimeout(() => {
            const adminResponse = {
                message: {
                    id: Date.now() + 1,
                    content: "Votre message a été bien transmis au support technique ASSA-AC.",
                    sender_role: 'admin',
                    timestamp: new Date().toISOString()
                },
                attachments: []
            };
            renderMessage(adminResponse.message, adminResponse.attachments);
        }, 1500); 
        
    } finally {
        sendingMessage = false;
    }
}

function connectWebSocket(){
    if (!companyId) return;
    if (ws) { ws.close(); ws = null; }

    try { ws = new WebSocket(WS_URL); } catch (e) { ws = null; return; }

    ws.onopen = () => {
        try {
            // Join sur le "canal" de la compagnie
            const payload = { type: 'join', company_id: companyId };
            if (adminId) payload.admin_id = adminId;
            ws.send(JSON.stringify(payload));
        } catch {}
    };

    ws.onmessage = ev => {
        let data = null;
        try { data = JSON.parse(ev.data); } catch { return; }
        if (data && data.type === 'message') {
            renderMessage(data.message, data.attachments);
        }
    };

    ws.onclose = () => { ws = null; setTimeout(() => connectWebSocket(), 1500); };
    ws.onerror = () => { try { ws.close(); } catch {} };
}

// ========================
// GESTION DES FICHIERS (inchangé)
// ========================
function updateFilePreview() {
    const filesInput = document.getElementById('attachmentInput');
    const previewArea = document.getElementById('file-preview-area');
    const previewList = document.getElementById('file-preview-list');
    
    const files = filesInput?.files ? Array.from(filesInput.files) : [];
    
    if (files.length === 0) {
        previewArea.classList.add('hidden');
        previewList.innerHTML = '';
        return;
    }

    previewArea.classList.remove('hidden');
    
    previewList.innerHTML = files.map((file, index) => `
        <span class="file-tag">
            ${file.name} 
            <button type="button" data-index="${index}" onclick="removeFileFromPreview(${index})">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </span>
    `).join('');
}

window.removeFileFromPreview = function(index) {
    const filesInput = document.getElementById('attachmentInput');
    const dataTransfer = new DataTransfer();
    const files = Array.from(filesInput.files);
    
    files.splice(index, 1); 

    files.forEach(file => dataTransfer.items.add(file));
    filesInput.files = dataTransfer.files;

    updateFilePreview();
};

// ========================
// FORMULAIRES (inchangé)
// ========================
async function handleMessageSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('message-input');
    const filesInput = document.getElementById('attachmentInput');
    
    const message = input.value.trim();
    const files = filesInput?.files ? Array.from(filesInput.files) : [];
    
    if (!message && files.length === 0) return;

    try {
        await sendMessage(message, files);
        
        input.value = '';
        if (filesInput) filesInput.value = '';
        updateFilePreview();
        input.focus();
    } catch (err) {
        showModal('Erreur', `Échec de l'envoi: ${err?.message || 'Problème de connexion ou de serveur.'}`);
    }
}


// ========================
// INITIALISATION (Simplifiée)
// ========================
document.addEventListener('DOMContentLoaded', () => {
    // Rendre les fonctions globales
    window.toggleTheme = toggleTheme;
    window.changeView = changeView;
    window.removeFileFromPreview = removeFileFromPreview;

    setTheme(localStorage.getItem('theme') || 'light');

    // Gestionnaire du formulaire de message
    const msgForm = document.getElementById('message-form');
    if (msgForm) msgForm.addEventListener('submit', handleMessageSubmit);

    // Gestion des fichiers joints et de l'aperçu
    const attachBtn = document.getElementById('attach-btn');
    const attachmentInput = document.getElementById('attachmentInput');
    if (attachBtn && attachmentInput) {
        attachBtn.addEventListener('click', () => attachmentInput.click());
        attachmentInput.addEventListener('change', updateFilePreview);
    }
    
    // ... (Reste des initialisations de sidebar et autres)

    // Démarrer la vue par défaut (messagerie)
    changeView(DEFAULT_VIEW);
    
    // Connecter la WebSocket si les IDs sont disponibles
    if (companyId) connectWebSocket();
});