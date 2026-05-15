'use strict'

const service = require('./categories.service')
const { success, error } = require('../../utils/response')

async function getCategories(req, res) {
  try {
    const data = await service.getCategories(req.user.id)
    return success(res, data)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function createCategory(req, res) {
  try {
    const data = await service.createCategory(req.user.id, req.body)
    return success(res, data, 'Kategori berhasil ditambahkan', 201)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

module.exports = { getCategories, createCategory }
