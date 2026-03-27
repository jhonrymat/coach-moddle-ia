const OpenAI  = require('openai');
const db      = require('./database');
const tools   = require('./tools/index');

let client;

function getClient() {
  const apiKey = db.getConfig('openai_api_key') || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');
  if (!client || client._apiKey !== apiKey) {
    client = new OpenAI({ apiKey });
    client._apiKey = apiKey;
  }
  return client;
}

/**
 * Chat con tool calling.
 * Ciclo: GPT responde → si pide tool → ejecutar → devolver resultado → GPT responde de nuevo.
 * Máximo 5 iteraciones para evitar loops infinitos.
 */
async function chat(systemPrompt, history, userMessage, context) {
  const model       = db.getConfig('openai_model')   || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const maxTokens   = parseInt(db.getConfig('max_tokens')   || '1024');
  const temperature = parseFloat(db.getConfig('temperature') || '0.7');
  const activeTools = tools.getActiveTools();

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];

  let tokensUsed = 0;
  const MAX_ITERATIONS = 5;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const requestParams = {
      model,
      messages,
      max_tokens:  maxTokens,
      temperature,
    };

    // Solo agregar tools si hay herramientas activas y el modelo las soporta
    if (activeTools.length > 0) {
      requestParams.tools      = activeTools;
      requestParams.tool_choice = 'auto';
    }

    const response = await getClient().chat.completions.create(requestParams);
    tokensUsed += response.usage?.total_tokens || 0;

    const msg = response.choices[0]?.message;
    if (!msg) throw new Error('Respuesta vacía de OpenAI');

    // Agregar respuesta del asistente al historial de mensajes
    messages.push(msg);

    // Si no hay tool calls — respuesta final
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const reply = msg.content?.trim() || '';
      if (!reply) throw new Error('Respuesta vacía de OpenAI');
      return { reply, tokensUsed, model };
    }

    // Ejecutar cada tool call en paralelo
    console.log(`[openai] GPT solicitó ${msg.tool_calls.length} herramienta(s)`);

    const toolResults = await Promise.all(
      msg.tool_calls.map(async (toolCall) => {
        const toolName   = toolCall.function.name;
        const toolParams = JSON.parse(toolCall.function.arguments || '{}');
        const result     = await tools.executeTool(toolName, toolParams, context);

        return {
          role:         'tool',
          tool_call_id: toolCall.id,
          content:      result,
        };
      })
    );

    // Agregar resultados al historial de mensajes y continuar el ciclo
    messages.push(...toolResults);
  }

  throw new Error('Se superó el máximo de iteraciones de tool calling');
}

module.exports = { chat };