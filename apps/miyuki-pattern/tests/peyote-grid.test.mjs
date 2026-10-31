// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, clampCounts, countsFromSize, sizeFromCounts,
  parityOf, applyParity, frameSize, beadCells, footprint,
} from '../js/peyote-grid.js';

const PX = DEFAULTS.pitchXmm;
const PY = DEFAULTS.pitchYmm;

test('default size maps to 36 x 94 and back', () => {
  assert.deepEqual(countsFromSize(5, 16.5, PX, PY), { columns: 36, rows: 94 });
  const size = sizeFromCounts(36, 94, PX, PY);
  assert.ok(Math.abs(size.widthCm - 5) < 1e-9);
  assert.ok(Math.abs(size.heightCm - 16.5) < 1e-9);
});

test('parity', () => {
  assert.equal(parityOf(36), 'even');
  assert.equal(parityOf(37), 'odd');
  assert.equal(applyParity(36, 'odd'), 37);
  assert.equal(applyParity(37, 'odd'), 37);
  assert.equal(applyParity(37, 'even'), 38);
});

test('bead cells are row-major with half-bead offset on odd columns', () => {
  const cells = beadCells(36, 94);
  assert.equal(cells.length, 3384);
  assert.equal(cells[0].y, 0.5);
  assert.equal(cells[1].y, 1);
  assert.deepEqual({ col: cells[36].col, row: cells[36].row }, { col: 0, row: 1 });
  assert.deepEqual(frameSize(36, 94), { w: 36, h: 94.5 });
});

test('footprint scales with detail', () => {
  const cell = beadCells(2, 2)[0];
  assert.ok(Math.abs(footprint(cell, 100).w - 0.3) < 1e-9);
  assert.equal(footprint(cell, 0).w, 1);
  const f = footprint(cell, 0);
  assert.equal(f.x, 0);
  assert.equal(f.y, 0);
});

test('junk counts clamp', () => {
  assert.deepEqual(clampCounts({ columns: 0, rows: 9999 }), { columns: 2, rows: 400 });
  assert.deepEqual(clampCounts({ columns: NaN, rows: 'x' }), { columns: 36, rows: 94 });
  assert.deepEqual(countsFromSize(0.01, 500, PX, PY), { columns: 2, rows: 400 });
});

test('blank counts keep the current value', () => {
  assert.deepEqual(clampCounts({ columns: '', rows: ' ' }, { columns: 40, rows: 80 }), { columns: 40, rows: 80 });
  assert.deepEqual(clampCounts({ columns: '', rows: 50 }), { columns: 36, rows: 50 });
});
