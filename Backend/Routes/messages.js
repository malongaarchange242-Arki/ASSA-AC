// Routes/messages.js
import express from 'express';
import multer from 'multer';
import { getMessagesHistory, postMessage, uploadAndSendProof, markMessagesAsRead, countUnreadMessagesCompany, countUnreadMessagesAdmin } from '../Controllers/messagesController.js';
import { verifyToken, checkRole } from '../Middleware/auth.js';

const router = express.Router();

// Multer memory storage (max 10MB par fichier, max 5 fichiers)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }
});

export default (broadcastToRoom) => {
  // --- Historique messages (accessible aux Companies et Admins) ---
  router.get(
    '/history',
    verifyToken,
    checkRole(['Company', 'Administrateur']), // Les rôles doivent correspondre à req.user.profile
    getMessagesHistory
  );

  // --- Envoi message avec pièces jointes ---
  router.post(
    '/',
    verifyToken,
    checkRole(['Company', 'Administrateur']),
    upload.array('attachments'),
    (req, res) => postMessage(req, res, broadcastToRoom)
  );

  // --- Upload preuve + envoi automatique message ---
  router.post(
    '/preuves',
    verifyToken,
    checkRole(['Company', 'Administrateur']),
    upload.array('file'), // le champ 'file' du formulaire paiement
    (req, res) => uploadAndSendProof(req, res, broadcastToRoom)
  );

  router.get('/messages/unread/admin', verifyToken, countUnreadMessagesAdmin);
  router.get('/messages/unread/company', verifyToken, countUnreadMessagesCompany);

  router.put(
    '/messages/mark-read/:companyId',
    verifyToken,
    markMessagesAsRead
  );


  return router;
};
