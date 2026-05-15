'use strict'

const service = require('./transactions.service')
const { success, error } = require('../../utils/response')

async function getTransactions(req, res) {
  try {
    const data = await service.getTransactions(req.user.id)
    return success(res, data)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function createTransaction(req, res) {
  try {
    const data = await service.createTransaction(req.user.id, req.body)
    return success(res, data, 'Transaksi berhasil ditambahkan', 201)
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function updateTransaction(req, res) {
  try {
    const data = await service.updateTransaction(req.user.id, Number(req.params.id), req.body)
    return success(res, data, 'Transaksi berhasil diperbarui')
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

async function deleteTransaction(req, res) {
  try {
    const data = await service.deleteTransaction(req.user.id, Number(req.params.id))
    return success(res, data, 'Transaksi berhasil dihapus')
  } catch (err) {
    return error(res, err.message, err.statusCode || 500)
  }
}

module.exports = { getTransactions, createTransaction, updateTransaction, deleteTransaction }
