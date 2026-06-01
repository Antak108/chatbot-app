# Contributing

Thanks for your interest in contributing! This document covers how to set up a development environment, run tests, and submit a pull request.

## Setup

- **Node.js 18.18+** (Node 20+ recommended for stable `npm run dev` watch mode)
- A local LLM running at `LLM_BASE_URL` (default `http://localhost:1234`). [LM Studio](https://lmstudio.ai/) with `liquid/lfm2.5-1.2b` is the reference setup.

```bash
git clone https://github.com/Antak108/chatbot-app.git
cd chatbot-app
npm install
npm run dev   # auto-restart on file changes
```

Then open <http://localhost:3000> in a browser.

## Test Gate

Every pull request must pass:

```bash
npm test       # unit tests for the guardrails module
npm run check  # JS syntax check across server, db, guardrails, frontend
```

Manual testing is encouraged for UI changes. Use the 5-minute smoke test in `docs/APPLICATION.md` as a starting point.

## Pull Request Flow

1. Fork the repo and create a feature branch (`feature/your-thing` or `fix/your-thing`).
2. Implement your change. Keep commits small and focused.
3. Add or update unit tests where applicable.
4. Update `CHANGELOG.md` under an `## [Unreleased]` section.
5. Push to your fork and open a PR using the provided template.
6. Wait for CI to pass and a maintainer to review.

## Coding Style

- 2-space indentation, LF line endings, UTF-8 (see `.editorconfig`).
- Semicolons required.
- No trailing whitespace.
- Match the patterns of surrounding code.
- No new runtime dependencies without prior discussion in an issue.
- All new `.js` files must start with the Apache 2.0 SPDX header.

## Project Structure

- `server.js` — Express server, routes, middleware
- `guardrails.js` — Regex-based injection and harmful-content detection, sanitization
- `db.js` — JSON-file session storage
- `public/` — Vanilla HTML/CSS/JS chat UI
- `promptfooconfig.yaml` — Adversarial test suite (run manually, not in CI)

## Reporting Issues

Use the issue templates. For security vulnerabilities, see `SECURITY.md` instead.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
