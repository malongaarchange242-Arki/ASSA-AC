import express from 'express';
import { loginOperateur, getMeOperateur, updateOperateur, deleteOperateur, getAllOperateurs } from '../Controllers/operateurController.js';
import { verifyToken, checkRole } from '../Middleware/auth.js';

const router = express.Router();

// Public: operateur login
router.post('/login', loginOperateur);

// Protected: get current operateur
router.get('/me', verifyToken, getMeOperateur);

// Admin/Superviseur only: list all operateurs
router.get('/', verifyToken, checkRole(['Admin', 'Administrateur', 'Super Admin', 'Superviseur']), getAllOperateurs);

// Protected: update or delete (controller enforces ownership/admin checks)
router.put('/:id', verifyToken, updateOperateur);
router.delete('/:id', verifyToken, deleteOperateur);

export default router;
