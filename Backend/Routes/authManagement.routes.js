import express from 'express';
import {
  loginSuperAdminBySecret,
  createAdminBySuperAdmin
} from '../Controllers/authManagement.js';

import { verifyToken, checkRole } from '../Middlewares/authMiddleware.js';
import { superAdminRateLimit } from '../Middlewares/rateLimitSuperAdmin.js';
import { superAdminIpWhitelist } from '../Middlewares/ipWhitelist.js';

const router = express.Router();

/* =========================================================
   🔐 CONNEXION SUPER ADMIN
   - rate-limit
   - IP whitelist
   - secret système
========================================================= */
router.post(
  '/auth/super/login',
  superAdminRateLimit,
  superAdminIpWhitelist,
  loginSuperAdminBySecret
);

/* =========================================================
   👑 SUPER ADMIN → CRÉER ADMIN / SUPERVISEUR
========================================================= */
router.post(
  '/auth/super/create-admin',
  verifyToken,
  checkRole(['Super Admin']),
  createAdminBySuperAdmin
);

export default router;
