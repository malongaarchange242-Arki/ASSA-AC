document.addEventListener('DOMContentLoaded', () => {
    // ==========================
    // API BASE
    // ==========================
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002')
            ? origin
            : 'https://assa-ac-jyn4.onrender.com';
    })();

    // ==========================
    // DOM
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

    // ==========================
    // RESET / UI
    // ==========================
    function showSection(section) {
        allSections.forEach(s => s.classList.remove('visible'));
        setTimeout(() => section.classList.add('visible'), 10);
    }

    function resetToInitialView() {
        currentEmail = '';
        currentRole = '';
        isChecking = false;

        passwordField.classList.remove('visible');
        actionButtonContainer.classList.remove('visible');
        otpPasswordGroup.style.display = 'none';

        emailInput.readOnly = false;
        emailInput.value = '';
        passwordInput.value = '';
        otpCodeInput.value = '';
        otpPasswordInput.value = '';

        mainTitle.textContent = 'Connexion';
        subTitle.textContent = 'Utilisez votre email pour vous connecter';

        showSection(emailSection);
        emailInput.focus();
    }

    // ==========================
    // ROLE NORMALIZATION
    // ==========================
    function normalizeRole(role) {
        if (!role) return null;

        return role
            .toString()
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '');
    }

    // ==========================
    // CHECK EMAIL
    // ==========================
    async function verifyEmailOnServer(email) {
        if (isChecking) return;
        if (!emailRegex.test(email)) return;

        isChecking = true;
        currentEmail = email;

        try {
            const res = await fetch(`${API_BASE}/api/auth/check-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                credentials: 'include' // 🍪
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Erreur serveur');

            const role = normalizeRole(data.role);
            currentRole = role;

            emailInput.readOnly = true;

            passwordField.classList.remove('visible');
            actionButtonContainer.classList.remove('visible');
            otpPasswordGroup.style.display = 'none';

            // ==========================
            // ROLE HANDLING
            // ==========================
            if (role === 'admin' || role === 'superadmin' || role === 'superviseur' || role === 'supervisor') {
                passwordField.classList.add('visible');
                actionButtonContainer.classList.add('visible');
                mainTitle.textContent = 'Mot de passe';
                subTitle.textContent = 'Veuillez entrer votre mot de passe.';
                passwordInput.focus();
                return;
            }

            if (role === 'company') {
                if (!data.has_password) {
                    showSection(otpSection);
                    otpPasswordGroup.style.display = 'block';
                    await requestOtp();
                } else {
                    passwordField.classList.add('visible');
                    actionButtonContainer.classList.add('visible');
                    passwordInput.focus();
                }
                return;
            }

            throw new Error(`Rôle "${data.role}" non pris en charge`);
        } catch (err) {
            alert(err.message);
            resetToInitialView();
        } finally {
            isChecking = false;
        }
    }

    // ==========================
    // OTP
    // ==========================
    async function requestOtp() {
        await fetch(`${API_BASE}/api/companies/first-login-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentEmail }),
            credentials: 'include'
        });
    }

    async function validateOtp() {
        const otp = otpCodeInput.value.trim();
        const password = otpPasswordInput.value.trim();

        if (!otp || !password) return alert('Champs requis');

        const res = await fetch(`${API_BASE}/api/companies/validate-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentEmail, otp, password }),
            credentials: 'include'
        });

        const data = await res.json();
        if (!res.ok) return alert(data.message);

        window.location.href = 'AccueilCompagnie.html';
    }

    // ==========================
    // LOGIN (COOKIE-BASED)
    // ==========================
    async function loginStandard() {
        const password = passwordInput.value.trim();
        if (!password) return alert('Mot de passe requis');

        let url;
        if (['admin', 'superadmin', 'superviseur', 'supervisor'].includes(currentRole)) {
            url = `${API_BASE}/api/admins/login`;
        } else if (currentRole === 'company') {
            url = `${API_BASE}/api/companies/login`;
        } else {
            return alert('Rôle inconnu');
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentEmail, password }),
            credentials: 'include' // 🍪 COOKIE AUTH
        });

        const data = await res.json();
        if (!res.ok) return alert(data.message);

        window.location.href =
            currentRole === 'company'
                ? 'AccueilCompagnie.html'
                : 'AccueilAdmin.html';
    }

    // ==========================
    // EVENTS
    // ==========================
    emailInput.addEventListener('input', () => {
        clearTimeout(typingTimer);
        const value = emailInput.value.trim();
        if (emailRegex.test(value)) {
            typingTimer = setTimeout(() => verifyEmailOnServer(value), doneTypingInterval);
        }
    });

    mainButton.addEventListener('click', loginStandard);
    document.getElementById('validateOtpButton')?.addEventListener('click', validateOtp);
    resendOtpLink?.addEventListener('click', e => { e.preventDefault(); requestOtp(); });
    backToEmail2?.addEventListener('click', e => { e.preventDefault(); resetToInitialView(); });

    resetToInitialView();
});
