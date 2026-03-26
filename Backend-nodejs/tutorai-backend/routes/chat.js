const express         = require('express');
const router          = express.Router();
const rateLimit       = require('express-rate-limit');

const verifySignature = require('../middleware/verifySignature');
const { buildSystemPrompt } = require('../services/promptBuilder');
const { chat: openaiChat }  = require('../services/openai');
const db              = require('../services/database');

// Rate limit específico para el chat: 20 mensajes/min por IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'rate_limit_exceeded', success: false },
});

/**
 * POST /api/chat
 *
 * Body (viene firmado desde el plugin PHP de Moodle):
 * {
 *   message:   string,         — mensaje del estudiante
 *   history:   [{role, content}],
 *   context:   { user, course, role, progress, finalgrade, activities },
 *   timestamp: number
 * }
 */
router.post('/chat', chatLimiter, verifySignature, async (req, res) => {
  const { message, context, timestamp } = req.body;

  // ── Validaciones básicas ─────────────────────────────────────────
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'empty_message' });
  }

  if (!context?.user?.id || !context?.course?.id) {
    return res.status(400).json({ success: false, error: 'missing_context' });
  }

  // Rechazar mensajes con timestamp muy antiguo (>5 min) — anti-replay
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return res.status(401).json({ success: false, error: 'expired_request' });
  }

  const userId   = context.user.id;
  const courseId = context.course.id;
  const maxHistory = parseInt(process.env.MAX_HISTORY || '20');

  try {
    // ── Obtener historial de SQLite (fuente de verdad del backend) ───
    const history = db.getHistory(userId, courseId, maxHistory);

    // ── Construir system prompt con contexto de Moodle ───────────────
    const systemPrompt = buildSystemPrompt(context);

    // ── Llamar a OpenAI ──────────────────────────────────────────────
    const { reply, tokensUsed, model } = await openaiChat(systemPrompt, history, message.trim());

    // ── Persistir el turno en SQLite ─────────────────────────────────
    db.saveMessage(userId, courseId, 'user',      message.trim());
    db.saveMessage(userId, courseId, 'assistant', reply);
    db.logUsage(userId, courseId, tokensUsed, model);

    return res.json({ success: true, reply });

  } catch (err) {
    console.error('[chat] Error procesando mensaje:', err.message);

    // Distinguir errores de OpenAI para no exponer detalles internos
    if (err.message?.includes('API key')) {
      return res.status(500).json({ success: false, error: 'ai_misconfigured' });
    }
    if (err.status === 429) {
      return res.status(429).json({ success: false, error: 'ai_rate_limit' });
    }

    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * DELETE /api/chat/history
 * Borra el historial de conversación de un usuario en un curso.
 */
router.delete('/chat/history', verifySignature, (req, res) => {
  const { context } = req.body;
  if (!context?.user?.id || !context?.course?.id) {
    return res.status(400).json({ success: false, error: 'missing_context' });
  }
  db.clearHistory(context.user.id, context.course.id);
  return res.json({ success: true });
});

/**
 * GET /api/health
 * Para que Hostinger pueda verificar que el servicio está vivo.
 */
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = router;
