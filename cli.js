#!/usr/bin/env node
// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0
//
// Tiny CLI for headless session management. Talks to a running server.
//
//   node cli.js list
//   node cli.js get <session_id>
//   node cli.js delete <session_id>
//   node cli.js memory list
//   node cli.js memory add "I prefer dark mode"
//   node cli.js memory clear
//   node cli.js template list
//   node cli.js health --url http://localhost:3000

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE = process.env.BASE || 'http://localhost:3000';
const TOKEN = process.env.API_BEARER_TOKEN || null;

function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const lib = u.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: { 'Accept': 'application/json' },
    };
    if (data) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
    const req = lib.request(opts, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch (_) { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function help() {
  console.log(`Usage: node cli.js <command> [args]

Commands:
  list                                  List all sessions
  get <id>                              Get a session with all messages
  delete <id>                           Delete a session
  export <id> <path>                    Save a session's JSON to a file
  memory list                           List long-term memory
  memory add <text>                     Add a memory
  memory forget <index>                 Forget a fact by index
  memory clear                          Clear all memory
  template list                         List system-prompt templates
  health                                GET /api/health
  usage                                 GET /api/usage

Environment:
  BASE                  default: http://localhost:3000
  API_BEARER_TOKEN      optional bearer token for auth
`);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') { help(); process.exit(0); }
  switch (cmd) {
    case 'list': {
      const r = await call('GET', '/api/sessions');
      console.log(JSON.stringify(r.body, null, 2));
      break;
    }
    case 'get': {
      const id = rest[0];
      if (!id) throw new Error('id required');
      const r = await call('GET', '/api/sessions/' + encodeURIComponent(id));
      console.log(JSON.stringify(r.body, null, 2));
      break;
    }
    case 'delete': {
      const id = rest[0];
      if (!id) throw new Error('id required');
      const r = await call('DELETE', '/api/sessions/' + encodeURIComponent(id));
      console.log(JSON.stringify(r.body, null, 2));
      break;
    }
    case 'export': {
      const id = rest[0]; const path = rest[1];
      if (!id || !path) throw new Error('id and path required');
      const r = await call('GET', '/api/sessions/' + encodeURIComponent(id));
      require('fs').writeFileSync(path, JSON.stringify(r.body, null, 2));
      console.log('Saved to ' + path);
      break;
    }
    case 'memory': {
      const sub = rest[0];
      if (sub === 'list') {
        const r = await call('GET', '/api/memory');
        console.log(JSON.stringify(r.body, null, 2));
      } else if (sub === 'add') {
        const text = rest.slice(1).join(' ');
        if (!text) throw new Error('text required');
        const r = await call('POST', '/api/memory', { text });
        console.log(JSON.stringify(r.body, null, 2));
      } else if (sub === 'forget') {
        const idx = parseInt(rest[1], 10);
        if (Number.isNaN(idx)) throw new Error('index required');
        const r = await call('DELETE', '/api/memory/' + idx);
        console.log(JSON.stringify(r.body, null, 2));
      } else if (sub === 'clear') {
        const r = await call('POST', '/api/memory/clear');
        console.log(JSON.stringify(r.body, null, 2));
      } else { help(); process.exit(1); }
      break;
    }
    case 'template': {
      if (rest[0] === 'list') {
        const r = await call('GET', '/api/templates');
        console.log(JSON.stringify(r.body, null, 2));
      } else { help(); process.exit(1); }
      break;
    }
    case 'health': {
      const r = await call('GET', '/api/health');
      console.log(JSON.stringify(r.body, null, 2));
      break;
    }
    case 'usage': {
      const r = await call('GET', '/api/usage');
      console.log(JSON.stringify(r.body, null, 2));
      break;
    }
    default: help(); process.exit(1);
  }
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
