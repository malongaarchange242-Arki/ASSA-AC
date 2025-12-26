// routes/auth.js
import express from 'express';
import { checkUserRoleByEmail } from '../Controllers/authCommonController.js';

const router = express.Router();

/* ---------------------------------------------------------
   🔍 Vérification du rôle par email (AVANT login)
   - Route publique
   - Aucun JWT / cookie requis
---------------------------------------------------------- */
router.post('/check-email', checkUserRoleByEmail);

export default router;
