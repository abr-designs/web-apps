// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30
//
// Validates apps/*/app.json, writes apps.json, and assembles the Pages site.
// Usage: node scripts/build-directory.mjs [--out <dir>]

import fs from 'node:fs';
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

/** @created Claude (claude-opus-5-5) 2026-09-30 */
export function assembleSite(rootDir, outDir, entries) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of SHELL_FILES) fs.copyFileSync(path.join(rootDir, file), path.join(outDir, file));
  fs.writeFileSync(path.join(outDir, 'apps.json'), JSON.stringify(entries, null, 2));
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

  for (const { slug } of entries) {
    const appDir = path.join(rootDir, 'apps', slug);
    fs.cpSync(appDir, path.join(outDir, slug), {
      recursive: true,
      filter: (src) => {
        const parts = path.relative(appDir, src).split(path.sep).filter(Boolean);
        if (parts.some((p) => p.startsWith('.'))) return false;
        return !(parts.length > 0 && STRIPPED_DIRS.includes(parts[0]));
      },
    });
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

  const { apps, errors } = collectApps(path.join(rootDir, 'apps'));
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    return 1;
  }

  const entries = buildIndex(apps, (slug) => gitUpdated(slug, rootDir));
  for (const e of entries) console.log(`${e.slug}  ${e.updated ?? 'uncommitted'}  ${e.name}`);
  console.log(`${entries.length} app(s)`);

  if (outDir) {
    const target = resolveOutDir(rootDir, outDir);
    fs.rmSync(target, { recursive: true, force: true });
    assembleSite(rootDir, target, entries);
    console.log(`Site written to ${outDir}`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
