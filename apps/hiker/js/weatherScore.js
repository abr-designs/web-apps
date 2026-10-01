// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Port of the Apps Script CALCULATE_WEATHER_SCORE_. Lower = better weather.

import { BANDS } from './config.js';

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function weatherScore({ highC, cloudPct, popPct, visKm }) {
  if (highC >= 30 || highC <= 5) return Infinity;
  return Math.round((popPct * 2 + cloudPct) ** 2 + 2 ** (visKm / 30)) / 100;
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function bandFor(score) {
  if (score === Infinity) return 'nogo';
  if (score <= BANDS.good) return 'good';
  if (score <= BANDS.fair) return 'fair';
  return 'poor';
}
