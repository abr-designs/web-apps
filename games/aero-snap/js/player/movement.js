// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Player movement constants and camera-relative input math. Pure: no three.js, no DOM.

export const WALK_SPEED = 5;
export const SLOW_SPEED = 2;
export const JUMP_SPEED = 6;
export const GRAVITY = 18;

/**
 * Unit movement direction on the ground plane relative to camera yaw (yaw 0 faces -z).
 * @param {{ f: boolean, b: boolean, l: boolean, r: boolean }} keys
 * @param {number} yaw
 * @returns {{ x: number, z: number }}
 */
export function moveVector(keys, yaw) {
  const fwd = (keys.f ? 1 : 0) - (keys.b ? 1 : 0);
  const side = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  if (fwd === 0 && side === 0) return { x: 0, z: 0 };
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const x = -sin * fwd + cos * side;
  const z = -cos * fwd - sin * side;
  const len = Math.hypot(x, z);
  return { x: x / len, z: z / len };
}
