import supabase from '../Config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logActivite } from '../Services/journalService.js';

// Constants
const PROFILE = 'operateur';
const ROLE = 'operateur';
const JWT_EXPIRES = '12h';

// Helper to strip sensitive fields
const sanitizeOperateur = (row) => {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  // Ensure role/profile are present in returned object for compatibility
  return { ...rest, profile: PROFILE, role: ROLE };
};

/* ---------------------------------------------------------
   POST /api/operateurs/login
   body: { email, password }
   Returns JWT containing { id, email, profile }
----------------------------------------------------------*/
export const loginOperateur = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });

    const normalized = String(email).trim().toLowerCase();

    const { data: user, error } = await supabase
      .from('operateurs')
      .select('id, email, password_hash, actif, nom')
      .ilike('email', normalized)
      .maybeSingle();

    if (error) {
      console.error('loginOperateur supabase error:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (!user) return res.status(401).json({ message: 'Identifiants invalides' });
    if (user.actif === false || user.actif === 'false') return res.status(403).json({ message: 'Compte opérateur désactivé' });

    const match = await bcrypt.compare(password, user.password_hash || '');
    if (!match) return res.status(401).json({ message: 'Identifiants invalides' });

    // Include a normalized `role` claim for backend compatibility
    const payload = { id: user.id, email: user.email, role: ROLE, profile: PROFILE };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES });

    await logActivite({ module: 'auth', type_activite: 'login', categorie: 'operateur', reference: user.email, description: 'Connexion opérateur', id_admin: null, utilisateur_email: user.email });

    return res.json({ token, id: user.id, email: user.email, role: ROLE });
  } catch (err) {
    console.error('loginOperateur error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

/* ---------------------------------------------------------
   GET /api/operateurs/me
   Requires verifyToken middleware
----------------------------------------------------------*/
export const getMeOperateur = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Non authentifié' });

    // Only operators should access this endpoint for themselves
    const { data, error } = await supabase
      .from('operateurs')
      .select('id, nom, email, actif, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('getMeOperateur supabase error:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (!data) return res.status(404).json({ message: 'Opérateur introuvable' });

    return res.json({ operateur: sanitizeOperateur(data) });
  } catch (err) {
    console.error('getMeOperateur error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

/* ---------------------------------------------------------
   PUT /api/operateurs/:id
   - Operators can only update their own account
   - Admins / Superviseurs can update any
   Body: { nom?, email?, password? }
----------------------------------------------------------*/
export const updateOperateur = async (req, res) => {
  try {
    const targetId = req.params.id;
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: 'Non authentifié' });

    const role = String(requester.role || '').toLowerCase();
    const adminRoles = ['admin', 'administrateur', 'super admin', 'superviseur'];
    const isAdmin = adminRoles.includes(role);
    if (!isAdmin && requester.id !== targetId) return res.status(403).json({ message: 'Impossible de modifier un autre opérateur' });

    const { nom, email, password, actif } = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (typeof nom !== 'undefined') patch.nom = nom;
    if (typeof email !== 'undefined') patch.email = email;
    if (typeof actif !== 'undefined') patch.actif = actif;
    if (typeof password !== 'undefined' && password && password.length >= 6) {
      patch.password_hash = await bcrypt.hash(password, 10);
    }

    const { data, error } = await supabase
      .from('operateurs')
      .update(patch)
      .eq('id', targetId)
      .select('id, nom, email, actif, created_at, updated_at')
      .maybeSingle();

    if (error) {
      console.error('updateOperateur supabase error:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (!data) return res.status(404).json({ message: 'Opérateur introuvable' });

    await logActivite({ module: 'Operateurs', type_activite: 'update', categorie: 'Operateur', reference: data.email || data.id, description: `Mise à jour opérateur ${data.email || data.id}`, id_admin: requester.id });

    return res.json({ operateur: sanitizeOperateur(data) });
  } catch (err) {
    console.error('updateOperateur error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

/* ---------------------------------------------------------
   DELETE /api/operateurs/:id -> logical delete (actif = false)
   - Admins/Superviseurs or the operator themself can deactivate
----------------------------------------------------------*/
export const deleteOperateur = async (req, res) => {
  try {
    const targetId = req.params.id;
    const requester = req.user;
    if (!requester) return res.status(401).json({ message: 'Non authentifié' });

    const role = String(requester.role || '').toLowerCase();
    const adminRoles = ['admin', 'administrateur', 'super admin', 'superviseur'];
    const isAdmin = adminRoles.includes(role);
    if (!isAdmin && requester.id !== targetId) return res.status(403).json({ message: 'Impossible de supprimer un autre opérateur' });

    const { data, error } = await supabase
      .from('operateurs')
      .update({ actif: false, updated_at: new Date().toISOString() })
      .eq('id', targetId)
      .select('id, nom, email, actif')
      .maybeSingle();

    if (error) {
      console.error('deleteOperateur supabase error:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (!data) return res.status(404).json({ message: 'Opérateur introuvable' });

    await logActivite({ module: 'Operateurs', type_activite: 'disable', categorie: 'Operateur', reference: data.email || data.id, description: `Désactivation opérateur ${data.email || data.id}`, id_admin: requester.id });

    return res.json({ success: true });
  } catch (err) {
    console.error('deleteOperateur error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

/* ---------------------------------------------------------
   GET /api/operateurs
   - Reserved to Admins / Superviseurs
----------------------------------------------------------*/
export const getAllOperateurs = async (req, res) => {
  try {
    const requester = req.user;
    if (!requester) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const role = String(requester.role || '').toLowerCase();
    const allowed = ['admin', 'administrateur', 'super admin', 'superviseur'];
    if (!allowed.includes(role)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const { data, error } = await supabase
      .from('operateurs')
      .select('id, nom, email, actif, profile, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getAllOperateurs supabase error:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    return res.json({ operateurs: data || [] });
  } catch (err) {
    console.error('getAllOperateurs error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};
