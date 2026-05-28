'use strict'

const db = require('../../config/database')
const redis = require('../../config/redis')

const ANALYTICS_TTL = 5 * 60 

async function getSummary(userId) {
  const cacheKey = `sf:cache:analytics:summary:${userId}`
  const cached = await redis.get(cacheKey)
  if (cached) return cached

  const profileResult = await db.query(
    'SELECT monthly_income, saving_target FROM user_profiles WHERE user_id = $1',
    [userId],
  )
  const profile = profileResult.rows[0] || {}

  const txResult = await db.query(
    `SELECT type, SUM(amount) AS total
     FROM transactions
     WHERE user_id = $1
       AND date_trunc('month', transaction_date) = date_trunc('month', CURRENT_DATE)
     GROUP BY type`,
    [userId],
  )

  let income = 0
  let expense = 0
  txResult.rows.forEach((row) => {
    if (row.type === 'income') income = Number(row.total)
    if (row.type === 'expense') expense = Number(row.total)
  })

  const balance = income - expense
  const savingTarget = Number(profile.saving_target) || 0
  const monthlyIncome = Number(profile.monthly_income) || 0
  const savingProgress = savingTarget > 0
    ? Math.min(Math.round((Math.max(balance, 0) / savingTarget) * 100), 100) : 0
  const expenseRatio = income > 0 ? Math.round((expense / income) * 100) : 0
  const savingRate = income > 0 ? Math.round((Math.max(balance, 0) / income) * 100) : 0

  const data = {
    income, expense, balance,
    saving_target: savingTarget,
    monthly_income: monthlyIncome,
    saving_progress: savingProgress,
    expense_ratio: expenseRatio,
    saving_rate: savingRate,
  }

  await redis.set(cacheKey, data, ANALYTICS_TTL)
  return data
}

async function getCategoryData(userId) {
  const cacheKey = `sf:cache:analytics:categories:${userId}`
  const cached = await redis.get(cacheKey)
  if (cached) return cached

  const result = await db.query(
    `SELECT c.name, c.label, SUM(t.amount) AS value
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1 AND t.type = 'expense'
       AND date_trunc('month', t.transaction_date) = date_trunc('month', CURRENT_DATE)
     GROUP BY c.name, c.label
     ORDER BY value DESC`,
    [userId],
  )

  const data = result.rows.map((row) => ({
    name: row.label || row.name || 'Lainnya',
    value: Number(row.value),
  }))

  await redis.set(cacheKey, data, ANALYTICS_TTL)
  return data
}

async function getTrendData(userId) {
  const cacheKey = `sf:cache:analytics:trend:${userId}`
  const cached = await redis.get(cacheKey)
  if (cached) return cached

  const result = await db.query(
    `SELECT
       to_char(date_trunc('month', transaction_date), 'YYYY-MM') AS month_key,
       to_char(date_trunc('month', transaction_date), 'Mon YYYY') AS name,
       SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
     FROM transactions
     WHERE user_id = $1
       AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'
     GROUP BY month_key, name
     ORDER BY month_key ASC`,
    [userId],
  )

  const data = result.rows.map((row) => ({
    name: row.name,
    income: Number(row.income),
    expense: Number(row.expense),
  }))

  await redis.set(cacheKey, data, ANALYTICS_TTL)
  return data
}

async function invalidateCache(userId) {
  await Promise.all([
    redis.del(`sf:cache:analytics:summary:${userId}`),
    redis.del(`sf:cache:analytics:categories:${userId}`),
    redis.del(`sf:cache:analytics:trend:${userId}`),
  ])
}

module.exports = { getSummary, getCategoryData, getTrendData, invalidateCache }
