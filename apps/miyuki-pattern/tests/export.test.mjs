// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportCellPx } from '../js/export.js';

const ASPECT = (165 / 94) / (50 / 36);

test('default grid exports at 24 px beads', () => {
  assert.equal(exportCellPx(36, 94, ASPECT), 24);
});

test('large grids stay under the 16 MP canvas limit', () => {
  const px = exportCellPx(200, 400, ASPECT);
  assert.ok(px >= 8);
  assert.ok(px * 200 * px * 400.5 * ASPECT <= 16e6);
});
