// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

const fs = require('fs');
const path = require('path');

const TEMPLATES_FILE = process.env.TEMPLATES_FILE
  ? path.resolve(process.env.TEMPLATES_FILE)
  : path.join(__dirname, 'data', 'templates.json');

const DEFAULTS = [
  {
    id: 'coding-helper',
    name: 'Coding Helper',
    description: 'Expert pair-programmer focused on clear, runnable code',
    system_prompt: 'You are a senior software engineer. Answer concisely, prefer runnable code, and explain trade-offs when relevant. Use fenced code blocks with the correct language tag.',
  },
  {
    id: 'tutor',
    name: 'Patient Tutor',
    description: 'Step-by-step teaching style for any subject',
    system_prompt: 'You are a patient tutor. Break complex topics into small steps, use analogies, and check understanding by asking a short follow-up question after each explanation.',
  },
  {
    id: 'editor',
    name: 'Writing Editor',
    description: 'Proofread, rewrite, and suggest improvements',
    system_prompt: 'You are a careful writing editor. When the user pastes prose, identify unclear sentences, propose specific rewrites, and explain your changes briefly.',
  },
  {
    id: 'summarizer',
    name: 'Summarizer',
    description: 'TL;DR + key points from long input',
    system_prompt: 'You are a summarizer. Produce a one-sentence TL;DR, then 3-5 bullet points capturing only the most important facts or arguments.',
  },
  {
    id: 'brainstorm',
    name: 'Brainstormer',
    description: 'Generate creative ideas without filtering',
    system_prompt: 'You are an imaginative brainstorming partner. Generate as many distinct ideas as possible. Defer judgement; quantity first.',
  },
];

function ensureLoaded() {
  if (!fs.existsSync(TEMPLATES_FILE)) {
    fs.mkdirSync(path.dirname(TEMPLATES_FILE), { recursive: true });
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
    return DEFAULTS;
  }
  try {
    const raw = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return DEFAULTS;
    return arr;
  } catch (err) {
    console.error(JSON.stringify({ event: 'templates_load_failed', error: err.message }));
    return DEFAULTS;
  }
}

function list() {
  return ensureLoaded();
}

function get(id) {
  return ensureLoaded().find(t => t.id === id) || null;
}

function create(template) {
  const arr = ensureLoaded();
  const t = {
    id: template.id || ('tpl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
    name: String(template.name || 'Untitled').slice(0, 80),
    description: String(template.description || '').slice(0, 240),
    system_prompt: String(template.system_prompt || 'You are a helpful assistant.').slice(0, 4000),
  };
  arr.push(t);
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  return t;
}

function remove(id) {
  let arr = ensureLoaded();
  const before = arr.length;
  arr = arr.filter(t => t.id !== id);
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  return arr.length !== before;
}

module.exports = { list, get, create, remove, TEMPLATES_FILE };
