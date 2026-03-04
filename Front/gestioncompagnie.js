let allCompanies = []; // Stocke toutes les compagnies pour la recherche

document.addEventListener('DOMContentLoaded', async () => {
 // 1. Référence au bouton de bascule
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // 2. Fonction pour appliquer le thème
    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            if (themeToggle) {
                // Icône Soleil pour passer au mode clair
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                themeToggle.title = "Passer au Mode Clair";
            }
        } else {
            body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
            if (themeToggle) {
                // Icône Lune pour passer au mode sombre
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                themeToggle.title = "Passer au Mode Sombre";
            }
        }
    }

    // 3. Détecter et appliquer le thème au chargement
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        // Utiliser la préférence système si aucune n'est enregistrée
        applyTheme('dark');
    } else {
        applyTheme('light'); // Par défaut au mode clair
    }

    // 4. Écouteur d'événement pour le basculement
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
        });
    }
});


// FIN GESTION DU THÈME
/* ========================================================= */


// --------------------------------------------------
// Récupérer le token ADMIN
// --------------------------------------------------
function getToken() {
    const token = localStorage.getItem('jwtTokenAdmin');
    if (!token) {
        alert("Vous n'êtes pas connecté !");
        window.location.href = 'login.html';
        throw new Error("Token manquant");
    }
    return token;
}

// --------------------------------------------------
// Construire URL logo correctement
// --------------------------------------------------
function buildLogoUrl(logoUrl) {
    if (!logoUrl) return 'https://via.placeholder.com/60?text=Logo';
    if (logoUrl.startsWith('http')) return logoUrl;
    // Supprime "logos/" si déjà présent pour éviter doublon
    return `https://iswllanzauyloulabutf.supabase.co/storage/v1/object/public/company-logos/${logoUrl.replace(/^logos\//, '')}`;
}

// --------------------------------------------------
// Affichage des cartes compagnies
// --------------------------------------------------
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
                <span class="card-id">#${c.id || ''}</span>
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

// --------------------------------------------------
// Événements Modifier / Supprimer
// --------------------------------------------------
function attachCardEvents() {
    document.querySelectorAll('.company-card').forEach(card => {
        const companyId = card.dataset.id;
        const token = getToken();

        // Modifier
        card.querySelector('button[title="Modifier"]').addEventListener('click', () => {
            window.location.href = `enregistrecompagnie.html?id=${companyId}`;
        });

        // Supprimer (sécurisé)
        // Supprimer une compagnie (définitif)
        card.querySelector('button[title="Supprimer"]').addEventListener('click', async () => {

            if (!confirm('⚠️ Voulez-vous vraiment SUPPRIMER définitivement cette compagnie ?\nCette action est irréversible.')) {
                return;
            }

            try {
                const res = await fetch(
                    `https://assa-ac-jyn4.onrender.com/api/companies/delete/${companyId}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );

                const result = await res.json();

                if (!res.ok) {
                    throw new Error(result.message || 'Erreur lors de la suppression');
                }

                // ✅ Message succès
                alert(`✅ Compagnie "${result.company?.company_name || ''}" supprimée avec succès`);

                // ✅ Retirer la carte du DOM
                card.remove();

                // ✅ Mettre à jour la liste globale
                allCompanies = allCompanies.filter(c => c.id.toString() !== companyId);

            } catch (err) {
                console.error(err);
                alert('❌ Erreur : ' + err.message);
            }
        });

    });
}

// --------------------------------------------------
// Récupération des compagnies depuis l’API
// --------------------------------------------------
async function fetchCompanies() {
    const container = document.querySelector('.company-card-grid');
    container.innerHTML = '<p>Chargement des compagnies...</p>';

    try {
        const token = getToken();

        const res = await fetch('https://assa-ac-jyn4.onrender.com/api/companies/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`Erreur ${res.status} : ${res.statusText}`);

        const json = await res.json();
        allCompanies = json.companies || []; 
        renderCompanies(allCompanies);

        // Applique le filtre si une recherche était en cours (utile après l'actualisation)
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim() !== '') {
            filterCompanies(searchInput.value.trim());
        }

    } catch (err) {
        container.innerHTML = `<p style="color:red;">Erreur lors du chargement : ${err.message}</p>`;
        console.error(err);
    }
}

// --------------------------------------------------
// Logique de Filtrage
// --------------------------------------------------
function filterCompanies(query) {
    const lowerQuery = query.toLowerCase();
    const filtered = allCompanies.filter(c =>
        c.company_name?.toLowerCase().includes(lowerQuery) ||
        (c.id && c.id.toString().includes(lowerQuery)) ||
        c.representative_name?.toLowerCase().includes(lowerQuery)
    );
    renderCompanies(filtered);
}

// --------------------------------------------------
// Événement de Recherche dynamique
// --------------------------------------------------
document.addEventListener('input', e => {
    if (e.target.id === 'searchInput') {
        filterCompanies(e.target.value);
    }
});


// --------------------------------------------------
// Charger au démarrage
// --------------------------------------------------
fetchCompanies();