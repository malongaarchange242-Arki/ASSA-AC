let allCompanies = []; // Stocke toutes les compagnies pour la recherche

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
        card.querySelector('button[title="Supprimer"]').addEventListener('click', async () => {
            if (!confirm('Voulez-vous vraiment supprimer définitivement cette compagnie ?')) return;

            try {
                const res = await fetch(`http://localhost:5002/api/companies/delete/${companyId}`, {
                    method: 'DELETE',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const result = await res.json();

                if (!res.ok) {
                    const errorText = result?.message || JSON.stringify(result);
                    alert('Erreur : ' + errorText);
                    return;
                }

                alert(`Compagnie "${result.company.company_name}" supprimée définitivement avec succès`);
                
                // Retirer la carte de l'affichage
                card.remove();
                allCompanies = allCompanies.filter(c => c.id.toString() !== companyId);

            } catch (err) {
                alert('Erreur serveur : ' + err.message);
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

        const res = await fetch('http://localhost:5002/api/companies/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`Erreur ${res.status} : ${res.statusText}`);

        const json = await res.json();
        allCompanies = json.companies || [];
        renderCompanies(allCompanies);

    } catch (err) {
        container.innerHTML = `<p style="color:red;">Erreur lors du chargement : ${err.message}</p>`;
        console.error(err);
    }
}

// --------------------------------------------------
// Recherche dynamique
// --------------------------------------------------
document.addEventListener('input', e => {
    if (e.target.id === 'searchInput') {
        const query = e.target.value.toLowerCase();
        const filtered = allCompanies.filter(c =>
            c.company_name?.toLowerCase().includes(query) ||
            (c.id && c.id.toString().includes(query)) ||
            c.representative_name?.toLowerCase().includes(query)
        );
        renderCompanies(filtered);
    }
});

// --------------------------------------------------
// Charger au démarrage
// --------------------------------------------------
fetchCompanies();
