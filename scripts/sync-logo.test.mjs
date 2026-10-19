// Created by Claude (claude-opus-5-5)
// Date: 2026-10-14

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncLogo } from './sync-logo.mjs';

const page = '<link rel="stylesheet" href="logo/logo.css"><img class="app-logo" src="logo/senor_claude.png" alt="">';

function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-logo-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

const master = { 'assets/logo/logo.css': 'a{}', 'assets/logo/senor_claude.png': 'png' };

test('sync copies the master folder into each app', () => {
  const root = makeTree({ ...master, 'apps/one/index.html': page });
  assert.deepEqual(syncLogo(root), []);
  assert.equal(fs.readFileSync(path.join(root, 'apps/one/logo/logo.css'), 'utf8'), 'a{}');
  assert.equal(fs.readFileSync(path.join(root, 'apps/one/logo/senor_claude.png'), 'utf8'), 'png');
});

test('check reports missing and stale copies without writing', () => {
  const root = makeTree({ ...master, 'apps/one/index.html': page, 'apps/one/logo/logo.css': 'old' });
  assert.deepEqual(syncLogo(root, { check: true }), [
    'apps/one/logo/logo.css is missing or out of date',
    'apps/one/logo/senor_claude.png is missing or out of date',
  ]);
  assert.equal(fs.readFileSync(path.join(root, 'apps/one/logo/logo.css'), 'utf8'), 'old');
});

test('check passes once synced', () => {
  const root = makeTree({ ...master, 'apps/one/index.html': page });
  syncLogo(root);
  assert.deepEqual(syncLogo(root, { check: true }), []);
});

test('pages without the logo tags are reported', () => {
  const root = makeTree({ ...master, 'apps/one/index.html': '<p>hi</p>' });
  assert.deepEqual(syncLogo(root), ['apps/one/index.html must link logo/logo.css and show logo/senor_claude.png']);
});

// [Claude 2026-10-19 start]
test('sync covers games and reports them by folder', () => {
  const root = makeTree({ ...master, 'games/g/index.html': page, 'games/h/index.html': '<p>hi</p>' });
  assert.deepEqual(syncLogo(root), ['games/h/index.html must link logo/logo.css and show logo/senor_claude.png']);
  assert.equal(fs.readFileSync(path.join(root, 'games/g/logo/logo.css'), 'utf8'), 'a{}');
});

test('missing apps or games folder is skipped', () => {
  const root = makeTree({ ...master, 'games/g/index.html': page });
  assert.deepEqual(syncLogo(root, { check: true }), ['games/g/logo/logo.css is missing or out of date', 'games/g/logo/senor_claude.png is missing or out of date']);
});
// [Claude 2026-10-19 end]
