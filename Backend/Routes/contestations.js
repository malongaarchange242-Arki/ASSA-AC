import express from "express";
import {
  uploadContestationFiles,
  uploadContestation,
  decideContestation
} from "../Controllers/contestationCompagnie.js";

import { verifyToken, checkRole } from "../Middleware/auth.js";

export default function contestationsRoutesFactory(broadcastToRoom) {
  const router = express.Router();

  router.post(
    "/upload_contestation",
    verifyToken,
    uploadContestationFiles,   // <-- 🟩 Multer GÈRE req.body + req.files
    uploadContestation,        // <-- 🟩 Ton controller reçoit tout proprement
  );

  router.put(
    "/decision/:numero_facture",
    verifyToken,
    checkRole(['superviseur', 'super_directeur']),
    decideContestation
  );

  return router;
}
