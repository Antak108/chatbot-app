// Copyright 2026 Manish Pandey
// SPDX-License-Identifier: Apache-2.0

// In-memory metrics. Lightweight: counters and a few useful gauges.
// Optionally exposes /api/metrics in Prometheus text format when
// PROMETHEUS=1 in the env.

const counters = {};
const gauges = {};
const events = []; // recent events (capped)
const MAX_EVENTS = 200;

function inc(name, by = 1) {
  counters[name] = (counters[name] || 0) + by;
}

function gauge(name, value) {
  gauges[name] = value;
}

function event(name, data) {
  events.push({ ts: Date.now(), name, data: data || {} });
  if (events.length > MAX_EVENTS) events.shift();
}

function summary() {
  return {
    counters: Object.assign({}, counters),
    gauges: Object.assign({}, gauges),
    events: events.slice(-20),
  };
}

function reset() {
  for (const k of Object.keys(counters)) delete counters[k];
  for (const k of Object.keys(gauges)) delete gauges[k];
  events.length = 0;
}

function prometheusText() {
  const lines = [];
  for (const [k, v] of Object.entries(counters)) {
    const safe = k.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push('# TYPE ' + safe + ' counter');
    lines.push(safe + ' ' + v);
  }
  for (const [k, v] of Object.entries(gauges)) {
    const safe = k.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push('# TYPE ' + safe + ' gauge');
    lines.push(safe + ' ' + v);
  }
  return lines.join('\n') + '\n';
}

module.exports = { inc, gauge, event, summary, reset, prometheusText };
