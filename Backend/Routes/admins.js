// routes/authAdminRoutes.js
import express from 'express';
import multer from 'multer';
import { verifyToken } from '../Middleware/auth.js';
import { checkRole } from '../Middleware/role.js';
import {
  loginAdmin,
  logoutAdmin,
  createCompany,
  listAdmins,
  updateAdminPassword,
  refreshTokenAdmin
} from '../Controllers/authAdmincontroller.js'; 

const router = express.Router();

// -----------------------------
// Multer configuration (stockage en mémoire)
// -----------------------------
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Autoriser uniquement certains types de fichiers
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format non autorisé. Seuls PNG, JPEG et GIF sont acceptés.'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // Limite 5MB
});

// -----------------------------
// Routes publiques
// -----------------------------
router.post('/login', loginAdmin); // Login admin

// -----------------------------
// Routes protégées (JWT)
// -----------------------------
router.post('/logout', verifyToken, logoutAdmin);

router.post('/token/refresh', refreshTokenAdmin); // Pas besoin de verifyToken ici

// -----------------------------
// Créer une compagnie
// - Accessible uniquement aux Admin / Superviseur
// - Upload du logo via Multer
// -----------------------------
router.post(
  '/create-company',
  verifyToken,
  checkRole(['Administrateur', 'Superviseur']),
  upload.single('logo_url'), // Le champ du formulaire attendu est "logo_url"
  createCompany
);

// -----------------------------
// Lister tous les admins / superviseurs
// - Accessible uniquement aux Admin / Superviseur
// -----------------------------
router.get(
  '/admins',
  verifyToken,
  checkRole(['Administrateur', 'Superviseur']),
  listAdmins
);

// -----------------------------
// Mettre à jour le mot de passe
// - Accessible à tout admin connecté
// -----------------------------
router.post(
  '/update-password',
  verifyToken,
  updateAdminPassword
);

export default router;
