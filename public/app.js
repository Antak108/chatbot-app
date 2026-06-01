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
const ttsToggle = document.getElementById('ttsToggle');
const themeBtn = document.getElementById('themeBtn');
const themeSelect = document.getElementById('themeSelect');
const accentPicker = document.getElementById('accentPicker');
const densitySelect = document.getElementById('densitySelect');
const fontSizeSelect = document.getElementById('fontSizeSelect');
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
const searchBackdrop = document.getElementById('searchBackdrop');
const searchInput = document.getElementById('searchInput');
const searchRole = document.getElementById('searchRole');
const searchResults = document.getElementById('searchResults');
const exportBtn = document.getElementById('exportBtn');
const shareBtn = document.getElementById('shareBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const quickPrompts = document.getElementById('quickPrompts');
const attachBtn = document.getElementById('attachBtn');
const micBtn = document.getElementById('micBtn');
const fileInput = document.getElementById('fileInput');
const attachmentsEl = document.getElementById('attachments');
const dropOverlay = document.getElementById('dropOverlay');
const memoryListEl = document.getElementById('memoryList');
const memoryInputEl = document.getElementById('memoryInput');
const memoryAddBtn = document.getElementById('memoryAddBtn');
const memoryClearBtn = document.getElementById('memoryClearBtn');

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
let pendingAttachments = []; // [{ filename, mime, size, text, charCount, isImage, dataUrl? }]

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
    if (typeof s.tts === 'boolean' && ttsToggle) ttsToggle.checked = s.tts;
    if (typeof s.theme === 'string') applyTheme(s.theme);
    if (typeof s.accent === 'string') applyAccent(s.accent);
    if (typeof s.density === 'string') applyDensity(s.density);
    if (typeof s.fontSize === 'string') applyFontSize(s.fontSize);
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
    tts: ttsToggle ? ttsToggle.checked : false,
    theme: document.documentElement.getAttribute('data-theme') || 'dark',
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    density: document.documentElement.getAttribute('data-density') || 'comfortable',
    fontSize: document.documentElement.getAttribute('data-font-size') || 'medium',
  };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_) { /* ignore */ }
}
[temperatureEl, topPEl, topKEl, maxTokensEl].forEach(el => {
  el.addEventListener('input', () => { updateParamDisplays(); saveSettings(); });
});
streamToggle.addEventListener('change', saveSettings);
if (ttsToggle) ttsToggle.addEventListener('change', saveSettings);
systemPromptEl.addEventListener('input', saveSettings);
presetSelect.addEventListener('change', saveSettings);
modelSelect.addEventListener('change', saveSettings);

// ── Appearance: theme, accent, density, font size ─────────────────
function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  if (themeSelect) themeSelect.value = t;
  if (themeBtn) themeBtn.textContent = t === 'light' ? '\u263D' : '\u2600';
}
function applyAccent(hex) {
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex || '')) return;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const root = document.documentElement.style;
  root.setProperty('--accent', hex);
  root.setProperty('--accent-glow', 'rgba(' + r + ',' + g + ',' + b + ',0.35)');
  root.setProperty('--accent-surface', 'rgba(' + r + ',' + g + ',' + b + ',0.12)');
  root.setProperty('--user-bubble', 'linear-gradient(135deg, ' + hex + ' 0%, #5c8aff 100%)');
  if (accentPicker) accentPicker.value = hex.length === 4
    ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    : hex;
}
function applyDensity(d) {
  const v = d === 'compact' ? 'compact' : 'comfortable';
  if (v === 'comfortable') document.documentElement.removeAttribute('data-density');
  else document.documentElement.setAttribute('data-density', v);
  if (densitySelect) densitySelect.value = v;
}
function applyFontSize(s) {
  const allowed = ['small', 'medium', 'large'];
  if (!allowed.includes(s)) s = 'medium';
  if (s === 'medium') document.documentElement.removeAttribute('data-font-size');
  else document.documentElement.setAttribute('data-font-size', s);
  if (fontSizeSelect) fontSizeSelect.value = s;
}

if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    saveSettings();
  });
}
if (themeSelect) themeSelect.addEventListener('change', () => { applyTheme(themeSelect.value); saveSettings(); });
if (accentPicker) accentPicker.addEventListener('input', () => { applyAccent(accentPicker.value); saveSettings(); });
if (densitySelect) densitySelect.addEventListener('change', () => { applyDensity(densitySelect.value); saveSettings(); });
if (fontSizeSelect) fontSizeSelect.addEventListener('change', () => { applyFontSize(fontSizeSelect.value); saveSettings(); });

// ── Long-term memory (cross-session) ───────────────────────────────
async function loadMemory() {
  try {
    const r = await fetch('/api/memory');
    if (!r.ok) return { facts: [] };
    return await r.json();
  } catch (_) { return { facts: [] }; }
}

async function renderMemory() {
  const data = await loadMemory();
  memoryListEl.innerHTML = '';
  if (!data.facts.length) {
    const empty = document.createElement('div');
    empty.className = 'memory-empty';
    empty.textContent = 'No memories yet. Type /remember your fact.';
    memoryListEl.appendChild(empty);
    return;
  }
  data.facts.forEach((f, idx) => {
    const row = document.createElement('div');
    row.className = 'memory-item';
    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = f.text;
    const forget = document.createElement('button');
    forget.type = 'button';
    forget.className = 'forget';
    forget.textContent = '\u00D7';
    forget.title = 'Forget this';
    forget.addEventListener('click', async () => {
      try {
        await fetch('/api/memory/' + idx, { method: 'DELETE' });
        renderMemory();
      } catch (err) { console.error('Forget failed:', err); }
    });
    row.appendChild(text);
    row.appendChild(forget);
    memoryListEl.appendChild(row);
  });
}

if (memoryAddBtn) {
  memoryAddBtn.addEventListener('click', async () => {
    const t = memoryInputEl.value.trim();
    if (!t) return;
    try {
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      memoryInputEl.value = '';
      renderMemory();
    } catch (err) { console.error('Add memory failed:', err); }
  });
}
if (memoryInputEl) {
  memoryInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); memoryAddBtn.click(); }
  });
}
if (memoryClearBtn) {
  memoryClearBtn.addEventListener('click', async () => {
    if (!confirm('Clear all long-term memories?')) return;
    try { await fetch('/api/memory/clear', { method: 'POST' }); renderMemory(); }
    catch (err) { console.error('Clear failed:', err); }
  });
}

