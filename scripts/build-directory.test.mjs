// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectApps } from './build-directory.mjs';

function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

const okJson = JSON.stringify({ name: 'Ok', description: 'Fine.' });

test('valid app is collected with defaults', () => {
  const dir = makeTree({ 'ok/index.html': '', 'ok/app.json': okJson });
  const { apps, errors } = collectApps(dir);
  assert.deepEqual(errors, []);
  assert.deepEqual(apps, [{ slug: 'ok', name: 'Ok', description: 'Fine.', icon: null, color: 'gray' }]);
});

test('missing index.html', () => {
  const dir = makeTree({ 'a/app.json': okJson });
  assert.match(collectApps(dir).errors.join('\n'), /apps\/a: missing index\.html/);
});

test('missing app.json', () => {
  const dir = makeTree({ 'a/index.html': '' });
  assert.match(collectApps(dir).errors.join('\n'), /apps\/a: missing app\.json/);
});

test('invalid JSON', () => {
  const dir = makeTree({ 'a/index.html': '', 'a/app.json': '{ nope' });
  assert.match(collectApps(dir).errors.join('\n'), /apps\/a: app\.json is not valid JSON/);
});

test('missing name', () => {
  const dir = makeTree({ 'a/index.html': '', 'a/app.json': JSON.stringify({ description: 'x' }) });
  assert.match(collectApps(dir).errors.join('\n'), /apps\/a: app\.json needs a non-empty "name"/);
});

test('missing description', () => {
  const dir = makeTree({ 'a/index.html': '', 'a/app.json': JSON.stringify({ name: 'x', description: '  ' }) });
  assert.match(collectApps(dir).errors.join('\n'), /apps\/a: app\.json needs a non-empty "description"/);
});

test('unknown color', () => {
  const dir = makeTree({ 'a/index.html': '', 'a/app.json': JSON.stringify({ name: 'x', description: 'y', color: 'neon' }) });
  assert.match(collectApps(dir).errors.join('\n'), /apps\/a: "color" must be one of/);
});

test('bad slug', () => {
  const dir = makeTree({ 'My App/index.html': '', 'My App/app.json': okJson });
  assert.match(collectApps(dir).errors.join('\n'), /apps\/My App: folder name must match/);
});

test('files in apps are ignored', () => {
  const dir = makeTree({ '.gitkeep': '', 'ok/index.html': '', 'ok/app.json': okJson });
  const { apps, errors } = collectApps(dir);
  assert.deepEqual(errors, []);
  assert.equal(apps.length, 1);
});

test('all errors are collected', () => {
  const dir = makeTree({ 'a/index.html': '', 'b/app.json': okJson });
  assert.equal(collectApps(dir).errors.length, 2);
});
