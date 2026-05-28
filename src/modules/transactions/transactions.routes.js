'use strict'

const { Router } = require('express')
const { body, param } = require('express-validator')
const controller = require('./transactions.controller')
const { authenticate } = require('../../middleware/authenticate')
const { validate } = require('../../middleware/validate')

const router = Router()

router.use(authenticate)

const txBody = [
  body('title')
    .trim()
    .notEmpty().withMessage('Judul transaksi wajib diisi')
    .isLength({ max: 200 }).withMessage('Judul maksimal 200 karakter'),

  body('type')
    .isIn(['income', 'expense']).withMessage('Tipe harus income atau expense'),

  body('amount')
    .notEmpty().withMessage('Nominal wajib diisi')
    .isFloat({ min: 1 }).withMessage('Nominal harus lebih dari 0'),

  body('transaction_date')
    .notEmpty().withMessage('Tanggal transaksi wajib diisi')
    .isISO8601().withMessage('Format tanggal tidak valid (gunakan YYYY-MM-DD)'),

  
  body('category')
    .optional({ nullable: true, checkFalsy: true })
    .isString().trim(),

  
  body('category_id')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      const num = Number(value)
      if (!Number.isInteger(num) || num < 1) {
        throw new Error('category_id harus berupa angka bulat positif')
      }
      return true
    }),

  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .isString().trim()
    .isLength({ max: 500 }).withMessage('Deskripsi maksimal 500 karakter'),

  body('note')
    .optional({ nullable: true, checkFalsy: true })
    .isString().trim()
    .isLength({ max: 500 }).withMessage('Catatan maksimal 500 karakter'),
]

const idParam = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID transaksi tidak valid'),
]

router.get('/',     controller.getTransactions)
router.post('/',    txBody,         validate, controller.createTransaction)
router.put('/:id',  idParam, txBody, validate, controller.updateTransaction)
router.delete('/:id', idParam,      validate, controller.deleteTransaction)

module.exports = router
