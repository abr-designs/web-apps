// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, rgbToLab, hexToLab, deltaE2000, textColorFor, dominantRgb } from '../js/color.js';

const near = (a, b, eps) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('hexToRgb', () => {
  assert.deepEqual(hexToRgb('#3B4C9B'), [59, 76, 155]);
});

test('white and black in Lab', () => {
  const w = rgbToLab([255, 255, 255]);
  near(w[0], 100, 0.01); near(w[1], 0, 0.01); near(w[2], 0, 0.01);
  assert.deepEqual(rgbToLab([0, 0, 0]).map((v) => Math.round(v * 100) / 100), [0, 0, 0]);
  near(hexToLab('#FFFFFF')[0], 100, 0.01);
});

test('CIEDE2000 matches Sharma, Wu, Dalal test pairs', () => {
  near(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]), 2.0425, 1e-4);
  near(deltaE2000([50, 2.5, 0], [50, 0, -2.5]), 4.3065, 1e-4);
  near(deltaE2000([60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387]), 1.2644, 1e-4);
  near(deltaE2000([22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619]), 2.0373, 1e-4);
  assert.equal(deltaE2000([50, 10, 10], [50, 10, 10]), 0);
});

test('text colour by lightness', () => {
  assert.equal(textColorFor([90, 0, 0]), '#000000');
  assert.equal(textColorFor([20, 0, 0]), '#FFFFFF');
});

test('dominantRgb picks the majority side of an edge', () => {
  const samples = [...Array(5).fill([200, 30, 30]), [205, 28, 31], ...Array(3).fill([20, 20, 200])];
  const [r, g, b] = dominantRgb(samples);
  near(r, (200 * 5 + 205) / 6, 1e-9); near(g, (30 * 5 + 28) / 6, 1e-9); near(b, (30 * 5 + 31) / 6, 1e-9);
  assert.deepEqual(dominantRgb([[10, 20, 30]]), [10, 20, 30]);
});
