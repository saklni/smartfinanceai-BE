'use strict'

/**
 * Send a success response — matches the envelope the FE's unwrapApiResponse expects.
 * { success: true, message, data }
 */
function success(res, data = null, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  })
}

/**
 * Send an error response.
 * { success: false, message, errors? }
 */
function error(res, message = 'Terjadi kesalahan', statusCode = 500, errors = null) {
  const body = { success: false, message }
  if (errors) body.errors = errors
  return res.status(statusCode).json(body)
}

/**
 * 400 Bad Request
 */
function badRequest(res, message = 'Permintaan tidak valid', errors = null) {
  return error(res, message, 400, errors)
}

/**
 * 401 Unauthorized
 */
function unauthorized(res, message = 'Tidak terautentikasi') {
  return error(res, message, 401)
}

/**
 * 403 Forbidden
 */
function forbidden(res, message = 'Akses ditolak') {
  return error(res, message, 403)
}

/**
 * 404 Not Found
 */
function notFound(res, message = 'Data tidak ditemukan') {
  return error(res, message, 404)
}

/**
 * 409 Conflict
 */
function conflict(res, message = 'Data sudah ada') {
  return error(res, message, 409)
}

module.exports = { success, error, badRequest, unauthorized, forbidden, notFound, conflict }
