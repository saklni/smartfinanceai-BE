# SmartFinance AI — Backend Express.js (v2)

Backend REST API untuk SmartFinance AI, dibangun dengan Node.js, Express, PostgreSQL, dan Redis.

---

## Perubahan v2 (Fixed)

| # | Masalah | Status |
|---|---------|--------|
| 1 | Seed kategori English → Indonesia snake_case (sesuai model AI) | ✅ Diperbaiki |
| 2 | Tabel `ai_analysis` belum ada | ✅ Ditambahkan ke migration |
| 3 | `recommendations.service.js` masih rule-based, tidak memanggil AI | ✅ Diganti: AI dulu, rule-based fallback |
| 4 | Tidak ada `aiService.js` sebagai jembatan ke Python API | ✅ Dibuat baru |
| 5 | Query kategori tidak cocok (`category` string vs JOIN ke tabel `categories`) | ✅ Diperbaiki di `resolveCategoryId()` |
| 6 | Field `description` tidak ada di tabel `transactions` | ✅ Ditambahkan (untuk `top_transactions` AI prompt) |
| 7 | Env vars Python API belum ada di `.env` | ✅ Ditambahkan `.env.example` |
| 8 | AI cache tidak di-invalidate saat ada transaksi baru | ✅ `invalidateAiCache()` dipanggil di transactions |
| 9 | Credentials sensitif di `.env` | ✅ `.env` tidak di-commit, hanya `.env.example` |

---

## Prasyarat

- Node.js v18 atau lebih baru
- PostgreSQL 14+
- Redis / Memurai (Windows) — untuk caching
- Python AI API berjalan di port 8001 dan 8002 (opsional, ada fallback rule-based)

---

## Langkah 1 — Setup

### 1.1 Install dependensi

```bash
npm install
```

### 1.2 Buat file `.env`

```bash
cp .env.example .env
```

Edit `.env` dan isi semua nilai. Field wajib:

```env
DB_PASSWORD=password_postgres_kamu
JWT_SECRET=minimal_32_karakter_acak
SMTP_USER=email_gmail_kamu
SMTP_PASS=app_password_gmail_16_digit
```

Field untuk integrasi AI (opsional, ada fallback):

```env
CLASSIFY_API_URL=http://localhost:8002
SMARTFINANCE_API_KEY=
```

### 1.3 Buat database PostgreSQL

```bash
# Masuk ke psql
psql -U postgres

# Buat database
CREATE DATABASE smartfinanceai;
\q
```

---

## Langkah 2 — Migrasi Database

```bash
npm run migrate
```

Ini akan membuat semua tabel termasuk:
- `users`, `user_profiles`
- `categories` (dengan seed nama Indonesia snake_case)
- `transactions` (dengan kolom `description`)
- `otps`, `recommendations`
- `ai_analysis` ← **baru di v2**

Output yang diharapkan:
```
✅  Tabel users siap
✅  Tabel user_profiles siap
✅  Tabel categories siap
✅  Tabel transactions siap
✅  Tabel otps siap
✅  Tabel recommendations siap
✅  Tabel ai_analysis siap
✅  Kategori default di-seed (format Indonesia snake_case)
🎉  Migrasi selesai!
```

> ⚠️ Jika sudah ada database lama dengan kategori English, jalankan:
> ```bash
> npm run migrate:fresh
> ```
> **PERINGATAN**: `--fresh` akan menghapus semua data!

### Update kategori tanpa hapus data (jika skip --fresh)

Jika tidak mau hapus data dan hanya ingin update nama kategori:

