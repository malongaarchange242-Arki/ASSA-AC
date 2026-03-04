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

    // Init token UI early so user can paste token before any API calls
    try {
        initTokenUI();
    } catch (e) {
        console.warn('initTokenUI error:', e);
    }

    // Now it's safe to start loading companies (user can paste token first)
    try {
        fetchCompanies();
    } catch (e) {
        console.error('fetchCompanies error on DOMContentLoaded:', e);
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
// UI helper to let user paste/store jwtTokenAdmin in localStorage
// Adds a floating button and modal when no token is present
// --------------------------------------------------
function initTokenUI() {
    if (localStorage.getItem('jwtTokenAdmin')) {
        return; // already set
    }

    // Floating button
    const btn = document.createElement('button');
    btn.id = 'token-setter-btn';
    btn.textContent = 'Coller token';
    Object.assign(btn.style, {
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: 9999,
        padding: '8px 12px',
        background: '#2563eb',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
    });
    document.body.appendChild(btn);

    // Modal overlay
    const modal = document.createElement('div');
    modal.id = 'token-modal';
    Object.assign(modal.style, {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'none', alignItems: 'center', justifyContent: 'center', zIndex: 10000
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
        background: '#fff', padding: '18px', borderRadius: '8px', width: '420px', maxWidth: '94%'
    });

    panel.innerHTML = `
        <h3 style="margin:0 0 8px 0;">Saisir le token Admin</h3>
        <p style="margin:0 0 12px 0;font-size:12px;color:#444">Collez ici votre ` + "jwtTokenAdmin" + ` et cliquez sur Enregistrer.</p>
        <textarea id="token-input" style="width:100%;height:90px;padding:8px;border:1px solid #ccc;border-radius:4px;"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
            <button id="token-save" style="background:#16a34a;color:#fff;padding:8px 12px;border:none;border-radius:4px;cursor:pointer">Enregistrer</button>
            <button id="token-cancel" style="background:#6b7280;color:#fff;padding:8px 12px;border:none;border-radius:4px;cursor:pointer">Fermer</button>
        </div>
    `;

    modal.appendChild(panel);
    document.body.appendChild(modal);

    btn.addEventListener('click', () => {
        modal.style.display = 'flex';
        document.getElementById('token-input').focus();
    });

    document.getElementById('token-cancel').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    document.getElementById('token-save').addEventListener('click', () => {
        const v = document.getElementById('token-input').value.trim();
        if (!v) return alert('Veuillez coller le token JWT.');
        localStorage.setItem('jwtTokenAdmin', v);
        modal.style.display = 'none';
        btn.remove();
        alert('Token enregistré. La page va se recharger.');
        window.location.reload();
    });

    // Allow paste with Ctrl+V when modal opened
    document.getElementById('token-input').addEventListener('paste', () => {
        setTimeout(() => document.getElementById('token-input').value = document.getElementById('token-input').value.trim(), 50);
    });
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
                <p><strong>${window.t('representative')} :</strong> ${c.representative_name || '-'}</p>
                <p><strong>${window.t('email')} :</strong> ${c.email || '-'}</p>
                <p><strong>${window.t('phone')} :</strong> ${c.phone_number || '-'}</p>
                <p><strong>${window.t('address')} :</strong> ${c.full_address || '-'}, ${c.city || '-'}, ${c.country || '-'}</p>
                <p><strong>${window.t('airport_code')} :</strong> ${c.airport_code || '-'}</p>
                <p><strong>${window.t('status')} :</strong> 
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
                    `https://assa-ac-duzn.onrender.com/api/companies/delete/${companyId}`,
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

        const res = await fetch('https://assa-ac-duzn.onrender.com/api/companies/all', {
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
// (moved into DOMContentLoaded to allow token paste UI first)
// --------------------------------------------------