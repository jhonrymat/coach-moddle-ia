const OpenAI = require('openai');

let client;

function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no configurada');
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * Llama a GPT-4o con el system prompt personalizado e historial.
 *
 * @param {string}   systemPrompt  - Prompt construido por promptBuilder
 * @param {Array}    history       - [{role, content}] historial previo
 * @param {string}   userMessage   - Mensaje actual del estudiante
 * @returns {{ reply: string, tokensUsed: number, model: string }}
 */
async function chat(systemPrompt, history, userMessage) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await getClient().chat.completions.create({
    model,
    messages,
    max_tokens:  1024,
    temperature: 0.7,
  });

  const choice    = response.choices[0];
  const reply     = choice?.message?.content?.trim() || '';
  const tokensUsed = response.usage?.total_tokens || 0;

  if (!reply) throw new Error('Respuesta vacía de OpenAI');

  return { reply, tokensUsed, model };
}

module.exports = { chat };