// ── Custom blocklist (admin) ────────────────────────────────────────
const blocklistArea = document.getElementById('blocklistArea');
const blocklistSaveBtn = document.getElementById('blocklistSaveBtn');
async function loadBlocklist() {
  if (!blocklistArea) return;
  try {
    const r = await fetch('/api/blocklist');
    if (!r.ok) return;
    const d = await r.json();
    blocklistArea.value = (d.entries || []).join('\n');
  } catch (_) {}
}
if (blocklistSaveBtn) {
  blocklistSaveBtn.addEventListener('click', async () => {
    const entries = blocklistArea.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    try {
      const r = await fetch('/api/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      blocklistSaveBtn.textContent = 'Saved \u2713';
      setTimeout(() => { blocklistSaveBtn.textContent = 'Save blocklist'; }, 1500);
    } catch (err) { window.alert('Save failed: ' + err.message); }
  });
}

// ── Templates (system-prompt presets, with persistence) ───────────
const templateSelect = document.getElementById('templateSelect');
const templateNote = document.getElementById('templateNote');

async function loadTemplates() {
  try {
    const r = await fetch('/api/templates');
    if (!r.ok) return;
    const list = await r.json();
    templateSelect.innerHTML = '<option value="">\u2014 pick a template \u2014</option>';
    for (const t of list) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      opt.dataset.prompt = t.system_prompt;
      opt.dataset.description = t.description || '';
      templateSelect.appendChild(opt);
    }
  } catch (err) { console.error('Template load failed:', err); }
}

if (templateSelect) {
  templateSelect.addEventListener('change', () => {
    const opt = templateSelect.options[templateSelect.selectedIndex];
    const prompt = opt && opt.dataset.prompt;
    if (prompt) {
      systemPromptEl.value = prompt;
      saveSettings();
    }
    if (templateNote) {
      templateNote.textContent = (opt && opt.dataset.description) || '';
    }
  });
}

// ── File attachments (upload, drag-drop, paste) ────────────────────
async function handleFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    addBubble('\u26A0\uFE0F File too large (max 10 MB).', 'error');
    return;
  }
  const isImage = (file.type || '').startsWith('image/');
  if (isImage) {
    // Images: vision not enabled in this build; just attach the name
    pendingAttachments.push({
      filename: file.name || 'pasted-image',
      mime: file.type,
      size: file.size,
      isImage: true,
    });
    renderAttachments();
    return;
  }
  // Text or PDF: upload for extraction
  const form = new FormData();
  form.append('file', file);
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: form });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: 'Upload failed' }));
      addBubble('\u26A0\uFE0F Upload failed: ' + (err.error || r.status), 'error');
      return;
    }
    const data = await r.json();
    pendingAttachments.push({
      filename: data.filename,
      mime: data.mime,
      size: data.size,
      text: data.text,
      charCount: data.charCount,
      isImage: false,
    });
    renderAttachments();
  } catch (err) {
    addBubble('\u26A0\uFE0F Upload error: ' + err.message, 'error');
  }
}

function renderAttachments() {
  attachmentsEl.innerHTML = '';
  if (pendingAttachments.length === 0) {
    attachmentsEl.classList.add('hidden');
    return;
  }
  attachmentsEl.classList.remove('hidden');
  pendingAttachments.forEach((a, idx) => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    const label = a.isImage ? a.filename + ' (image)' :
      a.filename + ' (' + Math.round((a.size || 0) / 1024) + ' KB, ' + (a.charCount || 0) + ' chars)';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = label;
    name.title = label;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'remove';
    rm.textContent = '\u00D7';
    rm.title = 'Remove';
    rm.addEventListener('click', () => {
      pendingAttachments.splice(idx, 1);
      renderAttachments();
    });
    chip.appendChild(name);
    chip.appendChild(rm);
    attachmentsEl.appendChild(chip);
  });
}

if (attachBtn) {
  attachBtn.addEventListener('click', () => fileInput.click());
}
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
    fileInput.value = '';
  });
}

// Drag-and-drop
let dragDepth = 0;
document.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  e.preventDefault();
  dragDepth++;
  dropOverlay.classList.remove('hidden');
});
document.addEventListener('dragover', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  e.preventDefault();
});
document.addEventListener('dragleave', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropOverlay.classList.add('hidden');
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.classList.add('hidden');
  const files = Array.from(e.dataTransfer && e.dataTransfer.files || []);
  for (const f of files) handleFile(f);
});

// Paste images from clipboard
userInput.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f) {
        e.preventDefault();
        handleFile(f);
      }
    }
  }
});

// ── Voice input (Web Speech API) ────────────────────────────────────
let recognition = null;
let isListening = false;
let voiceBaseText = '';

function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.continuous = true;
  r.interimResults = true;
  r.lang = 'en-US';
  r.onresult = (event) => {
    let finalT = '';
    let interimT = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalT += t;
      else interimT += t;
    }
    if (finalT) voiceBaseText = (voiceBaseText + ' ' + finalT).trim();
    userInput.value = (voiceBaseText + ' ' + interimT).trim();
    autoResize(userInput);
    updateCharCounter();
  };
  r.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
    stopListening();
  };
  r.onend = () => {
    if (isListening) { // was kicked out unexpectedly
      isListening = false;
      micBtn.classList.remove('listening');
    }
  };
  return r;
}

function startListening() {
  if (!recognition) {
    recognition = initRecognition();
    if (!recognition) { addBubble('\u26A0\uFE0F Voice input not supported in this browser.', 'error'); return; }
  }
  try {
    voiceBaseText = userInput.value;
    recognition.start();
    isListening = true;
    micBtn.classList.add('listening');
  } catch (err) {
    console.warn('Could not start recognition:', err);
  }
}

function stopListening() {
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }
  isListening = false;
  if (micBtn) micBtn.classList.remove('listening');
}

if (micBtn) {
  micBtn.addEventListener('click', () => {
    if (isListening) stopListening();
    else startListening();
  });
}

// ── TTS output (speechSynthesis) ────────────────────────────────────
let ttsUtter = null;
function speak(text) {
  if (!('speechSynthesis' in window) || !ttsToggle || !ttsToggle.checked) return;
  try { window.speechSynthesis.cancel(); } catch (_) {}
  if (!text || !text.trim()) return;
  ttsUtter = new SpeechSynthesisUtterance(text);
  ttsUtter.rate = 1.0;
  ttsUtter.pitch = 1.0;
  ttsUtter.onend = () => { ttsUtter = null; };
  ttsUtter.onerror = () => { ttsUtter = null; };
  window.speechSynthesis.speak(ttsUtter);
}

function stopSpeaking() {
  try { window.speechSynthesis.cancel(); } catch (_) {}
  ttsUtter = null;
}

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

