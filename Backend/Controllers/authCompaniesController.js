// controllers/authCompaniesController.js
import jwt from 'jsonwebtoken';
import supabase from '../Config/db.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { logActivite } from '../Services/journalService.js'; // journal d'activité
import { archiveCompanyService, restoreCompanyService } from '../Services/archiveService.js'; // archivage

// ----------------- Configuration Multer (upload logo en mémoire) -----------------
const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format non autorisé'));
  }
}).single('logo_url');


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

    // Vérifier si la compagnie existe
    const { data: companies, error: findError } = await supabase
      .from("companies")
      .select("*")
      .eq("email", email);

    if (findError) {
      return res.status(500).json({
        message: "Erreur serveur (recherche compagnie)",
        erreur: findError.message,
      });
    }

    if (!companies?.length) {
      return res.status(404).json({ message: "Compagnie introuvable" });
    }

    const company = companies[0];

    // Génération OTP et mot de passe temporaire
    const otp = generateOtp();
    const tempPassword = generateTempPassword();
    const otp_hash = await bcrypt.hash(otp, 10);
    const password_hash = await bcrypt.hash(tempPassword, 10);
    const otp_expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Mise à jour dans la base
    const { data: updatedCompany, error: updateError } = await supabase
      .from("companies")
      .update({
        otp: otp_hash,
        otp_expiry,
        password_hash,
        status: "Inactif",
      })
      .eq("id", company.id)
      .select();

    if (updateError) {
      return res.status(500).json({
        message: "Erreur serveur (mise à jour OTP)",
        erreur: updateError.message,
      });
    }

    // Envoi de l'email
    let emailSent = false;

    if (isSmtpConfigured()) {
      try {
        emailSent = await sendFirstLoginEmail(email, otp, tempPassword);
      } catch (mailErr) {
        console.error("❌ Erreur d'envoi email :", mailErr.message);
      }
    } else {
      console.warn("⚠️ SMTP non configuré, email non envoyé.");
    }

    // Log activité
    await logActivite({
      module: "Système",
      type_activite: "create",
      description: `OTP généré pour ${company.company_name}`,
      id_companie: company.id,
    });

    return res.json({
      message: "OTP généré",
      email_sent: emailSent,
      company: updatedCompany[0],
    });

  } catch (err) {
    console.error("❌ ERREUR requestFirstLoginOtp :", err.message);
    return res.status(500).json({
      message: "Erreur serveur",
      erreur: err.message,
    });
  }
};


