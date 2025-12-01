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
    return origin.includes(':5002') ? origin : 'https://assa-ac-jyn4.onrender.com';
})();

const WS_URL = (API_BASE.startsWith('https') ? 'wss://' : 'ws://') +
               API_BASE.replace(/^https?:\/\//, '').replace(/\/$/, '') + '/ws';

// ========================
// TOKEN & IDS
// ========================
const authToken = localStorage.getItem('jwtTokenCompany');
let companyId = localStorage.getItem('id_companie');

if (!authToken || !companyId) {
    alert('Token ou ID de compagnie manquant. Veuillez vous reconnecter.');
    window.location.href = '/Frontend/Html/Login.html';
}
// ========================
// THEME
// ========================
function setTheme(mode) {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');

    if (mode === 'dark') {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if(icon) icon.innerHTML = '<path ...></path>'; // Icône soleil
        if(text) text.textContent = 'Mode Jour';
    } else {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        if(icon) icon.innerHTML = '<path ...></path>'; // Icône lune
        if(text) text.textContent = 'Mode Nuit';
    }
}
function toggleTheme() {
    setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
}

// ========================
// NAVIGATION
// ========================
function changeView(viewKey) {
    document.querySelectorAll('#content-area > div').forEach(div => div.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    const viewEl = document.getElementById(`${viewKey}-view`);
    if (viewEl) viewEl.classList.remove('hidden');
    document.querySelector(`.nav-link[data-view="${viewKey}"]`)?.classList.add('active');

    document.getElementById('main-title').textContent = viewKey === 'messagerie' ? 'Messagerie' : viewKey;

    if (viewKey === 'messagerie') {
        if (!historyLoaded) loadHistory();
        if (!ws) connectWebSocket();
        setTimeout(scrollChatToBottom, 100);
    }
}

function showPinnedInvoice(invoiceId, proofId) {
    const box = document.getElementById('pinned-invoice');
    const title = document.getElementById('pinned-title');
    const proof = document.getElementById('pinned-proof');

    if (!box || !title || !proof) return;

    box.classList.remove('hidden');
    title.textContent = `📌 Facture épinglée : ${invoiceId}`;

    if (proofId) {
        proof.textContent = `Preuve liée : ${proofId}`;
    } else {
        proof.textContent = "Aucune preuve jointe.";
    }
}


// ========================
// MESSAGERIE
// ========================
let ws = null;
let historyLoaded = false;
let sendingMessage = false;

function scrollChatToBottom(){
    const chatWindow = document.getElementById('chat-messages');
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderMessage(message, attachments){
    const chatWindow = document.getElementById('chat-messages');
    if (!chatWindow || chatWindow.querySelector(`[data-id="${message.id}"]`)) return;

    const safe = s => String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const isCompany = message.sender_role === 'company';
    const isAdmin = message.sender_role === 'admin';

    const wrapper = document.createElement('div');
    wrapper.className = isCompany ? 'flex justify-end' : 'flex justify-start';
    wrapper.setAttribute('data-id', message.id);

    const bubble = document.createElement('div');
    // Styles selon l'expéditeur
    if(isCompany){
        bubble.className = 'p-3 rounded-xl rounded-br-none bg-gray-300 text-gray-900 max-w-xs shadow';
    } else if(isAdmin){
        bubble.className = 'p-3 rounded-xl rounded-bl-none bg-blue-500 text-white max-w-xs shadow';
    } else {
        bubble.className = 'p-3 rounded-xl max-w-xs shadow'; // fallback
    }

    bubble.innerHTML = `<p class="text-sm">${safe(message.content)}</p>`;

    if (attachments?.length){
        const list = document.createElement('div');
        list.className = 'mt-2 space-y-1';
        attachments.forEach(att => {
            const a = document.createElement('a');
            a.href = att.file_url || '#';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'block text-xs underline';
            a.textContent = att.file_name || 'Pièce jointe';
            list.appendChild(a);
        });
        bubble.appendChild(list);
    }

    wrapper.appendChild(bubble);
    chatWindow.appendChild(wrapper);
    scrollChatToBottom();
}


// ========================
// HISTORIQUE
// ========================
async function loadHistory(){
    if (!companyId) { historyLoaded = true; return; }
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE}/api/messages/history?id_companie=${companyId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
        const data = await res.json();
        data.forEach(item => renderMessage(item.message, item.attachments));
    } catch(err) {
        console.error('Erreur chargement messages:', err);
        alert('Impossible de charger l’historique. Veuillez réessayer plus tard.');
    }

    historyLoaded = true;
    scrollChatToBottom();
}

// ========================
// ENVOI MESSAGE
// ========================
async function sendMessage(text, files){
    if (sendingMessage || !companyId) return;
    sendingMessage = true;

    const fd = new FormData();
    fd.append('id_companie', companyId);
    fd.append('sender_role', 'company');
    if (text) fd.append('content', text);
    files?.forEach(f => fd.append('attachments', f));

    try {
        const res = await fetch(`${API_BASE}/api/messages/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: fd
        });
        if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
        const payload = await res.json();
        renderMessage(payload.message, payload.attachments);
    } catch(err) {
        console.error('Erreur envoi message:', err);
        alert('Échec de l’envoi. Veuillez réessayer.');
    } finally {
        sendingMessage = false;
    }
}

// ========================
// WEBSOCKET COMPAGNIE
// ========================
function connectWebSocket() {
    if (!companyId) return;
    // Si WS déjà ouvert ou en train de se connecter, ne rien faire
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
        ws = new WebSocket(WS_URL);
    } catch (err) {
        console.error('Impossible de créer WS:', err);
        ws = null;
        return;
    }

    ws.onopen = () => {
        // La compagnie rejoint sa room immédiatement
        ws.send(JSON.stringify({ type: 'join', company_id: companyId }));
        console.log('WS ouvert, room company join:', companyId);
    };

    ws.onmessage = ev => {
        let data;
        try {
            data = JSON.parse(ev.data);
        } catch (err) {
            console.warn('Message WS non valide', err);
            return;
        }

        // Si c'est un message destiné à cette compagnie
        if (data?.type === 'message' && data.message?.id_companie === companyId) {
            // Affiche tout message, peu importe sender_role
            renderMessage(data.message, data.attachments);
        }
    };

    ws.onclose = () => { 
        ws = null; 
        console.log('WS fermé, reconnexion dans 1,5s');
        setTimeout(connectWebSocket, 1500); 
    };

    ws.onerror = err => { 
        console.error('Erreur WS:', err);
        try { ws.close(); } catch{} 
    };
}


// ========================
// FICHIERS JOINTS
// ========================
function updateFilePreview() {
    const filesInput = document.getElementById('attachmentInput');
    const previewArea = document.getElementById('file-preview-area');
    const previewList = document.getElementById('file-preview-list');

    const files = filesInput?.files ? Array.from(filesInput.files) : [];
    if (files.length === 0) { previewArea?.classList.add('hidden'); previewList.innerHTML = ''; return; }

    previewArea?.classList.remove('hidden');
    previewList.innerHTML = files.map((f,i)=>`
        <span class="file-tag">
            ${f.name} 
            <button type="button" data-index="${i}" onclick="removeFileFromPreview(${i})">✖</button>
        </span>
    `).join('');
}

window.removeFileFromPreview = function(i){
    const filesInput = document.getElementById('attachmentInput');
    const dt = new DataTransfer();
    const files = Array.from(filesInput.files);
    files.splice(i,1);
    files.forEach(f=>dt.items.add(f));
    filesInput.files=dt.files;
    updateFilePreview();
};

// ========================
// FORMULAIRE
// ========================
async function handleMessageSubmit(e){
    e.preventDefault();
    const input = document.getElementById('message-input');
    const filesInput = document.getElementById('attachmentInput');
    const message = input.value.trim();
    const files = filesInput?.files ? Array.from(filesInput.files) : [];
    if (!message && files.length===0) return;
    await sendMessage(message, files);
    input.value=''; filesInput.value=''; updateFilePreview(); input.focus();
}

// ========================
// INITIALISATION
// ========================
document.addEventListener('DOMContentLoaded',()=>{
    window.toggleTheme = toggleTheme;
    window.changeView = changeView;
    window.removeFileFromPreview = removeFileFromPreview;

    setTheme(localStorage.getItem('theme') || 'light');

    const msgForm = document.getElementById('message-form');
    msgForm?.addEventListener('submit', handleMessageSubmit);

    const attachBtn = document.getElementById('attach-btn');
    const attachmentInput = document.getElementById('attachmentInput');
    attachBtn?.addEventListener('click',()=>attachmentInput.click());
    attachmentInput?.addEventListener('change', updateFilePreview);

    // Pré-remplissage à partir des paramètres d'URL (preuve épinglée)
    const params = new URLSearchParams(window.location.search);
    const proofId = params.get('proofId');
    const invoiceId = params.get('invoice');

    async function prefillProofAttachment(id) {
        try {
            const res = await fetch(`${API_BASE}/api/preuves/${encodeURIComponent(id)}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await res.json();
            const preuve = data?.preuve;
            if (!res.ok || !preuve?.fichier_url) {
                try {
                    const raw = localStorage.getItem('lastProofAttachment');
                    if (raw) {
                        const meta = JSON.parse(raw);
                        if (meta?.url) {
                            await prefillProofAttachmentFromUrl(meta.url, meta.name);
                        }
                    }
                } catch {}
                return;
            }

            const fileRes = await fetch(preuve.fichier_url);
            const blob = await fileRes.blob();
            const file = new File([blob], preuve.fichier_nom || 'preuve', { type: blob.type || 'application/octet-stream' });

            const attachmentInput = document.getElementById('attachmentInput');
            if (!attachmentInput) return;
            const dt = new DataTransfer();
            dt.items.add(file);
            attachmentInput.files = dt.files;
            updateFilePreview();

            const input = document.getElementById('message-input');
            if (input && invoiceId) input.value = `Preuve de paiement pour la facture ${invoiceId}`;
        } catch (err) { console.error('Pré-remplissage preuve échoué:', err); }
    }

    async function prefillProofAttachmentFromUrl(url, name) {
        try {
            if (!url) return;
            const fileRes = await fetch(url);
            const blob = await fileRes.blob();
            const file = new File([blob], name || 'preuve', { type: blob.type || 'application/octet-stream' });
            const attachmentInput = document.getElementById('attachmentInput');
            if (!attachmentInput) return;
            const dt = new DataTransfer();
            dt.items.add(file);
            attachmentInput.files = dt.files;
            updateFilePreview();
            const input = document.getElementById('message-input');
            if (input && invoiceId) input.value = `Preuve de paiement pour la facture ${invoiceId}`;
        } catch (err) { console.error('Pré-remplissage preuve (URL) échoué:', err); }
    }

    if (proofId) changeView('messagerie'); else changeView(DEFAULT_VIEW);
    if (companyId) connectWebSocket();
    if (proofId) {
        prefillProofAttachment(proofId);
    } else {
        try {
            const raw = localStorage.getItem('lastProofAttachment');
            if (raw) {
                const meta = JSON.parse(raw);
                if (meta?.url) {
                    prefillProofAttachmentFromUrl(meta.url, meta.name);
                }
            }
        } catch {}
    }
    try { localStorage.removeItem('lastProofAttachment'); } catch {}
});
