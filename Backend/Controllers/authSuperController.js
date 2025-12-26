import supabase from '../Config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logActivite } from '../Services/journalService.js';

/* =========================================================
   🔐 CONNEXION SUPER ADMIN PAR SECRET
   - 1ère connexion → création
   - connexions suivantes → login
========================================================= */
export const loginSuperAdminBySecret = async (req, res) => {
  try {
    const { superSecret, email, nom_complet } = req.body;

    /* 1️⃣ Vérification du secret système */
    if (!superSecret) {
      return res.status(400).json({ message: 'Mot de passe secret requis' });
    }

    if (superSecret !== process.env.SUPER_ADMIN_SECRET) {
      return res.status(403).json({ message: 'Mot de passe secret invalide' });
    }

    /* 2️⃣ Recherche du Super Admin existant */
    const { data: existingSuper, error: fetchError } = await supabase
      .from('admins')
      .select('*')
      .eq('profile', 'Super Admin')
      .maybeSingle();

    if (fetchError) throw fetchError;

    let superAdmin = existingSuper;

    /* 3️⃣ Première connexion → création du Super Admin */
    if (!superAdmin) {
      if (!email || !nom_complet) {
        return res.status(400).json({
          message: 'email et nom_complet requis pour la première connexion'
        });
      }

      const { data: createdAdmin, error: createError } = await supabase
        .from('admins')
        .insert([{
          nom_complet: nom_complet.trim(),
          email: email.toLowerCase().trim(),
          password: 'SYSTEM_ONLY',
          profile: 'Super Admin',
          status: 'Actif',
          archived: false,
          created_at: new Date(),
          updated_at: new Date()
        }])
        .select()
        .single();

      if (createError) throw createError;

      superAdmin = createdAdmin;

      await logActivite({
        type_activite: 'create',
        categorie: 'security',
        module: 'super-admin',
        description: 'Création initiale du Super Admin',
        id_admin: superAdmin.id,
        utilisateur_email: superAdmin.email
      });
    }

    /* 4️⃣ Vérifier si le Super Admin est actif */
    if (superAdmin.archived) {
      return res.status(403).json({ message: 'Super Admin désactivé' });
    }

    /* 5️⃣ Génération des tokens */
    const payload = {
      id: superAdmin.id,
      email: superAdmin.email,
      role: 'Super Admin',
      nom_complet: superAdmin.nom_complet,
      permissions: ['all_access']
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '12h'
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '7d'
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    /* 6️⃣ Journalisation connexion */
    await logActivite({
      type_activite: 'security',
      categorie: 'auth',
      module: 'super-admin-login',
      description: 'Connexion Super Admin par secret',
      id_admin: superAdmin.id,
      utilisateur_email: superAdmin.email
    });

    return res.json({
      message: 'Connexion Super Admin réussie',
      role: payload.role,
      permissions: payload.permissions
    });

  } catch (err) {
    console.error('Erreur loginSuperAdminBySecret :', err);
    return res.status(500).json({
      message: 'Erreur serveur',
      erreur: err.message
    });
  }
};


/* =========================================================
   👑 SUPER ADMIN → CRÉER ADMIN / SUPERVISEUR
========================================================= */
export const createAdminBySuperAdmin = async (req, res) => {
  try {
    /* 🔐 Sécurité absolue */
    if (req.user?.role !== 'Super Admin') {
      return res.status(403).json({
        message: 'Accès réservé au Super Admin'
      });
    }

    const {
      nom_complet,
      email,
      password,
      profile,     // 'Admin' | 'Superviseur'
      id_companie
    } = req.body;

    /* ✅ Profils autorisés */
    if (!['Admin', 'Superviseur'].includes(profile)) {
      return res.status(400).json({
        message: 'Profil invalide (Admin ou Superviseur uniquement)'
      });
    }

    /* ✅ Champs requis */
    if (!nom_complet || !email || !password) {
      return res.status(400).json({
        message: 'nom_complet, email et password sont requis'
      });
    }

    /* 🔍 Vérifier email unique */
    const { data: exists, error: existsError } = await supabase
      .from('admins')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existsError) throw existsError;

    if (exists) {
      return res.status(409).json({ message: 'Email déjà utilisé' });
    }

    /* 🔐 Hash du mot de passe */
    const hashedPassword = bcrypt.hashSync(password, 10);

    /* 🧱 Création Admin / Superviseur */
    const { data: newAdmin, error: insertError } = await supabase
      .from('admins')
      .insert([{
        nom_complet: nom_complet.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        profile,
        status: 'Actif',
        archived: false,
        id_companie: profile === 'Admin' ? (id_companie || null) : null,
        created_at: new Date(),
        updated_at: new Date()
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    /* 📝 Journalisation */
    await logActivite({
      type_activite: 'create',
      categorie: 'admin',
      module: 'auth-management',
      description: `${profile} créé par Super Admin`,
      reference: newAdmin.email,
      id_admin: req.user.id,
      utilisateur_nom: req.user.nom_complet,
      utilisateur_email: req.user.email
    });

    /* ✅ Réponse sécurisée */
    return res.status(201).json({
      message: `${profile} créé avec succès`,
      admin: {
        id: newAdmin.id,
        nom_complet: newAdmin.nom_complet,
        email: newAdmin.email,
        profile: newAdmin.profile,
        status: newAdmin.status,
        id_companie: newAdmin.id_companie
      }
    });

  } catch (err) {
    console.error('Erreur createAdminBySuperAdmin :', err);
    return res.status(500).json({
      message: 'Erreur serveur',
      erreur: err.message
    });
  }
};

export const logoutSuperAdmin = async (req, res) => {
  try {
    const adminId = req.user.id;
    await supabase.from('admins').update({ status: 'Inactif' }).eq('id', adminId);
    res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'None', path: '/' });
    res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'None', path: '/' });
    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};
