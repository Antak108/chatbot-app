// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// Minimal plugin system. Plugins are JS files in plugins/ that export a
// default async function (event, payload, ctx) and can mutate the
// payload before the next step.
//
// Each plugin runs in turn for these events:
//   'pre-chat'    before the LLM is called
//   'post-chat'   after the LLM responds
//   'pre-message' before a user message is persisted
//   'post-message' after a message is persisted
//
// Plugins may return a new payload (or undefined to leave it alone).
// Exceptions are caught and logged so a buggy plugin cannot crash the app.

const fs = require('fs');
const path = require('path');

const PLUGIN_DIR = path.join(__dirname, 'plugins');
let loaded = [];

function load() {
  loaded = [];
  if (!fs.existsSync(PLUGIN_DIR)) {
    try { fs.mkdirSync(PLUGIN_DIR, { recursive: true }); } catch (_) {}
    return;
  }
  for (const f of fs.readdirSync(PLUGIN_DIR)) {
    if (!f.endsWith('.js')) continue;
    try {
      const mod = require(path.join(PLUGIN_DIR, f));
      const fn = mod.default || mod;
      if (typeof fn === 'function') loaded.push({ name: f, fn });
    } catch (err) {
      console.error(JSON.stringify({ event: 'plugin_load_failed', file: f, error: err.message }));
    }
  }
}

async function run(event, payload, ctx) {
  for (const p of loaded) {
    try {
      const out = await p.fn(event, payload, ctx);
      if (out && typeof out === 'object') payload = out;
    } catch (err) {
      console.error(JSON.stringify({ event: 'plugin_error', plugin: p.name, error: err.message }));
    }
  }
  return payload;
}

load();

module.exports = { load, run, PLUGIN_DIR };
