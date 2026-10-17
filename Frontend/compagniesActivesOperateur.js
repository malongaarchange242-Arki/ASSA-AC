const OPERATOR_COMPANIES_API = 'https://assa-ac-api.onrender.com/api/companies/all';

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const openButton = document.getElementById('open-sidebar-btn');
    const closeButton = document.getElementById('close-sidebar-btn');
    const backdrop = document.getElementById('sidebar-backdrop');
    const themeToggle = document.getElementById('theme-toggle');
    const tbody = document.getElementById('active-company-rows');
    const count = document.getElementById('active-company-count');
    const refreshButton = document.getElementById('refresh-companies');
    const searchInput = document.getElementById('company-search');
    const token = localStorage.getItem('jwtTokenOperateur');
    let activeCompanies = [];

    if (!token) {
        alert('Session opérateur manquante. Veuillez vous reconnecter.');
        window.location.href = 'Index.html';
        return;
    }

    const setSidebarOpen = isOpen => {
        document.body.classList.toggle('sidebar-open', isOpen);
        openButton?.setAttribute('aria-expanded', String(isOpen));
    };

    openButton?.addEventListener('click', () => setSidebarOpen(true));
    closeButton?.addEventListener('click', () => setSidebarOpen(false));
    backdrop?.addEventListener('click', () => setSidebarOpen(false));
    sidebar?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setSidebarOpen(false)));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') setSidebarOpen(false);
    });

    const applyTheme = theme => {
        const isDark = theme === 'dark';
        document.body.classList.toggle('dark-mode', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.innerHTML = `<i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i>`;
        themeToggle.title = isDark ? 'Passer au mode clair' : 'Passer au mode sombre';
        themeToggle.setAttribute('aria-label', themeToggle.title);
    };
    applyTheme(localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    themeToggle?.addEventListener('click', () => {
        applyTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark');
    });

    function appendMessage(message, isError = false) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.className = `operator-company-message${isError ? ' table-error' : ''}`;
        cell.textContent = message;
        row.appendChild(cell);
        tbody.replaceChildren(row);
    }

    function buildLogoUrl(value) {
        const logo = typeof value === 'string' ? value.trim() : '';
        if (!logo) return '';
        if (/^https?:\/\//i.test(logo)) return logo;
        const filename = logo.replace(/^logos\//i, '').replace(/^\/+/, '');
        const encodedFilename = filename.split('/').map(encodeURIComponent).join('/');
        return `https://ulmwuzpjfbkxkkvdzaoi.supabase.co/storage/v1/object/public/company-logos/${encodedFilename}`;
    }

    function renderActiveCompanies(companies) {
        if (companies.length === 0) {
            appendMessage('Aucune compagnie active ne correspond à la recherche.');
            return;
        }

        const rows = companies.map(company => {
            const row = document.createElement('tr');
            row.className = 'company-row status-active';
            const companyCell = document.createElement('td');
            companyCell.className = 'company-name-cell';
            const identity = document.createElement('div');
            identity.className = 'company-identity';
            const name = company.company_name || 'Compagnie sans nom';
            const logoUrl = buildLogoUrl(company.logo_url || company.logo);

            if (logoUrl) {
                const logo = document.createElement('img');
                logo.src = logoUrl;
                logo.alt = `Logo ${name}`;
                logo.addEventListener('error', () => {
                    const fallback = document.createElement('span');
                    fallback.className = 'company-logo-fallback';
                    fallback.textContent = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
                    logo.replaceWith(fallback);
                }, { once: true });
                identity.appendChild(logo);
            } else {
                const fallback = document.createElement('span');
                fallback.className = 'company-logo-fallback';
                fallback.textContent = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
                identity.appendChild(fallback);
            }

            const details = document.createElement('div');
            details.className = 'company-identity-details';
            const companyName = document.createElement('span');
            companyName.className = 'company-name';
            companyName.textContent = name;
            const companyId = document.createElement('span');
            companyId.className = 'company-id';
            companyId.textContent = `#${company.id || '—'}`;
            details.append(companyName, companyId);
            identity.appendChild(details);
            companyCell.appendChild(identity);
            row.appendChild(companyCell);

            const address = [company.full_address, company.city, company.country].filter(Boolean).join(', ') || '—';
            [company.representative_name || '—', company.email || '—', company.phone_number || '—', address, company.airport_code || '—']
                .forEach(value => {
                    const cell = document.createElement('td');
                    cell.textContent = value;
                    row.appendChild(cell);
                });
            const statusCell = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = 'status-badge active';
            badge.textContent = company.status || 'Actif';
            statusCell.appendChild(badge);
            row.appendChild(statusCell);
            return row;
        });
        tbody.replaceChildren(...rows);
    }

    function filterActiveCompanies() {
        const query = searchInput.value.trim().toLocaleLowerCase('fr-FR');
        const filteredCompanies = activeCompanies.filter(company =>
            String(company.company_name || '').toLocaleLowerCase('fr-FR').includes(query) ||
            String(company.id || '').toLocaleLowerCase('fr-FR').includes(query) ||
            String(company.representative_name || '').toLocaleLowerCase('fr-FR').includes(query)
        );
        renderActiveCompanies(filteredCompanies);
    }

    async function loadActiveCompanies() {
        refreshButton.disabled = true;
        tbody.setAttribute('aria-busy', 'true');
        count.textContent = 'Chargement des compagnies…';
        appendMessage('Chargement des compagnies…');
        try {
            const response = await fetch(OPERATOR_COMPANIES_API, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-access-token': token,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || `Erreur HTTP ${response.status}`);
            if (!Array.isArray(data.companies)) throw new Error('Réponse API compagnies invalide');

            activeCompanies = data.companies.filter(company => {
                const status = String(company.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
                return status === 'actif' || status === 'active';
            });
            count.textContent = `${activeCompanies.length} compagnie${activeCompanies.length === 1 ? '' : 's'} active${activeCompanies.length === 1 ? '' : 's'}`;
            filterActiveCompanies();
        } catch (error) {
            console.error('Erreur de chargement des compagnies actives :', error);
            count.textContent = 'Impossible de charger les compagnies';
            appendMessage(`Erreur : ${error.message}`, true);
        } finally {
            tbody.setAttribute('aria-busy', 'false');
            refreshButton.disabled = false;
        }
    }

    refreshButton.addEventListener('click', loadActiveCompanies);
    searchInput.addEventListener('input', filterActiveCompanies);
    loadActiveCompanies();
});
