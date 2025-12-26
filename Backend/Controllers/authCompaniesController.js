// controllers/authCompaniesController.js
import jwt from 'jsonwebtoken';
import supabase from '../Config/db.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import {
  archiveCompanyService,
  restoreCompanyService,
  createArchive
} from '../Services/archiveService.js';
import { logActivite } from '../Services/journalService.js'; // ✅ AJOUT ICI



// ----------------- Configuration Nodemailer -----------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true', // true pour SSL (465), false pour STARTTLS (587)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
const isSmtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);

// Vérification SMTP au démarrage
transporter.verify((err, success) => {
  if (err) {
    console.error("SMTP non fonctionnel :", err.message);
  } else {
    console.log(" SMTP prêt : connexion réussie");
  }
});

// ----------------- Génération OTP / mot de passe -----------------
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateTempPassword = () => Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100);

const sendFirstLoginEmail = async (to, otp, tempPassword) => {
  try {
    const info = await transporter.sendMail({
      from: `"UniverseSearch" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Première connexion - ASSA-AC',
      text: `Bonjour,\n\nVotre code OTP : ${otp}\nMot de passe temporaire : ${tempPassword}\nValable 10 minutes.\n\nMerci.`
    });

    console.log("📧 Email envoyé avec succès :", info);
    return { success: true, info };

  } catch (err) {
    console.error("❌ ERREUR SMTP :");
    console.error("Message :", err.message);
    console.error("Code :", err.code);
    console.error("Complet :", err);

    return { success: false, error: err };
  }
};



// ----------------- OTP première connexion -----------------
export const requestFirstLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }

    const { data: companies, error } = await supabase
      .from("companies")
      .select("*")
      .eq("email", email)
      .limit(1);

    if (error) {
      return res.status(500).json({ message: "Erreur serveur", erreur: error.message });
    }

    if (!companies?.length) {
      return res.status(404).json({ message: "Compagnie introuvable" });
    }

    const company = companies[0];

    // Génération OTP
    const otp = generateOtp();
    const otp_hash = await bcrypt.hash(otp, 10);
    const otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

    await supabase
      .from("companies")
      .update({
        otp: otp_hash,
        otp_expiry,
        status: "Inactif"
      })
      .eq("id", company.id);

    if (isSmtpConfigured()) {
      await sendFirstLoginEmail(email, otp);
    }

    await logActivite({
      module: "Système",
      type_activite: "system",
      categorie: "Sécurité",
      description: `OTP de première connexion généré pour ${company.company_name}`,
      id_companie: company.id
    });

    return res.json({ message: "OTP envoyé avec succès" });

  } catch (err) {
    console.error("requestFirstLoginOtp:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// ----------------- Valider OTP et définir mot de passe -----------------
export const validateOtpAndSetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ message: "Email, OTP et mot de passe requis" });
    }

    const { data: companies, error } = await supabase
      .from("companies")
      .select("*")
      .eq("email", email)
      .limit(1);

    if (error || !companies?.length) {
      return res.status(404).json({ message: "Compagnie introuvable" });
    }

    const company = companies[0];

    if (!company.otp) {
      return res.status(400).json({ message: "OTP non défini" });
    }

    if (new Date(company.otp_expiry) < new Date()) {
      return res.status(400).json({ message: "OTP expiré" });
    }

    const otpOk = await bcrypt.compare(otp, company.otp);
    if (!otpOk) {
      return res.status(400).json({ message: "OTP incorrect" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await supabase
      .from("companies")
      .update({
        password_hash,
        otp: null,
        otp_expiry: null,
        status: "Actif",
        last_login: new Date()
      })
      .eq("id", company.id);

    return res.json({ message: "Mot de passe défini avec succès" });

  } catch (err) {
    console.error("validateOtpAndSetPassword:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// ----------------- LOGIN COMPAGNIE -----------------
export const loginCompany = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !company) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    if (!company.password_hash) {
      return res.status(401).json({
        message: 'Veuillez d\'abord définir votre mot de passe.'
      });
    }

    const passwordOk = await bcrypt.compare(password, company.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // ======================
    // PAYLOAD JWT
    // ======================
    const payload = {
      id: company.id,
      email: company.email,
      role: 'company',
      company_name: company.company_name,
      id_companie: company.id
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '12h'
    });

    const refreshToken = jwt.sign(
      { id: company.id, role: 'company' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // ======================
    // COOKIE CONFIG (LOCAL + PROD)
    // ======================
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,                   // ❗ false en local
      sameSite: isProd ? 'None' : 'Lax', // ❗ Lax en local
      path: '/',
      maxAge: 12 * 60 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'None' : 'Lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // ======================
    // LOG & LAST LOGIN
    // ======================
    await supabase
      .from('companies')
      .update({ last_login: new Date() })
      .eq('id', company.id);

    await logActivite({
      type_activite: 'security',
      categorie: 'auth',
      module: 'company-login',
      description: 'Connexion de la compagnie',
      id_companie: company.id,
      utilisateur_email: company.email
    });

    return res.json({
      message: 'Connexion réussie',
      id_companie: company.id,
      company_name: company.company_name
    });

  } catch (err) {
    console.error('Erreur loginCompany :', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};


// ----------------- Profil de la compagnie -----------------
export const me = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    // ADMIN / SUPERVISOR → juste infos token
    if (req.user.role !== 'company') {
      return res.json({
        message: 'Profil utilisateur',
        user: req.user
      });
    }

    // COMPANY → infos complètes
    const { data, error } = await supabase
      .from('companies')
      .select(`
        id,
        company_name,
        representative_name,
        email,
        phone_number,
        full_address,
        country,
        city,
        airport_code,
        logo_url,
        status,
        created_at
      `)
      .eq('id', req.user.id_companie)
      .single();

    if (error) {
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    return res.json({
      message: 'Profil compagnie',
      user: req.user,
      company: data
    });

  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ----------------- REFRESH TOKEN COMPAGNIE -----------------
export const refreshTokenCompany = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token manquant' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Refresh token expiré' });
      }
      return res.status(401).json({ message: 'Refresh token invalide' });
    }

    const companyId = decoded.id;
    const { data: company, error } = await supabase
      .from('companies')
      .select('id, email, company_name')
      .eq('id', companyId)
      .single();

    if (error || !company) {
      return res.status(404).json({ message: 'Compagnie introuvable' });
    }

    const payload = {
      id: company.id,
      email: company.email,
      role: 'company',
      company_name: company.company_name,
      id_companie: company.id
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000
    });

    return res.json({ message: 'Token rafraîchi' });

  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

export const logoutCompany = async (req, res) => {
  try {
    await supabase
      .from('companies')
      .update({ status: 'Inactif' })
      .eq('id', req.user.id_companie);

    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/'
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/'
    });

    return res.json({ message: 'Déconnexion réussie' });

  } catch (err) {
    console.error('logoutCompany error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ----------------- Lister toutes les compagnies -----------------
export const listCompanies = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('archived', false); // 🔥 FILTRE CRITIQUE

    if (error) {
      return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });
    }

    const companiesWithDefaults = data.map(company => ({
      ...company,
      status: company.status?.trim().toLowerCase() === 'actif' ? 'Actif' : 'Inactif',
      logo_url: company.logo_url || 'https://via.placeholder.com/60?text=Logo'
    }));

    res.json({ total: companiesWithDefaults.length, companies: companiesWithDefaults });

  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};


// ----------------- ARCHIVER une compagnie -----------------
export const archiveCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: companyData, error: findError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !companyData) return res.status(404).json({ message: 'Compagnie introuvable' });

    await archiveCompanyService(companyData, req.user.id);

    await logActivite({
      module: 'Compagnies',
      type_activite: 'archive',
      description: `Compagnie ${companyData.company_name} archivée`,
      id_admin: req.user?.id,
      id_companie: companyData.id
    });

    res.json({ message: 'Compagnie archivée avec succès', company: companyData });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

// ----------------- RESTAURER une compagnie -----------------
export const restoreCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: companyData, error: findError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !companyData) return res.status(404).json({ message: 'Compagnie introuvable' });

    await restoreCompanyService(companyData, req.user.id);

    await logActivite({
      module: 'Compagnies',
      type_activite: 'restore',
      description: `Compagnie ${companyData.company_name} restaurée`,
      id_admin: req.user?.id,
      id_companie: companyData.id
    });

    res.json({ message: 'Compagnie restaurée avec succès', company: companyData });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

// ----------------- Obtenir une compagnie par ID -----------------
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'ID de compagnie manquant' });
    }

    // Requête Supabase
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erreur Supabase getCompanyById:', error);
      return res.status(500).json({ message: 'Erreur lors de la récupération de la compagnie', erreur: error.message });
    }

    if (!company) {
      return res.status(404).json({ message: 'Compagnie introuvable' });
    }

    // Journaliser l'activité
    // try {
    //   await logActivite({
    //     module: 'Compagnies',
    //     type_activite: 'Consultation',
    //     description: `Consultation du profil de la compagnie ${company.company_name}`,
    //     id_admin: req.user?.id,
    //     id_companie: company.id
    //   });
    // } catch (logErr) {
    //   console.warn('Impossible de journaliser l’activité:', logErr.message);
    // }

    // Réponse
    res.status(200).json({ success: true, company });
  } catch (err) {
    console.error('Erreur getCompanyById:', err);
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};


export const updateCompanyInfo = async (req, res) => {
  try {
    console.log("📩 Requête reçue pour updateCompanyInfo");
    console.log("➡️ req.user :", req.user);
    console.log("➡️ req.body :", req.body);
    console.log("➡️ req.file :", req.file);

    if (!req.user) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    const companyId = req.user.id_companie;
    const { company_name, email, phone_number, full_address, status } = req.body;

    let publicLogoUrl = null;

    // =============================
    // 🔥 Upload direct vers Supabase
    // =============================
    if (req.file) {
      console.log("🖼️ Nouveau logo reçu :", req.file.originalname);

      const fileName = `company_${companyId}_${Date.now()}${path.extname(req.file.originalname)}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (uploadError) {
        console.error("❌ Erreur upload Supabase:", uploadError);
        return res.status(500).json({ message: "Erreur upload logo" });
      }

      publicLogoUrl = supabase.storage
        .from("company-logos")
        .getPublicUrl(fileName).data.publicUrl;

      console.log("🌍 URL publique du logo :", publicLogoUrl);
    }

    // =============================
    // 🔧 Champs à mettre à jour
    // =============================
    const updateFields = { updated_at: new Date() };

    if (company_name) updateFields.company_name = company_name;
    if (email) updateFields.email = email;
    if (phone_number) updateFields.phone_number = phone_number;
    if (full_address) updateFields.full_address = full_address;
    if (status) updateFields.status = status;
    if (publicLogoUrl) updateFields.logo_url = publicLogoUrl;

    console.log("📦 Champs envoyés à Supabase :", updateFields);

    // =============================
    // 💾 Mise à jour Supabase
    // =============================
    const { data, error } = await supabase
      .from("companies")
      .update(updateFields)
      .eq("id", companyId)
      .select()
      .single();

    if (error) {
      console.error("❌ Erreur Supabase :", error);
      return res.status(400).json({ message: "Échec de la mise à jour" });
    }

    return res.status(200).json({
      message: "Informations mises à jour avec succès",
      company: data
    });

  } catch (err) {
    console.error("🔥 Erreur serveur :", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};



// ----------------- Mettre à jour une compagnie -----------------
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      company_name,
      representative_name,
      phone_number,
      email,
      full_address,
      country,
      city,
      airport_code
    } = req.body;

    let newLogoUrl = null;

    // ================================
    // 1️⃣ SI UN LOGO A ÉTÉ ENVOYÉ
    // ================================
    if (req.file) {
      console.log("📥 Nouveau logo reçu :", req.file.originalname);

      const bucket = "company-logos";

      // Nom fixe = ID compagnie → permet d'écraser l’ancien
      const fileExt = req.file.originalname.split(".").pop();
      const filename = `${id}.${fileExt}`;

      // Upload dans Supabase
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(filename, req.file.buffer, {
          cacheControl: "0",
          upsert: true, // 🔥 remplace l’ancien logo
          contentType: req.file.mimetype,
        });

      if (uploadErr) {
        console.error("❌ SUPABASE UPLOAD ERROR :", uploadErr);
        return res.status(500).json({
          message: "Erreur upload logo",
          erreur: uploadErr.message,
        });
      }

      // Récupérer l’URL publique
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filename);

      // Anti-cache navigateur
      newLogoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      console.log("🌍 Nouveau logo URL =", newLogoUrl);
    }

    // ================================
    // 2️⃣ UPDATE DATABASE
    // ================================
    const { data: updatedCompany, error } = await supabase
      .from("companies")
      .update({
        company_name,
        representative_name,
        phone_number,
        email,
        full_address,
        country,
        city,
        airport_code,
        ...(newLogoUrl && { logo_url: newLogoUrl }),
      })
      .eq("id", id)
      .select();

    if (error) {
      console.error("❌ UPDATE ERROR :", error);
      return res.status(500).json({ message: "Erreur serveur", erreur: error.message });
    }

    if (!updatedCompany.length) {
      return res.status(404).json({ message: "Compagnie introuvable" });
    }

    // ================================
    // 3️⃣ LOG ACTIVITÉ
    // ================================
    await logActivite({
      module: 'Compagnies',
      type_activite: 'update',
      categorie: 'company',
      reference: updatedCompany[0].company_name,
      description: `Compagnie ${updatedCompany[0].company_name} mise à jour`,
      id_admin: req.user?.id || null,
      id_companie: updatedCompany[0].id,
      utilisateur_nom: req.user?.nom_complet || req.user?.email || 'Administrateur',
      utilisateur_email: req.user?.email || null
    });
    

    // ================================
    // 4️⃣ ARCHIVAGE
    // ================================
    await createArchive({
      type: "Mise à jour de compagnie",
      ref: crypto.randomUUID(),
      compagnie_id: updatedCompany[0].id,
      compagnie_nom: updatedCompany[0].company_name,
      statut: "Inactif",
      admin_id: req.user?.id,
      admin_nom: req.user?.nom_complet || req.user?.nom || req.user?.email
    });
    

    // ================================
    // 4️⃣ RÉPONSE API
    // ================================
    res.json({
      message: "Compagnie mise à jour avec succès",
      company: updatedCompany[0],
    });
  } catch (err) {
    console.error("⛔ ERROR updateCompany:", err);
    res.status(500).json({ message: "Erreur serveur", erreur: err.message });
  }
};

