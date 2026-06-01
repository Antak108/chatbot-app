// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// ── DOM refs ─────────────────────────────────────────────────────────
const messagesEl = document.getElementById('messages');
const welcomeEl = document.getElementById('welcome');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const charCounter = document.getElementById('charCounter');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const systemPromptEl = document.getElementById('systemPrompt');
const presetSelect = document.getElementById('presetSelect');
const modelSelect = document.getElementById('modelSelect');
const temperatureEl = document.getElementById('temperature');
const temperatureVal = document.getElementById('temperatureVal');
const topPEl = document.getElementById('topP');
const topPVal = document.getElementById('topPVal');
const topKEl = document.getElementById('topK');
const topKVal = document.getElementById('topKVal');
const maxTokensEl = document.getElementById('maxTokens');
const streamToggle = document.getElementById('streamToggle');
const sidebarEl = document.getElementById('sidebar');
const sessionListEl = document.getElementById('sessionList');
const newChatBtn = document.getElementById('newChatBtn');
const sidebarCloseBtn = document.getElementById('sidebarClose');
const hamburgerBtn = document.getElementById('hamburger');
const sidebarError = document.getElementById('sidebarError');
const sidebarRetry = document.getElementById('sidebarRetry');
const sidebarSearchWrap = document.getElementById('sidebarSearchWrap');
const sidebarSearch = document.getElementById('sidebarSearch');
const sidebarSearchBtn = document.getElementById('sidebarSearchBtn');
const exportBtn = document.getElementById('exportBtn');
const quickPrompts = document.getElementById('quickPrompts');

const STORAGE_KEY = 'chatbot.lastSessionId';
const SETTINGS_KEY = 'chatbot.settings';
const MAX_INPUT_LENGTH = 2000;

// ── System prompt presets ──────────────────────────────────────────
const PRESETS = [
  { name: 'Default (helpful assistant)', prompt: 'You are a helpful assistant.' },
  { name: 'Rhyming poet', prompt: 'You answer only in rhymes.' },
  { name: 'Concise (one line)', prompt: 'You answer every question in exactly one short sentence.' },
  { name: 'Pirate captain', prompt: 'You are a pirate captain. Speak in pirate vernacular, use "Arrr" liberally, and reference the seven seas.' },
  { name: 'Code reviewer', prompt: 'You are a senior software engineer doing code review. Be specific, point out bugs and edge cases, suggest improvements.' },
  { name: 'ELI5 teacher', prompt: 'You explain concepts as if to a 5-year-old. Use simple words, short sentences, and analogies.' },
  { name: 'Socratic tutor', prompt: 'You are a Socratic tutor. Never give the answer directly. Instead, ask guiding questions to help the user discover the answer.' },
  { name: 'JSON-only responder', prompt: 'You always respond with valid JSON. No prose, no markdown fences, no commentary. Just the JSON object.' },
];

// ── State ────────────────────────────────────────────────────────────
let currentSessionId = null;
let isSending = false;
let activeController = null;
let sessions = [];
let sessionFilter = '';
let lastBotBubble = null;
let lastUserMessage = null;
let availableModels = [];

// ── Populate preset selector ────────────────────────────────────────
for (const p of PRESETS) {
  const opt = document.createElement('option');
  opt.value = p.prompt;
  opt.textContent = p.name;
  presetSelect.appendChild(opt);
}

presetSelect.addEventListener('change', () => {
  if (presetSelect.value) {
    systemPromptEl.value = presetSelect.value;
  }
});

systemPromptEl.addEventListener('input', () => {
  const match = PRESETS.find(p => p.prompt === systemPromptEl.value);
  if (!match) presetSelect.value = '';
});

