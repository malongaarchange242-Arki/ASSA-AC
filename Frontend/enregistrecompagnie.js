// Liste d'aéroports Afrique (IATA)
const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');

const AFRICA_AIRPORTS = [
    { code: "DLA", city: "Douala", country: "Cameroun" },
    { code: "NSI", city: "Yaoundé", country: "Cameroun" },
    { code: "FIH", city: "Kinshasa", country: "RDC" },
    { code: "BZV", city: "Brazzaville", country: "Congo" },
    { code: "ABJ", city: "Abidjan", country: "Côte d’Ivoire" },
    { code: "CKY", city: "Conakry", country: "Guinée" },
    { code: "DKR", city: "Dakar", country: "Sénégal" },
    { code: "SSG", city: "Malabo", country: "Guinée équatoriale" },
    { code: "LOS", city: "Lagos", country: "Nigeria" },
    { code: "PNR", city: "Pointe-Noire", country: "Congo" },
    { code: "ADD", city: "Addis-Abeba", country: "Éthiopie" },
    { code: "CAI", city: "Le Caire", country: "Égypte" },
    { code: "CMN", city: "Casablanca", country: "Maroc" },
    { code: "TUN", city: "Tunis", country: "Tunisie" },
    { code: "JNB", city: "Johannesburg", country: "Afrique du Sud" },
    { code: "NDJ", city: "N’Djamena", country: "Tchad" },
    { code: "BGF", city: "Bangui", country: "République centrafricaine" }
];

const CITY_API_BASE = 'https://countriesnow.space/api/v0.1';
const CITY_API_COUNTRY_ALIASES = {
    BO: 'Bolivia',
    CI: 'Ivory Coast',
    KP: 'North Korea',
    KR: 'South Korea',
    LY: 'Libya',
    MD: 'Moldova',
    MK: 'Macedonia',
    TZ: 'Tanzania'
};

function normalizeCountryName(value) {
    return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
}

function normalizeCityName(value) {
    return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}

