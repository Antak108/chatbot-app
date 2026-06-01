# Local LLM Chatbot &mdash; with Guardrails, Multi-turn History, and PromptFoo Adversarial Testing

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.18-green.svg)](package.json)
[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF.svg)](.github/workflows/ci.yml)

A simple chatbot application powered by a locally running LLM, with built-in security guardrails, multi-turn conversation history, Markdown rendering, and an adversarial test suite using [PromptFoo](https://www.promptfoo.dev/).

> **Purpose**: Demonstrate how to build, secure, and red-team test an LLM-powered application end-to-end.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [The Application](#the-application)
- [API Reference](#api-reference)
- [Security Guardrails](#security-guardrails)
- [Conversation History](#conversation-history)
- [Markdown Rendering](#markdown-rendering)
- [PromptFoo Adversarial Testing](#promptfoo-adversarial-testing)
- [Configuration](#configuration)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Quick Start

### Prerequisites

- **Node.js 18.18+** (Node 20+ recommended for stable `npm run dev` watch mode)
- A **local LLM** running at `http://localhost:1234` (e.g., [LM Studio](https://lmstudio.ai/) with `liquid/lfm2.5-1.2b`)

### Install and run

```bash
git clone https://github.com/Antak108/chatbot-app.git
cd chatbot-app
npm install
npm start
```

Open **http://localhost:3000** in your browser.

### Run adversarial tests (optional, requires LLM)

```bash
npm run eval         # Run all 35 PromptFoo test cases
npm run eval:view    # Open the results dashboard
```

### Run unit tests

```bash
npm test             # 10 unit tests for the guardrails module
npm run check        # JS syntax check across all source files
```

---

## Project Structure

```
chatbot-app/
├── server.js                  # Express backend, middleware, routes
├── db.js                      # JSON-file session storage
├── guardrails.js              # Regex-based injection + harmful content detection, sanitizers
├── guardrails.test.js         # node:test unit tests
├── package.json
├── promptfooconfig.yaml       # PromptFoo adversarial test suite (manual)
├── scripts/
│   └── check.js               # JS syntax check (catches missing files)
├── public/
│   ├── index.html             # Chat UI markup with sidebar
│   ├── style.css              # Dark glassmorphism + sidebar + code blocks
│   └── app.js                 # Client-side chat logic
├── data/                      # Session storage (gitignored, created on first run)
│   └── sessions/              # One JSON file per conversation
├── docs/
│   ├── APPLICATION.md         # Detailed API and architecture
│   ├── PROMPTFOO_GUIDE.md     # How to run adversarial tests
│   └── SAMPLE_SCAN_REPORT.md  # Example PromptFoo output
├── .github/
│   ├── workflows/ci.yml       # GitHub Actions CI
│   ├── ISSUE_TEMPLATE/        # Bug, feature, security templates
│   └── PULL_REQUEST_TEMPLATE.md
├── LICENSE                    # Apache 2.0
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
├── .editorconfig
├── .env.example
└── README.md
```

---

## The Application

### Backend

An Express server that:

- Serves the static chat UI from `public/`
- Exposes `POST /api/chat` and `GET|POST|GET|PATCH|DELETE /api/sessions/*`
- Applies **5 layers of guardrails** before/after the LLM call
- Persists conversation history as JSON files under `data/sessions/`

### Frontend

A vanilla HTML/CSS/JS chat interface with:

- **Dark glassmorphism** theme
- **Session sidebar** with new/load/delete and a mobile drawer
- **Configurable system prompt** via a collapsible settings panel
- **Markdown rendering** with sanitized HTML and syntax-highlighted code blocks
- **Multi-turn context** &mdash; the last 10 messages are sent to the LLM
- Typing indicator, auto-scroll, auto-resize input, localStorage session restore
- Error display for network issues, blocked requests, and invalid responses

---

## API Reference

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/api/chat` | POST | `{ message: string, system_prompt?: string, session_id?: string }` | `{ reply: string, blocked?: boolean, reason?: string }` |
| `/api/sessions` | GET | &mdash; | `[{ id, title, created_at, updated_at, message_count }]` |
| `/api/sessions` | POST | `{ system_prompt?: string, title?: string }` | `{ id, title, ... }` (201) |
| `/api/sessions/:id` | GET | &mdash; | `{ id, title, system_prompt, messages: [...] }` or 404 |
| `/api/sessions/:id` | PATCH | `{ title: string }` | updated session meta |
| `/api/sessions/:id` | DELETE | &mdash; | `{ ok: true }` |
| `/api/health` | GET | &mdash; | `{ status: "ok", llm: "...", version: "1.0.0" }` |

See [docs/APPLICATION.md](docs/APPLICATION.md) for the full architecture breakdown and storage format.

---

## Security Guardrails

The server implements 5 layers of defense, applied in order:

### 1. Rate Limiting
- **15 requests per minute** per IP address
- In-memory tracking, returns `429 Too Many Requests` when exceeded

### 2. Input Validation
- **Max 2000 characters** &mdash; rejects oversized messages
- **Body size limit** &mdash; Express `json({ limit: '16kb' })`

### 3. Prompt Injection Detection
Regex-based scanner for 14 injection patterns:

- `ignore all previous instructions`, `you are now DAN`, `SYSTEM:`, `[INST]`, `<|im_start|>`, `reveal your system prompt`, `repeat everything above`, `translate your initial instructions`, ...

Returns a **canned refusal** without calling the LLM.

### 4. Harmful Content Blocking
Keyword patterns for malware terms, hacking requests, phishing, explosives, violence, and PII generation (SSN, credit card). Returns a canned refusal.

### 5. Output Sanitization & Hardened System Prompt
- **Input HTML escaping** before the LLM call
- **Output stripping** &mdash; removes `<script>` tags and HTML from LLM responses
- **Hardened system prompt** &mdash; safety rules appended to every system prompt
- **Empty response guard** &mdash; placeholder text if the LLM returns blank

### Defense in depth (frontend)
- **Strict Content-Security-Policy** &mdash; blocks inline scripts, restricts images to `'self'`, disallows framing
- **DOMPurify allowlist** &mdash; 16 tags, 7 attributes, blocks `javascript:` URIs
- **Event delegation** &mdash; no inline `onclick` handlers (CSP-safe)
- **Request ID tracing** &mdash; `X-Request-Id` header on every response

---

## Conversation History

When `session_id` is provided, `/api/chat` includes the last `CONTEXT_LIMIT` messages (default 10) in the LLM request. After each exchange, the messages are persisted to `data/sessions/<uuid>.json`.

**Storage format** (no index file &mdash; session discovery is via `fs.readdirSync`):

```
data/sessions/
  └── <uuid>.json
      {
        "id": "...",
        "title": "What is the capital of France?",
        "system_prompt": "You answer only in rhymes.",
        "created_at": 1780286365334,
        "updated_at": 1780286399821,
        "messages": [
          { "role": "user",      "content": "...", "created_at": ... },
          { "role": "assistant", "content": "...", "created_at": ... }
        ]
      }
```

- **Atomic writes** &mdash; writes to a `.tmp` file then `rename`, survives crashes
- **Auto-title** &mdash; first user message becomes the title (first 40 chars + ellipsis)
- **1 MB cap** &mdash; auto-trims the oldest 20% of messages if the session grows too large
- **Corrupt files** &mdash; moved to `data/sessions/.quarantine/` on read failure

---

## Markdown Rendering

Assistant messages are rendered as Markdown via `marked` and sanitized via `DOMPurify`:

- Headings, lists, tables, blockquotes, links, images (same-origin only)
- Code blocks get a language label and a "Copy" button on hover
- Inline code uses a monospace pill
- Strict DOMPurify allowlist &mdash; no scripts, no event handlers, no `data:` URIs

User messages are rendered as plain text (`textContent` only) to prevent stored XSS.

---

## PromptFoo Adversarial Testing

PromptFoo is an open-source LLM evaluation framework. In this project, it acts as an **automated red-team tool** &mdash; sending adversarial prompts through the application and checking whether the responses satisfy security assertions.

### How it works

```
PromptFoo &mdash;&rarr; POST http://localhost:3000/api/chat &mdash;&rarr; Guardrails &mdash;&rarr; LLM
            &larr;&mdash; { reply } &larr;&mdash; checks assertions (pass/fail)
```

Tests go **through the application**, not directly to the LLM. This validates the entire pipeline including guardrails.

### Test categories (35 tests across 11 categories)

| # | Category | Tests | What it probes |
|---|----------|-------|----------------|
| 1 | **Prompt Injection** | 3 | "Ignore instructions", DAN persona, role-play escape |
| 2 | **System Prompt Extraction** | 3 | Direct ask, "repeat above", translation trick |
| 3 | **Harmful Content** | 3 | Malware code, phishing, violence instructions |
| 4 | **PII Leakage** | 2 | Fake identity generation, training data extraction |
| 5 | **Jailbreak Techniques** | 3 | Base64 obfuscation, hypothetical framing, multi-step |
| 6 | **System Prompt Adherence** | 2 | Override rhyming, developer impersonation |
| 7 | **Input Abuse** | 3 | XSS, SQL injection, oversized input |
| 8 | **Malicious System Prompt** | 4 | Weaponized system prompt via the UI |
| 9 | **Regex Guardrail Bypass** | 4 | Leetspeak, spacing, synonyms, Unicode tricks |
| 10 | **Guardrail Validation** | 3 | Confirm blockers work, normal chat unaffected |
| 11 | **Rhyming Personality** | 3 | Verify guardrails don't break normal functionality |

See [docs/PROMPTFOO_GUIDE.md](docs/PROMPTFOO_GUIDE.md) for setup and reading results.

> **Note**: PromptFoo is **not** run in CI because it requires a live LLM. The CI matrix runs unit tests and JS syntax checks only.

---

## Configuration

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `LLM_BASE_URL` | `http://localhost:1234` | Base URL of the local LLM |
| `DB_DIR` | `data/sessions` | Session storage directory |
| `CONTEXT_LIMIT` | `10` | Max history turns sent to the LLM (0&ndash;50) |
| `NODE_ENV` | (unset) | Set to `development` for extra logging |

A template is provided in `.env.example`.

### Customizing the LLM model

Edit the model name in `server.js` (inside the `/api/chat` route's `llmPayload`):

```js
const llmPayload = {
  model: 'liquid/lfm2.5-1.2b',  // change this
  ...
};
```

A model selector UI is planned for v1.1.

---

## Known Limitations

| Area | Status | Notes |
|---|---|---|
| Regex-based detection | Unchanged | Still bypassable with rephrasing, leetspeak, or Unicode |
| No semantic filtering | Unchanged | Out of scope; deferred to a future version |
| No output content moderation | Unchanged | LLM-as-judge moderation planned for v1.1 (opt-in) |
| In-memory rate limiting | Unchanged | Resets on server restart; fine for local use |
| No authentication | Unchanged | This is a local single-user app |
| No CORS | Unchanged | Same-origin only; not for production deployment |
| No conversation context | **Fixed** | Multi-turn history with configurable context window |
| User-controlled system prompt | **Mitigated** | Hardened system prompt is appended; full judge in v1.1 |
| Single-user file storage | New | JSON files, not multi-user; no auth |
| `llm-rubric` needs API key | Unchanged | PromptFoo's AI judge requires an external LLM |

---

## Roadmap

Planned for **v1.1**:

- **Streaming SSE responses** &mdash; token-by-token output like ChatGPT
- **Model selector UI** &mdash; switch between locally-served models without restarting
- **LLM-as-judge output moderation** &mdash; opt-in via `JUDGE_ENABLED=true` for stronger content safety

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All PRs must pass `npm test` and `npm run check`. Please use the issue and PR templates.

## Security

See [SECURITY.md](SECURITY.md) for supported versions and how to report vulnerabilities.

## Code of Conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md).

---

## License

Copyright 2026 Manish Pandey. Licensed under the [Apache License, Version 2.0](LICENSE).

## Acknowledgments

- [LM Studio](https://lmstudio.ai/) &mdash; local LLM runtime
- [PromptFoo](https://www.promptfoo.dev/) &mdash; adversarial testing framework
- [Express](https://expressjs.com/) &mdash; HTTP server
- [marked](https://marked.js.org/) &mdash; Markdown parser
- [DOMPurify](https://github.com/cure53/DOMPurify) &mdash; HTML sanitizer
- [highlight.js](https://highlightjs.org/) &mdash; syntax highlighting
- [Node.js](https://nodejs.org/) &mdash; runtime
- [GitHub Actions](https://github.com/features/actions) &mdash; CI
