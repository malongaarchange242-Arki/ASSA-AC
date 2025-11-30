document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002') ? origin : 'http://localhost:5002';
    })();
    const form = document.getElementById('company-registration-form');
    const saveButton = document.getElementById('save-button');
    const REDIRECT_DELAY_MS = 2000;
    const messageDiv = document.getElementById('form-message');

    const logoInput = document.getElementById('logo-file'); // ✔ correspond à ton HTML
    const currentLogo = document.getElementById('current-logo');

    // ---------------- Afficher un message ----------------
    function showMessage(message, type = 'info') {
        messageDiv.textContent = message;
        messageDiv.className = 'text-center p-3 mb-6 rounded-xl font-medium border transition-opacity duration-300';
        if (type === 'error') messageDiv.classList.add('bg-red-50','text-red-800','border-red-500');
        else if (type === 'success') messageDiv.classList.add('bg-green-50','text-green-800','border-green-500');
        else messageDiv.classList.add('bg-blue-50','text-blue-800','border-blue-500');
        messageDiv.classList.remove('hidden');
    }

    // ---------------- Vérifier connexion ----------------
    const token = localStorage.getItem('jwtTokenAdmin');
    if (!token) {
        alert('Vous devez être connecté !');
        window.location.href = 'login.html';
        return;
    }

    // ---------------- Récupérer ID depuis URL ----------------
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

    // ---------------- Prévisualisation logo ----------------
    logoInput.addEventListener('change', () => {
        const file = logoInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => currentLogo.src = e.target.result;
            reader.readAsDataURL(file);
        }
    });

    // ---------------- Gestion du submit ----------------
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = companyId ? 'Modification en cours...' : 'Enregistrement en cours...';

        try {
            const formData = new FormData(form);

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

            // Mise à jour du logo après enregistrement
            if (result.company.logo_url) {
                currentLogo.src = result.company.logo_url.startsWith('http')
                    ? result.company.logo_url
                    : `https://iswllanzauyloulabutf.supabase.co/storage/v1/object/public/company-logos/${result.company.logo_url}`;
            }

            showMessage(`Compagnie "${result.company.company_name}" ${companyId ? 'modifiée' : 'créée'} avec succès !`, 'success');
            setTimeout(() => window.location.href = '/Frontend/Html/gestioncompagnie.html', REDIRECT_DELAY_MS);

        } catch (err) {
            console.error('Erreur API:', err);
            showMessage('Impossible de contacter le serveur.', 'error');
            saveButton.disabled = false;
            saveButton.textContent = companyId ? 'Modifier la Compagnie' : 'Enregistrer la Compagnie';
        }
    });
});
