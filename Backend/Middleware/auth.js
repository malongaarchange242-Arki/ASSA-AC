import jwt from 'jsonwebtoken';

/* ---------------------------------------------------------
   🔹 Middleware : vérifie le token et reconstruit req.user
----------------------------------------------------------*/
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  let token = null;

  // 1) Authorization: Bearer <token>
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2) x-access-token header
  if (!token && req.headers['x-access-token']) {
    token = String(req.headers['x-access-token']).trim();
  }

  // 3) Cookie 'token' (si cookie-parser est utilisé)
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) return res.status(401).json({ message: 'Token manquant' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Reconstruit req.user
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
   🔹 Construit req.user selon rôle ADMIN/COMPAGNIE
----------------------------------------------------------*/
const buildUserObject = (decoded) => {
  const adminRoles = ['Admin', 'Administrateur', 'Superviseur', 'Super Admin'];
  const companyRoles = ['Company', 'Compagnie'];

  if (adminRoles.includes(decoded.role)) {
    return {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      nom_complet: decoded.nom_complet || null,
      permissions: decoded.permissions || [],
      id_companie: decoded.id_companie || null,  // <- harmonisé avec controller
    };
  }

  if (companyRoles.includes(decoded.role)) {
    return {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      nom_complet: decoded.nom_complet || null,
      permissions: decoded.permissions || [],
      id_companie: decoded.id_companie ?? decoded.company_id ?? null, // fallback
      company_name: decoded.company_name || null,
    };
  }

  throw new Error('Rôle utilisateur inconnu dans le token');
};

/* ---------------------------------------------------------
   🔹 Vérification des rôles
----------------------------------------------------------*/
/* ---------------------------------------------------------
   🔹 Vérification des rôles optimisée
----------------------------------------------------------*/
export const checkRole = (allowedRoles = []) => (req, res, next) => {
  const role = req.user?.role;

  if (!role) return res.status(401).json({ message: 'Utilisateur non authentifié' });

  // Si aucun rôle n'est passé, autoriser tous les rôles admin par défaut
  const defaultAdminRoles = ['Admin', 'Administrateur', 'Superviseur', 'Super Admin'];

  const rolesToCheck = allowedRoles.length > 0 ? allowedRoles : defaultAdminRoles;

  if (!rolesToCheck.includes(role)) {
    return res.status(403).json({ message: `Accès refusé : rôle "${role}" non autorisé` });
  }

  next();
};
