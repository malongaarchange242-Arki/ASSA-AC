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


document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = (() => {
        const origin = window.location.origin;
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return 'https://assa-ac-api.onrender.com';
        }
        return 'https://assa-ac-api.onrender.com';
    })();

    const operateurTokenKey = 'jwtTokenOperateur';
    const token = localStorage.getItem(operateurTokenKey);
    const role = token ? 'operateur' : null;
    const userEmail = localStorage.getItem('userEmailOperateur');

    if (!token || !role) {
        alert("Session opérateur manquante. Veuillez vous reconnecter.");
        window.location.href = 'Index.html';
        return;
    }

    // Affichage utilisateur
    const userNameSpan = document.getElementById('user-name');
    if (userNameSpan) {
        userNameSpan.innerHTML = `${userEmail || 'Utilisateur'} <i class="fas fa-caret-down"></i>`;
    }

    // =========================
    // REFRESH TOKEN
    // =========================
    // Operator pages do not perform admin/company refresh here
    async function refreshToken() {
        return false;
    }



    // =========================
    // FETCH AUTH
    // =========================
    async function fetchAuth(url, options = {}) {
        if (!token) throw new Error('Token manquant');

        options.headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        const res = await fetch(url, options);

        if (res.status === 401) {
            throw new Error('Session expirée');
        }

        if (res.status === 403) throw new Error('Accès interdit');

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Erreur HTTP ${res.status}`);

        return data;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('#table-activites tbody');
    const token = localStorage.getItem('jwtTokenOperateur');
    const apiBase = 'https://assa-ac-api.onrender.com';

    if (!tbody) return;

    const displayMessage = (message, retry = false) => {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = message;

        if (retry) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Réessayer';
            button.addEventListener('click', chargerActivites);
            cell.append(' ', button);
        }

        row.appendChild(cell);
        tbody.replaceChildren(row);
    };

    const chargerActivites = async () => {
        tbody.setAttribute('aria-busy', 'true');
        const loadingRow = document.createElement('tr');
        const loadingCell = document.createElement('td');
        loadingCell.colSpan = 4;
        loadingCell.textContent = 'Chargement des activités…';
        loadingRow.appendChild(loadingCell);
        tbody.replaceChildren(loadingRow);

        try {
            const response = await fetch(`${apiBase}/api/journal/operateur/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || `Erreur HTTP ${response.status}`);

            const activities = Array.isArray(result.activites) ? result.activites : [];
            if (!activities.length) {
                displayMessage('Aucune activité récente.');
                return;
            }

            const rows = activities.map(activity => {
                const row = document.createElement('tr');
                const date = activity.date_activite ? new Date(activity.date_activite) : null;
                const formattedDate = date && !Number.isNaN(date.getTime())
                    ? date.toLocaleString('fr-FR')
                    : '—';
                const cells = [
                    activity.type_activite || '—',
                    activity.description || '—',
                    activity.utilisateur || activity.utilisateur_email || '—',
                    formattedDate
                ];

                cells.forEach(value => {
                    const cell = document.createElement('td');
                    cell.textContent = String(value);
                    row.appendChild(cell);
                });
                return row;
            });

            tbody.replaceChildren(...rows);
        } catch (error) {
            console.error('Erreur récupération journal opérateur :', error);
            displayMessage(`Impossible de charger le journal d’activité : ${error.message}`, true);
        } finally {
            tbody.setAttribute('aria-busy', 'false');
        }
    };

    if (!token) {
        displayMessage('Session opérateur manquante. Veuillez vous reconnecter.');
        return;
    }

    chargerActivites();
});

document.addEventListener('DOMContentLoaded', () => {
    const aside = document.getElementById('facture-aside');
    const toggleAsideBtn = document.getElementById('toggleAside');

    if (toggleAsideBtn && aside) {
        toggleAsideBtn.addEventListener('click', async (e) => {
            e.preventDefault(); // empêche d’ouvrir une autre page

            try {
                const res = await fetch('enregistrefacture.html'); // ton fichier formulaire
                const html = await res.text();

                aside.innerHTML = html + `
          <div class="p-4 text-center">
            <button id="closeAside" class="icon-btn bg-red-600 text-white px-4 py-2 rounded-lg">
              <i class="fas fa-times"></i> Fermer
            </button>
          </div>
        `;
                aside.classList.add('open');

                // bouton fermer
                document.getElementById('closeAside').addEventListener('click', () => {
                    aside.classList.remove('open');
                });
            } catch (err) {
                aside.innerHTML = '<p class="p-4 text-red-600">Erreur de chargement du formulaire.</p>';
                aside.classList.add('open');
            }
        });
    }
});
