# SmartFinance AI — Backend

REST API untuk SmartFinance AI, dibangun dengan **Node.js + Express.js + PostgreSQL**.
Dibuat plug-and-play dengan `smartfinanceai-FE-clean`.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js 4 |
| Database | PostgreSQL 14+ |
| Auth | JWT + bcryptjs + Google Sign-In (GSI) |
| Validasi | express-validator |
| Email | Nodemailer (SMTP / Gmail) |
| Security | helmet, cors, express-rate-limit |

---

## Struktur Direktori

```
smartfinanceai-BE/
├── src/
│   ├── app.js
│   ├── config/
│   │   ├── database.js          # PostgreSQL pool
│   │   └── mailer.js            # Nodemailer + sendOtpEmail
│   ├── middleware/
│   │   ├── authenticate.js      # JWT Bearer → req.user
│   │   └── validate.js          # express-validator error handler
│   ├── modules/
│   │   ├── auth/                # register, login, google, OTP, profile
│   │   ├── transactions/        # CRUD transaksi
│   │   ├── categories/          # GET + POST kategori
│   │   ├── recommendations/     # Rule-based engine
│   │   └── analytics/           # summary, categories, trend
│   └── utils/
│       ├── response.js          # Helper success/error JSON
│       └── otp.js               # generateOtp, otpExpiresAt
├── migrations/
│   └── migrate.js               # Buat semua tabel + seed kategori default
├── seeds/
│   └── seed.js                  # User demo + transaksi contoh
├── .env.example
└── package.json
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Konfigurasi `.env`

```bash
cp .env.example .env
```

Isi nilai yang diperlukan:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartfinanceai
DB_USER=postgres
DB_PASSWORD=password_postgres_kamu

JWT_SECRET=string_random_panjang_minimal_32_karakter
JWT_EXPIRES_IN=7d

OTP_LENGTH=6
OTP_EXPIRES_MINUTES=10
OTP_MAX_ATTEMPTS=5

# Opsional — jika kosong, OTP dicetak di console (mode dev)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="SmartFinance AI <your@gmail.com>"

FRONTEND_URL=http://localhost:5173
```

### 3. Buat database PostgreSQL

```sql
CREATE DATABASE smartfinanceai;
```

### 4. Migrasi

```bash
npm run migrate
# Reset total: npm run migrate:fresh
```

### 5. Seed data demo (opsional)

```bash
npm run seed
# Akun: demo@smartfinance.ai / demo1234
```

### 6. Jalankan server

```bash
npm run dev    # development (nodemon)
npm start      # production
```

Server: `http://localhost:5000`

---

## Integrasi dengan Frontend

Di `.env` frontend:

```env
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

---

## API Endpoints

### Health

```
GET  /api/health
```

### Auth

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|------------|
| POST | `/api/auth/register` | — | Daftar, kirim OTP ke email |
| POST | `/api/auth/login` | — | Login email + password |
| POST | `/api/auth/google` | — | Login / register via Google One-Tap |
| POST | `/api/auth/verify-otp` | — | Verifikasi kode OTP |
| POST | `/api/auth/resend-otp` | — | Kirim ulang OTP |
| GET | `/api/auth/me` | Bearer | Ambil profil lengkap |
| PUT | `/api/auth/me` | Bearer | Update profil + onboarding |

### Transactions

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|------------|
| GET | `/api/transactions` | Bearer | Semua transaksi user |
| POST | `/api/transactions` | Bearer | Tambah transaksi |
| PUT | `/api/transactions/:id` | Bearer | Edit transaksi |
| DELETE | `/api/transactions/:id` | Bearer | Hapus transaksi |

### Categories

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|------------|
| GET | `/api/categories` | Bearer | Kategori global + milik user |
| POST | `/api/categories` | Bearer | Buat kategori custom |

### Recommendations

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|------------|
| GET | `/api/recommendations` | Bearer | Rekomendasi finansial bulan ini |

### Analytics

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|------------|
| GET | `/api/analytics/summary` | Bearer | Ringkasan income/expense/saving bulan ini |
| GET | `/api/analytics/categories` | Bearer | Pengeluaran per kategori bulan ini |
| GET | `/api/analytics/trend` | Bearer | Tren 6 bulan terakhir |

---

## Format Response

```json
{ "success": true, "message": "OK", "data": { ... } }
```

Error:

```json
{ "success": false, "message": "Pesan error", "errors": [...] }
```

---

## Google Sign-In — Cara Kerja

1. FE meload Google GSI SDK dan merender tombol di halaman login
2. User memilih akun Google → SDK mengembalikan `credential` (JWT)
3. FE mengirim `POST /api/auth/google` dengan `{ credential }`
4. BE mendecode payload JWT Google (base64url), membaca `email` + `email_verified`
5. Jika email sudah terdaftar → login langsung
6. Jika belum → buat akun baru otomatis (status `active`, tanpa OTP)
7. BE mengembalikan `{ user, token }` → FE menyimpan token dan redirect

> **Catatan produksi:** Untuk verifikasi signature JWT Google secara penuh, install `google-auth-library` dan gunakan `OAuth2Client.verifyIdToken()`. Implementasi saat ini (decode manual) aman untuk development / capstone.

---

## Skema Database

```
users             id(UUID), name, email, password_hash, status, email_verified_at
user_profiles     user_id(FK), nickname, age_range, monthly_income, saving_target,
                  spending_style, financial_goal, main_priority, risk_profile, onboarding_completed
categories        id, user_id(NULL=global), name, label, type, icon
transactions      id, user_id(FK), category_id(FK), title, type, amount, transaction_date, note
otps              id, user_id(FK), email, otp_code, purpose, is_used, attempts, expires_at
recommendations   id, user_id(FK), recommendation_type, title, message, priority, source, expires_at
```

---

## Dev Notes

- OTP dicetak di console jika `SMTP_USER` / `SMTP_PASS` kosong
- Rate limiting: auth 20 req/15min, OTP 5 req/5min, global 200 req/15min
- CORS hanya mengizinkan origin dari `FRONTEND_URL`