// ── Configure marked (code block renderer + extensions) ────────────
if (typeof marked !== 'undefined') {
  // Mermaid fence: ```mermaid → <div class="mermaid">
  const mermaidExtension = {
    name: 'mermaid',
    level: 'block',
    start(src) { return src.match(/^```mermaid\s*/)?.index; },
    tokenizer(src) {
      const match = /^```mermaid\s*\n([\s\S]+?)\n```\s*/.exec(src);
      if (match) {
        return { type: 'mermaid', raw: match[0], text: match[1] };
      }
      return undefined;
    },
    renderer(token) {
      const safe = (token.text || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
      return '<div class="mermaid">' + safe + '</div>';
    },
  };

  marked.use({
    extensions: [mermaidExtension],
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
  // Math (KaTeX injects these)
  'math', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'mfrac', 'msup', 'msub', 'msubsup',
  'mtext', 'mover', 'munder', 'munderover', 'mspace', 'annotation', 'svg', 'path',
  'g', 'rect', 'line',
];
const ALLOWED_ATTR = ['class', 'id', 'href', 'title', 'alt', 'src', 'open', 'style', 'aria-hidden', 'role', 'xmlns', 'viewbox', 'd', 'fill', 'stroke'];

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

// ── Post-render: math + mermaid (called after each render) ──────────
let mermaidInitialized = false;
let mermaidIdCounter = 0;
async function postRender(root) {
  if (!root) return;
  // KaTeX: render $...$ and $$...$$ math
  if (typeof renderMathInElement === 'function' && typeof katex !== 'undefined') {
    try {
      renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    } catch (err) { /* ignore */ }
  }
  // Mermaid: find .mermaid divs and render them
  if (typeof mermaid !== 'undefined') {
    try {
      if (!mermaidInitialized) {
        const dark = !(document.documentElement.getAttribute('data-theme') === 'light');
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'inherit',
        });
        mermaidInitialized = true;
      }
      const blocks = root.querySelectorAll('.mermaid');
      for (const block of blocks) {
        if (block.dataset.rendered === '1') continue;
        const id = 'mmd-' + (++mermaidIdCounter);
        const source = block.textContent;
        try {
          const { svg } = await mermaid.render(id, source);
          block.innerHTML = svg;
          block.dataset.rendered = '1';
        } catch (err) {
          block.innerHTML = '<pre class="mermaid-error">Mermaid error: ' + (err.message || err) + '\n\n' + source.replace(/</g, '&lt;') + '</pre>';
          block.dataset.rendered = '1';
        }
      }
    } catch (_) { /* ignore */ }
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
  if (shareBtn) shareBtn.classList.remove('hidden');
}

function showWelcomeArea() {
  welcomeEl.classList.remove('hidden');
  messagesEl.classList.add('hidden');
  exportBtn.classList.add('hidden');
  if (shareBtn) shareBtn.classList.add('hidden');
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
  // Open the global search modal (Cmd/Ctrl+F equivalent)
  openSearch();
});
sidebarSearch.addEventListener('input', () => {
  sessionFilter = sidebarSearch.value.toLowerCase().trim();
  renderSessionList();
});

const showArchived = document.getElementById('showArchived');
if (showArchived) showArchived.addEventListener('change', () => loadSessions());

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
    const showArchived = document.getElementById('showArchived');
    const includeArchived = showArchived && showArchived.checked;
    const url = includeArchived ? '/api/sessions?archived=true' : '/api/sessions?archived=false';
    const res = await fetch(url);
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
    li.className = 'session-item' + (s.id === currentSessionId ? ' active' : '') + (s.pinned ? ' pinned' : '');
    li.dataset.id = s.id;
    li.setAttribute('role', 'listitem');
    li.draggable = true;

    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = 'session-star';
    starBtn.textContent = s.pinned ? '\u2605' : '\u2606';
    starBtn.setAttribute('aria-label', s.pinned ? 'Unpin' : 'Pin');
    starBtn.title = s.pinned ? 'Unpin' : 'Pin to top';
    starBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await fetch('/api/sessions/' + encodeURIComponent(s.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pinned: !s.pinned }),
        });
        await loadSessions();
      } catch (err) { console.error('Pin failed:', err); }
    });

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

    const actions = document.createElement('span');
    actions.className = 'session-actions';

    const tagBtn = document.createElement('button');
    tagBtn.type = 'button';
    tagBtn.className = 'session-action-btn';
    tagBtn.textContent = '\u2691';
    tagBtn.setAttribute('aria-label', 'Edit tags');
    tagBtn.title = 'Edit tags';
    tagBtn.addEventListener('click', (e) => { e.stopPropagation(); beginEditTags(li, s); });
    actions.appendChild(tagBtn);

    const archiveBtn = document.createElement('button');
    archiveBtn.type = 'button';
    archiveBtn.className = 'session-action-btn';
    archiveBtn.textContent = s.archived ? '\u25C7' : '\u25A1';
    archiveBtn.setAttribute('aria-label', s.archived ? 'Unarchive' : 'Archive');
    archiveBtn.title = s.archived ? 'Unarchive' : 'Archive';
    archiveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await fetch('/api/sessions/' + encodeURIComponent(s.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: !s.archived }),
        });
        await loadSessions();
      } catch (err) { console.error('Archive failed:', err); }
    });
    actions.appendChild(archiveBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'session-delete';
    delBtn.setAttribute('aria-label', 'Delete ' + (s.title || 'session'));
    delBtn.textContent = '\u00D7';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteSession(s.id); });
    actions.appendChild(delBtn);

    li.appendChild(starBtn);
    li.appendChild(titleBtn);
    li.appendChild(actions);

    if (s.tags && s.tags.length) {
      const tagsRow = document.createElement('span');
      tagsRow.className = 'session-tags';
      s.tags.forEach(t => {
        const tag = document.createElement('span');
        tag.className = 'session-tag';
        tag.textContent = '#' + t;
        tagsRow.appendChild(tag);
      });
      li.appendChild(tagsRow);
    }

    attachDragHandlers(li, s);
    sessionListEl.appendChild(li);
  }
}

let dragSrcId = null;
function attachDragHandlers(li, s) {
  li.addEventListener('dragstart', (e) => {
    dragSrcId = s.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', s.id); } catch (_) {}
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    document.querySelectorAll('.session-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragSrcId = null;
  });
  li.addEventListener('dragover', (e) => {
    if (!dragSrcId || dragSrcId === s.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    li.classList.add('drag-over');
  });
  li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
  li.addEventListener('drop', async (e) => {
    e.preventDefault();
    li.classList.remove('drag-over');
    if (!dragSrcId || dragSrcId === s.id) return;
    // Reorder: put dragSrc immediately before this session.
    const ordered = sessions.slice();
    const srcIdx = ordered.findIndex(x => x.id === dragSrcId);
    const dstIdx = ordered.findIndex(x => x.id === s.id);
    if (srcIdx < 0 || dstIdx < 0) return;
    const [moved] = ordered.splice(srcIdx, 1);
    const newIdx = ordered.findIndex(x => x.id === s.id);
    ordered.splice(newIdx, 0, moved);
    // Assign order values to all; pinned items keep top, others fall through.
    let order = 0;
    for (const sess of ordered) {
      if (sess.pinned) continue;
      try {
        await fetch('/api/sessions/' + encodeURIComponent(sess.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: order++ }),
        });
      } catch (err) { console.error('Reorder failed:', err); }
    }
    await loadSessions();
  });
}

function beginEditTags(li, s) {
  const existing = (s.tags || []).join(', ');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'session-tag-input';
  input.placeholder = 'comma,separated,tags';
  input.value = existing;
  const tagsRow = li.querySelector('.session-tags');
  if (tagsRow) li.removeChild(tagsRow);
  li.appendChild(input);
  input.focus();
  const finish = async (save) => {
    if (!save) {
      await loadSessions();
      return;
    }
    const tags = input.value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 20);
    try {
      await fetch('/api/sessions/' + encodeURIComponent(s.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      await loadSessions();
    } catch (err) { console.error('Tag update failed:', err); }
  };
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
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
      if (shareBtn) shareBtn.classList.remove('hidden');
      for (let i = 0; i < session.messages.length; i++) {
        const m = session.messages[i];
        const isLast = i === session.messages.length - 1;
        addBubble(m.content, m.role, m.created_at, isLast, m.tokens, m.model, m);
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
  // Global: '?' shows shortcuts (only when not typing in an input/textarea)
  const isTyping = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && !paletteBackdrop.classList.contains('hidden') === false && !shortcutsBackdrop.classList.contains('hidden') === false;
  if (e.key === '?' && !isTyping) {
    e.preventDefault();
    openShortcuts();
    return;
  }
  // Escape closes any open panel
  if (e.key === 'Escape') {
    if (!paletteBackdrop.classList.contains('hidden')) { closePalette(); return; }
    if (!shortcutsBackdrop.classList.contains('hidden')) { closeShortcuts(); return; }
    if (!searchBackdrop.classList.contains('hidden')) { closeSearch(); return; }
    closeSidebar();
    settingsPanel.classList.remove('open');
    if (!sidebarSearchWrap.classList.contains('hidden')) {
      sidebarSearchWrap.classList.add('hidden');
      sidebarSearch.value = '';
      sessionFilter = '';
      renderSessionList();
    }
    hideSlashMenu();
  }
  // Ctrl/Cmd+K: command palette
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
    return;
  }
  // Ctrl/Cmd+F: global search
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openSearch();
    return;
  }
  // Ctrl/Cmd+/: toggle theme
  if ((e.metaKey || e.ctrlKey) && e.key === '/') {
    e.preventDefault();
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    saveSettings();
    return;
  }
  // Ctrl/Cmd+.: settings
  if ((e.metaKey || e.ctrlKey) && e.key === '.') {
    e.preventDefault();
    settingsPanel.classList.toggle('open');
    return;
  }
  // Ctrl/Cmd+E: export
  if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
    e.preventDefault();
    exportConversation();
    return;
  }
  // Ctrl/Cmd+N: new chat
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    e.preventDefault();
    createNewSession();
    return;
  }
});

// ── Global search modal ─────────────────────────────────────────────
let searchDebounce = null;
function openSearch() {
  searchBackdrop.classList.remove('hidden');
  searchInput.value = '';
  searchRole.value = '';
  searchResults.innerHTML = '';
  setTimeout(() => searchInput.focus(), 30);
}
function closeSearch() {
  searchBackdrop.classList.add('hidden');
  if (searchDebounce) clearTimeout(searchDebounce);
}
searchBackdrop.addEventListener('click', (e) => { if (e.target === searchBackdrop) closeSearch(); });
function triggerSearch() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(runSearch, 200);
}
searchInput.addEventListener('input', triggerSearch);
searchRole.addEventListener('change', runSearch);

async function runSearch() {
  const q = searchInput.value.trim();
  const role = searchRole.value;
  if (!q && !role) { searchResults.innerHTML = ''; return; }
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (role) params.set('role', role);
  try {
    const r = await fetch('/api/search?' + params.toString());
    if (!r.ok) return;
    const data = await r.json();
    renderSearchResults(data.results, q);
  } catch (err) { console.error('Search failed:', err); }
}

function renderSearchResults(results, q) {
  searchResults.innerHTML = '';
  if (!results.length) {
    const li = document.createElement('li');
    li.className = 'search-empty';
    li.textContent = 'No matches.';
    searchResults.appendChild(li);
    return;
  }
  for (const hit of results) {
    const li = document.createElement('li');
    li.className = 'search-hit';
    li.setAttribute('role', 'option');
    li.dataset.sessionId = hit.session_id;
    li.dataset.messageId = hit.message_id;
    const header = document.createElement('div');
    header.className = 'search-hit-header';
    const title = document.createElement('span');
    title.className = 'search-hit-title';
    title.textContent = hit.session_title;
    const role = document.createElement('span');
    role.className = 'search-hit-role ' + hit.role;
    role.textContent = hit.role;
    const date = document.createElement('span');
    date.className = 'search-hit-date';
    date.textContent = new Date(hit.created_at).toLocaleString();
    header.appendChild(title);
    header.appendChild(role);
    header.appendChild(date);
    const body = document.createElement('div');
    body.className = 'search-hit-snippet';
    body.textContent = hit.snippet;
    li.appendChild(header);
    li.appendChild(body);
    li.addEventListener('click', async () => {
      closeSearch();
      await switchSession(hit.session_id);
      setTimeout(() => {
        const el = document.querySelector('.msg[data-id="' + CSS.escape(hit.message_id) + '"]');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('msg-highlight');
          setTimeout(() => el.classList.remove('msg-highlight'), 1800);
        }
      }, 200);
    });
    searchResults.appendChild(li);
  }
}

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!slashMenu.classList.contains('hidden') && slashMatches.length > 0) {
      selectActiveSlash();
    } else {
      sendMessage();
    }
    return;
  }
  if (e.key === 'ArrowDown' && !slashMenu.classList.contains('hidden')) {
    e.preventDefault();
    moveSlashSelection(1);
    return;
  }
  if (e.key === 'ArrowUp' && !slashMenu.classList.contains('hidden')) {
    e.preventDefault();
    moveSlashSelection(-1);
    return;
  }
  if (e.key === 'Tab' && !slashMenu.classList.contains('hidden')) {
    e.preventDefault();
    selectActiveSlash();
    return;
  }
  if (e.key === 'Escape' && !slashMenu.classList.contains('hidden')) {
    hideSlashMenu();
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

  // Continue
  if (btn.classList.contains('msg-continue')) {
    continueLastResponse(btn);
    return;
  }

  // Edit
  if (btn.classList.contains('msg-edit')) {
    const bubble = btn.closest('.msg');
    if (bubble) beginEdit(bubble);
    return;
  }
});

// ── Bubble rendering ────────────────────────────────────────────────
function appendFeedback(parent, _unused, msgObj) {
  const wrap = document.createElement('span');
  wrap.className = 'msg-feedback';
  const reactions = [
    { key: 'up', label: '\uD83D\uDC4D' },
    { key: 'down', label: '\uD83D\uDC4E' },
    { key: 'love', label: '\u2764\uFE0F' },
    { key: 'laugh', label: '\uD83D\uDE06' },
  ];
  const current = (msgObj && msgObj.reaction) || null;
  for (const r of reactions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'msg-react' + (current === r.key ? ' active' : '');
    btn.textContent = r.label;
    btn.title = r.key;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mid = divContainingMsgId(parent);
      if (!mid || !currentSessionId) return;
      const newVal = current === r.key ? null : r.key;
      fetch('/api/sessions/' + encodeURIComponent(currentSessionId) + '/messages/' + encodeURIComponent(mid), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: newVal }),
      }).catch(err => console.error('Reaction failed:', err));
      wrap.querySelectorAll('.msg-react').forEach(b => b.classList.remove('active'));
      if (newVal) btn.classList.add('active');
    });
    wrap.appendChild(btn);
  }
  parent.appendChild(wrap);
}

function divContainingMsgId(el) {
  let cur = el;
  while (cur && cur !== document.body) {
    if (cur.classList && cur.classList.contains('msg')) return cur.dataset.id || null;
    cur = cur.parentElement;
  }
  return null;
}

function addBubble(text, role, ts, isLast, tokens, model, msgObj) {
  showMessagesArea();
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  if (msgObj && msgObj.id) div.dataset.id = msgObj.id;

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

    const contBtn = document.createElement('button');
    contBtn.type = 'button';
    contBtn.className = 'msg-continue';
    contBtn.textContent = 'Continue';
    actions.appendChild(contBtn);

    appendFeedback(actions, null, msgObj);
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
    if (isLast) {
      const contBtn = document.createElement('button');
      contBtn.type = 'button';
      contBtn.className = 'msg-continue';
      contBtn.textContent = 'Continue';
      actions.appendChild(contBtn);
    }
    appendFeedback(actions, null, msgObj);
    div.appendChild(actions);
  } else if (role === 'user') {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'msg-edit';
    editBtn.textContent = 'Edit';
    actions.appendChild(editBtn);
    div.appendChild(actions);
  }

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  initHighlight();
  const content2 = div.querySelector('.msg-content');
  if (content2) postRender(content2);
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
  // Skip postRender during streaming (will run on finalizeBot) for perf
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function finalizeBot(bubble, fullText) {
  if (!bubble) return;
  bubble.classList.remove('streaming');
  const content = bubble.querySelector('.msg-content');
  if (content) content.innerHTML = renderMarkdown(fullText || (bubble._streamBuf || ''));
  initHighlight();
  if (content) postRender(content);
  delete bubble._streamBuf;
  // TTS: speak the final reply (stripped of markdown noise for clarity)
  if (ttsToggle && ttsToggle.checked) {
    const plain = (fullText || (bubble._streamBuf || ''))
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`[^`]+`/g, '')
      .replace(/[#*_>~\-]+/g, ' ')
      .replace(/\n+/g, '. ')
      .trim();
    speak(plain);
  }
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isSending) return;
  hideSlashMenu();

  // Slash command interception
  if (text.startsWith('/')) {
    const cmd = COMMANDS.find(c => text === c.cmd || text.startsWith(c.cmd + ' '));
    if (cmd) {
      userInput.value = '';
      autoResize(userInput);
      updateCharCounter();
      try { await cmd.run(text); } catch (err) { console.error('Command failed:', err); }
      return;
    }
  }

  isSending = true;
  sendBtn.disabled = true;
  setStreamingUI(true);

  // Show the user message; if there are attachments, also show a chip line
  addBubble(text, 'user', Date.now(), true);
  if (pendingAttachments.length > 0) {
    for (const a of pendingAttachments) {
      if (a.isImage) {
        addBubble('\u{1F4CE} ' + a.filename + ' (image — vision not enabled)', 'user', Date.now(), true);
      } else {
        addBubble('\u{1F4CE} ' + a.filename + ' (' + a.charCount + ' chars)', 'user', Date.now(), true);
      }
    }
  }
  lastUserMessage = text;
  userInput.value = '';
  autoResize(userInput);
  updateCharCounter();

  // Build the LLM-bound message: prepend the file content as context
  let outboundMessage = text;
  const textAttachments = pendingAttachments.filter(a => !a.isImage && a.text);
  if (textAttachments.length > 0) {
    const contextParts = textAttachments.map(a =>
      '\n\n<file name="' + a.filename + '">\n' + a.text + '\n</file>'
    );
    outboundMessage = text + contextParts.join('');
  }

  // Clear attachments after sending
  pendingAttachments = [];
  renderAttachments();

  const useStream = streamToggle.checked;
  const body = buildBody({ message: outboundMessage, stream: useStream });
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

  addBubble(text, 'user', Date.now(), true);
  if (pendingAttachments.length > 0) {
    for (const a of pendingAttachments) {
      if (a.isImage) {
        addBubble('\u{1F4CE} ' + a.filename + ' (image — vision not enabled)', 'user', Date.now(), true);
      } else {
        addBubble('\u{1F4CE} ' + a.filename + ' (' + a.charCount + ' chars)', 'user', Date.now(), true);
      }
    }
  }
  lastUserMessage = text;

  // Build the LLM-bound message: prepend the file content as context
  let outboundMessage = text;
  const textAttachments = pendingAttachments.filter(a => !a.isImage && a.text);
  if (textAttachments.length > 0) {
    const contextParts = textAttachments.map(a =>
      '\n\n<file name="' + a.filename + '">\n' + a.text + '\n</file>'
    );
    outboundMessage = text + contextParts.join('');
  }

  // Clear attachments after sending
  pendingAttachments = [];
  renderAttachments();

  userInput.value = '';
  autoResize(userInput);
  updateCharCounter();

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

async function continueLastResponse(btn) {
  if (isSending || !currentSessionId) return;
  btn.disabled = true;
  isSending = true;
  setStreamingUI(true);

  const target = lastBotBubble || messagesEl.querySelector('.msg.bot:last-child');
  if (!target) { isSending = false; setStreamingUI(false); btn.disabled = false; return; }
  target.classList.add('streaming');
  const content = target.querySelector('.msg-content');

  let controller;
  try {
    controller = new AbortController();
    activeController = controller;
    const res = await fetch('/api/chat/continue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSessionId,
        system_prompt: systemPromptEl.value.trim() || 'You are a helpful assistant.',
        model: modelSelect.value || undefined,
        temperature: parseFloat(temperatureEl.value),
        top_p: parseFloat(topPEl.value),
        top_k: parseInt(topKEl.value, 10),
        max_tokens: parseInt(maxTokensEl.value, 10) || 0,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      target.classList.remove('streaming');
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      addBubble('\u26A0\uFE0F ' + (err.error || 'Continue failed.'), 'error');
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullAppended = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const eventBlock = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let dataLines = [];
        for (const line of eventBlock.split('\n')) {
          if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let payload;
        try { payload = JSON.parse(dataLines.join('\n')); } catch (_) { continue; }
        if (payload && payload.text) {
          fullAppended += payload.text;
          const buf = (target._streamBuf || (target._streamBuf = (content.textContent || ''))) + payload.text;
          target._streamBuf = buf;
          content.innerHTML = renderMarkdown(buf);
          initHighlight();
          // Skip postRender during streaming
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      }
    }
    target.classList.remove('streaming');
    delete target._streamBuf;
    await loadSessions();
  } catch (err) {
    target.classList.remove('streaming');
    if (err && err.name === 'AbortError') {
      if (content) content.innerHTML = renderMarkdown(content.textContent || '');
    } else {
      addBubble('\u26A0\uFE0F Continue failed: ' + err.message, 'error');
    }
  } finally {
    isSending = false;
    activeController = null;
    setStreamingUI(false);
    btn.disabled = false;
    userInput.focus();
  }
}

function beginEdit(bubble) {
  if (!currentSessionId || !bubble.dataset.id) return;
  if (bubble.classList.contains('editing')) return;
  bubble.classList.add('editing');
  const content = bubble.querySelector('.msg-content');
  if (!content) return;
  const original = content.textContent;
  const ta = document.createElement('textarea');
  ta.className = 'msg-edit-input';
  ta.value = original;
  ta.rows = Math.min(8, original.split('\n').length + 1);
  content.replaceWith(ta);
  ta.focus();
  ta.setSelectionRange(original.length, original.length);

  const restore = (newText) => {
    const newContent = document.createElement('div');
    newContent.className = 'msg-content';
    newContent.textContent = newText;
    ta.replaceWith(newContent);
    bubble.classList.remove('editing');
  };

  const save = async () => {
    const newText = ta.value;
    if (newText === original) { restore(newText); return; }
    try {
      await fetch('/api/sessions/' + encodeURIComponent(currentSessionId) + '/messages/' + encodeURIComponent(bubble.dataset.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newText }),
      });
      restore(newText);
      await loadSessions();
    } catch (err) {
      console.error('Edit failed:', err);
      restore(original);
    }
  };

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); restore(original); }
  });
  ta.addEventListener('blur', () => { if (bubble.classList.contains('editing')) save(); });
}