document.addEventListener('DOMContentLoaded', async () => {

        const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' });
        const countryCodesByName = new Map();
        const countryList = document.getElementById('country-options');
        COUNTRY_CODES
            .map(code => ({ code, name: countryNames.of(code) }))
            .sort((first, second) => first.name.localeCompare(second.name, 'fr'))
            .forEach(country => {
                const option = document.createElement('option');
                option.value = country.name;
                countryList.appendChild(option);
                countryCodesByName.set(normalizeCountryName(country.name), country.code);
            });

        const countryInput = document.getElementById('country');
        const cityInput = document.getElementById('city');
        const cityList = document.getElementById('city-options');
        const cityHint = document.getElementById('city-hint');
        const retryCityLoadButton = document.getElementById('retry-city-load');
        const cityCache = new Map();
        let countryCatalogPromise;
        let cityRequestController;
        let cityRequestId = 0;

        async function getApiCountryName(countryCode) {
            if (!countryCatalogPromise) {
                countryCatalogPromise = fetch(`${CITY_API_BASE}/countries/iso`)
                    .then(async response => {
                        if (!response.ok) throw new Error(`Erreur ${response.status} lors du chargement des pays.`);
                        const result = await response.json();
                        if (result.error || !Array.isArray(result.data)) {
                            throw new Error(result.msg || 'Le catalogue des pays est invalide.');
                        }
                        return new Map(result.data.map(country => [country.Iso2, country.name]));
                    }).catch(error => {
                        countryCatalogPromise = undefined;
                        throw error;
                    });
            }

            const apiCountryName = CITY_API_COUNTRY_ALIASES[countryCode] || (await countryCatalogPromise).get(countryCode);
            if (!apiCountryName) throw new Error('Aucune liste de villes n’est disponible pour ce pays.');
            return apiCountryName;
        }

        async function loadCitiesForCountry(countryName) {
            const requestId = ++cityRequestId;
            cityRequestController?.abort();

            const countryCode = countryCodesByName.get(normalizeCountryName(countryName));
            retryCityLoadButton.hidden = true;
            cityList.replaceChildren();

            if (!countryCode) {
                cityHint.textContent = 'Choisissez un pays dans la liste pour obtenir des suggestions de villes.';
                cityInput.setAttribute('aria-busy', 'false');
                return false;
            }

            const cachedCities = cityCache.get(countryCode);
            if (cachedCities) {
                addCityOptions(cachedCities, cityInput.value);
                cityHint.textContent = `${cachedCities.length.toLocaleString('fr')} villes disponibles. Saisissez des lettres pour filtrer les suggestions.`;
                cityInput.setAttribute('aria-busy', 'false');
                return true;
            }

            const controller = new AbortController();
            cityRequestController = controller;
            cityInput.setAttribute('aria-busy', 'true');
            cityHint.textContent = 'Chargement des villes…';

            try {
                const apiCountryName = await getApiCountryName(countryCode);
                const response = await fetch(`${CITY_API_BASE}/countries/cities`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ country: apiCountryName }),
                    signal: controller.signal
                });
                if (!response.ok) throw new Error(`Erreur ${response.status} lors du chargement des villes.`);

                const result = await response.json();
                if (result.error || !Array.isArray(result.data)) {
                    throw new Error(result.msg || 'La liste des villes reçue est invalide.');
                }

                const cities = [...new Set(result.data.filter(city => typeof city === 'string').map(city => city.trim()).filter(Boolean))]
                    .sort((first, second) => first.localeCompare(second, 'fr'));
                if (requestId !== cityRequestId) return false;

                cityCache.set(countryCode, cities);
                addCityOptions(cities, cityInput.value);
                cityHint.textContent = cities.length
                    ? `${cities.length.toLocaleString('fr')} villes disponibles. Saisissez des lettres pour filtrer les suggestions.`
                    : 'Aucune ville répertoriée pour ce pays. Vous pouvez saisir la ville manuellement.';
                return true;
            } catch (error) {
                if (error.name === 'AbortError' || requestId !== cityRequestId) return false;
                console.error('Impossible de charger les villes du pays sélectionné.', error);
                cityHint.textContent = 'Impossible de charger les suggestions. Vous pouvez saisir la ville manuellement.';
                retryCityLoadButton.hidden = false;
                return false;
            } finally {
                if (requestId === cityRequestId) cityInput.setAttribute('aria-busy', 'false');
            }
        }

        function addCityOptions(cities, query = '') {
            const normalizedQuery = normalizeCityName(query);
            const matchingCities = normalizedQuery
                ? cities.filter(city => normalizeCityName(city).startsWith(normalizedQuery))
                : cities;
            cityList.replaceChildren(...matchingCities.slice(0, 100).map(city => {
                const option = document.createElement('option');
                option.value = city;
                return option;
            }));

            if (normalizedQuery) {
                cityHint.textContent = matchingCities.length
                    ? matchingCities.length > 100
                        ? `100 suggestions affichées sur ${matchingCities.length.toLocaleString('fr')}.`
                        : `${matchingCities.length} suggestion${matchingCities.length === 1 ? '' : 's'}.`
                    : 'Aucune suggestion correspondante. Vous pouvez saisir la ville manuellement.';
            } else {
                cityHint.textContent = `${cities.length.toLocaleString('fr')} villes disponibles. Saisissez des lettres pour filtrer les suggestions.`;
            }
        }

        countryInput.addEventListener('change', () => {
            cityInput.value = '';
            loadCitiesForCountry(countryInput.value);
        });
        cityInput.addEventListener('input', () => {
            const countryCode = countryCodesByName.get(normalizeCountryName(countryInput.value));
            const cities = countryCode ? cityCache.get(countryCode) : undefined;
            if (cities) addCityOptions(cities, cityInput.value);
        });
        retryCityLoadButton.addEventListener('click', () => loadCitiesForCountry(countryInput.value));

        // Remplir automatiquement la liste des codes IATA
        const airportSelect = document.getElementById("airport-code");
        AFRICA_AIRPORTS.forEach(ap => {
            const option = document.createElement("option");
            option.value = ap.code;
            option.textContent = `${ap.code} — ${ap.city} (${ap.country})`;
            airportSelect.appendChild(option);
        });
    
    const API_BASE = 'https://assa-ac-api.onrender.com';
    const form = document.getElementById('company-registration-form');
    const saveButton = document.getElementById('save-button');
    const REDIRECT_DELAY_MS = 1000;
    const messageDiv = document.getElementById('form-message');

    function showMessage(message, type = 'info') {
        messageDiv.textContent = message;
        messageDiv.className = `company-form-message is-${type}`;
        messageDiv.hidden = false;
    }

    const token = localStorage.getItem('jwtTokenAdmin');
    if (!token) {
        alert('Vous devez être connecté !');
        window.location.href = 'login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get('id');
    const embeddedInManagement = urlParams.get('modal') === '1' && window.parent !== window;
    if (companyId) {
        document.querySelector('header h1').textContent = 'Modifier une Compagnie';
        saveButton.textContent = 'Modifier la Compagnie';
    }

    if (embeddedInManagement) {
        window.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                window.parent.postMessage({ type: 'company-close' }, window.location.origin);
            }
        });
    }

    document.getElementById('cancel-company-form')?.addEventListener('click', () => {
        if (embeddedInManagement) {
            window.parent.postMessage({ type: 'company-close' }, window.location.origin);
        } else {
            window.location.href = 'gestioncompagnie.html';
        }
    });

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
                await loadCitiesForCountry(data.country || '');
                form.city.value = data.city || '';
                form.airport_code.value = data.airport_code || '';
            } else {
                showMessage(result.message || 'Impossible de charger la compagnie', 'error');
            }
        } catch (err) {
            console.error(err);
            showMessage('Erreur serveur lors du chargement de la compagnie', 'error');
        }
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        saveButton.disabled = true;
        saveButton.textContent = companyId ? 'Modification en cours...' : 'Enregistrement en cours...';

        try {
            // 🔥 Création manuelle du FormData pour inclure le fichier correctement
            const formData = new FormData();
            formData.append('company_name', form.company_name.value.trim());
            formData.append('representative_name', form.representative_name.value.trim());
            formData.append('email', form.email.value.trim());
            formData.append('phone_number', form.phone_number.value.trim());
            formData.append('full_address', form.full_address.value.trim());
            formData.append('country', form.country.value.trim());
            formData.append('city', form.city.value.trim());
            formData.append('airport_code', form.airport_code.value.trim());

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

            showMessage(`Compagnie "${result.company.company_name}" ${companyId ? 'modifiée' : 'créée'} avec succès !`, 'success');
            if (embeddedInManagement) {
                setTimeout(() => window.parent.postMessage({ type: 'company-saved' }, window.location.origin), REDIRECT_DELAY_MS);
            } else {
                setTimeout(() => window.location.href = 'gestioncompagnie.html', REDIRECT_DELAY_MS);
            }

        } catch (err) {
            console.error('Erreur API:', err);
            showMessage('Impossible de contacter le serveur.', 'error');
            saveButton.disabled = false;
            saveButton.textContent = companyId ? 'Modifier la Compagnie' : 'Enregistrer la Compagnie';
        }
    });
});
