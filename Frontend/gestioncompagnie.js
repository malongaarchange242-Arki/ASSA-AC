let allCompanies = []; // Stocke toutes les compagnies pour la recherche

document.addEventListener('DOMContentLoaded', async () => {
 // 1. Référence au bouton de bascule
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const companyFormDialog = document.getElementById('company-form-dialog');
    const companyFormFrame = document.getElementById('company-form-frame');

    document.getElementById('add-company-button')?.addEventListener('click', () => showCompanyForm());
    companyFormDialog?.querySelector('.company-form-dialog-close')?.addEventListener('click', closeCompanyForm);
    companyFormDialog?.addEventListener('click', event => {
        if (event.target === companyFormDialog) closeCompanyForm();
    });
    companyFormDialog?.addEventListener('close', () => {
        if (companyFormFrame) companyFormFrame.src = 'about:blank';
    });
    window.addEventListener('message', event => {
        if (
            event.origin !== window.location.origin ||
            event.source !== companyFormFrame?.contentWindow ||
            !['company-saved', 'company-close'].includes(event.data?.type)
        ) {
            return;
        }

        closeCompanyForm();
        if (event.data.type === 'company-saved') fetchCompanies();
    });

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

function showCompanyForm(companyId = '') {
    const dialog = document.getElementById('company-form-dialog');
    const frame = document.getElementById('company-form-frame');
    if (!dialog || !frame) return;

    const formUrl = new URL('enregistrecompagnie.html', window.location.href);
    formUrl.searchParams.set('modal', '1');
    if (companyId) formUrl.searchParams.set('id', companyId);

    document.getElementById('company-form-dialog-title').textContent = companyId
        ? 'Modifier une compagnie'
        : 'Ajouter une compagnie';
    frame.src = formUrl.href;
    dialog.showModal();
}

function closeCompanyForm() {
    const dialog = document.getElementById('company-form-dialog');
    if (dialog?.open) dialog.close();
}


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
    const value = typeof logoUrl === 'string' ? logoUrl.trim() : '';
    if (!value) return '';
    if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value;
    const filename = value.replace(/^logos\//i, '').replace(/^\/+/, '');
    const encodedFilename = filename.split('/').map(encodeURIComponent).join('/');
    return `https://ulmwuzpjfbkxkkvdzaoi.supabase.co/storage/v1/object/public/company-logos/${encodedFilename}`;
}

function createCompanyLogoFallback(companyName) {
    const name = companyName?.trim() || 'Compagnie';
    const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const fallback = document.createElement('span');
    fallback.className = 'company-logo-fallback';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', `Logo indisponible pour ${name}`);
    fallback.textContent = initials || '?';
    return fallback;
}

// --------------------------------------------------
// Affichage des compagnies dans le tableau
// --------------------------------------------------
function renderCompanies(companies) {
    const container = document.querySelector('.company-table-body');
    container.innerHTML = '';

    if (!companies.length) {
        const row = document.createElement('tr');
        row.innerHTML = '<td class="table-message" colspan="8">Aucune compagnie trouvée.</td>';
        container.appendChild(row);
        return;
    }

    companies.forEach(c => {
        const status = c.status ? c.status.trim() : 'Inactif';
        const statusClass = status.toLowerCase() === 'actif' ? 'active' : 'inactive';

        const row = document.createElement('tr');
        row.className = `company-row status-${statusClass}`;
        row.dataset.id = c.id;

        const companyCell = document.createElement('td');
        companyCell.className = 'company-name-cell';
        const companyIdentity = document.createElement('div');
        companyIdentity.className = 'company-identity';
        const companyNameValue = c.company_name || 'Compagnie';
        const logoUrl = buildLogoUrl(c.logo_url || c.logo);
        if (logoUrl) {
            const logo = document.createElement('img');
            logo.src = logoUrl;
            logo.alt = `Logo ${companyNameValue}`;
            logo.addEventListener('error', () => {
                logo.replaceWith(createCompanyLogoFallback(companyNameValue));
            }, { once: true });
            companyIdentity.appendChild(logo);
        } else {
            companyIdentity.appendChild(createCompanyLogoFallback(companyNameValue));
        }

        const companyDetails = document.createElement('div');
        companyDetails.className = 'company-identity-details';
        const companyName = document.createElement('span');
        companyName.className = 'company-name';
        companyName.textContent = c.company_name || '-';
        const companyId = document.createElement('span');
        companyId.className = 'company-id';
        companyId.textContent = `#${c.id || '-'}`;
        companyDetails.append(companyName, companyId);
        companyIdentity.appendChild(companyDetails);
        companyCell.appendChild(companyIdentity);
        row.appendChild(companyCell);

        const address = [c.full_address, c.city, c.country].filter(Boolean).join(', ') || '-';
        [
            c.representative_name || '-',
            c.email || '-',
            c.phone_number || '-',
            address,
            c.airport_code || '-'
        ].forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });

        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge ${statusClass}`;
        statusBadge.textContent = status;
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        const actionsCell = document.createElement('td');
        actionsCell.className = 'company-actions-cell';
        const actions = document.createElement('div');
        actions.className = 'company-actions';
        [
            { title: 'Modifier', icon: 'fa-edit' },
            { title: 'Supprimer', icon: 'fa-trash' }
        ].forEach(({ title, icon }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.title = title;
            button.setAttribute('aria-label', `${title} ${companyName.textContent}`);
            const buttonIcon = document.createElement('i');
            buttonIcon.className = `fas ${icon}`;
            buttonIcon.setAttribute('aria-hidden', 'true');
            button.appendChild(buttonIcon);
            actions.appendChild(button);
        });
        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);
        container.appendChild(row);
    });

    attachCompanyRowEvents();
}

// --------------------------------------------------
// Événements Modifier / Supprimer
// --------------------------------------------------
function attachCompanyRowEvents() {
    document.querySelectorAll('.company-row').forEach(row => {
        const companyId = row.dataset.id;
        const token = getToken();

        // Modifier
        row.querySelector('button[title="Modifier"]').addEventListener('click', () => {
            showCompanyForm(companyId);
        });

        // Supprimer (sécurisé)
        // Supprimer une compagnie (définitif)
        row.querySelector('button[title="Supprimer"]').addEventListener('click', async () => {

            if (!confirm('⚠️ Voulez-vous vraiment SUPPRIMER définitivement cette compagnie ?\nCette action est irréversible.')) {
                return;
            }

            try {
                const res = await fetch(
                    `http://localhost:5002/api/companies/delete/${companyId}`,
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

                // ✅ Retirer la ligne du tableau
                row.remove();

                // ✅ Mettre à jour la liste globale
                allCompanies = allCompanies.filter(c => c.id.toString() !== companyId);
                if (!document.querySelector('.company-row')) {
                    renderCompanies([]);
                }

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
    const container = document.querySelector('.company-table-body');
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = Array.from({ length: 4 }, () => `
        <tr class="admin-skeleton-row">
            ${Array.from({ length: 8 }, () => '<td><span class="admin-skeleton admin-skeleton-block"></span></td>').join('')}
        </tr>
    `).join('');

    try {
        const token = getToken();

        const res = await fetch('http://localhost:5002/api/companies/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`Erreur ${res.status} : ${res.statusText}`);

        const json = await res.json();
        allCompanies = json.companies || []; 
        container.setAttribute('aria-busy', 'false');
        renderCompanies(allCompanies);

        // Applique le filtre si une recherche était en cours (utile après l'actualisation)
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim() !== '') {
            filterCompanies(searchInput.value.trim());
        }

    } catch (err) {
        container.setAttribute('aria-busy', 'false');
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.className = 'table-message table-error';
        cell.colSpan = 8;
        cell.append(`Erreur lors du chargement : ${err.message} `);
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'btn-refresh';
        retryButton.textContent = 'Réessayer';
        retryButton.addEventListener('click', fetchCompanies);
        cell.appendChild(retryButton);
        row.appendChild(cell);
        container.replaceChildren(row);
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