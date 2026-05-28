'use strict'

const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const db = require('../../config/database')
const { sendOtpEmail } = require('../../config/mailer')
const redis = require('../../config/redis')
const { generateOtp, otpExpiresAt } = require('../../utils/otp')

const OTP_LENGTH = Number(process.env.OTP_LENGTH) || 6
const OTP_EXPIRES_MIN = Number(process.env.OTP_EXPIRES_MINUTES) || 10
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5

async function requestReset({ email }) {
  const normalizedEmail = email.toLowerCase().trim()

  const userResult = await db.query(
    'SELECT id, name FROM users WHERE email = $1 AND status = $2',
    [normalizedEmail, 'active'],
  )

  
  if (!userResult.rows.length) {
    return { message: 'Jika email terdaftar, kode OTP akan segera dikirim.' }
  }

  const { id: userId } = userResult.rows[0]
  const otpCode = generateOtp(OTP_LENGTH)
  const expiresAt = otpExpiresAt(OTP_EXPIRES_MIN)

  
  const redisKey = `sf:otp:reset:${normalizedEmail}`
  await redis.set(redisKey, {
    otp_code: otpCode,
    user_id: userId,
    attempts: 0,
    expires_at: expiresAt.toISOString(),
  }, OTP_EXPIRES_MIN * 60)

  
  await db.query(
    `UPDATE otps SET is_used = TRUE WHERE user_id = $1 AND purpose = 'reset_password' AND is_used = FALSE`,
    [userId],
  )
  await db.query(
    `INSERT INTO otps (user_id, email, otp_code, purpose, expires_at) VALUES ($1, $2, $3, 'reset_password', $4)`,
    [userId, normalizedEmail, otpCode, expiresAt],
  )

  await sendOtpEmail(normalizedEmail, otpCode, 'reset_password')

  return { message: 'Jika email terdaftar, kode OTP akan segera dikirim.' }
}

async function verifyResetOtp({ email, otp_code }) {
  const normalizedEmail = email.toLowerCase().trim()

  
  const redisKey = `sf:otp:reset:${normalizedEmail}`
  let otpData = await redis.get(redisKey)

  if (!otpData) {
    
    const userResult = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
    if (!userResult.rows.length) {
      throw Object.assign(new Error('OTP tidak valid atau sudah kedaluwarsa'), { statusCode: 400 })
    }

    const otpResult = await db.query(
      `SELECT * FROM otps
       WHERE email = $1 AND purpose = 'reset_password' AND is_used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail],
    )

    if (!otpResult.rows.length) {
      throw Object.assign(new Error('OTP tidak valid atau sudah kedaluwarsa'), { statusCode: 400 })
    }

    const row = otpResult.rows[0]
    otpData = {
      otp_code: row.otp_code,
      user_id: row.user_id,
      attempts: row.attempts,
      expires_at: row.expires_at,
    }
  }

  
  if ((otpData.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    await redis.del(redisKey)
    throw Object.assign(new Error('Percobaan OTP terlalu banyak. Minta OTP baru.'), { statusCode: 429 })
  }

  
  if (new Date(otpData.expires_at) < new Date()) {
    await redis.del(redisKey)
    throw Object.assign(new Error('Kode OTP sudah kedaluwarsa. Silakan minta OTP baru.'), { statusCode: 400 })
  }

  
  if (otpData.otp_code !== String(otp_code)) {
    const newAttempts = (otpData.attempts || 0) + 1
    otpData.attempts = newAttempts
    const remaining = OTP_EXPIRES_MIN * 60
    await redis.set(redisKey, otpData, remaining)
    await db.query(
      `UPDATE otps SET attempts = attempts + 1 WHERE email = $1 AND purpose = 'reset_password' AND is_used = FALSE`,
      [normalizedEmail],
    )
    const left = OTP_MAX_ATTEMPTS - newAttempts
    throw Object.assign(new Error(`Kode OTP salah. Sisa percobaan: ${left}`), { statusCode: 400 })
  }

  
  await redis.del(redisKey)
  await db.query(
    `UPDATE otps SET is_used = TRUE WHERE email = $1 AND purpose = 'reset_password' AND is_used = FALSE`,
    [normalizedEmail],
  )

  const resetToken = uuidv4()
  const resetKey = redis.keys.resetToken(resetToken)
  await redis.set(resetKey, { user_id: otpData.user_id, email: normalizedEmail }, redis.TTL.RESET_TOKEN)

  return {
    reset_token: resetToken,
    message: 'OTP valid. Gunakan reset_token untuk membuat password baru.',
  }
}

async function resetPassword({ reset_token, new_password }) {
  if (!reset_token) throw Object.assign(new Error('Reset token tidak valid'), { statusCode: 400 })

  const resetKey = redis.keys.resetToken(reset_token)
  const tokenData = await redis.get(resetKey)

  if (!tokenData) {
    throw Object.assign(
      new Error('Reset token tidak valid atau sudah kedaluwarsa. Silakan ulangi proses dari awal.'),
      { statusCode: 400 },
    )
  }

  const { user_id: userId } = tokenData

  const hashedPassword = await bcrypt.hash(new_password, 12)

  await db.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hashedPassword, userId],
  )

  
  await redis.del(resetKey)

  return { message: 'Password berhasil diperbarui. Silakan masuk dengan password baru.' }
}

module.exports = { requestReset, verifyResetOtp, resetPassword }
