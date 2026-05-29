'use strict'

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const db = require('../../config/database')

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  )
}

function formatUser(row) {
  if (!row) return null
  const p = row.profile || {}
  const name = row.name || 'Pengguna'
  return {
    id: row.id,
    name,
    email: row.email,
    status: row.status,
    email_verified_at: row.email_verified_at,
    onboarding_completed: p.onboarding_completed || false,
    nickname: p.nickname || '',
    age_range: p.age_range || '',
    monthly_income: Number(p.monthly_income) || 0,
    saving_target: Number(p.saving_target) || 0,
    spending_style: p.spending_style || '',
    financial_goal: p.financial_goal || '',
    main_priority: p.main_priority || '',
    risk_profile: p.risk_profile || 'moderate',
    avatar: name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'SF',
    created_at: row.created_at,
  }
}

async function getUserWithProfile(userId) {
  const result = await db.query(
    `SELECT u.*, row_to_json(up.*) AS profile
     FROM users u
     LEFT JOIN user_profiles up ON up.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  )
  return result.rows[0] || null
}

async function register({ name, email, password }) {
  const normalizedEmail = email.toLowerCase().trim()

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
  if (existing.rows.length > 0) {
    throw Object.assign(new Error('Email sudah terdaftar'), { statusCode: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const userId = uuidv4()

  const client = await db.getClient()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, status, email_verified_at)
       VALUES ($1, $2, $3, $4, 'active', NOW())`,
      [userId, name.trim(), normalizedEmail, hashedPassword],
    )
    await client.query(
      `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  const rawUser = await getUserWithProfile(userId)
  const token = signToken(rawUser)
  return {
    user: formatUser(rawUser),
    token,
    message: 'Registrasi berhasil.',
  }
}

async function login({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim()

  const result = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
  if (!result.rows.length) {
    throw Object.assign(new Error('Email atau password salah'), { statusCode: 401 })
  }

  const user = result.rows[0]
  const passwordMatch = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatch) {
    throw Object.assign(new Error('Email atau password salah'), { statusCode: 401 })
  }

  const rawUser = await getUserWithProfile(user.id)
  return { user: formatUser(rawUser), token: signToken(user) }
}

async function getProfile(userId) {
  const rawUser = await getUserWithProfile(userId)
  if (!rawUser) throw Object.assign(new Error('Pengguna tidak ditemukan'), { statusCode: 404 })
  return formatUser(rawUser)
}

async function updateProfile(userId, payload) {
  const userFields = ['name', 'email']
  const profileFields = [
    'nickname', 'monthly_income', 'saving_target', 'age_range',
    'spending_style', 'financial_goal', 'main_priority', 'risk_profile', 'onboarding_completed',
  ]

  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    const userUpdates = userFields.filter((f) => payload[f] !== undefined)
    if (userUpdates.length > 0) {
      const setClauses = userUpdates.map((f, i) => `${f} = $${i + 2}`).join(', ')
      await client.query(
        `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
        [userId, ...userUpdates.map((f) => payload[f])],
      )
    }

    const profileUpdates = profileFields.filter((f) => payload[f] !== undefined)
    if (profileUpdates.length > 0) {
      const setClauses = profileUpdates.map((f, i) => `${f} = $${i + 2}`).join(', ')
      await client.query(
        `UPDATE user_profiles SET ${setClauses}, updated_at = NOW() WHERE user_id = $1`,
        [userId, ...profileUpdates.map((f) => payload[f])],
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return getProfile(userId)
}

async function changePassword(userId, { current_password, new_password }) {
  const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId])
  if (!result.rows.length) {
    throw Object.assign(new Error('Pengguna tidak ditemukan'), { statusCode: 404 })
  }

  const passwordMatch = await bcrypt.compare(current_password, result.rows[0].password_hash)
  if (!passwordMatch) {
    throw Object.assign(new Error('Password saat ini salah'), { statusCode: 400 })
  }

  const hashedPassword = await bcrypt.hash(new_password, 12)
  await db.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hashedPassword, userId],
  )

  return { message: 'Password berhasil diperbarui.' }
}

async function loginWithGoogle({ credential }) {
  if (!credential) {
    throw Object.assign(new Error('Google credential tidak valid'), { statusCode: 400 })
  }

  const parts = credential.split('.')
  if (parts.length !== 3) {
    throw Object.assign(new Error('Token Google tidak valid'), { statusCode: 400 })
  }

  let payload
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  } catch {
    throw Object.assign(new Error('Gagal membaca token Google'), { statusCode: 400 })
  }

  const { email, name, email_verified } = payload

  if (!email_verified) throw Object.assign(new Error('Email Google belum diverifikasi'), { statusCode: 400 })
  if (!email) throw Object.assign(new Error('Email tidak tersedia dari akun Google'), { statusCode: 400 })

  const normalizedEmail = email.toLowerCase().trim()
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])

  let userId

  if (existing.rows.length > 0) {
    userId = existing.rows[0].id
  } else {
    userId = uuidv4()
    const randomPassword = await bcrypt.hash(uuidv4(), 10)
    const displayName = (name || normalizedEmail.split('@')[0]).trim()

    const client = await db.getClient()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, status, email_verified_at)
         VALUES ($1, $2, $3, $4, 'active', NOW())`,
        [userId, displayName, normalizedEmail, randomPassword],
      )
      await client.query(
        `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  const rawUser = await getUserWithProfile(userId)
  return { user: formatUser(rawUser), token: signToken(rawUser) }
}

module.exports = { register, login, getProfile, updateProfile, changePassword, loginWithGoogle }
