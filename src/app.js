'use strict'

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const authRoutes = require('./modules/auth/auth.routes')
const transactionRoutes = require('./modules/transactions/transactions.routes')
const categoryRoutes = require('./modules/categories/categories.routes')
const recommendationRoutes = require('./modules/recommendations/recommendations.routes')
const analyticsRoutes = require('./modules/analytics/analytics.routes')

const app = express()

// ─── Security & parsing ───────────────────────────────────────────────────────
app.use(helmet())

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
]

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error(`CORS: Origin ${origin} tidak diizinkan`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// ─── Global rate limiter ──────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi dalam 15 menit.' },
}))

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'SmartFinance AI Backend is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  })
})

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/analytics', analyticsRoutes)

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' })
})

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err)
  const statusCode = err.statusCode || 500
  const message = err.message || 'Terjadi kesalahan server'
  res.status(statusCode).json({ success: false, message })
})

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`\n🚀 SmartFinance AI Backend running on http://localhost:${PORT}`)
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🗄  Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}\n`)
})

module.exports = app
