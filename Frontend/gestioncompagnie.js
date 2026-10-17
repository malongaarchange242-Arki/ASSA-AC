let allCompanies = []; // Stocke toutes les compagnies pour la recherche
let selectedCompanyDetails = null;
let animateActiveCompanyRows = new URLSearchParams(window.location.search).get('highlight') === 'active';

function isActiveCompany(company) {
    const status = String(company.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    return status === 'actif' || status === 'active';
}

document.addEventListener('DOMContentLoaded', async () => {
 // 1. Référence au bouton de bascule
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const companyFormDialog = document.getElementById('company-form-dialog');
    const companyFormFrame = document.getElementById('company-form-frame');
    const companyDetailsDialog = document.getElementById('company-details-dialog');
    const searchInput = document.getElementById('searchInput');

    document.getElementById('add-company-button')?.addEventListener('click', () => showCompanyForm());
    companyFormDialog?.querySelector('.company-form-dialog-close')?.addEventListener('click', closeCompanyForm);
    companyFormDialog?.addEventListener('click', event => {
        if (event.target === companyFormDialog) closeCompanyForm();
    });
    companyFormDialog?.addEventListener('close', () => {
        if (companyFormFrame) companyFormFrame.src = 'about:blank';
    });
    companyDetailsDialog?.querySelector('.company-details-close')?.addEventListener('click', () => companyDetailsDialog.close());
    companyDetailsDialog?.addEventListener('click', event => {
        if (event.target === companyDetailsDialog) companyDetailsDialog.close();
    });
    document.getElementById('company-messages-action')?.addEventListener('click', () => {
        const companyId = selectedCompanyDetails?.id_companie || selectedCompanyDetails?.id;
        if (companyId) localStorage.setItem('id_companie', String(companyId));
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

    function updateThemeToggleLabel() {
        if (!themeToggle) return;
        const label = body.classList.contains('dark-mode')
            ? t('theme_toggle_light')
            : t('theme_toggle_dark');
        themeToggle.title = label;
        themeToggle.setAttribute('aria-label', label);
    }

    window.addEventListener('app-language-change', () => {
        updateThemeToggleLabel();
        const dialogTitle = document.getElementById('company-form-dialog-title');
        if (dialogTitle) {
            dialogTitle.textContent = companyFormDialog?.dataset.companyId
                ? t('company_edit_dialog')
                : t('company_add_dialog');
        }
        if (searchInput) filterCompanies(searchInput.value);
        if (companyDetailsDialog?.open && selectedCompanyDetails) renderCompanyDetails(selectedCompanyDetails);

        const tokenButton = document.getElementById('token-setter-btn');
        if (tokenButton) tokenButton.textContent = t('token_paste_button');
        const tokenTitle = document.getElementById('token-dialog-title');
        if (tokenTitle) tokenTitle.textContent = t('token_dialog_title');
        const tokenInstructions = document.getElementById('token-dialog-instructions');
        if (tokenInstructions) tokenInstructions.textContent = t('token_dialog_instructions');
        const tokenInput = document.getElementById('token-input');
        if (tokenInput) tokenInput.placeholder = t('token_placeholder');
        const tokenSave = document.getElementById('token-save');
        if (tokenSave) tokenSave.textContent = t('token_save');
        const tokenCancel = document.getElementById('token-cancel');
        if (tokenCancel) tokenCancel.textContent = t('token_cancel');
    });

    // 2. Fonction pour appliquer le thème
    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            if (themeToggle) {
                // Icône Soleil pour passer au mode clair
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            }
        } else {
            body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
            if (themeToggle) {
                // Icône Lune pour passer au mode sombre
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }
        }
        updateThemeToggleLabel();
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

    dialog.dataset.companyId = companyId;
    document.getElementById('company-form-dialog-title').textContent = companyId
        ? t('company_edit_dialog')
        : t('company_add_dialog');
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
        alert(t('token_missing'));
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
    btn.textContent = t('token_paste_button');
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
        <h3 id="token-dialog-title" style="margin:0 0 8px 0;">${t('token_dialog_title')}</h3>
        <p id="token-dialog-instructions" style="margin:0 0 12px 0;font-size:12px;color:#444">${t('token_dialog_instructions')}</p>
        <textarea id="token-input" placeholder="${t('token_placeholder')}" style="width:100%;height:90px;padding:8px;border:1px solid #ccc;border-radius:4px;"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
            <button id="token-save" style="background:#16a34a;color:#fff;padding:8px 12px;border:none;border-radius:4px;cursor:pointer">${t('token_save')}</button>
            <button id="token-cancel" style="background:#6b7280;color:#fff;padding:8px 12px;border:none;border-radius:4px;cursor:pointer">${t('token_cancel')}</button>
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
        if (!v) return alert(t('token_required'));
        localStorage.setItem('jwtTokenAdmin', v);
        modal.style.display = 'none';
        btn.remove();
        alert(t('token_saved'));
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
    const name = companyName?.trim() || t('company_no_name');
    const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const fallback = document.createElement('span');
    fallback.className = 'company-logo-fallback';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', t('company_logo_unavailable').replace('{company}', name));
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
        const cell = document.createElement('td');
        cell.className = 'table-message';
        cell.colSpan = 8;
        cell.textContent = t('company_no_results');
        row.appendChild(cell);
        container.appendChild(row);
        return;
    }

    companies.forEach(c => {
        const status = typeof c.status === 'string' && c.status.trim() ? c.status.trim() : 'Inactif';
        const normalizedStatus = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const statusTranslations = {
            actif: 'company_status_active',
            active: 'company_status_active',
            inactif: 'company_status_inactive',
            inactive: 'company_status_inactive',
            enattente: 'company_status_pending',
            pending: 'company_status_pending',
            suspendu: 'company_status_suspended',
            suspended: 'company_status_suspended'
        };
        const statusClass = ['actif', 'active'].includes(normalizedStatus) ? 'active' : 'inactive';
        const translatedStatus = statusTranslations[normalizedStatus]
            ? t(statusTranslations[normalizedStatus])
            : status;

        const row = document.createElement('tr');
        row.className = `company-row status-${statusClass}`;
        if (isActiveCompany(c)) {
            row.classList.add('company-active-highlight');
            if (animateActiveCompanyRows) row.classList.add('animate-active-highlight');
        }
        row.dataset.id = c.id;
        row.tabIndex = 0;
        const companyNameValue = c.company_name || t('company_no_name');
        row.setAttribute('aria-label', `${t('view_company_details')}: ${companyNameValue}`);

        const companyCell = document.createElement('td');
        companyCell.className = 'company-name-cell';
        const companyIdentity = document.createElement('div');
        companyIdentity.className = 'company-identity';
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
        statusBadge.textContent = translatedStatus;
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        const actionsCell = document.createElement('td');
        actionsCell.className = 'company-actions-cell';
        const actions = document.createElement('div');
        actions.className = 'company-actions';
        [
            { action: 'edit', title: t('company_edit'), icon: 'fa-edit' },
            { action: 'delete', title: t('company_delete'), icon: 'fa-trash' }
        ].forEach(({ action, title, icon }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.title = title;
            button.dataset.companyAction = action;
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

        const openDetails = () => {
            const company = allCompanies.find(item => String(item.id) === String(companyId));
            if (company) showCompanyDetails(company);
        };

        row.addEventListener('click', event => {
            if (event.target.closest('button, a')) return;
            openDetails();
        });
        row.addEventListener('keydown', event => {
            if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button, a')) {
                event.preventDefault();
                openDetails();
            }
        });

        // Modifier
        row.querySelector('button[data-company-action="edit"]').addEventListener('click', () => {
            showCompanyForm(companyId);
        });

        // Supprimer (sécurisé)
        // Supprimer une compagnie (définitif)
        row.querySelector('button[data-company-action="delete"]').addEventListener('click', async () => {

            if (!confirm(t('company_confirm_delete'))) {
                return;
            }

            try {
                const res = await fetch(
                    `https://assa-ac-api.onrender.com/api/companies/delete/${companyId}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );

                const result = await res.json();

                if (!res.ok) {
                    throw new Error(result.message || 'Company deletion failed');
                }

                // ✅ Message succès
                alert(t('company_delete_success').replace('{company}', result.company?.company_name || ''));

                // ✅ Retirer la ligne du tableau
                row.remove();

                // ✅ Mettre à jour la liste globale
                allCompanies = allCompanies.filter(c => c.id.toString() !== companyId);
                if (!document.querySelector('.company-row')) {
                    renderCompanies([]);
                }

            } catch (err) {
                console.error(err);
                alert(t('company_delete_error'));
            }
        });

    });
}

function showCompanyDetails(company) {
    const dialog = document.getElementById('company-details-dialog');
    if (!dialog) return;
    selectedCompanyDetails = company;
    renderCompanyDetails(company);
    dialog.showModal();
}

function renderCompanyDetails(company) {
    const name = String(company.company_name || t('company_no_name'));
    const title = document.getElementById('company-details-title');
    const id = document.getElementById('company-details-id');
    const logoContainer = document.getElementById('company-details-logo');
    const statusElement = document.getElementById('company-details-status');
    const contactDetails = document.getElementById('company-contact-details');
    const locationDetails = document.getElementById('company-location-details');
    const accountDetails = document.getElementById('company-account-details');
    if (!title || !id || !logoContainer || !statusElement || !contactDetails || !locationDetails || !accountDetails) return;

    title.textContent = name;
    id.textContent = company.id || company.id_companie ? String(company.id || company.id_companie) : '—';
    logoContainer.replaceChildren();

    const logoUrl = buildLogoUrl(company.logo_url || company.logo);
    if (logoUrl) {
        const logo = document.createElement('img');
        logo.src = logoUrl;
        logo.alt = t('company_logo_unavailable').replace('{company}', name);
        logo.addEventListener('error', () => {
            logo.replaceWith(createCompanyLogoFallback(name));
        }, { once: true });
        logoContainer.appendChild(logo);
    } else {
        logoContainer.appendChild(createCompanyLogoFallback(name));
    }

    const rawStatus = String(company.status || '').trim();
    const normalizedStatus = rawStatus.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s_-]/g, '');
    const statusInfo = {
        actif: ['company_status_active', 'active'],
        active: ['company_status_active', 'active'],
        inactif: ['company_status_inactive', 'inactive'],
        inactive: ['company_status_inactive', 'inactive'],
        enattente: ['company_status_pending', 'pending'],
        pending: ['company_status_pending', 'pending'],
        suspendu: ['company_status_suspended', 'suspended'],
        suspended: ['company_status_suspended', 'suspended']
    }[normalizedStatus];
    statusElement.replaceChildren();
    statusElement.hidden = !rawStatus;
    if (rawStatus) {
        statusElement.className = `company-details-status${statusInfo ? ` is-${statusInfo[1]}` : ''}`;
        statusElement.textContent = statusInfo ? t(statusInfo[0]) : rawStatus;
    }

    const displayValue = (rawValue, isDate = false) => {
        if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') return '—';
        const value = String(rawValue).trim();
        if (isDate) {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleString(localStorage.getItem('lang') === 'en' ? 'en-US' : 'fr-FR');
            }
        }
        return value;
    };

    const appendContactField = (labelKey, rawValue, iconClass) => {
        const item = document.createElement('div');
        item.className = 'company-details-contact-item';
        const icon = document.createElement('i');
        icon.className = `fas ${iconClass}`;
        icon.setAttribute('aria-hidden', 'true');
        const iconWrap = document.createElement('span');
        iconWrap.className = 'company-details-field-icon';
        iconWrap.appendChild(icon);
        const text = document.createElement('div');
        text.className = 'company-details-contact-copy';
        const label = document.createElement('span');
        label.className = 'company-details-field-label';
        label.textContent = t(labelKey);
        const value = document.createElement('span');
        value.className = 'company-details-field-value';
        value.textContent = displayValue(rawValue);
        text.append(label, value);
        item.append(iconWrap, text);
        contactDetails.appendChild(item);
    };

    const appendRow = (container, labelKey, rawValue, options = {}) => {
        const term = document.createElement('dt');
        term.textContent = t(labelKey);
        const description = document.createElement('dd');
        if (options.status) {
            const badge = document.createElement('span');
            badge.className = `company-details-status${statusInfo ? ` is-${statusInfo[1]}` : ''}`;
            badge.textContent = rawStatus ? (statusInfo ? t(statusInfo[0]) : rawStatus) : '—';
            description.appendChild(badge);
        } else {
            description.textContent = displayValue(rawValue, options.date);
        }
        container.append(term, description);
    };

    contactDetails.replaceChildren();
    appendContactField('representative', company.representative_name, 'fa-user');
    appendContactField('email', company.email, 'fa-envelope');
    appendContactField('phone', company.phone_number, 'fa-phone');

    locationDetails.replaceChildren();
    appendRow(locationDetails, 'address', company.full_address);
    appendRow(locationDetails, 'company_city', company.city);
    appendRow(locationDetails, 'company_country', company.country);
    appendRow(locationDetails, 'airport_code', company.airport_code);

    accountDetails.replaceChildren();
    appendRow(accountDetails, 'status', company.status, { status: true });
    appendRow(accountDetails, 'company_created_at', company.created_at, { date: true });
    appendRow(accountDetails, 'company_updated_at', company.updated_at, { date: true });
    appendRow(accountDetails, 'company_last_login', company.last_login, { date: true });

    const contactAction = document.getElementById('company-contact-action');
    const invoicesAction = document.getElementById('company-invoices-action');
    const messagesAction = document.getElementById('company-messages-action');
    const actionsCard = document.getElementById('company-quick-actions-card');
    const email = String(company.email || '').trim();
    if (contactAction) {
        contactAction.hidden = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!contactAction.hidden) contactAction.href = `mailto:${email}`;
    }
    if (invoicesAction) {
        invoicesAction.hidden = !name || name === t('company_no_name');
        if (!invoicesAction.hidden) {
            const invoiceUrl = new URL('factureAdmin.html', window.location.href);
            invoiceUrl.searchParams.set('company', name);
            invoicesAction.href = invoiceUrl.href;
        }
    }
    if (messagesAction) {
        const companyId = company.id_companie || company.id;
        messagesAction.hidden = !companyId || company.status !== 'Actif';
        if (companyId) messagesAction.href = 'messagerieAdmin.html';
    }
    if (actionsCard) {
        actionsCard.hidden = [contactAction, invoicesAction, messagesAction]
            .every(action => !action || action.hidden);
    }
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

        const res = await fetch('https://assa-ac-api.onrender.com/api/companies/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(String(res.status));

        const json = await res.json();
        allCompanies = json.companies || []; 
        container.setAttribute('aria-busy', 'false');
        renderCompanies(allCompanies);
        const shouldHighlightActiveCompanies = animateActiveCompanyRows;
        animateActiveCompanyRows = false;
        if (shouldHighlightActiveCompanies) {
            const firstActiveRow = container.querySelector('.company-active-highlight');
            if (firstActiveRow) {
                firstActiveRow.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                    block: 'center'
                });
            }
        }

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
        const status = /^\d{3}$/.test(err.message) ? err.message : '';
        cell.append(status
            ? t('company_load_error').replace('{status}', status) + ' '
            : `${t('company_load_failed')} `);
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'btn-refresh';
        retryButton.textContent = t('company_retry');
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