'use strict'

const { validationResult } = require('express-validator')
const { badRequest } = require('../utils/response')

/**
 * Run after express-validator checks.
 * Returns 400 with field errors if any check failed.
 */
function validate(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({ field: e.path, message: e.msg }))
    return badRequest(res, formatted[0].message, formatted)
  }
  return next()
}

module.exports = { validate }
