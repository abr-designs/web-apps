// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// The sheet's hike Score (Local column L). Lower = more reasonable. The only home of this formula.

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function hikeScore({ lengthKm, timeHrs, gainM, difficulty, quality, accessibility }) {
  return ((lengthKm * 1000 + gainM * 2) / (10 / timeHrs)) * 2 ** difficulty * 2 ** accessibility / quality / 1000;
}
