// routes/authSuperviseurRoutes.js
import express from 'express';
import { loginSuperviseur, getSuperviseur, updateSuperviseur } from '../Controllers/authSuperviseurController.js';
import { verifyToken } from '../Middleware/auth.js';

const router = express.Router();

// POST /api/superviseurs/login
router.post('/login', loginSuperviseur);

// GET /api/superviseurs/me - récupérer le profil du superviseur connecté
router.get('/me', verifyToken, getSuperviseur);

// PUT /api/superviseurs/me - mettre à jour le profil du superviseur connecté
router.put('/me', verifyToken, updateSuperviseur);

export default router;
