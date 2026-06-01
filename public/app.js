// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// ── DOM refs ─────────────────────────────────────────────────────────
const messagesEl = document.getElementById('messages');
const welcomeEl = document.getElementById('welcome');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const systemPromptEl = document.getElementById('systemPrompt');
const sidebarEl = document.getElementById('sidebar');
const sessionListEl = document.getElementById('sessionList');
const newChatBtn = document.getElementById('newChatBtn');
const sidebarCloseBtn = document.getElementById('sidebarClose');
const hamburgerBtn = document.getElementById('hamburger');
const sidebarError = document.getElementById('sidebarError');
const sidebarRetry = document.getElementById('sidebarRetry');

const STORAGE_KEY = 'chatbot.lastSessionId';

// ── State ────────────────────────────────────────────────────────────
let currentSessionId = null;
let isSending = false;
let sessions = [];

// ── Configure marked (code block renderer) ──────────────────────────
if (typeof marked !== 'undefined') {
  marked.use({
    renderer: {
      code(token) {
        const safeText = (token && token.text ? token.text : '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const safeLang = (token && token.lang ? token.lang : '').replace(/[^a-zA-Z0-9_-]/g, '');
        return '<div class="code-block">' +
          '<span class="lang-label">' + safeLang + '</span>' +
          '<pre><code class="hljs language-' + safeLang + '">' + safeText + '</code></pre>' +
          '<button type="button" class="copy-btn">Copy</button>' +
          '</div>';
      },
    },
  });
}

// ── DOMPurify allowlist for Markdown output ─────────────────────────
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'code', 'pre', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'a', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'details', 'summary',
];
const ALLOWED_ATTR = ['class', 'id', 'href', 'title', 'alt', 'src', 'open'];

function escapeHtml(s) {
  return String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

function renderMarkdown(text) {
  try {
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
      return escapeHtml(text);
    }
    const raw = marked.parse(text || '');
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    });
  } catch (err) {
    console.error('Markdown render failed:', err);
    return escapeHtml(text);
  }
}

function initHighlight() {
  if (typeof hljs !== 'undefined') {
    try { hljs.highlightAll(); } catch (_) { /* ignore */ }
  }
}

// ── Sidebar (mobile) ────────────────────────────────────────────────
function openSidebar() { sidebarEl.classList.add('open'); }
function closeSidebar() { sidebarEl.classList.remove('open'); }

hamburgerBtn.addEventListener('click', openSidebar);
sidebarCloseBtn.addEventListener('click', closeSidebar);
sidebarEl.addEventListener('click', (e) => {
  // Close drawer when tapping outside the inner content
  if (e.target === sidebarEl) closeSidebar();
});

// ── Settings toggle ──────────────────────────────────────────────────
settingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('open'));

// ── Auto-resize textareas ─────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
userInput.addEventListener('input', () => autoResize(userInput));
systemPromptEl.addEventListener('input', () => autoResize(systemPromptEl));

// ── Sessions: list, switch, create, delete ───────────────────────────
async function loadSessions() {
  try {
    const res = await fetch('/api/sessions');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    sessions = await res.json();
    sidebarError.classList.add('hidden');
    renderSessionList();
  } catch (err) {
    console.error('Failed to load sessions:', err);
    sidebarError.classList.remove('hidden');
    sessionListEl.innerHTML = '';
  }
}

function renderSessionList() {
  sessionListEl.innerHTML = '';
  if (sessions.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-list';
    li.textContent = 'No conversations yet.';
    sessionListEl.appendChild(li);
    return;
  }
  for (const s of sessions) {
    const li = document.createElement('li');
    li.className = 'session-item' + (s.id === currentSessionId ? ' active' : '');
    li.dataset.id = s.id;
    li.setAttribute('role', 'listitem');

    const titleBtn = document.createElement('button');
    titleBtn.type = 'button';
    titleBtn.className = 'session-title';
    titleBtn.textContent = s.title || 'Untitled';
    titleBtn.addEventListener('click', () => switchSession(s.id));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'session-delete';
    delBtn.setAttribute('aria-label', 'Delete ' + (s.title || 'session'));
    delBtn.textContent = '\u00D7';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteSession(s.id); });

    li.appendChild(titleBtn);
    li.appendChild(delBtn);
    sessionListEl.appendChild(li);
  }
}

