import express from 'express';
import { verifyToken } from '../Middleware/auth.js';
import { checkRole } from '../Middleware/role.js';
import upload from '../Middleware/upload.js';

import {
  requestFirstLoginOtp,
  validateOtpAndSetPassword,
  loginCompany,
  listCompanies,
  archiveCompany,
  restoreCompany,
  getCompanyById,
  updateCompanyInfo,
  updateCompany,
  deleteCompanySafe,
  updateCompanyPassword,
  me
} from '../Controllers/authCompaniesController.js';

const router = express.Router();

/* =========================================================
   ROUTES PUBLIQUES
========================================================= */

// 🔹 Première connexion : demander OTP
router.post('/first-login-otp', requestFirstLoginOtp);

// 🔹 Valider OTP et définir mot de passe
router.post('/validate-otp', validateOtpAndSetPassword);

// 🔹 Connexion compagnie
router.post('/login', loginCompany);

/* =========================================================
   ROUTES PROTÉGÉES
========================================================= */

// 🔹 Lister toutes les compagnies
// 👉 opérateur PEUT voir, mais PAS modifier
router.get(
  '/all',
  verifyToken,
  checkRole(['operateur', 'administrateur', 'superviseur', 'super_directeur']),
  listCompanies
);

// 🔹 Profil de la compagnie connectée
router.get(
  '/me',
  verifyToken,
  checkRole(['company']),
  me
);

// 🔹 Modifier une compagnie (ADMIN / SUPERVISEUR)
router.put(
  '/update-company/:id',
  verifyToken,
  checkRole(['administrateur', 'superviseur', 'super_directeur']),
  upload.single('logo_url'),
  updateCompany
);

// 🔹 Modifier ses propres infos (COMPANY)
router.put(
  '/update',
  verifyToken,
  checkRole(['company']),
  upload.single('logo_url'),
  updateCompanyInfo
);

// 🔹 Modifier son mot de passe (COMPANY)
router.put(
  '/update-password',
  verifyToken,
  checkRole(['company']),
  updateCompanyPassword
);

// 🔹 Archiver une compagnie
router.delete(
  '/:id',
  verifyToken,
  checkRole(['administrateur', 'superviseur', 'super_directeur']),
  archiveCompany
);

// 🔹 Restaurer une compagnie
router.patch(
  '/restore/:id',
  verifyToken,
  checkRole(['administrateur', 'superviseur', 'super_directeur']),
  restoreCompany
);

// 🔹 Récupérer une compagnie par ID
router.get(
  '/:id',
  verifyToken,
  checkRole(['administrateur', 'superviseur', 'super_directeur']),
  getCompanyById
);

// 🔹 Suppression définitive 
router.delete(
  '/delete/:id',
  verifyToken,
  checkRole(['super_directeur']),
  deleteCompanySafe
);

export default router;
