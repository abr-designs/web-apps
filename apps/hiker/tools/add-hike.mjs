// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Appends one hike to data/hikes.json, checked with the same rules as the in-app form.
// Run from the repo root: node tools/add-hike.mjs --file hike.json [--dry-run]
//   or: node tools/add-hike.mjs --json '{"name": "...", ...}' [--dry-run]

import { readFileSync, writeFileSync } from 'node:fs';
import { buildHike } from '../js/customHikes.js';

const HIKES = new URL('../data/hikes.json', import.meta.url);

const args = process.argv.slice(2);
const value = flag => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const source = value('--file') ? readFileSync(value('--file'), 'utf8') : value('--json');
if (!source) {
  console.error('Usage: node tools/add-hike.mjs (--file hike.json | --json \'{...}\') [--dry-run]');
  process.exit(2);
}

try {
  const hikes = JSON.parse(readFileSync(HIKES, 'utf8'));
  const hike = buildHike(JSON.parse(source), new Set(hikes.map(h => h.id)));
  const list = [...hikes, hike];
  console.log(JSON.stringify(hike, null, 2));
  if (args.includes('--dry-run')) {
    console.log('dry run: data/hikes.json not changed');
  } else {
    writeFileSync(HIKES, JSON.stringify(list, null, 2) + '\n');
    console.log(`added ${hike.id} (${list.length} hikes)`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
