'use strict'

/**
 * aiService.js — Jembatan antara backend Express dan Python AI API
 *
 * Flow:
 *   1. Cek cache tabel ai_analysis (30 menit)
 *   2. Jika miss → query agregasi transaksi dari PostgreSQL
 *   3. Kirim ke Python Classification API (port 8002)
 *   4. Simpan hasil ke ai_analysis
 *   5. Return hasil ke recommendations.service.js
 *
 * Env vars yang dibutuhkan:
 *   CLASSIFY_API_URL       = http://localhost:8002
 *   SMARTFINANCE_API_KEY   = (kosong jika tanpa auth)
 */

const http = require('http')
const https = require('https')
const db = require('../../config/database')

const CLASSIFY_API_URL  = process.env.CLASSIFY_API_URL  || 'http://localhost:8002'
const SMARTFINANCE_API_KEY = process.env.SMARTFINANCE_API_KEY || ''
const AI_CACHE_MINUTES  = 30

const BULAN_INDONESIA = {
  1: 'Januari', 2: 'Februari', 3: 'Maret',    4: 'April',
  5: 'Mei',     6: 'Juni',     7: 'Juli',      8: 'Agustus',
  9: 'September',10:'Oktober', 11: 'November', 12: 'Desember',
}

// ── HTTP helper (tanpa axios agar tidak tambah dependency) ─────────────────
function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const parsed = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const lib = isHttps ? https : http

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(SMARTFINANCE_API_KEY ? { 'X-API-Key': SMARTFINANCE_API_KEY } : {}),
      },
    }

    const req = lib.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`AI API responded ${res.statusCode}: ${data}`))
          } else {
            resolve(JSON.parse(data))
          }
        } catch (e) {
          reject(new Error(`AI API parse error: ${e.message}`))
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('AI API timeout (30s)'))
    })
    req.write(body)
    req.end()
  })
}

// ── Query agregasi — sesuai skema Express backend ──────────────────────────
// Menggunakan kolom: transactions, transaction_date, amount, type='income'/'expense'
// JOIN ke tabel categories untuk mendapatkan nama kategori Indonesia
const QUERY_MONTHLY_SUMMARY = `
  SELECT
    SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END) AS total_income,
    SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS total_expense,

    SUM(CASE WHEN LOWER(c.name) = 'makanan_minuman'
                  AND t.type = 'expense' THEN t.amount ELSE 0 END) AS expense_makanan_minuman,
    SUM(CASE WHEN LOWER(c.name) = 'transportasi'
                  AND t.type = 'expense' THEN t.amount ELSE 0 END) AS expense_transportasi,
    SUM(CASE WHEN LOWER(c.name) = 'hiburan'
                  AND t.type = 'expense' THEN t.amount ELSE 0 END) AS expense_hiburan,
    SUM(CASE WHEN LOWER(c.name) = 'belanja_online'
                  AND t.type = 'expense' THEN t.amount ELSE 0 END) AS expense_belanja_online,
    SUM(CASE WHEN LOWER(c.name) = 'tagihan_utilitas'
                  AND t.type = 'expense' THEN t.amount ELSE 0 END) AS expense_tagihan_utilitas,
    SUM(CASE WHEN LOWER(c.name) = 'kesehatan'
                  AND t.type = 'expense' THEN t.amount ELSE 0 END) AS expense_kesehatan,
    SUM(CASE WHEN LOWER(c.name) = 'pendidikan'
                  AND t.type = 'expense' THEN t.amount ELSE 0 END) AS expense_pendidikan,
    SUM(CASE WHEN LOWER(c.name) = 'tabungan_investasi'
                  AND t.type = 'expense' THEN t.amount ELSE 0 END) AS expense_tabungan_investasi
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.user_id = $1
    AND EXTRACT(MONTH FROM t.transaction_date) = $2
    AND EXTRACT(YEAR  FROM t.transaction_date) = $3
`

