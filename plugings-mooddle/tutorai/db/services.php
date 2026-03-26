<?php
defined('MOODLE_INTERNAL') || die();

// Funciones expuestas como Web Service (llamadas desde JS o backend externo)
$functions = [

    'block_tutorai_get_context' => [
        'classname'     => 'block_tutorai\external\get_context',
        'methodname'    => 'execute',
        'description'   => 'Returns current user and course context for the AI agent',
        'type'          => 'read',
        'ajax'          => true,       // Disponible via AJAX desde el frontend JS
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

// Servicio pre-configurado (opcional — facilita tokens de acceso externo)
$services = [
    'TutorAI Service' => [
        'functions'       => ['block_tutorai_get_context', 'block_tutorai_send_message'],
        'restrictedusers' => 0,
        'enabled'         => 1,
        'shortname'       => 'tutorai',
    ],
];
