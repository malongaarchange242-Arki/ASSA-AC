import express from 'express';
import multer from 'multer';
import { verifyToken } from '../Middleware/auth.js';
import { checkRole } from '../Middleware/role.js';
import {
  loginAdmin,
  loginSuperviseur,
  logoutAdmin,
  createCompany,
  listAdmins,
  updateAdminPassword,
  refreshTokenAdmin
} from '../Controllers/authAdmincontroller.js';

const router = express.Router();

/* ---------------------------------------------------------
   📦 Multer (stockage mémoire)
----------------------------------------------------------*/
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non autorisé (PNG, JPG, GIF uniquement)'));
    }
  }
});

/* ---------------------------------------------------------
   🔓 ROUTES PUBLIQUES
----------------------------------------------------------*/
router.post('/login', loginAdmin);
router.post('/login/superviseur', loginSuperviseur);

/* ---------------------------------------------------------
   🔐 AUTH / TOKENS
----------------------------------------------------------*/

// Logout → supprime les cookies
router.post('/logout', verifyToken, logoutAdmin);

// Refresh token → lit refreshToken depuis cookie
router.post('/token/refresh', refreshTokenAdmin);

/* ---------------------------------------------------------
   🏢 COMPAGNIES
   - Admin / Superviseur uniquement
----------------------------------------------------------*/
router.post(
  '/create-company',
  verifyToken,
  checkRole(['Administrateur', 'Superviseur', 'Super Admin']),
  upload.single('logo_url'),
  createCompany
);

/* ---------------------------------------------------------
   👥 ADMINS / SUPERVISEURS
   - Super Admin uniquement
----------------------------------------------------------*/
router.get(
  '/admins',
  verifyToken,
  checkRole(['Super Admin']),
  listAdmins
);

/* ---------------------------------------------------------
   🔑 MOT DE PASSE
   - Tout admin connecté
----------------------------------------------------------*/
router.post(
  '/update-password',
  verifyToken,
  updateAdminPassword
);

export default router;
