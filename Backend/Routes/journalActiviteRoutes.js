import express from 'express';
import { verifyToken, checkRole } from '../Middleware/auth.js';
import {
  getAllActivites,
  getActivitesByAdmin,
  getActivitesByCompanie,
  getRecentActivites
} from '../Controllers/journalActiviteController.js';

const router = express.Router();

// ============================================
// Journal d'activité — ROUTES SÉCURISÉES
// ============================================

// 1️⃣ Toutes les activités : admin + supervisor
router.get(
  '/',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  getAllActivites
);

// 2️⃣ Activités par admin : admin + supervisor
router.get(
  '/admin/:id_admin',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  getActivitesByAdmin
);

// 3️⃣ Activités par compagnie
router.get(
  '/companie/:id_companie',
  verifyToken,
  (req, res, next) => {
    // ✔️ La compagnie peut voir SES activités
    if (
      req.user.role === 'company' &&
      String(req.user.id_companie) === String(req.params.id_companie)
    ) {
      return next();
    }

    // ✔️ Admin / Supervisor peuvent tout voir
    return checkRole(['admin', 'supervisor'])(req, res, next);
  },
  getActivitesByCompanie
);

// 4️⃣ Activités récentes : admin + supervisor
router.get(
  '/recent',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  getRecentActivites
);

export default router;
