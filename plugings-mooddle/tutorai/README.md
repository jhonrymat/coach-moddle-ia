# TutorAI — Plugin de bloque para Moodle 4.5

Agente de IA conversacional integrado en Moodle como bloque. Aparece como una burbuja flotante en cada curso y personaliza sus respuestas con el contexto real del estudiante: curso activo, progreso, actividades completadas y calificación.

---

## Requisitos

- Moodle 4.5.x (build 2024100700 o superior)
- PHP 8.1+
- Backend Node.js corriendo (Fase 2 del proyecto)
- Clave API de OpenAI configurada en el backend

---

## Instalación

### 1. Copiar el plugin

```bash
cp -r block_tutorai /var/www/html/moodle/blocks/
# O usando FTP: subir la carpeta a /moodle/blocks/
```

### 2. Ejecutar actualización de base de datos

Ir a **Administración del sitio → Notificaciones** y seguir el proceso de instalación. Moodle detecta el nuevo plugin automáticamente.

### 3. Compilar el JavaScript AMD

Desde el servidor, en el directorio raíz de Moodle:

```bash
# Con grunt (recomendado)
npm install
npx grunt amd --plugin=block_tutorai

# O en desarrollo: modo purge + regeneración automática
php admin/cli/purge_caches.php
```

> En producción, el archivo compilado debe quedar en:
> `blocks/tutorai/amd/build/chat.min.js`

### 4. Configurar el plugin

Ir a **Administración del sitio → Plugins → Bloques → TutorAI**:

| Campo | Descripción |
|---|---|
| Habilitar TutorAI | Activa/desactiva globalmente |
| Backend URL | URL del servidor Node.js, ej: `https://ai.tudominio.com` |
| Shared API secret | Clave secreta compartida con el backend (mín. 32 chars) |
| Max conversation history | Mensajes de historial enviados al AI (default: 10) |

### 5. Agregar el bloque a un curso

1. Ir a cualquier curso
2. Activar edición
3. Agregar bloque → seleccionar **TutorAI**
4. El widget aparece como burbuja en la esquina inferior derecha

---

## Estructura de archivos

```
block_tutorai/
├── version.php                      # Versión e identidad del plugin
├── block_tutorai.php                # Clase principal del bloque
├── settings.php                     # Configuración en panel de admin
├── lang/
│   └── en/
│       └── block_tutorai.php        # Cadenas de texto (inglés)
├── db/
│   ├── access.php                   # Capacidades y permisos
│   └── services.php                 # Registro de Web Services
├── classes/
│   └── external/
│       ├── get_context.php          # WS: devuelve contexto usuario+curso
│       └── send_message.php         # WS: proxy al backend Node.js
└── amd/
    └── src/
        └── chat.js                  # Widget de burbuja de chat (AMD)
```

---

## Web Services disponibles

### `block_tutorai_get_context`

Devuelve el contexto completo del usuario en el curso actual.

**Parámetros:**
- `courseid` (int): ID del curso

**Respuesta:**
```json
{
  "user": { "id": 42, "firstname": "María", "lastname": "González", "lang": "es" },
  "course": { "id": 5, "fullname": "Introducción a Python", "shortname": "PY101" },
  "role": "student",
  "progress": 62,
  "finalgrade": 8.5,
  "activities": [
    { "id": 12, "name": "Quiz 1", "modname": "quiz", "completionstate": "complete", "sectionnum": 1 },
    { "id": 13, "name": "Tarea 2", "modname": "assign", "completionstate": "incomplete", "sectionnum": 2 }
  ],
  "generatedts": 1748000000
}
```

### `block_tutorai_send_message`

Envía un mensaje al agente IA via el backend Node.js.

**Parámetros:**
- `courseid` (int): ID del curso
- `message` (string): Mensaje del usuario (máx 2000 chars)
- `history` (string): JSON del historial de conversación

**Respuesta:**
```json
{
  "success": true,
  "reply": "Hola María! Veo que llevas un 62% del curso..."
}
```

---

## Seguridad

- Todas las llamadas requieren sesión Moodle válida (`sesskey`)
- El backend valida cada petición con firma HMAC-SHA256
- El secret nunca viaja al frontend
- Los datos de usuario se limpian con `clean_param()` antes de enviarse

---

## Desarrollo

Para agregar nuevos servicios de Moodle en el futuro (Fase 4), solo es necesario:

1. Agregar el endpoint a `db/services.php`
2. Crear la clase en `classes/external/`
3. Llamar desde el backend Node.js al servicio correspondiente

El `Service Layer` del backend está diseñado para recibir módulos adicionales sin tocar el core del chat.