// ── Export conversation as Markdown ────────────────────────────────
function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeFilename(s) {
  return (s || 'chat').replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 60);
}

function exportAsMarkdown(session) {
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
  return lines.join('\n');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function exportAsHtml(session) {
  const title = escapeHtml(session.title || 'Chat export');
  const sp = escapeHtml(session.system_prompt || '');
  let body = '';
  for (const m of (session.messages || [])) {
    const role = m.role === 'user' ? 'user' : 'assistant';
    const time = m.created_at ? new Date(m.created_at).toISOString() : '';
    const tk = m.tokens ? ' <span class="tok">[' + m.tokens + ' tok]</span>' : '';
    const content = m.content
      .split('\n\n').map(p => '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>').join('');
    body += '<div class="msg ' + role + '"><div class="role">' + role + (time ? ' <span class="time">' + time + '</span>' : '') + tk + '</div><div class="content">' + content + '</div></div>';
  }
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
body { font: 14px/1.5 -apple-system, Segoe UI, sans-serif; max-width: 720px; margin: 2em auto; padding: 0 1em; background: #fafafa; color: #222; }
h1 { border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
.system { background: #f3f0ff; border-left: 3px solid #7c5cff; padding: 0.6em 1em; margin: 1em 0; color: #444; font-style: italic; }
.msg { background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; margin: 1em 0; padding: 0.8em 1em; }
.msg.user { background: #f5f1ff; }
.role { font-weight: 600; text-transform: capitalize; color: #555; font-size: 12px; margin-bottom: 0.5em; }
.role .time { font-weight: 400; color: #999; }
.role .tok { font-weight: 400; color: #888; font-size: 11px; }
.content p { margin: 0.3em 0; white-space: pre-wrap; word-wrap: break-word; }
.meta { color: #999; font-size: 11px; }
</style></head><body>
<h1>${title}</h1>
<p class="meta">Exported ${new Date().toISOString()}</p>
<div class="system"><strong>System prompt:</strong> ${sp}</div>
${body}
</body></html>`;
}

function exportConversation() {
  if (!currentSessionId) return;
  fetch('/api/sessions/' + encodeURIComponent(currentSessionId))
    .then(r => r.json())
    .then(session => {
      const format = window.prompt('Export format: md / html / json', 'md');
      if (!format) return;
      const f = format.toLowerCase();
      const base = safeFilename(session.title);
      if (f === 'md' || f === 'markdown') {
        downloadFile(base + '.md', exportAsMarkdown(session), 'text/markdown');
      } else if (f === 'html') {
        downloadFile(base + '.html', exportAsHtml(session), 'text/html');
      } else if (f === 'json') {
        downloadFile(base + '.json', JSON.stringify(session, null, 2), 'application/json');
      } else {
        window.alert('Unknown format: ' + format + '. Use md, html, or json.');
      }
    })
    .catch(err => console.error('Export failed:', err));
}

// Share via static link: writes the current session to data/shared/<id>.json
// and returns a relative URL anyone with server access can fetch as read-only JSON
async function shareSession() {
  if (!currentSessionId) return;
  try {
    const r = await fetch('/api/sessions/' + encodeURIComponent(currentSessionId) + '/share', { method: 'POST' });
    if (!r.ok) { window.alert('Share failed: HTTP ' + r.status); return; }
    const data = await r.json();
    const url = window.location.origin + data.url;
    try { await navigator.clipboard.writeText(url); } catch (_) {}
    window.prompt('Shareable link (copied to clipboard if allowed):', url);
  } catch (err) { window.alert('Share failed: ' + err.message); }
}

async function importConversation(text) {
  // Try to detect ChatGPT, Claude, or generic JSON
  let sessionData;
  try {
    const parsed = JSON.parse(text);
    sessionData = parseImport(parsed);
  } catch (e) {
    window.alert('Import error: not valid JSON. ' + e.message);
    return;
  }
  if (!sessionData) { window.alert('Could not detect any chat format in the file.'); return; }
  try {
    const r = await fetch('/api/sessions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData),
    });
    if (!r.ok) { window.alert('Import failed: HTTP ' + r.status); return; }
    const s = await r.json();
    await loadSessions();
    await switchSession(s.id);
    window.alert('Imported as "' + s.title + '"');
  } catch (err) { window.alert('Import failed: ' + err.message); }
}

function parseImport(obj) {
  // ChatGPT export: { title, mapping: { nodeId: { message: { author: {role}, content: {parts:[]}, create_time } } } }
  if (obj && obj.mapping && typeof obj.mapping === 'object') {
    const messages = [];
    const byId = obj.mapping;
    // BFS from root
    const roots = Object.values(byId).filter(n => !n.parent || n.parent === null || !byId[n.parent]);
    let order = roots;
    for (const r of order) {
      const walk = (n) => {
        if (n.message && n.message.content && n.message.content.parts) {
          const role = n.message.author && n.message.author.role;
          if (role === 'user' || role === 'assistant') {
            const content = (n.message.content.parts || []).filter(p => typeof p === 'string').join('\n');
            if (content.trim()) {
              messages.push({
                role,
                content,
                created_at: (n.message.create_time || 0) * 1000,
              });
            }
          }
        }
        if (n.children && n.children.length) for (const c of n.children) walk(byId[c]);
      };
      walk(r);
    }
    return {
      title: obj.title || 'Imported ChatGPT',
      messages,
    };
  }
  // Claude.ai export: { chat_messages: [{ sender: "human"|"assistant", text, created_at }] } or { messages: [...] }
  if (obj && Array.isArray(obj.chat_messages)) {
    return {
      title: obj.name || 'Imported Claude',
      messages: obj.chat_messages.map(m => ({
        role: m.sender === 'human' ? 'user' : 'assistant',
        content: m.text || '',
        created_at: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
      })),
    };
  }
  // Generic chatbot-app format
  if (obj && Array.isArray(obj.messages)) {
    return {
      title: obj.title || 'Imported session',
      system_prompt: obj.system_prompt,
      model: obj.model,
      messages: obj.messages.map(m => ({
        role: m.role,
        content: m.content || '',
        created_at: m.created_at || Date.now(),
      })),
    };
  }
  // Bare array
  if (Array.isArray(obj)) {
    return {
      title: 'Imported session',
      messages: obj.map(m => ({
        role: m.role,
        content: m.content || m.text || '',
        created_at: m.created_at || Date.now(),
      })),
    };
  }
  return null;
}

if (exportBtn) exportBtn.addEventListener('click', exportConversation);
if (shareBtn) shareBtn.addEventListener('click', shareSession);
if (importBtn) {
  importBtn.addEventListener('click', () => importFile.click());
}
if (importFile) {
  importFile.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      await importConversation(text);
    } catch (err) {
      window.alert('Could not read file: ' + err.message);
    } finally {
      importFile.value = ''; // reset so the same file can be picked again
    }
  });
}

// ── Slash commands + command palette ───────────────────────────────
const paletteBackdrop = document.getElementById('paletteBackdrop');
const paletteInput = document.getElementById('paletteInput');
const paletteList = document.getElementById('paletteList');
const shortcutsBackdrop = document.getElementById('shortcutsBackdrop');
const shortcutsClose = document.getElementById('shortcutsClose');
const slashMenu = document.getElementById('slashMenu');

const COMMANDS = [
  { cmd: '/help', name: 'Show slash command help', run: () => sendCommandMessage('Available commands:\n' + COMMANDS.map(c => c.cmd + ' — ' + c.name).join('\n')) },
  { cmd: '/new', name: 'Start a new chat', run: () => createNewSession() },
  { cmd: '/clear', name: 'Clear the current chat', run: async () => { if (currentSessionId) await deleteSession(currentSessionId); } },
  { cmd: '/rename', name: 'Rename the current chat', run: () => {
      if (!currentSessionId) return;
      const li = document.querySelector('.session-item.active');
      const titleBtn = li && li.querySelector('.session-title');
      if (titleBtn) beginRename(li, titleBtn, currentSessionId);
    } },
  { cmd: '/export', name: 'Export current chat (md/html/json)', run: () => exportConversation() },
  { cmd: '/share', name: 'Share current chat as a static link', run: () => shareSession() },
  { cmd: '/import', name: 'Open the file picker to import a chat', run: () => importFile && importFile.click() },
  { cmd: '/theme', name: 'Toggle dark/light theme', run: () => { const t = document.documentElement.getAttribute('data-theme') || 'dark'; applyTheme(t === 'dark' ? 'light' : 'dark'); saveSettings(); } },
  { cmd: '/settings', name: 'Open settings panel', run: () => settingsPanel.classList.toggle('open') },
  { cmd: '/shortcuts', name: 'Show keyboard shortcuts', run: () => openShortcuts() },
  { cmd: '/model', name: 'Cycle to next model', run: () => {
      if (!modelSelect.options.length) return;
      modelSelect.selectedIndex = (modelSelect.selectedIndex + 1) % modelSelect.options.length;
      saveSettings();
    } },
  { cmd: '/memory', name: 'Show all long-term memories', run: async () => {
      const data = await loadMemory();
      if (!data.facts.length) { sendCommandMessage('No memories yet.'); return; }
      const list = data.facts.map((f, i) => (i + 1) + '. ' + f.text).join('\n');
      sendCommandMessage('Long-term memory:\n' + list);
    } },
  { cmd: '/remember', name: 'Add a fact to long-term memory (e.g. /remember I prefer dark mode)', run: async (text) => {
      const fact = text.replace(/^\/remember\s+/i, '').trim();
      if (!fact) { sendCommandMessage('Usage: /remember <fact>'); return; }
      const r = await fetch('/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: fact }) });
      const d = await r.json();
      if (d.error) { sendCommandMessage('Error: ' + d.error); return; }
      if (d.duplicate) { sendCommandMessage('Already remembered: ' + fact); return; }
      sendCommandMessage('\u2713 Remembered: ' + fact);
      renderMemory();
    } },
  { cmd: '/forget', name: 'Forget a fact (e.g. /forget 1) or clear all', run: async (text) => {
      const arg = text.replace(/^\/forget\s+/i, '').trim();
      if (!arg) { sendCommandMessage('Usage: /forget <index> or /forget all'); return; }
      if (arg.toLowerCase() === 'all') {
        if (!confirm('Clear all memories?')) return;
        await fetch('/api/memory/clear', { method: 'POST' });
        sendCommandMessage('All memories cleared.');
        renderMemory();
        return;
      }
      const idx = parseInt(arg, 10) - 1;
      if (Number.isNaN(idx)) { sendCommandMessage('Invalid index.'); return; }
      const r = await fetch('/api/memory/' + idx, { method: 'DELETE' });
      if (!r.ok) { sendCommandMessage('Failed to forget.'); return; }
      sendCommandMessage('Forgotten #' + (idx + 1));
      renderMemory();
    } },
  { cmd: '/template', name: 'Apply a template by name (e.g. /template tutor)', run: async (text) => {
      const arg = text.replace(/^\/template\s+/i, '').trim();
      if (!arg) { sendCommandMessage('Usage: /template <name>'); return; }
      try {
        const r = await fetch('/api/templates');
        const list = await r.json();
        const found = list.find(t => t.id === arg || t.name.toLowerCase().includes(arg.toLowerCase()));
        if (!found) { sendCommandMessage('No template matching: ' + arg); return; }
        systemPromptEl.value = found.system_prompt;
        if (templateSelect) {
          const opt = Array.from(templateSelect.options).find(o => o.value === found.id);
          if (opt) {
            templateSelect.value = found.id;
            if (templateNote) templateNote.textContent = found.description || '';
          }
        }
        saveSettings();
        sendCommandMessage('\u2713 Template applied: ' + found.name);
      } catch (err) { sendCommandMessage('Template apply failed: ' + err.message); }
    } },
];

async function sendCommandMessage(text) {
  if (!currentSessionId) await createNewSession();
  addBubble(text, 'user', Date.now(), false);
  // Commands don't get sent to the LLM — we just display them.
  // The user can see the response inline.
}

let paletteActiveIdx = 0;
let paletteMatches = [];

function openPalette() {
  paletteBackdrop.classList.remove('hidden');
  paletteInput.value = '';
  paletteInput.focus();
  renderPalette('');
}
function closePalette() {
  paletteBackdrop.classList.add('hidden');
  paletteInput.value = '';
}
function renderPalette(q) {
  paletteMatches = COMMANDS.filter(c => !q || c.cmd.toLowerCase().includes(q.toLowerCase()) || c.name.toLowerCase().includes(q.toLowerCase()));
  paletteActiveIdx = 0;
  paletteList.innerHTML = '';
  for (let i = 0; i < paletteMatches.length; i++) {
    const c = paletteMatches[i];
    const li = document.createElement('li');
    li.className = i === 0 ? 'active' : '';
    li.innerHTML = '<span class="cmd-name">' + c.cmd + '</span><span class="cmd-desc">' + c.name + '</span>';
    li.addEventListener('click', () => { c.run(); closePalette(); });
    paletteList.appendChild(li);
  }
  if (paletteMatches.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No matching commands';
    li.style.color = 'var(--text-muted)';
    li.style.cursor = 'default';
    paletteList.appendChild(li);
  }
}
paletteInput.addEventListener('input', () => renderPalette(paletteInput.value));
paletteInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    paletteActiveIdx = Math.min(paletteActiveIdx + 1, paletteMatches.length - 1);
    updatePaletteActive();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    paletteActiveIdx = Math.max(paletteActiveIdx - 1, 0);
    updatePaletteActive();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (paletteMatches[paletteActiveIdx]) {
      paletteMatches[paletteActiveIdx].run();
      closePalette();
    }
  }
});
function updatePaletteActive() {
  Array.from(paletteList.children).forEach((li, i) => {
    li.classList.toggle('active', i === paletteActiveIdx);
  });
  const active = paletteList.children[paletteActiveIdx];
  if (active) active.scrollIntoView({ block: 'nearest' });
}
paletteBackdrop.addEventListener('click', (e) => { if (e.target === paletteBackdrop) closePalette(); });

function openShortcuts() { shortcutsBackdrop.classList.remove('hidden'); }
function closeShortcuts() { shortcutsBackdrop.classList.add('hidden'); }
shortcutsClose.addEventListener('click', closeShortcuts);
shortcutsBackdrop.addEventListener('click', (e) => { if (e.target === shortcutsBackdrop) closeShortcuts(); });

// ── Slash command autocomplete menu ────────────────────────────────
let slashMatches = [];
let slashActiveIdx = 0;
function showSlashMenu(filter) {
  slashMatches = COMMANDS.filter(c => c.cmd.toLowerCase().startsWith(filter.toLowerCase()));
  if (slashMatches.length === 0) { hideSlashMenu(); return; }
  slashActiveIdx = 0;
  slashMenu.innerHTML = '';
  for (let i = 0; i < slashMatches.length; i++) {
    const c = slashMatches[i];
    const li = document.createElement('li');
    li.className = 'slash-item' + (i === 0 ? ' active' : '');
    li.innerHTML = '<span class="name">' + c.cmd + '</span><span class="desc">' + c.name + '</span>';
    li.addEventListener('mousedown', (e) => { e.preventDefault(); applySlash(c.cmd); });
    slashMenu.appendChild(li);
  }
  slashMenu.classList.remove('hidden');
}
function hideSlashMenu() { slashMenu.classList.add('hidden'); slashMatches = []; }
function moveSlashSelection(delta) {
  if (!slashMatches.length) return;
  slashActiveIdx = (slashActiveIdx + delta + slashMatches.length) % slashMatches.length;
  Array.from(slashMenu.children).forEach((li, i) => li.classList.toggle('active', i === slashActiveIdx));
}
function selectActiveSlash() {
  if (slashMatches[slashActiveIdx]) applySlash(slashMatches[slashActiveIdx].cmd);
}
function applySlash(cmd) {
  userInput.value = cmd + ' ';
  userInput.focus();
  hideSlashMenu();
}
userInput.addEventListener('input', () => {
  const val = userInput.value;
  if (val.startsWith('/') && !val.includes(' ') && val.length < 30) {
    showSlashMenu(val);
  } else {
    hideSlashMenu();
  }
});
// Hide slash menu when the input loses focus (unless clicking the menu)
userInput.addEventListener('blur', () => { setTimeout(() => hideSlashMenu(), 150); });
slashMenu.addEventListener('mousedown', (e) => e.preventDefault());

// ── Init ────────────────────────────────────────────────────────────
(async function init() {
  await loadModels();
  // If no theme set yet, follow OS preference
  if (!document.documentElement.getAttribute('data-theme')) {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(prefersLight ? 'light' : 'dark');
  }
  loadSettings();
  updateParamDisplays();
  await loadSessions();
  const lastId = localStorage.getItem(STORAGE_KEY);
  if (lastId && sessions.find(s => s.id === lastId)) {
    await switchSession(lastId);
  }
  await renderMemory();
  await loadBlocklist();
  // Register service worker (PWA shell caching) if available
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); }
    catch (err) { console.warn('SW registration failed:', err); }
  }
  await loadTemplates();
  updateCharCounter();
})();
