// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportCellPx, printBands } from '../js/export.js';

const ASPECT = (165 / 94) / (50 / 36);

test('default grid exports at 24 px beads', () => {
  assert.equal(exportCellPx(36, 94, ASPECT), 24);
});

test('large grids stay under the 16 MP canvas limit', () => {
  const px = exportCellPx(200, 400, ASPECT);
  assert.ok(px >= 8);
  assert.ok(px * 200 * px * 400.5 * ASPECT <= 16e6);
});

test('print bands cover every row once and each fits a page at full width', () => {
  for (const [columns, rows] of [[36, 94], [2, 2], [200, 400], [120, 10]]) {
    const { cellPx, bands } = printBands(columns, rows, ASPECT);
    assert.equal(bands[0][0], 0);
    assert.equal(bands.at(-1)[1], rows);
    for (let i = 1; i < bands.length; i++) assert.equal(bands[i][0], bands[i - 1][1]);
    const left = Math.max(28, cellPx * 1.4), top = Math.max(18, cellPx * 0.9);
    const width = Math.ceil(left + columns * cellPx + 8);
    for (const [a, b] of bands) {
      const height = Math.ceil(top + (b - a + 0.5) * cellPx * ASPECT + 8);
      assert.ok(height / width <= 1.25, `${columns}x${rows} band ${a}-${b}`);
      assert.ok(width * height <= 16e6);
    }
  }
});
