// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30
//
// Validates apps/*/app.json, writes apps.json, and assembles the Pages site.
// Usage: node scripts/build-directory.mjs [--out <dir>] [--dev <prs.json>]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const COLORS = ['teal', 'purple', 'coral', 'pink', 'amber', 'blue', 'gray'];
const SHELL_FILES = ['index.html', 'directory.css', 'directory.js'];
const STRIPPED_DIRS = ['docs', 'tests', 'tools'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isText = (v) => typeof v === 'string' && v.trim() !== '';

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function collectApps(appsDir) {
  const apps = [];
  const errors = [];
  const dirs = fs.readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const slug of dirs) {
    const fail = (msg) => errors.push(`apps/${slug}: ${msg}`);
    const dir = path.join(appsDir, slug);
    const before = errors.length;

    if (!SLUG.test(slug)) fail('folder name must match lowercase-with-dashes (a-z, 0-9, -)');
    if (!fs.existsSync(path.join(dir, 'index.html'))) fail('missing index.html');

    const metaPath = path.join(dir, 'app.json');
    let meta = null;
    if (!fs.existsSync(metaPath)) {
      fail('missing app.json');
    } else {
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
      } catch {
        fail('app.json is not valid JSON');
      }
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed;
      else if (parsed !== undefined) fail('app.json must be a JSON object');
    }

    if (meta) {
      if (!isText(meta.name)) fail('app.json needs a non-empty "name"');
      if (!isText(meta.description)) fail('app.json needs a non-empty "description"');
      if (meta.color !== undefined && !COLORS.includes(meta.color)) {
        fail(`"color" must be one of ${COLORS.join(', ')}`);
      }
    }

    if (errors.length === before) {
      apps.push({
        slug,
        name: meta.name.trim(),
        description: meta.description.trim(),
        icon: isText(meta.icon) ? meta.icon.trim() : null,
        color: meta.color ?? 'gray',
      });
    }
  }

  return { apps, errors };
}

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function gitUpdated(slug, cwd) {
  const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', `apps/${slug}`], { cwd, encoding: 'utf8' });
  return out.trim() || null;
}

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function buildIndex(apps, getUpdated) {
  return apps
    .map((app) => ({ ...app, updated: getUpdated(app.slug), url: `${app.slug}/` }))
    .sort((a, b) => {
      if (a.updated === b.updated) return a.slug.localeCompare(b.slug);
      if (a.updated === null) return 1;
      if (b.updated === null) return -1;
      return Date.parse(b.updated) - Date.parse(a.updated);
    });
}

/**
 * Slugs with at least one added or modified file in `git diff --name-status` output.
 * @created Claude (claude-opus-5-5) 2026-10-05
 */
export function changedSlugs(nameStatus) {
  const slugs = new Set();
  const slugOf = (p) => p.match(/^apps\/([^/]+)\//)?.[1];
  for (const line of nameStatus.split('\n')) {
    const [status, ...paths] = line.trim().split('\t');
    if (!status || paths.length === 0) continue;
    const kept = status === 'D' ? [] : /^[RC]/.test(status) ? paths.slice(1) : paths;
    for (const p of kept) {
      const slug = slugOf(p);
      if (slug) slugs.add(slug);
    }
  }
  return [...slugs].sort();
}

/** @created Claude (claude-opus-5-5) 2026-10-05 */
export function buildDevIndex(prs, appsByPr) {
  return prs
    .flatMap((pr) => (appsByPr.get(pr.number) ?? []).map((app) => ({
      ...app,
      updated: pr.updatedAt,
      url: `dev/pr-${pr.number}/${app.slug}/`,
      pr: { number: pr.number, title: pr.title, url: pr.url },
    })))
    .sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated)
      || b.pr.number - a.pr.number
      || a.slug.localeCompare(b.slug));
}

