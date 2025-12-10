/* ============================================================
    CONFIG
============================================================ */

window.API_BASE = "https://assa-ac-jyn4.onrender.com";

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

    // Logo (nom EXACT Multer)
    const logoFile = document.getElementById("company-logo-input")?.files?.[0];
    if (logoFile) {
        form.append("logo_url", logoFile);
    }

    try {
        const res = await fetch(`${API_BASE}/api/companies/update`, {
            method: "PUT",
            headers: {
                Authorization: "Bearer " + token
            },
            body: form
        });

        const data = await res.json();

        if (!res.ok) {
            showModal("Erreur", data.message || "Impossible de sauvegarder");
            return;
        }

        showModal("Succès", "Informations mises à jour avec succès !");
        loadCompanyInfo(); // Recharger immédiatement les infos

    } catch (err) {
        console.error("❌ Erreur saveCompanyInfo():", err);
        showModal("Erreur", "Erreur réseau lors de la mise à jour");
    }
}

document.getElementById("profil-logo-form").addEventListener("submit", uploadLogo);

/* ============================================================
    C) UPLOAD EXCLUSIF DU LOGO
============================================================ */

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
    form.append("logo_url", file);

    try {
        const res = await fetch(`${API_BASE}/api/companies/update`, {
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            body: form
        });

        const data = await res.json();

        if (!res.ok) {
            showModal("Erreur", data.message || "Erreur lors de l'envoi du logo");
            return;
        }

        showModal("Succès", "Logo mis à jour avec succès !");

        // 🔥 Mise à jour instantanée
        if (data.company?.logo_url) {
            document.getElementById("header-avatar").src = data.company.logo_url;
        }

    } catch (err) {
        console.error("❌ Erreur uploadLogo():", err);
        showModal("Erreur", "Erreur réseau lors de l'upload");
    }
}

/* ============================================================
    D) FORMULAIRE PROFIL → APPEL saveCompanyInfo()
============================================================ */

document.getElementById("profil-info-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveCompanyInfo();
});

/* ============================================================
    E) MISE À JOUR MOT DE PASSE
============================================================ */

document.getElementById("security-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById("current-password").value.trim();
    const newPassword = document.getElementById("new-password").value.trim();
    const confirmPassword = document.getElementById("confirm-password").value.trim();

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
        const token = getToken();

        const response = await fetch(`${API_BASE}/api/companies/update-password`, {
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
    F) THEME + SIDEBAR + MODAL
============================================================ */

function toggleTheme() {
    document.documentElement.classList.toggle("dark");
    document.getElementById("theme-text").textContent =
        "Mode " + (document.documentElement.classList.contains("dark") ? "Nuit" : "Jour");
}

document.getElementById("open-sidebar-btn")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("-translate-x-full");
});

document.getElementById("close-sidebar-btn")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("-translate-x-full");
});

function showModal(title, message) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-message").textContent = message;
    const m = document.getElementById("status-modal");
    m.classList.remove("opacity-0", "invisible");
    m.classList.add("opacity-100");
}

function closeModal() {
    const m = document.getElementById("status-modal");
    m.classList.add("opacity-0", "invisible");
}

function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);

    if (input.type === "password") {
        input.type = "text";
        button.textContent = "🙈";
    } else {
        input.type = "password";
        button.textContent = "👁️";
    }
}

/* ============================================================
    INIT
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    loadCompanyInfo();
});
