const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tutorai.db');

let db;

function getDb() {
  if (!db) throw new Error('Base de datos no inicializada');
  return db;
}

async function initDb() {
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');  // Mejor rendimiento con escrituras concurrentes
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      course_id   INTEGER NOT NULL,
      role        TEXT    NOT NULL CHECK(role IN ('user','assistant')),
      content     TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_conv_user_course
      ON conversations(user_id, course_id, created_at);

    CREATE TABLE IF NOT EXISTS usage_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      course_id   INTEGER NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      model       TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  console.log('[db] Base de datos lista en', DB_PATH);
}

// ── Historial ──────────────────────────────────────────────────────────

function saveMessage(userId, courseId, role, content) {
  getDb().prepare(`
    INSERT INTO conversations (user_id, course_id, role, content)
    VALUES (?, ?, ?, ?)
  `).run(userId, courseId, role, content);
}

function getHistory(userId, courseId, limit = 20) {
  return getDb().prepare(`
    SELECT role, content FROM conversations
    WHERE user_id = ? AND course_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, courseId, limit).reverse();
  // .reverse() para que queden en orden cronológico (más viejo primero)
}

function clearHistory(userId, courseId) {
  getDb().prepare(`
    DELETE FROM conversations WHERE user_id = ? AND course_id = ?
  `).run(userId, courseId);
}

// ── Logs de uso ────────────────────────────────────────────────────────

function logUsage(userId, courseId, tokensUsed, model) {
  getDb().prepare(`
    INSERT INTO usage_logs (user_id, course_id, tokens_used, model)
    VALUES (?, ?, ?, ?)
  `).run(userId, courseId, tokensUsed || 0, model || 'unknown');
}

module.exports = { initDb, saveMessage, getHistory, clearHistory, logUsage };
