'use strict'

const service = require('./analytics.service')
const { success, error } = require('../../utils/response')

async function getSummary(req, res) {
  try {
    const data = await service.getSummary(req.user.id)
    return success(res, data)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function getCategoryData(req, res) {
  try {
    const data = await service.getCategoryData(req.user.id)
    return success(res, data)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function getTrendData(req, res) {
  try {
    const data = await service.getTrendData(req.user.id)
    return success(res, data)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

module.exports = { getSummary, getCategoryData, getTrendData }
