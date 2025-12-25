import jwt from 'jsonwebtoken';

/* ---------------------------------------------------------
   🔐 Middleware principal : vérification JWT (COOKIE FIRST)
---------------------------------------------------------- */
export const verifyToken = (req, res, next) => {
  let token = null;

  if (req.cookies?.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  } else if (req.headers['x-access-token']) {
    token = String(req.headers['x-access-token']).trim();
  }

  if (!token) {
    return res.status(401).json({ message: 'Non authentifié' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // 🔥 SOURCE UNIQUE
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expirée' });
    }
    return res.status(401).json({ message: 'Token invalide' });
  }
};


/* ---------------------------------------------------------
   👤 Construction de req.user (ADMIN / SUPERVISOR / COMPANY)
---------------------------------------------------------- */
const buildUserObject = (decoded) => {
  const adminRoles = [
    'Admin',
    'Administrateur',
    'Super Admin'
  ];

  const supervisorRoles = ['supervisor', 'Superviseur'];

  const companyRoles = ['Company', 'Compagnie'];

  // 🔹 SUPERVISEUR
  if (supervisorRoles.includes(decoded.role)) {
    return {
      id: decoded.id,
      role: 'supervisor',
      email: decoded.email,
      nom_complet: decoded.nom_complet ?? null,
      permissions: decoded.permissions ?? []
    };
  }

  // 🔹 ADMIN
  if (adminRoles.includes(decoded.role)) {
    return {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      nom_complet: decoded.nom_complet ?? null,
      permissions: decoded.permissions ?? [],
      id_companie: decoded.id_companie ?? null
    };
  }

  // 🔹 COMPANY
  if (companyRoles.includes(decoded.role)) {
    return {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
      id_companie: decoded.id_companie ?? decoded.id
    };
  }

  throw new Error('Rôle utilisateur inconnu dans le token');
};

/* ---------------------------------------------------------
   🛡️ Vérification de rôles (souple)
---------------------------------------------------------- */
export const checkRole = (allowedRoles = []) => (req, res, next) => {
  if (!req.user?.role) {
    return res.status(401).json({ message: 'Utilisateur non authentifié' });
  }

  if (allowedRoles.length === 0) {
    return res.status(500).json({
      message: 'Configuration route invalide (roles manquants)'
    });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Accès refusé (rôle : ${req.user.role})`
    });
  }

  next();
};
