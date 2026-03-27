const moodle = require('../moodleApi');

const definition = {
  name: 'get_assignments',
  description: 'Obtiene las tareas del curso actual del estudiante: nombre, fecha de entrega, estado (entregada, pendiente, vencida) y calificación si ya fue evaluada. Úsala cuando el estudiante pregunte por tareas, fechas de entrega, qué le falta entregar, o si ya fue calificado.',
  parameters: {
    type: 'object',
    properties: {
      include_submitted: {
        type: 'boolean',
        description: 'Si incluir tareas ya entregadas. Por defecto true.',
      },
    },
    required: [],
  },
};

async function execute({ context, params }) {
  const { user, course } = context;
  const now = Math.floor(Date.now() / 1000);

  const data = await moodle.call('mod_assign_get_assignments', {
    courseids: [course.id],
  });

  if (!data.courses || data.courses.length === 0) {
    return 'No se encontraron tareas en este curso.';
  }

  const assignments = data.courses[0].assignments || [];
  if (assignments.length === 0) return 'Este curso no tiene tareas configuradas.';

  // Para cada tarea, obtener el estado de entrega del estudiante
  const results = await Promise.allSettled(
    assignments.map(a => moodle.call('mod_assign_get_submission_status', {
      assignid: a.id,
      userid:   user.id,
    }))
  );

  const list = assignments.map((a, i) => {
    const subData  = results[i].status === 'fulfilled' ? results[i].value : null;
    const sub      = subData?.lastattempt?.submission;
    const grade    = subData?.lastattempt?.gradingstatus;
    const duedate  = a.duedate;
    const dueTxt   = duedate > 0
      ? new Date(duedate * 1000).toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
      : 'Sin fecha límite';

    let status = 'pendiente';
    if (sub?.status === 'submitted') status = 'entregada';
    else if (duedate > 0 && duedate < now) status = 'VENCIDA';

    const gradeTxt = grade === 'graded' ? 'calificada' : grade === 'notgraded' ? 'sin calificar' : '';

    return `• ${a.name} — vence: ${dueTxt} | estado: ${status}${gradeTxt ? ' | ' + gradeTxt : ''}`;
  });

  const includeSubmitted = params?.include_submitted !== false;
  const filtered = includeSubmitted ? list : list.filter((_, i) => {
    const sub = results[i].status === 'fulfilled'
      ? results[i].value?.lastattempt?.submission
      : null;
    return sub?.status !== 'submitted';
  });

  return filtered.length > 0
    ? `Tareas del curso "${course.fullname}":\n${filtered.join('\n')}`
    : 'Todas las tareas han sido entregadas.';
}

module.exports = { definition, execute };