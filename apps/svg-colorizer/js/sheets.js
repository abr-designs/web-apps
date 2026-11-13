// Created by Claude (claude-opus-5-5)
// Date: 2026-11-13
// Builds each sheet's shape from the label map and stack order, and finds islands.

import { components } from './quantize.js';

/**
 * Returns one 0/1 mask per sheet, back to front. Sheet 0 is uncut; sheet i keeps every pixel whose
 * palette color sits at stack position i or further forward. A frame of framePx is added to sheets 1+.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function sheetMasks(labels, w, h, order, framePx) {
  const rank = new Int16Array(Math.max(...order) + 1);
  order.forEach((color, i) => { rank[color] = i; });
  return order.map((_, i) => {
    const mask = new Uint8Array(w * h);
    for (let p = 0; p < mask.length; p++) mask[p] = i === 0 || rank[labels[p]] >= i ? 1 : 0;
    if (i > 0 && framePx > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (x < framePx || y < framePx || x >= w - framePx || y >= h - framePx) mask[y * w + x] = 1;
        }
      }
    }
    return mask;
  });
}

/**
 * Finds islands: pieces of a sheet that are not part of its main piece (the frame when framePx > 0,
 * otherwise the largest piece). Returns a 0/1 island mask and the island count.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function findIslands(mask, w, h, framePx) {
  const { comp, sizes, first, count } = components(mask, w, h);
  let main = -1;
  if (framePx > 0) {
    main = comp[0];
  } else {
    for (let c = 0; c < count; c++) {
      if (mask[first[c]] === 1 && (main < 0 || sizes[c] > sizes[main])) main = c;
    }
  }
  const isIsland = new Uint8Array(count);
  let islands = 0;
  for (let c = 0; c < count; c++) {
    if (mask[first[c]] === 1 && c !== main) {
      isIsland[c] = 1;
      islands++;
    }
  }
  const islandMask = new Uint8Array(w * h);
  if (islands) for (let p = 0; p < islandMask.length; p++) islandMask[p] = isIsland[comp[p]];
  return { islandMask, count: islands };
}
