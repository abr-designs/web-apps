// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
// k-means in CIELAB, then snapping cluster centres to the closest available Delica.

import { deltaE2000 } from './color.js';

const MAX_ITERATIONS = 20;

/** Seeded PRNG (mulberry32) so the same photo always gives the same pattern. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Squared Euclidean distance in Lab. */
function dist2(p, q) {
  const d0 = p[0] - q[0], d1 = p[1] - q[1], d2 = p[2] - q[2];
  return d0 * d0 + d1 * d1 + d2 * d2;
}

/** Index of the nearest centroid. */
function nearest(p, centroids) {
  let best = 0, bestD = Infinity;
  for (let c = 0; c < centroids.length; c++) {
    const d = dist2(p, centroids[c]);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** k-means++ seeding; stops early when every point already sits on a centre. */
function seedCentroids(labs, k, random) {
  const centroids = [labs[Math.floor(random() * labs.length)].slice()];
  const d = labs.map((p) => dist2(p, centroids[0]));
  while (centroids.length < k) {
    const total = d.reduce((s, v) => s + v, 0);
    if (total === 0) break;
    let target = random() * total;
    let pick = 0;
    while (pick < labs.length - 1 && target >= d[pick]) target -= d[pick++];
    centroids.push(labs[pick].slice());
    for (let i = 0; i < labs.length; i++) d[i] = Math.min(d[i], dist2(labs[i], labs[pick]));
  }
  return centroids;
}

/** Clusters Lab colours into at most k groups. Empty clusters are dropped. */
export function kmeans(labs, k, seed = 1) {
  const random = mulberry32(seed);
  let centroids = seedCentroids(labs, Math.max(1, Math.min(k, labs.length)), random);
  let assignments = new Int32Array(labs.length).fill(-1);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;
    for (let i = 0; i < labs.length; i++) {
      const c = nearest(labs[i], centroids);
      if (c !== assignments[i]) { assignments[i] = c; changed = true; }
    }
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < labs.length; i++) {
      const s = sums[assignments[i]], p = labs[i];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    const remap = new Int32Array(centroids.length).fill(-1);
    const next = [];
    sums.forEach((s, c) => {
      if (s[3] === 0) return;
      remap[c] = next.length;
      next.push([s[0] / s[3], s[1] / s[3], s[2] / s[3]]);
    });
    if (next.length !== centroids.length) {
      for (let i = 0; i < labs.length; i++) assignments[i] = remap[assignments[i]];
      changed = true;
    }
    centroids = next;
    if (!changed) break;
  }
  return { centroids, assignments };
}

/** Reduces colours to k with k-means, then snaps each centre to the closest palette entry by CIEDE2000. */
export function matchPalette(labs, k, palette, seed = 1) {
  const { centroids, assignments } = kmeans(labs, k, seed);
  const colors = [];
  const byCode = new Map();
  const centroidToColor = centroids.map((centre) => {
    let best = palette[0], bestD = Infinity;
    for (const entry of palette) {
      const d = deltaE2000(centre, entry.lab);
      if (d < bestD) { bestD = d; best = entry; }
    }
    if (!byCode.has(best.code)) {
      byCode.set(best.code, colors.length);
      colors.push(best);
    }
    return byCode.get(best.code);
  });
  const out = new Int32Array(labs.length);
  for (let i = 0; i < labs.length; i++) out[i] = centroidToColor[assignments[i]];
  return { colors, assignments: out };
}

/**
 * Drops colours whose code is in removed; their beads move to the closest remaining colour by CIEDE2000 to the bead's own sample.
 * Leaves the pattern unchanged when that would remove every colour.
 */
export function dropColors(labs, colors, assignments, removed) {
  const keep = [];
  const remap = new Int32Array(colors.length).fill(-1);
  colors.forEach((c, i) => {
    if (removed.has(c.code)) return;
    remap[i] = keep.length;
    keep.push(c);
  });
  if (keep.length === colors.length || keep.length === 0) return { colors, assignments };
  const out = new Int32Array(assignments.length);
  for (let i = 0; i < assignments.length; i++) {
    let next = remap[assignments[i]];
    if (next < 0) {
      let bestD = Infinity;
      keep.forEach((c, k) => {
        const d = deltaE2000(labs[i], c.lab);
        if (d < bestD) { bestD = d; next = k; }
      });
    }
    out[i] = next;
  }
  return { colors: keep, assignments: out };
}
