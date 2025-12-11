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

// GENERER REF
router.get('/generate-ref', verifyToken, generateRef);

// CREER FACTURE
router.post(
    '/',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin', 'Company']),
    createFacture
);

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

// CONFIRMER FACTURE (PAYÉE)
router.put(
    '/confirm/:numero_facture',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin', 'Company']),
    confirmerFacture
);

// SUPPRIMER DEFINITIVEMENT
router.delete(
    '/delete/:numero_facture',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']),
    deleteFacture
);

// MISE À JOUR STATUT
router.put(
    '/statut',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']),
    updateFactureStatut
);

export default router;
