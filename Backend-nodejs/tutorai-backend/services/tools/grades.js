const moodle = require('../moodleApi');

const definition = {
  name: 'get_grades',
  description: 'Obtiene las calificaciones detalladas del estudiante en el curso actual, por actividad. Úsala cuando el estudiante pregunte cómo va su nota, qué calificación tiene en una actividad específica, o cuál es su promedio.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

async function execute({ context }) {
  const { user, course } = context;

  const data = await moodle.call('gradereport_user_get_grade_items', {
    courseid: course.id,
    userid:   user.id,
  });

  const items = data.usergrades?.[0]?.gradeitems || [];
  if (items.length === 0) return 'No hay calificaciones registradas aún en este curso.';

  const lines = items
    .filter(item => item.gradetype !== 0) // excluir categorías sin nota
    .map(item => {
      const grade    = item.gradeformatted && item.gradeformatted !== '-'
        ? item.gradeformatted : 'sin calificar';
      const max      = item.grademax ? ` / ${parseFloat(item.grademax).toFixed(1)}` : '';
      const feedback = item.feedback ? ` (${item.feedback.substring(0, 60)})` : '';
      const icon     = item.itemtype === 'course' ? '📊' : '•';
      return `${icon} ${item.itemname || 'Calificación del curso'}: ${grade}${max}${feedback}`;
    });

  return `Calificaciones en "${course.fullname}":\n${lines.join('\n')}`;
}

module.exports = { definition, execute };