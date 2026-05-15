'use strict'

const { Router } = require('express')
const { body } = require('express-validator')
const rateLimit = require('express-rate-limit')
const controller = require('./auth.controller')
const { authenticate } = require('../../middleware/authenticate')
const { validate } = require('../../middleware/validate')

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Terlalu banyak permintaan OTP. Coba lagi dalam 5 menit.' },
})

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Nama lengkap wajib diisi').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Format email tidak valid').normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password minimal 8 karakter')
      .matches(/(?=.*[A-Za-z])(?=.*\d)/).withMessage('Password harus mengandung huruf dan angka'),
  ],
  validate,
  controller.register,
)

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Format email tidak valid').normalizeEmail(),
    body('password').notEmpty().withMessage('Password wajib diisi'),
  ],
  validate,
  controller.login,
)

// POST /api/auth/google
router.post(
  '/google',
  authLimiter,
  [body('credential').notEmpty().withMessage('Google credential wajib diisi')],
  validate,
  controller.loginWithGoogle,
)

// POST /api/auth/verify-otp
router.post(
  '/verify-otp',
  otpLimiter,
  [
    body('email').isEmail().withMessage('Format email tidak valid').normalizeEmail(),
    body('otp_code').notEmpty().withMessage('Kode OTP wajib diisi').isLength({ min: 4, max: 8 }),
    body('purpose').optional().isIn(['register', 'reset_password']),
  ],
  validate,
  controller.verifyOtp,
)

// POST /api/auth/resend-otp
router.post(
  '/resend-otp',
  otpLimiter,
  [
    body('email').isEmail().withMessage('Format email tidak valid').normalizeEmail(),
    body('purpose').optional().isIn(['register', 'reset_password']),
  ],
  validate,
  controller.resendOtp,
)

// GET /api/auth/me
router.get('/me', authenticate, controller.getProfile)

// PUT /api/auth/me
router.put(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('nickname').optional().trim().isLength({ max: 50 }),
    body('monthly_income').optional().isFloat({ min: 0 }),
    body('saving_target').optional().isFloat({ min: 0 }),
    body('age_range').optional().isIn(['<18', '18-24', '25-34', '35+']),
    body('spending_style').optional().isIn(['frugal', 'balanced', 'impulsive']),
    body('financial_goal').optional().isIn(['saving', 'control_expense', 'emergency_fund', 'budgeting']),
    body('main_priority').optional().isIn([
      'reduce_unnecessary_expense', 'understand_spending_pattern',
      'increase_saving', 'financial_planning',
    ]),
    body('risk_profile').optional().isIn(['conservative', 'moderate', 'aggressive']),
    body('onboarding_completed').optional().isBoolean(),
  ],
  validate,
  controller.updateProfile,
)

module.exports = router
