document.addEventListener('DOMContentLoaded', () => {
    // --- CONSERVATION DES VRAIES ROUTES POUR LE RESTE DU FLUX ---
    const API_BASE = (() => {
        const origin = window.location.origin;
        return origin.includes(':5002') ? origin : 'http://localhost:5002';
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
    
    // DOM pour l'icône et le lien oublié
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    let currentEmail = '';
    let currentRole = '';
    let isChecking = false;
    let typingTimer;
    const doneTypingInterval = 300;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,4}$/;
    
    // ==========================
    // GESTION DU MODE RÉINITIALISATION ET SIMULATION
    // ==========================
    let isResetMode = false;
    const SIMULATED_RESET_OTP = '123456'; // CODE OTP FIXE POUR LA SIMULATION
    
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
        
        // Rétablit les titres par défaut de la section OTP
        // Correction de la cible H2 dans index.html
        document.getElementById('otpSection').querySelector('h2').textContent = 'Vérification de sécurité'; 
        document.getElementById('otpSection').querySelector('p').textContent = 'Un code d\'accès unique vous a été envoyé par email.';
        otpPasswordInput.placeholder = 'Définir un mot de passe'; 
        
        passwordField.classList.remove('visible');
        passwordInput.value = '';
        otpCodeInput.value = '';
        otpPasswordInput.value = '';
        
        // S'assure que le champ Mot de passe OTP est masqué lors du retour
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
    // 4. Fonction fetch avec Auth (Code original conservé)
    // ==========================
    async function fetchWithAuth(url, options = {}, isCompany = false) {
        const token = isCompany ? localStorage.getItem('jwtTokenCompany') : localStorage.getItem('jwtTokenAdmin');
        if (!options.headers) options.headers = {};
        options.headers['Content-Type'] = 'application/json';
        if (token) options.headers['Authorization'] = `Bearer ${token}`;
    
        const res = await fetch(url, options);
    
        if (res.status === 401) {
            throw new Error('Token expiré, reconnectez-vous');
        }
        if (res.status === 403) throw new Error('Accès interdit : permissions insuffisantes');
    
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error((data && data.message) ? data.message : 'Erreur API');
    
        return data;
    }
    
    // ==========================
    // 5. Vérification email (Logique d'affichage OTP Mot de Passe)
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
                    
                    // LIGNE CRUCIALE pour le Premier Login Compagnie:
                    otpPasswordGroup.style.display = 'block'; 
                    otpPasswordInput.placeholder = 'Définir un mot de passe'; 
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
            alert(err.message || 'Erreur lors de la vérification');
            resetToInitialView();
        } finally {
            isChecking = false;
        }
    }
    
    // ==========================
    // 5.b. SIMULATION : Demande OTP de Réinitialisation (Code original conservé)
    // ==========================
    async function initiatePasswordReset() {
        const email = emailInput.value.trim();
        
        if (!email || !emailRegex.test(email)) {
            return alert("Veuillez entrer une adresse email valide avant de cliquer sur 'Mot de passe oublié'.");
        }

        currentEmail = email; 
        
        // --- SIMULATION DU BACKEND (DÉBUT) ---
        await new Promise(resolve => setTimeout(resolve, 800)); 
        
        alert(` Un code de réinitialisation a été envoyé à ${currentEmail}.\nUtilisez le code : ${SIMULATED_RESET_OTP}`);
        

        // 3. Mise à jour de l'interface
        isResetMode = true; 
        
        emailSection.classList.remove('visible');
        passwordField.classList.remove('visible'); 
        actionButtonContainer.classList.remove('visible');
        showSection(otpSection);
        
        // Changer les textes pour la réinitialisation
        document.getElementById('otpSection').querySelector('h2').textContent = 'Réinitialisation du mot de passe';
        document.getElementById('otpSection').querySelector('p').textContent = `Entrez le code (${SIMULATED_RESET_OTP}) et votre nouveau mot de passe.`;
        
        // Afficher le champ pour le nouveau mot de passe (Même logique que le premier login)
        otpPasswordGroup.style.display = 'block';
        otpPasswordInput.placeholder = "Nouveau mot de passe";
        otpCodeInput.focus();
    }
    
    // ==========================
    // 6. Demande OTP (Premier Login Compagnie - Code original conservé)
    // ==========================
    async function requestOtp() {
        try {
            const res = await fetch(`${API_BASE}/api/companies/first-login-otp`, {
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
    // 7. Validation OTP (Gère Reset et Premier Login - Code original conservé)
    // ==========================
    async function validateOtp() {
        const otp = otpCodeInput.value.trim();
        const password = otpPasswordInput.value.trim();
        
        if (!otp || !password) return alert('Veuillez remplir le code OTP et le mot de passe.');
    
        try {
            if (isResetMode) {
                // --- SIMULATION DU BACKEND (DÉBUT) ---
                await new Promise(resolve => setTimeout(resolve, 800)); 
                
                if (otp !== SIMULATED_RESET_OTP) {
                    throw new Error('Code de réinitialisation invalide.');
                }
                if (password.length < 6) {
                    throw new Error('Le nouveau mot de passe est trop court.');
                }

                alert('Mot de passe modifié avec succès ! (Simulation)\nVeuillez vous reconnecter avec votre nouveau mot de passe.');
                resetToInitialView();
                return; 
                // --- SIMULATION DU BACKEND (FIN) ---
            } 
            
            // Logique du Premier Login Compagnie (vraie route)
            const url = `${API_BASE}/api/companies/validate-otp`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail, otp: otp, password: password })
            });
    
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error((data && data.message) ? data.message : 'Erreur serveur');
    
            // Logique de connexion Compagnie existante
            localStorage.setItem('jwtTokenCompany', data.token);
            localStorage.setItem('userRoleCompany', 'company');
            localStorage.setItem('userEmailCompany', currentEmail);
            localStorage.setItem('id_companie', data.id_companie);
    
            alert('OTP validé ! Mot de passe défini. Vous êtes connecté.');
            window.location.href = 'AccueilCompagnie.html';

        } catch (err) {
            console.error(err);
            alert(err.message || 'Erreur validation OTP');
        }
    }
    
    // ==========================
    // 8. Connexion standard (Code original conservé)
    // ==========================
    async function loginStandard() {
        const password = passwordInput.value.trim();
        if (!password) return alert('Veuillez entrer votre mot de passe.');
    
        try {
            let url;
            let isCompany = false;
            if (currentRole === 'admin' || currentRole === 'supervisor') url = `${API_BASE}/api/admins/login`;
            else if (currentRole === 'company') { url = `${API_BASE}/api/companies/login`; isCompany = true; }
            else return alert('Role inconnu.');
    
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentEmail, password })
            });
    
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error((data && data.message) ? data.message : 'Erreur serveur');
    
            if (isCompany) {
                localStorage.setItem('jwtTokenCompany', data.token);
                localStorage.setItem('userRoleCompany', 'company');
                localStorage.setItem('userEmailCompany', currentEmail);
                localStorage.setItem('id_companie', data.id_companie);
                window.location.href = 'AccueilCompagnie.html';
            } else {
                const adminToken = data.jwtTokenAdmin || data.token || data.accessToken || data.access_token;
                const adminRefresh = data.refreshTokenAdmin || data.refreshToken || data.refresh_token;
                if (adminToken) localStorage.setItem('jwtTokenAdmin', adminToken);
                if (adminRefresh) localStorage.setItem('refreshTokenAdmin', adminRefresh);
                localStorage.setItem('userRoleAdmin', currentRole);
                localStorage.setItem('userEmailAdmin', currentEmail);
                localStorage.setItem('adminId', data.adminId || data.id || data.adminId);
                window.location.href = 'AccueilAdmin.html';
            }
    
            alert(`Connexion réussie ! Bienvenue ${currentRole}.`);
        } catch (err) {
            console.error(err);
            alert(err.message || 'Erreur lors de la connexion');
        }
    }
    
    // ==========================
    // 9. Événements inputs et Logique de la Barre (Code original conservé)
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
    // AJOUT : Gestion Voir MDP & Oublié (Événements)
    // ==========================

    // 1. Logique pour l'icône "Oeil"
    if(togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            togglePasswordBtn.classList.toggle('fa-eye');
            togglePasswordBtn.classList.toggle('fa-eye-slash');
            
            if (type === 'text') {
                passwordInput.classList.add('password-visible');
            } else {
                passwordInput.classList.remove('password-visible');
            }
        });
    }

    // 2. Logique pour "Mot de passe oublié"
    if(forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            // NOUVEL APPEL à la fonction de réinitialisation
            initiatePasswordReset();
        });
    }
    
    // ==========================
    // 10. Initialisation (Code original conservé)
    // ==========================
    resetToInitialView();
});