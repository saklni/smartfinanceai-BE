'use strict'

const { Router } = require('express')
const controller = require('./analytics.controller')
const { authenticate } = require('../../middleware/authenticate')

const router = Router()

router.use(authenticate)

router.get('/summary', controller.getSummary)

router.get('/categories', controller.getCategoryData)

router.get('/trend', controller.getTrendData)

module.exports = router
