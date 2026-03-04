import express from 'express';
import { 
  uploadMiddleware, 
  uploadPreuvesPaiement, 
  getPreuveById,
  getPreuvesByFacture
} from '../Controllers/preuve_paiement.js';

import { verifyToken } from '../Middleware/auth.js';
import { checkRole } from '../Middleware/role.js';

const router = express.Router();

/* =========================================================
   UPLOAD PREUVE DE PAIEMENT
   - Company : peut envoyer sa preuve
   - Operateur : peut recevoir / enregistrer
========================================================= */
router.post(
  '/upload',
  verifyToken,
  checkRole(['company', 'operateur', 'administrateur', 'superviseur']),
  uploadMiddleware,
  uploadPreuvesPaiement
);

/* =========================================================
   RÉCUPÉRER LES PREUVES PAR FACTURE
   - Operateur : VOIT toutes les preuves
   - Admin / Superviseur : contrôle
   - Company : voit ses propres preuves
========================================================= */
router.get(
  '/by-facture/:numero_facture',
  verifyToken,
  checkRole(['company', 'operateur', 'administrateur', 'superviseur']),
  getPreuvesByFacture
);

/* =========================================================
   RÉCUPÉRER UNE PREUVE PAR ID
========================================================= */
router.get(
  '/:id',
  verifyToken,
  checkRole(['company', 'operateur', 'administrateur', 'superviseur']),
  getPreuveById
);

export default router;
