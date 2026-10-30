// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { letterFor, buildPattern } from '../js/pattern.js';

const PACK = { beads: 1000, grams: 5, price: 10 };
const colors = [
  { code: 'DB-10', name: 'Black', hex: '#000000', lab: [0, 0, 0] },
  { code: 'DB-651', name: 'Blue', hex: '#2F4A8A', lab: [32, 10, -38] },
];

test('letters', () => {
  assert.equal(letterFor(0), 'A');
  assert.equal(letterFor(25), 'Z');
});

test('legend sorted by count, cells remapped to legend order', () => {
  const assignments = Int32Array.from([0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1]);
  const p = buildPattern({ columns: 4, rows: 3, assignments, colors, pack: PACK });
  assert.equal(p.legend[0].letter, 'A');
  assert.equal(p.legend[0].code, 'DB-651');
  assert.equal(p.legend[0].count, 9);
  assert.equal(p.legend[1].count, 3);
  assert.deepEqual([...p.cells], [1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0]);
  assert.equal(p.totals.count, 12);
});

test('per-row counts alternate direction and sum to columns', () => {
  const assignments = Int32Array.from([0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1]);
  const p = buildPattern({ columns: 4, rows: 3, assignments, colors, pack: PACK });
  assert.deepEqual(p.rowCounts[0], { row: 1, direction: '→', counts: [{ letter: 'A', count: 3 }, { letter: 'B', count: 1 }] });
  assert.equal(p.rowCounts[1].direction, '←');
  assert.deepEqual(p.rowCounts[2].counts, [{ letter: 'A', count: 4 }]);
  for (const r of p.rowCounts) assert.equal(r.counts.reduce((s, c) => s + c.count, 0), 4);
});

test('grams, packs and cost', () => {
  const one = (n) => buildPattern({ columns: n, rows: 1, assignments: new Int32Array(n), colors: [colors[0]], pack: PACK }).legend[0];
  const pick = ({ grams, packs, cost }) => ({ grams, packs, cost });
  assert.deepEqual(pick(one(1000)), { grams: 5, packs: 1, cost: 10 });
  assert.deepEqual(pick(one(1001)), { grams: 5, packs: 2, cost: 20 });
  assert.deepEqual(pick(one(240)), { grams: 1.2, packs: 1, cost: 10 });
});
