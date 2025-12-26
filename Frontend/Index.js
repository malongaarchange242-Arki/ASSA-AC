document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION API ---
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

    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const toggleOtpPasswordBtn = document.getElementById('toggleOtpPasswordBtn');

    let currentEmail = '';
    let currentRole = '';
    let isChecking = false;
    let typingTimer;
    const doneTypingInterval = 300;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,4}$/;

    // ==========================
    // 2. Gestion Effet Flottant
    // ==========================
    function checkFloatingState(input, group) {
        if (!input || !group) return;
        if (input.value.length > 0 || document.activeElement === input) {
            group.classList.add('floating');
        } else {
            group.classList.remove('floating');
        }
    }

    const inputGroups = [
        { input: emailInput, group: document.getElementById('emailInputGroup') },
        { input: passwordInput, group: document.getElementById('passwordInputGroup') },
        { input: otpCodeInput, group: document.getElementById('otpInputGroup') },
        { input: otpPasswordInput, group: otpPasswordGroup }
    ];

    inputGroups.forEach(({ input, group }) => {
        if (input && group) {
            input.addEventListener('focus', () => checkFloatingState(input, group));
            input.addEventListener('blur', () => checkFloatingState(input, group));
            input.addEventListener('input', () => checkFloatingState(input, group));
            checkFloatingState(input, group);
        }
    });

    // ==========================
    // 3. Gestion Visibilité Mot de Passe
    // ==========================
    function setupPasswordToggle(button, input) {
        if (button && input) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const isPw = input.getAttribute('type') === 'password';
                input.setAttribute('type', isPw ? 'text' : 'password');
                
                const icon = button.querySelector('i') || button;
                if (icon) {
                    icon.classList.toggle('fa-eye');
                    icon.classList.toggle('fa-eye-slash');
                }
            });
        }
    }

    setupPasswordToggle(togglePasswordBtn, passwordInput);
    setupPasswordToggle(toggleOtpPasswordBtn, otpPasswordInput);

    // ==========================
    // 4. Utilitaires UI & Sections
    // ==========================
    function showSection(sectionToShow) {
        allSections.forEach(section => section.classList.remove('visible'));
        setTimeout(() => sectionToShow.classList.add('visible'), 10);
    }

    function resetToInitialView() {
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
        
        inputGroups.forEach(({input, group}) => checkFloatingState(input, group));
    }

    // ==========================
    // 5. Appels API avec Alertes
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
            emailInput.readOnly = true;

            // ALERTE : Succès de la vérification email
            alert(`✅ Email validé : Compte ${currentRole} détecté.`);

            if (data.role === 'admin' || data.role === 'supervisor') {
                passwordField.classList.add('visible');
                actionButtonContainer.classList.add('visible');
                passwordInput.focus();
            } else if (data.role === 'company') {
                if (!data.has_password) {
                    // ALERTE : Première connexion compagnie
                    alert("🔑 Première connexion détectée. Un code OTP va vous être envoyé.");
                    showSection(otpSection);
                    otpPasswordGroup.style.display = 'block';
                    await requestOtp();
                } else {
                    passwordField.classList.add('visible');
                    actionButtonContainer.classList.add('visible');
                    passwordInput.focus();
                }
            }
        } catch (err) {
            // ALERTE : Erreur email
            alert(`❌ Erreur : ${err.message}`);
            resetToInitialView();
        } finally {
            isChecking = false;
        }
    }

    async function requestOtp() {
        try {
            const res = await fetch(`${API_BASE}/api/companies/first-login-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail }),
                credentials: 'include'
            });
            if (res.ok) {
                // ALERTE : Succès envoi OTP
                alert(`📧 Code de sécurité envoyé à l'adresse : ${currentEmail}`);
            }
        } catch {
            alert('❌ Erreur lors de l’envoi du code OTP.');
        }
    }

    async function loginStandard() {
        if (!passwordInput.value) {
            alert("⚠️ Veuillez saisir votre mot de passe.");
            return;
        }

        try {
            const url = (currentRole === 'admin' || currentRole === 'supervisor')
                ? `${API_BASE}/api/admins/login`
                : `${API_BASE}/api/companies/login`;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: currentEmail, 
                    password: passwordInput.value 
                }),
                credentials: 'include'
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Email ou mot de passe incorrect');

            // ALERTE : Succès connexion
            alert("🎉 Connexion réussie ! Redirection en cours...");

            window.location.href = (currentRole === 'company')
                ? 'AccueilCompagnie.html'
                : 'AccueilAdmin.html';
        } catch (err) {
            // ALERTE : Erreur de connexion
            alert(`🚫 Échec de connexion : ${err.message}`);
        }
    }

    // ==========================
    // 6. Écouteurs d'événements
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

    // Initialisation
    resetToInitialView();
});