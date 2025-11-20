import express from 'express';
import {
    createFacture,
    getFactureByNumero,
    updateFacture,
    archiveFacture,
    getCompanyInvoices,
    updateFactureStatut
} from '../controllers/factureController.js';

import { verifyToken, checkRole } from '../Middleware/auth.js';

const router = express.Router();

// ==========================
// Routes Factures
// ==========================

// Créer une facture (Admins seulement)
router.post('/', verifyToken, checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']), createFacture);

// Récupérer toutes les factures de la compagnie de l'utilisateur connecté
router.get('/', verifyToken, getCompanyInvoices);

// Récupérer une facture par son numéro
router.get('/:numero_facture', verifyToken, getFactureByNumero);

// Mettre à jour une facture (Admins seulement)
router.put('/:numero_facture', verifyToken, checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']), updateFacture);

// Archiver une facture (Admins seulement)
router.delete('/:numero_facture', verifyToken, checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']), archiveFacture);

// Mettre à jour le statut d'une facture
router.put('/statut', verifyToken, checkRole(['Admin', 'Administrateur', 'Superviseur', 'Super Admin']), updateFactureStatut);

export default router;
