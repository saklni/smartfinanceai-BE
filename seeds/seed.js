'use strict'

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'smartfinanceai',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

const DEMO_EMAIL    = 'demo@smartfinance.ai'
const DEMO_PASSWORD = 'demo1234'

const DEMO_TRANSACTIONS = [
  { title: 'Gaji freelance',     type: 'income',  category: 'pemasukan',          amount: 5000000, date: '2026-05-01', note: 'Project website', description: 'Gaji Mei 2026' },
  { title: 'GoFood makan siang', type: 'expense', category: 'makanan_minuman',     amount: 95000,  date: '2026-05-03', note: 'Kampus',          description: 'GoFood' },
  { title: 'Grab ke kantor',     type: 'expense', category: 'transportasi',        amount: 75000,  date: '2026-05-04', note: 'Ojol',            description: 'GrabBike' },
  { title: 'Netflix',            type: 'expense', category: 'tagihan_utilitas',    amount: 54000,  date: '2026-05-05', note: 'Langganan',       description: 'Netflix Std' },
  { title: 'Shopee haul',        type: 'expense', category: 'belanja_online',      amount: 310000, date: '2026-05-07', note: 'Promo',           description: 'Shopee' },
  { title: 'Listrik + internet', type: 'expense', category: 'tagihan_utilitas',    amount: 285000, date: '2026-05-08', note: '',               description: 'PLN + Indihome' },
  { title: 'Konsultasi dokter',  type: 'expense', category: 'kesehatan',           amount: 150000, date: '2026-05-09', note: '',               description: 'Klinik' },
  { title: 'Buku pemrograman',   type: 'expense', category: 'pendidikan',          amount: 120000, date: '2026-05-10', note: "O'Reilly",       description: 'Tokopedia' },
  { title: 'Nonton bioskop',     type: 'expense', category: 'hiburan',             amount: 110000, date: '2026-05-11', note: 'Weekend',         description: 'CGV' },
  { title: 'Bonus project',      type: 'income',  category: 'pemasukan',           amount: 500000, date: '2026-05-12', note: 'Revisi final',    description: 'Bonus Mei' },
  { title: 'Nabung rekening',    type: 'expense', category: 'tabungan_investasi',  amount: 500000, date: '2026-05-13', note: 'Rutin',           description: 'BCA Tabungan' },
  { title: 'Makan malam keluarga',type:'expense', category: 'makanan_minuman',     amount: 280000, date: '2026-05-15', note: 'Weekend',         description: 'Restoran' },
  { title: 'Gojek harian',       type: 'expense', category: 'transportasi',        amount: 45000,  date: '2026-05-17', note: '',               description: 'Ojol' },
  { title: 'Steam game',         type: 'expense', category: 'hiburan',             amount: 189000, date: '2026-05-18', note: 'Sale',            description: 'Steam' },
  { title: 'Belanja bulanan',    type: 'expense', category: 'makanan_minuman',     amount: 450000, date: '2026-05-20', note: 'Supermarket',     description: 'Indomaret' },
]

async function seed() {
  const client = await pool.connect()
  try {
    console.log('🌱  SmartFinance AI — Database Seeding (v2)\n')

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL])

    let userId
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id
      console.log(`ℹ️  User demo sudah ada (id: ${userId}), transaksi lama akan diganti.\n`)
      await client.query('DELETE FROM transactions WHERE user_id = $1', [userId])
      await client.query('DELETE FROM ai_analysis WHERE user_id = $1', [userId])
    } else {
      const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12)
      const userResult = await client.query(
        `INSERT INTO users (name, email, password_hash, status, email_verified_at)
         VALUES ($1, $2, $3, 'active', NOW()) RETURNING id`,
        ['Demo User', DEMO_EMAIL, hashedPassword],
      )
      userId = userResult.rows[0].id

      await client.query(
        `INSERT INTO user_profiles
           (user_id, nickname, age_range, monthly_income, saving_target,
            spending_style, financial_goal, main_priority, risk_profile, onboarding_completed)
         VALUES ($1, 'Demo', '25-34', 5000000, 1500000, 'balanced', 'saving', 'increase_saving', 'moderate', TRUE)`,
        [userId],
      )
      console.log(`✅  User demo dibuat: ${DEMO_EMAIL}`)
    }

    
    let added = 0
    for (const tx of DEMO_TRANSACTIONS) {
      const catResult = await client.query(
        'SELECT id FROM categories WHERE name = $1 AND user_id IS NULL LIMIT 1',
        [tx.category],
      )
      const categoryId = catResult.rows[0]?.id || null

      await client.query(
        `INSERT INTO transactions (user_id, category_id, title, description, type, amount, transaction_date, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, categoryId, tx.title, tx.description || tx.title, tx.type, tx.amount, tx.date, tx.note],
      )
      added++
    }

    console.log(`✅  ${added} transaksi demo ditambahkan`)
    console.log('\n🎉  Seeding selesai!')
    console.log('─'.repeat(40))
    console.log('  Email   :', DEMO_EMAIL)
    console.log('  Password:', DEMO_PASSWORD)
    console.log('─'.repeat(40))
  } catch (err) {
    console.error('\n❌  Seeding gagal:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
