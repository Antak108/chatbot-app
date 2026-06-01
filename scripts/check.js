// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FILES = [
  'server.js',
  'db.js',
  'guardrails.js',
  'public/app.js',
];

let failed = false;

for (const f of FILES) {
  const abs = path.join(__dirname, '..', f);
  if (!fs.existsSync(abs)) {
    console.error(`✗ ${f}: file not found`);
    failed = true;
    continue;
  }
  const result = spawnSync(process.execPath, ['--check', abs], { stdio: 'pipe' });
  if (result.status !== 0) {
    console.error(`✗ ${f}: syntax error`);
    if (result.stderr) console.error(result.stderr.toString());
    failed = true;
  } else {
    console.log(`✓ ${f}`);
  }
}

if (failed) {
  console.error('\nCheck failed.');
  process.exit(1);
}
console.log('\nAll files pass syntax check.');
