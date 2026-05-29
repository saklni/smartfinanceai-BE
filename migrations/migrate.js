'use strict'

require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'smartfinanceai',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

const isFresh = process.argv.includes('--fresh')

const DROP_TABLES = `
  DROP TABLE IF EXISTS ai_analysis CASCADE;
  DROP TABLE IF EXISTS recommendations CASCADE;
  DROP TABLE IF EXISTS transactions CASCADE;
  DROP TABLE IF EXISTS categories CASCADE;
  DROP TABLE IF EXISTS user_profiles CASCADE;
  DROP TABLE IF EXISTS users CASCADE;
`

const CREATE_USERS = `
  CREATE TABLE IF NOT EXISTS users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'suspended')),
    email_verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`

const CREATE_USER_PROFILES = `
  CREATE TABLE IF NOT EXISTS user_profiles (
    id                  SERIAL PRIMARY KEY,
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    nickname            VARCHAR(50),
    age_range           VARCHAR(10) CHECK (age_range IN ('<18','18-24','25-34','35+') OR age_range IS NULL),
    monthly_income      NUMERIC(15,2) DEFAULT 0,
    saving_target       NUMERIC(15,2) DEFAULT 0,
    spending_style      VARCHAR(20) CHECK (spending_style IN ('frugal','balanced','impulsive') OR spending_style IS NULL),
    financial_goal      VARCHAR(50) CHECK (financial_goal IN ('saving','control_expense','emergency_fund','budgeting') OR financial_goal IS NULL),
    main_priority       VARCHAR(60) CHECK (main_priority IN (
                          'reduce_unnecessary_expense','understand_spending_pattern',
                          'increase_saving','financial_planning') OR main_priority IS NULL),
    risk_profile        VARCHAR(20) DEFAULT 'moderate'
                          CHECK (risk_profile IN ('conservative','moderate','aggressive')),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`

const CREATE_CATEGORIES = `
  CREATE TABLE IF NOT EXISTS categories (
    id         SERIAL PRIMARY KEY,
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    label      VARCHAR(100) NOT NULL,
    type       VARCHAR(10) NOT NULL DEFAULT 'expense'
                 CHECK (type IN ('income','expense')),
    icon       VARCHAR(50) DEFAULT 'circle',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_user
    ON categories(name, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID));
`

const CREATE_TRANSACTIONS = `
  CREATE TABLE IF NOT EXISTS transactions (
    id               SERIAL PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title            VARCHAR(200) NOT NULL,
    description      TEXT DEFAULT '',
    type             VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
    amount           NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    note             TEXT DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(user_id, type);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
`

const CREATE_RECOMMENDATIONS = `
  CREATE TABLE IF NOT EXISTS recommendations (
    id                  SERIAL PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) DEFAULT 'general',
    title               VARCHAR(200) NOT NULL,
    message             TEXT NOT NULL,
    priority            VARCHAR(10) DEFAULT 'medium'
                          CHECK (priority IN ('high','medium','low')),
    source              VARCHAR(20) DEFAULT 'rule_based'
                          CHECK (source IN ('rule_based','ml','llm')),
    action              TEXT,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_recommendations_user ON recommendations(user_id);
`

const CREATE_AI_ANALYSIS = `
  CREATE TABLE IF NOT EXISTS ai_analysis (
    id                   SERIAL PRIMARY KEY,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bulan                SMALLINT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    tahun                SMALLINT NOT NULL,
    label_keuangan       VARCHAR(10) NOT NULL,
    confidence           NUMERIC(5,4) NOT NULL,
    savings_pct          NUMERIC(6,2),
    financial_health     TEXT,
    summary_rekomendasi  TEXT,
    category_rekomendasi JSONB,
    generated_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, bulan, tahun)
  );
  CREATE INDEX IF NOT EXISTS idx_ai_analysis_user   ON ai_analysis (user_id);
  CREATE INDEX IF NOT EXISTS idx_ai_analysis_period ON ai_analysis (bulan, tahun);
`

const SEED_CATEGORIES = `
  INSERT INTO categories (name, label, type, icon) VALUES
    ('makanan_minuman',    'Makanan & Minuman',  'expense', 'utensils'),
    ('transportasi',       'Transportasi',       'expense', 'car'),
    ('hiburan',            'Hiburan',            'expense', 'smile'),
    ('belanja_online',     'Belanja Online',     'expense', 'shopping-bag'),
    ('pendidikan',         'Pendidikan',         'expense', 'book-open'),
    ('tagihan_utilitas',   'Tagihan & Utilitas', 'expense', 'receipt'),
    ('kesehatan',          'Kesehatan',          'expense', 'heart-pulse'),
    ('tabungan_investasi', 'Tabungan & Investasi','expense','piggy-bank'),
    ('lainnya',            'Lainnya',            'expense', 'circle'),
    ('pemasukan',          'Pemasukan',          'income',  'wallet')
  ON CONFLICT DO NOTHING;
`

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('🗄  SmartFinance AI — Database Migration (v3)\n')

    if (isFresh) {
      console.log('⚠️  Mode --fresh: menghapus semua tabel...')
      await client.query(DROP_TABLES)
      console.log('✅  Tabel lama dihapus\n')
    }

    const steps = [
      ['users',            CREATE_USERS],
      ['user_profiles',    CREATE_USER_PROFILES],
      ['categories',       CREATE_CATEGORIES],
      ['transactions',     CREATE_TRANSACTIONS],
      ['recommendations',  CREATE_RECOMMENDATIONS],
      ['ai_analysis',      CREATE_AI_ANALYSIS],
    ]

    for (const [name, sql] of steps) {
      await client.query(sql)
      console.log(`✅  Tabel ${name} siap`)
    }

    await client.query(SEED_CATEGORIES)
    console.log('✅  Kategori default di-seed (format Indonesia snake_case)\n')

    console.log('🎉  Migrasi selesai! Database siap digunakan.')
    console.log('\n📋  Kategori yang tersedia:')
    console.log('   makanan_minuman, transportasi, hiburan, belanja_online,')
    console.log('   pendidikan, tagihan_utilitas, kesehatan, tabungan_investasi,')
    console.log('   lainnya, pemasukan')
  } catch (err) {
    console.error('\n❌  Migrasi gagal:', err.message)
    console.error('    Pastikan PostgreSQL berjalan dan konfigurasi .env benar.')
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
