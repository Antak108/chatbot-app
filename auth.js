// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// Optional bearer-token auth. Enabled by setting API_BEARER_TOKEN in env.
// Constant-time compare via crypto.timingSafeEqual to avoid timing attacks.

const crypto = require('crypto');

let expected = null;

function load() {
  const token = process.env.API_BEARER_TOKEN;
  if (!token || token.length < 8) {
    expected = null;
    return;
  }
  expected = crypto.createHash('sha256').update(token).digest();
}

function isEnabled() { return expected !== null; }

function check(authorizationHeader) {
  if (!isEnabled()) return true;
  if (!authorizationHeader) return false;
  const m = /^Bearer\s+(\S+)/i.exec(authorizationHeader);
  if (!m) return false;
  const got = crypto.createHash('sha256').update(m[1]).digest();
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(got, expected);
}

function middleware(req, res, next) {
  if (!isEnabled()) return next();
  if (check(req.headers.authorization)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

load();

module.exports = { isEnabled, check, middleware, load };
