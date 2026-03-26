<?php
defined('MOODLE_INTERNAL') || die();

if ($ADMIN->fulltree) {

    // Habilitar / deshabilitar el plugin globalmente
    $settings->add(new admin_setting_configcheckbox(
        'block_tutorai/enabled',
        get_string('settings_enabled', 'block_tutorai'),
        get_string('settings_enabled_desc', 'block_tutorai'),
        1   // habilitado por defecto
    ));

    // URL del backend Node.js
    $settings->add(new admin_setting_configtext(
        'block_tutorai/backend_url',
        get_string('settings_backend_url', 'block_tutorai'),
        get_string('settings_backend_url_desc', 'block_tutorai'),
        '',
        PARAM_URL
    ));

    // Secret compartido entre Moodle y el backend
    $settings->add(new admin_setting_configpasswordunmask(
        'block_tutorai/api_secret',
        get_string('settings_api_secret', 'block_tutorai'),
        get_string('settings_api_secret_desc', 'block_tutorai'),
        ''
    ));

    // Cantidad de mensajes de historial enviados al AI
    $settings->add(new admin_setting_configtext(
        'block_tutorai/max_history',
        get_string('settings_max_history', 'block_tutorai'),
        get_string('settings_max_history_desc', 'block_tutorai'),
        10,
        PARAM_INT
    ));
}
