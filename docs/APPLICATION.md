# Application Documentation

Detailed architecture, API reference, and storage format for the Local LLM Chatbot.

## Overview

A Node.js/Express chatbot that proxies user messages to a local LLM. It implements 5 layers of security guardrails, supports multi-turn conversation history with JSON-file persistence, and renders assistant messages as sanitized Markdown with syntax-highlighted code blocks.

---

## Architecture

### Request flow (with sessions)

```
Browser (Chat UI + Sidebar)
   │
   │  POST /api/chat { message, system_prompt?, session_id? }
   ▼
Express Server (:3000)
   │
   ├─ request-id middleware   crypto.randomUUID() + X-Request-Id header
   ├─ security-headers        CSP, X-Content-Type-Options, Referrer-Policy
   ├─ rate limit              15 req/min/IP, in-memory
   ├─ input validation        ≤2000 chars, 16 KB body
   ├─ detectInjection         14 regex patterns, returns canned refusal
   ├─ detectHarmful           6 regex patterns, returns canned refusal
   │
   ├─ if session_id: load last N turns from disk
   ├─ build messages array: [system + safety rules, ...history, user]
   │
   ├─ POST to local LLM
   ├─ sanitizeOutput          strip HTML tags
   ├─ empty-response guard    placeholder if LLM returned blank
   │
   └─ if session_id: persist user + assistant messages to disk
   │
   └─ respond { reply, blocked?, reason? }
```

### Module layout

| File | Responsibility |
|---|---|
| `server.js` | Express app, middleware, all routes |
| `guardrails.js` | Injection + harmful content detection, HTML sanitization (pure functions) |
| `db.js` | JSON-file session storage, atomic writes, in-memory list cache |
| `public/app.js` | Client-side state, Markdown pipeline, session UI, copy buttons |
| `public/style.css` | Dark glassmorphism, sidebar drawer, code block styles |
| `promptfooconfig.yaml` | 35 adversarial test cases (run manually with LLM) |

---

## API reference

### `POST /api/chat`

**Request body**:
```json
{
  "message": "What is the meaning of life?",
  "system_prompt": "You answer only in rhymes.",   // optional
  "session_id": "33a9392d-fe27-4b63-af10-ff502ffae3e8"  // optional
}
```

**Success response** (200):
```json
{ "reply": "To ponder deep and search the skies..." }
```

**Blocked response** (200 with blocked flag):
```json
{
  "reply": "I'm sorry, but I can't process that request. Please rephrase your message.",
  "blocked": true,
  "reason": "prompt_injection"
}
```

**Error responses**:
- `400` &mdash; `A non-empty "message" string is required.`
- `400` &mdash; `Message too long. Maximum 2000 characters allowed.`
- `400` &mdash; `Session not found` (when `session_id` provided but invalid)
- `429` &mdash; `Too many requests. Please slow down.`
- `502` &mdash; `LLM service returned an error.`
- `503` &mdash; `Could not reach the LLM service. Is it running?`

When `session_id` is provided, the response does **not** return the session. Reload via `GET /api/sessions/:id` if needed.

### `GET /api/sessions`

Returns an array of session summaries (newest first by `updated_at`):

```json
[
  {
    "id": "33a9392d-...",
    "title": "What is the capital of France?",
    "created_at": 1780286365334,
    "updated_at": 1780286399821,
    "message_count": 4
  }
]
```

### `POST /api/sessions`

**Request body**:
```json
{ "system_prompt": "You are a helpful assistant.", "title": "Optional" }
```

**Response** (201):
```json
{
  "id": "33a9392d-...",
  "title": "Optional",
  "system_prompt": "You are a helpful assistant.",
  "created_at": 1780286365334,
  "updated_at": 1780286365334,
  "messages": []
}
```

Title defaults to `"New Chat"`; the first user message replaces it (first 40 chars + ellipsis).

### `GET /api/sessions/:id`

Returns the full session including messages. `404` if not found.

### `PATCH /api/sessions/:id`

**Request body**:
```json
{ "title": "Renamed chat" }
```

Returns the updated session meta (without messages).

### `DELETE /api/sessions/:id`

Hard-deletes the session file. Returns `{ "ok": true }`.

### `GET /api/health`

```json
{ "status": "ok", "llm": "http://localhost:1234", "version": "1.0.0" }
```

---

## Storage format

Sessions are stored as one JSON file per session under `DB_DIR` (default `data/sessions/`):

