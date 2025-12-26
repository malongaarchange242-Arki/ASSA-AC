import express from 'express';
import { verifyToken } from '../Middleware/auth.js';
import { checkRole } from '../Middleware/role.js';
import {
  getParametres,
  updateParametres
} from '../Controllers/parametreAdminController.js';

const router = express.Router();

const adminGuard = [
  verifyToken,
  checkRole(['admin', 'superadmin'])
];

// Récupérer les paramètres
router.get('/', adminGuard, getParametres);

// Mettre à jour les paramètres
router.put('/', adminGuard, updateParametres);

export default router;
