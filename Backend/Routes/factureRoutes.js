import express from 'express';
import {
    createFacture,
    getFactureByNumero,
    updateFacture,
    archiveFacture,
    getCompanyInvoices,
    updateFactureStatut,
    generateRef
} from '../Controllers/facturecontroller.js';

import { verifyToken, checkRole } from '../Middleware/auth.js';

const router = express.Router();

// ==========================
// GENERER UNE REFERENCE DE FACTURE
// ==========================
router.get('/generate-ref', verifyToken, generateRef);

// ==========================
// CREATION FACTURE
// ==========================
router.post(
    '/',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']),
    createFacture
);

// ==========================
// LISTE DES FACTURES
// ==========================
router.get('/', verifyToken, getCompanyInvoices);

// ==========================
// AFFICHER UNE FACTURE PAR NUMERO
// ==========================
router.get('/:numero_facture', verifyToken, getFactureByNumero);

// ==========================
// METTRE À JOUR UNE FACTURE
// ==========================
router.put(
    '/:numero_facture',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']),
    updateFacture
);

// ==========================
// ARCHIVER UNE FACTURE
// ==========================
router.delete(
    '/:numero_facture',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']),
    archiveFacture
);

// ==========================
// METTRE À JOUR UN STATUT DE FACTURE
// ==========================
router.put(
    '/statut',
    verifyToken,
    checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']),
    updateFactureStatut
);

export default router;
