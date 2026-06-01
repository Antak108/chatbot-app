// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// Append events to a JSONL file. Disabled unless AUDIT_LOG=1 in env.
// Keeps the last AUDIT_MAX entries (default 1000) to bound the file size.

const fs = require('fs');
const path = require('path');

const FILE = process.env.AUDIT_FILE
  ? path.resolve(process.env.AUDIT_FILE)
  : path.join(__dirname, 'data', 'audit.log');
const MAX = parseInt(process.env.AUDIT_MAX, 10) || 1000;

function enabled() { return process.env.AUDIT_LOG === '1'; }

function append(event) {
  if (!enabled()) return;
  const entry = Object.assign({ ts: new Date().toISOString() }, event);
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (err) {
    console.error(JSON.stringify({ event: 'audit_write_failed', error: err.message }));
  }
}

function recent(n = 100) {
  if (!fs.existsSync(FILE)) return [];
  try {
    const lines = fs.readFileSync(FILE, 'utf-8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
  } catch (_) { return []; }
}

module.exports = { append, recent, enabled, FILE, MAX };