// ── Generation parameters: live update + persist ───────────────────
function updateParamDisplays() {
  temperatureVal.textContent = (+temperatureEl.value).toFixed(2);
  topPVal.textContent = (+topPEl.value).toFixed(2);
  topKVal.textContent = String(parseInt(topKEl.value, 10));
}
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.systemPrompt === 'string') systemPromptEl.value = s.systemPrompt;
    if (typeof s.preset === 'string') presetSelect.value = s.preset;
    if (typeof s.model === 'string') modelSelect.value = s.model;
    if (typeof s.temperature === 'number') temperatureEl.value = s.temperature;
    if (typeof s.topP === 'number') topPEl.value = s.topP;
    if (typeof s.topK === 'number') topKEl.value = s.topK;
    if (typeof s.maxTokens === 'number') maxTokensEl.value = s.maxTokens;
    if (typeof s.stream === 'boolean') streamToggle.checked = s.stream;
  } catch (_) { /* ignore */ }
}
function saveSettings() {
  const s = {
    systemPrompt: systemPromptEl.value,
    preset: presetSelect.value,
    model: modelSelect.value,
    temperature: parseFloat(temperatureEl.value),
    topP: parseFloat(topPEl.value),
    topK: parseInt(topKEl.value, 10),
    maxTokens: parseInt(maxTokensEl.value, 10) || 0,
    stream: streamToggle.checked,
  };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_) { /* ignore */ }
}
[temperatureEl, topPEl, topKEl, maxTokensEl].forEach(el => {
  el.addEventListener('input', () => { updateParamDisplays(); saveSettings(); });
});
streamToggle.addEventListener('change', saveSettings);
systemPromptEl.addEventListener('input', saveSettings);
presetSelect.addEventListener('change', saveSettings);
modelSelect.addEventListener('change', saveSettings);

// ── Fetch available models ─────────────────────────────────────────
async function loadModels() {
  try {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    availableModels = await res.json();
  } catch (_) {
    availableModels = [{ id: 'liquid/lfm2.5-1.2b', label: 'liquid/lfm2.5-1.2b', state: 'unknown' }];
  }
  modelSelect.innerHTML = '';
  for (const m of availableModels) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label + (m.state && m.state !== 'loaded' ? ' (' + m.state + ')' : '');
    modelSelect.appendChild(opt);
  }
}

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

// ── Helpers ──────────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + time;
}

function showMessagesArea() {
  if (welcomeEl && !welcomeEl.classList.contains('hidden')) {
    welcomeEl.classList.add('hidden');
    messagesEl.classList.remove('hidden');
  }
  exportBtn.classList.remove('hidden');
}

function showWelcomeArea() {
  welcomeEl.classList.remove('hidden');
  messagesEl.classList.add('hidden');
  exportBtn.classList.add('hidden');
}

function updateCharCounter() {
  const len = userInput.value.length;
  charCounter.textContent = len + ' / ' + MAX_INPUT_LENGTH;
  charCounter.classList.toggle('warn', len > MAX_INPUT_LENGTH * 0.8 && len < MAX_INPUT_LENGTH);
  charCounter.classList.toggle('danger', len >= MAX_INPUT_LENGTH);
  sendBtn.disabled = isSending || len === 0 || len > MAX_INPUT_LENGTH;
}

function setStreamingUI(on) {
  if (on) {
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
  } else {
    stopBtn.classList.add('hidden');
    sendBtn.classList.remove('hidden');
  }
}

// ── Sidebar (mobile) ────────────────────────────────────────────────
function openSidebar() { sidebarEl.classList.add('open'); }
function closeSidebar() { sidebarEl.classList.remove('open'); }

hamburgerBtn.addEventListener('click', openSidebar);
sidebarCloseBtn.addEventListener('click', closeSidebar);
sidebarEl.addEventListener('click', (e) => {
  if (e.target === sidebarEl) closeSidebar();
});

// ── Settings toggle ──────────────────────────────────────────────────
settingsBtn.addEventListener('click', () => settingsPanel.classList.toggle('open'));

