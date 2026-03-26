<?php
namespace block_tutorai\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_multiple_structure;
use core_external\external_value;

defined('MOODLE_INTERNAL') || die();

/**
 * Web Service: get_context
 *
 * Devuelve toda la información contextual del usuario y curso
 * que necesita el agente IA para personalizar sus respuestas.
 *
 * Moodle 4.5 — usa core_external (no external_api legacy)
 */
class get_context extends external_api {

    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'courseid' => new external_value(PARAM_INT, 'Course ID'),
        ]);
    }

    public static function execute(int $courseid): array {
        global $USER, $DB, $CFG;

        // Cargar librerías de calificaciones (no se cargan automáticamente)
        require_once($CFG->libdir . '/gradelib.php');
        require_once($CFG->libdir . '/grade/grade_item.php');
        require_once($CFG->libdir . '/grade/grade_grade.php');

        // Validar parámetros
        $params = self::validate_parameters(
            self::execute_parameters(),
            ['courseid' => $courseid]
        );

        // Validar contexto y capacidad
        $context = \context_course::instance($params['courseid']);
        self::validate_context($context);
        require_capability('block/tutorai:interact', $context);

        // ── Datos del usuario ──────────────────────────────────────────
        $user = [
            'id'        => (int) $USER->id,
            'firstname' => clean_param($USER->firstname, PARAM_TEXT),
            'lastname'  => clean_param($USER->lastname, PARAM_TEXT),
            'email'     => clean_param($USER->email, PARAM_EMAIL),
            'lang'      => clean_param($USER->lang, PARAM_SAFEDIR),
        ];

        // ── Datos del curso ────────────────────────────────────────────
        $course = get_course($params['courseid']);
        $coursedata = [
            'id'        => (int) $course->id,
            'fullname'  => clean_param($course->fullname, PARAM_TEXT),
            'shortname' => clean_param($course->shortname, PARAM_TEXT),
            'summary'   => clean_param(strip_tags($course->summary), PARAM_TEXT),
            'startdate' => (int) $course->startdate,
            'enddate'   => (int) $course->enddate,
        ];

        // ── Rol del usuario en el curso ────────────────────────────────
        $roles = get_user_roles($context, $USER->id, true);
        $rolenames = array_map(fn($r) => $r->shortname, $roles);
        $primaryrole = !empty($rolenames) ? reset($rolenames) : 'student';

        // ── Progreso del curso ─────────────────────────────────────────
        $completion = new \completion_info($course);
        $progress   = 0;

        if ($completion->is_enabled()) {
            $activities  = $completion->get_activities();
            $total       = count($activities);
            $completed   = 0;

            foreach ($activities as $activity) {
                $data = $completion->get_data($activity, false, $USER->id);
                if ($data->completionstate == COMPLETION_COMPLETE ||
                    $data->completionstate == COMPLETION_COMPLETE_PASS) {
                    $completed++;
                }
            }

            $progress = $total > 0 ? round(($completed / $total) * 100) : 0;
        }

        // ── Actividades del curso (para contexto del agente) ───────────
        $modinfo    = get_fast_modinfo($course, $USER->id);
        $activities = [];

        foreach ($modinfo->get_cms() as $cm) {
            if (!$cm->uservisible || $cm->deletioninprogress) {
                continue;
            }

            // Estado de completitud por actividad
            $completionstate = 'none';
            if ($completion->is_enabled($cm)) {
                $data = $completion->get_data($cm, false, $USER->id);
                $completionstate = match((int)$data->completionstate) {
                    COMPLETION_COMPLETE      => 'complete',
                    COMPLETION_COMPLETE_PASS => 'complete',
                    COMPLETION_INCOMPLETE    => 'incomplete',
                    default                  => 'none',
                };
            }

            $activities[] = [
                'id'              => (int) $cm->id,
                'name'            => clean_param($cm->name, PARAM_TEXT),
                'modname'         => clean_param($cm->modname, PARAM_TEXT),
                'completionstate' => $completionstate,
                'sectionnum'      => (int) $cm->sectionnum,
            ];
        }

        // ── Calificación general del curso ─────────────────────────────
        $gradeitem = \grade_item::fetch_course_item($params['courseid']);
        $finalgrade = null;

        if ($gradeitem) {
            $grade = \grade_grade::fetch([
                'itemid' => $gradeitem->id,
                'userid' => $USER->id,
            ]);
            if ($grade && $grade->finalgrade !== null) {
                $finalgrade = round((float) $grade->finalgrade, 2);
            }
        }

        return [
            'user'        => $user,
            'course'      => $coursedata,
            'role'        => $primaryrole,
            'progress'    => $progress,
            'finalgrade'  => ($finalgrade !== null) ? (float) $finalgrade : -1.0,
            'activities'  => $activities,
            'generatedts' => time(),
        ];
    }

    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'user' => new external_single_structure([
                'id'        => new external_value(PARAM_INT,   'User ID'),
                'firstname' => new external_value(PARAM_TEXT,  'First name'),
                'lastname'  => new external_value(PARAM_TEXT,  'Last name'),
                'email'     => new external_value(PARAM_EMAIL, 'Email'),
                'lang'      => new external_value(PARAM_TEXT,  'Language code'),
            ]),
            'course' => new external_single_structure([
                'id'        => new external_value(PARAM_INT,  'Course ID'),
                'fullname'  => new external_value(PARAM_TEXT, 'Course full name'),
                'shortname' => new external_value(PARAM_TEXT, 'Course short name'),
                'summary'   => new external_value(PARAM_TEXT, 'Course summary'),
                'startdate' => new external_value(PARAM_INT,  'Start date timestamp'),
                'enddate'   => new external_value(PARAM_INT,  'End date timestamp'),
            ]),
            'role'       => new external_value(PARAM_TEXT,  'Primary role shortname'),
            'progress'   => new external_value(PARAM_INT,   'Course completion percentage 0-100'),
            'finalgrade' => new external_value(PARAM_FLOAT, 'Final grade (-1.0 = not graded)'),
            'activities' => new external_multiple_structure(
                new external_single_structure([
                    'id'              => new external_value(PARAM_INT,  'Module ID'),
                    'name'            => new external_value(PARAM_TEXT, 'Activity name'),
                    'modname'         => new external_value(PARAM_TEXT, 'Module type (assign, quiz, page...)'),
                    'completionstate' => new external_value(PARAM_TEXT, 'none | incomplete | complete'),
                    'sectionnum'      => new external_value(PARAM_INT,  'Section number'),
                ])
            ),
            'generatedts' => new external_value(PARAM_INT, 'Timestamp when context was generated'),
        ]);
    }
}