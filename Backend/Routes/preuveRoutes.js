import express from 'express';
import { 
    uploadMiddleware, 
    uploadPreuvesPaiement, 
    getPreuveById,
    getPreuvesByFacture
} from '../Controllers/preuve_paiement.js';

import { verifyToken, checkRole } from '../Middleware/auth.js';

const router = express.Router();

// ==============================
// 📤 Upload preuve de paiement
// ==============================
router.post(
    '/upload',
    verifyToken,
    checkRole(['admin', 'supervisor', 'company']),
    uploadMiddleware,
    uploadPreuvesPaiement
);

// ==============================
// 📄 Preuves par numéro facture
// ==============================
router.get(
    '/by-facture/:numero_facture',
    verifyToken,
    checkRole(['admin', 'supervisor', 'company']),
    getPreuvesByFacture
);

// ==============================
// 🔍 Preuve par ID
// ==============================
router.get(
    '/:id',
    verifyToken,
    checkRole(['admin', 'supervisor', 'company']),
    getPreuveById
);

export default router;
