// Created by Claude (claude-opus-5-5)
// Date: 2026-11-13
// Run with: node --test apps/svg-colorizer/tests/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { components, imageToLab, kmeans, mergeSmallPieces, modeFilter } from '../js/quantize.js';
import { applyBridges, applyCuts, eraseIslands, sheetMasks, findIslands } from '../js/sheets.js';
import { traceMask, maskToPath } from '../js/trace.js';

const grid = (rows) => Uint8Array.from(rows.join('').split('').map(Number));

/** Signed shoelace area of a flat vertex loop. @created Claude (claude-opus-5-5) 2026-11-13 */
const area = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
  }
  return a / 2;
};

test('single pixel traces to one 4-vertex loop', () => {
  const loops = traceMask(grid(['000', '010', '000']), 3, 3);
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 8);
});

test('ring traces outer and hole with opposite winding', () => {
  const loops = traceMask(grid(['111', '101', '111']), 3, 3);
  assert.equal(loops.length, 2);
  const [a, b] = loops.map(area);
  assert.ok(Math.sign(a) !== Math.sign(b));
  assert.equal(Math.abs(a) + Math.abs(b), 10);
});

test('diagonal pixels trace as two separate loops', () => {
  const loops = traceMask(grid(['10', '01']), 2, 2);
  assert.equal(loops.length, 2);
  loops.forEach((l) => assert.equal(Math.abs(area(l)), 1));
});

test('sheet masks: back uncut, front keeps only forward colors plus frame', () => {
  const labels = grid(['0000', '0120', '0000']);
  const [back, mid, front] = sheetMasks(labels, 4, 3, [0, 1, 2], 0);
  assert.ok(back.every((v) => v === 1));
  assert.deepEqual([...mid], [...grid(['0000', '0110', '0000'])]);
  assert.deepEqual([...front], [...grid(['0000', '0010', '0000'])]);
  const framed = sheetMasks(labels, 4, 3, [0, 1, 2], 1)[2];
  assert.deepEqual([...framed], [...grid(['1111', '1011', '1111'])]);
});

test('islands: piece not touching the frame is one island', () => {
  const mask = grid(['11111', '10001', '10101', '10001', '11111']);
  assert.equal(findIslands(mask, 5, 5, 1).count, 1);
  assert.equal(findIslands(grid(['11111', '11111']), 5, 2, 1).count, 0);
});

test('small piece merges into its neighbour', () => {
  const labels = grid(['000', '010', '000']);
  mergeSmallPieces(labels, 3, 3, 2);
  assert.ok(labels.every((v) => v === 0));
  assert.equal(components(labels, 3, 3).count, 1);
});

test('mode filter removes a lone pixel', () => {
  const out = modeFilter(grid(['000', '010', '000']), 3, 3, 2, 1);
  assert.ok(out.every((v) => v === 0));
});

test('maskToPath emits closed subpaths', () => {
  const d = maskToPath(grid(['111', '101', '111']), 3, 3, 2);
  assert.equal((d.match(/Z/g) || []).length, 2);
  assert.ok(d.startsWith('M'));
});

test('a bridge joins two pieces into one', () => {
  const mask = grid(['11000', '11000', '00000', '00011', '00011']);
  const segs = applyBridges(mask, 5, 5, [{ ax: 0.5, ay: 0.5, bx: 4.5, by: 4.5 }], 1);
  assert.ok(segs[0]);
  const { comp } = components(mask, 5, 5);
  assert.equal(comp[0], comp[24]);
});

test('a bridge within one piece or off the sheet is skipped', () => {
  const mask = grid(['11100', '00000', '00000']);
  const before = mask.slice();
  const segs = applyBridges(mask, 5, 3, [{ ax: 0.5, ay: 0.5, bx: 2.5, by: 0.5 }], 1);
  assert.equal(segs[0], null);
  assert.deepEqual(mask, before);
  assert.equal(applyBridges(new Uint8Array(400), 20, 20, [{ ax: 1, ay: 1, bx: 18, by: 18 }], 1)[0], null);
});

test('a cut removes paper and a restore stroke puts it back', () => {
  const mask = new Uint8Array(25).fill(1);
  applyCuts(mask, 5, 5, [{ pts: [0.5, 2.5, 4.5, 2.5], r: 0.5 }]);
  assert.deepEqual([...mask], [...grid(['11111', '11111', '00000', '11111', '11111'])]);
  const again = new Uint8Array(25).fill(1);
  applyCuts(again, 5, 5, [{ pts: [0.5, 2.5, 4.5, 2.5], r: 0.5 }, { pts: [2.5, 2.5], r: 0.5, restore: true }]);
  assert.deepEqual([...again], [...grid(['11111', '11111', '00100', '11111', '11111'])]);
});

test('erasing removes the clicked island and leaves the main piece', () => {
  const mask = grid(['11111', '10001', '10101', '10001', '11111']);
  const { seeds } = findIslands(mask, 5, 5, 1);
  assert.deepEqual(seeds, [12]);
  assert.equal(eraseIslands(mask, 5, 5, [0], 1), 0);
  assert.equal(eraseIslands(mask, 5, 5, seeds, 1), 1);
  assert.equal(findIslands(mask, 5, 5, 1).count, 0);
  assert.equal(mask[0], 1);
});

test('focus pixels keep their label through smoothing and merging', () => {
  const keep = grid(['000', '010', '000']);
  assert.equal(modeFilter(grid(['000', '010', '000']), 3, 3, 2, 1, keep)[4], 1);
  const labels = grid(['000', '010', '000']);
  mergeSmallPieces(labels, 3, 3, 2, keep, 1);
  assert.equal(labels[4], 1);
});

test('a focus area pulls a palette color toward its pixels', () => {
  // Three equal gray bands and a 2x2 red speck in the corner, which three colors normally leave out.
  const w = 60;
  const bands = [[20, 20, 20], [128, 128, 128], [235, 235, 235]];
  const rgba = new Uint8ClampedArray(w * w * 4);
  for (let p = 0; p < w * w; p++) {
    const red = p % w < 2 && p < 2 * w;
    rgba.set([...(red ? [200, 60, 60] : bands[Math.floor((p % w) / 20)]), 255], p * 4);
  }
  const lab = imageToLab(rgba);
  const focus = new Uint8Array(w * w);
  [0, 1, w, w + 1].forEach((p) => { focus[p] = 1; });
  const hasRed = (palette) => palette.some(([r, g]) => r - g > 100);
  assert.ok(!hasRed(kmeans(lab, rgba, 3)));
  assert.ok(hasRed(kmeans(lab, rgba, 3, 1, focus)));
});

test('a frame cut at its corner still counts as the main piece', () => {
  const mask = grid(['01111', '10001', '10101', '10001', '11111']);
  const { count, seeds } = findIslands(mask, 5, 5, 1);
  assert.equal(count, 1);
  assert.deepEqual(seeds, [12]);
});
