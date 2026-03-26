<?php
defined('MOODLE_INTERNAL') || die();

$functions = [

    'block_tutorai_get_context' => [
        'classname'     => 'block_tutorai\external\get_context',
        'methodname'    => 'execute',
        'description'   => 'Returns current user and course context for the AI agent',
        'type'          => 'read',
        'ajax'          => true,
        'loginrequired' => true,
        'capabilities'  => 'block/tutorai:interact',
    ],

    'block_tutorai_send_message' => [
        'classname'     => 'block_tutorai\external\send_message',
        'methodname'    => 'execute',
        'description'   => 'Proxies a chat message to the backend AI service',
        'type'          => 'read',
        'ajax'          => true,
        'loginrequired' => true,
        'capabilities'  => 'block/tutorai:interact',
    ],

];

// Servicio con todas las funciones de Moodle que el backend necesita consultar
$services = [
    'TutorAI Service' => [
        'functions' => [
            // Funciones propias del plugin
            'block_tutorai_get_context',
            'block_tutorai_send_message',
            // Tareas
            'mod_assign_get_assignments',
            'mod_assign_get_submission_status',
            // Calificaciones
            'gradereport_user_get_grade_items',
            'core_grades_get_gradable_users',
            // Calendario
            'core_calendar_get_calendar_events',
            // Cuestionarios
            'mod_quiz_get_quizzes_by_courses',
            'mod_quiz_get_user_attempts',
            'mod_quiz_get_attempt_review',
            // Progreso del curso
            'core_completion_get_course_completion_status',
            'core_completion_get_activities_completion_status',
            // Info general
            'core_course_get_contents',
            'core_enrol_get_enrolled_users',
        ],
        'restrictedusers' => 0,
        'enabled'         => 1,
        'shortname'       => 'tutorai',
    ],
];