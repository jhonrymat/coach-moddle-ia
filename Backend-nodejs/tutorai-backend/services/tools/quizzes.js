const moodle = require('../moodleApi');

const definition = {
  name: 'get_quizzes',
  description: 'Obtiene los cuestionarios del curso: cuáles están disponibles, intentos usados, mejor calificación obtenida y si aún están abiertos. Úsala cuando el estudiante pregunte por exámenes, cuestionarios, cuántos intentos le quedan, o cómo le fue en una evaluación.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

async function execute({ context }) {
  const { user, course } = context;
  const now = Math.floor(Date.now() / 1000);

  const data = await moodle.call('mod_quiz_get_quizzes_by_courses', {
    courseids: [course.id],
  });

  const quizzes = data.quizzes || [];
  if (quizzes.length === 0) return 'Este curso no tiene cuestionarios configurados.';

  // Obtener intentos del estudiante para cada quiz
  const attemptsData = await Promise.allSettled(
    quizzes.map(q => moodle.call('mod_quiz_get_user_attempts', {
      quizid:  q.id,
      userid:  user.id,
      status:  'all',
      includepreviews: 0,
    }))
  );

  const lines = quizzes.map((q, i) => {
    const attResult = attemptsData[i].status === 'fulfilled' ? attemptsData[i].value : null;
    const attempts  = attResult?.attempts || [];
    const maxAttempts = q.attempts || 0; // 0 = ilimitado
    const used      = attempts.length;
    const remaining = maxAttempts === 0 ? 'ilimitados' : `${maxAttempts - used} restantes`;

    // Mejor calificación
    const grades    = attempts
      .filter(a => a.state === 'finished' && a.sumgrades !== null)
      .map(a => parseFloat(a.sumgrades));
    const bestGrade = grades.length > 0
      ? Math.max(...grades).toFixed(2) + (q.grade ? ` / ${q.grade}` : '')
      : 'sin intentos finalizados';

    // Estado de apertura
    let status = 'disponible';
    if (q.timeopen  && q.timeopen  > now) status = `abre el ${new Date(q.timeopen*1000).toLocaleDateString('es-CO')}`;
    if (q.timeclose && q.timeclose < now) status = 'cerrado';

    return `• ${q.name} — ${status} | intentos: ${used} usados (${remaining}) | mejor nota: ${bestGrade}`;
  });

  return `Cuestionarios en "${course.fullname}":\n${lines.join('\n')}`;
}

module.exports = { definition, execute };