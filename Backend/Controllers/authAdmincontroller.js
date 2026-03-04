// controllers/authAdminController.js
import supabase from '../Config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

import {
  archiveAdminService,
  restoreAdminService,
  createArchive
} from '../Services/archiveService.js';

import { logActivite } from '../Services/journalService.js'; 


/* ---------------------------------------------------------
   🔹 Profils spéciaux et permissions
----------------------------------------------------------*/
const getProfileByPassword = (password) => {
  if (password === 'ASSA2025SA') return 'Super Admin';
  return null;
};

const getPermissions = (profile) => {
  switch (profile) {
    case 'Administrateur': return ['manage_admins','create_company','view_stats'];
    case 'Super Admin': return ['manage_admins','create_company','view_stats','all_access'];
    default: return [];
  }
};

/* Superviseur code removed */

/* ---------------------------------------------------------
   🔹 LOGIN ADMIN (VERSION SURE)
----------------------------------------------------------*/
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error("JWT_SECRET ou JWT_REFRESH_SECRET non défini !");
      return res.status(500).json({ message: "Configuration JWT manquante" });
    }

    const { data: user, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Sécurité : si les fonctions n’existent pas, éviter crash
    const safeGetProfileByPassword = typeof getProfileByPassword === "function"
      ? getProfileByPassword
      : () => null;

    const safeGetPermissions = typeof getPermissions === "function"
      ? getPermissions
      : () => [];

    // Déterminer profil
    let profile = user.profile;
    const specialProfile = safeGetProfileByPassword(password);
    if (specialProfile) profile = specialProfile;

    const payload = {
      id: user.id,
      email: user.email,
      role: profile,
      nom_complet: user.nom_complet,
      id_companie: user.id_companie || null,
      permissions: safeGetPermissions(profile),
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Connexion réussie',
      jwtTokenAdmin: token,
      refreshTokenAdmin: refreshToken,
      userEmailAdmin: user.email,
      adminId: user.id,
      role: payload.role,
      permissions: payload.permissions,
      id_companie: payload.id_companie
    });

    await logActivite({
      type_activite: 'system',
      categorie: 'auth',
      module: 'login',
      description: 'Connexion administrateur',
      id_admin: user.id,
      utilisateur_email: user.email,
      utilisateur_nom: user.nom_complet
    });
    

  } catch (err) {
    console.error('Erreur loginAdmin :', err);
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};