// ----------------- Valider OTP et définir mot de passe -----------------
export const validateOtpAndSetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) return res.status(400).json({ message: 'Email, OTP et mot de passe requis' });

    const { data: companies, error } = await supabase
      .from('companies')
      .select('*')
      .eq('email', email);

    if (error) return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });
    if (!companies?.length) return res.status(404).json({ message: 'Compagnie introuvable' });

    const company = companies[0];
    if (!company.otp) return res.status(400).json({ message: 'OTP non défini. Demandez un nouvel OTP.' });
    if (!await bcrypt.compare(otp, company.otp)) return res.status(400).json({ message: 'OTP incorrect' });
    if (!company.otp_expiry || new Date(company.otp_expiry) < new Date()) return res.status(400).json({ message: 'OTP expiré' });

    const password_hash = await bcrypt.hash(password, 10);

    const { data: updatedCompany, error: updateError } = await supabase
      .from('companies')
      .update({ password_hash, otp: null, otp_expiry: null, status: 'Actif', last_login: new Date() })
      .eq('id', company.id)
      .select();

    if (updateError) return res.status(500).json({ message: 'Erreur serveur', erreur: updateError.message });

    const token = jwt.sign({
      id: company.id,
      role: 'Company',
      id_companie: company.id,
      company_name: company.company_name,
      email: company.email,
      status: 'Actif'
    }, process.env.JWT_SECRET, { expiresIn: '12h' });

    await logActivite({
      module: 'Système',
      type_activite: 'update',
      description: `${company.company_name} a validé son OTP et défini un mot de passe`,
      id_companie: company.id
    });

    res.json({
      message: 'Mot de passe défini, connexion réussie',
      token,
      id_companie: company.id,
      company: { ...updatedCompany[0], password_hash: undefined, otp: undefined }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

// ----------------- Connexion -----------------
export const loginCompany = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });

    const { data: companies, error } = await supabase.from('companies').select('*').eq('email', email);
    if (error) return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });
    if (!companies?.length) return res.status(404).json({ message: 'Compagnie introuvable' });

    const company = companies[0];
    if (!await bcrypt.compare(password, company.password_hash)) return res.status(400).json({ message: 'Mot de passe incorrect' });

    await supabase.from('companies').update({ last_login: new Date() }).eq('id', company.id);

    const token = jwt.sign({
      id: company.id,
      role: 'Company',
      id_companie: company.id,
      company_name: company.company_name,
      email: company.email,
      status: company.status
    }, process.env.JWT_SECRET, { expiresIn: '12h' });

    await logActivite({
      module: 'Système',
      type_activite: 'system',
      description: `${company.company_name} s'est connecté`,
      id_companie: company.id
    });

    res.json({
      message: 'Connexion réussie',
      token,
      id_companie: company.id,
      company: { ...company, password_hash: undefined, otp: undefined }
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

// ----------------- Profil de la compagnie -----------------
export const me = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    const companyId = req.user.id_companie;

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
        created_at,
        updated_at
      `)
      .eq('id', companyId)
      .single();

    if (error) {
      return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });
    }

    return res.status(200).json({
      message: 'Profil compagnie',
      user: req.user,
      company: data
    });

  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};



// ----------------- Lister toutes les compagnies -----------------
export const listCompanies = async (req, res) => {
  try {
    const { data, error } = await supabase.from('companies').select('*');
    if (error) return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });

    const companiesWithDefaults = data.map(company => ({
      ...company,
      status: company.status?.trim().toLowerCase() === 'actif' ? 'Actif' : 'Inactif',
      logo_url: company.logo_url || 'https://via.placeholder.com/60?text=Logo'
    }));

    await logActivite({
      module: 'Compagnies',
      type_activite: 'system',
      description: `Liste des compagnies consultée`,
      id_admin: req.user?.id
    });

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
    try {
      await logActivite({
        module: 'Compagnies',
        type_activite: 'Consultation',
        description: `Consultation du profil de la compagnie ${company.company_name}`,
        id_admin: req.user?.id,
        id_companie: company.id
      });
    } catch (logErr) {
      console.warn('Impossible de journaliser l’activité:', logErr.message);
    }

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
    const { company_name, representative_name, phone_number, email, full_address, country, city, airport_code } = req.body;

    let logo_url = null;
    if (req.file) logo_url = `/uploads/${req.file.filename}`;

    const { data: updatedCompany, error } = await supabase
      .from('companies')
      .update({
        company_name,
        representative_name,
        phone_number,
        email,
        full_address,
        country,
        city,
        airport_code,
        ...(logo_url && { logo_url })
      })
      .eq('id', id)
      .select();

    if (error) return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });
    if (!updatedCompany || !updatedCompany.length) return res.status(404).json({ message: 'Compagnie introuvable' });

    await logActivite({
      module: 'Compagnies',
      type_activite: 'update',
      description: `Compagnie ${updatedCompany[0].company_name} mise à jour`,
      id_admin: req.user?.id,
      id_companie: updatedCompany[0].id
    });

    res.json({ message: 'Compagnie mise à jour avec succès', company: updatedCompany[0] });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

// ----------------- Supprimer une compagnie en toute sécurité -----------------
export const deleteCompanySafe = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) return res.status(400).json({ message: 'ID de compagnie manquant' });

    // Vérifier que la compagnie existe
    const { data: company, error: findError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !company) return res.status(404).json({ message: 'Compagnie introuvable' });

    // 1️⃣ Archiver les factures liées
    const { data: factures, error: facturesError } = await supabase
      .from('factures')
      .select('*')
      .eq('id_companie', id)
      .eq('archived', false);

    if (facturesError) throw facturesError;

    if (factures?.length) {
      const factureIds = factures.map(f => f.numero_facture);
      await supabase.from('factures').update({ archived: true, statut: 'Archivée' }).in('numero_facture', factureIds);
      await supabase.from('journal_activite').insert(
        factures.map(f => ({
          id_admin: req.user?.id,
          id_companie: id,
          type_activite: 'Archivage',
          categorie: 'Facture',
          reference: f.numero_facture,
          description: `Facture ${f.numero_facture} archivée avant archivage de la compagnie`
        }))
      );
    }

    // 2️⃣ Archiver les admins/utilisateurs liés
    const { data: admins, error: adminsError } = await supabase
      .from('admins')
      .select('*')
      .eq('id_companie', id)
      .eq('archived', false);

    if (adminsError) throw adminsError;

    if (admins?.length) {
      const adminIds = admins.map(a => a.id);
      await supabase.from('admins').update({ archived: true }).in('id', adminIds);
      await supabase.from('journal_activite').insert(
        admins.map(a => ({
          id_admin: req.user?.id,
          id_companie: id,
          type_activite: 'Archivage',
          categorie: 'Admin',
          reference: a.id,
          description: `Admin ${a.email} archivé avant archivage de la compagnie`
        }))
      );
    }

    // 3️⃣ Archiver la compagnie
    const { error: archiveError } = await supabase
      .from('companies')
      .update({ archived: true, status: 'Inactif' })
      .eq('id', id);

    if (archiveError) throw archiveError;

    // 4️⃣ Journaliser l’archivage
    await logActivite({
      module: 'Compagnies',
      type_activite: 'archive',
      description: `Compagnie ${company.company_name} archivée`,
      id_admin: req.user?.id,
      id_companie: id
    });

    res.status(200).json({ message: 'Compagnie archivée avec succès', company });

  } catch (err) {
    console.error('Erreur deleteCompanySafe:', err);
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
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
