const moodle = require('../moodleApi');

const definition = {
  name: 'get_course_progress',
  description: 'Obtiene el progreso detallado del estudiante en el curso, sección por sección y actividad por actividad: qué ha completado, qué está pendiente y qué recursos ha visitado. Úsala cuando el estudiante pregunte cómo va en el curso, qué le falta completar, o quiera saber en qué sección está.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

async function execute({ context }) {
  const { user, course } = context;

  const [contentsData, completionData] = await Promise.all([
    moodle.call('core_course_get_contents', { courseid: course.id }),
    moodle.call('core_completion_get_activities_completion_status', {
      courseid: course.id,
      userid:   user.id,
    }),
  ]);

  // Indexar estados de completitud por cmid
  const completionMap = {};
  (completionData.statuses || []).forEach(s => {
    completionMap[s.cmid] = s.state; // 0=incompleto, 1=completo, 2=completo con aprobado
  });

  const sections = contentsData || [];
  if (sections.length === 0) return 'No se pudo obtener el contenido del curso.';

  const lines = [];
  let totalActivities = 0;
  let completedCount  = 0;

  sections.forEach(section => {
    if (!section.modules || section.modules.length === 0) return;
    const sectionName = section.name || `Sección ${section.section}`;
    const moduleLines = [];

    section.modules.forEach(mod => {
      if (mod.modname === 'label') return; // labels no son actividades
      totalActivities++;
      const state = completionMap[mod.id];
      let icon = '○'; // sin seguimiento
      if (state === 1 || state === 2) { icon = '✓'; completedCount++; }
      else if (state === 0) icon = '○';
      moduleLines.push(`    ${icon} ${mod.name} (${mod.modname})`);
    });

    if (moduleLines.length > 0) {
      lines.push(`\n${sectionName}:`);
      lines.push(...moduleLines);
    }
  });

  const pct = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;
  const summary = `Progreso en "${course.fullname}": ${completedCount}/${totalActivities} actividades completadas (${pct}%)`;

  return summary + '\n' + lines.join('\n');
}

module.exports = { definition, execute };