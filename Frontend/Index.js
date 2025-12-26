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
    // 3. Fonctions utilitaires
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
        passwordInput.value = '';
        otpCodeInput.value = '';
        otpPasswordInput.value = '';
        otpPasswordGroup.style.display = 'none';

        actionButtonContainer.classList.remove('visible');
        mainTitle.textContent = 'Connexion';
        subTitle.textContent = 'Utilisez votre email pour vous connecter';
        emailInput.readOnly = false;
        currentRole = '';
        currentEmail = '';
        showSection(emailSection);
        emailInput.focus();
        inputGroups.forEach(({ input, group }) => checkFloatingState(input, group));
    }

    // ==========================
    // 4. Fetch avec cookies (MODIFIÉ)
    // ==========================
    async function fetchWithAuth(url, options = {}) {
        options.credentials = 'include';
        if (!options.headers) options.headers = {};
        options.headers['Content-Type'] = 'application/json';

        const res = await fetch(url, options);

        if (res.status === 401) throw new Error('Session expirée');
        if (res.status === 403) throw new Error('Accès interdit');

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || 'Erreur API');

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
            if (!res.ok) throw new Error(data.message || 'Erreur serveur');

            currentRole = data.role;
            passwordField.classList.remove('visible');
            actionButtonContainer.classList.remove('visible');
            otpPasswordGroup.style.display = 'none';
            emailInput.readOnly = true;

            if (data.role === 'admin' || data.role === 'supervisor') {
                passwordField.classList.add('visible');
                actionButtonContainer.classList.add('visible');
                mainButton.textContent = 'Se Connecter';
                mainTitle.textContent = 'Mot de passe';
                subTitle.textContent = `Veuillez entrer votre mot de passe, ${data.role}.`;
                passwordInput.focus();
            } else if (data.role === 'company') {
                if (!data.has_password) {
                    showSection(otpSection);
                    mainTitle.textContent = 'Validation OTP';
                    subTitle.textContent = 'Veuillez entrer le code OTP reçu par email.';
                    otpPasswordGroup.style.display = 'block';
                    otpPasswordInput.focus();
                    await requestOtp();
                } else {
                    passwordField.classList.add('visible');
                    actionButtonContainer.classList.add('visible');
                    mainButton.textContent = 'Se Connecter';
                    mainTitle.textContent = 'Mot de passe';
                    subTitle.textContent = 'Veuillez entrer votre mot de passe.';
                    passwordInput.focus();
                }
            } else {
                alert('Email non reconnu.');
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
    // 6. OTP
    // ==========================
    async function requestOtp() {
        await fetch(`${API_BASE}/api/companies/first-login-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: currentEmail })
        });
    }

    async function validateOtp() {
        const otp = otpCodeInput.value.trim();
        const password = otpPasswordInput.value.trim();
        if (!otp || !password) return alert('Champs requis');

        if (isResetMode) {
            if (otp !== SIMULATED_RESET_OTP) return alert('OTP invalide');
            resetToInitialView();
            return;
        }

        await fetch(`${API_BASE}/api/companies/validate-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: currentEmail, otp, password })
        });

        window.location.href = 'AccueilCompagnie.html';
    }

    // ==========================
    // 7. Login standard
    // ==========================
    async function loginStandard() {
        await fetch(
            currentRole === 'company'
                ? `${API_BASE}/api/companies/login`
                : `${API_BASE}/api/admins/login`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: currentEmail, password: passwordInput.value })
            }
        );

        window.location.href =
            currentRole === 'company' ? 'AccueilCompagnie.html' : 'AccueilAdmin.html';
    }

    // ==========================
    // 7. Voir / cacher le mot de passe
    // ==========================
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';

            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

            // Toggle icône
            togglePasswordBtn.classList.toggle('fa-eye');
            togglePasswordBtn.classList.toggle('fa-eye-slash');
        });
    }

    // ==========================
    // 8. Events
    // ==========================
    emailInput.addEventListener('input', () => {
        clearTimeout(typingTimer);
        if (emailRegex.test(emailInput.value))
            typingTimer = setTimeout(() => verifyEmailOnServer(emailInput.value), doneTypingInterval);
    });

    mainButton.addEventListener('click', loginStandard);
    document.getElementById('validateOtpButton').addEventListener('click', validateOtp);
    resendOtpLink.addEventListener('click', e => { e.preventDefault(); requestOtp(); });
    backToEmail2.addEventListener('click', e => { e.preventDefault(); resetToInitialView(); });

    resetToInitialView();
});