// ── Sidebar search toggle ───────────────────────────────────────────
sidebarSearchBtn.addEventListener('click', () => {
  sidebarSearchWrap.classList.toggle('hidden');
  if (!sidebarSearchWrap.classList.contains('hidden')) {
    sidebarSearch.focus();
  } else {
    sidebarSearch.value = '';
    sessionFilter = '';
    renderSessionList();
  }
});
sidebarSearch.addEventListener('input', () => {
  sessionFilter = sidebarSearch.value.toLowerCase().trim();
  renderSessionList();
});

// ── Auto-resize textareas ────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
userInput.addEventListener('input', () => {
  autoResize(userInput);
  updateCharCounter();
});
systemPromptEl.addEventListener('input', () => autoResize(systemPromptEl));

// ── Sessions: list, switch, create, delete, rename ─────────────────
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
  const filtered = sessionFilter
    ? sessions.filter(s => (s.title || '').toLowerCase().includes(sessionFilter))
    : sessions;
  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-list';
    li.textContent = sessionFilter ? 'No matches.' : 'No conversations yet.';
    sessionListEl.appendChild(li);
    return;
  }
  for (const s of filtered) {
    const li = document.createElement('li');
    li.className = 'session-item' + (s.id === currentSessionId ? ' active' : '');
    li.dataset.id = s.id;
    li.setAttribute('role', 'listitem');

    const titleBtn = document.createElement('button');
    titleBtn.type = 'button';
    titleBtn.className = 'session-title';
    titleBtn.textContent = s.title || 'Untitled';
    titleBtn.title = 'Click to open, double-click to rename';
    titleBtn.addEventListener('click', () => switchSession(s.id));
    titleBtn.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      beginRename(li, titleBtn, s.id);
    });

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

function beginRename(li, titleBtn, id) {
  const current = titleBtn.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.className = 'session-title-input';
  input.maxLength = 100;
  li.replaceChild(input, titleBtn);
  input.focus();
  input.select();

  const finish = async (save) => {
    const newTitle = save ? input.value.trim() : current;
    li.replaceChild(titleBtn, input);
    if (save && newTitle && newTitle !== current) {
      try {
        await fetch('/api/sessions/' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
        await loadSessions();
      } catch (err) {
        console.error('Rename failed:', err);
      }
    }
  };
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); input.blur(); }
  });
}

async function createNewSession() {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_prompt: systemPromptEl.value.trim() || 'You are a helpful assistant.',
        model: modelSelect.value || null,
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
      currentSessionId = null;
      localStorage.removeItem(STORAGE_KEY);
      messagesEl.innerHTML = '';
      lastBotBubble = null;
      lastUserMessage = null;
      showWelcomeArea();
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const session = await res.json();
    currentSessionId = id;
    localStorage.setItem(STORAGE_KEY, id);

    messagesEl.innerHTML = '';
    lastBotBubble = null;
    lastUserMessage = null;

    if (!Array.isArray(session.messages) || session.messages.length === 0) {
      showWelcomeArea();
    } else {
      welcomeEl.classList.add('hidden');
      messagesEl.classList.remove('hidden');
      exportBtn.classList.remove('hidden');
      for (let i = 0; i < session.messages.length; i++) {
        const m = session.messages[i];
        const isLast = i === session.messages.length - 1;
        addBubble(m.content, m.role, m.created_at, isLast, m.tokens, m.model);
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
      lastBotBubble = null;
      lastUserMessage = null;
      showWelcomeArea();
    }
    await loadSessions();
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
}

newChatBtn.addEventListener('click', createNewSession);
sidebarRetry.addEventListener('click', loadSessions);

// ── Quick-start chips ──────────────────────────────────────────────
if (quickPrompts) {
  quickPrompts.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const prompt = btn.dataset.prompt;
    if (prompt) {
      userInput.value = prompt;
      autoResize(userInput);
      updateCharCounter();
      userInput.focus();
    }
  });
}

