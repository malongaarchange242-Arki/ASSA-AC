document.addEventListener('DOMContentLoaded', async () => {
    // -----------------------
    // CONSTANTES
    // -----------------------
    const API_BASE = 'http://localhost:5002';
    const WS_URL = (API_BASE.startsWith('https') ? 'wss://' : 'ws://') +
                   API_BASE.replace(/^https?:\/\//,'').replace(/\/$/,'') + '/ws';

    // -----------------------
    // ÉLÉMENTS DOM
    // -----------------------
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
    if (chatInputArea) {
        if (chatInputArea.children.length >= 1) chatInputArea.insertBefore(previewContainer, chatInputArea.children[1]);
        else chatInputArea.appendChild(previewContainer);
    }

    let selectedFiles = [];
    let ws = null;
    let selectedIdCompanie = null;
    const tempMessageMap = new Map();
    const displayedMessages = new Set();

    // -----------------------
    // UTILITAIRES
    // -----------------------
    function showModal(title, message) {
        const modal = document.getElementById('status-modal');
        if (!modal) return console.warn('Modal non trouvé', title, message);
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').innerHTML = message;
        modal.classList.remove('invisible', 'opacity-0');
        modal.classList.add('visible', 'opacity-100');
    }

    function closeModal() {
        const modal = document.getElementById('status-modal');
        if (!modal) return;
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('invisible'), 300);
    }

    function makeLetterAvatar(text) {
        const initial = (String(text || '?').trim().charAt(0) || '?').toUpperCase();
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='45' height='45'>
            <rect width='100%' height='100%' fill='#1A73E8'/>
            <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
                font-family='Arial, sans-serif' font-size='22' fill='#FFFFFF'>${initial}</text>
        </svg>`;
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }

    function createLogo(company) {
        const raw = company.logo_url || company.logo || '';
        if (!raw) return makeLetterAvatar(company.company_name || 'U');
        if (raw.startsWith('http')) {
            const u = raw.toLowerCase();
            if (u.includes('via.placeholder.com') || u.includes('dummyimage.com')) return makeLetterAvatar(company.company_name);
            return raw;
        }
        const filename = raw.startsWith('logos/') ? raw.slice(6) : raw.replace(/^\/+/, '');
        return `https://iswllanzauyloulabutf.supabase.co/storage/v1/object/public/company-logos/${filename}`;
    }

    function scrollChatBottom() {
        chatMessagesContent.scrollTop = chatMessagesContent.scrollHeight;
    }

    function removeTempMessage(tempId) {
        if (tempMessageMap.has(tempId)) {
            const tempEl = tempMessageMap.get(tempId);
            if (tempEl && tempEl.parentNode) tempEl.parentNode.removeChild(tempEl);
            tempMessageMap.delete(tempId);
            displayedMessages.delete(tempId);
        }
    }

    // -----------------------
    // SESSION & AUTH
    // -----------------------
    function getToken() {
        return localStorage.getItem('jwtTokenAdmin') || localStorage.getItem('jwtTokenCompany');
    }

    function getSessionInfo() {
        const token = getToken();
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
            return {
                token,
                adminId: payload.id || payload.admin_id || localStorage.getItem('adminId'),
                id_companie: payload.id_companie || localStorage.getItem('id_companie'),
                role: ['Administrateur', 'Superviseur'].includes(payload.profile) ? 'admin' : 'company'
            };
        } catch (e) { console.error('JWT parse error', e); return null; }
    }

    async function fetchWithAuth(url, options = {}) {
        const session = getSessionInfo();
        if (!session) { showModal('Session expirée', 'Veuillez vous reconnecter'); return null; }
        const opts = { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${session.token}` } };
        const res = await fetch(url, opts);
        const newToken = res.headers.get('x-access-token');
        if (newToken) {
            localStorage.setItem(session.role === 'admin' ? 'jwtTokenAdmin' : 'jwtTokenCompany', newToken);
            session.token = newToken;
        }
        if (!res.ok) {
            if (res.status === 401) showModal('Session expirée', 'Veuillez vous reconnecter.');
            throw new Error(`Erreur HTTP ${res.status}`);
        }
        return res.json();
    }

    function renderMessage(payload, {
        returnElement = false,
        temp = false,
        sending = false,
        failed = false
    } = {}) {
        const m = payload.message || payload;
    
        // Assurer un ID unique si pas envoyé par le serveur
        if (!m.id) {
            m.id = 'temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        }
    
        // Déjà affiché → on ignore (évite les duplicatas)
        if (displayedMessages.has(m.id) && !temp) return null;
        displayedMessages.add(m.id);
    
        // Détermination robuste du rôle (priorité à sender_role)
        const role = String(m.sender_role || '').toLowerCase();
        const isAdminMsg = role === 'admin' || !!m.admin_id;
        
        // Création du wrapper
        const wrapper = document.createElement('div');
        wrapper.className = `message ${isAdminMsg ? 'message-admin' : 'message-client'}`;
        wrapper.dataset.msgId = m.id;
    
        if (temp) wrapper.classList.add('message-temp', 'message-sending');
        if (sending) wrapper.classList.add('message-sending');
        if (failed) wrapper.classList.add('message-failed');
    
        // -----------------------------------
        // Texte du message
        // -----------------------------------
        if (m.content) {
            const content = document.createElement('div');
            content.className = 'message-content';
            content.textContent = m.content;
            wrapper.appendChild(content);
        }
    
        // -----------------------------------
        // Pièces jointes
        // -----------------------------------
        const attachments = payload.attachments || [];
    
        attachments.forEach(att => {
            const attLink = document.createElement('a');
            attLink.target = "_blank";
    
            attLink.href =
                att.file_url ||
                att.url ||
                (att instanceof File ? URL.createObjectURL(att) : "#");
    
            const box = document.createElement('div');
            box.className = "attachment";
            box.textContent =
                att.file_name ||
                att.name ||
                (att instanceof File ? att.name : "Pièce jointe");
    
            attLink.appendChild(box);
            wrapper.appendChild(attLink);
        });
    
        // -----------------------------------
        // Timestamp
        // -----------------------------------
        if (m.created_at) {
            const ts = document.createElement('div');
            ts.className = 'message-ts';
            ts.textContent = new Date(m.created_at).toLocaleString();
            wrapper.appendChild(ts);
        }
    
        // -----------------------------------
        // Boutons Admin pour valider / refuser facture
        // -----------------------------------
        const session = getSessionInfo();
    
        if (m.is_invoice && session?.role === "admin") {
    
            const btnContainer = document.createElement('div');
            btnContainer.className = "invoice-actions";
            btnContainer.style.display = "flex";
            btnContainer.style.gap = "8px";
            btnContainer.style.marginTop = "6px";
    
            // Bouton confirmer
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = "Confirmer";
            confirmBtn.className = "btn-confirm";
            confirmBtn.style.cssText = `
                background-color:#1A73E8;
                color:white;
                border:none;
                padding:4px 8px;
                border-radius:4px;
                cursor:pointer;
            `;
            confirmBtn.addEventListener("click", async () => {
                try {
                    const res = await fetchWithAuth(`${API_BASE}/api/factures/${m.id}/confirm`, { method: "PATCH" });
                    alert(res.message || "Facture confirmée");
                    wrapper.remove();
                } catch (err) {
                    alert("Erreur lors de la confirmation.");
                }
            });
    
            // Bouton refuser
            const refuseBtn = document.createElement('button');
            refuseBtn.textContent = "Refuser";
            refuseBtn.className = "btn-refuse";
            refuseBtn.style.cssText = `
                background-color:#EA4335;
                color:white;
                border:none;
                padding:4px 8px;
                border-radius:4px;
                cursor:pointer;
            `;
            refuseBtn.addEventListener("click", async () => {
                try {
                    const res = await fetchWithAuth(`${API_BASE}/api/factures/${m.id}/reject`, { method: "PATCH" });
                    alert(res.message || "Facture refusée");
                    wrapper.remove();
                } catch (err) {
                    alert("Erreur lors du refus.");
                }
            });
    
            btnContainer.appendChild(confirmBtn);
            btnContainer.appendChild(refuseBtn);
            wrapper.appendChild(btnContainer);
        }
    
        // -----------------------------------
        // Insertion dans la zone de chat
        // -----------------------------------
        chatMessagesContent.appendChild(wrapper);
        scrollChatBottom();
    
        if (returnElement) return wrapper;
        return null;
    }
    
    // -----------------------
    // WEBSOCKET
    // -----------------------
    function connectWebSocket(id_companie) {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
        const session = getSessionInfo();
        if (!session) return;

        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            try { ws.send(JSON.stringify({ type: 'join', company_id: id_companie, token: session.token })); }
            catch (e) { console.error('WS join failed', e); }
        };

        ws.onmessage = evt => {
            try {
                const payload = JSON.parse(evt.data);
                if (payload.type === 'message' && payload.message?.id_companie === id_companie) {
                    if (displayedMessages.has(payload.message.id)) return;

                    const clientTempId = payload.message.client_temp_id || payload.message.temp_id;
                    if (clientTempId && tempMessageMap.has(clientTempId)) {
                        const tempEl = tempMessageMap.get(clientTempId);
                        const realEl = renderMessage(payload.message, { returnElement: true });
                        if (realEl && tempEl && tempEl.parentNode) tempEl.parentNode.replaceChild(realEl, tempEl);
                        tempMessageMap.delete(clientTempId);
                        displayedMessages.delete(clientTempId);
                        return;
                    }
                    renderMessage(payload.message);
                }
            } catch (e) { console.warn('WS message non valide', e); }
        };

        ws.onerror = err => console.error('Erreur WS:', err);
        ws.onclose = () => {
            ws = null;
            setTimeout(() => { if (selectedIdCompanie) connectWebSocket(selectedIdCompanie); }, 3000);
        };
    }

    // -----------------------
    // LOAD HISTORY
    // -----------------------
    async function loadHistory(adminId, id_companie) {
        if (!id_companie) { chatMessagesContent.innerHTML = '<p style="color:red;">id_companie manquant.</p>'; return; }
        try {
            displayedMessages.clear();
            tempMessageMap.clear();
            chatMessagesContent.innerHTML = '<p style="color:#70757A;">Chargement...</p>';

            const url = `${API_BASE}/api/messages/history?id_companie=${encodeURIComponent(id_companie)}`;
            const data = await fetchWithAuth(url);
            chatMessagesContent.innerHTML = '';

            if (Array.isArray(data) && data.length) data.forEach(msg => renderMessage(msg));
            else chatMessagesContent.innerHTML = '<p style="color:#70757A;">Aucun message pour le moment.</p>';

            connectWebSocket(id_companie);
        } catch (err) {
            console.error('Erreur chargement messages :', err);
            chatMessagesContent.innerHTML = `<p style="color:red;">Erreur serveur : ${err.message}</p>`;
        }
    }

    // -----------------------
    // PREVIEW FICHIERS
    // -----------------------
    function updatePreview() {
        previewContainer.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'preview-item';

            const icon = document.createElement('i');
            icon.className = 'fas fa-paperclip';
            div.appendChild(icon);

            const nameSpan = document.createElement('span');
            nameSpan.textContent = file.name;
            div.appendChild(nameSpan);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'preview-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', () => {
                selectedFiles = selectedFiles.filter((_, i) => i !== index);
                updatePreview();
            });
            div.appendChild(removeBtn);

            previewContainer.appendChild(div);
        });
    }

    attachBtn.addEventListener('click', () => attachmentInput.click());
    attachmentInput.addEventListener('change', (e) => { selectedFiles = Array.from(e.target.files || []); updatePreview(); });

    // -----------------------
    // SEND MESSAGE
    // -----------------------
    async function sendMessage(text, files) {
        if ((!text || text.trim().length === 0) && (!files || files.length === 0)) return;
        const session = getSessionInfo();
        if (!session || !session.id_companie) { showModal('Erreur', 'id_companie manquant'); return; }
        const { adminId, id_companie, role } = session;
        if (role === 'admin' && !adminId) { showModal('Erreur', 'admin_id manquant'); return; }

        const tempId = 'temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const tempPayload = { id: tempId, content: text, attachments: files, sender_role: role, created_at: new Date().toISOString() };
        const tempEl = renderMessage(tempPayload, { returnElement: true, temp: true, sending: true });
        if (tempEl) tempMessageMap.set(tempId, tempEl);

        const fd = new FormData();
        fd.append('sender_role', role);
        fd.append('id_companie', id_companie);
        if (role === 'admin') fd.append('admin_id', adminId);
        if (text) fd.append('content', text);
        (files || []).forEach(f => fd.append('attachments', f, f.name));

        messageInput.value = '';
        attachmentInput.value = '';
        selectedFiles = [];
        updatePreview();
        messageInput.focus();

        try {
            const res = await fetchWithAuth(`${API_BASE}/api/messages`, { method: 'POST', body: fd });
            if (!res) throw new Error('Réponse vide du serveur');

            const serverMessage = res.message || res;
            const clientTempId = serverMessage.client_temp_id || serverMessage.temp_id;

            if (clientTempId && tempMessageMap.has(clientTempId)) {
                const tempNode = tempMessageMap.get(clientTempId);
                const realEl = renderMessage(serverMessage, { returnElement: true });
                if (realEl && tempNode && tempNode.parentNode) tempNode.parentNode.replaceChild(realEl, tempNode);
                tempMessageMap.delete(clientTempId);
                displayedMessages.delete(clientTempId);
            } else if (tempMessageMap.has(tempId)) {
                removeTempMessage(tempId);
                renderMessage(serverMessage);
            }
        } catch (err) {
            console.error('Échec envoi message:', err);
            if (tempMessageMap.has(tempId)) {
                const tempNode = tempMessageMap.get(tempId);
                if (tempNode) tempNode.classList.add('message-failed');
                tempMessageMap.delete(tempId);
            }
            displayedMessages.delete(tempId);
            showModal('Erreur', `Échec de l'envoi: ${err.message || err}`);
        }
    }

    sendBtn.addEventListener('click', async () => await sendMessage(messageInput.value.trim(), selectedFiles));
    messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });

    // -----------------------
    // FETCH COMPANIES (Actives)
    // -----------------------
    async function fetchCompaniesActive() {
        try {
            const session = getSessionInfo();
            if (!session) { companyContainer.innerHTML = '<p style="color:red;">Session expirée.</p>'; return; }

            const data = await fetchWithAuth(`${API_BASE}/api/companies/all`);
            const companies = Array.isArray(data) ? data : data.companies || [];
            const activeCompanies = companies.filter(c => c.status === 'Actif');
            companyContainer.innerHTML = '';

            if (!activeCompanies.length) { companyContainer.innerHTML = '<p>Aucune compagnie active trouvée.</p>'; return; }

            activeCompanies.forEach(company => {
                const card = document.createElement('div');
                card.className = 'conversation-item';
                card.dataset.idCompanie = company.id_companie || company.id;

                const img = document.createElement('img');
                img.className = 'conv-avatar';
                img.src = createLogo(company);
                img.alt = company.company_name || 'Compagnie';

                const info = document.createElement('div');
                info.className = 'conv-info';
                const nameDiv = document.createElement('div');
                nameDiv.className = 'conv-company';
                nameDiv.textContent = company.company_name || '(Sans nom)';
                info.appendChild(nameDiv);

                card.appendChild(img);
                card.appendChild(info);

                card.addEventListener('click', async () => {
                    document.querySelectorAll('.conversation-item').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    selectedIdCompanie = company.id_companie || company.id;
                    localStorage.setItem('id_companie', selectedIdCompanie);
                    if (chatCompanyName) chatCompanyName.textContent = company.company_name || '';
                    if (chatCompanyAvatar) chatCompanyAvatar.src = createLogo(company);
                    const sessionInfo = getSessionInfo();
                    if (!sessionInfo || !sessionInfo.adminId) { showModal('Erreur', 'admin_id requis.'); return; }
                    await loadHistory(sessionInfo.adminId, selectedIdCompanie);
                });

                companyContainer.appendChild(card);
            });
        } catch (err) {
            console.error('Erreur API compagnies:', err);
            companyContainer.innerHTML = '<p style="color:red;">Erreur serveur.</p>';
        }
    }

    // -----------------------
    // SEARCH
    // -----------------------
    let searchTimer = null;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            const term = (searchInput.value || '').toLowerCase();
            document.querySelectorAll('.conversation-item').forEach(item => {
                const name = (item.querySelector('.conv-company')?.textContent || '').toLowerCase();
                item.style.display = name.includes(term) ? 'flex' : 'none';
            });
        }, 180);
    });

    // -----------------------
    // INIT
    // -----------------------
    (function init() {
        fetchCompaniesActive();
        const saved = localStorage.getItem('id_companie');
        if (saved) {
            setTimeout(() => {
                const el = Array.from(document.querySelectorAll('.conversation-item'))
                    .find(c => c.dataset.idCompanie === saved);
                if (el) el.click();
            }, 600);
        }
    })();
});