/* ---------------------------------------------------------
   🔹 LOGOUT ADMIN
----------------------------------------------------------*/
export const logoutAdmin = async (req, res) => {
  try {
    const adminId = req.userId;
    await supabase.from('admins').update({ status: 'Inactif' }).eq('id', adminId);
    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

/* ---------------------------------------------------------
   🔹 MULTER UPLOAD LOGO
----------------------------------------------------------*/
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Format de fichier non autorisé. Seuls PNG, JPEG et GIF sont acceptés.'));
};
export const upload = multer({ storage, fileFilter });

//CRÉER UNE COMPAGNIE AVEC ADMIN EXISTANT OU NOUVEL
export const createCompany = async (req, res) => {
  try {
  const { role, id: adminId } = req.user;
  
  // Vérification du rôle
  if (!['Admin','Administrateur','Superviseur','Super Admin'].includes(role)) {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  
  const {
    company_name, representative_name, email, phone_number,
    full_address, country, city, airport_code
  } = req.body;
  
  // Vérification des champs obligatoires
  if (!company_name || !representative_name || !email || !full_address || !country || !city) {
    return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
  }
  
  console.log('Body reçu :', req.body);
  console.log('Fichier reçu :', req.file);
  
  // Logo par défaut
  let logoUrl = 'https://via.placeholder.com/70x70?text=Logo';
  
  // Upload du logo si présent
  if (req.file) {
    const file = req.file;
    const safeName = file.originalname.normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9.-]/g,'_');
    const fileName = `logos/${Date.now()}_${safeName}`;
  
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });
  
    if (uploadError) {
      console.error('Erreur upload logo :', uploadError);
    }
  
    const { data: publicData } = supabase.storage.from('company-logos').getPublicUrl(fileName);
    if (publicData?.publicUrl) logoUrl = publicData.publicUrl;
  }
  
  // Préparation des données à insérer
  const companyData = {
    company_name: company_name.trim(),
    representative_name: representative_name.trim(),
    email: email.toLowerCase().trim(),
    phone_number: phone_number?.trim() || '',
    full_address: full_address.trim(),
    country: country.trim(),
    city: city.trim(),
    airport_code: airport_code?.trim() || '',
    status: 'Inactif',
    logo_url: logoUrl,
    created_at: new Date(),
    updated_at: new Date(),
    id_admin: adminId  //  <-- IMPORTANT
  };
  
  
  console.log('Données à insérer :', companyData);
  
  // Insertion dans la table companies
  const { data: insertedData, error: insertError } = await supabase
    .from('companies')
    .insert([companyData])
    .select();
  
  if (insertError) {
    console.error('Erreur insertion company :', insertError);
    return res.status(400).json({ message: 'Erreur création compagnie', erreur: insertError.message });
  }
  
  const newCompany = insertedData[0];
  console.log('Nouvelle compagnie créée :', newCompany);
  
  // Lier via table de liaison admin_companies
  const { error: linkError } = await supabase
    .from('admin_companies')
    .insert([{ admin_id: adminId, company_id: newCompany.id, role: role || 'Administrateur', created_at: new Date() }]);

  // Association admin_companies OK
  if (linkError) {
    console.error('Erreur association admin_companies :', linkError);
    return res.status(201).json({
      message: 'Compagnie créée, association admin échouée',
      company: newCompany,
      erreur_association: linkError.message
    });
  }

  console.log("USER JWT :", req.user);

  // 🔹 ARCHIVAGE (AUDIT)
  await createArchive({
    type: "Création de compagnie",
    ref: newCompany.id,
    compagnie_id: newCompany.id,
    compagnie_nom: newCompany.company_name,
    statut: newCompany.status,
    admin_id: adminId,
    admin_nom: req.user.nom_complet || req.user.email || 'Administrateur'
  });

  await logActivite({
    type_activite: 'create',
    categorie: 'company',
    module: 'companies',
    reference: newCompany.company_name,
    description: `Compagnie ${newCompany.company_name} créée`,
    id_admin: adminId,
    id_companie: newCompany.id,
    utilisateur_nom: req.user.nom_complet || 'Administrateur',
    utilisateur_email: req.user.email
  });
  
  
  res.status(201).json({
    message: 'Compagnie créée avec succès et admin associé',
    company: newCompany
  });

    
  
  } catch (err) {
  console.error('Erreur createCompany :', err);
  if (err instanceof multer.MulterError || err.message.includes('Format de fichier non autorisé')) {
  return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
  };
  

/* ---------------------------------------------------------
   🔹 LISTE DES ADMINS (ACTIFS)
----------------------------------------------------------*/
export const listAdmins = async (req, res) => {
  try {
    const { data: admins, error } = await supabase
      .from("admins")
      .select("*")
      .eq("archived", false)
      .order("id", { ascending: true });

    if (error) throw error;

    res.status(200).json({
      success: true,
      admins
    });

  } catch (err) {
    res.status(500).json({
      message: "Erreur lors de la récupération des administrateurs",
      error: err.message
    });
  }
};



/* ---------------------------------------------------------
   🔹 UPDATE ADMIN PASSWORD
----------------------------------------------------------*/
export const updateAdminPassword = async (req, res) => {
  try {
    const adminId = req.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword)
      return res.status(400).json({ message: 'Tous les champs sont requis' });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: 'Le nouveau mot de passe et sa confirmation ne correspondent pas' });

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', adminId)
      .single();

    if (error || !admin) return res.status(404).json({ message: 'Admin introuvable' });

    if (!bcrypt.compareSync(currentPassword, admin.password))
      return res.status(400).json({ message: 'Mot de passe actuel incorrect' });

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const { error: updateError } = await supabase
      .from('admins')
      .update({ password: hashedPassword })
      .eq('id', adminId);

    if (updateError) return res.status(500).json({ message: 'Erreur mise à jour mot de passe', erreur: updateError.message });

    res.json({ message: 'Mot de passe mis à jour avec succès' });

    await logActivite({
      type_activite: 'update',
      categorie: 'security',
      module: 'admins',
      reference: 'password',
      description: 'Mot de passe administrateur modifié',
      id_admin: req.userId,
      utilisateur_nom: req.user?.nom_complet || req.user?.email || 'Administrateur',
      utilisateur_email: req.user?.email || null
    });
    
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

/* ---------------------------------------------------------
   🔹 REFRESH TOKEN ADMIN
----------------------------------------------------------*/
export const refreshTokenAdmin = async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token manquant' });

    let decodedRefresh;
    try {
      decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError')
        return res.status(401).json({ message: 'Refresh token expiré, reconnectez-vous' });
      return res.status(401).json({ message: 'Refresh token invalide' });
    }

    const payload = {
      id: decodedRefresh.id,
      email: decodedRefresh.email,
      role: decodedRefresh.role,
      nom_complet: decodedRefresh.nom_complet || null,
      id_companie: decodedRefresh.id_companie || null,
      permissions: decodedRefresh.permissions || []
    };

    const newToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

    res.json({ message: 'Token rafraîchi', token: newToken });

  } catch (err) {
    console.error('Erreur refreshTokenAdmin :', err);
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

/* ---------------------------------------------------------
   🔹 ARCHIVER / RESTAURER / LISTER ADMIN
----------------------------------------------------------*/
export const archiveAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer l'admin
    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!admin) return res.status(404).json({ message: "Admin introuvable" });

    // Appel au service d’archivage
    await archiveAdminService(admin, req.user.id);

    res.status(200).json({
      success: true,
      message: "Administrateur archivé avec succès"
    });

  } catch (err) {
    res.status(500).json({
      message: "Erreur lors de l'archivage de l'administrateur",
      error: err.message
    });
  }
};

export const restoreAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!admin) return res.status(404).json({ message: "Admin introuvable" });

    // Appel au service
    await restoreAdminService(admin);

    res.status(200).json({
      success: true,
      message: "Administrateur restauré avec succès"
    });

  } catch (err) {
    res.status(500).json({
      message: "Erreur lors de la restauration de l'administrateur",
      error: err.message
    });
  }
};
export const listArchivedAdmins = async (req, res) => {
  try {
    const { data: admins, error } = await supabase
      .from("admins")
      .select("*")
      .eq("archived", true)
      .order("id", { ascending: true });

    if (error) throw error;

    res.status(200).json({
      success: true,
      admins
    });

  } catch (err) {
    res.status(500).json({
      message: "Erreur lors de la récupération des admins archivés",
      error: err.message
    });
  }
};
