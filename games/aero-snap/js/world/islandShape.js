// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Island terrain and walkable area. Pure: no three.js, no DOM.

export const ISLAND_RADIUS = 60;
export const WALK_RADIUS = 57;
export const LAGOON = { x: -18, z: 14, r: 11 };
export const PLAZA = { x: 0, z: 0, r: 12 };

const PLAZA_BLEND = 4;
const RIM_BLEND = 6;
const LAGOON_BANK = 3;
const LAGOON_DEPTH = -1.2;
const MAX_HEIGHT = 4;

const smooth = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.min(Math.max(k, 0), 1);

function terrace(x, z) {
  const h = 2 + 1.1 * Math.sin(x * 0.09) + 0.8 * Math.cos(z * 0.11) + 0.4 * Math.sin((x + z) * 0.05);
  return Math.min(Math.max(h, 0), MAX_HEIGHT);
}

export function isInLagoon(x, z) {
  return Math.hypot(x - LAGOON.x, z - LAGOON.z) < LAGOON.r;
}

export function heightAt(x, z) {
  const dLagoon = Math.hypot(x - LAGOON.x, z - LAGOON.z);
  if (dLagoon < LAGOON.r) return LAGOON_DEPTH;

  const dPlaza = Math.hypot(x - PLAZA.x, z - PLAZA.z);
  let h = terrace(x, z) * smooth(clamp01((dPlaza - PLAZA.r) / PLAZA_BLEND));
  // Banks slope down to a low shoreline so the water edge reads as a beach, not a cliff.
  const bank = clamp01((dLagoon - LAGOON.r) / LAGOON_BANK);
  h = 0.15 + (h - 0.15) * smooth(bank);
  if (dPlaza <= PLAZA.r) return 0;
  // Terrain settles to 0 at the rim so it meets the island's rounded lip.
  const dCenter = Math.hypot(x, z);
  return h * smooth(clamp01((ISLAND_RADIUS - dCenter) / RIM_BLEND));
}

export function clampToWalkable(x, z) {
  const d = Math.hypot(x, z);
  if (d > WALK_RADIUS) {
    x = (x / d) * WALK_RADIUS;
    z = (z / d) * WALK_RADIUS;
  }
  const dx = x - LAGOON.x;
  const dz = z - LAGOON.z;
  const dl = Math.hypot(dx, dz);
  if (dl < LAGOON.r) {
    // At the exact center there is no direction to push; pick +x.
    const ux = dl > 1e-9 ? dx / dl : 1;
    const uz = dl > 1e-9 ? dz / dl : 0;
    x = LAGOON.x + ux * LAGOON.r;
    z = LAGOON.z + uz * LAGOON.r;
  }
  return { x, z };
}
