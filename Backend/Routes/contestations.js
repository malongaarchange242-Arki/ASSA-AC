import express from "express";
import {
  uploadContestationFiles,
  uploadContestation
} from "../Controllers/contestationCompagnie.js";

import { verifyToken } from "../Middleware/auth.js";

export default function contestationsRoutesFactory(broadcastToRoom) {
  const router = express.Router();

  router.post(
    "/upload_contestation",
    verifyToken,
    uploadContestationFiles,   // <-- 🟩 Multer GÈRE req.body + req.files
    uploadContestation,        // <-- 🟩 Ton controller reçoit tout proprement
  );

  return router;
}
