// routes/companies.js

import express from 'express';
import { verifyToken } from '../Middleware/auth.js';
import { checkRole } from '../Middleware/role.js';
import upload from '../Middleware/upload.js';

import {
  requestFirstLoginOtp,
  validateOtpAndSetPassword,
  loginCompany,
  logoutCompany,
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

// ----------------- Routes publiques -----------------

// Première connexion : demander OTP
router.post('/first-login-otp', requestFirstLoginOtp);

// Valider OTP et définir mot de passe
router.post('/validate-otp', validateOtpAndSetPassword);

// Connexion
router.post('/login', loginCompany);

// ----------------- Routes protégées -----------------
// Lister toutes les compagnies
router.get(
  '/all',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  listCompanies
);

// Modifier une compagnie (admin/supervisor)
router.put(
  '/update-company/:id',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  upload.single('logo_url'),
  updateCompany
);

// Update profil compagnie
router.put(
  '/update',
  verifyToken,
  checkRole(['company']),
  upload.single('logo_url'),
  updateCompanyInfo
);

// Mot de passe compagnie
router.put(
  '/update-password',
  verifyToken,
  checkRole(['company']),
  updateCompanyPassword
);

// =======================
// Profil compagnie connecté
// =======================
router.get(
  '/me',
  verifyToken,
  checkRole(['company']),
  me
);


// Archivage
router.delete(
  '/:id',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  archiveCompany
);

// Restauration
router.patch(
  '/restore/:id',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  restoreCompany
);

// Get by id
router.get(
  '/:id',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  getCompanyById
);

// Suppression définitive
router.delete(
  '/delete/:id',
  verifyToken,
  checkRole(['admin', 'supervisor']),
  deleteCompanySafe
);

// Logout compagnie
router.post(
  '/logout',
  verifyToken,
  checkRole(['company']),
  logoutCompany
);

export default router;
