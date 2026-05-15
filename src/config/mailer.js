'use strict'

const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

/**
 * Send OTP email to user.
 * Falls back to console.log in development if SMTP is not configured.
 */
async function sendOtpEmail(to, otpCode, purpose = 'register') {
  const subjectMap = {
    register: 'Kode Verifikasi SmartFinance AI',
    reset_password: 'Reset Password SmartFinance AI',
  }

  const labelMap = {
    register: 'Verifikasi akun baru',
    reset_password: 'Reset password',
  }

  const subject = subjectMap[purpose] || 'Kode OTP SmartFinance AI'
  const label = labelMap[purpose] || 'Verifikasi'

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
        <tr><td align="center">
          <table width="500" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
            <tr><td style="background:#16a34a;padding:24px 32px;">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">SmartFinance AI</p>
              <p style="margin:4px 0 0;color:#bbf7d0;font-size:13px;">Asisten keuangan pribadi</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <p style="margin:0 0 8px;color:#374151;font-size:15px;font-weight:600;">${label}</p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
                Berikut adalah kode OTP kamu. Kode ini berlaku selama <strong>${process.env.OTP_EXPIRES_MINUTES || 10} menit</strong> dan hanya boleh digunakan satu kali.
              </p>
              <div style="text-align:center;margin:0 0 24px;">
                <span style="display:inline-block;background:#f0fdf4;border:2px solid #16a34a;border-radius:10px;padding:16px 40px;font-size:36px;font-weight:800;letter-spacing:12px;color:#15803d;font-family:monospace;">
                  ${otpCode}
                </span>
              </div>
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Jika kamu tidak melakukan permintaan ini, abaikan email ini. Jangan bagikan kode OTP ke siapapun.
              </p>
            </td></tr>
            <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                &copy; ${new Date().getFullYear()} SmartFinance AI &mdash; Capstone Project
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`\n[EMAIL - DEV MODE] OTP untuk ${to}: ${otpCode}\n`)
    return { messageId: 'dev-mode-no-smtp' }
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || `"SmartFinance AI" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  })

  return info
}

module.exports = { sendOtpEmail, transporter }
