'use strict'

const db = require('../../config/database')

function formatCategory(row) {
  return {
    id: row.id,
    user_id: row.user_id || null,
    name: row.name,
    label: row.label,
    type: row.type,
    icon: row.icon || 'circle',
    created_at: row.created_at,
  }
}

async function getCategories(userId) {
  const result = await db.query(
    `SELECT * FROM categories
     WHERE user_id IS NULL OR user_id = $1
     ORDER BY id ASC`,
    [userId],
  )
  return result.rows.map(formatCategory)
}

async function createCategory(userId, payload) {
  const { name, label, type = 'expense', icon = 'circle' } = payload

  const existing = await db.query(
    'SELECT id FROM categories WHERE name = $1 AND user_id = $2',
    [name, userId],
  )
  if (existing.rows.length) {
    throw Object.assign(new Error('Kategori dengan nama ini sudah ada'), { statusCode: 409 })
  }

  const result = await db.query(
    `INSERT INTO categories (user_id, name, label, type, icon)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, name.trim(), (label || name).trim(), type, icon],
  )
  return formatCategory(result.rows[0])
}

module.exports = { getCategories, createCategory }
