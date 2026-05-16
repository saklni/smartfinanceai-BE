'use strict'

const service = require('./forgotPassword.service')
const { success, error } = require('../../utils/response')

async function requestReset(req, res) {
  try {
    const result = await service.requestReset(req.body)
    return success(res, null, result.message)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function verifyResetOtp(req, res) {
  try {
    const result = await service.verifyResetOtp(req.body)
    return success(res, { reset_token: result.reset_token }, result.message)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function resetPassword(req, res) {
  try {
    const result = await service.resetPassword(req.body)
    return success(res, null, result.message)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

module.exports = { requestReset, verifyResetOtp, resetPassword }
