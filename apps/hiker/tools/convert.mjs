// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// One-time import: data/source/Local.csv + Database.csv -> data/hikes.json.
// Run from the repo root: node tools/convert.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const TAGS = ['WATERFALLS', 'BIG_TREES', 'WILDFLOWERS', 'SWIMMING', 'COASTAL_VIEWS', 'MOUNTAIN_VIEWS', 'HISTORY', 'GEOLOGY'];
const ACCESS = ['Ferry', '4x4', 'Kayak'];

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function decodeBits(mask, names) {
  const n = Number(mask) || 0;
  return names.filter((_, i) => n & (1 << i));
}

const key = s => s.trim().toLowerCase();
const slug = s => key(s).replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleCase = s => s.trim().replace(/(^|\s)([a-z])/g, (_, sp, c) => sp + c.toUpperCase());
const num = s => (s === '' ? undefined : Number(s));

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function convert(localRows, dbRows, log = console.log) {
  const db = new Map(dbRows.map(r => [key(r['Trail Name']), r]));
  const ids = new Set();
  const hikes = [];

  for (const l of localRows) {
    if (!l['Trail Name'].trim()) continue;
    const d = db.get(key(l['Trail Name']));
    if (d) db.delete(key(l['Trail Name']));
    else log(`unmatched in Database: ${l['Trail Name']}`);

    const name = titleCase(d?.['Trail Name'] || l['Trail Name']);
    let id = slug(name);
    while (ids.has(id)) id += '-2';
    ids.add(id);

    const hike = {
      id, name,
      allTrails: l['All Trails'] || d?.['All Trails'] || undefined,
      lat: num(d?.Latitude ?? ''), lon: num(d?.Longitude ?? ''),
      lengthKm: num(l['Length (km)']), timeHrs: num(l['Time (hrs)']), gainM: num(l['Elavation Gain (m)']),
      difficulty: num(l.Difficulty), quality: num(l.Quality), accessibility: num(l.Accessibility),
      months: d ? decodeBits(d.Months, MONTHS) : undefined,
      tags: d ? decodeBits(d.Tags, TAGS) : [],
      access: d ? decodeBits(d.Offroading, ACCESS) : [],
      country: /USA/.test(l.Restrictions) ? 'US' : 'CA',
      notes: l['When To Visit'] || undefined,
    };

    if (d) {
      for (const [field, col] of [['lengthKm', 'Length (km)'], ['timeHrs', 'Time (hrs)'], ['gainM', 'Elevation Gain (m)'], ['difficulty', 'Difficulty'], ['quality', 'Quality']]) {
        if (d[col] !== '' && Number(d[col]) !== hike[field]) log(`conflict ${name}.${field}: Local ${hike[field]}, Database ${d[col]} (Local kept)`);
      }
    }
    hikes.push(hike);
  }
  for (const d of db.values()) log(`in Database only (skipped): ${d['Trail Name']}`);
  return hikes;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = f => parseCsv(readFileSync(new URL(`../data/source/${f}`, import.meta.url), 'utf8'));
  const hikes = convert(read('Local.csv'), read('Database.csv'));
  writeFileSync(new URL('../data/hikes.json', import.meta.url), JSON.stringify(hikes, null, 2) + '\n');
  console.log(`wrote ${hikes.length} hikes to data/hikes.json`);
}
