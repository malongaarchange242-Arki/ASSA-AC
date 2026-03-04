// middlewares/role.js

/**
 * Hiérarchie des rôles
 * (plus le chiffre est grand, plus le rôle a de privilèges)
 */
export const ROLE_HIERARCHY = {
  super_directeur: 4,
  administrateur: 3,
  superviseur: 2,
  operateur: 1,
  company: 0
};

/**
 * Permissions associées à chaque rôle
 * (logique métier réelle)
 */
const PERMISSIONS = {
  super_directeur: [
    'company:read',
    'company:create',
    'company:update',
    'company:delete',

    'facture:read',
    'facture:create',
    'facture:update',
    'facture:validate',

    'user:manage'
  ],

  administrateur: [
    'company:read',
    'company:create',
    'company:update',
    'company:delete',

    'facture:read',

    'operateur:manage'
  ],

  superviseur: [
    'company:read',
    'facture:read',
    'facture:validate'
  ],

  operateur: [
    'company:read',        // 👈 voir toutes les compagnies
    'facture:read',        // 👈 voir toutes les factures
    'facture:create',      // 👈 créer facture
    'facture:update',      // 👈 ajouter preuve / changer statut
    'facture:validate'     // 👈 valider paiement
  ],

  company: [
    'facture:read:own'
  ]
};

/**
 * Récupérer les permissions d’un rôle
 */
export const getPermissions = (role) => {
  return PERMISSIONS[role?.toLowerCase()] || [];
};

/**
 * Vérifie si l'utilisateur a un rôle autorisé
 * @param {string|string[]} roles
 */
export const checkRole = (roles = []) => {
  return (req, res, next) => {
    if (!Array.isArray(roles)) roles = [roles];

    if (!req.user) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    const rawUserRole = (req.user?.role || req.user?.profile || '')
      .toLowerCase()
      .trim();

    /**
     * Normalisation des rôles
     */
    const ROLE_ALIASES = {
      'super admin': 'super_directeur',
      'super directeur': 'super_directeur',

      'admin': 'administrateur',
      'administrateur': 'administrateur',

      'superviseur': 'superviseur',
      'supervisor': 'superviseur',

      'operateur': 'operateur',
      'operator': 'operateur',

      'company': 'company',
      'compagnie': 'company'
    };

    const normalizedUserRole = ROLE_ALIASES[rawUserRole] || rawUserRole;
    const userRoleLevel = ROLE_HIERARCHY[normalizedUserRole] ?? -1;

    const allowedLevels = roles.map(role => {
      const r = String(role).toLowerCase().trim();
      const normalized = ROLE_ALIASES[r] || r;
      return ROLE_HIERARCHY[normalized] ?? -1;
    });

    const hasAccess = allowedLevels.some(level => userRoleLevel >= level);

    if (!hasAccess) {
      console.warn(
        `🚫 Accès refusé | ${req.user.email || 'inconnu'} | rôle=${normalizedUserRole} | route=${req.originalUrl}`
      );

      return res.status(403).json({
        message: `Accès refusé : le rôle "${normalizedUserRole}" n'a pas les droits requis.`
      });
    }

    next();
  };
};
