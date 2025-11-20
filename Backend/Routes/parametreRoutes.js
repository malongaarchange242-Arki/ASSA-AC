import express from 'express';
import { verifyToken } from '../Middleware/auth.js';
import { checkRole } from '../Middleware/role.js';
import { getParametres, updateParametres } from '../controllers/parametreAdminController.js';

const router = express.Router();

// Récupérer les paramètres 
router.get(
  '/',
  verifyToken,
  checkRole(['Administrateur']),
  getParametres
);

// Mettre à jour les paramètres 
router.put(
  '/',
  verifyToken,
  checkRole(['Administrateur']),
  updateParametres
);

export default router;
