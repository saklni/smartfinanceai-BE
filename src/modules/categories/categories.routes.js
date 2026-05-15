'use strict'

const { Router } = require('express')
const { body } = require('express-validator')
const controller = require('./categories.controller')
const { authenticate } = require('../../middleware/authenticate')
const { validate } = require('../../middleware/validate')

const router = Router()

router.use(authenticate)

router.get('/', controller.getCategories)

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Nama kategori wajib diisi').isLength({ max: 100 }),
    body('label').optional().trim().isLength({ max: 100 }),
    body('type').optional().isIn(['income', 'expense']),
    body('icon').optional().isString().trim(),
  ],
  validate,
  controller.createCategory,
)

module.exports = router
