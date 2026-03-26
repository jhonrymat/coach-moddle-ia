// TutorAI — AMD chat module for Moodle 4.5
// Loaded via $PAGE->requires->js_call_amd('block_tutorai/chat', 'init', [$data])

define(['core/ajax', 'core/str', 'core/notification'], function(Ajax, Str, Notification) {

    'use strict';

    let config = {};
    let history = [];      // [{role:'user'|'assistant', content:'...'}]
    let isOpen  = false;
    let isTyping = false;

    // ── Plantilla HTML del widget ──────────────────────────────────────
    function buildWidget(firstname) {
        return `
        <div id="tutorai-bubble" role="button" tabindex="0"
             aria-label="Open TutorAI assistant" title="TutorAI">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.06L2 22l4.94-1.37
                         C8.42 21.5 10.15 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
                      fill="currentColor"/>
                <circle cx="8.5"  cy="12" r="1.5" fill="white"/>
                <circle cx="12"   cy="12" r="1.5" fill="white"/>
                <circle cx="15.5" cy="12" r="1.5" fill="white"/>
            </svg>
        </div>

        <div id="tutorai-panel" role="dialog" aria-label="TutorAI Assistant"
             aria-hidden="true">
            <div id="tutorai-header">
                <span id="tutorai-title">TutorAI</span>
                <button id="tutorai-close" aria-label="Close" title="Close">&times;</button>
            </div>
            <div id="tutorai-messages" role="log" aria-live="polite" aria-label="Chat messages">
                <div class="tutorai-msg tutorai-msg--assistant">
                    <div class="tutorai-msg__bubble">
                        Hi <strong>${escapeHtml(firstname)}</strong>!
                        I'm your course assistant. How can I help you today?
                    </div>
                </div>
            </div>
            <div id="tutorai-input-area">
                <textarea id="tutorai-input"
                          placeholder="Ask me anything about this course..."
                          rows="1"
                          maxlength="2000"
                          aria-label="Your message"></textarea>
                <button id="tutorai-send" aria-label="Send message" disabled>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor"/>
                    </svg>
                </button>
            </div>
        </div>`;
    }

    // ── CSS del widget (inyectado en <head>) ───────────────────────────
    function injectStyles() {
        if (document.getElementById('tutorai-styles')) return;
        const style = document.createElement('style');
        style.id = 'tutorai-styles';
        style.textContent = `
        #tutorai-bubble {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: #1D9E75;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9998;
            box-shadow: 0 4px 16px rgba(0,0,0,.18);
            transition: transform .2s, background .2s;
            border: none;
            outline: none;
        }
        #tutorai-bubble:hover, #tutorai-bubble:focus {
            transform: scale(1.08);
            background: #0F6E56;
        }
        #tutorai-panel {
            position: fixed;
            bottom: 88px;
            right: 24px;
            width: 360px;
            max-width: calc(100vw - 48px);
            height: 520px;
            max-height: calc(100vh - 120px);
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,.16);
            display: flex;
            flex-direction: column;
            z-index: 9997;
            overflow: hidden;
            opacity: 0;
            transform: translateY(12px) scale(.97);
            pointer-events: none;
            transition: opacity .2s, transform .2s;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #tutorai-panel.tutorai--open {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
        }
        #tutorai-header {
            background: #1D9E75;
            color: #fff;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }
        #tutorai-title {
            font-weight: 600;
            font-size: 15px;
            letter-spacing: .3px;
        }
        #tutorai-close {
            background: none;
            border: none;
            color: rgba(255,255,255,.8);
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
            padding: 0 4px;
            border-radius: 4px;
            transition: color .15s;
        }
        #tutorai-close:hover { color: #fff; }
        #tutorai-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: #f7f7f5;
        }
        .tutorai-msg { display: flex; }
        .tutorai-msg--user     { justify-content: flex-end; }
        .tutorai-msg--assistant { justify-content: flex-start; }
        .tutorai-msg__bubble {
            max-width: 82%;
            padding: 10px 13px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.55;
            word-break: break-word;
        }
        .tutorai-msg--user .tutorai-msg__bubble {
            background: #1D9E75;
            color: #fff;
            border-bottom-right-radius: 4px;
        }
        .tutorai-msg--assistant .tutorai-msg__bubble {
            background: #fff;
            color: #1a1a18;
            border: 1px solid #e5e4de;
            border-bottom-left-radius: 4px;
        }
        .tutorai-msg--typing .tutorai-msg__bubble {
            display: flex;
            gap: 4px;
            align-items: center;
            padding: 12px 16px;
        }
        .tutorai-dot {
            width: 7px; height: 7px;
            border-radius: 50%;
            background: #aaa;
            animation: tutorai-bounce 1.2s infinite ease-in-out;
        }
        .tutorai-dot:nth-child(2) { animation-delay: .2s; }
        .tutorai-dot:nth-child(3) { animation-delay: .4s; }
        @keyframes tutorai-bounce {
            0%,80%,100% { transform: scale(.7); opacity:.5; }
            40%          { transform: scale(1);  opacity:1; }
        }
        #tutorai-input-area {
            display: flex;
            align-items: flex-end;
            gap: 8px;
            padding: 12px 14px;
            border-top: 1px solid #e5e4de;
            background: #fff;
            flex-shrink: 0;
        }
        #tutorai-input {
            flex: 1;
            border: 1px solid #d3d1c7;
            border-radius: 10px;
            padding: 9px 12px;
            font-size: 14px;
            line-height: 1.4;
            resize: none;
            outline: none;
            max-height: 120px;
            overflow-y: auto;
            font-family: inherit;
            transition: border-color .15s;
        }
        #tutorai-input:focus { border-color: #1D9E75; }
        #tutorai-send {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: #1D9E75;
            border: none;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background .15s, opacity .15s;
            flex-shrink: 0;
        }
        #tutorai-send:disabled { background: #c5c4bc; cursor: not-allowed; }
        #tutorai-send:not(:disabled):hover { background: #0F6E56; }

        @media (max-width: 420px) {
            #tutorai-panel { right: 8px; bottom: 80px; width: calc(100vw - 16px); }
            #tutorai-bubble { right: 16px; bottom: 16px; }
        }
        @media (prefers-color-scheme: dark) {
            #tutorai-panel { background: #1e1e1b; }
            #tutorai-messages { background: #161614; }
            .tutorai-msg--assistant .tutorai-msg__bubble {
                background: #2a2a27; color: #e8e6df; border-color: #3a3a36;
            }
            #tutorai-input-area { background: #1e1e1b; border-color: #3a3a36; }
            #tutorai-input {
                background: #2a2a27; color: #e8e6df; border-color: #3a3a36;
            }
        }`;
        document.head.appendChild(style);
    }

    // ── Helpers ────────────────────────────────────────────────────────
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function appendMessage(role, content) {
        const container = document.getElementById('tutorai-messages');
        const wrap = document.createElement('div');
        wrap.className = `tutorai-msg tutorai-msg--${role}`;

        const bubble = document.createElement('div');
        bubble.className = 'tutorai-msg__bubble';
        bubble.innerHTML = role === 'assistant'
            ? content  // AI puede devolver markdown básico en el futuro
            : escapeHtml(content);

        wrap.appendChild(bubble);
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
        return wrap;
    }

    function showTyping() {
        const container = document.getElementById('tutorai-messages');
        const wrap = document.createElement('div');
        wrap.id = 'tutorai-typing';
        wrap.className = 'tutorai-msg tutorai-msg--assistant tutorai-msg--typing';
        wrap.innerHTML = `<div class="tutorai-msg__bubble">
            <span class="tutorai-dot"></span>
            <span class="tutorai-dot"></span>
            <span class="tutorai-dot"></span>
        </div>`;
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
    }

    function hideTyping() {
        const el = document.getElementById('tutorai-typing');
        if (el) el.remove();
    }

    function setLoading(loading) {
        isTyping = loading;
        const btn   = document.getElementById('tutorai-send');
        const input = document.getElementById('tutorai-input');
        if (btn)   btn.disabled   = loading || !input?.value.trim();
        if (input) input.disabled = loading;
    }

    // ── Envío de mensaje ───────────────────────────────────────────────
    function sendMessage() {
        const input = document.getElementById('tutorai-input');
        const text  = input?.value.trim();

        if (!text || isTyping) return;

        input.value = '';
        input.style.height = 'auto';
        document.getElementById('tutorai-send').disabled = true;

        // Agregar al historial local y mostrar en UI
        history.push({role: 'user', content: text});
        appendMessage('user', text);
        showTyping();
        setLoading(true);

        // Llamar al Web Service de Moodle
        Ajax.call([{
            methodname: 'block_tutorai_send_message',
            args: {
                courseid: config.courseid,
                message:  text,
                history:  JSON.stringify(history.slice(-20)), // últimos 10 turnos
            },
        }])[0]
        .then(function(response) {
            hideTyping();
            setLoading(false);

            if (response.success) {
                history.push({role: 'assistant', content: response.reply});
                appendMessage('assistant', escapeHtml(response.reply));
            } else {
                appendMessage('assistant',
                    'Sorry, I had a problem connecting. Please try again.');
            }
        })
        .catch(function() {
            hideTyping();
            setLoading(false);
            appendMessage('assistant',
                'Sorry, an unexpected error occurred. Please try again later.');
        });
    }

    // ── Abrir / cerrar panel ───────────────────────────────────────────
    function togglePanel() {
        isOpen = !isOpen;
        const panel  = document.getElementById('tutorai-panel');
        const bubble = document.getElementById('tutorai-bubble');

        if (isOpen) {
            panel.classList.add('tutorai--open');
            panel.setAttribute('aria-hidden', 'false');
            bubble.setAttribute('aria-label', 'Close TutorAI assistant');
            document.getElementById('tutorai-input')?.focus();
        } else {
            panel.classList.remove('tutorai--open');
            panel.setAttribute('aria-hidden', 'true');
            bubble.setAttribute('aria-label', 'Open TutorAI assistant');
        }
    }

    // ── Init ───────────────────────────────────────────────────────────
    return {
        init: function(data) {
            config = data;

            injectStyles();

            // Montar widget en el body
            const wrapper = document.createElement('div');
            wrapper.id = 'tutorai-wrapper';
            wrapper.innerHTML = buildWidget(data.firstname || 'there');
            document.body.appendChild(wrapper);

            // Eventos de apertura/cierre
            document.getElementById('tutorai-bubble')
                .addEventListener('click', togglePanel);
            document.getElementById('tutorai-bubble')
                .addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') togglePanel();
                });
            document.getElementById('tutorai-close')
                .addEventListener('click', togglePanel);

            // Enviar con botón
            document.getElementById('tutorai-send')
                .addEventListener('click', sendMessage);

            // Enviar con Enter (Shift+Enter = nueva línea)
            document.getElementById('tutorai-input')
                .addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });

            // Habilitar botón solo si hay texto / auto-resize textarea
            document.getElementById('tutorai-input')
                .addEventListener('input', function() {
                    document.getElementById('tutorai-send').disabled =
                        !this.value.trim() || isTyping;
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
                });

            // Cerrar con Escape
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && isOpen) togglePanel();
            });
        }
    };
});
