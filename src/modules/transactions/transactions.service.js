'use strict'

const db = require('../../config/database')
const redis = require('../../config/redis')
const { invalidateCache: invalidateAnalytics } = require('../analytics/analytics.service')
const { invalidateCache: invalidateRecommendations } = require('../recommendations/recommendations.service')

async function invalidateUserCache(userId) {
  await Promise.all([
    invalidateAnalytics(userId),
    invalidateRecommendations(userId),
  ])
}

function formatTransaction(row) {
  if (!row) return null
  const categoryName = row.category_name || 'Other'
  const transactionDate = row.transaction_date
    ? new Date(row.transaction_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  return {
    id: row.id,
    user_id: row.user_id,
    category_id: row.category_id,
    category: categoryName,
    category_name: categoryName,
    title: row.title,
    type: row.type,
    amount: Number(row.amount),
    transaction_date: transactionDate,
    date: transactionDate,
    note: row.note || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function getTransactions(userId) {
  const result = await db.query(
    `SELECT t.*, c.name AS category_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
     ORDER BY t.transaction_date DESC, t.created_at DESC`,
    [userId],
  )
  return result.rows.map(formatTransaction)
}

async function resolveCategoryId(userId, categoryId, category) {
  if (categoryId) return categoryId
  if (!category) return null
  const catResult = await db.query(
    `SELECT id FROM categories
     WHERE (name = $1 OR label = $1) AND (user_id IS NULL OR user_id = $2) LIMIT 1`,
    [category, userId],
  )
  return catResult.rows[0]?.id || null
}

async function createTransaction(userId, payload) {
  const { title, type, category_id, category, amount, transaction_date, note = '' } = payload
  const resolvedCategoryId = await resolveCategoryId(userId, category_id, category)

  const result = await db.query(
    `INSERT INTO transactions (user_id, category_id, title, type, amount, transaction_date, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [userId, resolvedCategoryId, title.trim(), type, Number(amount), transaction_date, note.trim()],
  )

  const row = result.rows[0]
  if (resolvedCategoryId) {
    const catRow = await db.query('SELECT name FROM categories WHERE id = $1', [resolvedCategoryId])
    row.category_name = catRow.rows[0]?.name || category || 'Other'
  } else {
    row.category_name = category || 'Other'
  }

  await invalidateUserCache(userId)
  return formatTransaction(row)
}

async function updateTransaction(userId, transactionId, payload) {
  const existing = await db.query(
    'SELECT id FROM transactions WHERE id = $1 AND user_id = $2',
    [transactionId, userId],
  )
  if (!existing.rows.length) {
    throw Object.assign(new Error('Transaksi tidak ditemukan'), { statusCode: 404 })
  }

  const { title, type, category_id, category, amount, transaction_date, note } = payload
  const resolvedCategoryId = await resolveCategoryId(userId, category_id, category)

  const result = await db.query(
    `UPDATE transactions
     SET title = $1, type = $2, category_id = $3, amount = $4,
         transaction_date = $5, note = $6, updated_at = NOW()
     WHERE id = $7 AND user_id = $8 RETURNING *`,
    [title.trim(), type, resolvedCategoryId, Number(amount),
     transaction_date, (note || '').trim(), transactionId, userId],
  )

  const row = result.rows[0]
  if (resolvedCategoryId) {
    const catRow = await db.query('SELECT name FROM categories WHERE id = $1', [resolvedCategoryId])
    row.category_name = catRow.rows[0]?.name || category || 'Other'
  } else {
    row.category_name = category || 'Other'
  }

  await invalidateUserCache(userId)
  return formatTransaction(row)
}

async function deleteTransaction(userId, transactionId) {
  const result = await db.query(
    'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
    [transactionId, userId],
  )
  if (!result.rows.length) {
    throw Object.assign(new Error('Transaksi tidak ditemukan'), { statusCode: 404 })
  }
  await invalidateUserCache(userId)
  return { id: transactionId }
}

module.exports = { getTransactions, createTransaction, updateTransaction, deleteTransaction }
