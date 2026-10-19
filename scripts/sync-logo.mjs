// Created by Claude (claude-opus-5-5)
// Date: 2026-10-14
//
// Copies assets/logo/ into every apps/<slug>/logo/ and games/<slug>/logo/, since each one deploys only its own folder.
// Usage: node scripts/sync-logo.mjs [--check]
// --check changes nothing and exits 1 when an app's or game's copy is stale or a top-level page lacks the logo.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const LINK = 'logo/logo.css';
const IMG = 'logo/senor_claude.png';
const FOLDERS = ['apps', 'games']; // [Claude 2026-10-19]

/** @created Claude (claude-opus-5-5) 2026-10-14 */
export function syncLogo(rootDir, { check = false } = {}) {
  const masterDir = path.join(rootDir, 'assets', 'logo');
  const masterFiles = fs.readdirSync(masterDir);
  const problems = [];

  const targets = FOLDERS
    .filter((folder) => fs.existsSync(path.join(rootDir, folder)))
    .flatMap((folder) => fs.readdirSync(path.join(rootDir, folder), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `${folder}/${d.name}`)
      .sort());

  for (const target of targets) {
    const targetDir = path.join(rootDir, target);
    for (const file of masterFiles) {
      const src = path.join(masterDir, file);
      const dest = path.join(targetDir, 'logo', file);
      if (fs.existsSync(dest) && fs.readFileSync(src).equals(fs.readFileSync(dest))) continue;
      if (check) {
        problems.push(`${target}/logo/${file} is missing or out of date`);
      } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }

    for (const page of fs.readdirSync(targetDir).filter((f) => f.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(targetDir, page), 'utf8');
      if (!html.includes(LINK) || !html.includes(IMG)) {
        problems.push(`${target}/${page} must link ${LINK} and show ${IMG}`);
      }
    }
  }

  return problems;
}

function main(argv) {
  const problems = syncLogo(process.cwd(), { check: argv.includes('--check') });
  for (const p of problems) console.error(p);
  return problems.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
