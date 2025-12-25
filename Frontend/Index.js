document.addEventListener('DOMContentLoaded', () => {
    // --- CONSERVATION DES VRAIES ROUTES POUR LE RESTE DU FLUX ---
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002') ? origin : 'https://assa-ac-jyn4.onrender.com';
    })();

    // ==========================
    // 1. Éléments du DOM
    // ==========================
    const emailSection = document.getElementById('emailSection');
    const otpSection = document.getElementById('otpSection');
    const allSections = [emailSection, otpSection];

    const emailInput = document.getElementById('emailInput');
    const passwordField = document.getElementById('passwordField');
    const passwordInput = document.getElementById('passwordInput');
    const otpCodeInput = document.getElementById('otpCode');
    const otpPasswordInput = document.getElementById('otpPasswordInput');
    const otpPasswordGroup = document.getElementById('otpPasswordInputGroup');

    const mainButton = document.getElementById('mainButton');
    const actionButtonContainer = document.getElementById('actionButtonContainer');

    const mainTitle = document.getElementById('mainTitle');
    const subTitle = document.getElementById('subTitle');

    const backToEmail2 = document.getElementById('backToEmail2');
    const resendOtpLink = document.getElementById('resendOtpLink');

    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    let currentEmail = '';
    let currentRole = '';
    let isChecking = false;
    let typingTimer;
    const doneTypingInterval = 300;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,4}$/;

    // ==========================
    // MODE RESET (SIMULATION)
    // ==========================
    let isResetMode = false;
    const SIMULATED_RESET_OTP = '123456';

    // ==========================
    // 2. Effet flottant inputs
    // ==========================
    function checkFloatingState(input, group) {
        if (input.value.length > 0 || document.activeElement === input) group.classList.add('floating');
        else group.classList.remove('floating');
    }

    const inputGroups = [
        { input: emailInput, group: document.getElementById('emailInputGroup') },
        { input: passwordInput, group: document.getElementById('passwordInputGroup') },
        { input: otpCodeInput, group: document.getElementById('otpInputGroup') },
        { input: otpPasswordInput, group: otpPasswordGroup }
    ];

    inputGroups.forEach(({ input, group }) => {
        input.addEventListener('focus', () => checkFloatingState(input, group));
        input.addEventListener('blur', () => checkFloatingState(input, group));
        input.addEventListener('input', () => checkFloatingState(input, group));
        checkFloatingState(input, group);
    });

    // ==========================
    // 3. Utilitaires UI
    // ==========================
    function showSection(sectionToShow) {
        allSections.forEach(section => section.classList.remove('visible'));
        setTimeout(() => sectionToShow.classList.add('visible'), 10);
    }

    function resetToInitialView() {
        isResetMode = false;

        document.getElementById('otpSection').querySelector('h2').textContent = 'Vérification de sécurité';
        document.getElementById('otpSection').querySelector('p').textContent =
            'Un code d\'accès unique vous a été envoyé par email.';

        otpPasswordInput.placeholder = 'Définir un mot de passe';

        passwordField.classList.remove('visible');
        otpPasswordGroup.style.display = 'none';

        passwordInput.value = '';
        otpCodeInput.value = '';
        otpPasswordInput.value = '';

        actionButtonContainer.classList.remove('visible');
        mainTitle.textContent = 'Connexion';
        subTitle.textContent = 'Utilisez votre email pour vous connecter';

        emailInput.readOnly = false;
        currentRole = '';
        currentEmail = '';

        showSection(emailSection);
        emailInput.focus();
    }

    // ==========================
    // 4. FETCH AVEC COOKIE AUTH
    // ==========================
    async function fetchWithAuth(url, options = {}) {
        if (!options.headers) options.headers = {};
        options.headers['Content-Type'] = 'application/json';

        const res = await fetch(url, {
            ...options,
            credentials: 'include'
        });

        if (res.status === 401) throw new Error('Session expirée. Veuillez vous reconnecter.');
        if (res.status === 403) throw new Error('Accès refusé. Permissions insuffisantes.');

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || 'Erreur serveur');

        return data;
    }

    // ==========================
    // 5. Vérification email
    // ==========================
    async function verifyEmailOnServer(email) {
        if (isChecking) return;
        isChecking = true;
        currentEmail = email;

        try {
            const res = await fetch(`${API_BASE}/api/auth/check-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                credentials: 'include'
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Email non reconnu');

            currentRole = data.role;
            alert(`Email reconnu ✔️ Rôle détecté : ${currentRole}`);

            emailInput.readOnly = true;
            passwordField.classList.remove('visible');
            actionButtonContainer.classList.remove('visible');
            otpPasswordGroup.style.display = 'none';

            if (data.role === 'admin' || data.role === 'supervisor') {
                passwordField.classList.add('visible');
                actionButtonContainer.classList.add('visible');
                passwordInput.focus();
            } else if (data.role === 'company') {
                if (!data.has_password) {
                    alert('Premier accès détecté. Envoi du code OTP…');
                    showSection(otpSection);
                    otpPasswordGroup.style.display = 'block';
                    await requestOtp();
                } else {
                    passwordField.classList.add('visible');
                    actionButtonContainer.classList.add('visible');
                }
            } else {
                alert('Rôle inconnu.');
                resetToInitialView();
            }
        } catch (err) {
            alert(err.message);
            resetToInitialView();
        } finally {
            isChecking = false;
        }
    }

    // ==========================
    // 6. OTP (company)
    // ==========================
    async function requestOtp() {
        try {
            await fetch(`${API_BASE}/api/companies/first-login-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail }),
                credentials: 'include'
            });
            alert(`Code OTP envoyé à ${currentEmail}`);
        } catch {
            alert('Erreur lors de l’envoi du code OTP.');
            resetToInitialView();
        }
    }

    // ==========================
    // 7. LOGIN STANDARD
    // ==========================
    async function loginStandard() {
        try {
            const url =
                currentRole === 'admin' || currentRole === 'supervisor'
                    ? `${API_BASE}/api/admins/login`
                    : `${API_BASE}/api/companies/login`;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail, password: passwordInput.value }),
                credentials: 'include'
            });

            if (!res.ok) throw new Error('Email ou mot de passe incorrect');

            alert('Connexion réussie ✔️ Redirection en cours…');

            window.location.href =
                currentRole === 'company'
                    ? 'AccueilCompagnie.html'
                    : 'AccueilAdmin.html';
        } catch (err) {
            alert(err.message);
        }
    }

    // ==========================
    // EVENTS
    // ==========================
    emailInput.addEventListener('input', () => {
        clearTimeout(typingTimer);
        if (emailRegex.test(emailInput.value)) {
            typingTimer = setTimeout(
                () => verifyEmailOnServer(emailInput.value),
                doneTypingInterval
            );
        }
    });

    mainButton.addEventListener('click', loginStandard);

    resetToInitialView();
});
