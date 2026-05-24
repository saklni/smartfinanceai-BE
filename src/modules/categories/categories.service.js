'use strict'

/**
 * categories.service.js (v2-fixed)
 *
 * PERUBAHAN v2:
 *   - Response sekarang menyertakan field `name` (Indonesia snake_case) DAN `label` (bahasa tampilan)
 *   - Frontend bisa pakai label untuk display, name untuk lookup ke AI
 *   - Urutan sorted: global dulu (user_id IS NULL), lalu custom user
 */

const db    = require('../../config/database')
const redis = require('../../config/redis')

function formatCategory(row) {
  return {
    id:         row.id,
    user_id:    row.user_id || null,
    name:       row.name,           // Indonesia snake_case — dipakai untuk AI lookup
    label:      row.label,          // Bahasa tampilan — dipakai frontend untuk display
    type:       row.type,
    icon:       row.icon || 'circle',
    is_default: row.user_id === null,
    created_at: row.created_at,
  }
}

async function getCategories(userId) {
  const userKey = `sf:cache:categories:${userId}`
  const cached  = await redis.get(userKey)
  if (cached) return cached

  const result = await db.query(
    `SELECT * FROM categories
     WHERE user_id IS NULL OR user_id = $1
     ORDER BY
       CASE WHEN user_id IS NULL THEN 0 ELSE 1 END ASC,
       id ASC`,
    [userId],
  )

  const data = result.rows.map(formatCategory)
  await redis.set(userKey, data, redis.TTL.CATEGORIES_CACHE)
  return data
}

async function createCategory(userId, payload) {
  const { name, label, type = 'expense', icon = 'circle' } = payload

  const existing = await db.query(
    'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND user_id = $2',
    [name.trim(), userId],
  )
  if (existing.rows.length) {
    throw Object.assign(new Error('Kategori dengan nama ini sudah ada'), { statusCode: 409 })
  }

  const result = await db.query(
    `INSERT INTO categories (user_id, name, label, type, icon)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, name.trim(), (label || name).trim(), type, icon],
  )

  await redis.del(`sf:cache:categories:${userId}`)
  return formatCategory(result.rows[0])
}

module.exports = { getCategories, createCategory }
