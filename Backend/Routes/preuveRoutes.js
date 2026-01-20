import express from 'express';
import { 
    uploadMiddleware, 
    uploadPreuvesPaiement, 
    getPreuveById,
    getPreuvesByFacture
} from '../Controllers/preuve_paiement.js';

import { verifyToken, checkRole } from '../Middleware/auth.js';

const router = express.Router();

// Upload preuve
router.post(
    '/upload',
    verifyToken,
    checkRole(['Company', 'Administrateur']),
    uploadMiddleware,
    uploadPreuvesPaiement
);

// Récupérer preuves par numéro facture
router.get(
    '/by-facture/:numero_facture',
    verifyToken,
    checkRole(['Company', 'Administrateur']),
    getPreuvesByFacture
);

// Récupérer une preuve par ID
router.get(
    '/:id',
    verifyToken,
    checkRole(['Company', 'Administrateur']),
    getPreuveById
);

export default router;
