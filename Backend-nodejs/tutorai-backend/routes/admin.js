const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const db       = require('../services/database');

// ── Sesión simple en memoria ───────────────────────────────────────────
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isAuthenticated(req) {
  const token = req.cookies?.admin_token;
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > 8 * 60 * 60 * 1000) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.redirect('/admin/login');
}

// ── CSS y JS compartido ────────────────────────────────────────────────
const SHARED_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f4f4f1;color:#1a1a18;min-height:100vh}
  .nav{background:#0F6E56;color:#fff;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:56px;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.15)}
  .nav-brand{font-weight:700;font-size:17px;letter-spacing:.3px}
  .nav-links{display:flex;gap:4px}
  .nav-links a{color:rgba(255,255,255,.8);text-decoration:none;padding:6px 14px;border-radius:8px;font-size:14px;transition:background .15s,color .15s}
  .nav-links a:hover,.nav-links a.active{background:rgba(255,255,255,.15);color:#fff}
  .nav-links a.logout{color:rgba(255,255,255,.6)}
  .container{max-width:1100px;margin:0 auto;padding:28px 20px}
  .page-title{font-size:22px;font-weight:600;margin-bottom:6px}
  .page-sub{color:#666;font-size:14px;margin-bottom:28px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px}
  .card{background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.07)}
  .card-value{font-size:32px;font-weight:700;color:#0F6E56;line-height:1}
  .card-label{font-size:13px;color:#888;margin-top:6px}
  .card-sub{font-size:12px;color:#aaa;margin-top:3px}
  .section{background:#fff;border-radius:14px;padding:22px;box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:20px}
  .section-title{font-size:15px;font-weight:600;margin-bottom:16px;color:#333;display:flex;align-items:center;gap:8px}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th{text-align:left;padding:8px 12px;background:#f8f8f6;color:#666;font-weight:500;border-bottom:1px solid #eee;font-size:12px;text-transform:uppercase;letter-spacing:.4px}
  td{padding:10px 12px;border-bottom:1px solid #f2f2f0;color:#333}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#fafaf8}
  .bar-wrap{background:#eee;border-radius:4px;height:6px;margin-top:4px}
  .bar{background:#1D9E75;height:6px;border-radius:4px;transition:width .3s}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500}
  .badge-green{background:#e1f5ee;color:#0F6E56}
  .chart-wrap{height:160px;display:flex;align-items:flex-end;gap:4px;padding:8px 0 0}
  .chart-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
  .chart-bar{background:#1D9E75;border-radius:4px 4px 0 0;width:100%;min-height:2px;transition:height .3s}
  .chart-label{font-size:9px;color:#aaa;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap}
  .form-group{margin-bottom:18px}
  label{display:block;font-size:13px;font-weight:500;color:#444;margin-bottom:6px}
  input[type=text],input[type=password],textarea,select{width:100%;padding:9px 12px;border:1.5px solid #ddd;border-radius:9px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s;background:#fff}
  input:focus,textarea:focus,select:focus{border-color:#1D9E75}
  textarea{resize:vertical;min-height:140px;line-height:1.5}
  .hint{font-size:12px;color:#999;margin-top:4px}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;border-radius:9px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:background .15s,transform .1s}
  .btn:active{transform:scale(.98)}
  .btn-primary{background:#1D9E75;color:#fff}
  .btn-primary:hover{background:#0F6E56}
  .btn-danger{background:#fee;color:#c0392b;border:1px solid #fcc}
  .btn-danger:hover{background:#fcc}
  .btn-sm{padding:5px 12px;font-size:12px}
  .alert{padding:12px 16px;border-radius:9px;font-size:14px;margin-bottom:20px}
  .alert-success{background:#e1f5ee;color:#0F6E56;border:1px solid #9FE1CB}
  .alert-error{background:#fee;color:#c0392b;border:1px solid #fcc}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  @media(max-width:640px){.two-col{grid-template-columns:1fr}.cards{grid-template-columns:1fr 1fr}}
`;

// ── Login ──────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/admin');
  const err = req.query.error ? '<div class="alert alert-error">Usuario o contraseña incorrectos</div>' : '';
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Coach Angela — Admin</title>
  <style>${SHARED_CSS}
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f4f1}
  .login-box{background:#fff;border-radius:16px;padding:36px 32px;width:100%;max-width:380px;box-shadow:0 4px 24px rgba(0,0,0,.1)}
  .login-logo{width:48px;height:48px;background:#0F6E56;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;margin:0 auto 20px}
  .login-title{text-align:center;font-size:20px;font-weight:600;margin-bottom:4px}
  .login-sub{text-align:center;font-size:13px;color:#888;margin-bottom:24px}
  </style></head><body>
  <div class="login-wrap"><div class="login-box">
    <div class="login-logo">A</div>
    <div class="login-title">Coach Angela</div>
    <div class="login-sub">Panel de administración</div>
    ${err}
    <form method="POST" action="/admin/login">
      <div class="form-group"><label>Usuario</label>
        <input type="text" name="username" required autofocus placeholder="admin"></div>
      <div class="form-group"><label>Contraseña</label>
        <input type="password" name="password" required placeholder="••••••••"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center" type="submit">Ingresar</button>
    </form>
  </div></div></body></html>`);
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (db.verifyAdmin(username, password)) {
    const token = generateToken();
    sessions.set(token, { username, createdAt: Date.now() });
    res.setHeader('Set-Cookie', `admin_token=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict`);
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?error=1');
});

router.get('/logout', (req, res) => {
  const token = req.cookies?.admin_token;
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; Path=/; Max-Age=0');
  res.redirect('/admin/login');
});

// ── Navbar helper ──────────────────────────────────────────────────────
function nav(active) {
  const links = [
    ['/', 'Métricas'],
    ['/config', 'Configuración'],
    ['/password', 'Contraseña'],
  ].map(([path, label]) =>
    `<a href="/admin${path}" class="${active===path?'active':''}">${label}</a>`
  ).join('');
  return `<nav class="nav">
    <div class="nav-brand">Coach Angela Admin</div>
    <div class="nav-links">${links}<a href="/admin/logout" class="logout">Salir</a></div>
  </nav>`;
}

// ── Dashboard de métricas ─────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const m   = db.getMetrics();
  const msg = req.query.msg || '';

  const maxDay = Math.max(...m.byDay.map(d => d.messages), 1);
  const chartBars = m.byDay.map(d => {
    const h = Math.round((d.messages / maxDay) * 120);
    const label = d.day.substring(5); // MM-DD
    return `<div class="chart-bar-wrap">
      <div class="chart-bar" style="height:${h}px" title="${d.day}: ${d.messages} mensajes"></div>
      <div class="chart-label">${label}</div>
    </div>`;
  }).join('');

  const maxCourse = Math.max(...m.byCourse.map(c => c.messages), 1);
  const courseRows = m.byCourse.map(c => `<tr>
    <td><strong>${c.name}</strong></td>
    <td>${c.messages}
      <div class="bar-wrap"><div class="bar" style="width:${Math.round(c.messages/maxCourse*100)}%"></div></div>
    </td>
    <td>${c.students}</td>
  </tr>`).join('');

  const studentRows = m.byStudent.map(s => `<tr>
    <td>${s.name}</td>
    <td>${s.messages}</td>
    <td>${new Date(s.last_active * 1000).toLocaleDateString('es-CO')}</td>
  </tr>`).join('');

  const tokenRows = m.tokensByCourse.map(t => `<tr>
    <td>${t.name}</td>
    <td>${t.tokens.toLocaleString()}</td>
    <td>~$${((t.tokens/1_000_000)*0.40).toFixed(4)}</td>
  </tr>`).join('');

  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Métricas — Coach Angela</title>
  <style>${SHARED_CSS}</style></head><body>
  ${nav('/')}
  <div class="container">
    <div class="page-title">Métricas de uso</div>
    <div class="page-sub">Actividad del agente Coach Angela en todos los cursos</div>

    <div class="cards">
      <div class="card"><div class="card-value">${m.totalMessages.toLocaleString()}</div>
        <div class="card-label">Mensajes totales</div></div>
      <div class="card"><div class="card-value">${m.totalSessions.toLocaleString()}</div>
        <div class="card-label">Sesiones únicas</div><div class="card-sub">usuario × curso</div></div>
      <div class="card"><div class="card-value">${m.totalTokens.toLocaleString()}</div>
        <div class="card-label">Tokens consumidos</div></div>
      <div class="card"><div class="card-value">$${m.estimatedCost}</div>
        <div class="card-label">Costo estimado USD</div><div class="card-sub">GPT-4o-mini ~$0.40/1M</div></div>
    </div>

    <div class="section">
      <div class="section-title">Mensajes por día (últimos 30 días)</div>
      ${m.byDay.length ? `<div class="chart-wrap">${chartBars}</div>` : '<p style="color:#aaa;font-size:13px">Sin datos aún</p>'}
    </div>

    <div class="two-col">
      <div class="section">
        <div class="section-title">Uso por curso</div>
        ${m.byCourse.length ? `<table><thead><tr><th>Curso</th><th>Mensajes</th><th>Estudiantes</th></tr></thead><tbody>${courseRows}</tbody></table>`
        : '<p style="color:#aaa;font-size:13px">Sin datos aún</p>'}
      </div>
      <div class="section">
        <div class="section-title">Estudiantes más activos</div>
        ${m.byStudent.length ? `<table><thead><tr><th>Estudiante</th><th>Mensajes</th><th>Último acceso</th></tr></thead><tbody>${studentRows}</tbody></table>`
        : '<p style="color:#aaa;font-size:13px">Sin datos aún</p>'}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Tokens por curso</div>
      ${m.tokensByCourse.length ? `<table><thead><tr><th>Curso</th><th>Tokens</th><th>Costo estimado</th></tr></thead><tbody>${tokenRows}</tbody></table>`
      : '<p style="color:#aaa;font-size:13px">Sin datos aún</p>'}
    </div>
  </div></body></html>`);
});

// ── Configuración del agente ───────────────────────────────────────────
router.get('/config', requireAuth, (req, res) => {
  const cfg = db.getAllConfig();
  const msg = req.query.saved ? '<div class="alert alert-success">Configuración guardada correctamente</div>' : '';

  const models = ['gpt-4o-mini','gpt-4o','gpt-4-turbo','gpt-3.5-turbo']
    .map(m => `<option value="${m}" ${cfg.openai_model===m?'selected':''}>${m}</option>`).join('');

  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Configuración — Coach Angela</title>
  <style>${SHARED_CSS}</style></head><body>
  ${nav('/config')}
  <div class="container">
    <div class="page-title">Configuración del agente</div>
    <div class="page-sub">Los cambios se aplican de inmediato sin reiniciar el servidor</div>
    ${msg}
    <form method="POST" action="/admin/config">
      <div class="two-col">
        <div class="section">
          <div class="section-title">Modelo de IA</div>
          <div class="form-group"><label>Modelo OpenAI</label>
            <select name="openai_model">${models}</select>
            <div class="hint">gpt-4o-mini es más rápido y económico. gpt-4o es más potente.</div>
          </div>
          <div class="form-group"><label>Máximo de tokens por respuesta</label>
            <input type="text" name="max_tokens" value="${cfg.max_tokens||1024}">
            <div class="hint">Entre 256 y 4096. Más tokens = respuestas más largas y mayor costo.</div>
          </div>
          <div class="form-group"><label>Temperatura (creatividad)</label>
            <input type="text" name="temperature" value="${cfg.temperature||0.7}">
            <div class="hint">Entre 0 (determinista) y 1 (creativo). Recomendado: 0.7</div>
          </div>
          <div class="form-group"><label>API Key de OpenAI</label>
            <input type="password" name="openai_api_key" placeholder="sk-... (dejar vacío para no cambiar)">
            <div class="hint">Solo ingresa si deseas cambiar la clave actual.</div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Personalidad del agente</div>
          <div class="form-group"><label>System prompt</label>
            <textarea name="system_prompt" rows="12">${cfg.system_prompt||''}</textarea>
            <div class="hint">Define el comportamiento base de Coach Angela. El contexto del curso se agrega automáticamente al final.</div>
          </div>
        </div>
      </div>
      <button class="btn btn-primary" type="submit">Guardar cambios</button>
    </form>
  </div></body></html>`);
});

router.post('/config', requireAuth, (req, res) => {
  const { openai_model, max_tokens, temperature, openai_api_key, system_prompt } = req.body;
  if (openai_model)  db.setConfig('openai_model',  openai_model);
  if (max_tokens)    db.setConfig('max_tokens',     max_tokens);
  if (temperature)   db.setConfig('temperature',    temperature);
  if (system_prompt) db.setConfig('system_prompt',  system_prompt);
  if (openai_api_key && openai_api_key.startsWith('sk-'))
    db.setConfig('openai_api_key', openai_api_key);
  res.redirect('/admin/config?saved=1');
});

// ── Cambio de contraseña ───────────────────────────────────────────────
router.get('/password', requireAuth, (req, res) => {
  const msg = req.query.saved ? '<div class="alert alert-success">Contraseña actualizada</div>'
    : req.query.error ? '<div class="alert alert-error">Las contraseñas no coinciden</div>' : '';
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Contraseña — Coach Angela</title>
  <style>${SHARED_CSS}</style></head><body>
  ${nav('/password')}
  <div class="container">
    <div class="page-title">Cambiar contraseña</div>
    <div class="page-sub">Cambia la contraseña de acceso al panel admin</div>
    ${msg}
    <div class="section" style="max-width:420px">
      <form method="POST" action="/admin/password">
        <div class="form-group"><label>Nueva contraseña</label>
          <input type="password" name="password" required minlength="8"></div>
        <div class="form-group"><label>Confirmar contraseña</label>
          <input type="password" name="confirm" required minlength="8"></div>
        <button class="btn btn-primary" type="submit">Actualizar contraseña</button>
      </form>
    </div>
  </div></body></html>`);
});

router.post('/password', requireAuth, (req, res) => {
  const { password, confirm } = req.body;
  if (password !== confirm) return res.redirect('/admin/password?error=1');
  const token    = req.cookies?.admin_token;
  const session  = sessions.get(token);
  db.changeAdminPassword(session.username, password);
  res.redirect('/admin/password?saved=1');
});

module.exports = router;