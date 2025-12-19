// routes/companies.js

import express from 'express';
import { verifyToken } from '../Middleware/auth.js';
import { checkRole } from '../Middleware/role.js';
import upload from '../Middleware/upload.js';

import {
  requestFirstLoginOtp,
  validateOtpAndSetPassword,
  loginCompany,
  listCompanies,
  archiveCompany,      // archivage au lieu de suppression
  restoreCompany,      // restauration si nécessaire
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
  checkRole(['Administrateur', 'Superviseur']),
  listCompanies
);

// Profil de la compagnie authentifiée
router.get('/me', verifyToken, me);

// Modifier une compagnie
router.put(
  '/update-company/:id',
  verifyToken,
  checkRole(['Administrateur', 'Superviseur']),
  upload.single('logo_url'),
  updateCompany
);

router.put(
  '/update',
  verifyToken,
  checkRole(['Company']),
  upload.single('logo_url'),
  updateCompanyInfo
);

// Modifier le mot de passe (compagnie connectée)
router.put(
  '/update-password',
  verifyToken,
  checkRole(['Company']),
  updateCompanyPassword
);



// Archiver une compagnie
router.delete(
  '/:id',
  verifyToken,
  checkRole(['Administrateur', 'Superviseur']),
  archiveCompany
);

// Restaurer une compagnie
router.patch(
  '/restore/:id',
  verifyToken,
  checkRole(['Administrateur', 'Superviseur']),
  restoreCompany
);

// Récupérer une compagnie par ID
router.get(
  '/:id',
  verifyToken,
  checkRole(['Administrateur', 'Superviseur']),
  getCompanyById
);

// Supprimer une compagnie définitivement
router.delete(
  '/delete/:id',
  verifyToken,
  checkRole(['Administrateur', 'Superviseur']),
  deleteCompanySafe
);


export default router;