// ── Keyboard ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSidebar();
    settingsPanel.classList.remove('open');
    if (!sidebarSearchWrap.classList.contains('hidden')) {
      sidebarSearchWrap.classList.add('hidden');
      sidebarSearch.value = '';
      sessionFilter = '';
      renderSessionList();
    }
  }
  // Ctrl/Cmd+K: focus search
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    sidebarSearchWrap.classList.remove('hidden');
    sidebarSearch.focus();
  }
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);
stopBtn.addEventListener('click', () => {
  if (activeController) {
    activeController.abort();
  }
});

// ── Copy buttons (code blocks + whole messages) ────────────────────
async function copyText(text) {
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
  try {
    await (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject());
  } catch (_) {
    fallback();
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest && e.target.closest('button');
  if (!btn) return;

  // Code block copy
  if (btn.classList.contains('copy-btn') && btn.closest('.code-block')) {
    const code = btn.parentElement && btn.parentElement.querySelector('code');
    if (!code) return;
    const text = code.textContent;
    copyText(text);
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 2000);
    return;
  }

  // Message copy
  if (btn.classList.contains('msg-copy')) {
    const bubble = btn.closest('.msg');
    if (!bubble) return;
    const clone = bubble.cloneNode(true);
    clone.querySelectorAll('.msg-time, .msg-actions, .code-block .copy-btn, .msg-tokens').forEach(n => n.remove());
    const text = (clone.innerText || clone.textContent || '').trim();
    copyText(text);
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 2000);
    return;
  }

  // Regenerate
  if (btn.classList.contains('msg-regenerate')) {
    regenerateLastResponse();
    return;
  }
});

