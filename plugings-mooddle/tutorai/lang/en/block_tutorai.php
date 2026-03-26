<?php
defined('MOODLE_INTERNAL') || die();

$string['pluginname']            = 'TutorAI';
$string['tutorai:addinstance']   = 'Add a TutorAI block';
$string['tutorai:myaddinstance']  = 'Add a TutorAI block to My Moodle';
$string['tutorai:interact']      = 'Interact with TutorAI agent';

// UI strings
$string['chat_placeholder']      = 'Ask me anything about this course...';
$string['chat_send']             = 'Send';
$string['chat_title']            = 'TutorAI Assistant';
$string['chat_open']             = 'Open assistant';
$string['chat_close']            = 'Close';
$string['chat_error']            = 'Something went wrong. Please try again.';
$string['chat_welcome']          = 'Hi {$a}! I\'m your course assistant. How can I help you today?';

// Settings
$string['settings_backend_url']         = 'Backend URL';
$string['settings_backend_url_desc']    = 'URL of the Node.js backend server (e.g. https://ai.yourdomain.com)';
$string['settings_api_secret']          = 'Shared API secret';
$string['settings_api_secret_desc']     = 'Secret key shared between Moodle and the backend to authenticate requests';
$string['settings_max_history']         = 'Max conversation history';
$string['settings_max_history_desc']    = 'Number of previous messages sent to the AI for context (default: 10)';
$string['settings_enabled']             = 'Enable TutorAI';
$string['settings_enabled_desc']        = 'Globally enable or disable the TutorAI agent';
