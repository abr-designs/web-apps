// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Per-subject photo grading. Pure: no three.js, no DOM.

/**
 * @typedef {Object} SubjectResult
 * @property {string} id            Unique per instance, e.g. 'bubble-fish-0'
 * @property {string} type          Landmark id or critter species
 * @property {'landmark'|'critter'} kind
 * @property {number} visibleRatio  Visible sample points / total sample points
 * @property {number} heightRatio   Projected height / frame height
 * @property {number} centerOffset  0 at frame center, 1 at a corner
 * @property {string|null} action   Special action at capture time
 */

const MIN_VISIBLE = 0.4;

export function isInFrame(s) {
  return s.visibleRatio >= MIN_VISIBLE;
}

export function sizeScore(h) {
  if (h >= 0.15 && h <= 0.45) return 1;
  if (h > 0.03 && h < 0.15) return (h - 0.03) / 0.12;
  if (h > 0.45 && h < 0.9) return (0.9 - h) / 0.45;
  return 0;
}

export function centerScore(o) {
  return Math.min(Math.max(1 - o, 0), 1);
}

export function scoreSubject(s) {
  return 0.4 * sizeScore(s.heightRatio) + 0.3 * centerScore(s.centerOffset) + 0.3 * s.visibleRatio;
}

export function starsFor(score) {
  if (score >= 0.85) return 3;
  if (score >= 0.6) return 2;
  return 1;
}
