const db = require('./database');

function buildSystemPrompt(context) {
  const { user, course, role, progress, finalgrade, activities } = context;

  // Base del prompt — editable desde el panel admin
  const basePrompt = db.getConfig('system_prompt') || 'Eres Coach Angela, asesora educativa.';

  const completed  = activities.filter(a => a.completionstate === 'complete');
  const incomplete = activities.filter(a => a.completionstate === 'incomplete');

  const roleLabel = { student:'estudiante', teacher:'docente',
    editingteacher:'docente con edición', manager:'administrador' }[role] || role;

  const today = new Date().toLocaleDateString('es-CO', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });

  const gradeText = (finalgrade && finalgrade > 0)
    ? `Calificación actual: ${finalgrade}/10` : 'Sin calificación registrada aún';

  const actLines = [];
  if (completed.length)
    actLines.push('Completadas: ' + completed.slice(0,5).map(a=>a.name).join(', '));
  if (incomplete.length)
    actLines.push('Pendientes: ' + incomplete.slice(0,5).map(a=>a.name).join(', '));

  return `${basePrompt}

FECHA: ${today}
ESTUDIANTE: ${user.firstname} ${user.lastname} (${roleLabel})
CURSO: ${course.fullname} (${course.shortname})
PROGRESO: ${progress}% completado | ${gradeText}
ACTIVIDADES: ${actLines.join(' | ') || 'Sin actividades con seguimiento'}`;
}

module.exports = { buildSystemPrompt };