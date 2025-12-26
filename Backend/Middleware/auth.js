import jwt from 'jsonwebtoken';

/* ---------------------------------------------------------
   🔧 UTILITAIRE : normalisation des rôles (SOURCE UNIQUE)
---------------------------------------------------------- */
const normalizeRole = (role) => {
  if (!role) return null;

  return role
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
};

/* ---------------------------------------------------------
   👤 Construction de req.user (SOURCE UNIQUE DE VÉRITÉ)
   Roles possibles :
   - admin
   - supervisor
   - company
   - superadmin
---------------------------------------------------------- */
const buildUserObject = (decoded) => {
  const role = normalizeRole(decoded.role);

  // 🟣 SUPER ADMIN (accès global)
  if (['superadmin'].includes(role)) {
    return {
      id: decoded.id,
      role: 'superadmin',
      email: decoded.email,
      permissions: decoded.permissions ?? []
    };
  }

  // 🔵 ADMIN
  if (['admin', 'administrateur'].includes(role)) {
    return {
      id: decoded.id,
      role: 'admin',
      email: decoded.email,
      permissions: decoded.permissions ?? [],
      id_companie: decoded.id_companie ?? null
    };
  }

  // 🟢 SUPERVISOR
  if (['supervisor', 'superviseur'].includes(role)) {
    return {
      id: decoded.id,
      role: 'supervisor',
      email: decoded.email,
      permissions: decoded.permissions ?? []
    };
  }

  // 🟠 COMPANY
  if (['company', 'compagnie', 'entreprise'].includes(role)) {
    return {
      id: decoded.id,
      role: 'company',
      email: decoded.email,
      id_companie: decoded.id_companie ?? decoded.id
    };
  }

  throw new Error(`Rôle utilisateur inconnu : ${decoded.role}`);
};

/* ---------------------------------------------------------
   🔐 Middleware JWT — COOKIE ONLY
---------------------------------------------------------- */
export const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'Non authentifié' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 SOURCE UNIQUE DE VÉRITÉ
    req.user = buildUserObject(decoded);

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expirée' });
    }

    return res.status(401).json({ message: 'Token invalide' });
  }
};

/* ---------------------------------------------------------
   🔐 Middleware de contrôle des rôles
   Utiliser UNIQUEMENT :
   ['admin', 'supervisor', 'company', 'superadmin']
---------------------------------------------------------- */
export const checkRole = (allowedRoles = []) => (req, res, next) => {
  if (!req.user?.role) {
    return res.status(401).json({ message: 'Utilisateur non authentifié' });
  }

  const userRole = normalizeRole(req.user.role);
  const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

  if (!normalizedAllowedRoles.includes(userRole)) {
    return res.status(403).json({
      message: `Accès refusé (rôle : ${req.user.role})`
    });
  }

  next();
};
