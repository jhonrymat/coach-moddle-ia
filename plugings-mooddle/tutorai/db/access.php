<?php
defined('MOODLE_INTERNAL') || die();

$capabilities = [

    // Permite agregar el bloque a un curso
    'block/tutorai:addinstance' => [
        'riskbitmask'  => RISK_SPAM,
        'captype'      => 'write',
        'contextlevel' => CONTEXT_BLOCK,
        'archetypes'   => [
            'editingteacher' => CAP_ALLOW,
            'manager'        => CAP_ALLOW,
        ],
    ],

    // Permite agregar el bloque en Mi Moodle (dashboard)
    'block/tutorai:myaddinstance' => [
        'captype'      => 'write',
        'contextlevel' => CONTEXT_SYSTEM,
        'archetypes'   => [
            'user' => CAP_ALLOW,
        ],
    ],

    // Permite interactuar con el agente (enviar mensajes)
    'block/tutorai:interact' => [
        'riskbitmask'  => RISK_PERSONAL,
        'captype'      => 'read',
        'contextlevel' => CONTEXT_COURSE,
        'archetypes'   => [
            'student'        => CAP_ALLOW,
            'teacher'        => CAP_ALLOW,
            'editingteacher' => CAP_ALLOW,
            'manager'        => CAP_ALLOW,
        ],
    ],

];
