// Routes/messages.js
import express from 'express';
import multer from 'multer';
import {
  getMessagesHistory,
  postMessage,
  uploadAndSendProof,
  markMessagesAsRead,
  countUnreadMessagesCompany,
  countUnreadMessagesAdmin
} from '../Controllers/messagesController.js';
import { verifyToken, checkRole } from '../Middleware/auth.js';

const router = express.Router();

// ---------------------------
// Multer (memory storage)
// ---------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB par fichier
    files: 5
  }
});

export default (broadcastToRoom) => {

  // ---------------------------
  // Historique des messages
  // admin + company
  // GET /messages/history?id_companie=xxx
  // ---------------------------
  router.get(
    '/history',
    verifyToken,
    checkRole(['admin', 'company']),
    getMessagesHistory
  );

  // ---------------------------
  // Envoi message (texte + pièces jointes)
  // admin + company
  // POST /messages
  // ---------------------------
  router.post(
    '/',
    verifyToken,
    checkRole(['admin', 'company']),
    upload.array('attachments'),
    (req, res) => postMessage(req, res, broadcastToRoom)
  );

  // ---------------------------
  // Upload preuve + message automatique
  // company (admin autorisé si besoin)
  // POST /messages/preuves
  // ---------------------------
  router.post(
    '/preuves',
    verifyToken,
    checkRole(['admin', 'company']),
    upload.array('file'),
    (req, res) => uploadAndSendProof(req, res, broadcastToRoom)
  );

  // ---------------------------
  // Compteur messages non lus (ADMIN)
  // GET /messages/unread/admin
  // ---------------------------
  router.get(
    '/unread/admin',
    verifyToken,
    checkRole(['admin']),
    countUnreadMessagesAdmin
  );

  // ---------------------------
  // Compteur messages non lus (COMPANY)
  // GET /messages/unread/company
  // ---------------------------
  router.get(
    '/unread/company',
    verifyToken,
    checkRole(['company']),
    countUnreadMessagesCompany
  );

  // ---------------------------
  // Marquer messages comme lus (ADMIN)
  // PUT /messages/mark-read/:companyId
  // ---------------------------
  router.put(
    '/mark-read/:companyId',
    verifyToken,
    checkRole(['admin']),
    markMessagesAsRead
  );

  return router;
};
