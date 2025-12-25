let allCompanies = []; // Stocke toutes les compagnies pour la recherche

/* =========================================================
   GESTION DU THÈME (inchangé, OK avec localStorage)
========================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            if (themeToggle) {
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                themeToggle.title = "Passer au Mode Clair";
            }
        } else {
            body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
            if (themeToggle) {
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                themeToggle.title = "Passer au Mode Sombre";
            }
        }
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }
});

/* =========================================================
   FETCH AVEC COOKIES + GESTION SESSION
========================================================= */
async function fetchWithAuth(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        credentials: 'include' // ✅ COOKIE AUTO
    });

    if (res.status === 401) {
        window.location.href = 'login.html';
        throw new Error('Session expirée');
    }

    return res;
}

/* =========================================================
   LOGO
========================================================= */
function buildLogoUrl(logoUrl) {
    if (!logoUrl) return 'https://via.placeholder.com/60?text=Logo';
    if (logoUrl.startsWith('http')) return logoUrl;

    return `https://iswllanzauyloulabutf.supabase.co/storage/v1/object/public/company-logos/${logoUrl.replace(/^logos\//, '')}`;
}

/* =========================================================
   RENDER COMPANIES
========================================================= */
function renderCompanies(companies) {
    const container = document.querySelector('.company-card-grid');
    container.innerHTML = '';

    if (!companies.length) {
        container.innerHTML = '<p>Aucune compagnie trouvée.</p>';
        return;
    }

    companies.forEach(c => {
        const status = c.status ? c.status.trim() : 'Inactif';
        const statusClass = status.toLowerCase() === 'actif' ? 'active' : 'inactive';

        const card = document.createElement('div');
        card.className = `company-card status-${statusClass}`;
        card.dataset.id = c.id;

        card.innerHTML = `
            <div class="card-header">
                <img src="${buildLogoUrl(c.logo_url)}" alt="Logo ${c.company_name}">
                <h3>${c.company_name}</h3>
                <span class="card-id">#${c.id}</span>
            </div>
            <div class="card-body">
                <p><strong>Représentant :</strong> ${c.representative_name || '-'}</p>
                <p><strong>E-mail :</strong> ${c.email || '-'}</p>
                <p><strong>Téléphone :</strong> ${c.phone_number || '-'}</p>
                <p><strong>Adresse :</strong> ${c.full_address || '-'}, ${c.city || '-'}, ${c.country || '-'}</p>
                <p><strong>Code Aéroport :</strong> ${c.airport_code || '-'}</p>
                <p><strong>Statut :</strong>
                    <span class="status-badge ${statusClass}">${status}</span>
                </p>
            </div>
            <div class="card-actions">
                <button title="Modifier"><i class="fas fa-edit"></i></button>
                <button title="Supprimer"><i class="fas fa-trash"></i></button>
            </div>
        `;

        container.appendChild(card);
    });

    attachCardEvents();
}

/* =========================================================
   ACTIONS SUR LES CARTES
========================================================= */
function attachCardEvents() {
    document.querySelectorAll('.company-card').forEach(card => {
        const companyId = card.dataset.id;

        // Modifier
        card.querySelector('button[title="Modifier"]').addEventListener('click', () => {
            window.location.href = `enregistrecompagnie.html?id=${companyId}`;
        });

        // Supprimer
        card.querySelector('button[title="Supprimer"]').addEventListener('click', async () => {
            if (!confirm('⚠️ Voulez-vous vraiment SUPPRIMER définitivement cette compagnie ?')) return;

            try {
                const res = await fetchWithAuth(
                    `https://assa-ac-jyn4.onrender.com/api/companies/delete/${companyId}`,
                    { method: 'DELETE' }
                );

                const result = await res.json();

                alert(`✅ Compagnie "${result.company?.company_name || ''}" supprimée`);
                card.remove();
                allCompanies = allCompanies.filter(c => c.id.toString() !== companyId);

            } catch (err) {
                console.error(err);
                alert('❌ ' + err.message);
            }
        });
    });
}

/* =========================================================
   FETCH COMPANIES
========================================================= */
async function fetchCompanies() {
    const container = document.querySelector('.company-card-grid');
    container.innerHTML = '<p>Chargement des compagnies...</p>';

    try {
        const res = await fetchWithAuth(
            'https://assa-ac-jyn4.onrender.com/api/companies/all'
        );

        const json = await res.json();
        allCompanies = json.companies || [];
        renderCompanies(allCompanies);

    } catch (err) {
        container.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

/* =========================================================
   FILTRAGE
========================================================= */
function filterCompanies(query) {
    const q = query.toLowerCase();
    renderCompanies(
        allCompanies.filter(c =>
            c.company_name?.toLowerCase().includes(q) ||
            c.representative_name?.toLowerCase().includes(q) ||
            c.id?.toString().includes(q)
        )
    );
}

document.addEventListener('input', e => {
    if (e.target.id === 'searchInput') {
        filterCompanies(e.target.value);
    }
});

/* =========================================================
   INIT
========================================================= */
fetchCompanies();
