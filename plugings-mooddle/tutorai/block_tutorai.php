<?php
// Clase principal del bloque — Moodle 4.5
defined('MOODLE_INTERNAL') || die();

class block_tutorai extends block_base {

    public function init(): void {
        $this->title = get_string('pluginname', 'block_tutorai');
    }

    // El bloque solo aplica a nivel de curso
    public function applicable_formats(): array {
        return [
            'course-view' => true,
            'site'        => false,
            'my'          => false,
        ];
    }

    // Una sola instancia por curso es suficiente
    public function instance_allow_multiple(): bool {
        return false;
    }

    // El bloque no tiene configuración por instancia (solo global)
    public function has_config(): bool {
        return true;
    }

    public function get_content(): stdClass|null {
        global $USER, $COURSE, $PAGE;

        if ($this->content !== null) {
            return $this->content;
        }

        $this->content = new stdClass();
        $this->content->text   = '';
        $this->content->footer = '';

        // Verificar que el plugin está habilitado globalmente
        if (!get_config('block_tutorai', 'enabled')) {
            return $this->content;
        }

        // Verificar capacidad del usuario en este contexto
        $context = context_course::instance($COURSE->id);
        if (!has_capability('block/tutorai:interact', $context)) {
            return $this->content;
        }

        // Preparar datos para el JS
        $jsdata = [
            'userid'    => (int) $USER->id,
            'courseid'  => (int) $COURSE->id,
            'firstname' => clean_param($USER->firstname, PARAM_TEXT),
            'sesskey'   => sesskey(),
            'wwwroot'   => $CFG->wwwroot ?? '',
        ];

        // Pasar datos al módulo AMD
        $PAGE->requires->js_call_amd('block_tutorai/chat', 'init', [$jsdata]);

        // El bloque no muestra HTML propio — el widget JS se inserta en el body
        $this->content->text = '<div id="block-tutorai-anchor" data-block="tutorai"></div>';

        return $this->content;
    }
}
