// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_DIR = process.env.DB_DIR
  ? path.resolve(process.env.DB_DIR)
  : path.join(__dirname, 'data', 'sessions');
const QUARANTINE_DIR = path.join(DB_DIR, '.quarantine');
const CONTEXT_LIMIT = Math.min(50, Math.max(0, parseInt(process.env.CONTEXT_LIMIT, 10) || 10));
const MAX_SESSION_BYTES = 1024 * 1024; // 1 MB

let sessionListCache = null;

function init() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
  invalidateCache();
}

function invalidateCache() {
  sessionListCache = null;
}

function generateId() {
  return crypto.randomUUID();
}

function atomicWriteSync(filepath, content) {
  const tmp = filepath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filepath);
}

function readSessionFile(id) {
  const filepath = path.join(DB_DIR, `${id}.json`);
  if (!fs.existsSync(filepath)) {
    return null;
  }
  const raw = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(raw);
}

function listSessions() {
  if (sessionListCache !== null) return sessionListCache;

  let files;
  try {
    files = fs.readdirSync(DB_DIR);
  } catch (err) {
    console.error(JSON.stringify({ event: 'db_readdir_failed', error: err.message }));
    return (sessionListCache = []);
  }

  const items = [];
  for (const f of files) {
    if (!f.endsWith('.json') || f.startsWith('.')) continue;
    try {
      const data = readSessionFile(f.replace(/\.json$/, ''));
      if (!data) continue;
      items.push({
        id: data.id,
        title: data.title,
        created_at: data.created_at,
        updated_at: data.updated_at,
        message_count: Array.isArray(data.messages) ? data.messages.length : 0,
      });
    } catch (err) {
      console.error(JSON.stringify({ event: 'session_quarantined', file: f, error: err.message }));
      quarantine(f);
    }
  }

  items.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  sessionListCache = items;
  return items;
}

function getSession(id) {
  const data = readSessionFile(id);
  if (data === null) {
    const err = new Error('Session not found');
    err.code = 'SESSION_NOT_FOUND';
    throw err;
  }
  return migrate(data);
}

function createSession({ system_prompt, title } = {}) {
  const now = Date.now();
  const session = {
    id: generateId(),
    title: (title && String(title).trim()) || 'New Chat',
    system_prompt: (system_prompt && String(system_prompt)) || 'You are a helpful assistant.',
    created_at: now,
    updated_at: now,
    messages: [],
  };
  atomicWriteSync(
    path.join(DB_DIR, `${session.id}.json`),
    JSON.stringify(session, null, 2),
  );
  invalidateCache();
  return session;
}

function deleteSession(id) {
  const filepath = path.join(DB_DIR, `${id}.json`);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    invalidateCache();
  }
}

function renameSession(id, { title } = {}) {
  const session = getSession(id);
  if (title !== undefined && String(title).trim() !== '') {
    session.title = String(title).trim();
  }
  session.updated_at = Date.now();
  atomicWriteSync(
    path.join(DB_DIR, `${id}.json`),
    JSON.stringify(session, null, 2),
  );
  invalidateCache();
  return session;
}

function addMessage(id, msg) {
  const session = getSession(id);
  const message = {
    role: msg.role,
    content: String(msg.content || ''),
    created_at: Date.now(),
  };
  if (msg.blocked !== undefined) message.blocked = !!msg.blocked;
  if (msg.reason !== undefined) message.reason = String(msg.reason);

  session.messages.push(message);
  session.updated_at = Date.now();

  // Auto-title: if title is "New Chat" and this is a user message, use first 40 chars
  if (
    session.title === 'New Chat' &&
    msg.role === 'user' &&
    typeof msg.content === 'string' &&
    msg.content.length > 0
  ) {
    session.title = msg.content.length > 40
      ? msg.content.slice(0, 40) + '…'
      : msg.content;
  }

  // Trim oldest 20% if session exceeds the cap; refuse if still over after trim
  let serialized = JSON.stringify(session, null, 2);
  if (serialized.length > MAX_SESSION_BYTES) {
    const trimCount = Math.max(1, Math.floor(session.messages.length * 0.2));
    session.messages.splice(0, trimCount);
    serialized = JSON.stringify(session, null, 2);
    if (serialized.length > MAX_SESSION_BYTES) {
      const err = new Error('Session too large even after trim');
      err.code = 'SESSION_TOO_LARGE';
      throw err;
    }
  }

  atomicWriteSync(
    path.join(DB_DIR, `${id}.json`),
    serialized,
  );
  invalidateCache();
}

function getMessages(id, limit = CONTEXT_LIMIT) {
  const session = getSession(id);
  const messages = session.messages || [];
  if (limit <= 0) return [];
  return messages.slice(-limit);
}

function quarantine(filename) {
  try {
    const src = path.join(DB_DIR, filename);
    const dest = path.join(QUARANTINE_DIR, `${Date.now()}-${filename}`);
    if (fs.existsSync(src)) fs.renameSync(src, dest);
    invalidateCache();
  } catch (err) {
    console.error(JSON.stringify({ event: 'quarantine_failed', file: filename, error: err.message }));
  }
}

function migrate(session) {
  // No-op for v1.0. Hook for future schema changes.
  return session;
}

init();

module.exports = {
  init,
  listSessions,
  getSession,
  createSession,
  deleteSession,
  renameSession,
  addMessage,
  getMessages,
  CONTEXT_LIMIT,
  DB_DIR,
};
