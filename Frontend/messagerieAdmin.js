document.addEventListener('DOMContentLoaded', async () => {
    // -----------------------
    // CONSTANTES
    // -----------------------
    const API_BASE = 'http://localhost:5002';
    const WS_URL = (API_BASE.startsWith('https') ? 'wss://' : 'ws://') +
        API_BASE.replace(/^https?:\/\//, '').replace(/\/$/, '') + '/ws';

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
    const notifBadge = document.getElementById('notifCount');
    const notifBtn = document.querySelector('.notification-btn');


    // Preview container
    const chatInputArea = document.querySelector('.chat-input-area');
    const previewContainer = document.createElement('div');
    previewContainer.className = 'preview-container';
    if (chatInputArea) {
        if (chatInputArea.children.length >= 1) chatInputArea.insertBefore(previewContainer, chatInputArea.children[1]);
        else chatInputArea.appendChild(previewContainer);
    }

    // Éléments du modal (nécessaires pour showModal/closeModal)
    const modal = document.getElementById('status-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    let selectedFiles = [];
    let ws = null;
    let selectedIdCompanie = null;
    const tempMessageMap = new Map();
    const displayedMessages = new Set();

    // -----------------------
    // UTILITAIRES
    // -----------------------
    function showModal(title, message) {
        if (!modal) return console.warn('Modal non trouvé', title, message);
        if (modalTitle) modalTitle.textContent = title;
        if (modalMessage) modalMessage.innerHTML = message;

        modal.classList.remove('invisible', 'opacity-0');
        modal.classList.add('visible', 'opacity-100');
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('invisible'), 300);
    }

    // Ajout de l'écouteur du bouton de fermeture du modal
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
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
    // NOTIFICATIONS
    // -----------------------
    function updateNotifBadge(count) {
        if (!notifBadge) return;

        if (count > 0) {
            notifBadge.hidden = false;
            notifBadge.textContent = count > 99 ? '99+' : count;
        } else {
            notifBadge.hidden = true;
            notifBadge.textContent = '0';
        }
    }

    function incrementNotif() {
        if (!notifBadge) return;
        const current = parseInt(notifBadge.textContent || '0', 10);
        updateNotifBadge(current + 1);
    }

    async function fetchUnreadCount() {
        try {
            const session = getSessionInfo();
            if (!session) return;

            const url = session.role === 'admin'
                ? `${API_BASE}/api/messages/unread/admin`
                : `${API_BASE}/api/messages/unread/company`;

            const res = await fetchWithAuth(url);
            const count = res?.count ?? res ?? 0;
            updateNotifBadge(count);
        } catch (e) {
            console.warn('Erreur récupération notifications', e);
        }
    }

    async function markConversationAsRead(companyId) {
        try {
            if (!companyId) return;
            await fetchWithAuth(
                `${API_BASE}/api/messages/mark-read/${companyId}`,
                { method: 'PUT' }
            );
            fetchUnreadCount();
        } catch (e) {
            console.warn('Erreur mark as read', e);
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
            const rawRole = (payload.role || payload.profile || '').toLowerCase();
            const isAdmin = ['administrateur', 'superviseur', 'super admin', 'admin'].includes(rawRole);
            return {
                token,
                adminId: payload.id || payload.admin_id || localStorage.getItem('adminId'),
                id_companie: payload.id_companie || localStorage.getItem('id_companie'),
                role: isAdmin ? 'admin' : 'company'
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

    function renderMessage(payload, { returnElement = false, temp = false, sending = false, failed = false } = {}) {
        const m = payload.message || payload;
        if (!m.id) m.id = 'temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        if (displayedMessages.has(m.id) && !temp) return null;
        displayedMessages.add(m.id);

        // -----------------------
        // SENT / RECEIVED
        // -----------------------
        const isSent = m.sender_role === 'admin';

        // -----------------------
        // RENDER
        // -----------------------
        const wrapper = document.createElement('div');
        wrapper.className = `message ${isSent ? 'message-admin' : 'message-client'}`;
        wrapper.dataset.msgId = m.id;

        if (temp) wrapper.classList.add('message-temp', 'message-sending');
        if (sending) wrapper.classList.add('message-sending');
        if (failed) wrapper.classList.add('message-failed');

        // Content
        if (m.content) {
            const p = document.createElement('div');
            p.className = 'message-content';
            p.textContent = m.content;
            wrapper.appendChild(p);
        }

        // Attachments
        const attachments = payload.attachments || [];
        attachments.forEach(att => {
            const a = document.createElement('a');
            a.href = att.file_url || att.url || (att instanceof File ? URL.createObjectURL(att) : '#');
            a.target = '_blank';

            const attDiv = document.createElement('div');
            attDiv.className = 'attachment';
            attDiv.textContent = att.file_name || att.name || (att instanceof File ? att.name : 'Pièce jointe');
            a.appendChild(attDiv);

            wrapper.appendChild(a);
        });

        // Timestamp
        if (m.created_at) {
            const t = document.createElement('div');
            t.className = 'message-ts';
            t.textContent = new Date(m.created_at).toLocaleString();
            wrapper.appendChild(t);
        }

        chatMessagesContent.appendChild(wrapper);
        scrollChatBottom();

        if (returnElement) return wrapper;
        return null;
    }

    // -----------------------
    // WEBSOCKET
    // -----------------------
    function connectWebSocket(id_companie) {
        if (!id_companie) return;
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
        const session = getSessionInfo();
        if (!session) return;

        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            try {
                const joinPayload = { type: 'join', token: session.token };
                if (id_companie) {
                    joinPayload.id_companie = id_companie;
                    joinPayload.company_id = id_companie;
                }
                if (session.adminId) joinPayload.admin_id = session.adminId;
                ws.send(JSON.stringify(joinPayload));
            } catch (e) { console.error('WS join failed', e); }
        };

        ws.onmessage = evt => {
            try {
                const payload = JSON.parse(evt.data);
                if (payload.type !== 'message') return;

                const msg = payload.message || payload;
                const msgCompanyId = msg?.id_companie || msg?.company_id || null;
                if (!msgCompanyId || !msg.id) return;

                // 🟡 Message pour une autre compagnie → incrément badge
                if (String(msgCompanyId) !== String(selectedIdCompanie)) {
                    incrementNotif();
                    return;
                }

                // 🟢 Message pour la conversation ouverte
                // Marquer comme lu uniquement si je suis le destinataire
                if (msg.sender_role !== getSessionInfo()?.role?.toLowerCase()) {
                    markConversationAsRead(msgCompanyId);
                }

                // 🔁 Remplacement message temporaire
                const clientTempId = msg.client_temp_id || msg.temp_id;
                if (clientTempId && tempMessageMap.has(clientTempId)) {
                    const tempEl = tempMessageMap.get(clientTempId);
                    const realEl = renderMessage(msg, { returnElement: true });

                    if (realEl && tempEl && tempEl.parentNode) {
                        tempEl.parentNode.replaceChild(realEl, tempEl);
                    }

                    tempMessageMap.delete(clientTempId);
                    displayedMessages.delete(clientTempId);
                    return;
                }

                // ⛔ Éviter doublons
                if (displayedMessages.has(msg.id)) return;

                renderMessage(msg);

            } catch (e) {
                console.warn('WS message non valide', e);
            }
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
            else chatMessagesContent.innerHTML = '<p class="chat-placeholder">Aucun message pour le moment.</p>';

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

        // Afficher/Cacher la preview container si nécessaire
        previewContainer.style.display = selectedFiles.length > 0 ? 'flex' : 'none';
    }

    attachBtn.addEventListener('click', () => attachmentInput.click());
    attachmentInput.addEventListener('change', (e) => {
        selectedFiles = Array.from(e.target.files || []);
        updatePreview();
    });

    // -----------------------
    // SEND MESSAGE
    // -----------------------
    async function sendMessage(text, files) {
        if ((!text || text.trim().length === 0) && (!files || files.length === 0)) return;

        const session = getSessionInfo();
        if (!session) { showModal('Session expirée', 'Veuillez vous reconnecter'); return; }
        const { role, adminId } = session;

        let id_companie;
        if (role === "company" || role === "Company") {
            id_companie = session.id_companie;
        } else if (role === "admin") {
            id_companie = selectedIdCompanie;
            if (!id_companie) {
                showModal("Erreur", "Veuillez sélectionner une compagnie");
                return;
            }
        }

        if (role === 'admin' && !adminId) {
            showModal('Erreur', 'admin_id manquant');
            return;
        }

        const tempId = 'temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const tempPayload = {
            id: tempId,
            content: text,
            attachments: files,
            sender_role: role,
            created_at: new Date().toISOString()
        };

        // afficher temporaire
        const tempEl = renderMessage(tempPayload, { returnElement: true, temp: true, sending: true });
        if (tempEl) tempMessageMap.set(tempId, tempEl);

        const fd = new FormData();
        fd.append('sender_role', role);
        fd.append('id_companie', id_companie);
        if (role === 'admin') fd.append('admin_id', adminId);
        fd.append('temp_id', tempId); // très important
        if (text) fd.append('content', text);
        (files || []).forEach(f => fd.append('attachments', f, f.name));

        // DEBUG: lister les champs envoyés (utile si devtools montre "formdata" vide)
        try {
            for (const pair of fd.entries()) {
                console.debug('[sendMessage] formdata ->', pair[0], pair[1]);
            }
        } catch (e) { console.warn('Impossible lister FormData', e); }

        // reset UI
        messageInput.value = '';
        attachmentInput.value = '';
        selectedFiles = [];
        updatePreview();
        messageInput.focus();

        try {
            const res = await fetchWithAuth(`${API_BASE}/api/messages`, { method: 'POST', body: fd });
            if (!res) throw new Error('Réponse vide du serveur');

            console.debug('[sendMessage] server response:', res);

            // On attend que le serveur renvoie l'objet message sauvegardé.
            const serverMessage = res.message || res;
            const clientTempId = serverMessage.client_temp_id || serverMessage.temp_id;

            if (clientTempId && tempMessageMap.has(clientTempId)) {
                const tempNode = tempMessageMap.get(clientTempId);
                const realEl = renderMessage(serverMessage, { returnElement: true });
                if (realEl && tempNode && tempNode.parentNode) tempNode.parentNode.replaceChild(realEl, tempNode);
                tempMessageMap.delete(clientTempId);
                displayedMessages.delete(clientTempId);
                return;
            }

            // Si le serveur renvoie au moins l'objet complet (avec id) mais sans temp id :
            if (serverMessage && serverMessage.id) {
                // remplacer le temp si toujours présent
                if (tempMessageMap.has(tempId)) {
                    const tempNode = tempMessageMap.get(tempId);
                    const realEl = renderMessage(serverMessage, { returnElement: true });
                    if (realEl && tempNode && tempNode.parentNode) tempNode.parentNode.replaceChild(realEl, tempNode);
                    tempMessageMap.delete(tempId);
                    displayedMessages.delete(tempId);
                    return;
                } else {
                    // aucun temp à remplacer, afficher direct
                    renderMessage(serverMessage);
                    return;
                }
            }

            // --- FALLBACK CRITIQUE ---
            console.warn('[sendMessage] server did not return message with id -> reloading history as fallback');
            if (role === 'admin') {
                await loadHistory(adminId, id_companie);
            } else {
                await loadHistory(null, id_companie);
            }
        } catch (err) {
            console.error('Échec envoi message:', err);
            if (tempMessageMap.has(tempId)) {
                const tempNode = tempMessageMap.get(tempId);
                if (tempNode) {
                    tempNode.classList.remove('message-sending', 'message-temp');
                    tempNode.classList.add('message-failed');
                }
                tempMessageMap.delete(tempId);
            }
            displayedMessages.delete(tempId);
            showModal('Erreur', `Échec de l'envoi: ${err.message || err}`);
        }
    }

    sendBtn.addEventListener('click', async () => await sendMessage(messageInput.value.trim(), selectedFiles));
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

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
    // INIT & THEME MANAGEMENT
    // -----------------------



    // --- MODE SOMBRE LOGIC ---
    const themeToggle = document.getElementById('theme-toggle');

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeToggle) {
                // Utilisation de Font Awesome pour les icônes
                themeToggle.querySelector('i').className = 'fas fa-sun';
                themeToggle.title = 'Mode Clair';
            }
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            if (themeToggle) {
                themeToggle.querySelector('i').className = 'fas fa-moon';
                themeToggle.title = 'Mode Sombre';
            }
            localStorage.setItem('theme', 'light');
        }
    }

    // 1. Initialisation du Thème
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (prefersDark) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }

    // 2. Écouteur du bouton de bascule du thème
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
        });
    }
    // --- FIN LOGIQUE MODE SOMBRE ---

    // --- INITIALISATION GENERALE ---
    (function init() {
        updatePreview();
        fetchCompaniesActive();

        // 🔔 Charger les notifications au démarrage
        fetchUnreadCount();

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
