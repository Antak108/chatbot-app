// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// Optional at-rest encryption for session files.
// Enabled by setting SESSION_ENCRYPTION_KEY (>= 16 chars) in the env.
// Files written to disk become an AES-256-GCM envelope:
//   { v: 1, iv: <base64>, tag: <base64>, data: <base64 ciphertext> }
//
// Key derivation: SHA-256 of the env var -> 32 bytes for AES-256.
// All other code is unchanged; db.js still uses JSON for the in-memory shape.

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const ENVELOPE_VERSION = 1;

function getKey() {
  const raw = process.env.SESSION_ENCRYPTION_KEY;
  if (!raw) return null;
  if (raw.length < 16) {
    console.warn('SESSION_ENCRYPTION_KEY too short (<16 chars); encryption disabled.');
    return null;
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plaintext) {
  const key = getKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: ENVELOPE_VERSION,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ct.toString('base64'),
  };
}

function decrypt(envelope) {
  const key = getKey();
  if (!key) return null;
  if (!envelope || envelope.v !== ENVELOPE_VERSION) return null;
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ct = Buffer.from(envelope.data, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf-8');
}

function isEnabled() { return getKey() !== null; }

function maybeEnvelope(plaintext) {
  if (!isEnabled()) return plaintext;
  return JSON.stringify(encrypt(plaintext));
}

function maybeUnwrap(raw) {
  if (!isEnabled()) return raw;
  try {
    const env = JSON.parse(raw);
    if (env && env.v === ENVELOPE_VERSION && env.iv && env.tag && env.data) {
      return decrypt(env);
    }
  } catch (_) { /* fall through */ }
  // Not encrypted: return as-is so mixed/fresh deployments keep working.
  return raw;
}

module.exports = { encrypt, decrypt, isEnabled, maybeEnvelope, maybeUnwrap };
