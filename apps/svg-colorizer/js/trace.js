// Created by Claude (claude-opus-5-5)
// Date: 2026-11-13
// Turns a 0/1 sheet mask into smooth SVG path data for cutting.

// Directions: 0 right, 1 down, 2 left, 3 up (y grows downward).
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

/** Index of the lowest set bit. @created Claude (claude-opus-5-5) 2026-11-13 */
const lowestBit = (b) => 31 - Math.clz32(b & -b);

/**
 * Picks the next edge at a vertex. At a saddle (two diagonal pixels touching at a corner) it takes the
 * tight turn, so diagonal neighbours trace as separate pieces, matching 4-connected islands.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
function chooseDir(avail, dir) {
  if ((avail & (avail - 1)) === 0) return lowestBit(avail);
  for (let d = 0; d < 4; d++) {
    if (avail & (1 << d) && DX[dir] * DY[d] - DY[dir] * DX[d] === -1) return d;
  }
  return lowestBit(avail);
}

/**
 * Traces the pixel-edge outlines of a mask into closed loops of grid vertices (flat [x0, y0, x1, y1, ...]).
 * Outer outlines and holes wind in opposite directions, so the result fills correctly under either fill rule.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function traceMask(mask, w, h) {
  const W1 = w + 1;
  const bits = new Uint8Array(W1 * (h + 1));
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] !== 1) continue;
      if (!inside(x, y - 1)) bits[y * W1 + x + 1] |= 1 << 2;
      if (!inside(x - 1, y)) bits[y * W1 + x] |= 1 << 1;
      if (!inside(x, y + 1)) bits[(y + 1) * W1 + x] |= 1 << 0;
      if (!inside(x + 1, y)) bits[(y + 1) * W1 + x + 1] |= 1 << 3;
    }
  }
  const loops = [];
  for (let v = 0; v < bits.length; v++) {
    while (bits[v]) {
      const d0 = lowestBit(bits[v]);
      const pts = [];
      let cur = v;
      let dir = d0;
      for (;;) {
        pts.push(cur % W1, (cur / W1) | 0);
        bits[cur] &= ~(1 << dir);
        cur += DX[dir] + DY[dir] * W1;
        const avail = bits[cur] | (cur === v ? 1 << d0 : 0);
        if (!avail) break;
        const next = chooseDir(avail, dir);
        if (cur === v && next === d0) break;
        dir = next;
      }
      loops.push(pts);
    }
  }
  return loops;
}

/** Squared distance from point p to segment ab. @created Claude (claude-opus-5-5) 2026-11-13 */
function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  const ex = ax + t * dx - px;
  const ey = ay + t * dy - py;
  return ex * ex + ey * ey;
}

/** Douglas-Peucker simplification of a closed polygon. @created Claude (claude-opus-5-5) 2026-11-13 */
export function simplifyClosed(p, tol) {
  const n = p.length / 2;
  if (n < 4) return p;
  let far = 0;
  let farD = -1;
  for (let i = 1; i < n; i++) {
    const d = (p[2 * i] - p[0]) ** 2 + (p[2 * i + 1] - p[1]) ** 2;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[far] = 1;
  const stack = [0, far, far, n];
  const tol2 = tol * tol;
  while (stack.length) {
    const j = stack.pop();
    const i = stack.pop();
    const ax = p[2 * i];
    const ay = p[2 * i + 1];
    const bx = p[2 * (j % n)];
    const by = p[2 * (j % n) + 1];
    let maxD = 0;
    let idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = segDist2(p[2 * k], p[2 * k + 1], ax, ay, bx, by);
      if (d > maxD) {
        maxD = d;
        idx = k;
      }
    }
    if (maxD > tol2) {
      keep[idx] = 1;
      stack.push(i, idx, idx, j);
    }
  }
  const out = [];
  for (let k = 0; k < n; k++) if (keep[k]) out.push(p[2 * k], p[2 * k + 1]);
  return out;
}

/**
 * Fallback for tiny shapes that simplification collapses: keeps the leftmost, topmost, rightmost and
 * bottommost points in loop order, or the whole loop when fewer than 3 are distinct.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
function extremePoints(p) {
  const n = p.length / 2;
  const pick = [0, 0, 0, 0];
  for (let i = 1; i < n; i++) {
    if (p[2 * i] < p[2 * pick[0]]) pick[0] = i;
    if (p[2 * i + 1] < p[2 * pick[1] + 1]) pick[1] = i;
    if (p[2 * i] > p[2 * pick[2]]) pick[2] = i;
    if (p[2 * i + 1] > p[2 * pick[3] + 1]) pick[3] = i;
  }
  const idx = [...new Set(pick)].sort((a, b) => a - b);
  return idx.length < 3 ? p : idx.flatMap((i) => [p[2 * i], p[2 * i + 1]]);
}

const fmt = (v) => Math.round(v * 100) / 100;

/**
 * Writes a closed polygon as path data with each corner rounded by a quadratic curve of at most
 * radius px (never more than half of either neighbouring side).
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function roundedPath(poly, radius) {
  const m = poly.length / 2;
  let d = '';
  for (let i = 0; i < m; i++) {
    const px = poly[2 * i];
    const py = poly[2 * i + 1];
    const a = (i + m - 1) % m;
    const b = (i + 1) % m;
    const ax = poly[2 * a] - px;
    const ay = poly[2 * a + 1] - py;
    const bx = poly[2 * b] - px;
    const by = poly[2 * b + 1] - py;
    const la = Math.hypot(ax, ay) || 1;
    const lb = Math.hypot(bx, by) || 1;
    const ta = Math.min(radius, la / 2) / la;
    const tb = Math.min(radius, lb / 2) / lb;
    d += `${i ? 'L' : 'M'}${fmt(px + ax * ta)} ${fmt(py + ay * ta)}Q${fmt(px)} ${fmt(py)} ${fmt(px + bx * tb)} ${fmt(py + by * tb)}`;
  }
  return `${d}Z`;
}

/**
 * Full mask-to-path step. Smoothness (0-8) raises both the simplification tolerance and the corner radius.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
export function maskToPath(mask, w, h, smoothness) {
  const tol = 0.6 + smoothness * 0.2;
  const radius = 1 + smoothness * 1.5;
  let d = '';
  for (const pts of traceMask(mask, w, h)) {
    // Edge midpoints turn pixel staircases into straight diagonals before simplifying.
    const n = pts.length / 2;
    const mid = new Array(pts.length);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      mid[2 * i] = (pts[2 * i] + pts[2 * j]) / 2;
      mid[2 * i + 1] = (pts[2 * i + 1] + pts[2 * j + 1]) / 2;
    }
    let poly = simplifyClosed(mid, tol);
    if (poly.length < 6) poly = extremePoints(mid);
    d += roundedPath(poly, radius);
  }
  return d;
}
