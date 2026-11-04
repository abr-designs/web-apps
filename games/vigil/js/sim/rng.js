// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// The only randomness in the sim: mulberry32 over state.rngState, so a saved BattleState resumes the exact sequence.

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function seedState(seed) {
  return seed >>> 0;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function next(state) {
  state.rngState = (state.rngState + 0x6D2B79F5) >>> 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function nextInt(state, min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`nextInt needs integers with min <= max, got ${min}, ${max}`);
  }
  return min + Math.floor(next(state) * (max - min + 1));
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function pick(state, list) {
  if (list.length === 0) throw new RangeError('pick from an empty list');
  return list[nextInt(state, 0, list.length - 1)];
}
