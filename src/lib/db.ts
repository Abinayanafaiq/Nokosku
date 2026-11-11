import "server-only";
import { Pool, type PoolClient } from "pg";
import { config } from "./config";

/** Semua tabel website ada di schema `nokos`, terpisah dari tabel lain di database yang sama. */
const SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS nokos;
CREATE TABLE IF NOT EXISTS nokos.users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  banned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS nokos.sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES nokos.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nokos.ledger (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES nokos.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT, ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_user_idx ON nokos.ledger(user_id, id DESC);
CREATE TABLE IF NOT EXISTS nokos.orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES nokos.users(id) ON DELETE CASCADE,
  sc_id INTEGER UNIQUE,
  phone TEXT, dial TEXT,
  country TEXT, country_id INTEGER, service TEXT, service_code TEXT, platform_id INTEGER,
  price INTEGER NOT NULL, cost INTEGER,
  status TEXT NOT NULL,
  otp_code TEXT, otp_message TEXT,
  last_rev INTEGER NOT NULL DEFAULT 0,
  refunded BOOLEAN NOT NULL DEFAULT FALSE,
  can_resend BOOLEAN NOT NULL DEFAULT FALSE,
  cancel_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON nokos.orders(user_id, id DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON nokos.orders(status);
CREATE TABLE IF NOT EXISTS nokos.deposits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES nokos.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  payable INTEGER, fee INTEGER,
  sp_id TEXT UNIQUE,
  status TEXT NOT NULL,
  credited BOOLEAN NOT NULL DEFAULT FALSE,
  qr_string TEXT, payment_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS deposits_user_idx ON nokos.deposits(user_id, id DESC);
CREATE INDEX IF NOT EXISTS deposits_status_idx ON nokos.deposits(status);
CREATE TABLE IF NOT EXISTS nokos.price_rules (
  id SERIAL PRIMARY KEY,
  service_code TEXT NOT NULL,
  service_name TEXT,
  country_id INTEGER,
  country_name TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('fixed','markup')),
  fixed INTEGER, pct REAL, min_profit INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS price_rules_uniq ON nokos.price_rules(service_code, COALESCE(country_id, -1));
CREATE TABLE IF NOT EXISTS nokos.settings (key TEXT PRIMARY KEY, value TEXT);
`;

type G = { __nokosPool?: Pool; __nokosSchema?: Promise<void> | null };
const g = globalThis as unknown as G;

export const pool: Pool =
  g.__nokosPool ??
  (g.__nokosPool = new Pool({
    connectionString: config.databaseUrl,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  }));

pool.on("error", (err) => console.error("[db] pool error:", err.message));

export async function ensureSchema() {
  if (!g.__nokosSchema) {
    g.__nokosSchema = pool
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        g.__nokosSchema = null;
        throw err;
      });
  }
  await g.__nokosSchema;
}

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const r = await pool.query(sql, params);
  return r.rows as T[];
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (err) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
}

// ---------------------------------------------------------------- tipe data
export type User = {
  id: number; email: string; name: string; password_hash: string; balance: number;
  banned: boolean; created_at: Date; last_login: Date | null;
};
export type Order = {
  id: number; user_id: number; sc_id: number | null; phone: string | null; dial: string | null;
  country: string | null; country_id: number | null; service: string | null; service_code: string | null;
  platform_id: number | null; price: number; cost: number | null; status: string;
  otp_code: string | null; otp_message: string | null; last_rev: number; refunded: boolean; can_resend: boolean;
  cancel_at: Date | null; expires_at: Date | null; created_at: Date; updated_at: Date;
};
export type Deposit = {
  id: number; user_id: number; amount: number; payable: number | null; fee: number | null;
  sp_id: string | null; status: string; credited: boolean; qr_string: string | null; payment_url: string | null;
  expires_at: Date | null; created_at: Date; paid_at: Date | null;
};
export type PriceRule = {
  id: number; service_code: string; service_name: string | null; country_id: number | null;
  country_name: string | null; mode: "fixed" | "markup"; fixed: number | null; pct: number | null;
  min_profit: number | null;
};
export type LedgerRow = {
  id: number; user_id: number; delta: number; balance_after: number; reason: string | null;
  ref: string | null; created_at: Date;
};

// ---------------------------------------------------------------- saldo
/** Tambah saldo (di dalam transaksi). Return saldo baru. */
export async function credit(c: PoolClient, uid: number, amount: number, reason: string, ref = "") {
  const r = await c.query<{ balance: number }>(
    "UPDATE nokos.users SET balance = balance + $1 WHERE id = $2 RETURNING balance", [amount, uid]);
  const bal = r.rows[0].balance;
  await c.query("INSERT INTO nokos.ledger(user_id, delta, balance_after, reason, ref) VALUES ($1,$2,$3,$4,$5)",
    [uid, amount, bal, reason, ref]);
  return bal;
}

/** Potong saldo kalau cukup (di dalam transaksi). Return saldo baru atau null kalau kurang. */
export async function debit(c: PoolClient, uid: number, amount: number, reason: string, ref = "") {
  const r = await c.query<{ balance: number }>(
    "UPDATE nokos.users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance",
    [amount, uid]);
  if (!r.rowCount) return null;
  const bal = r.rows[0].balance;
  await c.query("INSERT INTO nokos.ledger(user_id, delta, balance_after, reason, ref) VALUES ($1,$2,$3,$4,$5)",
    [uid, -amount, bal, reason, ref]);
  return bal;
}

// ---------------------------------------------------------------- settings
export async function getSetting(key: string): Promise<string | null> {
  const r = await one<{ value: string }>("SELECT value FROM nokos.settings WHERE key = $1", [key]);
  return r?.value ?? null;
}

export async function setSetting(key: string, value: string | number) {
  await q("INSERT INTO nokos.settings(key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key, String(value)]);
}
