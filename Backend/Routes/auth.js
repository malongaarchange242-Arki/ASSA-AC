// routes/auth.js
import express from 'express'
import { checkUserRole } from '../Controllers/authCommonController.js'

const router = express.Router()

// Vérifier rôle par email (utilisé par la page de connexion)
router.post('/check-email', checkUserRole)

export default router
