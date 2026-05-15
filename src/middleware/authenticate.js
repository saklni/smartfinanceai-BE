'use strict'

const jwt = require('jsonwebtoken')
const { unauthorized } = require('../utils/response')

/**
 * Verify Bearer JWT and attach req.user = { id, email, name }
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Token autentikasi tidak ditemukan')
  }

  const token = authHeader.slice(7)

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: payload.id, email: payload.email, name: payload.name }
    return next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Sesi telah berakhir, silakan masuk kembali')
    }
    return unauthorized(res, 'Token tidak valid')
  }
}

module.exports = { authenticate }
