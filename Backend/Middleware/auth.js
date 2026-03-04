import jwt from 'jsonwebtoken';

/* ---------------------------------------------------------
   🔹 Normalisation des rôles (SOURCE UNIQUE)
----------------------------------------------------------*/
const ROLE_ALIASES = {
  // Super directeur
  'super admin': 'super_directeur',
  'super directeur': 'super_directeur',

  // Administrateur
  'admin': 'administrateur',
  'administrateur': 'administrateur',

  // Superviseur
  'superviseur': 'superviseur',
  'daf': 'superviseur',

  // Opérateur
  'operator': 'operateur',
  'operateur': 'operateur',
  'opérateur': 'operateur',

  // Company
  'company': 'company',
  'compagnie': 'company'
};

/* ---------------------------------------------------------
   🔹 Middleware : vérifie le token et reconstruit req.user
----------------------------------------------------------*/
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  let token = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token && req.headers['x-access-token']) {
    token = String(req.headers['x-access-token']).trim();
  }

  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = buildUserObject(decoded);
    req.userId = req.user.id;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expiré' });
    }
    return res.status(401).json({ message: 'Token invalide' });
  }
};

/* ---------------------------------------------------------
   🔹 Construction NORMALISÉE de req.user
----------------------------------------------------------*/
const buildUserObject = (decoded) => {
  if (!decoded?.role) {
    throw new Error('Rôle absent dans le token');
  }

  const rawRole = String(decoded.role).toLowerCase().trim();
  const normalizedRole = ROLE_ALIASES[rawRole] || rawRole;

  return {
    id: decoded.id,
    role: normalizedRole, // 🔥 ROLE NORMALISÉ (clé du fix)
    email: decoded.email,
    nom_complet: decoded.nom_complet || null,
    permissions: decoded.permissions || [],
    id_companie: decoded.id_companie ?? decoded.company_id ?? null,
    company_name: decoded.company_name || null
  };
};

/* ---------------------------------------------------------
   🔹 checkRole SIMPLE (s’appuie sur role.js)
----------------------------------------------------------*/
export const checkRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    const userRole = String(req.user.role).toLowerCase().trim();

    // Normalize allowed roles to the same keys used in buildUserObject
    const ROLE_ALIASES_INVERT = {
      'super admin': 'super_directeur',
      'super directeur': 'super_directeur',

      'admin': 'administrateur',
      'administrateur': 'administrateur',

      'superviseur': 'superviseur',
      'daf': 'superviseur',

      'operator': 'operateur',
      'operateur': 'operateur',
      'opérateur': 'operateur',

      'company': 'company',
      'compagnie': 'company'
    };

    const normalizedAllowed = (allowedRoles || []).map(r => {
      const raw = String(r || '').toLowerCase().trim();
      return ROLE_ALIASES_INVERT[raw] || raw;
    });

    if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        message: `Accès refusé : rôle "${userRole}" non autorisé`
      });
    }

    next();
  };
};
