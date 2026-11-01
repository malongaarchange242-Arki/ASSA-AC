// routes/auth.js
import express from 'express'
import {
  checkUserRole,
  requestPasswordResetOtp,
  resetPasswordWithOtp
} from '../Controllers/authCommonController.js'

const router = express.Router()

// Vérifier rôle par email (utilisé par la page de connexion)
router.post('/check-email', checkUserRole)
router.post('/password-reset/request', requestPasswordResetOtp)
router.post('/password-reset/confirm', resetPasswordWithOtp)

export default router
