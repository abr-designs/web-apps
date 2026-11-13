// Created by Claude (claude-opus-5-5)
// Date: 2026-11-13
// Reduces a photo to palette colors, then cleans the label map (smoothing and small piece merging).

/** Converts an sRGB color (0-255 channels) to CIE Lab. @created Claude (claude-opus-5-5) 2026-11-13 */
export function rgbToLab(r, g, b) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** Converts RGBA pixel data to a flat Lab array (3 floats per pixel). @created Claude (claude-opus-5-5) 2026-11-13 */
export function imageToLab(rgba) {
  const n = rgba.length / 4;
  const lab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [L, a, b] = rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    lab[i * 3] = L;
    lab[i * 3 + 1] = a;
    lab[i * 3 + 2] = b;
  }
  return lab;
}

/** Seeded PRNG so the same photo and count always give the same palette. @created Claude (claude-opus-5-5) 2026-11-13 */
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Squared Lab distance from pixel i to center c. @created Claude (claude-opus-5-5) 2026-11-13 */
function dist2(lab, i, centers, c) {
  const dL = lab[i * 3] - centers[c * 3];
  const da = lab[i * 3 + 1] - centers[c * 3 + 1];
  const db = lab[i * 3 + 2] - centers[c * 3 + 2];
  return dL * dL + da * da + db * db;
}

