// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kmeans, matchPalette, dropColors } from '../js/quantize.js';
import { hexToLab } from '../js/color.js';

/** Small seeded PRNG so test inputs are stable. */
function rng(seed) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

const entry = (code, hex) => ({ code, name: code, hex, lab: hexToLab(hex) });

test('kmeans is deterministic for a fixed seed', () => {
  const r = rng(3);
  const labs = Array.from({ length: 200 }, () => [r() * 100, r() * 100 - 50, r() * 100 - 50]);
  const a = kmeans(labs, 5, 7);
  const b = kmeans(labs, 5, 7);
  assert.deepEqual([...a.assignments], [...b.assignments]);
});

test('kmeans separates two clear clusters', () => {
  const r = rng(5);
  const labs = [
    ...Array.from({ length: 50 }, () => [30 + r(), r(), r()]),
    ...Array.from({ length: 50 }, () => [80 + r(), r(), r()]),
  ];
  const { assignments } = kmeans(labs, 2, 1);
  const first = assignments[0];
  for (let i = 0; i < 50; i++) assert.equal(assignments[i], first);
  for (let i = 50; i < 100; i++) assert.notEqual(assignments[i], first);
});

test('flat input with k above distinct colours gives one clean centroid', () => {
  const labs = Array.from({ length: 100 }, () => [40, 10, -5]);
  const { centroids, assignments } = kmeans(labs, 12, 1);
  assert.equal(centroids.length, 1);
  assert.ok(centroids.flat().every(Number.isFinite));
  assert.ok([...assignments].every((a) => a === 0));
});

test('centroids snapping to the same Delica merge', () => {
  const palette = [entry('DB-10', '#000000'), entry('DB-200', '#FFFFFF')];
  const labs = [10, 25, 40, 60, 75, 90].flatMap((L) => Array.from({ length: 10 }, () => [L, 0, 0]));
  const { colors, assignments } = matchPalette(labs, 6, palette);
  assert.ok(colors.length <= 2);
  assert.ok([...assignments].every((a) => a >= 0 && a < colors.length));
  assert.equal(colors[assignments[0]].code, 'DB-10');
  assert.equal(colors[assignments[59]].code, 'DB-200');
});

test('one available colour fills the whole pattern', () => {
  const palette = [entry('DB-651', '#2F4A8A')];
  const r = rng(9);
  const labs = Array.from({ length: 40 }, () => [r() * 100, r() * 40, r() * 40]);
  const { colors, assignments } = matchPalette(labs, 8, palette);
  assert.equal(colors.length, 1);
  assert.ok([...assignments].every((a) => a === 0));
});

test('dropColors moves removed beads to the closest remaining colour', () => {
  const colors = [entry('DB-1', '#FF0000'), entry('DB-2', '#CC0000'), entry('DB-3', '#0000FF')];
  const labs = [hexToLab('#FF0000'), hexToLab('#D00000'), hexToLab('#0000FF'), hexToLab('#C80000')];
  const r = dropColors(labs, colors, Int32Array.from([0, 1, 2, 1]), new Set(['DB-2']));
  assert.deepEqual(r.colors.map((c) => c.code), ['DB-1', 'DB-3']);
  assert.deepEqual([...r.assignments], [0, 0, 1, 0]);
});

test('dropColors ignores unknown codes and never removes every colour', () => {
  const colors = [entry('DB-1', '#FF0000')];
  const assignments = Int32Array.from([0, 0]);
  const labs = [hexToLab('#FF0000'), hexToLab('#FF0000')];
  assert.equal(dropColors(labs, colors, assignments, new Set(['DB-9'])).colors, colors);
  assert.equal(dropColors(labs, colors, assignments, new Set(['DB-1'])).colors, colors);
});
