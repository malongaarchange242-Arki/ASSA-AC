import express from 'express';
import {
  createFacture,
  submitFactureForValidation,
  validateFacture,
  rejectFacture,
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

/* =========================================================
   ROUTES SPÉCIFIQUES (AVANT LES GÉNÉRIQUES)
========================================================= */

// 🔹 Générer une référence
router.get('/generate-ref', verifyToken, generateRef);

// 🔹 Liste des factures
// 👉 opérateur VOIT TOUT
router.get(
  '/',
  verifyToken,
  checkRole(['operateur', 'administrateur', 'superviseur', 'super_directeur', 'company']),
  getInvoicesByCompany
);

// 🔹 Factures par compagnie
router.get(
  '/company',
  verifyToken,
  checkRole(['operateur', 'administrateur', 'superviseur', 'super_directeur', 'company']),
  getInvoicesByCompany
);

// 🔹 Confirmer une facture payée
router.put(
  '/confirm/:numero_facture',
  verifyToken,
  checkRole(['operateur', 'administrateur', 'superviseur', 'super_directeur', 'company']),
  confirmerFacture
);

// 🔹 Suppression définitive (ADMIN ONLY)
router.delete(
  '/delete/:numero_facture',
  verifyToken,
  checkRole(['administrateur', 'super_directeur']),
  deleteFacture
);

// 🔹 Mise à jour du statut (ADMIN / SUPERVISEUR)
router.put(
  '/statut',
  verifyToken,
  checkRole(['administrateur', 'superviseur', 'super_directeur']),
  updateFactureStatut
);

/* =========================================================
   ROUTES GÉNÉRIQUES
========================================================= */

// 🔹 Créer une facture
// 👉 opérateur + company
router.post(
  '/',
  verifyToken,
  // Allow operators, companies and administrators to create invoices
  checkRole(['operateur', 'company', 'administrateur']),
  createFacture
);

// 🔹 Soumettre une facture à validation (OPÉRATEUR ONLY)
router.post(
  '/submit/:numero_facture',
  verifyToken,
  checkRole(['operateur']),
  submitFactureForValidation
);

// 🔹 Valider une facture (SUPERVISEUR / DAF)
router.put(
  '/validate/:numero_facture',
  verifyToken,
  checkRole(['superviseur', 'super_directeur']),
  validateFacture
);

// 🔹 Rejeter une facture (SUPERVISEUR / DAF)
router.put(
  '/reject/:numero_facture',
  verifyToken,
  checkRole(['superviseur', 'super_directeur']),
  rejectFacture
);

// 🔹 Facture par numéro
router.get('/:numero_facture', verifyToken, getFactureByNumero);

// 🔹 Modifier une facture
// 👉 opérateur (créateur) + admin
router.put(
  '/:numero_facture',
  verifyToken,
  checkRole(['operateur', 'administrateur', 'super_directeur']),
  updateFacture
);

// 🔹 Archiver une facture
router.delete(
  '/:numero_facture',
  verifyToken,
  checkRole(['administrateur', 'superviseur', 'super_directeur']),
  archiveFacture
);

export default router;
