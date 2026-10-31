// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
// One-off: converts craft-color-codes' miyuki-delica.json into data/delica.json.
// Usage: node apps/miyuki-pattern/tools/build-catalog.mjs <path to miyuki-delica.json>

import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeCode } from '../js/catalog.js';

const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const key = (code) => {
  const [, n, suffix] = code.match(/^DB-(\d+)([A-Z]?)$/);
  return Number(n) * 100 + (suffix ? suffix.charCodeAt(0) : 0);
};

const colors = src.colors
  .map((c) => ({
    code: normalizeCode(c.code),
    name: c.name,
    hex: c.hex.toUpperCase(),
    ...(c.discontinued ? { discontinued: true } : {}),
  }))
  .sort((a, b) => key(a.code) - key(b.code));

const out = {
  source: 'https://github.com/makebead/craft-color-codes (data/json/miyuki-delica.json)',
  license: src.license,
  attribution: 'Color data: craft-color-codes by MakeBead (https://makebead.com)',
  notes: src.notes,
  colors,
};

writeFileSync(new URL('../data/delica.json', import.meta.url), JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{') + '\n');
console.log(`Wrote ${colors.length} colours`);