async function createNewSession() {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_prompt: systemPromptEl.value.trim() || 'You are a helpful assistant.',
      }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const session = await res.json();
    await loadSessions();
    await switchSession(session.id);
    closeSidebar();
  } catch (err) {
    console.error('Failed to create session:', err);
  }
}

async function switchSession(id) {
  try {
    const res = await fetch('/api/sessions/' + encodeURIComponent(id));
    if (res.status === 404) {
      // Session no longer exists (deleted in another tab, or after crash recovery)
      currentSessionId = null;
      localStorage.removeItem(STORAGE_KEY);
      messagesEl.innerHTML = '';
      messagesEl.style.display = 'none';
      welcomeEl.classList.remove('hidden');
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const session = await res.json();
    currentSessionId = id;
    localStorage.setItem(STORAGE_KEY, id);

    messagesEl.innerHTML = '';
    if (!Array.isArray(session.messages) || session.messages.length === 0) {
      welcomeEl.classList.remove('hidden');
      messagesEl.style.display = 'none';
    } else {
      welcomeEl.classList.add('hidden');
      messagesEl.style.display = 'flex';
      for (const m of session.messages) {
        addBubble(m.content, m.role);
      }
    }
    renderSessionList();
    closeSidebar();
  } catch (err) {
    console.error('Failed to switch session:', err);
  }
}

async function deleteSession(id) {
  if (!confirm('Delete this chat?')) return;
  try {
    await fetch('/api/sessions/' + encodeURIComponent(id), { method: 'DELETE' });
    if (currentSessionId === id) {
      currentSessionId = null;
      localStorage.removeItem(STORAGE_KEY);
      messagesEl.innerHTML = '';
      messagesEl.style.display = 'none';
      welcomeEl.classList.remove('hidden');
    }
    await loadSessions();
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
}

newChatBtn.addEventListener('click', createNewSession);
sidebarRetry.addEventListener('click', loadSessions);

// ── Keyboard ─────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSidebar();
    settingsPanel.classList.remove('open');
  }
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

// ── Copy button (event delegation so CSP does not block inline JS) ──
document.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest && e.target.closest('.copy-btn');
  if (!btn) return;
  const code = btn.parentElement && btn.parentElement.querySelector('code');
  if (!code) return;
  const text = code.textContent;
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) { /* ignore */ }
    document.body.removeChild(ta);
  };
  const p = (navigator.clipboard && navigator.clipboard.writeText(text)) || Promise.reject();
  p.catch(fallback).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
});

// ── Bubble rendering ─────────────────────────────────────────────────
function showMessagesArea() {
  if (welcomeEl && !welcomeEl.classList.contains('hidden')) {
    welcomeEl.classList.add('hidden');
    messagesEl.style.display = 'flex';
  }
}

function addBubble(text, role) {
  showMessagesArea();
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  if (role === 'bot') {
    div.innerHTML = renderMarkdown(text);
  } else {
    div.textContent = text;
  }
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  initHighlight();
  return div;
}

function addTypingIndicator() {
  showMessagesArea();
  const div = document.createElement('div');
  div.className = 'msg bot typing';
  div.innerHTML = '<span></span><span></span><span></span>';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isSending) return;

  isSending = true;
  sendBtn.disabled = true;

  addBubble(text, 'user');
  userInput.value = '';
  autoResize(userInput);

  const typingEl = addTypingIndicator();

  try {
    const body = {
      message: text,
      system_prompt: systemPromptEl.value.trim() || 'You are a helpful assistant.',
    };
    if (currentSessionId) body.session_id = currentSessionId;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    typingEl.remove();

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      addBubble('⚠️ ' + (err.error || 'Something went wrong.'), 'error');
      if (res.status === 400 && err.error === 'Session not found') {
        currentSessionId = null;
        localStorage.removeItem(STORAGE_KEY);
        await loadSessions();
      }
    } else {
      const data = await res.json();
      if (!data || typeof data.reply !== 'string') {
        addBubble('⚠️ Invalid response from server', 'error');
      } else {
        addBubble(data.reply, 'bot');
        if (currentSessionId) {
          // Refresh sidebar to reflect new title and updated_at
          await loadSessions();
        }
      }
    }
  } catch (err) {
    typingEl.remove();
    addBubble('⚠️ Network error — is the server running?', 'error');
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// ── Init ─────────────────────────────────────────────────────────────
(async function init() {
  await loadSessions();
  const lastId = localStorage.getItem(STORAGE_KEY);
  if (lastId && sessions.find(s => s.id === lastId)) {
    await switchSession(lastId);
  }
})();
