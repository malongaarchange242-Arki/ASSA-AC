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
// ROUTES SPÉCIFIQUES
// ===========================================================

// GÉNÉRER RÉFÉRENCE
router.get('/generate-ref', verifyToken, checkRole(['admin', 'supervisor']), generateRef);

// LISTE DES FACTURES (admin/supervisor voient tout, company voit les siennes)
router.get(
  '/',
  verifyToken,
  checkRole(['admin', 'supervisor', 'company']),
  getInvoicesByCompany
);

// FACTURES PAR COMPAGNIE (même logique)
router.get(
  '/company',
  verifyToken,
  checkRole(['admin', 'supervisor', 'company']),
  getInvoicesByCompany
);

// CONFIRMER FACTURE (payée)
router.put(
  '/confirm/:numero_facture',
  verifyToken,
  checkRole(['admin', 'supervisor', 'company']),
  confirmerFacture
);

// SUPPRESSION DÉFINITIVE (admin / supervisor)
router.delete(
  '/delete/:numero_facture',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  deleteFacture
);

// MISE À JOUR DU STATUT (admin / supervisor)
router.put(
  '/statut',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  updateFactureStatut
);

// ===========================================================
// ROUTES GÉNÉRIQUES (APRÈS LES SPÉCIFIQUES)
// ===========================================================

// CRÉER FACTURE
router.post(
  '/',
  verifyToken,
  checkRole(['admin', 'supervisor', 'company']),
  createFacture
);

// FACTURE PAR NUMÉRO (authentifié)
router.get(
  '/:numero_facture',
  verifyToken,
  getFactureByNumero
);

// METTRE À JOUR FACTURE (admin / supervisor)
router.put(
  '/:numero_facture',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  updateFacture
);

// ARCHIVER FACTURE (admin / supervisor)
router.delete(
  '/:numero_facture',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  archiveFacture
);

export default router;
