const moodle = require('../moodleApi');

const definition = {
  name: 'get_calendar_events',
  description: 'Obtiene los próximos eventos del curso: fechas de entrega, exámenes, actividades programadas. Úsala cuando el estudiante pregunte qué tiene próximamente, cuándo es el siguiente examen, o quiera planificar su semana.',
  parameters: {
    type: 'object',
    properties: {
      days_ahead: {
        type: 'number',
        description: 'Cuántos días hacia adelante buscar. Por defecto 30.',
      },
    },
    required: [],
  },
};

async function execute({ context, params }) {
  const { course } = context;
  const now      = Math.floor(Date.now() / 1000);
  const daysAhead = params?.days_ahead || 30;
  const until    = now + (daysAhead * 86400);

  const data = await moodle.call('core_calendar_get_calendar_events', {
    events: {
      courseids: [course.id],
    },
    options: {
      timestart: now,
      timeend:   until,
      ignorehidden: 1,
    },
  });

  const events = data.events || [];
  if (events.length === 0) {
    return `No hay eventos programados en los próximos ${daysAhead} días para "${course.fullname}".`;
  }

  const sorted = events
    .sort((a, b) => a.timestart - b.timestart)
    .slice(0, 10)
    .map(e => {
      const date = new Date(e.timestart * 1000).toLocaleDateString('es-CO', {
        weekday: 'short', day: 'numeric', month: 'short',
      });
      const type = {
        'assign':   'Entrega',
        'quiz':     'Cuestionario',
        'user':     'Personal',
        'course':   'Curso',
        'group':    'Grupo',
        'grouping': 'Agrupamiento',
      }[e.modulename] || e.eventtype || 'Evento';
      return `• ${date} — ${type}: ${e.name}`;
    });

  return `Próximos eventos en "${course.fullname}":\n${sorted.join('\n')}`;
}

module.exports = { definition, execute };