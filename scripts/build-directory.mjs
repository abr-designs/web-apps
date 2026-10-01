// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30
//
// Validates apps/*/app.json, writes apps.json, and assembles the Pages site.
// Usage: node scripts/build-directory.mjs [--out <dir>]

import fs from 'node:fs';
import path from 'node:path';

export const COLORS = ['teal', 'purple', 'coral', 'pink', 'amber', 'blue', 'gray'];
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
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch {
        fail('app.json is not valid JSON');
      }
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