// ----------------- Supprimer une compagnie en toute sécurité -----------------
export const deleteCompanySafe = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'ID de compagnie manquant' });
    }

    // 🔍 Vérifier l'existence
    const { data: company, error: findError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !company) {
      return res.status(404).json({ message: 'Compagnie introuvable' });
    }

    // 1️⃣ Supprimer les factures liées
    const { error: deleteFacturesError } = await supabase
      .from('factures')
      .delete()
      .eq('id_companie', id);

    if (deleteFacturesError) throw deleteFacturesError;

    // 2️⃣ Supprimer les admins liés
    const { error: deleteAdminsError } = await supabase
      .from('admins')
      .delete()
      .eq('id_companie', id);

    if (deleteAdminsError) throw deleteAdminsError;

    // 3️⃣ Supprimer la compagnie
    const { error: deleteCompanyError } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (deleteCompanyError) throw deleteCompanyError;

    // 4️⃣ Journaliser la suppression
    await logActivite({
      module: 'Compagnies',
      type_activite: 'delete',
      categorie: 'Compagnie',
      description: `Suppression définitive de la compagnie ${company.company_name}`,
      id_admin: req.user?.id,
      id_companie: id
    });

    res.status(200).json({
      success: true,
      message: 'Compagnie supprimée définitivement'
    });

  } catch (err) {
    console.error('Erreur deleteCompanySafe:', err);
    res.status(500).json({
      message: 'Erreur serveur',
      erreur: err.message
    });
  }
};



export const updateCompanyPassword = async (req, res) => {
  try {
    console.log("🔍 TOKEN :", req.user);

    const companyId = req.user.id;   // ✅ Correction importante
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: "Champs manquants" });
    }

    // Lire la compagnie
    const { data: company, error } = await supabase
      .from("companies")
      .select("password_hash")
      .eq("id", companyId)
      .single();

    if (error || !company) {
      return res.status(404).json({ message: "Société introuvable" });
    }

    console.log("🔐 Mot de passe hash trouvé :", company.password_hash);

    // Vérifier le mot de passe actuel
    const valid = await bcrypt.compare(current_password, company.password_hash);

    if (!valid) {
      return res.status(401).json({ message: "Mot de passe incorrect" });
    }

    // Hacher le nouveau
    const newHash = await bcrypt.hash(new_password, 10);

    await supabase
      .from("companies")
      .update({ password_hash: newHash, updated_at: new Date() })
      .eq("id", companyId);

    return res.status(200).json({ message: "Mot de passe mis à jour avec succès" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
