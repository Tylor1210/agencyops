/**
 * db.js — Dual-Mode Database Adapter (SQLite / PostgreSQL)
 *
 * Behavior:
 *  - If DATABASE_URL or DB_HOST env vars are set → connects to PostgreSQL via `pg`
 *  - Otherwise → uses the built-in `node:sqlite` module (available in Node v22+)
 *    No native compilation required — zero npm dependencies for SQLite.
 *
 * Exports a unified `query(sql, params)` async function and a `transaction(fn)` helper.
 */

const fs   = require('fs');
const path = require('path');

let adapter  = null; // 'sqlite' | 'postgres'
let pgPool   = null;
let sqliteDb = null;

function init() {
  if (process.env.DATABASE_URL || process.env.DB_HOST) {
    // ── PostgreSQL mode ─────────────────────────────────────────────────────
    const { Pool } = require('pg');
    pgPool = new Pool(
      process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host:     process.env.DB_HOST,
            port:     process.env.DB_PORT     || 5432,
            user:     process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
          }
    );
    adapter = 'postgres';
    console.log('🐘  Database: PostgreSQL');

    // Apply the pg-compatible version of the schema (SERIAL / TIMESTAMP)
    const pgSchema = fs
      .readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
      .replace(/DATETIME/g, 'TIMESTAMP');

    return pgPool.query(pgSchema).catch((e) => {
      console.warn('Schema init warning (may already exist):', e.message);
    });
  }

  // ── node:sqlite mode (built-in, Node v22+) ───────────────────────────────
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    console.error('node:sqlite not available. Requires Node.js v22 or newer. Current:', process.version);
    process.exit(1);
  }

  const dbPath = process.env.DB_PATH || path.join(__dirname, 'agencyops.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA journal_mode = WAL');
  sqliteDb.exec('PRAGMA foreign_keys = ON');
  adapter = 'sqlite';
  console.log(`🗄️   Database: SQLite via node:sqlite (${dbPath})`);

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  sqliteDb.exec(schemaSql);

  return Promise.resolve();
}

/**
 * Unified query function.
 * Uses $1,$2 placeholders (Postgres-style). Automatically converts to ? for SQLite.
 * @param {string} sql
 * @param {Array}  params
 * @returns {Promise<{ rows: Array, lastID?: number, changes?: number }>}
 */
async function query(sql, params = []) {
  if (adapter === 'postgres') {
    const result = await pgPool.query(sql, params);
    return { rows: result.rows };
  }

  if (adapter === 'sqlite') {
    // Convert $1,$2,... → ? for SQLite
    const sqliteSql = sql.replace(/\$\d+/g, '?');

    if (/^\s*(select|pragma|with)/i.test(sqliteSql.trim())) {
      const stmt = sqliteDb.prepare(sqliteSql);
      const rows = stmt.all(...params);
      return { rows };
    } else {
      const stmt = sqliteDb.prepare(sqliteSql);
      const info = stmt.run(...params);
      return {
        rows:    [],
        lastID:  info.lastInsertRowid,
        changes: info.changes,
      };
    }
  }

  throw new Error('Database not initialized. Call db.init() first.');
}

/**
 * Run a set of operations as an atomic unit.
 * In SQLite mode wraps calls in BEGIN/COMMIT. In Postgres, caller manages transactions.
 */
async function transaction(fn) {
  if (adapter === 'sqlite') {
    sqliteDb.exec('BEGIN');
    try {
      await fn();
      sqliteDb.exec('COMMIT');
    } catch (err) {
      sqliteDb.exec('ROLLBACK');
      throw err;
    }
    return;
  }
  // For postgres, just run — callers may BEGIN/COMMIT manually if needed
  return fn();
}

module.exports = { init, query, transaction };
