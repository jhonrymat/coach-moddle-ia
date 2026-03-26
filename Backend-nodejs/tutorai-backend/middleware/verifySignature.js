const crypto = require('crypto');

/**
 * Verificación HMAC simplificada y confiable.
 *
 * PHP firma: hash_hmac('sha256', $timestamp, $secret)
 * Node verifica contra el mismo timestamp del body.
 *
 * Esto evita el problema de reserialización de JSON entre PHP y Node.
 */
module.exports = function verifySignature(req, res, next) {
  const secret = process.env.API_SECRET;
  if (!secret) {
    console.error('[auth] API_SECRET no configurado');
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  const signature = req.headers['x-tutorai-signature'];
  if (!signature) {
    console.warn('[auth] Firma ausente');
    return res.status(401).json({ error: 'missing_signature' });
  }

  // Verificar contra el timestamp del body (string simple, sin riesgo de reserialización)
  const timestamp = String(req.body?.timestamp || '');
  if (!timestamp) {
    return res.status(401).json({ error: 'missing_timestamp' });
  }

  // Rechazar timestamps muy antiguos (>5 minutos) — anti-replay
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (age > 300) {
    console.warn('[auth] Timestamp expirado, age:', age);
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

  console.warn('[auth] Firma inválida');
  return res.status(401).json({ error: 'invalid_signature' });
};