// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// Custom word/phrase blocklist for incoming messages.
// Read at startup from data/blocklist.json (one entry per line) or the
// BLOCKLIST_FILE env var. Empty list = no custom filtering.
// Each entry is matched case-insensitively as a whole word (regex \b).

const fs = require('fs');
const path = require('path');

const FILE = process.env.BLOCKLIST_FILE
  ? path.resolve(process.env.BLOCKLIST_FILE)
  : path.join(__dirname, 'data', 'blocklist.json');

let entries = [];
let compiled = [];

function load() {
  entries = [];
  if (!fs.existsSync(FILE)) return;
  try {
    const raw = fs.readFileSync(FILE, 'utf-8');
    if (raw.trim().startsWith('[')) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) entries = arr.map(String);
    } else {
      entries = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'blocklist_load_failed', error: err.message }));
    entries = [];
  }
  compiled = entries
    .map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean)
    .map(esc => new RegExp('\\b' + esc + '\\b', 'i'));
}

function contains(text) {
  if (!text || !compiled.length) return null;
  for (const r of compiled) {
    if (r.test(text)) return r.source;
  }
  return null;
}

load();

module.exports = { load, contains, entries, FILE };
