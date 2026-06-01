// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

const fs = require('fs');
const path = require('path');

const DB_DIR = process.env.DB_DIR
  ? path.resolve(process.env.DB_DIR)
  : path.join(__dirname, 'data', 'sessions');
const MEMORY_FILE = path.join(DB_DIR, 'memory.json');
const MAX_FACTS = 200;
const MAX_FACT_LENGTH = 500;

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

function read() {
  ensureDir();
  if (!fs.existsSync(MEMORY_FILE)) {
    return { facts: [], updated_at: 0 };
  }
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  } catch (err) {
    console.error(JSON.stringify({ event: 'memory_read_failed', error: err.message }));
    return { facts: [], updated_at: 0 };
  }
}

function write(data) {
  ensureDir();
  data.updated_at = Date.now();
  fs.writeFileSync(MEMORY_FILE + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(MEMORY_FILE + '.tmp', MEMORY_FILE);
}

function list() {
  return read();
}

function add(text) {
  if (typeof text !== 'string') throw new Error('text must be a string');
  const trimmed = text.trim();
  if (!trimmed) throw new Error('text is empty');
  if (trimmed.length > MAX_FACT_LENGTH) {
    return { error: 'Fact too long (max ' + MAX_FACT_LENGTH + ' chars)', code: 'TOO_LONG' };
  }
  const data = read();
  // Skip duplicates (case-insensitive, trimmed)
  const lower = trimmed.toLowerCase();
  if (data.facts.some(f => f.text.toLowerCase() === lower)) {
    return { data, duplicate: true };
  }
  data.facts.push({ text: trimmed, created_at: Date.now() });
  if (data.facts.length > MAX_FACTS) {
    data.facts.splice(0, data.facts.length - MAX_FACTS);
  }
  write(data);
  return { data };
}

function remove(index) {
  const data = read();
  if (index < 0 || index >= data.facts.length) {
    return { error: 'Index out of range', code: 'OUT_OF_RANGE' };
  }
  data.facts.splice(index, 1);
  write(data);
  return { data };
}

function clear() {
  const data = { facts: [], updated_at: 0 };
  write(data);
  return data;
}

function asPromptSection() {
  const data = read();
  if (!data.facts.length) return '';
  return '\n\nLONG-TERM MEMORY (things the user has asked you to remember):\n- ' +
    data.facts.map(f => f.text).join('\n- ');
}

module.exports = { list, add, remove, clear, asPromptSection, MEMORY_FILE };
