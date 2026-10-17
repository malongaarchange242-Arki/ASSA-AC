document.addEventListener('DOMContentLoaded', () => {

    // =========================
    // CONFIG
    // =========================
    const API_BASE = (() => {
        const origin = window.location.origin;
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return 'https://assa-ac-api.onrender.com';
        }
        return 'https://assa-ac-api.onrender.com';
    })();

    const tableBody = document.querySelector('#table-activites tbody');
    const searchInput = document.querySelector('.search-bar input');

    // Si la page n'a pas de tableau → on sort sans erreur
    if (!tableBody) {
        console.warn('Journal activité : tableau non présent sur cette page');
        return;
    }

    // =========================
    // UI - Libellés & icônes
    // =========================
    const TYPE_UI = {
        create: { label: 'activity_created', icon: 'fa-plus-circle' },
        update: { label: 'activity_updated', icon: 'fa-pen' },
        delete: { label: 'activity_deleted', icon: 'fa-trash' },
        system: { label: 'activity_system', icon: 'fa-cog' },
        validate: { label: 'activity_validated', icon: 'fa-check-circle' },
        reject: { label: 'activity_rejected', icon: 'fa-times-circle' },
        login: { label: 'activity_login', icon: 'fa-sign-in-alt' },
        security: { label: 'activity_security', icon: 'fa-shield-alt' },
        disable: { label: 'activity_disabled', icon: 'fa-ban' },
        submit: { label: 'activity_submitted', icon: 'fa-paper-plane' }
    };


    // =========================
    // AUTH SIMPLE (lecture seule)
    // =========================
    const adminToken = localStorage.getItem('jwtTokenAdmin');
    const companyToken = localStorage.getItem('jwtTokenCompany');

    const token = adminToken || companyToken;
    const role = adminToken ? 'admin' : companyToken ? 'company' : null;

    if (!token || !role) {
        tableBody.innerHTML =
            `<tr><td colspan="4" class="dashboard-activity-message">${t('activity_session_expired')}</td></tr>`;
        return;
    }

    // =========================
    // FETCH AUTH (sans refresh)
    // =========================
    async function fetchAuth(url) {
        const res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-access-token': token
            }
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Activity API error');

        return data;
    }

    // =========================
    // CHARGER ACTIVITÉS
    // =========================
    async function chargerActivites() {
        try {
            const url =
                role === 'admin'
                    ? `${API_BASE}/api/journal/recent?limit=5`
                    : `${API_BASE}/api/companies/journal/recent?limit=5`;

            const result = await fetchAuth(url);

            if (!result.success || !Array.isArray(result.activites)) {
                throw new Error('Format de données invalide');
            }

            activities = result.activites;
            renderTable(result.activites);
        } catch (err) {
            console.error('Journal activité:', err);
            tableBody.innerHTML =
                `<tr><td colspan="4" class="dashboard-activity-message">${t('activity_load_error')}</td></tr>`;
        }
    }

    let activities = [];

    function localizeActivityDescription(description) {
        description = String(description);
        const statusMatch = description.match(/^Statut de la facture mis à jour\s*:\s*(.+)$/i);
        if (statusMatch) {
            const statusKeys = {
                impayée: 'activity_status_unpaid',
                payée: 'activity_status_paid',
                contestée: 'activity_status_disputed',
                validée: 'activity_status_approved',
                rejetée: 'activity_status_rejected'
            };
            const status = statusMatch[1].trim();
            const statusKey = statusKeys[status.toLocaleLowerCase('fr-FR')];
            return t('activity_invoice_status').replace('{status}', statusKey ? t(statusKey) : status);
        }

        const patterns = [
            [/^Connexion de la compagnie (.+)$/i, 'activity_company_login', ['company']],
            [/^Création de la facture (.+) pour (.+)$/i, 'activity_invoice_created', ['invoice', 'company']],
            [/^Compagnie (.+) créée$/i, 'activity_company_created', ['company']],
            [/^Soumission de la facture (.+) au DAF pour validation$/i, 'activity_invoice_submitted', ['invoice']],
            [/^Validation de la facture (.+) par DAF$/i, 'activity_invoice_validated', ['invoice']],
            [/^Rejet de la facture (.+) par DAF\. Motif:\s*(.+)$/i, 'activity_invoice_rejected', ['invoice', 'reason']],
            [/^Mise à jour de la facture (.+) \((.+)\)$/i, 'activity_invoice_updated', ['invoice', 'company']],
            [/^Facture (.+) archivée$/i, 'activity_invoice_archived', ['invoice']],
            [/^L'administrateur (.+) a archivé la facture (.+)\.$/i, 'activity_invoice_archived_by', ['user', 'invoice']],
            [/^Confirmation du paiement de la facture (.+)$/i, 'activity_payment_confirmed', ['invoice']],
            [/^Compagnie (.+) archivée$/i, 'activity_company_archived', ['company']],
            [/^Compagnie (.+) restaurée$/i, 'activity_company_restored', ['company']],
            [/^Compagnie (.+) mise à jour$/i, 'activity_company_updated', ['company']],
            [/^Suppression définitive de la compagnie (.+)$/i, 'activity_company_deleted', ['company']],
            [/^OTP de première connexion généré pour la compagnie (.+)$/i, 'activity_company_otp', ['company']],
            [/^Activation automatique du compte et définition du mot de passe$/i, 'activity_company_activated', []],
            [/^Connexion opérateur$/i, 'activity_operator_login', []],
            [/^Mise à jour opérateur (.+)$/i, 'activity_operator_updated', ['operator']],
            [/^Désactivation opérateur (.+)$/i, 'activity_operator_disabled', ['operator']],
            [/^Création initiale du Super Admin$/i, 'activity_super_admin_created', []],
            [/^Connexion Super Admin par secret$/i, 'activity_super_admin_login', []],
            [/^Connexion administrateur$/i, 'activity_admin_login', []],
            [/^Mot de passe administrateur modifié$/i, 'activity_admin_password', []],
            [/^Activité système$/i, 'activity_system_event', []],
            [/^(.+) créé par Super Admin$/i, 'activity_profile_created', ['profile']]
        ];

        for (const [pattern, key, placeholders] of patterns) {
            const match = description.match(pattern);
            if (!match) continue;
            return placeholders.reduce((text, placeholder, index) =>
                text.replace(`{${placeholder}}`, match[index + 1]), t(key));
        }

        return description;
    }

    function localizeActivityUser(user) {
        if (user === 'Administrateur') return t('activity_user_administrator');
        if (user === 'Système') return t('activity_user_system');
        return user;
    }

    // =========================
    // RENDER TABLE
    // =========================
    function renderTable(activites) {
        tableBody.innerHTML = '';

        activities = activites;
        if (!activites.length) {
            tableBody.innerHTML =
                `<tr><td colspan="4" class="dashboard-activity-message">${t('activity_empty_dashboard')}</td></tr>`;
            return;
        }

        activites.forEach(act => {
            const tr = document.createElement('tr');
            const type = TYPE_UI[act.type_activite?.toLowerCase()] || {
                label: null,
                icon: 'fa-info-circle'
            };
            const typeCell = document.createElement('td');
            const icon = document.createElement('i');
            icon.className = `fas ${type.icon}`;
            icon.setAttribute('aria-hidden', 'true');
            typeCell.append(icon, document.createTextNode(` ${type.label ? t(type.label) : act.type_activite || '-'}`));

            const descriptionCell = document.createElement('td');
            const description = act.description || act.objet || '-';
            descriptionCell.textContent = localizeActivityDescription(description);

            const userCell = document.createElement('td');
            userCell.textContent = localizeActivityUser(act.utilisateur || '-');

            const dateCell = document.createElement('td');
            dateCell.textContent = act.date_activite
                ? new Date(act.date_activite).toLocaleString(localStorage.getItem('lang') === 'en' ? 'en-US' : 'fr-FR')
                : '-';

            tr.append(typeCell, descriptionCell, userCell, dateCell);
            tableBody.appendChild(tr);
        });
        

        if (searchInput?.value) {
            filtrer(searchInput.value);
        }
    }

    // =========================
    // FILTRE
    // =========================
    function filtrer(texte) {
        const t = texte.toLowerCase();
        Array.from(tableBody.rows).forEach(row => {
            row.style.display =
                row.innerText.toLowerCase().includes(t) ? '' : 'none';
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', e => filtrer(e.target.value));
    }
    window.addEventListener('app-language-change', () => renderTable(activities));

    // =========================
    // INIT
    // =========================
    chargerActivites();
});
