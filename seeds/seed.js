'use strict'

/**
 * seed.js — Isi database dengan user demo + transaksi contoh
 * Jalankan: node seeds/seed.js
 *
 * Akun demo:
 *   Email   : demo@smartfinance.ai
 *   Password: demo1234
 */

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

const DEMO_EMAIL = 'demo@smartfinance.ai'
const DEMO_PASSWORD = 'demo1234'

const DEMO_TRANSACTIONS = [
  { title: 'Gaji freelance', type: 'income', category: 'Income', amount: 4300000, date: '2026-05-01', note: 'Project website' },
  { title: 'Kopi & nongkrong', type: 'expense', category: 'Lifestyle', amount: 185000, date: '2026-05-03', note: 'Weekend' },
  { title: 'Makan siang', type: 'expense', category: 'Food', amount: 95000, date: '2026-05-04', note: 'Kampus' },
  { title: 'Transportasi', type: 'expense', category: 'Transport', amount: 75000, date: '2026-05-05', note: 'Ojol' },
  { title: 'Langganan aplikasi', type: 'expense', category: 'Subscription', amount: 99000, date: '2026-05-06', note: 'Premium' },
  { title: 'Belanja skincare', type: 'expense', category: 'Shopping', amount: 310000, date: '2026-05-07', note: 'Promo' },
  { title: 'Listrik + internet', type: 'expense', category: 'Bills', amount: 285000, date: '2026-05-08', note: '' },
  { title: 'Konsultasi dokter', type: 'expense', category: 'Health', amount: 150000, date: '2026-05-09', note: '' },
  { title: 'Buku pemrograman', type: 'expense', category: 'Education', amount: 120000, date: '2026-05-10', note: 'O\'Reilly' },
  { title: 'Bonus project', type: 'income', category: 'Income', amount: 500000, date: '2026-05-12', note: 'Revisi final' },
]

async function seed() {
  const client = await pool.connect()
  try {
    console.log('🌱  SmartFinance AI — Database Seeding\n')

    // Check/create demo user
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL])

    let userId
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id
      console.log(`ℹ️  User demo sudah ada (id: ${userId}), transaksi lama akan diganti.\n`)
      await client.query('DELETE FROM transactions WHERE user_id = $1', [userId])
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
         VALUES ($1, 'Demo', '18-24', 4300000, 1200000, 'balanced', 'saving', 'increase_saving', 'moderate', TRUE)`,
        [userId],
      )

      console.log(`✅  User demo dibuat: ${DEMO_EMAIL}`)
    }

    // Seed transactions
    for (const tx of DEMO_TRANSACTIONS) {
      const catResult = await client.query(
        'SELECT id FROM categories WHERE name = $1 AND user_id IS NULL LIMIT 1',
        [tx.category],
      )
      const categoryId = catResult.rows[0]?.id || null

      await client.query(
        `INSERT INTO transactions (user_id, category_id, title, type, amount, transaction_date, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, categoryId, tx.title, tx.type, tx.amount, tx.date, tx.note],
      )
    }

    console.log(`✅  ${DEMO_TRANSACTIONS.length} transaksi demo ditambahkan`)

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
