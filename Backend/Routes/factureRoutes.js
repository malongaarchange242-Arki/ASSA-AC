import express from 'express';
import {
    createFacture,
    getFactureByNumero,
    updateFacture,
    archiveFacture,
    updateFactureStatut,
    generateRef,
    getInvoicesByCompany,
    confirmerFacture,
    deleteFacture
} from '../Controllers/facturecontroller.js';

import { verifyToken, checkRole } from '../Middleware/auth.js';

const router = express.Router();

// ===========================================================
// ROUTES SPÉCIFIQUES (toujours avant les routes génériques)
// ===========================================================

// GENERER REF
router.get('/generate-ref', verifyToken, generateRef);

// LISTE FACTURES
router.get(
    '/',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin', 'Company']),
    getInvoicesByCompany
);

// FACTURES PAR COMPAGNIE
router.get(
    '/company',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin', 'Company']),
    getInvoicesByCompany
);

// CONFIRMER FACTURE (PAYÉE)  ⭐ IMPORTANT : avant /:numero_facture
router.put(
    '/confirm/:numero_facture',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin', 'Company']),
    confirmerFacture
);

// SUPPRIMER DÉFINITIVEMENT  ⭐ IMPORTANT
router.delete(
    '/delete/:numero_facture',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']),
    deleteFacture
);

// MISE À JOUR DU STATUT  ⭐ IMPORTANT
router.put(
    '/statut',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']),
    updateFactureStatut
);

// ===========================================================
// ROUTES GÉNÉRIQUES (à mettre après les spécifiques)
// ===========================================================

// CRÉER FACTURE
router.post(
    '/',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin', 'Company']),
    createFacture
);

// FACTURE PAR NUMERO
router.get('/:numero_facture', verifyToken, getFactureByNumero);

// MISE À JOUR FACTURE
router.put(
    '/:numero_facture',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']),
    updateFacture
);

// ARCHIVER FACTURE
router.delete(
    '/:numero_facture',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']),
    archiveFacture
);

export default router;
