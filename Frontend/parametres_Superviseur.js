document.addEventListener('DOMContentLoaded', () => {

    /* 1. GESTION DU MODE SOMBRE */
    const btnTheme = document.getElementById('toggleTheme');
    
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    };

    applyTheme(localStorage.getItem('theme'));

    btnTheme.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });

    /* 2. SWITCH ENTRE 2FA ET MOT DE PASSE */
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.security-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Retirer l'état actif
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Ajouter l'état actif
            tab.classList.add('active');
            const targetId = tab.id.replace('tab-', 'content-');
            document.getElementById(targetId).classList.add('active');
        });
    });

    /* 3. VISIBILITÉ DU MOT DE PASSE */
    const togglers = document.querySelectorAll('.toggle-pass');
    
    togglers.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetInput = document.getElementById(this.getAttribute('data-target'));
            
            if (targetInput.type === "password") {
                targetInput.type = "text";
                this.classList.replace("fa-eye", "fa-eye-slash");
            } else {
                targetInput.type = "password";
                this.classList.replace("fa-eye-slash", "fa-eye");
            }
        });
    });

    /* 4. PRÉVISUALISATION PHOTO DE PROFIL */
    const profileDisplay = document.getElementById('profileDisplay');

    /* ---------- LOAD SUPERVISEUR INFO ---------- */
    const fullNameInput = document.getElementById('fullName');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');

    // helper moved to module scope so both applyProfile and manual URL input can use it
    function resolveAvatarUrl(val) {
        if (!val) return null;
        if (typeof val === 'object') {
            if (val.url) return resolveAvatarUrl(val.url);
            if (val.path) return resolveAvatarUrl(val.path);
            // fallback to trying first string property
            for (const k of Object.keys(val)) {
                if (typeof val[k] === 'string') return resolveAvatarUrl(val[k]);
            }
            return null;
        }
        const s = String(val).trim();
        // reject suspicious identifiers like "superviseur:1" which are not valid URLs/paths
        if (s.includes(':') && !s.startsWith('http') && !s.startsWith('data:') && !s.startsWith('blob:') && !s.includes('://')) {
            console.warn('Ignored non-URL avatar value:', s);
            return null;
        }
        if (!s) return null;
        if (s.startsWith('http') || s.startsWith('data:') || s.startsWith('blob:')) return s;
        const origin = window.location && window.location.origin ? window.location.origin : (window.location.protocol + '//' + window.location.host);
        if (s.startsWith('/')) return origin + s;
        // common case: stored filename or uploads/whatever
        if (/^uploads\//i.test(s) || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(s)) return origin + '/' + s.replace(/^\//, '');
        return origin + '/uploads/' + s.replace(/^\//, '');
    }

    // try to discover an existing upload URL for identifiers like "superviseur:1"
    async function findExistingUploadForIdentifier(idString) {
        if (!idString) return null;
        const API_BASE = (() => { const origin = window.location.origin; return origin.includes(':5002') ? origin : 'https://assa-ac-duzn.onrender.com'; })();
        const m = String(idString).trim().match(/^([^:\/]+):(\d+)$/);
        if (!m) return null;
        const entity = m[1];
        const id = m[2];
        const candidates = [
            `/uploads/${entity}/${id}`,
            `/uploads/${entity}/${id}.png`,
            `/uploads/${entity}/${id}.jpg`,
            `/uploads/${entity}/${id}.jpeg`,
            `/uploads/${entity}/${id}.webp`
        ];

        for (const path of candidates) {
            try {
                const res = await fetch(API_BASE + path, { method: 'HEAD' });
                if (res.ok) return API_BASE + path;
            } catch (e) {
                // ignore network/CORS errors, continue to next candidate
            }
        }
        return null;
    }

    // defensive: if an image fails to load (404 etc), fallback to generated avatar
    profileDisplay && profileDisplay.addEventListener('error', function handleAvatarError() {
        const current = profileDisplay.src || '';
        if (current.includes('ui-avatars.com')) return; // already fallback
        console.warn('Avatar failed to load, falling back to generated avatar:', current);
        const name = (fullNameInput && fullNameInput.value) ? fullNameInput.value : 'Superviseur';
        const ua = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=128`;
        profileDisplay.src = ua;
        const topbarAvatar = document.querySelector('#topbarAvatarInitials');
        if (topbarAvatar) {
            topbarAvatar.style.backgroundImage = '';
            topbarAvatar.style.backgroundColor = '#2563eb';
            topbarAvatar.innerText = (name.split(' ').map(n => n[0] || '').slice(0,2).join('')).toUpperCase();
        }
    });

    async function loadSuperviseur() {
        // try token-based API fetch
        const token = localStorage.getItem('jwtTokenSuperviseur') || localStorage.getItem('jwtTokenAdmin') || localStorage.getItem('jwtToken');
        const API_BASE = (() => { const origin = window.location.origin; return origin.includes(':5002') ? origin : 'https://assa-ac-duzn.onrender.com'; })();

        if (token) {
            try {
                const res = await fetch(`${API_BASE}/api/superviseurs/me`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    await applyProfile(data);
                    return;
                }
            } catch (e) { console.warn('Erreur fetch superviseur:', e); }
        }

        // fallback: try localStorage keys
        const keys = ['userProfile','currentUser','user','profile','superviseur'];
        for (const k of keys) {
            try {
                const raw = localStorage.getItem(k);
                if (!raw) continue;
                const obj = JSON.parse(raw);
                await applyProfile(obj);
                return;
            } catch (e) { /* ignore */ }
        }
    }

    async function applyProfile(obj) {
        if (!obj) return;
        const name = obj.nom_complet || obj.name || obj.fullName || '';
        const phone = obj.telephone || obj.phone || obj.numero || '';
        const email = obj.email || '';

        // choose candidate fields commonly used
        const avatarCandidates = [
            obj.profile, obj.profile_image, obj.avatar, obj.photo, obj.image, obj.image_url, obj.picture, obj.profileUrl, obj.profileImage
        ];

        let avatarUrl = null;
        // first: try explicit candidates that resolve to usable URLs
        for (const c of avatarCandidates) {
            if (!c) continue;
            // if candidate looks like an identifier "entity:id", try to discover upload
            if (typeof c === 'string' && /^([^:\/]+):(\d+)$/.test(c)) {
                const found = await findExistingUploadForIdentifier(c);
                if (found) { avatarUrl = found; break; }
                // otherwise continue to next candidate
                continue;
            }
            const resolved = resolveAvatarUrl(c);
            if (resolved) { avatarUrl = resolved; break; }
        }

        if (fullNameInput) fullNameInput.value = name;
        if (phoneInput) phoneInput.value = phone;
        if (emailInput) emailInput.value = email;

        const topbarAvatar = document.querySelector('#topbarAvatarInitials');

        if (avatarUrl) {
            profileDisplay.src = avatarUrl;
            if (topbarAvatar) {
                topbarAvatar.style.backgroundImage = `url(${avatarUrl})`;
                topbarAvatar.style.backgroundSize = 'cover';
                topbarAvatar.innerText = '';
            }
        } else if (name) {
            const ua = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=128`;
            profileDisplay.src = ua;
            if (topbarAvatar) {
                topbarAvatar.style.backgroundImage = '';
                topbarAvatar.style.backgroundColor = '#2563eb';
                topbarAvatar.innerText = (name.split(' ').map(n => n[0] || '').slice(0,2).join('')).toUpperCase();
            }
        }
    }

    // start
    loadSuperviseur();

    /* ---------- UPDATE PROFILE BUTTON ---------- */
    const updateBtn = document.getElementById('updateProfileBtn');
    updateBtn && updateBtn.addEventListener('click', async () => {
        const originalText = updateBtn.innerText;
        try {
            updateBtn.disabled = true;
            updateBtn.innerText = 'Mise à jour en cours...';

            const token = localStorage.getItem('jwtTokenSuperviseur') || localStorage.getItem('jwtTokenAdmin') || localStorage.getItem('jwtToken');
            const API_BASE = (() => { const origin = window.location.origin; return origin.includes(':5002') ? origin : 'https://assa-ac-duzn.onrender.com'; })();

            const payload = {
                nom_complet: fullNameInput ? fullNameInput.value.trim() : undefined,
                telephone: phoneInput ? phoneInput.value.trim() : undefined,
                email: emailInput ? emailInput.value.trim() : undefined
            };

            const res = await fetch(`${API_BASE}/api/superviseurs/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                await applyProfile(data);
                updateBtn.innerText = 'Profil mis à jour';
                setTimeout(() => { updateBtn.innerText = originalText; }, 1500);
            } else {
                let msg = await res.text();
                try { msg = JSON.parse(msg).message || msg; } catch(e){}
                console.warn('Update failed', res.status, msg);
                updateBtn.innerText = 'Erreur — réessayer';
                setTimeout(() => { updateBtn.innerText = originalText; }, 2000);
            }
        } catch (e) {
            console.error('Erreur mise à jour profil', e);
            updateBtn.innerText = 'Erreur — réessayer';
            setTimeout(() => { updateBtn.innerText = originalText; }, 2000);
        } finally {
            updateBtn.disabled = false;
        }
    });

    /* ---------- CHANGE PASSWORD HANDLER ---------- */
    const changeBtn = document.getElementById('changePasswordBtn');
    const oldPassInput = document.getElementById('oldPass');
    const newPassInput = document.getElementById('newPass');
    const confirmPassInput = document.getElementById('confirmPass');

    changeBtn && changeBtn.addEventListener('click', async () => {
        const oldPass = oldPassInput ? oldPassInput.value.trim() : '';
        const newPass = newPassInput ? newPassInput.value.trim() : '';
        const confirm = confirmPassInput ? confirmPassInput.value.trim() : '';

        if (!oldPass || !newPass || !confirm) {
            alert('Veuillez remplir tous les champs du mot de passe.');
            return;
        }
        if (newPass !== confirm) {
            alert('La confirmation ne correspond pas au nouveau mot de passe.');
            return;
        }
        if (newPass.length < 8) {
            alert('Le nouveau mot de passe doit contenir au moins 8 caractères.');
            return;
        }

        const originalText = changeBtn.innerText;
        const originalOpacity = changeBtn.style.opacity || '';
        const originalCursor = changeBtn.style.cursor || '';
        try {
            changeBtn.disabled = true;
            changeBtn.innerText = 'Changement en cours...';
            changeBtn.style.opacity = '0.6';
            changeBtn.style.cursor = 'not-allowed';
            changeBtn.setAttribute('aria-busy', 'true');

            const token = localStorage.getItem('jwtTokenSuperviseur') || localStorage.getItem('jwtTokenAdmin') || localStorage.getItem('jwtToken');
            const API_BASE = (() => { const origin = window.location.origin; return origin.includes(':5002') ? origin : 'https://assa-ac-duzn.onrender.com'; })();

            const res = await fetch(`${API_BASE}/api/superviseurs/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ password: newPass, old_password: oldPass })
            });

            if (res.ok) {
                const json = await res.json();
                alert('Mot de passe mis à jour avec succès.');
                // Clear fields
                if (oldPassInput) oldPassInput.value = '';
                if (newPassInput) newPassInput.value = '';
                if (confirmPassInput) confirmPassInput.value = '';
            } else {
                let msg = await res.text();
                try { msg = JSON.parse(msg).message || msg; } catch(e){}
                alert('Erreur mise à jour mot de passe: ' + msg);
            }
        } catch (e) {
            console.error('Erreur change password', e);
            alert('Erreur réseau lors de la mise à jour du mot de passe.');
        } finally {
            changeBtn.disabled = false;
            changeBtn.innerText = originalText;
            changeBtn.style.opacity = originalOpacity;
            changeBtn.style.cursor = originalCursor;
            changeBtn.removeAttribute('aria-busy');
        }
    });
});