// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectApps, buildIndex, assembleSite, resolveOutDir, changedSlugs, buildDevIndex, collectDev, gitRunner } from './build-directory.mjs';

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

test('resolveOutDir only accepts an underscore folder', () => {
  const root = makeTree({});
  for (const bad of ['apps', '.git', 'scripts', 'docs/out']) {
    assert.throws(() => resolveOutDir(root, bad), /must be inside/, bad);
  }
  assert.equal(resolveOutDir(root, '_preview/site'), path.join(root, '_preview', 'site'));
});

test('app.json with a UTF-8 BOM is accepted', () => {
  const dir = makeTree({ 'a/index.html': '', 'a/app.json': '﻿' + okJson });
  assert.deepEqual(collectApps(dir).errors, []);
});

test('app.json that is not an object is reported', () => {
  const dir = makeTree({ 'a/index.html': '', 'a/app.json': 'null', 'b/index.html': '', 'b/app.json': '[]' });
  const { errors } = collectApps(dir);
  assert.match(errors.join('\n'), /apps\/a: app\.json must be a JSON object/);
  assert.match(errors.join('\n'), /apps\/b: app\.json must be a JSON object/);
});

test('changedSlugs keeps added and modified apps, drops delete-only and root files', () => {
  const out = [
    'A\tapps/new/index.html', 'M\tapps/edit/app.json', 'M\tapps/edit/js/a.js',
    'D\tapps/gone/index.html', 'M\tapps/.gitkeep',
    'R100\tapps/old/a.js\tapps/renamed/a.js', 'D\tapps/old/index.html',
  ].join('\n');
  assert.deepEqual(changedSlugs(out), ['edit', 'new', 'renamed']);
});

test('changedSlugs on empty output', () => {
  assert.deepEqual(changedSlugs(''), []);
});

test('buildDevIndex sorts by PR update then number then slug and shapes entries', () => {
  const pr = (number, updatedAt) => ({ number, title: `T${number}`, url: `u${number}`, updatedAt });
  const prs = [pr(1, '2026-10-01T00:00:00Z'), pr(2, '2026-10-03T00:00:00Z')];
  const appsByPr = new Map([[1, [meta('a')]], [2, [meta('c'), meta('b')]]]);
  const entries = buildDevIndex(prs, appsByPr);
  assert.deepEqual(entries.map((e) => `${e.pr.number}/${e.slug}`), ['2/b', '2/c', '1/a']);
  assert.deepEqual(entries[0], { ...meta('b'), updated: '2026-10-03T00:00:00Z', url: 'dev/pr-2/b/', pr: { number: 2, title: 'T2', url: 'u2' } });
});

function gitRepo() {
  const dir = makeTree({ 'apps/base/index.html': '', 'apps/base/app.json': okJson });
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('add', '.');
  git('commit', '-qm', 'base');
  const branch = (name, files) => {
    git('checkout', '-qb', name);
    for (const [rel, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), content);
    }
    git('add', '.');
    git('commit', '-qm', name);
    const sha = git('rev-parse', 'HEAD');
    git('checkout', '-q', 'main');
    return sha;
  };
  const real = gitRunner(dir);
  const run = (args, opts) => (args[0] === 'fetch' ? '' : real(args, opts));
  return { dir, branch, run };
}

const prOf = (number, headRefOid, extra = {}) => ({
  number, title: `T${number}`, url: `u${number}`, updatedAt: '2026-10-03T00:00:00Z', headRefOid, isCrossRepository: false, ...extra,
});

test('collectDev skips fork PRs without calling git', () => {
  const run = () => { throw new Error('git called'); };
  const result = collectDev([prOf(1, 'abc', { isCrossRepository: true })], run, makeTree({}));
  assert.deepEqual(result, { entries: [], warnings: [] });
});

test('collectDev returns changed valid apps from a PR head', () => {
  const repo = gitRepo();
  const sha = repo.branch('pr4', { 'apps/new/index.html': '<p>hi</p>', 'apps/new/app.json': okJson, 'apps/new/docs/a.md': '' });
  const workDir = makeTree({});
  const { entries, warnings } = collectDev([prOf(4, sha)], repo.run, workDir);
  assert.deepEqual(warnings, []);
  assert.deepEqual(entries.map((e) => e.url), ['dev/pr-4/new/']);
  assert.equal(fs.readFileSync(path.join(workDir, 'pr-4', 'apps', 'new', 'index.html'), 'utf8'), '<p>hi</p>');
});

test('collectDev warns on invalid app.json in a PR and keeps going', () => {
  const repo = gitRepo();
  const bad = repo.branch('pr3', { 'apps/bad/index.html': '', 'apps/bad/app.json': '{}' });
  const good = repo.branch('pr5', { 'apps/good/index.html': '', 'apps/good/app.json': okJson });
  const { entries, warnings } = collectDev([prOf(3, bad), prOf(5, good)], repo.run, makeTree({}));
  assert.match(warnings.join('\n'), /^warning: PR #3 apps\/bad: app\.json needs a non-empty "name"/m);
  assert.deepEqual(entries.map((e) => e.slug), ['good']);
});

test('collectDev warns and continues when git fails for a PR', () => {
  const repo = gitRepo();
  const good = repo.branch('pr2', { 'apps/good/index.html': '', 'apps/good/app.json': okJson });
  const run = (args, opts) => {
    if (args[0] === 'fetch' && args.includes('pull/1/head')) throw Object.assign(new Error('Command failed'), { stderr: Buffer.from("fatal: couldn't find remote ref pull/1/head\n") });
    return repo.run(args, opts);
  };
  const { entries, warnings } = collectDev([prOf(1, 'deadbeef'), prOf(2, good)], run, makeTree({}));
  assert.deepEqual(warnings, ["warning: PR #1: fatal: couldn't find remote ref pull/1/head"]);
  assert.deepEqual(entries.map((e) => e.slug), ['good']);
});

test('assembleSite writes dev.json and filtered dev copies', () => {
  const root = makeTree({ 'index.html': '', 'directory.css': '', 'directory.js': '' });
  const workDir = makeTree({ 'pr-4/apps/new/index.html': '', 'pr-4/apps/new/docs/a.md': '', 'pr-4/apps/new/.claude/x': '' });
  const out = path.join(root, '_site');
  const dev = [{ ...meta('new'), updated: '2026-10-03T00:00:00Z', url: 'dev/pr-4/new/', pr: { number: 4, title: 'T', url: 'u' } }];
  assembleSite(root, out, [], dev, workDir);
  assert.ok(fs.existsSync(path.join(out, 'dev/pr-4/new/index.html')));
  assert.ok(!fs.existsSync(path.join(out, 'dev/pr-4/new/docs')));
  assert.ok(!fs.existsSync(path.join(out, 'dev/pr-4/new/.claude')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'dev.json'), 'utf8')), dev);
});

test('assembleSite writes empty dev.json without dev entries', () => {
  const root = makeTree({ 'index.html': '', 'directory.css': '', 'directory.js': '' });
  const out = path.join(root, '_site');
  assembleSite(root, out, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'dev.json'), 'utf8')), []);
});
