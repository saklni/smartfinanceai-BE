'use strict'

const { Router } = require('express')
const controller = require('./analytics.controller')
const { authenticate } = require('../../middleware/authenticate')

const router = Router()

router.use(authenticate)

// GET /api/analytics/summary
router.get('/summary', controller.getSummary)

// GET /api/analytics/categories
router.get('/categories', controller.getCategoryData)

// GET /api/analytics/trend
router.get('/trend', controller.getTrendData)

module.exports = router