```sql
UPDATE categories SET name = 'makanan_minuman',    label = 'Makanan & Minuman'   WHERE LOWER(name) IN ('food', 'makanan');
UPDATE categories SET name = 'transportasi',        label = 'Transportasi'        WHERE LOWER(name) IN ('transport', 'transportation');
UPDATE categories SET name = 'hiburan',             label = 'Hiburan'             WHERE LOWER(name) IN ('entertainment', 'lifestyle');
UPDATE categories SET name = 'belanja_online',      label = 'Belanja Online'      WHERE LOWER(name) IN ('shopping', 'belanja');
UPDATE categories SET name = 'tagihan_utilitas',    label = 'Tagihan & Utilitas'  WHERE LOWER(name) IN ('bills', 'utilities', 'subscription');
UPDATE categories SET name = 'kesehatan',           label = 'Kesehatan'           WHERE LOWER(name) IN ('health', 'healthcare');
UPDATE categories SET name = 'pendidikan',          label = 'Pendidikan'          WHERE LOWER(name) IN ('education');
UPDATE categories SET name = 'tabungan_investasi',  label = 'Tabungan & Investasi'WHERE LOWER(name) IN ('savings', 'investment', 'tabungan');
UPDATE categories SET name = 'lainnya',             label = 'Lainnya'             WHERE LOWER(name) IN ('other', 'others');
UPDATE categories SET name = 'pemasukan',           label = 'Pemasukan'           WHERE LOWER(name) IN ('income');
```

---

## Langkah 3 — Seed Data Demo (Opsional)

```bash
npm run seed
```

Membuat akun demo dengan transaksi contoh bulan Mei 2026:
- **Email**: `demo@smartfinance.ai`
- **Password**: `demo1234`

---

## Langkah 4 — Jalankan Server

```bash
# Development (hot-reload)
npm run dev

# Production
npm start
```

Output normal:
```
🚀 SmartFinance AI Backend  →  http://localhost:5000
🩺 Health check             →  http://localhost:5000/api/health
🗄  PostgreSQL               →  smartfinanceai@localhost:5432
⚡ Redis (Memurai)           →  127.0.0.1:6379
🤖 AI Classification API    →  http://localhost:8002
🌍 Environment              →  development
```

---

## Langkah 5 — Integrasi AI (Opsional tapi Direkomendasikan)

Pastikan Python AI API sudah berjalan sebelum backend Express dijalankan:

```bash
# Terminal 1 — Recommendation API
uvicorn main_api:app --reload --port 8001

# Terminal 2 — Classification API
cd model
uvicorn step4_predict_api:app --reload --port 8002
```

Jika AI API tidak berjalan, backend akan otomatis fallback ke rekomendasi rule-based — aplikasi tetap berjalan normal.

---

## Struktur File

```
smartfinanceai-BE/
├── .env.example                          # Template env vars
├── package.json
├── migrations/
│   └── migrate.js                        # ← v2: kategori Indonesia + tabel ai_analysis
├── seeds/
│   └── seed.js                           # ← v2: transaksi demo pakai kategori Indonesia
└── src/
    ├── app.js                            # ← v2: tambah log CLASSIFY_API_URL
    ├── config/
    │   ├── database.js
    │   ├── redis.js
    │   └── mailer.js
    ├── middleware/
    │   ├── authenticate.js
    │   └── validate.js
    ├── modules/
    │   ├── auth/
    │   │   ├── auth.routes.js
    │   │   ├── auth.controller.js
    │   │   └── auth.service.js
    │   ├── transactions/
    │   │   ├── transactions.routes.js
    │   │   ├── transactions.controller.js
    │   │   └── transactions.service.js   # ← v2: description field, invalidate AI cache
    │   ├── categories/
    │   │   ├── categories.routes.js
    │   │   ├── categories.controller.js
    │   │   └── categories.service.js     # ← v2: return name + label, sorting
    │   ├── recommendations/
    │   │   ├── recommendations.routes.js
    │   │   ├── recommendations.controller.js
    │   │   ├── recommendations.service.js # ← v2: AI first, rule-based fallback
    │   │   └── aiService.js              # ← BARU: jembatan ke Python AI API
    │   ├── analytics/
    │   │   ├── analytics.routes.js
    │   │   ├── analytics.controller.js
    │   │   └── analytics.service.js
    │   └── forgot-password/
    │       ├── forgotPassword.routes.js
    │       ├── forgotPassword.controller.js
    │       └── forgotPassword.service.js
    └── utils/
        ├── response.js
        └── otp.js
```

