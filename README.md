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
# Development 
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

## Langkah 5 — Integrasi AI 

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
├── .env.example                          
├── package.json
├── migrations/
│   └── migrate.js                        
├── seeds/
│   └── seed.js                           
└── src/
    ├── app.js                           
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
    │   │   └── transactions.service.js  
    │   ├── categories/
    │   │   ├── categories.routes.js
    │   │   ├── categories.controller.js
    │   │   └── categories.service.js     
    │   ├── recommendations/
    │   │   ├── recommendations.routes.js
    │   │   ├── recommendations.controller.js
    │   │   ├── recommendations.service.js 
    │   │   └── aiService.js              
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


