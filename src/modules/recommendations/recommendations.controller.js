'use strict'

const service = require('./recommendations.service')
const { success, error } = require('../../utils/response')

async function getRecommendations(req, res) {
  try {
    const data = await service.getRecommendations(req.user.id)
    return success(res, data)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

module.exports = { getRecommendations }
