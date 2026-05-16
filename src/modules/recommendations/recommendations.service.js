'use strict'

const db = require('../../config/database')
const redis = require('../../config/redis')

// ─── Rule-based engine ────────────────────────────────────────────────────────

function getSummary(transactions, user) {
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const balance = income - expense
  const savingTarget = Number(user.saving_target || 0)
  const savingProgress = savingTarget > 0
    ? Math.min(Math.round((Math.max(balance, 0) / savingTarget) * 100), 100)
    : 0
  const expenseRatio = income > 0 ? Math.round((expense / income) * 100) : 0
  const savingRate = income > 0 ? Math.round((Math.max(balance, 0) / income) * 100) : 0
  return { income, expense, balance, savingProgress, expenseRatio, savingRate }
}

function getCategoryData(transactions) {
  const map = {}
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const key = t.category_name || t.category || 'Lainnya'
      map[key] = (map[key] || 0) + Number(t.amount)
    })
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

function buildRecommendations(transactions, user) {
  if (!transactions.length) {
    return [{
      id: 'empty-transaction',
      recommendation_type: 'starter',
      title: 'Mulai dari transaksi pertama',
      text: 'Tambahkan pemasukan dan pengeluaran pertamamu agar SmartFinance AI bisa membuat insight yang relevan.',
      message: 'Tambahkan pemasukan dan pengeluaran pertamamu agar SmartFinance AI bisa membuat insight yang relevan.',
      priority: 'medium',
      source: 'rule_based',
    }]
  }

  const summary = getSummary(transactions, user)
  const categories = getCategoryData(transactions)
  const topCategory = categories[0]
  const recs = []

  if (topCategory) {
    recs.push({
      id: 'top-category',
      recommendation_type: 'spending_pattern',
      title: 'Kategori pengeluaran terbesar',
      text: `${topCategory.name} menjadi pengeluaran terbesar. Coba tetapkan batas mingguan agar cashflow lebih terkontrol.`,
      message: `${topCategory.name} menjadi pengeluaran terbesar. Coba tetapkan batas mingguan agar cashflow lebih terkontrol.`,
      priority: 'high',
      source: 'rule_based',
    })
  }

  if (summary.expenseRatio > 70) {
    recs.push({
      id: 'expense-ratio-high',
      recommendation_type: 'cashflow_health',
      title: 'Rasio pengeluaran cukup tinggi',
      text: `Pengeluaranmu sekitar ${summary.expenseRatio}% dari pemasukan. Target aman adalah menjaga pengeluaran di bawah 70%.`,
      message: `Pengeluaranmu sekitar ${summary.expenseRatio}% dari pemasukan. Target aman adalah menjaga pengeluaran di bawah 70%.`,
      priority: 'high',
      source: 'rule_based',
    })
  } else {
    recs.push({
      id: 'expense-ratio-safe',
      recommendation_type: 'cashflow_health',
      title: 'Cashflow mulai terkendali',
      text: `Rasio pengeluaranmu sekitar ${summary.expenseRatio}%. Pertahankan kebiasaan ini dan alokasikan selisihnya untuk tabungan.`,
      message: `Rasio pengeluaranmu sekitar ${summary.expenseRatio}%. Pertahankan kebiasaan ini dan alokasikan selisihnya untuk tabungan.`,
      priority: 'medium',
      source: 'rule_based',
    })
  }

  const goal = user.financial_goal
  const style = user.spending_style

  if (goal === 'emergency_fund') {
    recs.push({
      id: 'emergency-fund',
      recommendation_type: 'goal_based',
      title: 'Fokus dana darurat',
      text: 'Karena tujuanmu membangun dana darurat, prioritaskan menyisihkan dana tetap setelah pemasukan masuk.',
      message: 'Karena tujuanmu membangun dana darurat, prioritaskan menyisihkan dana tetap setelah pemasukan masuk.',
      priority: 'medium',
      source: 'rule_based',
    })
  } else if (style === 'impulsive') {
    recs.push({
      id: 'impulsive-spending',
      recommendation_type: 'behavior_based',
      title: 'Kurangi pembelian impulsif',
      text: 'Gunakan aturan tunggu 24 jam sebelum membeli barang non-prioritas agar pengeluaran tidak membengkak.',
      message: 'Gunakan aturan tunggu 24 jam sebelum membeli barang non-prioritas agar pengeluaran tidak membengkak.',
      priority: 'medium',
      source: 'rule_based',
    })
  } else {
    recs.push({
      id: 'budget-method',
      recommendation_type: 'budgeting',
      title: 'Strategi budget sederhana',
      text: 'Gunakan metode 50/30/20: kebutuhan, gaya hidup, dan tabungan agar alokasi uang lebih terstruktur.',
      message: 'Gunakan metode 50/30/20: kebutuhan, gaya hidup, dan tabungan agar alokasi uang lebih terstruktur.',
      priority: 'low',
      source: 'rule_based',
    })
  }

  if (summary.savingProgress > 0 && summary.savingProgress < 50 && user.saving_target > 0) {
    recs.push({
      id: 'saving-progress-low',
      recommendation_type: 'saving',
      title: 'Progress tabungan masih rendah',
      text: `Progress tabunganmu baru ${summary.savingProgress}% dari target. Coba otomasi sisihkan sebagian penghasilan di awal bulan.`,
      message: `Progress tabunganmu baru ${summary.savingProgress}% dari target. Coba otomasi sisihkan sebagian penghasilan di awal bulan.`,
      priority: 'medium',
      source: 'rule_based',
    })
  }

  return recs
}

// ─── Service ──────────────────────────────────────────────────────────────────

async function getRecommendations(userId) {
  // Cek cache Redis
  const cacheKey = redis.keys.recommendationsCache(userId)
  const cached = await redis.get(cacheKey)
  if (cached) return cached

  const userResult = await db.query(
    `SELECT u.*, row_to_json(up.*) AS profile
     FROM users u
     LEFT JOIN user_profiles up ON up.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  )
  if (!userResult.rows.length) throw Object.assign(new Error('User tidak ditemukan'), { statusCode: 404 })

  const rawUser = userResult.rows[0]
  const profile = rawUser.profile || {}
  const user = {
    monthly_income: Number(profile.monthly_income) || 0,
    saving_target: Number(profile.saving_target) || 0,
    financial_goal: profile.financial_goal || '',
    spending_style: profile.spending_style || '',
    main_priority: profile.main_priority || '',
    risk_profile: profile.risk_profile || 'moderate',
  }

  const txResult = await db.query(
    `SELECT t.*, c.name AS category_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
       AND t.transaction_date >= date_trunc('month', CURRENT_DATE)
     ORDER BY t.transaction_date DESC`,
    [userId],
  )

  // Cek saved recommendations dari DB
  const savedResult = await db.query(
    `SELECT * FROM recommendations
     WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC`,
    [userId],
  )

  let data
  if (savedResult.rows.length > 0) {
    data = savedResult.rows.map((row) => ({
      id: row.id,
      recommendation_type: row.recommendation_type,
      title: row.title,
      text: row.message,
      message: row.message,
      priority: row.priority,
      source: row.source,
      action: row.action || '',
      expires_at: row.expires_at,
    }))
  } else {
    data = buildRecommendations(txResult.rows, user)
  }

  // Simpan ke Redis cache (30 menit)
  await redis.set(cacheKey, data, redis.TTL.RECOMMENDATIONS_CACHE)

  return data
}

async function invalidateCache(userId) {
  await redis.del(redis.keys.recommendationsCache(userId))
}

module.exports = { getRecommendations, invalidateCache }
