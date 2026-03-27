const Database = require('better-sqlite3');
const path     = require('path');
const crypto   = require('crypto');

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
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      course_id   INTEGER NOT NULL,
      user_name   TEXT    DEFAULT '',
      course_name TEXT    DEFAULT '',
      role        TEXT    NOT NULL CHECK(role IN ('user','assistant')),
      content     TEXT    NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_conv_user_course
      ON conversations(user_id, course_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_conv_date
      ON conversations(created_at);

    CREATE TABLE IF NOT EXISTS usage_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      course_id   INTEGER NOT NULL,
      user_name   TEXT    DEFAULT '',
      course_name TEXT    DEFAULT '',
      tokens_used INTEGER DEFAULT 0,
      model       TEXT    DEFAULT '',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_usage_date
      ON usage_logs(created_at);

    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Insertar configuración por defecto si no existe
  const defaults = [
    ['system_prompt', `Eres Coach Angela, asesora educativa inteligente del Campus Virtual.
Tu rol es ayudar a los estudiantes de forma personalizada, amable y precisa.
Responde SIEMPRE en español.
Usa el nombre del estudiante cuando sea natural en la conversación.
Si no sabes algo específico del contenido del curso, sé honesta y dilo.
Mantén un tono académico pero cercano, como una tutora personal.
Respuestas concisas: máximo 3-4 párrafos salvo que el estudiante pida más detalle.`],
    ['moodle_url',    process.env.MOODLE_URL   || ''],
    ['moodle_token',  process.env.MOODLE_TOKEN || ''],
    ['disabled_tools', '[]'],
    ['openai_model', process.env.OPENAI_MODEL || 'gpt-4o-mini'],
    ['max_tokens',   '1024'],
    ['temperature',  '0.7'],
  ];

  const upsert = db.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`);
  defaults.forEach(([k, v]) => upsert.run(k, v));

  // Crear admin por defecto si no existe ninguno
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM admin_users').get();
  if (adminCount.c === 0) {
    const defaultPass = process.env.ADMIN_PASSWORD || 'admin1234';
    const hash = crypto.createHash('sha256').update(defaultPass).digest('hex');
    db.prepare(`INSERT INTO admin_users (username, password_hash) VALUES (?, ?)`)
      .run('admin', hash);
    console.log('[db] Usuario admin creado — cambia la contraseña en el panel');
  }

  console.log('[db] Base de datos lista en', DB_PATH);
}

// ── Historial ──────────────────────────────────────────────────────────
function saveMessage(userId, courseId, role, content, userName, courseName) {
  getDb().prepare(`
    INSERT INTO conversations (user_id, course_id, user_name, course_name, role, content)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, courseId, userName || '', courseName || '', role, content);
}

function getHistory(userId, courseId, limit = 20) {
  return getDb().prepare(`
    SELECT role, content FROM conversations
    WHERE user_id = ? AND course_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(userId, courseId, limit).reverse();
}

function clearHistory(userId, courseId) {
  getDb().prepare(`DELETE FROM conversations WHERE user_id = ? AND course_id = ?`)
    .run(userId, courseId);
}

// ── Uso / tokens ───────────────────────────────────────────────────────
function logUsage(userId, courseId, tokensUsed, model, userName, courseName) {
  getDb().prepare(`
    INSERT INTO usage_logs (user_id, course_id, user_name, course_name, tokens_used, model)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, courseId, userName || '', courseName || '', tokensUsed || 0, model || '');
}

// ── Configuración ──────────────────────────────────────────────────────
function getConfig(key) {
  const row = getDb().prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setConfig(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
}

function getAllConfig() {
  return getDb().prepare('SELECT key, value FROM config').all()
    .reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
}

// ── Admin auth ─────────────────────────────────────────────────────────
function verifyAdmin(username, password) {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const user = getDb().prepare(
    'SELECT id FROM admin_users WHERE username = ? AND password_hash = ?'
  ).get(username, hash);
  return !!user;
}

function changeAdminPassword(username, newPassword) {
  const hash = crypto.createHash('sha256').update(newPassword).digest('hex');
  getDb().prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?')
    .run(hash, username);
}

// ── Métricas ───────────────────────────────────────────────────────────
function getMetrics() {
  const d = getDb();

  const totalMessages = d.prepare(
    `SELECT COUNT(*) as c FROM conversations WHERE role = 'user'`
  ).get().c;

  const totalSessions = d.prepare(
    `SELECT COUNT(DISTINCT user_id || '_' || course_id) as c FROM conversations`
  ).get().c;

  const totalTokens = d.prepare(
    `SELECT COALESCE(SUM(tokens_used), 0) as t FROM usage_logs`
  ).get().t;

  const byCourse = d.prepare(`
    SELECT course_id,
           CASE WHEN course_name != '' THEN course_name ELSE 'Curso #' || course_id END as name,
           COUNT(*) as messages,
           COUNT(DISTINCT user_id) as students
    FROM conversations WHERE role = 'user'
    GROUP BY course_id ORDER BY messages DESC LIMIT 10
  `).all();

  const byStudent = d.prepare(`
    SELECT user_id,
           CASE WHEN user_name != '' THEN user_name ELSE 'Usuario #' || user_id END as name,
           COUNT(*) as messages,
           MAX(created_at) as last_active
    FROM conversations WHERE role = 'user'
    GROUP BY user_id ORDER BY messages DESC LIMIT 10
  `).all();

  const byDay = d.prepare(`
    SELECT date(created_at, 'unixepoch') as day, COUNT(*) as messages
    FROM conversations WHERE role = 'user'
      AND created_at > unixepoch() - 30*86400
    GROUP BY day ORDER BY day
  `).all();

  const tokensByCourse = d.prepare(`
    SELECT course_id,
           CASE WHEN course_name != '' THEN course_name ELSE 'Curso #' || course_id END as name,
           SUM(tokens_used) as tokens
    FROM usage_logs GROUP BY course_id ORDER BY tokens DESC LIMIT 10
  `).all();

  // Costo estimado GPT-4o-mini: $0.15 / 1M tokens input, $0.60 / 1M output
  // Usamos promedio conservador de $0.40 / 1M tokens
  const estimatedCost = ((totalTokens / 1_000_000) * 0.40).toFixed(4);

  return { totalMessages, totalSessions, totalTokens, estimatedCost,
           byCourse, byStudent, byDay, tokensByCourse };
}

module.exports = {
  initDb, saveMessage, getHistory, clearHistory, logUsage,
  getConfig, setConfig, getAllConfig, verifyAdmin, changeAdminPassword, getMetrics
};