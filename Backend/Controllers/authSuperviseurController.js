// controllers/authSuperviseurController.js
import supabase from '../Config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * Authentification pour les superviseurs
 * - Normalise l'email
 * - Vérifie archived = false
 * - Compare le mot de passe avec bcrypt
 * - Retourne tokens JWT (access + refresh)
 */
export const loginSuperviseur = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error('JWT configuration manquante pour superviseur');
      return res.status(500).json({ message: 'Configuration serveur manquante' });
    }

    const { data: user, error } = await supabase
      .from('superviseurs')
      .select('*')
      .ilike('email', normalizedEmail)
      .eq('archived', false)
      .maybeSingle();

    if (error) {
      console.error('Supabase error (superviseur login):', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (!user) {
      // Ne pas préciser si c'est l'email ou le mot de passe
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    const hashed = user.password || user.password_hash || '';
    const passwordMatches = await bcrypt.compare(password, hashed);
    if (!passwordMatches) return res.status(400).json({ message: 'Email ou mot de passe incorrect' });

    const payload = {
      id: user.id,
      email: user.email,
      role: 'superviseur',  // 🔥 minuscule pour cohérence avec auth.js normalization
      nom_complet: user.nom_complet || null,
      permissions: ['view_companies', 'view_stats']
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    return res.json({
      message: 'Connexion réussie',
      // Standard keys expected by frontend
      token: accessToken,
      refreshToken: refreshToken,
      // Backwards-compatible supervisor-specific keys
      jwtTokenSuperviseur: accessToken,
      refreshTokenSuperviseur: refreshToken,
      id: user.id,
      email: user.email,
      role: payload.role,
      permissions: payload.permissions,
      nom_complet: payload.nom_complet
    });

  } catch (err) {
    console.error('Erreur loginSuperviseur :', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export default {
  loginSuperviseur
};

// Récupère les informations du superviseur connecté (requires verifyToken)
export const getSuperviseur = async (req, res) => {
  try {
    const id = req.user?.id || req.params?.id;
    if (!id) return res.status(400).json({ message: 'Identifiant superviseur manquant' });

    const { data, error } = await supabase
      .from('superviseurs')
      .select('id, nom_complet, email, profile, telephone, status, permissions, archived, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Supabase error getSuperviseur:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    if (!data) return res.status(404).json({ message: 'Superviseur introuvable' });

    return res.json(data);
  } catch (err) {
    console.error('Erreur getSuperviseur:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Mettre à jour les informations du superviseur connecté (requires verifyToken)
export const updateSuperviseur = async (req, res) => {
  try {
    const id = req.user?.id || req.params?.id;
    if (!id) return res.status(400).json({ message: 'Identifiant superviseur manquant' });

    const allowed = ['nom_complet', 'email', 'telephone', 'profile', 'status'];
    const payload = {};
    for (const k of allowed) if (Object.prototype.hasOwnProperty.call(req.body, k)) payload[k] = req.body[k];

    // Si changement de mot de passe : exiger l'ancien mot de passe et le vérifier
    if (req.body.password) {
      const old = req.body.old_password;
      if (!old) return res.status(400).json({ message: 'Ancien mot de passe requis' });

      // récupérer le hash actuel
      const { data: currentUser, error: curErr } = await supabase
        .from('superviseurs')
        .select('password_hash')
        .eq('id', id)
        .single();
      if (curErr) {
        console.error('Supabase error reading current password:', curErr);
        return res.status(500).json({ message: 'Erreur serveur' });
      }
      const currentHash = (currentUser && currentUser.password_hash) || '';
      const bcryptLib = await import('bcryptjs');
      const matches = await bcryptLib.compare(old, currentHash);
      if (!matches) return res.status(400).json({ message: 'Ancien mot de passe incorrect' });

      const salt = await bcryptLib.genSalt(10);
      const hash = await bcryptLib.hash(req.body.password, salt);
      payload.password_hash = hash;
    }

    const { data, error } = await supabase
      .from('superviseurs')
      .update(payload)
      .eq('id', id)
      .select('id, nom_complet, email, profile, telephone, status, permissions, archived, created_at, updated_at')
      .maybeSingle();

    if (error) {
      console.error('Supabase error updateSuperviseur:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }

    return res.json({ message: 'Profil mis à jour', superviseur: data });
  } catch (err) {
    console.error('Erreur updateSuperviseur:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};
