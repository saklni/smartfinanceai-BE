'use strict'

/**
 * Generate a numeric OTP code of given length.
 */
function generateOtp(length = 6) {
  const digits = '0123456789'
  let otp = ''
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)]
  }
  return otp
}

/**
 * Build expiry date from now + minutes.
 */
function otpExpiresAt(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000)
}

module.exports = { generateOtp, otpExpiresAt }
