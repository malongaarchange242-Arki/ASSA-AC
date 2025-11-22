
document.addEventListener('DOMContentLoaded', () => {
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

    let currentEmail = '';
    let currentRole = '';
    let isChecking = false;
    let typingTimer;
    const doneTypingInterval = 300;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,4}$/;

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
    // 4. Fonction fetch avec Auth
    // ==========================
    async function fetchWithAuth(url, options = {}, isCompany = false) {
        const token = isCompany ? localStorage.getItem('jwtTokenCompany') : localStorage.getItem('jwtTokenAdmin');
        if (!options.headers) options.headers = {};
        options.headers['Content-Type'] = 'application/json';
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(url, options);
        if (res.status === 401) throw new Error('Token expiré, reconnectez-vous');
        if (res.status === 403) throw new Error('Accès interdit : permissions insuffisantes');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur API');
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
            const res = await fetch('https://assa-ac.onrender.com/api/auth/check-email', {
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
            console.error(err);
            alert(err.message);
            resetToInitialView();
        } finally {
            isChecking = false;
        }
    }

    // ==========================
    // 6. Demande OTP
    // ==========================
    async function requestOtp() {
        try {
            const res = await fetch('https://assa-ac.onrender.com/api/companies/otp/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Erreur serveur');
            alert(`Un code OTP a été envoyé à ${currentEmail}.`);
        } catch (err) {
            console.error(err);
            alert('Impossible d\'envoyer l\'OTP. Réessayez.');
            resetToInitialView();
        }
    }

    // ==========================
    // 7. Validation OTP
    // ==========================
    async function validateOtp() {
        const otp = otpCodeInput.value.trim();
        const password = otpPasswordInput.value.trim();
        if (!otp || !password) return alert('Veuillez remplir OTP et mot de passe.');

        try {
            const data = await fetchWithAuth(
                'https://assa-ac.onrender.com/api/companies/otp/validate',
                { method: 'POST', body: JSON.stringify({ email: currentEmail, otp, password }) }
            );

            // Stockage séparé company
            localStorage.setItem('jwtTokenCompany', data.token);
            localStorage.setItem('userRoleCompany', 'company');
            localStorage.setItem('userEmailCompany', currentEmail);
            localStorage.setItem('id_companie', data.id_companie);

            alert('OTP validé ! Mot de passe défini. Vous êtes connecté.');
            window.location.href = '/Frontend/Html/AccueilCompagnie.html';

        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    }

    // ==========================
    // 8. Connexion standard
    // ==========================
    async function loginStandard() {
        const password = passwordInput.value.trim();
        if (!password) return alert('Veuillez entrer votre mot de passe.');

        try {
            let url;
            let isCompany = false;
            if (currentRole === 'admin' || currentRole === 'supervisor') url = 'https://assa-ac.onrender.com/api/admins/login';
            else if (currentRole === 'company') { url = 'https://assa-ac.onrender.com/api/companies/login'; isCompany = true; }
            else return alert('Role inconnu.');

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Erreur serveur');

            if (isCompany) {
                localStorage.setItem('jwtTokenCompany', data.token);
                localStorage.setItem('userRoleCompany', 'company');
                localStorage.setItem('userEmailCompany', currentEmail);
                localStorage.setItem('id_companie', data.id_companie);
                window.location.href = '/Frontend/Html/AccueilCompagnie.html';
            } else {
                localStorage.setItem('jwtTokenAdmin', data.token);
                localStorage.setItem('userRoleAdmin', currentRole);
                localStorage.setItem('userEmailAdmin', currentEmail);
                localStorage.setItem('adminId', data.id);
                window.location.href = '/Frontend/Html/AccueilAdmin.html';
            }

            alert(`Connexion réussie ! Bienvenue ${currentRole}.`);

        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    }

    // ==========================
    // 9. Événements inputs
    // ==========================
    emailInput.addEventListener('input', () => {
        if (emailInput.readOnly) {
            if (emailInput.value.trim().length === 0) resetToInitialView();
            return;
        }
        clearTimeout(typingTimer);
        const emailValue = emailInput.value.trim();
        if (emailRegex.test(emailValue)) typingTimer = setTimeout(() => verifyEmailOnServer(emailValue), doneTypingInterval);
        else {
            passwordField.classList.remove('visible');
            actionButtonContainer.classList.remove('visible');
        }
    });

    mainButton.addEventListener('click', loginStandard);
    document.getElementById('validateOtpButton').addEventListener('click', validateOtp);
    resendOtpLink.addEventListener('click', e => { e.preventDefault(); if (currentEmail) requestOtp(); });
    backToEmail2.addEventListener('click', e => { e.preventDefault(); resetToInitialView(); });

    // ==========================
    // 10. Initialisation
    // ==========================
    resetToInitialView();
});