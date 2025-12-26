// middlewares/role.js

/**
 * Hiérarchie des rôles
 * (plus le chiffre est grand, plus le rôle a de privilèges)
 */
export const ROLE_HIERARCHY = {
  super_directeur: 4,
  administrateur: 3,
  superviseur: 2,
  company: 1
};

/**
 * Permissions associées à chaque rôle
 */
const PERMISSIONS = {
  super_directeur: [
    'view_all_stats',
    'manage_admins',
    'manage_superviseurs',
    'manage_companies'
  ],
  administrateur: [
    'view_all_stats',
    'manage_companies'
  ],
  superviseur: [
    'view_all_stats'
  ],
  company: [
    'view_own_dashboard'
  ]
};

/**
 *  Récupérer les permissions d’un rôle
 * @param {string} role 
 * @returns {string[]}
 */
export const getPermissions = (role) => {
  return PERMISSIONS[role?.toLowerCase()] || [];
};

/**
 *  Vérifie si l'utilisateur a un rôle autorisé
 * @param {string|string[]} roles - Rôle(s) autorisé(s)
 */
export const checkRole = (roles = []) => {
  return (req, res, next) => {
    if (!Array.isArray(roles)) roles = [roles];

    if (!req.user) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    const rawUserRole = (req.user?.role || req.user?.profile || '').toLowerCase();
  const ROLE_ALIASES = {
    'super admin': 'super_directeur',
    'administrateur': 'administrateur',
    'superviseur': 'superviseur',
    'admin': 'administrateur',
    'company': 'company',
    'compagnie': 'company'
  };
  const normalizedUserRole = ROLE_ALIASES[rawUserRole] || rawUserRole;
  const userRoleLevel = ROLE_HIERARCHY[normalizedUserRole] || 0;
  const allowedLevels = roles.map(r => {
    const rr = (String(r || '').toLowerCase());
    const nr = ROLE_ALIASES[rr] || rr;
    return ROLE_HIERARCHY[nr] || 0;
  });

  const hasAccess = allowedLevels.some(level => userRoleLevel >= level);

    if (!hasAccess) {
      console.warn(
        ` Accès refusé pour ${req.user.email || 'inconnu'} (${userRole}) sur ${req.originalUrl}`
      );
      return res.status(403).json({
        message: `Accès refusé : le profil "${userRole}" n'est pas autorisé pour cette action.`
      });
    }

    next();
  };
};
