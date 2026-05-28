'use strict'

const db    = require('../../config/database')
const redis = require('../../config/redis')
const { getAiAnalysis, invalidateAiCache } = require('./aiService')

function getSummary(transactions, user) {
  const income  = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const balance = income - expense
  const savingTarget  = Number(user.saving_target || 0)
  const savingProgress = savingTarget > 0
    ? Math.min(Math.round((Math.max(balance, 0) / savingTarget) * 100), 100) : 0
  const expenseRatio  = income > 0 ? Math.round((expense / income) * 100) : 0
  const savingRate    = income > 0 ? Math.round((Math.max(balance, 0) / income) * 100) : 0
  return { income, expense, balance, savingProgress, expenseRatio, savingRate }
}

function getCategoryData(transactions) {
  const map = {}
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const key = t.category_name || 'Lainnya'
      map[key] = (map[key] || 0) + Number(t.amount)
    })
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

function buildFallbackRecommendations(transactions, user) {
  if (!transactions.length) {
    return [{
      id: 'empty-transaction',
      recommendation_type: 'starter',
      title: 'Mulai dari transaksi pertama',
      text: 'Tambahkan pemasukan dan pengeluaran pertamamu agar SmartFinance AI bisa membuat insight yang relevan.',
      priority: 'medium',
      source: 'rule_based',
      label: null,
      confidence: null,
    }]
  }

  const summary    = getSummary(transactions, user)
  const categories = getCategoryData(transactions)
  const topCategory = categories[0]
  const recs = []

  if (topCategory) {
    recs.push({
      id: 'top-category',
      recommendation_type: 'spending_pattern',
      title: 'Kategori pengeluaran terbesar',
      text: `${topCategory.name.replace(/_/g, ' ')} menjadi pengeluaran terbesar. Coba tetapkan batas mingguan agar cashflow lebih terkontrol.`,
      priority: 'high',
      source: 'rule_based',
      label: null,
      confidence: null,
    })
  }

  if (summary.expenseRatio > 70) {
    recs.push({
      id: 'expense-ratio-high',
      recommendation_type: 'cashflow_health',
      title: 'Rasio pengeluaran cukup tinggi',
      text: `Pengeluaranmu sekitar ${summary.expenseRatio}% dari pemasukan. Target aman adalah menjaga pengeluaran di bawah 70%.`,
      priority: 'high',
      source: 'rule_based',
      label: null,
      confidence: null,
    })
  } else {
    recs.push({
      id: 'expense-ratio-safe',
      recommendation_type: 'cashflow_health',
      title: 'Cashflow mulai terkendali',
      text: `Rasio pengeluaranmu sekitar ${summary.expenseRatio}%. Pertahankan dan alokasikan selisihnya untuk tabungan.`,
      priority: 'medium',
      source: 'rule_based',
      label: null,
      confidence: null,
    })
  }

  const goal  = user.financial_goal
  const style = user.spending_style
  if (goal === 'emergency_fund') {
    recs.push({ id: 'emergency-fund', recommendation_type: 'goal_based', title: 'Fokus dana darurat', text: 'Karena tujuanmu membangun dana darurat, prioritaskan menyisihkan dana tetap setelah pemasukan masuk.', priority: 'medium', source: 'rule_based', label: null, confidence: null })
  } else if (style === 'impulsive') {
    recs.push({ id: 'impulsive-spending', recommendation_type: 'behavior_based', title: 'Kurangi pembelian impulsif', text: 'Gunakan aturan tunggu 24 jam sebelum membeli barang non-prioritas.', priority: 'medium', source: 'rule_based', label: null, confidence: null })
  } else {
    recs.push({ id: 'budget-method', recommendation_type: 'budgeting', title: 'Strategi budget sederhana', text: 'Gunakan metode 50/30/20: kebutuhan, gaya hidup, dan tabungan agar alokasi uang lebih terstruktur.', priority: 'low', source: 'rule_based', label: null, confidence: null })
  }

  return recs
}

function formatAiResponse(aiResult) {
  const recs = []
  const label      = aiResult.label || ''
  const confidence = aiResult.confidence || 0
  const savingsPct = aiResult.savings_pct || 0

  
  recs.push({
    id: 'ai-label',
    recommendation_type: 'ai_classification',
    title: `Profil Keuangan: ${label}`,
    text: aiResult.financial_health || `Kamu diklasifikasikan sebagai ${label} dengan tingkat keyakinan ${(confidence * 100).toFixed(0)}%.`,
    priority: label === 'Boros' ? 'high' : label === 'Normal' ? 'medium' : 'low',
    source: 'llm',
    label,
    confidence,
    savings_pct: savingsPct,
  })

  
  if (aiResult.recommendation_summary || aiResult.summary_recommendation) {
    recs.push({
      id: 'ai-summary',
      recommendation_type: 'ai_summary',
      title: 'Ringkasan Keuangan Bulan Ini',
      text: aiResult.recommendation_summary || aiResult.summary_recommendation,
      priority: 'high',
      source: 'llm',
      label,
      confidence,
    })
  }

  
  const catRecs = aiResult.category_recommendations || {}
  Object.entries(catRecs).forEach(([kategori, teks], idx) => {
    recs.push({
      id: `ai-cat-${kategori}`,
      recommendation_type: 'ai_category',
      title: `Tips ${kategori.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
      text: teks,
      priority: 'medium',
      source: 'llm',
      label,
      confidence,
      category: kategori,
    })
  })

  return recs
}

async function getRecommendations(userId) {
  
  const cacheKey = redis.keys.recommendationsCache(userId)
  const cached   = await redis.get(cacheKey)
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
    saving_target:  Number(profile.saving_target)  || 0,
    financial_goal: profile.financial_goal || '',
    spending_style: profile.spending_style || '',
    main_priority:  profile.main_priority  || '',
    risk_profile:   profile.risk_profile   || 'moderate',
  }

  
  let data
  try {
    const aiResult = await getAiAnalysis(userId)
    if (aiResult) {
      data = formatAiResponse(aiResult)
    }
  } catch (err) {
    console.error('[Recommendations] AI error, fallback ke rule-based:', err.message)
  }

  
  if (!data) {
    const txResult = await db.query(
      `SELECT t.*, c.name AS category_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1
         AND t.transaction_date >= date_trunc('month', CURRENT_DATE)
       ORDER BY t.transaction_date DESC`,
      [userId],
    )
    data = buildFallbackRecommendations(txResult.rows, user)
  }

  
  await redis.set(cacheKey, data, redis.TTL.RECOMMENDATIONS_CACHE)
  return data
}

async function invalidateCache(userId) {
  await Promise.all([
    redis.del(redis.keys.recommendationsCache(userId)),
    invalidateAiCache(userId),
  ])
}

module.exports = { getRecommendations, invalidateCache }
