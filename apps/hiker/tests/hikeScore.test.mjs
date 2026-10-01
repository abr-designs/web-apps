// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Regression: every Local sheet row must reproduce its sheet Score.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../tools/convert.mjs';
import { hikeScore } from '../js/hikeScore.js';

const rows = parseCsv(readFileSync(new URL('../data/source/Local.csv', import.meta.url), 'utf8'))
  .filter(r => r['Trail Name'].trim());

test('hikeScore matches every Local sheet Score to 2 decimals', () => {
  assert.equal(rows.length, 64);
  const mismatches = rows.filter(r => {
    const score = hikeScore({
      lengthKm: +r['Length (km)'], timeHrs: +r['Time (hrs)'], gainM: +r['Elavation Gain (m)'],
      difficulty: +r.Difficulty, quality: +r.Quality, accessibility: +r.Accessibility,
    });
    return score.toFixed(2) !== Number(r.Score).toFixed(2);
  });
  assert.deepEqual(mismatches.map(r => r['Trail Name']), []);
});
