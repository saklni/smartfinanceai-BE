'use strict'

const { Router } = require('express')
const { body } = require('express-validator')
const rateLimit = require('express-rate-limit')
const controller = require('./forgotPassword.controller')
const { validate } = require('../../middleware/validate')

const router = Router()

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Terlalu banyak permintaan reset. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Terlalu banyak percobaan. Coba lagi dalam 5 menit.' },
})

router.post(
  '/forgot-password',
  forgotLimiter,
  [body('email').isEmail().withMessage('Format email tidak valid').normalizeEmail()],
  validate,
  controller.requestReset,
)

router.post(
  '/verify-reset-otp',
  otpLimiter,
  [
    body('email').isEmail().withMessage('Format email tidak valid').normalizeEmail(),
    body('otp_code').notEmpty().withMessage('Kode OTP wajib diisi').isLength({ min: 4, max: 8 }),
  ],
  validate,
  controller.verifyResetOtp,
)

router.post(
  '/reset-password',
  otpLimiter,
  [
    body('reset_token').notEmpty().withMessage('Reset token wajib diisi'),
    body('new_password')
      .isLength({ min: 8 }).withMessage('Password minimal 8 karakter')
      .matches(/(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password harus mengandung huruf dan angka'),
  ],
  validate,
  controller.resetPassword,
)

module.exports = router
