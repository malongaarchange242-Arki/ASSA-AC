// ==================================================
// LISTE D'AÉROPORTS AFRIQUE (IATA)
// ==================================================
const AFRICA_AIRPORTS = [
    { code: "DLA", name: "Douala" },
    { code: "NSI", name: "Yaoundé Nsimalen" },
    { code: "FIH", name: "Kinshasa N'Djili" },
    { code: "BZV", name: "Brazzaville Maya-Maya" },
    { code: "ABJ", name: "Abidjan" },
    { code: "CKY", name: "Conakry" },
    { code: "DKR", name: "Dakar" },
    { code: "SSG", name: "Malabo" },
    { code: "LOS", name: "Lagos" },
    { code: "PNR", name: "Pointe-Noire" },
    { code: "ADD", name: "Addis-Abeba" },
    { code: "CAI", name: "Le Caire" },
    { code: "CMN", name: "Casablanca" },
    { code: "TUN", name: "Tunis" },
    { code: "JNB", name: "Johannesburg" },
    { code: "NDJ", name: "N'Djamena" },
    { code: "BGF", name: "Bangui" }
];

// ==================================================
// DOM READY
// ==================================================
document.addEventListener("DOMContentLoaded", async () => {

    const API_BASE = "https://assa-ac-jyn4.onrender.com";

    const form = document.getElementById("company-registration-form");
    const saveButton = document.getElementById("save-button");
    const messageDiv = document.getElementById("form-message");
    const airportSelect = document.getElementById("airport-code");
    const logoInput = document.getElementById("logo-file");
    const currentLogo = document.getElementById("current-logo");

    const REDIRECT_DELAY_MS = 1000;

    // ==================================================
    // MESSAGE UI
    // ==================================================
    function showMessage(message, type = "info") {
        messageDiv.textContent = message;
        messageDiv.className =
            "text-center p-3 mb-6 rounded-xl font-medium border";

        if (type === "error")
            messageDiv.classList.add("bg-red-50", "text-red-800", "border-red-500");
        else if (type === "success")
            messageDiv.classList.add("bg-green-50", "text-green-800", "border-green-500");
        else
            messageDiv.classList.add("bg-blue-50", "text-blue-800", "border-blue-500");

        messageDiv.classList.remove("hidden");
    }

    // ==================================================
    // AIRPORT SELECT
    // ==================================================
    AFRICA_AIRPORTS.forEach(ap => {
        const option = document.createElement("option");
        option.value = ap.code;
        option.textContent = `${ap.code} — ${ap.name}`;
        airportSelect.appendChild(option);
    });

    // ==================================================
    // MODE ÉDITION
    // ==================================================
    const params = new URLSearchParams(window.location.search);
    const companyId = params.get("id");

    if (companyId) {
        try {
            const res = await fetch(`${API_BASE}/api/companies/${companyId}`, {
                credentials: "include"
            });

            if (res.status === 401) {
                window.location.href = "login.html";
                return;
            }

            const result = await res.json();

            if (!res.ok) {
                showMessage(result.message || "Chargement impossible", "error");
                return;
            }

            const data = result.company;

            form.company_name.value = data.company_name || "";
            form.representative_name.value = data.representative_name || "";
            form.email.value = data.email || "";
            form.phone_number.value = data.phone_number || "";
            form.full_address.value = data.full_address || "";
            form.country.value = data.country || "";
            form.city.value = data.city || "";
            form.airport_code.value = data.airport_code || "";

            if (data.logo_url) {
                currentLogo.src = data.logo_url.startsWith("http")
                    ? data.logo_url
                    : `https://iswllanzauyloulabutf.supabase.co/storage/v1/object/public/company-logos/${data.logo_url}`;
            }

        } catch (err) {
            console.error(err);
            showMessage("Erreur serveur", "error");
        }
    }

    // ==================================================
    // PREVIEW LOGO
    // ==================================================
    logoInput.addEventListener("change", () => {
        const file = logoInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => (currentLogo.src = e.target.result);
        reader.readAsDataURL(file);
    });

    // ==================================================
    // SUBMIT FORM (CORRIGÉ)
    // ==================================================
    form.addEventListener("submit", async e => {
        e.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = companyId ? "Modification..." : "Enregistrement...";

        try {
            const formData = new FormData(form); // ✅ suffit

            // 🔥 ROUTE CORRECTE
            const url = companyId
                ? `${API_BASE}/api/companies/update-company/${companyId}` // ADMIN
                : `${API_BASE}/api/companies/update`; // COMPANY

            const res = await fetch(url, {
                method: companyId ? "PUT" : "PUT",
                credentials: "include",
                body: formData
            });

            if (res.status === 401) {
                window.location.href = "login.html";
                return;
            }

            const result = await res.json();

            if (!res.ok) {
                showMessage(result.message || "Erreur serveur", "error");
                return;
            }

            showMessage("Compagnie mise à jour avec succès", "success");

            setTimeout(() => {
                window.location.href = "gestioncompagnie.html";
            }, REDIRECT_DELAY_MS);

        } catch (err) {
            console.error(err);
            showMessage("Impossible de contacter le serveur", "error");
        } finally {
            saveButton.disabled = false;
        }
    });

});
