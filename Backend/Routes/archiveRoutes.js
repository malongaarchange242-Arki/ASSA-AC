import express from 'express';
import { getAllArchives } from '../Controllers/archiveController.js';

const router = express.Router();

// GET /api/archives
router.get('/', getAllArchives);

export default router;
