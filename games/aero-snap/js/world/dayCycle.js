// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Day cycle timing. Pure: no three.js, no DOM.

export const DAY_LENGTH = 480;
const GOLDEN_START = 300;
const DUSK_START = 390;
const MAX_DT = 0.1;

export function dayPhaseAt(t) {
  const local = ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  if (local < GOLDEN_START) return 'day';
  if (local < DUSK_START) return 'golden';
  return 'dusk';
}

// A backgrounded tab resumes with a huge delta; clamping keeps critters and the sky from jumping.
export function clampDt(dt) {
  return Math.min(Math.max(dt, 0), MAX_DT);
}
