<?php
namespace block_tutorai\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_value;

defined('MOODLE_INTERNAL') || die();

/**
 * Web Service: send_message
 *
 * Actúa como proxy entre el frontend JS y el backend Node.js.
 * Moodle valida la sesión, agrega el contexto del curso y firma
 * la petición con el secret compartido antes de reenviarla.
 *
 * Flujo:
 *   Browser → [sesskey] → Moodle WS → [HMAC secret] → Node.js backend → OpenAI
 */
class send_message extends external_api {

    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'courseid' => new external_value(PARAM_INT,  'Course ID'),
            'message'  => new external_value(PARAM_TEXT, 'User message (max 2000 chars)'),
            'history'  => new external_value(PARAM_RAW,  'JSON-encoded conversation history', VALUE_DEFAULT, '[]'),
        ]);
    }

    public static function execute(int $courseid, string $message, string $history = '[]'): array {
        global $USER, $CFG;

        // Validar parámetros
        $params = self::validate_parameters(self::execute_parameters(), [
            'courseid' => $courseid,
            'message'  => $message,
            'history'  => $history,
        ]);

        // Validar contexto y capacidad
        $context = \context_course::instance($params['courseid']);
        self::validate_context($context);
        require_capability('block/tutorai:interact', $context);

        // Validar longitud del mensaje
        $message = trim($params['message']);
        if (empty($message)) {
            return ['success' => false, 'reply' => '', 'error' => 'empty_message'];
        }
        if (mb_strlen($message, 'UTF-8') > 2000) {
            return ['success' => false, 'reply' => '', 'error' => 'message_too_long'];
        }

        // Leer configuración
        $backendurl = get_config('block_tutorai', 'backend_url');
        $apisecret  = get_config('block_tutorai', 'api_secret');
        $maxhistory = (int) get_config('block_tutorai', 'max_history') ?: 10;

        if (empty($backendurl)) {
            return ['success' => false, 'reply' => '', 'error' => 'backend_not_configured'];
        }

        // Obtener contexto del usuario (reutilizamos get_context)
        $usercontext = get_context::execute($params['courseid']);

        // Limitar historial
        $historyarr = json_decode($params['history'], true) ?? [];
        $historyarr = array_slice($historyarr, -($maxhistory * 2)); // cada turno = 2 items

        // Construir payload para el backend
        $payload = [
            'message'    => $message,
            'history'    => $historyarr,
            'context'    => $usercontext,
            'timestamp'  => time(),
        ];

        $body = json_encode($payload);

        // Firmar solo el timestamp — evita problemas de reserialización JSON
        $timestamp = (string) $payload['timestamp'];
        $signature = hash_hmac('sha256', $timestamp, $apisecret);

        // Llamar al backend
        $curl = new \curl();
        $curl->setHeader([
            'Content-Type: application/json',
            'X-TutorAI-Signature: ' . $signature,
            'X-TutorAI-Moodle: ' . parse_url($CFG->wwwroot, PHP_URL_HOST),
        ]);
        $curl->setopt([
            'CURLOPT_TIMEOUT'        => 30,
            'CURLOPT_CONNECTTIMEOUT' => 5,
            'CURLOPT_SSL_VERIFYPEER' => true,
        ]);

        $endpoint = rtrim($backendurl, '/') . '/api/chat';
        $response = $curl->post($endpoint, $body);
        $httpcode = $curl->get_info()['http_code'] ?? 0;

        if ($curl->get_errno() || $httpcode !== 200) {
            return ['success' => false, 'reply' => '', 'error' => 'backend_error'];
        }

        $decoded = json_decode($response, true);
        if (!isset($decoded['reply'])) {
            return ['success' => false, 'reply' => '', 'error' => 'invalid_response'];
        }

        return [
            'success' => true,
            'reply'   => clean_param($decoded['reply'], PARAM_TEXT),
            'error'   => '',
        ];
    }

    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Whether the request succeeded'),
            'reply'   => new external_value(PARAM_TEXT, 'AI agent reply'),
            'error'   => new external_value(PARAM_TEXT, 'Error code if failed', VALUE_OPTIONAL),
        ]);
    }
}