-- Elite Paint Voucher Entry System
-- D1 Database Schema
-- Migration 001: Initial Schema

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  trial_end DATETIME,
  is_blocked INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vouchers Table
CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_id TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  voucher_no TEXT NOT NULL,
  pay_to TEXT NOT NULL,
  code_no TEXT,
  control_ac TEXT,
  particulars TEXT NOT NULL,
  amount REAL NOT NULL,
  amount_words TEXT NOT NULL,
  account_no TEXT,
  payment_method TEXT,
  prepared_by TEXT,
  verified_by TEXT,
  recommended_by TEXT,
  approved_by TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'printed')),
  print_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Saved Lists Table (Auto-suggestions)
CREATE TABLE IF NOT EXISTS saved_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payto', 'code', 'ac', 'particulars')),
  value TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, type, value)
);

-- System Settings Table (for KV-style persistence via D1)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_vouchers_user_id ON vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_public_id ON vouchers(public_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_created_at ON vouchers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_lists_user_id ON saved_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_lists_type ON saved_lists(type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
