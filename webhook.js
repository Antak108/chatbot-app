// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// Outbound webhook. When WEBHOOK_URL is set, every chat completion POSTs
// a JSON envelope to that URL. Failures are logged but do not affect the
// user-facing response (best-effort delivery).

const ENV_URL = process.env.WEBHOOK_URL;
const SECRET = process.env.WEBHOOK_SECRET || null;
const TIMEOUT_MS = parseInt(process.env.WEBHOOK_TIMEOUT_MS, 10) || 4000;

function isEnabled() { return !!ENV_URL; }

function sign(body) {
  if (!SECRET) return null;
  const crypto = require('crypto');
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

async function fire(event, data) {
  if (!isEnabled()) return;
  const body = JSON.stringify({ event, ts: new Date().toISOString(), data });
  const headers = { 'Content-Type': 'application/json', 'X-Chatbot-Event': event };
  const sig = sign(body);
  if (sig) headers['X-Chatbot-Signature'] = 'sha256=' + sig;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(ENV_URL, { method: 'POST', body, headers, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.error(JSON.stringify({ event: 'webhook_failed', status: res.status, target: ENV_URL }));
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'webhook_error', error: err.message, target: ENV_URL }));
  }
}

module.exports = { isEnabled, fire, sign };
