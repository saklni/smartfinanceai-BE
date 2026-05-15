'use strict'

const { Router } = require('express')
const controller = require('./recommendations.controller')
const { authenticate } = require('../../middleware/authenticate')

const router = Router()

router.use(authenticate)

// GET /api/recommendations
router.get('/', controller.getRecommendations)

module.exports = router
