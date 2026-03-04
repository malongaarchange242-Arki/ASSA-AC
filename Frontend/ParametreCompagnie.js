/* ============================================================
    CONFIG
============================================================ */

window.API_BASE = "https://assa-ac-duzn.onrender.com";

function getToken() {
    return localStorage.getItem("jwtTokenCompany");
}

/* ============================================================
    A) CHARGER LES INFORMATIONS DE LA COMPAGNIE
============================================================ */

async function loadCompanyInfo() {
    const token = getToken();
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/api/companies/me`, {
            headers: { Authorization: "Bearer " + token }
        });

        if (!res.ok) {
            console.error("❌ Erreur API /companies/me :", res.status);
            return;
        }

        const { company } = await res.json();

        /* === HEADER === */
        document.getElementById("company-name").textContent =
            company.company_name || "Compagnie";

        document.getElementById("company-logo").src =
            company.logo_url || "https://placehold.co/40x40/1e40af/ffffff?text=?";

        /* === SECTION LOGO === */
        document.getElementById("header-avatar").src =
            company.logo_url || "https://placehold.co/80x80/1e40af/ffffff?text=??";

        /* === FORMULAIRE PROFIL === */
        document.getElementById("company_name").value =
            company.company_name || "";

        document.getElementById("client_number").value =
            company.id || "—";

        document.getElementById("company_email").value =
            company.email || "";

        document.getElementById("company_phone").value =
            company.phone || company.phone_number || "";

        document.getElementById("company_address").value =
            company.address || company.full_address || "";

    } catch (err) {
        console.error("❌ Erreur loadCompanyInfo():", err);
    }
}

/* ============================================================
    B) SAUVEGARDER LES INFORMATIONS (avec CHAMP logo + texte)
============================================================ */

async function saveCompanyInfo() {
    const token = getToken();
    if (!token) {
        showModal("Erreur", "Session expirée");
        return;
    }

    const form = new FormData();

    // Champs texte
    form.append("company_name", document.getElementById("company_name").value);
    form.append("email", document.getElementById("company_email").value);
    form.append("phone_number", document.getElementById("company_phone").value);
    form.append("full_address", document.getElementById("company_address").value);

    // Logo (le vrai nom attendu par Multer)
    const logoFile = document.getElementById("company-logo-input")?.files?.[0];
    if (logoFile) {
        console.log("🖼️ Fichier logo détecté :", logoFile);
        form.append("logo_url", logoFile);  // <-- CHANGÉ !
    } else {
        console.log("⚠️ Aucun nouveau logo sélectionné");
    }

    console.log("📤 Données envoyées :", [...form.entries()]);

    try {
        const res = await fetch(`${API_BASE}/api/companies/update`, {
            method: "PUT",
            headers: {
                Authorization: "Bearer " + token
                // PAS de "Content-Type": fetch le gère automatiquement pour FormData
            },
            body: form
        });

        const data = await res.json();

        console.log("📥 Réponse serveur :", data);

        if (!res.ok) {
            showModal("Erreur", data.message || "Impossible de sauvegarder");
            return;
        }

        showModal("Succès", "Informations mises à jour avec succès !");
        loadCompanyInfo(); // recharge les infos immédiatement

    } catch (err) {
        console.error("❌ Erreur saveCompanyInfo():", err);
        showModal("Erreur", "Erreur réseau lors de la mise à jour");
    }
}

document.getElementById("profil-logo-form").addEventListener("submit", uploadLogo);

async function uploadLogo(e) {
    e.preventDefault();

    const token = getToken();
    if (!token) {
        showModal("Erreur", "Session expirée");
        return;
    }

    const fileInput = document.getElementById("file-input");
    const file = fileInput.files[0];

    if (!file) {
        showModal("Erreur", "Veuillez sélectionner une image.");
        return;
    }

    const form = new FormData();
    form.append("logo_url", file); // 🔥 NOM EXACT pour Multer

    console.log("📤 Envoi du logo :", file);

    try {
        const res = await fetch(`${API_BASE}/api/companies/update`, {
            method: "PUT",
            headers: {
                Authorization: "Bearer " + token,
                // ❌ NE SURTOUT PAS mettre Content-Type ici
            },
            body: form
        });

        const data = await res.json();
        console.log("📥 Réponse serveur :", data);

        if (!res.ok) {
            showModal("Erreur", data.message || "Erreur lors de l'envoi du logo");
            return;
        }

        showModal("Succès", "Logo mis à jour avec succès !");

        // 🔥 Mise à jour instantanée de l’avatar
        if (data.company?.logo_url) {
            document.getElementById("header-avatar").src = data.company.logo_url;
        }

    } catch (err) {
        console.error("❌ Erreur uploadLogo():", err);
        showModal("Erreur", "Erreur réseau lors de l'upload");
    }
}




/* ============================================================
    C) FORMULAIRE PROFIL → APPEL saveCompanyInfo()
============================================================ */

document.getElementById("profil-info-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveCompanyInfo();
});

/* ============================================================
    D) MISE À JOUR MOT DE PASSE
============================================================ */

document.getElementById("security-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById("current-password").value.trim();
    const newPassword = document.getElementById("new-password").value.trim();
    const confirmPassword = document.getElementById("confirm-password").value.trim();

    // Validation frontend
    if (!currentPassword || !newPassword || !confirmPassword) {
        alert("Veuillez remplir tous les champs.");
        return;
    }

    if (newPassword !== confirmPassword) {
        alert("Les mots de passe ne correspondent pas.");
        return;
    }

    if (newPassword.length < 6) {
        alert("Le nouveau mot de passe doit contenir au moins 6 caractères.");
        return;
    }

    try {
        const token = localStorage.getItem("jwtTokenCompany");

        const response = await fetch("https://assa-ac-duzn.onrender.com/api/companies/update-password", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Erreur lors de la mise à jour.");
            return;
        }

        alert("Mot de passe mis à jour avec succès !");
        document.getElementById("security-form").reset();

    } catch (err) {
        console.error(err);
        alert("Erreur réseau.");
    }
});

/* ============================================================
    F) THEME + SIDEBAR + MODAL + VISIBILITÉ MOT DE PASSE
    * Ces fonctions doivent être disponibles globalement
============================================================ */

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
    
    // Sidebar logic
    document.getElementById("open-sidebar-btn")?.addEventListener("click", () => {
        document.getElementById("sidebar").classList.remove("-translate-x-full");
    });
    
    document.getElementById("close-sidebar-btn")?.addEventListener("click", () => {
        document.getElementById("sidebar").classList.add("-translate-x-full");
    });
    
    // Modal logic
    function showModal(title, message) {
        const m = document.getElementById("status-modal");
        if(!m) { console.error('Modal element not found'); return; }
    
        document.getElementById("modal-title").textContent = title;
        document.getElementById("modal-message").textContent = message;
        
        // Rendre visible
        m.classList.remove("opacity-0", "invisible");
        m.classList.add("opacity-100");
    }
    
    function closeModal() {
        const m = document.getElementById("status-modal");
        if(m) m.classList.add("opacity-0", "invisible");
    }
    
    // Password visibility logic
    function togglePasswordVisibility(inputId, button) {
        const input = document.getElementById(inputId);
    
        if (input.type === "password") {
            input.type = "text";
            button.innerHTML = "🙈"; // Utiliser innerHTML pour les emojis dans les boutons
        } else {
            input.type = "password";
            button.innerHTML = "👁️";
        }
    }
    
    // Rendre les fonctions d'interface utilisateur globales pour les appels HTML (onclick)
    window.toggleTheme = toggleTheme;
    window.showModal = showModal;
    window.closeModal = closeModal;
    window.togglePasswordVisibility = togglePasswordVisibility;
    
    
    /* ============================================================
        INIT
    ============================================================ */
    
    document.addEventListener("DOMContentLoaded", () => {
        // Initialise le thème au chargement
        setTheme(localStorage.getItem('theme') || 'light');
        
        loadCompanyInfo();
    });
