const OpenAI = require('openai');
const db     = require('./database');

let client;

function getClient() {
  // La API key puede venir de la DB (panel admin) o del .env
  const apiKey = db.getConfig('openai_api_key') || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');
  // Recrear cliente si la key cambió
  if (!client || client._apiKey !== apiKey) {
    client = new OpenAI({ apiKey });
    client._apiKey = apiKey;
  }
  return client;
}

async function chat(systemPrompt, history, userMessage) {
  const model       = db.getConfig('openai_model')  || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const maxTokens   = parseInt(db.getConfig('max_tokens')  || '1024');
  const temperature = parseFloat(db.getConfig('temperature') || '0.7');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await getClient().chat.completions.create({
    model, messages, max_tokens: maxTokens, temperature,
  });

  const reply      = response.choices[0]?.message?.content?.trim() || '';
  const tokensUsed = response.usage?.total_tokens || 0;

  if (!reply) throw new Error('Respuesta vacía de OpenAI');
  return { reply, tokensUsed, model };
}

module.exports = { chat };