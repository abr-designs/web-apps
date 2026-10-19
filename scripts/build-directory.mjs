// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30
//
// Validates apps/*/app.json and games/*/game.json, writes apps.json and games.json, and assembles the Pages site.
// Usage: node scripts/build-directory.mjs [--out <dir>] [--dev <prs.json>]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const COLORS = ['teal', 'purple', 'coral', 'pink', 'amber', 'blue', 'gray'];
const SHELL_FILES = ['index.html', 'directory.css', 'directory.js'];
const LOGO_DIR = 'assets/logo'; // [Claude 2026-10-14]
const STRIPPED_DIRS = ['docs', 'tests', 'tools'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// [Claude 2026-10-19 start]
export const KINDS = {
  app: { dir: 'apps', meta: 'app.json', reserved: ['dev', 'games'] },
  game: { dir: 'games', meta: 'game.json', reserved: [] },
};
// [Claude 2026-10-19 end]

const isText = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Lowercases, trims, dedupes and sorts game tags. Returns an error when tags are missing, empty, or not slug-like.
 * @created Claude (claude-opus-5-5) 2026-10-19
 */
export function normalizeTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return { tags: [], error: 'needs a non-empty "tags" array' };
  const clean = tags.map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''));
  const bad = clean.find((t) => !SLUG.test(t));
  if (bad !== undefined) return { tags: [], error: `"tags" must be lowercase-with-dashes text, got ${JSON.stringify(tags[clean.indexOf(bad)])}` };
  return { tags: [...new Set(clean)].sort(), error: null };
}

/**
 * Validates every <kind dir>/<slug>/ folder in `rootDir`. A missing `rootDir` yields no entries.
 * @rewritten Claude (claude-opus-5-5) 2026-10-19
 */
export function collectEntries(rootDir, kind) {
  const { dir: kindDir, meta: metaFile, reserved } = KINDS[kind];
  const entries = [];
  const errors = [];
  if (!fs.existsSync(rootDir)) return { entries, errors };
  const dirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const slug of dirs) {
    const fail = (msg) => errors.push(`${kindDir}/${slug}: ${msg}`);
    const dir = path.join(rootDir, slug);
    const before = errors.length;

    if (!SLUG.test(slug)) fail('folder name must match lowercase-with-dashes (a-z, 0-9, -)');
    if (reserved.includes(slug)) fail(`folder name "${slug}" is reserved`);
    if (!fs.existsSync(path.join(dir, 'index.html'))) fail('missing index.html');

    const metaPath = path.join(dir, metaFile);
    let meta = null;
    if (!fs.existsSync(metaPath)) {
      fail(`missing ${metaFile}`);
    } else {
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
      } catch {
        fail(`${metaFile} is not valid JSON`);
      }
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed;
      else if (parsed !== undefined) fail(`${metaFile} must be a JSON object`);
    }

    let tags = null;
    if (meta) {
      if (!isText(meta.name)) fail(`${metaFile} needs a non-empty "name"`);
      if (!isText(meta.description)) fail(`${metaFile} needs a non-empty "description"`);
      if (meta.color !== undefined && !COLORS.includes(meta.color)) {
        fail(`"color" must be one of ${COLORS.join(', ')}`);
      }
      if (kind === 'game') {
        const result = normalizeTags(meta.tags);
        if (result.error) fail(`${metaFile} ${result.error}`);
        tags = result.tags;
      }
    }

    if (errors.length === before) {
      entries.push({
        slug,
        kind,
        name: meta.name.trim(),
        description: meta.description.trim(),
        icon: isText(meta.icon) ? meta.icon.trim() : null,
        color: meta.color ?? 'gray',
        ...(tags ? { tags } : {}),
      });
    }
  }

  return { entries, errors };
}

/**
 * Site-relative folder an entry is served from: "<slug>/" for apps, "games/<slug>/" for games.
 * @created Claude (claude-opus-5-5) 2026-10-19
 */
export function sitePath(entry) {
  return entry.kind === 'game' ? `games/${entry.slug}/` : `${entry.slug}/`;
}

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function gitUpdated(relPath, cwd) {
  const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', relPath], { cwd, encoding: 'utf8' });
  return out.trim() || null;
}

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function buildIndex(entries, getUpdated) {
  return entries
    .map((entry) => ({ ...entry, updated: getUpdated(entry), url: sitePath(entry) }))
    .sort((a, b) => {
      if (a.updated === b.updated) return a.slug.localeCompare(b.slug);
      if (a.updated === null) return 1;
      if (b.updated === null) return -1;
      return Date.parse(b.updated) - Date.parse(a.updated);
    });
}

/**
 * App and game slugs with at least one added or modified file in `git diff --name-status` output.
 * @created Claude (claude-opus-5-5) 2026-10-05
 */