// Top 3 transaksi terbesar bulan ini (untuk memperkaya prompt LLM)
const QUERY_TOP_TRANSACTIONS = `
  SELECT
    COALESCE(t.description, t.title, c.name, 'Transaksi') AS label,
    t.amount
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.user_id = $1
    AND t.type = 'expense'
    AND EXTRACT(MONTH FROM t.transaction_date) = $2
    AND EXTRACT(YEAR  FROM t.transaction_date) = $3
  ORDER BY t.amount DESC
  LIMIT 3
`

// ── Fungsi: ambil data dari DB ─────────────────────────────────────────────
async function fetchMonthlyData(userId, bulan, tahun) {
  const [summary, topTx] = await Promise.all([
    db.query(QUERY_MONTHLY_SUMMARY, [userId, bulan, tahun]),
    db.query(QUERY_TOP_TRANSACTIONS, [userId, bulan, tahun]),
  ])

  const row = summary.rows[0]
  if (!row || Number(row.total_income) <= 0) return null

  const topTransactions = topTx.rows
    .map((r) => `${r.label} Rp ${Number(r.amount).toLocaleString('id-ID')}`)
    .join(', ') || 'Tidak ada data'

  return {
    user_id:                    userId,
    month:                      BULAN_INDONESIA[bulan] || 'Mei',
    year:                       tahun,
    total_income:               Number(row.total_income  || 0),
    total_expense:              Number(row.total_expense || 0),
    expense_makanan_minuman:    Number(row.expense_makanan_minuman    || 0),
    expense_transportasi:       Number(row.expense_transportasi       || 0),
    expense_hiburan:            Number(row.expense_hiburan            || 0),
    expense_belanja_online:     Number(row.expense_belanja_online     || 0),
    expense_tagihan_utilitas:   Number(row.expense_tagihan_utilitas   || 0),
    expense_kesehatan:          Number(row.expense_kesehatan          || 0),
    expense_pendidikan:         Number(row.expense_pendidikan         || 0),
    expense_tabungan_investasi: Number(row.expense_tabungan_investasi || 0),
    _top_transactions: topTransactions,
  }
}

// ── Fungsi: bangun categories payload untuk AI API ─────────────────────────
function buildCategoriesPayload(data) {
  const income = data.total_income || 1
  const topTx  = data._top_transactions || ''

  const fields = {
    makanan_minuman:    data.expense_makanan_minuman,
    transportasi:       data.expense_transportasi,
    hiburan:            data.expense_hiburan,
    belanja_online:     data.expense_belanja_online,
    tagihan_utilitas:   data.expense_tagihan_utilitas,
    kesehatan:          data.expense_kesehatan,
    pendidikan:         data.expense_pendidikan,
    tabungan_investasi: data.expense_tabungan_investasi,
  }

  const sorted = Object.entries(fields)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  const biggestCat = sorted[0]?.[0]

  return sorted.map(([kategori, total]) => ({
    category:             kategori,
    total_amount:         total,
    transaction_count:    Math.max(1, Math.floor(total / 75000)),
    top_transactions:     (kategori === biggestCat && topTx)
      ? topTx
      : `Pengeluaran ${kategori.replace(/_/g, ' ')} Rp ${total.toLocaleString('id-ID')}`,
    percentage_of_income: Math.round((total / income) * 1000) / 10,
  }))
}

// ── Fungsi: simpan hasil AI ke tabel ai_analysis ───────────────────────────
async function saveAiResult(userId, bulan, tahun, result) {
  const sql = `
    INSERT INTO ai_analysis (
      user_id, bulan, tahun,
      label_keuangan, confidence, savings_pct,
      financial_health, summary_rekomendasi,
      category_rekomendasi, generated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (user_id, bulan, tahun)
    DO UPDATE SET
      label_keuangan       = EXCLUDED.label_keuangan,
      confidence           = EXCLUDED.confidence,
      savings_pct          = EXCLUDED.savings_pct,
      financial_health     = EXCLUDED.financial_health,
      summary_rekomendasi  = EXCLUDED.summary_rekomendasi,
      category_rekomendasi = EXCLUDED.category_rekomendasi,
      generated_at         = NOW()
  `
  await db.query(sql, [
    userId, bulan, tahun,
    result.label || '',
    result.confidence || 0,
    result.savings_pct || 0,
    result.financial_health || '',
    result.recommendation_summary || result.summary_recommendation || '',
    JSON.stringify(result.category_recommendations || {}),
  ])
}

