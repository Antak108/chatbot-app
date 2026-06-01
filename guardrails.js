// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// ── Injection patterns ──────────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /you\s+are\s+now\s+(DAN|evil|unrestricted|unfiltered)/i,
  /do\s+anything\s+now/i,
  /jailbreak/i,
  /SYSTEM\s*:/i,
  /\[INST\]/i,
  /\<\|im_start\|\>/i,
  /repeat\s+(everything|all|the\s+text)\s+(above|before)/i,
  /print\s+(your|the)\s+(system\s+)?prompt/i,
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
  /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions)/i,
  /translate\s+your\s+(initial\s+)?instructions/i,
];

// ── Harmful content patterns ────────────────────────────────────────
const HARMFUL_PATTERNS = [
  /\b(keylogger|ransomware|malware|trojan|rootkit)\b/i,
  /\bhow\s+to\s+(hack|crack|break\s+into|exploit)\b/i,
  /\bphishing\s+(email|page|site|attack)\b/i,
  /\b(make|build|create)\s+(a\s+)?(bomb|explosive|weapon)\b/i,
  /\bhow\s+to\s+(hurt|harm|kill|attack)\s+(someone|a\s+person|people)\b/i,
  /\b(social\s+security|SSN|credit\s+card)\s+number\b/i,
];

// ── Structured log helper ───────────────────────────────────────────
function logEvent(reqId, event, extra) {
  try {
    console.warn(JSON.stringify({ reqId, event, ...extra }));
  } catch (_) {
    console.warn(`[${event}] reqId=${reqId}`);
  }
}

// ── Detection functions ─────────────────────────────────────────────
function detectInjection(text, reqId) {
  if (typeof text !== 'string') return { detected: false };
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      logEvent(reqId, 'injection_blocked', { pattern: pattern.toString() });
      return { detected: true, pattern: pattern.toString() };
    }
  }
  return { detected: false };
}

function detectHarmful(text, reqId) {
  if (typeof text !== 'string') return { detected: false };
  for (const pattern of HARMFUL_PATTERNS) {
    if (pattern.test(text)) {
      logEvent(reqId, 'harmful_blocked', { pattern: pattern.toString() });
      return { detected: true, pattern: pattern.toString() };
    }
  }
  return { detected: false };
}

// ── Sanitizers ──────────────────────────────────────────────────────
function sanitizeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitizeOutput(text) {
  if (typeof text !== 'string') return String(text);
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .trim();
}

module.exports = {
  INJECTION_PATTERNS,
  HARMFUL_PATTERNS,
  detectInjection,
  detectHarmful,
  sanitizeHtml,
  sanitizeOutput,
};
