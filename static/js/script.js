'use strict';

// Cabeçalho: borda ao rolar (listener passivo, sem trabalho pesado por frame)
(function header() {
    const el = document.querySelector('.site-header');
    if (!el) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            el.classList.toggle('scrolled', window.scrollY > 8);
            ticking = false;
        });
    }, { passive: true });
})();

// Chatbot
(function chat() {
    const widget = document.getElementById('chatbotWidget');
    const panel = document.getElementById('chatbotContainer');
    const toggle = document.getElementById('chatbotToggle');
    const closeBtn = document.getElementById('chatbotClose');
    const messages = document.getElementById('cbMessages');
    const form = document.getElementById('cbForm');
    const input = document.getElementById('cbInput');
    const send = document.getElementById('cbSend');
    const suggestions = document.getElementById('cbSuggestions');
    if (!widget || !panel || !form) return;

    let waitingForDish = false;
    let busy = false;

    function setOpen(open) {
        widget.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', String(!open));
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Fechar atendimento' : 'Abrir atendimento');
        if (open) setTimeout(() => input.focus({ preventScroll: true }), 180);
    }

    toggle.addEventListener('click', () => setOpen(!widget.classList.contains('open')));
    closeBtn.addEventListener('click', () => setOpen(false));
    document.querySelectorAll('[data-open-chat]').forEach((b) => b.addEventListener('click', () => setOpen(true)));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && widget.classList.contains('open')) setOpen(false);
    });

    function escapeHtml(text) {
        return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function format(text) {
        return escapeHtml(text.trim())
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    function scrollDown() {
        messages.scrollTop = messages.scrollHeight;
    }

    function addMessage(text, from, intents) {
        const msg = document.createElement('div');
        msg.className = `msg ${from}`;
        msg.innerHTML = `<div class="bubble">${format(text)}</div>`;
        if (intents && intents.length) {
            const tags = intents.map(([name, p]) => `<b>${escapeHtml(name)}</b>${Math.round(p)}%`).join(' ');
            msg.insertAdjacentHTML('beforeend', `<div class="intent">${tags}</div>`);
        }
        messages.appendChild(msg);
        scrollDown();
        return msg;
    }

    function showTyping() {
        const el = document.createElement('div');
        el.className = 'msg bot typing';
        el.setAttribute('aria-label', 'Digitando');
        el.innerHTML = '<div class="bubble"><i></i><i></i><i></i></div>';
        messages.appendChild(el);
        scrollDown();
        return el;
    }

    async function sendMessage(text) {
        if (!text || busy) return;
        busy = true;
        send.disabled = true;
        addMessage(text, 'user');
        input.value = '';
        const typing = showTyping();

        const payload = { message: text };
        if (waitingForDish) payload.selecao_prato = text;

        try {
            const resp = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await resp.json();
            typing.remove();
            if (!resp.ok) throw new Error(data.error || 'erro');
            const names = data.all_intents && data.all_intents.length ? data.all_intents : [data.intent];
            const probs = data.all_probabilities && data.all_probabilities.length ? data.all_probabilities : [data.probability];
            addMessage(data.response, 'bot', names.map((n, i) => [n, probs[i] ?? 0]));
            waitingForDish = Boolean(data.needs_prato_selection);
        } catch (err) {
            typing.remove();
            addMessage('Gomen nasai! Não consegui responder agora. Tente de novo em instantes.', 'bot');
            waitingForDish = false;
        } finally {
            busy = false;
            send.disabled = false;
            input.focus({ preventScroll: true });
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage(input.value.trim());
    });

    suggestions.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) sendMessage(btn.textContent.trim());
    });
})();
