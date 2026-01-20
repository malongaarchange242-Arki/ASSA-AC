document.addEventListener('DOMContentLoaded', () => {

    // 1. DONNÉES SIMULÉES (Accès Rapide)
    const contacts = {
        admins: [
            { id: 1, name: "Julie — RH", status: "online" },
            { id: 2, name: "Marc — Support Tech", status: "online" },
            { id: 3, name: "Sophie — Superviseur", status: "offline" }
        ],
        companies: [
            { id: 101, name: "AssurExpress Inc.", status: "online" },
            { id: 102, name: "SafeGuard Co.", status: "offline" },
            { id: 103, name: "Logistix SA", status: "online" }
        ]
    };

    const contactList = document.getElementById('contactList');
    const chatBody = document.getElementById('chatBody');
    const msgInput = document.getElementById('msgInput');
    const activeContactName = document.getElementById('activeContactName');

    // 2. FONCTION POUR CHARGER LES CONTACTS
    function displayContacts(type) {
        contactList.innerHTML = '';
        contacts[type].forEach(c => {
            const item = document.createElement('div');
            item.className = 'contact-item';
            item.innerHTML = `
                <div class="avatar" style="width:30px; height:30px; font-size:12px; background:#64748b">${c.name[0]}</div>
                <div class="contact-info">
                    <div style="font-weight:600; font-size:14px">${c.name}</div>
                    <div style="font-size:11px; color:${c.status === 'online' ? '#10b981' : '#94a3b8'}">
                        ${c.status === 'online' ? 'Disponible' : 'Hors-ligne'}
                    </div>
                </div>
            `;
            item.onclick = () => selectContact(c);
            contactList.appendChild(item);
        });
    }

    // 3. SÉLECTION D'UN CONTACT
    function selectContact(contact) {
        activeContactName.innerText = contact.name;
        chatBody.innerHTML = `
            <div class="welcome-msg" style="font-size:12px">
                Conversation sécurisée avec <strong>${contact.name}</strong> démarrée.
            </div>
        `;
        msgInput.focus();
    }

    // 4. GESTION DES ONGLETS
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.tab-btn.active').classList.remove('active');
            btn.classList.add('active');
            displayContacts(btn.dataset.tab);
        });
    });

    // 5. ENVOI DE MESSAGE
    function sendMessage() {
        const text = msgInput.value.trim();
        if (text && activeContactName.innerText !== "Sélectionnez une discussion") {
            const bubble = document.createElement('div');
            bubble.className = 'bubble sent';
            bubble.innerText = text;
            chatBody.appendChild(bubble);

            msgInput.value = '';
            chatBody.scrollTop = chatBody.scrollHeight;
        }

        // Force le scroll vers le bas
        chatBody.scrollTo({
            top: chatBody.scrollHeight,
            behavior: 'smooth' // Animation fluide
        });
    }

    document.getElementById('sendMsg').addEventListener('click', sendMessage);
    msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    // 6. DARK MODE TOGGLE (Similaire à l'accueil)
    const toggle = document.getElementById('toggleTheme');
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

    toggle.onclick = () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };

    // Initialisation
    displayContacts('admins');
});

document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll('.nav a');

    navLinks.forEach(link => {
        // On retire la classe active partout
        link.parentElement.classList.remove('active');

        // Si le href du lien correspond au nom du fichier actuel
        if (link.getAttribute('href') === currentPath) {
            link.parentElement.classList.add('active');
        }
    });
});