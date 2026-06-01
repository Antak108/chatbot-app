# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
