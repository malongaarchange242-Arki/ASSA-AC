import express from 'express';
import { verifyToken, checkRole } from '../Middleware/auth.js';
import { uploadContestationFiles, submitContestation } from '../Controllers/contestationCompagnie.js';

export default function contestationsRoutesFactory(broadcastToRoom) {
  const router = express.Router();

  router.post(
    '/',
    verifyToken,
    checkRole(['Company', 'Administrateur']),
    uploadContestationFiles,
    (req, res) => submitContestation(req, res, broadcastToRoom)
  );

  return router;
}

