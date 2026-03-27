const express         = require('express');
const router          = express.Router();
const rateLimit       = require('express-rate-limit');
const verifySignature = require('../middleware/verifySignature');
const { buildSystemPrompt } = require('../services/promptBuilder');
const { chat: openaiChat }  = require('../services/openai');
const db = require('../services/database');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  message: { error: 'rate_limit_exceeded', success: false },
});

router.post('/chat', chatLimiter, verifySignature, async (req, res) => {
  const { message, context, timestamp } = req.body;

  if (!message || typeof message !== 'string' || !message.trim())
    return res.status(400).json({ success: false, error: 'empty_message' });

  if (!context?.user?.id || !context?.course?.id)
    return res.status(400).json({ success: false, error: 'missing_context' });

  if (Math.abs(Date.now() / 1000 - timestamp) > 300)
    return res.status(401).json({ success: false, error: 'expired_request' });

  const userId     = context.user.id;
  const courseId   = context.course.id;
  const userName   = (context.user.firstname + ' ' + context.user.lastname).trim();
  const courseName = context.course.fullname || '';
  const maxHistory = parseInt(process.env.MAX_HISTORY || '20');

  try {
    const history      = db.getHistory(userId, courseId, maxHistory);
    const systemPrompt = buildSystemPrompt(context);

    // Pasar contexto completo para que las tools puedan usarlo
    const { reply, tokensUsed, model } = await openaiChat(
      systemPrompt, history, message.trim(), context
    );

    db.saveMessage(userId, courseId, 'user',      message.trim(), userName, courseName);
    db.saveMessage(userId, courseId, 'assistant', reply,          userName, courseName);
    db.logUsage(userId, courseId, tokensUsed, model, userName, courseName);

    return res.json({ success: true, reply });
  } catch (err) {
    console.error('[chat] Error:', err.message);
    if (err.message?.includes('API key'))
      return res.status(500).json({ success: false, error: 'ai_misconfigured' });
    if (err.message?.includes('token no configurado') || err.message?.includes('URL'))
      return res.status(500).json({ success: false, error: 'moodle_not_configured' });
    if (err.status === 429)
      return res.status(429).json({ success: false, error: 'ai_rate_limit' });
    return res.status(500).json({ success: false, error: 'internal_error' });
  }
});

router.delete('/chat/history', verifySignature, (req, res) => {
  const { context } = req.body;
  if (!context?.user?.id || !context?.course?.id)
    return res.status(400).json({ success: false, error: 'missing_context' });
  db.clearHistory(context.user.id, context.course.id);
  return res.json({ success: true });
});

module.exports = router;