// ── FUNGSI UTAMA ───────────────────────────────────────────────────────────
/**
 * Ambil analisis AI untuk user bulan tertentu.
 * Cek cache DB dulu (30 menit), baru hit Python API jika perlu.
 *
 * @param {string} userId  - UUID user
 * @param {number} bulan   - 1–12 (default: bulan sekarang)
 * @param {number} tahun   - contoh: 2026
 * @returns {object|null}  - Hasil AI atau null jika tidak ada data
 */
async function getAiAnalysis(userId, bulan = null, tahun = null) {
  const now = new Date()
  const b = bulan || (now.getMonth() + 1)
  const t = tahun || now.getFullYear()

  // 1. Cek cache DB (30 menit)
  const cached = await db.query(
    `SELECT * FROM ai_analysis
     WHERE user_id = $1 AND bulan = $2 AND tahun = $3
       AND generated_at > NOW() - INTERVAL '${AI_CACHE_MINUTES} minutes'`,
    [userId, b, t],
  )

  if (cached.rows.length > 0) {
    const c = cached.rows[0]
    return {
      label:                    c.label_keuangan,
      confidence:               parseFloat(c.confidence),
      savings_pct:              parseFloat(c.savings_pct),
      financial_health:         c.financial_health,
      recommendation_summary:   c.summary_rekomendasi,
      category_recommendations: c.category_rekomendasi || {},
      from_cache:               true,
    }
  }

  // 2. Ambil data transaksi dari PostgreSQL
  const data = await fetchMonthlyData(userId, b, t)
  if (!data) {
    console.log(`[AI] Tidak ada data transaksi untuk user=${userId} ${b}/${t}`)
    return null
  }

  // 3. Kirim ke Python AI API
  const payload = {
    user_id:                    data.user_id,
    month:                      data.month,
    year:                       data.year,
    total_income:               data.total_income,
    total_expense:              data.total_expense,
    expense_makanan_minuman:    data.expense_makanan_minuman,
    expense_transportasi:       data.expense_transportasi,
    expense_hiburan:            data.expense_hiburan,
    expense_belanja_online:     data.expense_belanja_online,
    expense_tagihan_utilitas:   data.expense_tagihan_utilitas,
    expense_kesehatan:          data.expense_kesehatan,
    expense_pendidikan:         data.expense_pendidikan,
    expense_tabungan_investasi: data.expense_tabungan_investasi,
    categories:                 buildCategoriesPayload(data),
  }

  let result
  try {
    result = await postJson(`${CLASSIFY_API_URL}/classify-and-recommend`, payload)
    console.log(`[AI] Klasifikasi berhasil: ${result.label} (${(result.confidence * 100).toFixed(1)}%)`)
  } catch (err) {
    console.error('[AI] Python API tidak tersedia:', err.message)
    return null
  }

  // 4. Simpan ke tabel ai_analysis
  try {
    await saveAiResult(userId, b, t, result)
  } catch (err) {
    console.error('[AI] Gagal simpan ke ai_analysis:', err.message)
  }

  return result
}

/**
 * Hapus cache ai_analysis user (dipanggil setelah ada transaksi baru)
 */
async function invalidateAiCache(userId) {
  const now = new Date()
  await db.query(
    'DELETE FROM ai_analysis WHERE user_id = $1 AND bulan = $2 AND tahun = $3',
    [userId, now.getMonth() + 1, now.getFullYear()],
  )
}

module.exports = { getAiAnalysis, invalidateAiCache }
