# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-06-01

### Added
- Server-Sent Events streaming for `/api/chat` and `/api/chat/continue` with
  an AbortController-driven Stop button; partial bubbles survive a cancel.
- `/api/models` endpoint with 60 s in-memory cache, plus model/temperature/
  top_p/top_k/max_tokens/seed/stop generation params in the settings panel.
- Light/dark theme toggle, custom accent colour, density (comfortable/
  compact), and font size controls; all persisted in `localStorage`.
- Per-message edit, regenerate, continue, copy, reaction emojis, and
  thumbs-up/down feedback; server-side message PATCH/DELETE.
- Mermaid (v10.9.1) for diagrams and KaTeX (v0.16.11) for math, with
  theme-aware rendering and graceful error messages.
- Slash command menu (autocomplete on `/`), command palette (Cmd/Ctrl+K),
  and a keyboard-shortcuts panel (`?`); global hotkeys for theme, search,
  new chat, export, and settings.
- File upload (`POST /api/upload`, 10 MB cap) for TXT / MD / HTML / CSV /
  JSON / PDF, plus drag-and-drop and clipboard paste; attached files are
  inlined into the user message.
- Cross-session long-term memory (`data/memory.json`) with `/api/memory`
  CRUD and `/remember`, `/memory`, `/forget` slash commands.
- Pin/star, tags (max 20), HTML5 drag-to-reorder, and an archive toggle
  per session, plus a `/api/templates` system-prompt library.
- Global `/api/search` with role, tag, and date-window filters; Cmd/Ctrl+F
  opens a search modal that jumps to and highlights the target message.
- Import (ChatGPT mapping, Claude `chat_messages`, generic JSON, bare
  array), export to MD/HTML/JSON, and shareable static links written
  to `data/shared/<id>.json`.
- Web Speech voice input and `speechSynthesis` TTS narration of replies.
- PWA shell: `manifest.json`, `icon.svg`, `public/sw.js` (cache-first
  for the app shell, network-passthrough for `/api/*`).
- Optional `SESSION_ENCRYPTION_KEY` AES-256-GCM at-rest encryption of
  session files; reads transparently fall back to plaintext so old data
  keeps working after the env var is set.
- Optional `API_BEARER_TOKEN` auth on every `/api/*` (skips
  `/api/health`); constant-time compare.
- Optional `PII_REDACT=1` regex pass for emails, SSNs, US phone numbers,
  credit-card-shaped sequences, and IPv4 addresses.
- Custom blocklist (`data/blocklist.json`) with whole-word regex match;
  UI in settings.
- `AUDIT_LOG=1` JSONL audit log at `data/audit.log`; new `/api/audit` endpoint.
- In-memory metrics module with JSON summary (`/api/metrics`) and
  Prometheus text exporter (`/metrics`); per-session token usage on
  `/api/usage`, surfaced as a "Usage & metrics" panel in settings.
- OpenAPI 3.0 spec at `/openapi.json`.
- `WEBHOOK_URL` outbound delivery (HMAC-SHA256 signed with
  `WEBHOOK_SECRET`); best-effort, 4 s timeout.
- Minimal in-process plugin system (`plugins/`) with a sample
  watermark plugin; `pre-chat` hook fires for both chat endpoints.
- Headless CLI (`cli.js`) for session CRUD, memory, templates, health, usage.
- Dockerfile (node:20-alpine) and `docker-compose.yml` with a bind mount
  for `/app/data` and `LLM_BASE_URL` pointing at `host.docker.internal`.

### Changed
- `db.js` now assigns a per-message UUID, supports `editMessage`,
  `deleteMessage`, `appendToLastAssistant`, `popLastMessage`, and the
  `updateSessionMeta` patch helper for pinned/tags/order/archived.
- `listSessions()` returns pinned, tags, order, and archived flags and
  sorts pinned first, then by `order`, then by recency.
- `package.json` adds `multer` and `pdf-parse`; engines still `>=18.18.0`.
- README, APPLICATION, and CHANGELOG updated for v1.1.0.

## [1.0.0] - 2026-06-01

### Added
- Apache 2.0 license and open-source community files (CONTRIBUTING, CoC, SECURITY, CHANGELOG)
- Multi-turn conversation history with JSON-file storage (atomic writes, no index file, in-memory list cache)
- Markdown rendering with sanitized HTML and syntax-highlighted code blocks (DOMPurify allowlist + highlight.js)
- Conversation context (configurable last N turns) sent to the LLM for follow-up questions
- Session sidebar UI with new/load/delete/rename operations
- Mobile-responsive sidebar drawer with hamburger toggle
- Strict Content-Security-Policy and security headers (`X-Content-Type-Options`, `Referrer-Policy`)
- Request ID tracing (`X-Request-Id` header) for log correlation
- Refactored guardrails into a testable module with 100% regex test coverage
- GitHub Actions CI on Node 18, 20, 22 (unit tests + JS syntax check)
- `CHANGELOG.md`, `.editorconfig`, `.env.example`, issue and PR templates
- Apache 2.0 SPDX license header in all source files
- Empty-response guard (placeholder when LLM returns blank output)

### Changed
- `server.js` refactored to import guardrails from a separate module
- Health endpoint now returns the application version

### Deferred to v1.1
- Streaming SSE responses (NDJSON-to-SSE translator for LM Studio)
- Model selector UI and `/api/models` endpoint
- LLM-as-judge output moderation (opt-in via `JUDGE_ENABLED` env flag)
