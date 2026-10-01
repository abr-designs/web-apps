// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectApps, buildIndex, assembleSite, resolveOutDir } from './build-directory.mjs';

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

const meta = (slug) => ({ slug, name: slug, description: 'd', icon: null, color: 'gray' });

test('buildIndex sorts newest first, null last', () => {
  const updates = { a: '2026-09-01T00:00:00Z', b: null, c: '2026-09-20T00:00:00Z' };
  const entries = buildIndex([meta('a'), meta('b'), meta('c')], (slug) => updates[slug]);
  assert.deepEqual(entries.map((e) => e.slug), ['c', 'a', 'b']);
  assert.equal(entries[0].url, 'c/');
  assert.equal(entries[2].updated, null);
});

test('assembleSite copies shell and apps', () => {
  const root = makeTree({
    'index.html': '', 'directory.css': '', 'directory.js': '',
    'apps/x/index.html': '', 'apps/x/js/app.js': '', 'apps/x/js/docs/keep.txt': '',
    'apps/x/docs/a.md': '', 'apps/x/tests/t.js': '', 'apps/x/tools/t.mjs': '',
    'apps/x/.claude/s.md': '', 'apps/x/.kanban/b.json': '',
  });
  const out = path.join(root, '_site');
  const entry = { ...meta('x'), updated: null, url: 'x/' };
  assembleSite(root, out, [entry]);
  for (const rel of ['index.html', 'directory.css', 'directory.js', 'apps.json', '.nojekyll',
    'x/index.html', 'x/js/app.js', 'x/js/docs/keep.txt']) {
    assert.ok(fs.existsSync(path.join(out, rel)), `expected ${rel}`);
  }
  for (const rel of ['x/docs', 'x/tests', 'x/tools', 'x/.claude', 'x/.kanban']) {
    assert.ok(!fs.existsSync(path.join(out, rel)), `unexpected ${rel}`);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'apps.json'), 'utf8')), [entry]);
});

test('resolveOutDir refuses the repo root or its parents', () => {
  const root = makeTree({});
  assert.throws(() => resolveOutDir(root, '.'), /must be inside/);
  assert.throws(() => resolveOutDir(root, '..'), /must be inside/);
  assert.equal(resolveOutDir(root, '_site'), path.join(root, '_site'));
});
