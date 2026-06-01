# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it privately:

1. **Open a GitHub issue** with `[SECURITY]` in the title and the details.
2. **Or contact the maintainer directly** via the email listed on their GitHub profile.

Please **do not** disclose the vulnerability publicly until a fix has been released.

Include as much of the following as you can:

- Description of the vulnerability and its impact
- Steps to reproduce
- Affected versions
- Suggested fix (if any)

You can expect an initial response within 7 days. We will work with you to understand the issue and coordinate a fix and disclosure timeline.

## Scope

**In scope:**
- Application code (`server.js`, `db.js`, `guardrails.js`, `public/`)
- Configuration and documentation that affects security posture
- Dependencies shipped in `package.json`

**Out of scope:**
- The underlying LLM model (third-party; controlled by your local LLM runtime)
- Node.js runtime vulnerabilities (report to the Node.js project)
- The npm ecosystem
- LM Studio, Ollama, or other local LLM server software

## Security Features

This project implements:

- **Rate limiting** — 15 requests per minute per IP
- **Input validation** — max 2000 characters per message, 16 KB body limit
- **Prompt injection detection** — regex scanner for 14 attack patterns
- **Harmful content filtering** — regex scanner for 6 categories (malware, hacking, violence, etc.)
- **Output sanitization** — strips HTML tags from LLM responses
- **Hardened system prompt** — appends safety rules to every system prompt
- **Content Security Policy** — strict CSP blocks inline scripts and most XSS vectors
- **HTML escaping** — input is HTML-escaped before being sent to the LLM
- **Markdown sanitization** — DOMPurify allowlist on the frontend
- **Request tracing** — `X-Request-Id` header on every response for log correlation

## Known Limitations

See the "Known Limitations" section in the README. Key items:

- **Regex-based detection is bypassable** with rephrasing, leetspeak, or Unicode tricks.
- **No semantic filtering** — paraphrased attacks may slip past the regex scanner.
- **No output content moderation** — the LLM may produce harmful text that the regex filter on input does not catch. (LLM-as-judge moderation is planned for v1.1.)
- **No authentication** — this is a local single-user application.
- **In-memory rate limiting** — resets on server restart.

## Acknowledgments

We appreciate responsible disclosure and will credit reporters (with permission) in release notes.
