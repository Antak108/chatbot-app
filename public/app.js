// ── DOM refs ─────────────────────────────────────────────────────────
const messagesEl = document.getElementById('messages');
const welcomeEl = document.getElementById('welcome');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const systemPromptEl = document.getElementById('systemPrompt');

// ── Settings toggle ──────────────────────────────────────────────────
settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
});

// ── Auto-resize textarea ─────────────────────────────────────────────
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
});

// ── Send on Enter (Shift+Enter for newline) ──────────────────────────
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

// ── Helpers ──────────────────────────────────────────────────────────
function addBubble(text, role) {
    // Hide welcome, show messages area on first message
    if (welcomeEl && !welcomeEl.classList.contains('hidden')) {
        welcomeEl.classList.add('hidden');
        messagesEl.style.display = 'flex';
    }

    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
}

function addTypingIndicator() {
    if (welcomeEl && !welcomeEl.classList.contains('hidden')) {
        welcomeEl.classList.add('hidden');
        messagesEl.style.display = 'flex';
    }

    const div = document.createElement('div');
    div.className = 'msg bot typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
}

// ── Core send logic ──────────────────────────────────────────────────
let isSending = false;

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || isSending) return;

    isSending = true;
    sendBtn.disabled = true;

    addBubble(text, 'user');
    userInput.value = '';
    userInput.style.height = 'auto';

    const typingEl = addTypingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                system_prompt: systemPromptEl.value.trim() || 'You are a helpful assistant.',
            }),
        });

        typingEl.remove();

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }));
            addBubble(`⚠️ ${err.error || 'Something went wrong.'}`, 'error');
        } else {
            const data = await res.json();
            addBubble(data.reply, 'bot');
        }
    } catch (err) {
        typingEl.remove();
        addBubble(`⚠️ Network error — is the server running?`, 'error');
    } finally {
        isSending = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}