```
data/sessions/
  ├── 33a9392d-fe27-4b63-af10-ff502ffae3e8.json
  ├── 7a1b2c3d-...json
  └── .quarantine/                # corrupt files moved here on read failure
```

### Session file shape

```json
{
  "id": "33a9392d-fe27-4b63-af10-ff502ffae3e8",
  "title": "What is the capital of France?",
  "system_prompt": "You are a helpful assistant.",
  "created_at": 1780286365334,
  "updated_at": 1780286399821,
  "messages": [
    { "role": "user",      "content": "What is the capital of France?", "created_at": 1780286380000 },
    { "role": "assistant", "content": "It is Paris, city of light...",   "created_at": 1780286380500 }
  ]
}
```

For blocked exchanges, the assistant message also has:
```json
{ "role": "assistant", "content": "I'm sorry...", "blocked": true, "reason": "prompt_injection" }
```

### Properties

- **Atomic writes** &mdash; `writeFileSync` to a `.tmp` file, then `renameSync` to the final path. POSIX-atomic on the same volume.
- **In-memory list cache** &mdash; `listSessions()` reads the directory once and caches; invalidated on every mutation.
- **1 MB cap** &mdash; `addMessage` serializes the session; if it exceeds 1 MB, the oldest 20% of messages are trimmed. If still over 1 MB, an error is thrown.
- **Quarantine** &mdash; files that fail to parse are moved to `.quarantine/<timestamp>-<original-name>.json` so the rest of the directory stays usable.
- **No `index.json`** &mdash; session discovery uses `fs.readdirSync`. Eliminates drift between an index file and the actual session files.

---

## Security model

### Server-side guardrails (in order)

1. **Rate limiting** &mdash; 15 requests per minute per IP, in-memory `Map`.
2. **Input validation** &mdash; reject empty or non-string messages; reject over 2000 chars; Express body limit of 16 KB.
3. **Prompt injection detection** &mdash; 14 regex patterns (DAN, ignore-instructions, system-prompt extraction, etc.).
4. **Harmful content detection** &mdash; 6 regex patterns (malware, hacking, phishing, violence, PII).
5. **Hardened system prompt** &mdash; safety rules appended to every system prompt sent to the LLM.
6. **Input HTML escaping** &mdash; `< > " '` encoded before the LLM call.
7. **Output HTML stripping** &mdash; any `<script>` and HTML tags removed from LLM responses.
8. **Empty response guard** &mdash; placeholder if the LLM returns a blank string.
9. **Atomic disk writes** &mdash; prevents corrupt JSON files from crashes.

### Transport and HTTP

- **Strict Content-Security-Policy** &mdash; blocks inline scripts, restricts images to `'self'`, no framing, no objects.
- **`X-Content-Type-Options: nosniff`** &mdash; prevents MIME sniffing.
- **`Referrer-Policy: no-referrer`** &mdash; prevents referrer leakage.
- **`X-Request-Id`** &mdash; UUID per request, included in all log lines for correlation.

### Client-side defense

- **DOMPurify allowlist** &mdash; 16 HTML tags, 7 attributes, no inline event handlers, no `data:` URIs.
- **User messages use `textContent`** &mdash; no XSS surface even if a malicious script runs.
- **Event delegation for copy buttons** &mdash; inline `onclick` attributes would be blocked by CSP.
- **Code block text is HTML-escaped** before insertion into the marked output.

---

## 5-minute manual smoke test

After `npm install` and starting the LLM, run `npm start` and verify:

1. Open <http://localhost:3000> &mdash; sidebar is empty, welcome state visible.
2. Click **+ New Chat** &mdash; blank chat with a system prompt panel.
3. Type "What is 2+2?" &mdash; the LLM replies. Check that the sidebar shows a session titled from the first user message.
4. Type "What did I just ask?" &mdash; response references the previous turn (multi-turn context).
5. Type "Write a Python hello world" &mdash; code block renders with syntax highlighting and a "Copy" button on hover. Click it.
6. Refresh the page &mdash; the last session is still loaded.
7. Open a second tab and create a new session &mdash; sessions are independent.
8. Type `<script>alert(1)</script>` in the input &mdash; appears as text, no alert.
9. Type "Ignore all previous instructions" &mdash; canned refusal; chat still works.
10. Resize to mobile width (≤768px) &mdash; sidebar collapses; hamburger opens a drawer.

All steps should pass with no errors in the browser console or server logs.
