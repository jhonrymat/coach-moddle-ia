const db = require('../database');
const assignments = require('./assignments');
const grades      = require('./grades');
const calendar    = require('./calendar');
const quizzes     = require('./quizzes');
const progress    = require('./progress');

// Registro de todas las herramientas disponibles
const ALL_TOOLS = {
  get_assignments:     assignments,
  get_grades:          grades,
  get_calendar_events: calendar,
  get_quizzes:         quizzes,
  get_course_progress: progress,
};

/**
 * Devuelve las definiciones de herramientas activas para pasarlas a OpenAI.
 * El admin puede desactivar herramientas desde el panel.
 */
function getActiveTools() {
  const disabled = getDisabledTools();
  return Object.values(ALL_TOOLS)
    .filter(t => !disabled.includes(t.definition.name))
    .map(t => ({
      type: 'function',
      function: t.definition,
    }));
}

/**
 * Ejecuta una herramienta por nombre con el contexto del usuario.
 * @param {string} toolName   — nombre de la herramienta
 * @param {object} toolParams — parámetros que GPT pasó a la herramienta
 * @param {object} context    — contexto del usuario/curso de Moodle
 */
async function executeTool(toolName, toolParams, context) {
  const tool = ALL_TOOLS[toolName];
  if (!tool) throw new Error(`Herramienta desconocida: ${toolName}`);

  const disabled = getDisabledTools();
  if (disabled.includes(toolName)) throw new Error(`Herramienta desactivada: ${toolName}`);

  console.log(`[tools] Ejecutando: ${toolName}`, JSON.stringify(toolParams));

  try {
    const result = await tool.execute({ context, params: toolParams });
    return String(result);
  } catch (err) {
    console.error(`[tools] Error en ${toolName}:`, err.message);
    return `No pude obtener la información de "${toolName}": ${err.message}`;
  }
}

function getDisabledTools() {
  try {
    const val = db.getConfig('disabled_tools');
    return val ? JSON.parse(val) : [];
  } catch { return []; }
}

function setToolEnabled(toolName, enabled) {
  const disabled = getDisabledTools();
  const updated  = enabled
    ? disabled.filter(t => t !== toolName)
    : [...new Set([...disabled, toolName])];
  db.setConfig('disabled_tools', JSON.stringify(updated));
}

function getAllToolNames() {
  return Object.keys(ALL_TOOLS);
}

module.exports = { getActiveTools, executeTool, setToolEnabled, getAllToolNames, getDisabledTools };