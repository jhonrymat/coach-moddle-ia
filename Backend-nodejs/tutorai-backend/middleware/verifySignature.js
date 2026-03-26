const crypto = require('crypto');

/**
 * Verifica la firma HMAC-SHA256 enviada por el plugin PHP de Moodle.
 * PHP firma: hash_hmac('sha256', (string) $timestamp, $secret)
 * Node verifica contra el mismo timestamp del body.
 */
module.exports = function verifySignature(req, res, next) {
  const secret = process.env.API_SECRET;
  if (!secret) {
    console.error('[auth] API_SECRET no configurado');
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  const signature = req.headers['x-tutorai-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'missing_signature' });
  }

  const timestamp = String(req.body?.timestamp || '');
  if (!timestamp) {
    return res.status(401).json({ error: 'missing_timestamp' });
  }

  // Rechazar timestamps con más de 5 minutos — anti-replay
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (age > 300) {
    return res.status(401).json({ error: 'expired_request' });
  }

  const expected = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');

  try {
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected,  'hex');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return next();
    }
  } catch { /* firma malformada */ }

  return res.status(401).json({ error: 'invalid_signature' });
};