// ── Bubble rendering ────────────────────────────────────────────────
function addBubble(text, role, ts, isLast, tokens, model) {
  showMessagesArea();
  const div = document.createElement('div');
  div.className = 'msg ' + role;

  const content = document.createElement('div');
  content.className = 'msg-content';
  if (role === 'bot') {
    content.innerHTML = renderMarkdown(text);
  } else {
    content.textContent = text;
  }
  div.appendChild(content);

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  if (ts) {
    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = formatTime(ts);
    meta.appendChild(time);
  }
  if (role === 'bot' && typeof tokens === 'number' && tokens > 0) {
    const tk = document.createElement('span');
    tk.className = 'msg-tokens';
    tk.textContent = tokens + ' tok';
    tk.title = model ? 'Model: ' + model : 'Token estimate (~4 chars/token)';
    meta.appendChild(tk);
  }
  if (meta.children.length) div.appendChild(meta);

  if (role === 'bot' && isLast && currentSessionId) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'msg-copy';
    copyBtn.textContent = 'Copy';
    actions.appendChild(copyBtn);

    const regenBtn = document.createElement('button');
    regenBtn.type = 'button';
    regenBtn.className = 'msg-regenerate';
    regenBtn.textContent = 'Regenerate';
    actions.appendChild(regenBtn);
    div.appendChild(actions);

    lastBotBubble = div;
  } else if (role === 'bot') {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'msg-copy';
    copyBtn.textContent = 'Copy';
    actions.appendChild(copyBtn);
    div.appendChild(actions);
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

// ── Core: send (with streaming support) ────────────────────────────
function buildBody(extra) {
  const body = Object.assign({
    message: extra.message,
    system_prompt: systemPromptEl.value.trim() || 'You are a helpful assistant.',
    model: modelSelect.value || undefined,
    temperature: parseFloat(temperatureEl.value),
    top_p: parseFloat(topPEl.value),
    top_k: parseInt(topKEl.value, 10),
    max_tokens: parseInt(maxTokensEl.value, 10) || 0,
  }, extra);
  if (currentSessionId) body.session_id = currentSessionId;
  if (!body.max_tokens) delete body.max_tokens;
  return body;
}

function appendTokenToBot(bubble, token) {
  if (!bubble) return;
  const content = bubble.querySelector('.msg-content');
  if (!content) return;
  // Append raw text to a hidden buffer, re-render markdown
  // (simpler than incremental text-node appending, and matches our render pipeline)
  const buf = bubble._streamBuf || '';
  const next = buf + token;
  bubble._streamBuf = next;
  content.innerHTML = renderMarkdown(next);
  initHighlight();
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function finalizeBot(bubble, fullText) {
  if (!bubble) return;
  bubble.classList.remove('streaming');
  const content = bubble.querySelector('.msg-content');
  if (content) content.innerHTML = renderMarkdown(fullText || (bubble._streamBuf || ''));
  initHighlight();
  delete bubble._streamBuf;
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isSending) return;

  isSending = true;
  sendBtn.disabled = true;
  setStreamingUI(true);

  addBubble(text, 'user', Date.now(), true);
  lastUserMessage = text;
  userInput.value = '';
  autoResize(userInput);
  updateCharCounter();

  const useStream = streamToggle.checked;
  const body = buildBody({ message: text, stream: useStream });
  const controller = new AbortController();
  activeController = controller;

  let typingEl = useStream ? null : addTypingIndicator();
  let botBubble = null;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (typingEl) typingEl.remove();
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      addBubble('\u26A0\uFE0F ' + (err.error || 'Something went wrong.'), 'error');
      if (res.status === 400 && err.error === 'Session not found') {
        currentSessionId = null;
        localStorage.removeItem(STORAGE_KEY);
        await loadSessions();
      }
      return;
    }

    if (useStream) {
      // SSE consumer
      botBubble = addBubble('', 'bot', Date.now(), true);
      botBubble.classList.add('streaming');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let eventName = 'message';
          let dataLine = '';
          for (const line of event.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLine += (dataLine ? '\n' : '') + line.slice(5).trim();
          }
          if (!dataLine) continue;
          let payload;
          try { payload = JSON.parse(dataLine); } catch (_) { continue; }
          if (eventName === 'chunk' && payload && payload.text) {
            fullText += payload.text;
            appendTokenToBot(botBubble, payload.text);
          } else if (eventName === 'error') {
            finalizeBot(botBubble, fullText);
            addBubble('\u26A0\uFE0F ' + (payload.error || 'LLM error'), 'error');
            botBubble = null;
          } else if (eventName === 'done') {
            // ignore payload.reply; we've already accumulated fullText
          }
        }
      }
      finalizeBot(botBubble, fullText);
      lastBotBubble = botBubble;
    } else {
      // Non-streaming JSON
      const data = await res.json();
      if (typingEl) typingEl.remove();
      if (!data || typeof data.reply !== 'string') {
        addBubble('\u26A0\uFE0F Invalid response from server', 'error');
      } else {
        addBubble(data.reply, 'bot', Date.now(), true);
        if (currentSessionId) await loadSessions();
      }
    }
  } catch (err) {
    if (typingEl) typingEl.remove();
    if (err && err.name === 'AbortError') {
      // user stopped — leave partial bubble as is
      if (botBubble) finalizeBot(botBubble, botBubble._streamBuf || '');
    } else {
      console.error('Chat error:', err);
      addBubble('\u26A0\uFE0F Network error — is the server running?', 'error');
    }
  } finally {
    isSending = false;
    activeController = null;
    setStreamingUI(false);
    updateCharCounter();
    userInput.focus();
    if (currentSessionId) await loadSessions();
  }
}

