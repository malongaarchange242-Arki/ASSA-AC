// controllers/authAdminController.js
import supabase from '../Config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { archiveAdminService, restoreAdminService } from '../Services/archiveService.js';

/* ---------------------------------------------------------
   🔹 Profils spéciaux et permissions
----------------------------------------------------------*/
const getProfileByPassword = (password) => {
  if (password === 'ASSA2025A') return 'Administrateur';
  if (password === 'ASSA2025S') return 'Super Admin';
  return null;
};

const getPermissions = (profile) => {
  switch (profile) {
    case 'Administrateur': return ['manage_admins','create_company','view_stats'];
    case 'Superviseur': return ['view_companies','view_stats'];
    case 'Super Admin': return ['manage_admins','create_company','view_stats','all_access'];
    default: return [];
  }
};

/* ---------------------------------------------------------
   🔹 LOGIN ADMIN
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

    if (error || !user) return res.status(400).json({ message: 'Email ou mot de passe incorrect' });

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Déterminer profil
    let profile = user.profile;
    const specialProfile = getProfileByPassword(password);
    if (specialProfile) profile = specialProfile;

    const payload = {
      id: user.id,
      email: user.email,
      role: profile,
      nom_complet: user.nom_complet,
      id_companie: user.id_companie || null,
      permissions: getPermissions(profile),
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    console.log("Connexion réussie pour admin:", email);

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

/* ---------------------------------------------------------
   🔹 CRÉER UNE COMPAGNIE
----------------------------------------------------------*/
export const createCompany = async (req, res) => {
  try {
    console.log('--- Début createCompany ---');
    console.log('req.user:', req.user);
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);

    // Vérifier rôle
    const { role, id: adminId } = req.user || {};
    if (!role || !['Admin','Administrateur','Superviseur','Super Admin'].includes(role)) {
      console.log('Rôle non autorisé');
      return res.status(403).json({ message: 'Accès refusé' });
    }

    // Récupérer champs
    const { company_name, representative_name, email, phone_number, full_address, country, city, airport_code } = req.body;
    if (!company_name || !representative_name || !email || !full_address || !country || !city) {
      console.log('Champs obligatoires manquants');
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }

    // Logo par défaut
    let logoUrl = 'https://via.placeholder.com/70x70?text=Logo';

    // Si un fichier est envoyé
    if (req.file) {
      try {
        const file = req.file;
        const safeName = file.originalname.normalize('NFD')
          .replace(/[\u0300-\u036f]/g,'')
          .replace(/[^a-zA-Z0-9.-]/g,'_');
        const fileName = `logos/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

        if (uploadError) {
          console.log('Erreur upload logo:', uploadError);
          return res.status(500).json({ message: 'Impossible de téléverser le logo', erreur: uploadError.message });
        }

        const { data: publicData } = supabase.storage.from('company-logos').getPublicUrl(fileName);
        logoUrl = publicData?.publicUrl || logoUrl;
        console.log('Logo URL:', logoUrl);

      } catch (fileErr) {
        console.log('Erreur traitement fichier:', fileErr);
        return res.status(500).json({ message: 'Erreur traitement fichier', erreur: fileErr.message });
      }
    }

    // Préparer données
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
    };
    console.log('companyData prêt à insérer:', companyData);

    // Insertion dans Supabase
    const { data: insertedData, error: insertError } = await supabase
      .from('companies')
      .insert([companyData])
      .select();

    if (insertError) {
      console.log('Erreur insertion compagnie:', insertError);
      return res.status(500).json({ message: 'Erreur création compagnie', erreur: insertError.message });
    }

    const newCompany = insertedData[0];
    console.log('Nouvelle compagnie insérée:', newCompany);

    // Mise à jour admin
    const { data: adminUpdate, error: adminUpdateError } = await supabase
      .from('admins')
      .update({ id_companie: newCompany.id })
      .eq('id', adminId);

    if (adminUpdateError) {
      console.log('Erreur mise à jour admin:', adminUpdateError);
      return res.status(500).json({ message: 'Erreur association admin à la compagnie', erreur: adminUpdateError.message });
    }

    console.log('Admin mis à jour:', adminUpdate);

    res.status(201).json({ message: 'Compagnie créée avec succès et admin associé', company: newCompany });

  } catch (err) {
    console.error('Erreur createCompany (catch):', err);
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
    const { role } = req.user;
    if (!['Admin','Administrateur','Superviseur','Super Admin'].includes(role))
      return res.status(403).json({ message: 'Accès refusé' });

    const { data, error } = await supabase
      .from('admins')
      .select('id, nom_complet, email, role, status, created_at')
      .eq('archived', false);

    if (error) return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });

    res.json({ total: data.length, admins: data });

  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
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
    const admin = await supabase.from('admins').select('*').eq('id', id).single();
    if (!admin.data) return res.status(404).json({ message: 'Admin introuvable' });

    await archiveAdminService(admin.data, req.user.id);
    res.json({ message: 'Admin archivé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

export const restoreAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    await restoreAdminService(id);
    res.json({ message: 'Admin restauré avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};

export const listArchivedAdmins = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('id, nom_complet, email, role, created_at')
      .eq('archived', true);

    if (error) return res.status(500).json({ message: 'Erreur serveur', erreur: error.message });

    res.json({ total: data.length, admins_archives: data });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', erreur: err.message });
  }
};