/** @created Claude (claude-opus-5-5) 2026-10-05 */
export function gitRunner(cwd) {
  return (args, opts = {}) => execFileSync('git', args, {
    cwd,
    encoding: opts.buffer ? 'buffer' : 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
}

function gitErrorLine(err) {
  const stderr = err.stderr ? err.stderr.toString().trim() : '';
  return (stderr || err.message).split('\n')[0];
}

/**
 * Fetches each open PR head and validates the apps it adds or edits.
 * App files land in <workDir>/pr-<n>/apps/<slug>. Problems become warnings, never errors.
 * @created Claude (claude-opus-5-5) 2026-10-05
 */
export function collectDev(prs, run, workDir) {
  const appsByPr = new Map();
  const warnings = [];

  for (const pr of prs) {
    if (pr.isCrossRepository) continue;
    const n = pr.number;
    const appsRoot = path.join(workDir, `pr-${n}`, 'apps');
    let slugs;
    try {
      run(['fetch', '--no-tags', 'origin', `pull/${n}/head`]);
      slugs = changedSlugs(run(['diff', '--name-status', `HEAD...${pr.headRefOid}`, '--', 'apps/']));
      for (const slug of slugs) {
        const files = run(['ls-tree', '-r', '--name-only', pr.headRefOid, '--', `apps/${slug}/`]).split('\n').filter(Boolean);
        for (const file of files) {
          const dest = path.join(workDir, `pr-${n}`, file);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, run(['show', `${pr.headRefOid}:${file}`], { buffer: true }));
        }
      }
    } catch (err) {
      warnings.push(`warning: PR #${n}: ${gitErrorLine(err)}`);
      continue;
    }
    if (slugs.length === 0) continue;

    const { apps, errors } = collectApps(appsRoot);
    for (const e of errors) warnings.push(`warning: PR #${n} ${e}`);
    appsByPr.set(n, apps);
  }

  return { entries: buildDevIndex(prs, appsByPr), warnings };
}

function copyApp(appDir, dest) {
  fs.cpSync(appDir, dest, {
    recursive: true,
    filter: (src) => {
      const parts = path.relative(appDir, src).split(path.sep).filter(Boolean);
      if (parts.some((p) => p.startsWith('.'))) return false;
      return !(parts.length > 0 && STRIPPED_DIRS.includes(parts[0]));
    },
  });
}

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function assembleSite(rootDir, outDir, entries, devEntries = [], workDir = null) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of SHELL_FILES) fs.copyFileSync(path.join(rootDir, file), path.join(outDir, file));
  fs.writeFileSync(path.join(outDir, 'apps.json'), JSON.stringify(entries, null, 2));
  fs.writeFileSync(path.join(outDir, 'dev.json'), JSON.stringify(devEntries, null, 2));
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

  for (const { slug } of entries) copyApp(path.join(rootDir, 'apps', slug), path.join(outDir, slug));
  for (const { slug, pr } of devEntries) {
    copyApp(path.join(workDir, `pr-${pr.number}`, 'apps', slug), path.join(outDir, 'dev', `pr-${pr.number}`, slug));
  }
}

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function resolveOutDir(rootDir, outDir) {
  const resolved = path.resolve(rootDir, outDir);
  const rel = path.relative(rootDir, resolved);
  if (rel === '' || path.isAbsolute(rel) || !rel.startsWith('_')) {
    throw new Error(`--out must be inside the repo in a folder starting with _, got ${outDir}`);
  }
  return resolved;
}

function main(argv) {
  const rootDir = process.cwd();
  const outIndex = argv.indexOf('--out');
  const outDir = outIndex === -1 ? null : argv[outIndex + 1];
  if (outIndex !== -1 && !outDir) {
    console.error('--out needs a directory');
    return 1;
  }
  const devIndex = argv.indexOf('--dev');
  const devFile = devIndex === -1 ? null : argv[devIndex + 1];
  if (devIndex !== -1 && !devFile) {
    console.error('--dev needs a PR list file');
    return 1;
  }

  const { apps, errors } = collectApps(path.join(rootDir, 'apps'));
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    return 1;
  }

  const entries = buildIndex(apps, (slug) => gitUpdated(slug, rootDir));
  for (const e of entries) console.log(`${e.slug}  ${e.updated ?? 'uncommitted'}  ${e.name}`);
  console.log(`${entries.length} app(s)`);

  let dev = { entries: [], warnings: [] };
  let workDir = null;
  if (devFile) {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-apps-dev-'));
    const prs = JSON.parse(fs.readFileSync(devFile, 'utf8').replace(/^﻿/, ''));
    dev = collectDev(prs, gitRunner(rootDir), workDir);
    for (const w of dev.warnings) console.log(w);
    for (const e of dev.entries) console.log(`PR #${e.pr.number}  ${e.slug}  ${e.name}`);
    console.log(`${dev.entries.length} in development`);
  }

  if (outDir) {
    const target = resolveOutDir(rootDir, outDir);
    fs.rmSync(target, { recursive: true, force: true });
    assembleSite(rootDir, target, entries, dev.entries, workDir);
    console.log(`Site written to ${outDir}`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
