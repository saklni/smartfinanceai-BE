'use strict'

const { Router } = require('express')
const { body, param } = require('express-validator')
const controller = require('./transactions.controller')
const { authenticate } = require('../../middleware/authenticate')
const { validate } = require('../../middleware/validate')

const router = Router()

router.use(authenticate)

const txBody = [
  body('title').trim().notEmpty().withMessage('Judul transaksi wajib diisi').isLength({ max: 200 }),
  body('type').isIn(['income', 'expense']).withMessage('Tipe harus income atau expense'),
  body('amount').isFloat({ min: 1 }).withMessage('Nominal harus lebih dari 0'),
  body('transaction_date').notEmpty().withMessage('Tanggal transaksi wajib diisi').isISO8601().withMessage('Format tanggal tidak valid'),
  body('category').optional().isString().trim(),
  body('category_id').optional().isInt({ min: 1 }),
  body('note').optional().isString().trim().isLength({ max: 500 }),
]

const idParam = [
  param('id').isInt({ min: 1 }).withMessage('ID transaksi tidak valid'),
]

// GET /api/transactions
router.get('/', controller.getTransactions)

// POST /api/transactions
router.post('/', txBody, validate, controller.createTransaction)

// PUT /api/transactions/:id
router.put('/:id', idParam, txBody, validate, controller.updateTransaction)

// DELETE /api/transactions/:id
router.delete('/:id', idParam, validate, controller.deleteTransaction)

module.exports = router
