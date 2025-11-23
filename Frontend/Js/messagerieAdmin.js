document.addEventListener('DOMContentLoaded', async () => {
    // -----------------------
    // CONSTANTES
    // -----------------------
    const API_BASE = 'https://assa-ac.onrender.com';
    const WS_URL = (API_BASE.startsWith('https') ? 'wss://' : 'ws://') +
                   API_BASE.replace(/^https?:\/\//,'').replace(/\/$/,'') + '/ws';

    // Éléments DOM
    const companyContainer = document.getElementById('companyContainer');
    const chatMessagesContent = document.getElementById('chat-messages-content');
    const chatCompanyName = document.getElementById('chat-company-name');
    const chatCompanyAvatar = document.getElementById('chat-company-avatar');
    const searchInput = document.getElementById('searchInput');
    const messageInput = document.getElementById('messageInput');
    const attachBtn = document.getElementById('attachBtn');
    const attachmentInput = document.getElementById('attachmentInput');
    const sendBtn = document.getElementById('sendBtn');

    // Preview container
    const chatInputArea = document.querySelector('.chat-input-area');
    const previewContainer = document.createElement('div');
    previewContainer.className = 'preview-container';
    chatInputArea.insertBefore(previewContainer, chatInputArea.children[1]);
    let selectedFiles = [];

    const emailSection = document.getElementById('emailSection');
    const otpSection = document.getElementById('otpSection');
    const allSections = [emailSection, otpSection];

    const emailInput = document.getElementById('emailInput');
    const passwordField = document.getElementById('passwordField');
    const passwordInput = document.getElementById('passwordInput');
    const otpCodeInput = document.getElementById('otpCode');
    const otpPasswordInput = document.getElementById('otpPasswordInput');
    const otpPasswordGroup = document.getElementById('otpPasswordInputGroup');

    const mainButton = document.getElementById('mainButton');
    const actionButtonContainer = document.getElementById('actionButtonContainer');

    const mainTitle = document.getElementById('mainTitle');
    const subTitle = document.getElementById('subTitle');

    const backToEmail2 = document.getElementById('backToEmail2');
    const resendOtpLink = document.getElementById('resendOtpLink');

    let ws = null;
    let selectedIdCompanie = null;
    let currentEmail = '';
    let currentRole = '';
    let isChecking = false;
    let typingTimer;
    const doneTypingInterval = 300;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{3,4}$/;

    // -----------------------
    // UTILITAIRES
    // -----------------------
    function showModal(title, message) {
        const modal = document.getElementById('status-modal');
        if(!modal) return;
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').innerHTML = message;
        modal.classList.remove('invisible','opacity-0');
        modal.classList.add('visible','opacity-100');
    }

    function closeModal() {
        const modal = document.getElementById('status-modal');
        if(!modal) return;
        modal.classList.add('opacity-0');
        setTimeout(()=>modal.classList.add('invisible'),300);
    }

    function makeLetterAvatar(text) {
        const initial = (String(text||'?').trim().charAt(0) || '?').toUpperCase();
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='45' height='45'>
            <rect width='100%' height='100%' fill='#1A73E8'/>
            <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
                font-family='Arial, sans-serif' font-size='22' fill='#FFFFFF'>${initial}</text>
        </svg>`;
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    function createLogo(company) {
        const raw = company.logo_url || company.logo || '';
        if (raw) {
            if (raw.startsWith('http')) {
                const u = raw.toLowerCase();
                if (u.includes('via.placeholder.com') || u.includes('dummyimage.com')) return makeLetterAvatar(company.company_name);
                return raw;
            }
            const filename = raw.startsWith('logos/') ? raw.slice(6) : raw.replace(/^\/+/, '');
            return `https://iswllanzauyloulabutf.supabase.co/storage/v1/object/public/company-logos/${filename}`;
        }
        return makeLetterAvatar(company.company_name);
    }

    function scrollChatBottom() {
        chatMessagesContent.scrollTop = chatMessagesContent.scrollHeight;
    }

    function renderMessage(payload) {
        const m = payload.message || payload;
        const attachments = payload.attachments || [];
        const isAdmin = m.sender_role === 'admin';
        const wrapper = document.createElement('div');
        wrapper.className = `message ${isAdmin ? 'message-admin' : 'message-client'}`;

        if (m.content) {
            const p = document.createElement('div');
            p.textContent = m.content;
            wrapper.appendChild(p);
        }

        if (attachments.length) {
            attachments.forEach(att => {
                const a = document.createElement('a');
                a.href = att.file_url;
                a.target = '_blank';
                const attDiv = document.createElement('div');
                attDiv.className = 'attachment';
                attDiv.innerHTML = `<i class="fas fa-paperclip"></i> ${att.file_name || 'Pièce jointe'}`;
                a.appendChild(attDiv);
                wrapper.appendChild(a);
            });
        }

        chatMessagesContent.appendChild(wrapper);
        scrollChatBottom();
    }

    // -----------------------
    // SESSION & JWT
    // -----------------------
    function getToken() {
        const t = localStorage.getItem('jwtTokenAdmin') || localStorage.getItem('jwtTokenCompany');
        if(!t) { showModal('Session expirée', 'Veuillez vous reconnecter'); return null; }
        return t;
    }

    function getSessionInfo() {
        const token = getToken();
        if(!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
            return {
                adminId: payload.id || payload.admin_id || localStorage.getItem('adminId'),
                id_companie: payload.id_companie || localStorage.getItem('id_companie'),
                role: payload.profile === 'Administrateur' || payload.profile === 'Superviseur' ? 'admin' : 'company',
                token
            };
        } catch (e) { console.error('JWT parsing error', e); return null; }
    }

    async function fetchWithAuth(url, options={}) {
        const session = getSessionInfo();
        if(!session) return null;

        const opts = {
            ...options,
            headers: { ...(options.headers||{}), 'Authorization': `Bearer ${session.token}` }
        };

        const res = await fetch(url, opts);
        const newToken = res.headers.get('x-access-token');
        if(newToken) {
            if(session.role === 'admin') localStorage.setItem('jwtTokenAdmin', newToken);
            else localStorage.setItem('jwtTokenCompany', newToken);
            session.token = newToken;
        }

        if(!res.ok) {
            if(res.status === 401) showModal('Session expirée', 'Veuillez vous reconnecter.');
            throw new Error(`Erreur HTTP ${res.status}`);
        }

        return res.json();
    }

    // -----------------------
    // MESSAGERIE
    // -----------------------
    async function loadHistory(adminId, id_companie) {
        if(!id_companie) { chatMessagesContent.innerHTML = '<p style="color:red;">id_companie manquant.</p>'; return; }
        try {
            const url = `${API_BASE}/api/messages/history?id_companie=${encodeURIComponent(id_companie)}`;
            const data = await fetchWithAuth(url);
            chatMessagesContent.innerHTML = '';
            if(Array.isArray(data) && data.length) data.forEach(renderMessage);
            else chatMessagesContent.innerHTML = '<p style="color:#70757A;">Aucun message pour le moment.</p>';
            connectWebSocket(id_companie);
        } catch(err) {
            console.error('Erreur chargement messages :', err);
            chatMessagesContent.innerHTML = `<p style="color:red;">Erreur serveur : ${err.message}</p>`;
        }
    }

    function connectWebSocket(id_companie) {
        if(ws && (ws.readyState===WebSocket.OPEN || ws.readyState===WebSocket.CONNECTING)) return;
        const session = getSessionInfo();
        if(!session) return;

        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            ws.send(JSON.stringify({ type:'join', company_id: id_companie, token: session.token }));
        };

        ws.onmessage = evt => {
            try {
                const payload = JSON.parse(evt.data);
                if(payload.type==='message' && payload.message?.id_companie === id_companie){
                    renderMessage(payload.message, payload.attachments);
                }
            } catch(e){
                console.warn('Message WS non valide', e);
            }
        };

        ws.onerror = err => console.error('Erreur WS:', err);
        ws.onclose = () => { ws=null; setTimeout(()=>connectWebSocket(id_companie),5000); };
    }

    // -----------------------
    // PREVIEW & ENVOI MESSAGE
    // -----------------------
    function updatePreview() {
        previewContainer.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `<i class="fas fa-paperclip"></i> ${file.name} <span class="preview-remove">&times;</span>`;
            div.querySelector('.preview-remove').addEventListener('click', () => {
                selectedFiles.splice(index, 1);
                updatePreview();
            });
            previewContainer.appendChild(div);
        });
    }

    attachBtn.addEventListener('click', () => attachmentInput.click());
    attachmentInput.addEventListener('change', (e) => {
        selectedFiles = Array.from(e.target.files);
        updatePreview();
    });

    async function sendMessage(text, files) {
        if(!text && files.length === 0) return; // rien à envoyer
        const session = getSessionInfo();
        if(!session || !session.id_companie) { showModal('Erreur','id_companie manquant'); return; }
        const { adminId, id_companie, role } = session;
        if(role==='admin' && !adminId){ showModal('Erreur','admin_id manquant'); return; }

        const fd = new FormData();
        fd.append('sender_role', role);
        fd.append('id_companie', id_companie);
        if(role==='admin') fd.append('admin_id', adminId);
        if(text) fd.append('content', text);
        (files||[]).forEach(f=>fd.append('attachments', f));

        try {
            const payload = await fetchWithAuth(`${API_BASE}/api/messages`, { method:'POST', body: fd });
            if(payload?.message) renderMessage(payload.message, payload.attachments);

            // Réinitialisation après envoi réussi
            messageInput.value = '';
            attachmentInput.value = '';
            selectedFiles = [];
            updatePreview();
            messageInput.focus();
        } catch(err){ 
            showModal('Erreur', `Échec de l'envoi: ${err.message}`); 
        }
    }

    sendBtn.addEventListener('click', async () => await sendMessage(messageInput.value.trim(), selectedFiles));

    // -----------------------
    // COMPANIES
    // -----------------------
    async function fetchCompanies() {
        try {
            const session = getSessionInfo();
            if(!session){ companyContainer.innerHTML='<p style="color:red;">Session expirée.</p>'; return; }

            const data = await fetchWithAuth(`${API_BASE}/api/companies/all`);
            const companies = Array.isArray(data) ? data : data.companies || [];
            companyContainer.innerHTML='';
            if(!companies.length){ companyContainer.innerHTML='<p>Aucune compagnie trouvée.</p>'; return; }

            companies.forEach(company => {
                const card = document.createElement('div');
                card.className='conversation-item';
                card.dataset.idCompanie = company.id_companie || company.id;

                const img = document.createElement('img');
                img.className='conv-avatar';
                img.src = createLogo(company);
                img.alt = company.company_name;

                const info = document.createElement('div'); info.className='conv-info';
                const nameDiv = document.createElement('div'); nameDiv.className='conv-company';
                nameDiv.textContent = company.company_name;
                info.appendChild(nameDiv);

                card.appendChild(img);
                card.appendChild(info);

                card.addEventListener('click', async () => {
                    document.querySelectorAll('.conversation-item').forEach(c=>c.classList.remove('active'));
                    card.classList.add('active');
                    selectedIdCompanie = company.id_companie || company.id;
                    localStorage.setItem('id_companie', selectedIdCompanie);
                    const sessionInfo = getSessionInfo();
                    if(!sessionInfo || !sessionInfo.adminId){ showModal('Erreur','admin_id requis.'); return; }
                    await loadHistory(sessionInfo.adminId, selectedIdCompanie);
                });

                companyContainer.appendChild(card);
            });
        } catch(err){ console.error('Erreur API compagnies:',err); companyContainer.innerHTML='<p style="color:red;">Erreur serveur.</p>'; }
    }

    // -----------------------
    // RECHERCHE
    // -----------------------
    searchInput.addEventListener('input', ()=> {
        const term = searchInput.value.toLowerCase();
        document.querySelectorAll('.conversation-item').forEach(item=>{
            const name = item.querySelector('.conv-company').textContent.toLowerCase();
            item.style.display = name.includes(term) ? 'flex' : 'none';
        });
    });

    // -----------------------
    // INITIALISATION
    // -----------------------
    fetchCompanies();
});