---

## API Endpoints

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/api/health` | Status server | ❌ |
| POST | `/api/auth/register` | Registrasi | ❌ |
| POST | `/api/auth/login` | Login | ❌ |
| POST | `/api/auth/verify-otp` | Verifikasi OTP | ❌ |
| POST | `/api/auth/resend-otp` | Kirim ulang OTP | ❌ |
| POST | `/api/auth/google` | Login Google | ❌ |
| GET | `/api/auth/me` | Profil user | ✅ |
| PUT | `/api/auth/profile` | Update profil | ✅ |
| GET | `/api/transactions` | Daftar transaksi | ✅ |
| POST | `/api/transactions` | Buat transaksi | ✅ |
| PUT | `/api/transactions/:id` | Update transaksi | ✅ |
| DELETE | `/api/transactions/:id` | Hapus transaksi | ✅ |
| GET | `/api/categories` | Daftar kategori | ✅ |
| POST | `/api/categories` | Buat kategori | ✅ |
| GET | `/api/recommendations` | Rekomendasi AI | ✅ |
| GET | `/api/analytics/summary` | Ringkasan keuangan | ✅ |
| GET | `/api/analytics/categories` | Data per kategori | ✅ |
| GET | `/api/analytics/trend` | Tren 6 bulan | ✅ |

---

## Format Response Rekomendasi (v2)

Saat AI tersedia, response `GET /api/recommendations` akan berisi array card:

```json
[
  {
    "id": "ai-label",
    "recommendation_type": "ai_classification",
    "title": "Profil Keuangan: Boros",
    "text": "Pengeluaran melebihi pemasukan...",
    "priority": "high",
    "source": "llm",
    "label": "Boros",
    "confidence": 0.92,
    "savings_pct": 4.0
  },
  {
    "id": "ai-summary",
    "recommendation_type": "ai_summary",
    "title": "Ringkasan Keuangan Bulan Ini",
    "text": "Bulan ini pengeluaran terbesar ada di makanan...",
    "priority": "high",
    "source": "llm",
    "label": "Boros",
    "confidence": 0.92
  },
  {
    "id": "ai-cat-makanan_minuman",
    "recommendation_type": "ai_category",
    "title": "Tips Makanan Minuman",
    "text": "Pengeluaran makanan mencapai 45%...",
    "priority": "medium",
    "source": "llm",
    "category": "makanan_minuman"
  }
]
```

Saat AI tidak tersedia (fallback rule-based):

```json
[
  {
    "id": "top-category",
    "recommendation_type": "spending_pattern",
    "title": "Kategori pengeluaran terbesar",
    "text": "makanan minuman menjadi pengeluaran terbesar...",
    "priority": "high",
    "source": "rule_based",
    "label": null,
    "confidence": null
  }
]
```

---

## Troubleshooting

### Error: relation "ai_analysis" does not exist

Jalankan migrasi ulang:
```bash
npm run migrate
```

### Error: category not found / category_id null

Pastikan nama kategori di request cocok dengan yang ada di tabel `categories`:
```bash
# Lihat kategori yang tersedia
psql -U postgres -d smartfinanceai -c "SELECT id, name, label, type FROM categories ORDER BY id;"
```

Nama yang valid: `makanan_minuman`, `transportasi`, `hiburan`, `belanja_online`, `tagihan_utilitas`, `kesehatan`, `pendidikan`, `tabungan_investasi`, `lainnya`, `pemasukan`

### AI API tidak merespons

Backend akan otomatis fallback ke rule-based. Cek:
```bash
curl http://localhost:8002/health
```

Jika belum jalan, ikuti panduan README di folder AI model.

### Redis connection refused

Backend tetap berjalan tanpa Redis (graceful fallback). Untuk mengaktifkan Redis:
- Windows: Download Memurai dari https://www.memurai.com/
- Linux/Mac: `sudo apt install redis-server` atau `brew install redis`

---

*SmartFinance AI v2 — Coding Camp 2026 DBS Foundation*
