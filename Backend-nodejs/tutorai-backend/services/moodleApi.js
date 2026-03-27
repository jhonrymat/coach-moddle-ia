const https = require('https');
const http  = require('http');
const db    = require('./database');

/**
 * Cliente para la API REST de Moodle.
 * El token y URL se leen desde la DB (panel admin) o variables de entorno.
 */
function getMoodleConfig() {
  const url   = db.getConfig('moodle_url')   || process.env.MOODLE_URL   || '';
  const token = db.getConfig('moodle_token') || process.env.MOODLE_TOKEN || '';
  if (!url || !token) throw new Error('Moodle URL o token no configurados');
  // Limpiar URL — quitar trailing slash, asegurar que no tenga /webservice al final
  const base = url.replace(/\/+$/, '').replace(/\/webservice.*$/, '');
  return { base, token };
}

/**
 * Llama a una función de la API REST de Moodle.
 * @param {string} wsfunction  — nombre de la función ej. mod_assign_get_assignments
 * @param {object} params      — parámetros adicionales
 * @returns {Promise<object>}  — respuesta JSON de Moodle
 */
async function call(wsfunction, params = {}) {
  const { base, token } = getMoodleConfig();

  // Construir query string — Moodle REST usa GET o POST con form-encoding
  const query = new URLSearchParams({
    wstoken:           token,
    wsfunction:        wsfunction,
    moodlewsrestformat: 'json',
    ...flattenParams(params),
  }).toString();

  const endpoint = `${base}/webservice/rest/server.php?${query}`;
  const isHttps  = endpoint.startsWith('https');
  const lib      = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.get(endpoint, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Moodle devuelve {exception, errorcode} en caso de error
          if (parsed.exception) {
            reject(new Error(`Moodle API error: ${parsed.message || parsed.errorcode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error('Respuesta inválida de Moodle: ' + data.substring(0, 100)));
        }
      });
    });
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Moodle API timeout')); });
    req.on('error', reject);
  });
}

/**
 * Moodle espera arrays como: courseids[0]=1&courseids[1]=2
 * Esta función aplana objetos/arrays anidados a ese formato.
 */
function flattenParams(obj, prefix = '') {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(result, flattenParams(item, `${fullKey}[${i}]`));
        } else {
          result[`${fullKey}[${i}]`] = item;
        }
      });
    } else if (typeof val === 'object' && val !== null) {
      Object.assign(result, flattenParams(val, fullKey));
    } else {
      result[fullKey] = val;
    }
  }
  return result;
}

module.exports = { call };