require('dotenv').config();
const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const chatRoute  = require('./routes/chat_route');
const adminRoute = require('./routes/admin');
const { initDb } = require('./services/database');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));

// CORS solo para rutas /api (llamadas desde Moodle)
// Las rutas /admin son HTML directo — no necesitan CORS
const allowedOrigins = (process.env.MOODLE_URL || '').split(',').map(s => s.trim()).filter(Boolean);
app.use('/api', cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error('CORS bloqueado'));
  },
}));

app.use(express.json({
  limit: '32kb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// Parser de cookies manual (sin dependencia extra)
app.use((req, _res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie || '';
  cookieHeader.split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=');
    if (k) req.cookies[k.trim()] = v.join('=').trim();
  });
  next();
});

app.use(rateLimit({
  windowMs: 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'too_many_requests' },
}));

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
app.use('/api',   chatRoute);
app.use('/admin', adminRoute);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'internal_error' });
});

async function start() {
  await initDb();
  app.listen(PORT, () => console.log(`TutorAI backend en puerto ${PORT}`));
}

start().catch(err => { console.error('Error:', err); process.exit(1); });