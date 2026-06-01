// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// Lightweight PII redaction. Replaces common patterns with placeholders.
// Runs on both incoming user text (before logging) and outgoing LLM text
// (before sending back to client) when the env PII_REDACT=1 is set.

const PATTERNS = [
  // Email
  { re: /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi, tag: '[EMAIL]' },
  // SSN
  { re: /\b\d{3}-\d{2}-\d{4}\b/g, tag: '[SSN]' },
  // US phone (very rough)
  { re: /\b\(?\d{3}\)?[\s-]\d{3}[\s-]\d{4}\b/g, tag: '[PHONE]' },
  // Credit card (13-19 digits, with optional dashes/spaces)
  { re: /\b(?:\d[ -]*?){13,19}\b/g, tag: '[CC]' },
  // IPv4
  { re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, tag: '[IPV4]' },
];

function redact(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const p of PATTERNS) {
    out = out.replace(p.re, p.tag);
  }
  return out;
}

function shouldRun() { return process.env.PII_REDACT === '1'; }

module.exports = { redact, shouldRun };
