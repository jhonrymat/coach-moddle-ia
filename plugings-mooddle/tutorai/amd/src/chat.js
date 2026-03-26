// Coach Angela — AMD chat module para Moodle 4.5
define(['core/ajax'], function(Ajax) {
    'use strict';

    let config   = {};
    let history  = [];
    let isOpen   = false;
    let isTyping = false;

    // ── Markdown ligero ────────────────────────────────────────────────
    function renderMarkdown(text) {
        return text
            // Escapar HTML primero
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            // Bloques de código ```...```
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // Código inline `...`
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Negritas **texto**
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // Cursiva *texto*
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Listas con - o •
            .replace(/^[\-\•] (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            // Saltos de línea
            .replace(/\n{2,}/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^(.+)$/, '<p>$1</p>');
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Historial en localStorage (por usuario+curso) ──────────────────
    function storageKey() {
        return 'coach_angela_' + config.userid + '_' + config.courseid;
    }

    function saveHistory() {
        try {
            localStorage.setItem(storageKey(), JSON.stringify(history.slice(-40)));
        } catch(e) {}
    }

    function loadHistory() {
        try {
            const saved = localStorage.getItem(storageKey());
            return saved ? JSON.parse(saved) : [];
        } catch(e) { return []; }
    }

    function clearHistory() {
        history = [];
        try { localStorage.removeItem(storageKey()); } catch(e) {}
        const container = document.getElementById('angela-messages');
        if (!container) return;
        container.innerHTML = '';
        appendMessage('assistant', '¡Hola, <strong>' + escapeHtml(config.firstname) +
            '</strong>! Soy Coach Angela, tu asesora personal de este curso. ¿En qué puedo ayudarte hoy?', true);
    }

    // ── Mensajes ───────────────────────────────────────────────────────
    function appendMessage(role, content, isHtml) {
        const container = document.getElementById('angela-messages');
        if (!container) return;

        const wrap   = document.createElement('div');
        wrap.className = 'angela-msg angela-msg--' + role;

        const bubble = document.createElement('div');
        bubble.className = 'angela-msg__bubble';

        if (role === 'assistant') {
            bubble.innerHTML = isHtml ? content : renderMarkdown(content);
        } else {
            bubble.textContent = content;
        }

        wrap.appendChild(bubble);
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
    }

    function renderSavedHistory() {
        history.forEach(function(msg) {
            appendMessage(msg.role, msg.content);
        });
    }

    function showTyping() {
        const container = document.getElementById('angela-messages');
        if (!container) return;
        const wrap = document.createElement('div');
        wrap.id = 'angela-typing';
        wrap.className = 'angela-msg angela-msg--assistant angela-msg--typing';
        wrap.innerHTML = '<div class="angela-msg__bubble"><span class="angela-dot"></span><span class="angela-dot"></span><span class="angela-dot"></span></div>';
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
    }

    function hideTyping() {
        const el = document.getElementById('angela-typing');
        if (el) el.remove();
    }

    function setLoading(loading) {
        isTyping = loading;
        const btn   = document.getElementById('angela-send');
        const input = document.getElementById('angela-input');
        if (btn)   btn.disabled   = loading || !(input && input.value.trim());
        if (input) input.disabled = loading;
    }

    // ── Enviar mensaje ─────────────────────────────────────────────────
    function sendMessage() {
        const input = document.getElementById('angela-input');
        const text  = input && input.value.trim();
        if (!text || isTyping) return;

        input.value = '';
        input.style.height = 'auto';

        history.push({role: 'user', content: text});
        saveHistory();
        appendMessage('user', text);
        showTyping();
        setLoading(true);

        Ajax.call([{
            methodname: 'block_tutorai_send_message',
            args: {
                courseid: config.courseid,
                message:  text,
                history:  JSON.stringify(history.slice(-20)),
            },
        }])[0]
        .then(function(response) {
            hideTyping();
            setLoading(false);
            if (response.success && response.reply) {
                history.push({role: 'assistant', content: response.reply});
                saveHistory();
                appendMessage('assistant', response.reply);
            } else {
                appendMessage('assistant', 'Lo siento, hubo un problema al conectarme. Por favor intenta de nuevo.', true);
            }
        })
        .catch(function() {
            hideTyping();
            setLoading(false);
            appendMessage('assistant', 'Ocurrió un error inesperado. Por favor intenta de nuevo más tarde.', true);
        });
    }

    // ── Abrir / cerrar ─────────────────────────────────────────────────
    function togglePanel() {
        isOpen = !isOpen;
        const panel  = document.getElementById('angela-panel');
        const bubble = document.getElementById('angela-bubble');
        if (!panel || !bubble) return;

        if (isOpen) {
            panel.classList.add('angela--open');
            panel.setAttribute('aria-hidden', 'false');
            bubble.setAttribute('aria-label', 'Cerrar Coach Angela');
            const input = document.getElementById('angela-input');
            if (input) input.focus();
        } else {
            panel.classList.remove('angela--open');
            panel.setAttribute('aria-hidden', 'true');
            bubble.setAttribute('aria-label', 'Abrir Coach Angela');
        }
    }

    // ── HTML del widget ────────────────────────────────────────────────
    function buildWidget() {
        return '<div id="angela-bubble" role="button" tabindex="0" aria-label="Abrir Coach Angela" title="Coach Angela">' +
            '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.06L2 22l4.94-1.37C8.42 21.5 10.15 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="currentColor"/>' +
            '<circle cx="8.5" cy="12" r="1.5" fill="white"/><circle cx="12" cy="12" r="1.5" fill="white"/><circle cx="15.5" cy="12" r="1.5" fill="white"/>' +
            '</svg></div>' +

            '<div id="angela-panel" role="dialog" aria-label="Coach Angela" aria-hidden="true">' +
            '<div id="angela-header">' +
            '<div id="angela-header-info">' +
            '<div id="angela-avatar">A</div>' +
            '<div><div id="angela-title">Coach Angela</div><div id="angela-subtitle">Asesora del curso</div></div>' +
            '</div>' +
            '<div id="angela-header-actions">' +
            '<button id="angela-clear" title="Borrar conversación" aria-label="Borrar conversación">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
            '</button>' +
            '<button id="angela-close" aria-label="Cerrar" title="Cerrar">&times;</button>' +
            '</div></div>' +

            '<div id="angela-messages" role="log" aria-live="polite"></div>' +

            '<div id="angela-input-area">' +
            '<textarea id="angela-input" placeholder="Escribe tu pregunta..." rows="1" maxlength="2000" aria-label="Tu mensaje"></textarea>' +
            '<button id="angela-send" aria-label="Enviar" disabled>' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button></div>' +

            '<div id="angela-footer">Presiona Enter para enviar · Shift+Enter para nueva línea</div>' +
            '</div>';
    }

    // ── CSS ────────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('angela-styles')) return;
        const s = document.createElement('style');
        s.id = 'angela-styles';
        s.textContent = [
            '#angela-bubble{position:fixed;bottom:24px;right:24px;width:54px;height:54px;border-radius:50%;background:#1D9E75;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:9998;box-shadow:0 4px 20px rgba(0,0,0,.2);transition:transform .2s,background .2s;border:none;outline:none}',
            '#angela-bubble:hover,#angela-bubble:focus{transform:scale(1.08);background:#0F6E56}',

            '#angela-panel{position:fixed;bottom:90px;right:24px;width:370px;max-width:calc(100vw - 48px);height:540px;max-height:calc(100vh - 120px);background:#fff;border-radius:18px;box-shadow:0 8px 40px rgba(0,0,0,.15);display:flex;flex-direction:column;z-index:9997;overflow:hidden;opacity:0;transform:translateY(14px) scale(.97);pointer-events:none;transition:opacity .22s,transform .22s;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
            '#angela-panel.angela--open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}',

            '#angela-header{background:linear-gradient(135deg,#1D9E75 0%,#0F6E56 100%);color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}',
            '#angela-header-info{display:flex;align-items:center;gap:10px}',
            '#angela-avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0}',
            '#angela-title{font-weight:600;font-size:15px}',
            '#angela-subtitle{font-size:11px;opacity:.8;margin-top:1px}',
            '#angela-header-actions{display:flex;align-items:center;gap:4px}',
            '#angela-clear,#angela-close{background:none;border:none;color:rgba(255,255,255,.75);cursor:pointer;padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:color .15s,background .15s}',
            '#angela-close{font-size:20px;line-height:1;width:28px;height:28px}',
            '#angela-clear:hover,#angela-close:hover{color:#fff;background:rgba(255,255,255,.15)}',

            '#angela-messages{flex:1;overflow-y:auto;padding:14px 13px;display:flex;flex-direction:column;gap:10px;background:#f6f6f4;scroll-behavior:smooth}',

            '.angela-msg{display:flex;max-width:100%}',
            '.angela-msg--user{justify-content:flex-end}',
            '.angela-msg--assistant{justify-content:flex-start}',
            '.angela-msg__bubble{max-width:84%;padding:10px 13px;border-radius:16px;font-size:13.5px;line-height:1.6;word-break:break-word}',
            '.angela-msg--user .angela-msg__bubble{background:#1D9E75;color:#fff;border-bottom-right-radius:3px}',
            '.angela-msg--assistant .angela-msg__bubble{background:#fff;color:#1a1a18;border:1px solid #e8e7e1;border-bottom-left-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.05)}',

            // Markdown styles dentro del bubble
            '.angela-msg__bubble p{margin:0 0 6px}.angela-msg__bubble p:last-child{margin:0}',
            '.angela-msg__bubble ul{margin:4px 0;padding-left:18px}.angela-msg__bubble li{margin:2px 0}',
            '.angela-msg__bubble code{background:rgba(0,0,0,.07);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:12.5px}',
            '.angela-msg--user .angela-msg__bubble code{background:rgba(255,255,255,.2)}',
            '.angela-msg__bubble pre{background:#1a1a18;color:#e8e6df;padding:10px 12px;border-radius:8px;overflow-x:auto;margin:6px 0}.angela-msg__bubble pre code{background:none;padding:0;color:inherit;font-size:12px}',
            '.angela-msg__bubble strong{font-weight:600}.angela-msg__bubble em{font-style:italic}',

            // Typing
            '.angela-msg--typing .angela-msg__bubble{display:flex;gap:5px;align-items:center;padding:13px 16px}',
            '.angela-dot{width:7px;height:7px;border-radius:50%;background:#aaa;animation:angela-bounce 1.3s infinite ease-in-out}',
            '.angela-dot:nth-child(2){animation-delay:.2s}.angela-dot:nth-child(3){animation-delay:.4s}',
            '@keyframes angela-bounce{0%,80%,100%{transform:scale(.65);opacity:.45}40%{transform:scale(1);opacity:1}}',

            // Input area
            '#angela-input-area{display:flex;align-items:flex-end;gap:8px;padding:10px 12px;border-top:1px solid #e8e7e1;background:#fff;flex-shrink:0}',
            '#angela-input{flex:1;border:1.5px solid #d3d1c7;border-radius:12px;padding:9px 12px;font-size:13.5px;line-height:1.5;resize:none;outline:none;overflow-y:auto;font-family:inherit;transition:border-color .15s;min-height:38px;max-height:110px;box-sizing:border-box}',
            '#angela-input:focus{border-color:#1D9E75}',
            '#angela-send{width:38px;height:38px;border-radius:11px;background:#1D9E75;border:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}',
            '#angela-send:disabled{background:#c8c7bf;cursor:not-allowed}',
            '#angela-send:not(:disabled):hover{background:#0F6E56}',

            '#angela-footer{text-align:center;font-size:10.5px;color:#aaa;padding:5px 0 8px;background:#fff;flex-shrink:0}',

            '@media(max-width:420px){#angela-panel{right:8px;bottom:82px;width:calc(100vw - 16px)}#angela-bubble{right:16px;bottom:16px}}',

            '@media(prefers-color-scheme:dark){',
            '#angela-panel{background:#1e1e1b}',
            '#angela-messages{background:#161614}',
            '.angela-msg--assistant .angela-msg__bubble{background:#2a2a27;color:#e8e6df;border-color:#3a3a36}',
            '#angela-input-area,#angela-footer{background:#1e1e1b;border-color:#3a3a36}',
            '#angela-input{background:#2a2a27;color:#e8e6df;border-color:#3a3a36}',
            '.angela-msg__bubble code{background:rgba(255,255,255,.1)}',
            '}'
        ].join('');
        document.head.appendChild(s);
    }

    // ── Init ───────────────────────────────────────────────────────────
    return {
        init: function(data) {
            config = data;
            injectStyles();

            const wrapper = document.createElement('div');
            wrapper.id = 'angela-wrapper';
            wrapper.innerHTML = buildWidget();
            document.body.appendChild(wrapper);

            // Cargar historial guardado
            history = loadHistory();

            // Saludo inicial o historial previo
            if (history.length === 0) {
                appendMessage('assistant',
                    '¡Hola, <strong>' + escapeHtml(config.firstname) +
                    '</strong>! Soy Coach Angela, tu asesora personal de este curso. ¿En qué puedo ayudarte hoy?',
                    true);
            } else {
                renderSavedHistory();
            }

            // Scroll al final
            const msgs = document.getElementById('angela-messages');
            if (msgs) msgs.scrollTop = msgs.scrollHeight;

            // Eventos
            document.getElementById('angela-bubble')
                .addEventListener('click', togglePanel);
            document.getElementById('angela-bubble')
                .addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') togglePanel();
                });
            document.getElementById('angela-close')
                .addEventListener('click', togglePanel);
            document.getElementById('angela-send')
                .addEventListener('click', sendMessage);
            document.getElementById('angela-clear')
                .addEventListener('click', function() {
                    if (confirm('¿Borrar toda la conversación con Coach Angela?')) {
                        clearHistory();
                    }
                });

            // Input: Enter envía, Shift+Enter nueva línea, auto-resize
            document.getElementById('angela-input')
                .addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });
            document.getElementById('angela-input')
                .addEventListener('input', function() {
                    document.getElementById('angela-send').disabled =
                        !this.value.trim() || isTyping;
                    // Auto-resize: crecer con el contenido, máximo 110px
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 110) + 'px';
                });

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && isOpen) togglePanel();
            });
        }
    };
});