export function changedSlugs(nameStatus) {
  const slugs = { app: new Set(), game: new Set() };
  const kindOf = { apps: 'app', games: 'game' };
  for (const line of nameStatus.split('\n')) {
    const [status, ...paths] = line.trim().split('\t');
    if (!status || paths.length === 0) continue;
    const kept = status === 'D' ? [] : /^[RC]/.test(status) ? paths.slice(1) : paths;
    for (const p of kept) {
      const match = p.match(/^(apps|games)\/([^/]+)\//);
      if (match) slugs[kindOf[match[1]]].add(match[2]);
    }
  }
  return { app: [...slugs.app].sort(), game: [...slugs.game].sort() };
}

/** @created Claude (claude-opus-5-5) 2026-10-05 */
export function buildDevIndex(prs, entriesByPr) {
  return prs
    .flatMap((pr) => (entriesByPr.get(pr.number) ?? []).map((entry) => ({
      ...entry,
      updated: pr.updatedAt,
      url: `dev/pr-${pr.number}/${sitePath(entry)}`,
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
 * Fetches each open PR head and validates the apps and games it adds or edits.
 * Files land in <workDir>/pr-<n>/apps/<slug> and <workDir>/pr-<n>/games/<slug>. Problems become warnings, never errors.
 * @created Claude (claude-opus-5-5) 2026-10-05
 */
export function collectDev(prs, run, workDir) {
  const entriesByPr = new Map();
  const warnings = [];

  for (const pr of prs) {
    if (pr.isCrossRepository) continue;
    const n = pr.number;
    let slugs;
    try {
      run(['fetch', '--no-tags', 'origin', `pull/${n}/head`]);
      slugs = changedSlugs(run(['diff', '--name-status', `HEAD...${pr.headRefOid}`, '--', 'apps/', 'games/']));
      for (const kind of Object.keys(KINDS)) {
        for (const slug of slugs[kind]) {
          const files = run(['ls-tree', '-r', '--name-only', pr.headRefOid, '--', `${KINDS[kind].dir}/${slug}/`]).split('\n').filter(Boolean);
          for (const file of files) {
            const dest = path.join(workDir, `pr-${n}`, file);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, run(['show', `${pr.headRefOid}:${file}`], { buffer: true }));
          }
        }
      }
    } catch (err) {
      warnings.push(`warning: PR #${n}: ${gitErrorLine(err)}`);
      continue;
    }
    if (slugs.app.length === 0 && slugs.game.length === 0) continue;

    const prEntries = [];
    for (const kind of Object.keys(KINDS)) {
      const { entries, errors } = collectEntries(path.join(workDir, `pr-${n}`, KINDS[kind].dir), kind);
      for (const e of errors) warnings.push(`warning: PR #${n} ${e}`);
      prEntries.push(...entries);
    }
    entriesByPr.set(n, prEntries);
  }

  return { entries: buildDevIndex(prs, entriesByPr), warnings };
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
export function assembleSite(rootDir, outDir, { apps = [], games = [] } = {}, devEntries = [], workDir = null) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of SHELL_FILES) fs.copyFileSync(path.join(rootDir, file), path.join(outDir, file));
  fs.cpSync(path.join(rootDir, LOGO_DIR), path.join(outDir, LOGO_DIR), { recursive: true }); // [Claude 2026-10-14]
  fs.writeFileSync(path.join(outDir, 'apps.json'), JSON.stringify(apps, null, 2));
  fs.writeFileSync(path.join(outDir, 'games.json'), JSON.stringify(games, null, 2)); // [Claude 2026-10-19]
  fs.writeFileSync(path.join(outDir, 'dev.json'), JSON.stringify(devEntries, null, 2));
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

  for (const entry of [...apps, ...games]) {
    copyApp(path.join(rootDir, KINDS[entry.kind].dir, entry.slug), path.join(outDir, entry.url));
  }
  for (const entry of devEntries) {
    copyApp(path.join(workDir, `pr-${entry.pr.number}`, KINDS[entry.kind].dir, entry.slug), path.join(outDir, entry.url));
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

  const apps = collectEntries(path.join(rootDir, 'apps'), 'app');
  const games = collectEntries(path.join(rootDir, 'games'), 'game');
  const errors = [...apps.errors, ...games.errors];
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    return 1;
  }

  const getUpdated = (entry) => gitUpdated(`${KINDS[entry.kind].dir}/${entry.slug}`, rootDir);
  const entries = { apps: buildIndex(apps.entries, getUpdated), games: buildIndex(games.entries, getUpdated) };
  for (const e of [...entries.apps, ...entries.games]) console.log(`${e.url}  ${e.updated ?? 'uncommitted'}  ${e.name}`);
  console.log(`${entries.apps.length} app(s), ${entries.games.length} game(s)`);

  let dev = { entries: [], warnings: [] };
  let workDir = null;
  if (devFile) {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-apps-dev-'));
    const prs = JSON.parse(fs.readFileSync(devFile, 'utf8').replace(/^﻿/, ''));
    dev = collectDev(prs, gitRunner(rootDir), workDir);
    for (const w of dev.warnings) console.log(w);
    for (const e of dev.entries) console.log(`PR #${e.pr.number}  ${e.url}  ${e.name}`);
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
