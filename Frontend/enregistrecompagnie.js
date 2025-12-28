// Liste d'aéroports Afrique (IATA)
const AFRICA_AIRPORTS = [
    { code: "DLA", name: "" },
    { code: "NSI", name: "" },
    { code: "FIH", name: "" },
    { code: "BZV", name: "" },
    { code: "ABJ", name: "" },
    { code: "CKY", name: "" },
    { code: "DKR", name: "" },
    { code: "SSG", name: "" },
    { code: "LOS", name: "" },
    { code: "PNR", name: "" },
    { code: "ADD", name: "" },
    { code: "CAI", name: "" },
    { code: "CMN", name: "" },
    { code: "TUN", name: "" },
    { code: "JNB", name: "" },
    { code: "NDJ", name: "" },
    { code: "BGF", name: "" }
];

document.addEventListener('DOMContentLoaded', async () => {

        // Remplir automatiquement la liste des codes IATA
        const airportSelect = document.getElementById("airport-code");
        AFRICA_AIRPORTS.forEach(ap => {
            const option = document.createElement("option");
            option.value = ap.code;
            option.textContent = `${ap.code} — ${ap.name}`;
            airportSelect.appendChild(option);
        });
    
    const API_BASE = 'http://localhost:5002';
    const form = document.getElementById('company-registration-form');
    const saveButton = document.getElementById('save-button');
    const REDIRECT_DELAY_MS = 1000;
    const messageDiv = document.getElementById('form-message');

    const logoInput = document.getElementById('logo-file');
    const currentLogo = document.getElementById('current-logo');

    function showMessage(message, type = 'info') {
        messageDiv.textContent = message;
        messageDiv.className = 'text-center p-3 mb-6 rounded-xl font-medium border transition-opacity duration-300';
        if (type === 'error') messageDiv.classList.add('bg-red-50', 'text-red-800', 'border-red-500');
        else if (type === 'success') messageDiv.classList.add('bg-green-50', 'text-green-800', 'border-green-500');
        else messageDiv.classList.add('bg-blue-50', 'text-blue-800', 'border-blue-500');
        messageDiv.classList.remove('hidden');
    }

    const token = localStorage.getItem('jwtTokenAdmin');
    if (!token) {
        alert('Vous devez être connecté !');
        window.location.href = 'login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('id');

    if (companyId) {
        try {
            const res = await fetch(`${API_BASE}/api/companies/${companyId}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'x-access-token': token }
            });

            const ct = res.headers.get('content-type') || '';
            const result = ct.includes('application/json') ? await res.json() : { message: await res.text() };

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
            showMessage('Erreur serveur lors du chargement de la compagnie', 'error');
        }
    }

    logoInput.addEventListener('change', () => {
        const file = logoInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => currentLogo.src = e.target.result;
            reader.readAsDataURL(file);
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = companyId ? 'Modification en cours...' : 'Enregistrement en cours...';

        try {
            // 🔥 Création manuelle du FormData pour inclure le fichier correctement
            const formData = new FormData();
            formData.append('company_name', form.company_name.value.trim());
            formData.append('representative_name', form.representative_name.value.trim());
            formData.append('email', form.email.value.trim());
            formData.append('phone_number', form.phone_number.value.trim());
            formData.append('full_address', form.full_address.value.trim());
            formData.append('country', form.country.value.trim());
            formData.append('city', form.city.value.trim());
            formData.append('airport_code', form.airport_code.value.trim());

            // 🔥 AJOUT OBLIGATOIRE DU FICHIER
            if (logoInput.files[0]) {
                formData.append('logo_url', logoInput.files[0]);
            }

            console.log("DEBUG fichier envoyé →", formData.get("logo_url"));

            const requiredFields = ['company_name', 'representative_name', 'email', 'full_address', 'country', 'city'];
            for (const field of requiredFields) {
                if (!formData.get(field)?.trim()) {
                    showMessage(`Le champ "${field}" est obligatoire.`, 'error');
                    saveButton.disabled = false;
                    saveButton.textContent = companyId ? 'Modifier la Compagnie' : 'Enregistrer la Compagnie';
                    return;
                }
            }

            const method = companyId ? 'PUT' : 'POST';
            const url = companyId
                ? `${API_BASE}/api/companies/update-company/${companyId}`
                : `${API_BASE}/api/admins/create-company`;

            const response = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'x-access-token': token },
                body: formData
            });

            const ct = response.headers.get('content-type') || '';
            const result = ct.includes('application/json') ? await response.json() : { message: await response.text() };

            if (!response.ok) {
                showMessage(result.message || 'Erreur serveur', 'error');
                saveButton.disabled = false;
                saveButton.textContent = companyId ? 'Modifier la Compagnie' : 'Enregistrer la Compagnie';
                return;
            }

            if (result.company.logo_url) {
                currentLogo.src = result.company.logo_url.startsWith('http')
                    ? result.company.logo_url
                    : `https://iswllanzauyloulabutf.supabase.co/storage/v1/object/public/company-logos/${result.company.logo_url}`;
            }

            showMessage(`Compagnie "${result.company.company_name}" ${companyId ? 'modifiée' : 'créée'} avec succès !`, 'success');
            setTimeout(() => window.location.href = 'gestioncompagnie.html', REDIRECT_DELAY_MS);

        } catch (err) {
            console.error('Erreur API:', err);
            showMessage('Impossible de contacter le serveur.', 'error');
            saveButton.disabled = false;
            saveButton.textContent = companyId ? 'Modifier la Compagnie' : 'Enregistrer la Compagnie';
        }
    });
});
