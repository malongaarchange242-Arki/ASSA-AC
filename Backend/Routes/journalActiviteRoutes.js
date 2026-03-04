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
// Routes Journal d'activité avec rôles
// ============================================

// 1️⃣ Toutes les activités : uniquement admin/superviseur
router.get('/', verifyToken, checkRole(['Admin','Administrateur','Superviseur','Super Admin']), getAllActivites);

// 2️⃣ Activités par admin : admin/superviseur/super admin
router.get('/admin/:id_admin', verifyToken, checkRole(['Admin','Administrateur','Superviseur','Super Admin']), getActivitesByAdmin);

// 3️⃣ Activités par compagnie : accessible par la compagnie elle-même ou admin/superviseur/super admin
router.get('/companie/:id_companie', verifyToken, (req, res, next) => {
  // Autorisation personnalisée
  if (
    req.user.role === 'Company' && req.user.id_companie === Number(req.params.id_companie)
  ) {
    return next();
  }
  checkRole(['Admin','Administrateur','Superviseur','Super Admin'])(req, res, next);
}, getActivitesByCompanie);

// 4️⃣ Activités récentes : admin/superviseur/super admin
router.get('/recent', verifyToken, checkRole(['Admin','Administrateur','Superviseur','Super Admin']), getRecentActivites);

export default router;
