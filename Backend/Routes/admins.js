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
  refreshTokenAdmin,
  meAdmin
} from '../Controllers/authAdmincontroller.js';

const router = express.Router();

/* ---------------------------------------------------------
   📦 Multer (mémoire)
----------------------------------------------------------*/
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Format non autorisé'));
  }
});

/* ---------------------------------------------------------
   🔓 ROUTES PUBLIQUES
----------------------------------------------------------*/
router.post('/login', loginAdmin);
router.post('/login/superviseur', loginSuperviseur);
router.post('/token/refresh', refreshTokenAdmin);
router.post('/logout', logoutAdmin);

/* ---------------------------------------------------------
   🔐 SESSION
----------------------------------------------------------*/
router.get('/me', verifyToken, meAdmin);

/* ---------------------------------------------------------
   🏢 COMPAGNIES
----------------------------------------------------------*/
router.post(
  '/create-company',
  verifyToken,
  checkRole(['Administrateur', 'Superviseur', 'Super Admin']),
  upload.single('logo_url'),
  createCompany
);

/* ---------------------------------------------------------
   👥 ADMINS
----------------------------------------------------------*/
router.get(
  '/admins',
  verifyToken,
  checkRole(['Super Admin']),
  listAdmins
);

/* ---------------------------------------------------------
   🔑 MOT DE PASSE
----------------------------------------------------------*/
router.post(
  '/update-password',
  verifyToken,
  updateAdminPassword
);

export default router;
