// Liste d'aéroports Afrique (IATA)
const AFRICA_AIRPORTS = [
    { code: "DLA", name: "Douala" },
    { code: "NSI", name: "Yaoundé" },
    { code: "FIH", name: "Kinshasa" },
    { code: "BZV", name: "Brazzaville" },
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

document.addEventListener('DOMContentLoaded', async () => {

    /* =====================================================
       INIT IATA
    ===================================================== */
    const airportSelect = document.getElementById("airport-code");
    AFRICA_AIRPORTS.forEach(ap => {
        const option = document.createElement("option");
        option.value = ap.code;
        option.textContent = `${ap.code} — ${ap.name}`;
        airportSelect.appendChild(option);
    });

    /* =====================================================
       CONFIG
    ===================================================== */
    const API_BASE = 'https://assa-ac-jyn4.onrender.com';
    const form = document.getElementById('company-registration-form');
    const saveButton = document.getElementById('save-button');
    const messageDiv = document.getElementById('form-message');
    const logoInput = document.getElementById('logo-file');
    const currentLogo = document.getElementById('current-logo');
    const REDIRECT_DELAY_MS = 1000;

    function showMessage(message, type = 'info') {
        messageDiv.textContent = message;
        messageDiv.className =
            'text-center p-3 mb-6 rounded-xl font-medium border transition-opacity duration-300';

        if (type === 'error')
            messageDiv.classList.add('bg-red-50', 'text-red-800', 'border-red-500');
        else if (type === 'success')
            messageDiv.classList.add('bg-green-50', 'text-green-800', 'border-green-500');
        else
            messageDiv.classList.add('bg-blue-50', 'text-blue-800', 'border-blue-500');

        messageDiv.classList.remove('hidden');
    }

    /* =====================================================
       PARAM URL
    ===================================================== */
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('id');

    /* =====================================================
       LOAD COMPANY (COOKIE AUTH)
    ===================================================== */
    if (companyId) {
        try {
            const res = await fetch(`${API_BASE}/api/companies/${companyId}`, {
                credentials: 'include' // 🍪 COOKIE ICI
            });

            if (res.status === 401) {
                window.location.href = 'login.html';
                return;
            }

            const result = await res.json();

            if (res.ok && result.company) {
                const data = result.company;

                form.company_name.value = data.company_name || '';
                form.representative_name.value = data.representative_name || '';
                form.email.value = data.email || '';
                form.phone_number.value = data.phone_number || '';
                form.full_address.value = data.full_address || '';
                form.country.value = data.country || '';
                form.city.value = data.city || '';
                form.airport_code.value = data.airport_code || '';

                if (data.logo_url) {
                    currentLogo.src = data.logo_url.startsWith('http')
                        ? data.logo_url
                        : `https://iswllanzauyloulabutf.supabase.co/storage/v1/object/public/company-logos/${data.logo_url}`;
                }
            } else {
                showMessage(result.message || 'Impossible de charger la compagnie', 'error');
            }
        } catch (err) {
            console.error(err);
            showMessage('Erreur serveur lors du chargement', 'error');
        }
    }

    /* =====================================================
       PREVIEW LOGO
    ===================================================== */
    logoInput.addEventListener('change', () => {
        const file = logoInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => currentLogo.src = e.target.result;
        reader.readAsDataURL(file);
    });

    /* =====================================================
       SUBMIT FORM
    ===================================================== */
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = companyId
            ? 'Modification en cours...'
            : 'Enregistrement en cours...';

        try {
            const formData = new FormData();
            formData.append('company_name', form.company_name.value.trim());
            formData.append('representative_name', form.representative_name.value.trim());
            formData.append('email', form.email.value.trim());
            formData.append('phone_number', form.phone_number.value.trim());
            formData.append('full_address', form.full_address.value.trim());
            formData.append('country', form.country.value.trim());
            formData.append('city', form.city.value.trim());
            formData.append('airport_code', form.airport_code.value.trim());

            if (logoInput.files[0]) {
                formData.append('logo_url', logoInput.files[0]);
            }

            const required = [
                'company_name',
                'representative_name',
                'email',
                'full_address',
                'country',
                'city'
            ];

            for (const f of required) {
                if (!formData.get(f)) {
                    showMessage(`Le champ "${f}" est obligatoire.`, 'error');
                    saveButton.disabled = false;
                    saveButton.textContent = companyId
                        ? 'Modifier la Compagnie'
                        : 'Enregistrer la Compagnie';
                    return;
                }
            }

            const url = companyId
                ? `${API_BASE}/api/companies/update-company/${companyId}`
                : `${API_BASE}/api/admins/create-company`;

            const method = companyId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                credentials: 'include', // 🍪 AUTH COOKIE
                body: formData
            });

            if (response.status === 401) {
                window.location.href = 'login.html';
                return;
            }

            const result = await response.json();

            if (!response.ok) {
                showMessage(result.message || 'Erreur serveur', 'error');
                throw new Error(result.message);
            }

            showMessage(
                `Compagnie "${result.company.company_name}" ${
                    companyId ? 'modifiée' : 'créée'
                } avec succès !`,
                'success'
            );

            setTimeout(
                () => (window.location.href = 'gestioncompagnie.html'),
                REDIRECT_DELAY_MS
            );

        } catch (err) {
            console.error(err);
            showMessage('Impossible de contacter le serveur.', 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = companyId
                ? 'Modifier la Compagnie'
                : 'Enregistrer la Compagnie';
        }
    });
});
