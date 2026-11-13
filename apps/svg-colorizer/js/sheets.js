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

const SNAP_PX = 8; // how far a click may land from a piece and still pick it

/**
 * Returns the index of the set mask pixel nearest (x, y) within SNAP_PX, or -1.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function snapToMask(mask, w, h, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best = -1;
  let bestD = Infinity;
  for (let py = Math.max(0, cy - SNAP_PX); py <= Math.min(h - 1, cy + SNAP_PX); py++) {
    for (let px = Math.max(0, cx - SNAP_PX); px <= Math.min(w - 1, cx + SNAP_PX); px++) {
      if (!mask[py * w + px]) continue;
      const d = (px - cx) ** 2 + (py - cy) ** 2;
      if (d < bestD && d <= SNAP_PX * SNAP_PX) {
        bestD = d;
        best = py * w + px;
      }
    }
  }
  return best;
}

/** Index of the pixel in component id nearest pixel p. @created Claude (claude-opus-5-5) 2026-11-13 */
function nearestInComp(comp, id, w, p) {
  const x = p % w;
  const y = (p / w) | 0;
  let best = -1;
  let bestD = Infinity;
  for (let q = 0; q < comp.length; q++) {
    if (comp[q] !== id) continue;
    const d = (q % w - x) ** 2 + (((q / w) | 0) - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/** Squared distance from (px, py) to segment [ax, ay, bx, by]. @created Claude (claude-opus-5-5) 2026-11-13 */
export function segDist2(px, py, [ax, ay, bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return (ax + t * dx - px) ** 2 + (ay + t * dy - py) ** 2;
}

/**
 * Adds bridges to a sheet mask in place. Each bridge {ax, ay, bx, by} names two clicked points; the strip
 * runs between the nearest points of the two pieces under them, widthPx wide. Bridges apply in order, so
 * a later one sees pieces joined by an earlier one. Returns one drawn segment per bridge, in pixel-center
 * coordinates, or null when a point misses the sheet or both points already sit on one piece.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function applyBridges(mask, w, h, bridges, widthPx) {
  // At least 0.75 px so a 1 px diagonal strip still joins 4-connected pixels.
  const r = Math.max(0.75, widthPx / 2);
  return bridges.map((b) => {
    const pa = snapToMask(mask, w, h, b.ax, b.ay);
    const pb = snapToMask(mask, w, h, b.bx, b.by);
    if (pa < 0 || pb < 0) return null;
    const { comp, sizes } = components(mask, w, h);
    if (comp[pa] === comp[pb]) return null;
    // Alternate nearest-point steps, starting from the click on the larger piece: any point of a small
    // island is near, so the click on the larger piece is the one that says where the strip should land.
    const [big, small] = sizes[comp[pa]] >= sizes[comp[pb]] ? [pa, pb] : [pb, pa];
    let a = big;
    let q = big;
    for (let i = 0; i < 3; i++) {
      q = nearestInComp(comp, comp[small], w, a);
      a = nearestInComp(comp, comp[big], w, q);
    }
    const seg = [a % w + 0.5, ((a / w) | 0) + 0.5, q % w + 0.5, ((q / w) | 0) + 0.5];
    const x0 = Math.max(0, Math.floor(Math.min(seg[0], seg[2]) - r));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(seg[0], seg[2]) + r));
    const y0 = Math.max(0, Math.floor(Math.min(seg[1], seg[3]) - r));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(seg[1], seg[3]) + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (segDist2(x + 0.5, y + 0.5, seg) <= r * r) mask[y * w + x] = 1;
      }
    }
    return seg;
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