/** Index of the center nearest to pixel i. @created Claude (claude-opus-5-5) 2026-11-13 */
function nearest(lab, i, centers, k) {
  let best = 0;
  let bestD = Infinity;
  for (let c = 0; c < k; c++) {
    const d = dist2(lab, i, centers, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

const FOCUS_SHARE = 0.3; // focus pixels count for at least this share of the photo when the palette is chosen

/**
 * Picks k palette colors with k-means++ in Lab space on a pixel sample.
 * Returns RGB triples, each the mean RGB of the sampled pixels in that cluster.
 * Pixels set in the optional focus mask are added to the sample with extra weight, so small focus areas
 * still pull palette colors toward them.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function kmeans(lab, rgba, k, seed = 1, focus = null) {
  const n = lab.length / 3;
  const rand = mulberry32(seed);
  const base = Math.min(n, 20000);
  const focused = [];
  if (focus) for (let p = 0; p < n; p++) if (focus[p]) focused.push(p);
  const extra = Math.min(focused.length, 20000);
  const m = base + extra;
  const sample = new Int32Array(m);
  const wt = new Float32Array(m).fill(1);
  for (let i = 0; i < base; i++) sample[i] = base === n ? i : Math.floor(rand() * n);
  const focusWeight = extra ? Math.max(1, (FOCUS_SHARE * base) / extra) : 1;
  for (let i = 0; i < extra; i++) {
    sample[base + i] = extra === focused.length ? focused[i] : focused[Math.floor(rand() * focused.length)];
    wt[base + i] = focusWeight;
  }

  const centers = new Float32Array(k * 3);
  const setCenter = (c, px) => centers.set(lab.subarray(px * 3, px * 3 + 3), c * 3);
  setCenter(0, sample[Math.floor(rand() * m)]);
  const d2 = new Float64Array(m).fill(Infinity);
  for (let c = 1; c < k; c++) {
    let total = 0;
    for (let s = 0; s < m; s++) {
      d2[s] = Math.min(d2[s], wt[s] * dist2(lab, sample[s], centers, c - 1));
      total += d2[s];
    }
    let r = rand() * total;
    let pick = m - 1;
    for (let s = 0; s < m; s++) {
      r -= d2[s];
      if (r <= 0) {
        pick = s;
        break;
      }
    }
    setCenter(c, sample[pick]);
  }

  const assign = new Uint8Array(m);
  const sums = new Float64Array(k * 3);
  const counts = new Float64Array(k);
  for (let iter = 0; iter < 25; iter++) {
    let changed = iter === 0;
    for (let s = 0; s < m; s++) {
      const c = nearest(lab, sample[s], centers, k);
      if (c !== assign[s]) changed = true;
      assign[s] = c;
    }
    if (!changed) break;
    sums.fill(0);
    counts.fill(0);
    for (let s = 0; s < m; s++) {
      const c = assign[s];
      counts[c] += wt[s];
      for (let j = 0; j < 3; j++) sums[c * 3 + j] += wt[s] * lab[sample[s] * 3 + j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < 3; j++) centers[c * 3 + j] = sums[c * 3 + j] / counts[c];
        continue;
      }
      // Empty cluster: restart it on the sample farthest from its own center.
      let far = 0;
      let farD = -1;
      for (let s = 0; s < m; s++) {
        const d = dist2(lab, sample[s], centers, assign[s]);
        if (d > farD) {
          farD = d;
          far = s;
        }
      }
      setCenter(c, sample[far]);
    }
  }

  const rgb = new Float64Array(k * 3);
  counts.fill(0);
  for (let s = 0; s < m; s++) {
    const c = nearest(lab, sample[s], centers, k);
    counts[c] += wt[s];
    for (let j = 0; j < 3; j++) rgb[c * 3 + j] += wt[s] * rgba[sample[s] * 4 + j];
  }
  // Clusters left empty (more colors asked for than the photo has) are dropped instead of becoming black.
  const palette = [];
  for (let c = 0; c < k; c++) {
    if (counts[c]) palette.push([0, 1, 2].map((j) => Math.round(rgb[c * 3 + j] / counts[c])));
  }
  return palette;
}

/** Assigns every pixel to its nearest palette color (palette given in Lab). @created Claude (claude-opus-5-5) 2026-11-13 */
export function labelPixels(lab, paletteLab) {
  const k = paletteLab.length;
  const centers = new Float32Array(paletteLab.flat());
  const n = lab.length / 3;
  const labels = new Uint8Array(n);
  for (let i = 0; i < n; i++) labels[i] = nearest(lab, i, centers, k);
  return labels;
}

/**
 * Majority filter: each pixel takes the most common label in its (2r+1)^2 window, keeping its own on ties.
 * Pixels set in the optional keep mask always keep their own label.
 * Uses one integral image per label, so cost does not grow with the radius.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function modeFilter(labels, w, h, k, radius, keep = null) {
  if (radius <= 0) return labels;
  const W1 = w + 1;
  const size = W1 * (h + 1);
  const sat = new Int32Array(k * size);
  for (let c = 0; c < k; c++) {
    const base = c * size;
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        if (labels[y * w + x] === c) row++;
        sat[base + (y + 1) * W1 + x + 1] = sat[base + y * W1 + x + 1] + row;
      }
    }
  }
  const out = new Uint8Array(labels.length);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius) * W1;
    const y1 = Math.min(h, y + radius + 1) * W1;
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      const own = labels[y * w + x];
      if (keep?.[y * w + x]) {
        out[y * w + x] = own;
        continue;
      }
      let best = own;
      let bestCount = -1;
      for (let c = 0; c < k; c++) {
        const b = c * size;
        const count = sat[b + y1 + x1] - sat[b + y0 + x1] - sat[b + y1 + x0] + sat[b + y0 + x0];
        if (count > bestCount || (count === bestCount && c === own)) {
          bestCount = count;
          best = c;
        }
      }
      out[y * w + x] = best;
    }
  }
  return out;
}

/**
 * Labels 4-connected regions of equal value.
 * Returns the region id per pixel, each region's size, and its first pixel.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function components(values, w, h) {
  const n = w * h;
  const comp = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const sizes = [];
  const first = [];
  for (let s = 0; s < n; s++) {
    if (comp[s] !== -1) continue;
    const id = sizes.length;
    const v = values[s];
    let top = 0;
    let size = 0;
    stack[top++] = s;
    comp[s] = id;
    while (top) {
      const p = stack[--top];
      size++;
      const x = p % w;
      if (x > 0 && comp[p - 1] === -1 && values[p - 1] === v) { comp[p - 1] = id; stack[top++] = p - 1; }
      if (x < w - 1 && comp[p + 1] === -1 && values[p + 1] === v) { comp[p + 1] = id; stack[top++] = p + 1; }
      if (p >= w && comp[p - w] === -1 && values[p - w] === v) { comp[p - w] = id; stack[top++] = p - w; }
      if (p + w < n && comp[p + w] === -1 && values[p + w] === v) { comp[p + w] = id; stack[top++] = p + w; }
    }
    sizes.push(size);
    first.push(s);
  }
  return { comp, sizes, first, count: sizes.length };
}

/**
 * Absorbs every region smaller than minArea pixels into the neighbouring region it shares the most edge with.
 * Smallest regions go first. Merges are tracked with live sizes (union-find), so a region that has already
 * grown past minArea by absorbing others is kept. A region with any pixel in the optional focus mask only
 * needs focusArea pixels. Mutates and returns labels.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function mergeSmallPieces(labels, w, h, minArea, focus = null, focusArea = minArea) {
  if (minArea <= 1) return labels;
  const n = w * h;
  for (let pass = 0; pass < 2; pass++) {
    const { comp, sizes, first, count } = components(labels, w, h);
    const need = new Float64Array(count).fill(minArea);
    if (focus) for (let p = 0; p < n; p++) if (focus[p]) need[comp[p]] = focusArea;
    const small = [];
    for (let c = 0; c < count; c++) if (sizes[c] < need[c]) small.push(c);
    if (!small.length) break;

    // Pixel lists per region via counting sort.
    const start = new Int32Array(count + 1);
    for (let c = 0; c < count; c++) start[c + 1] = start[c] + sizes[c];
    const fill = start.slice(0, count);
    const pixels = new Int32Array(n);
    for (let p = 0; p < n; p++) pixels[fill[comp[p]]++] = p;

    const parent = Int32Array.from({ length: count }, (_, c) => c);
    const live = Int32Array.from(sizes);
    const find = (x) => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };

    small.sort((a, b) => sizes[a] - sizes[b]);
    const votes = new Map();
    for (const c of small) {
      if (live[c] >= need[c]) continue;
      votes.clear();
      for (let i = start[c]; i < start[c + 1]; i++) {
        const p = pixels[i];
        const x = p % w;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
          if (q < 0 || q >= n) continue;
          const r = find(comp[q]);
          if (r !== c) votes.set(r, (votes.get(r) || 0) + 1);
        }
      }
      let best = -1;
      for (const [r, v] of votes) if (best < 0 || v > votes.get(best)) best = r;
      if (best < 0) continue;
      parent[c] = best;
      live[best] += live[c];
    }
    for (let p = 0; p < n; p++) labels[p] = labels[first[find(comp[p])]];
  }
  return labels;
}