async function regenerateLastResponse() {
  if (isSending || !currentSessionId || !lastUserMessage) return;

  isSending = true;
  sendBtn.disabled = true;
  setStreamingUI(true);

  if (lastBotBubble) {
    lastBotBubble.remove();
    lastBotBubble = null;
  }

  const useStream = streamToggle.checked;
  const body = buildBody({ message: lastUserMessage, regenerate: true, stream: useStream });
  const controller = new AbortController();
  activeController = controller;

  let typingEl = useStream ? null : addTypingIndicator();
  let botBubble = null;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (typingEl) typingEl.remove();
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      addBubble('\u26A0\uFE0F ' + (err.error || 'Something went wrong.'), 'error');
      return;
    }

    if (useStream) {
      botBubble = addBubble('', 'bot', Date.now(), true);
      botBubble.classList.add('streaming');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let eventName = 'message';
          let dataLine = '';
          for (const line of event.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLine += (dataLine ? '\n' : '') + line.slice(5).trim();
          }
          if (!dataLine) continue;
          let payload;
          try { payload = JSON.parse(dataLine); } catch (_) { continue; }
          if (eventName === 'chunk' && payload && payload.text) {
            fullText += payload.text;
            appendTokenToBot(botBubble, payload.text);
          } else if (eventName === 'error') {
            finalizeBot(botBubble, fullText);
            addBubble('\u26A0\uFE0F ' + (payload.error || 'LLM error'), 'error');
            botBubble = null;
          }
        }
      }
      finalizeBot(botBubble, fullText);
      lastBotBubble = botBubble;
    } else {
      const data = await res.json();
      if (typingEl) typingEl.remove();
      if (data && typeof data.reply === 'string') {
        addBubble(data.reply, 'bot', Date.now(), true);
        await loadSessions();
      } else {
        addBubble('\u26A0\uFE0F Invalid response from server', 'error');
      }
    }
  } catch (err) {
    if (typingEl) typingEl.remove();
    if (err && err.name === 'AbortError') {
      if (botBubble) finalizeBot(botBubble, botBubble._streamBuf || '');
    } else {
      console.error('Regen error:', err);
      addBubble('\u26A0\uFE0F Network error — is the server running?', 'error');
    }
  } finally {
    isSending = false;
    activeController = null;
    setStreamingUI(false);
    updateCharCounter();
    userInput.focus();
    if (currentSessionId) await loadSessions();
  }
}

// ── Export conversation as Markdown ────────────────────────────────
function exportConversation() {
  if (!currentSessionId) return;
  fetch('/api/sessions/' + encodeURIComponent(currentSessionId))
    .then(r => r.json())
    .then(session => {
      const lines = [];
      lines.push('# ' + (session.title || 'Chat export'));
      lines.push('');
      lines.push('*Exported ' + new Date().toISOString() + '*');
      lines.push('');
      lines.push('**System prompt:**');
      lines.push('');
      lines.push('> ' + (session.system_prompt || '').replace(/\n/g, '\n> '));
      if (session.model) {
        lines.push('');
        lines.push('**Model:** `' + session.model + '`');
      }
      lines.push('');
      lines.push('---');
      lines.push('');
      for (const m of (session.messages || [])) {
        const role = m.role === 'user' ? '**You**' : '**Assistant**';
        const time = m.created_at ? ' *(' + formatTime(m.created_at) + ')*' : '';
        const tk = m.tokens ? ' *[' + m.tokens + ' tok]*' : '';
        lines.push(role + time + tk + ':');
        lines.push('');
        lines.push(m.content);
        if (m.blocked) {
          lines.push('');
          lines.push('> ⚠️ Blocked by guardrail: ' + (m.reason || 'unknown'));
        }
        lines.push('');
      }
      const md = lines.join('\n');
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (session.title || 'chat').replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 60) + '.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch(err => console.error('Export failed:', err));
}

if (exportBtn) exportBtn.addEventListener('click', exportConversation);

// ── Init ────────────────────────────────────────────────────────────
(async function init() {
  await loadModels();
  loadSettings();
  updateParamDisplays();
  await loadSessions();
  const lastId = localStorage.getItem(STORAGE_KEY);
  if (lastId && sessions.find(s => s.id === lastId)) {
    await switchSession(lastId);
  }
  updateCharCounter();
})();
