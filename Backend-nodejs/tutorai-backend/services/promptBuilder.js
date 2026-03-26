/**
 * Construye el system prompt personalizado para el agente TutorAI.
 *
 * Recibe el objeto `context` que viene del plugin PHP de Moodle
 * (output de block_tutorai_get_context) y genera un prompt que
 * le dice al modelo exactamente quién es el estudiante, en qué
 * curso está y cuánto ha avanzado.
 */
function buildSystemPrompt(context) {
  const { user, course, role, progress, finalgrade, activities } = context;

  // ── Resumen de actividades ─────────────────────────────────────────
  const completed   = activities.filter(a => a.completionstate === 'complete');
  const incomplete  = activities.filter(a => a.completionstate === 'incomplete');
  const pending     = activities.filter(a => a.completionstate === 'none');

  const activitySummary = buildActivitySummary(completed, incomplete, pending);

  // ── Nota final ────────────────────────────────────────────────────
  const gradeText = (finalgrade && finalgrade > 0)
    ? `Calificación actual: ${finalgrade}/10`
    : 'Sin calificación registrada aún';

  // ── Rol en español ─────────────────────────────────────────────────
  const roleLabel = {
    student:        'estudiante',
    teacher:        'docente',
    editingteacher: 'docente con edición',
    manager:        'administrador',
  }[role] || role;

  // ── Fecha legible ──────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return `Eres TutorAI, asistente educativo inteligente del Campus Virtual de la institución.
Tu rol es ayudar a los estudiantes de forma personalizada, amable y precisa.

FECHA HOY: ${today}

INFORMACIÓN DEL USUARIO
- Nombre: ${user.firstname} ${user.lastname}
- Rol en el curso: ${roleLabel}
- Idioma preferido: ${user.lang || 'es'}

CURSO ACTUAL
- Nombre: ${course.fullname} (${course.shortname})
${course.summary ? `- Descripción: ${course.summary.substring(0, 200)}` : ''}

PROGRESO DEL ESTUDIANTE
- Avance general: ${progress}%
- ${gradeText}
- Actividades completadas: ${completed.length}
- Actividades pendientes: ${incomplete.length + pending.length}

DETALLE DE ACTIVIDADES
${activitySummary}

INSTRUCCIONES DE COMPORTAMIENTO
1. Responde SIEMPRE en el idioma del estudiante (${user.lang === 'en' ? 'inglés' : 'español'}).
2. Usa el nombre "${user.firstname}" cuando sea natural en la conversación.
3. Cuando el estudiante tenga actividades pendientes, puedes mencionarlas con tacto como motivación.
4. Si no sabes algo específico del contenido del curso, sé honesto y dilo — no inventes.
5. Mantén un tono académico pero cercano, como un tutor personal.
6. Si el estudiante pregunta por calificaciones o fechas, basa tu respuesta en los datos que tienes arriba.
7. Respuestas concisas: máximo 3-4 párrafos salvo que el estudiante pida más detalle.
8. NO menciones que eres una IA de OpenAI — eres TutorAI del Campus Virtual.`;
}

function buildActivitySummary(completed, incomplete, pending) {
  const lines = [];

  if (completed.length > 0) {
    lines.push('Completadas:');
    completed.slice(0, 5).forEach(a => {
      lines.push(`  ✓ ${a.name} (${translateModname(a.modname)})`);
    });
    if (completed.length > 5) lines.push(`  ... y ${completed.length - 5} más`);
  }

  if (incomplete.length > 0) {
    lines.push('En progreso / pendientes:');
    incomplete.slice(0, 5).forEach(a => {
      lines.push(`  → ${a.name} (${translateModname(a.modname)})`);
    });
  }

  if (pending.length > 0 && incomplete.length === 0) {
    lines.push('Sin iniciar:');
    pending.slice(0, 3).forEach(a => {
      lines.push(`  ○ ${a.name} (${translateModname(a.modname)})`);
    });
  }

  return lines.length > 0 ? lines.join('\n') : 'No hay actividades con seguimiento habilitado.';
}

function translateModname(modname) {
  const map = {
    assign:   'tarea',
    quiz:     'cuestionario',
    forum:    'foro',
    page:     'página',
    resource: 'archivo',
    url:      'enlace',
    label:    'etiqueta',
    scorm:    'SCORM',
    h5pactivity: 'actividad H5P',
    workshop: 'taller',
    lesson:   'lección',
    choice:   'consulta',
    survey:   'encuesta',
    glossary: 'glosario',
    wiki:     'wiki',
    chat:     'chat',
    data:     'base de datos',
    feedback: 'retroalimentación',
    book:     'libro',
    folder:   'carpeta',
  };
  return map[modname] || modname;
}

module.exports = { buildSystemPrompt };
