// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Pure pipeline: filter -> band by weather -> sort by hike Score.

import { weatherScore, bandFor } from './weatherScore.js';

export const BAND_ORDER = ['good', 'fair', 'poor', 'nogo', 'unknown'];

/**
 * filters = {inSeason: boolean, access: string[] (excluded), country: '' | 'CA' | 'US', tags: string[] (any),
 * maxDriveHrs: number (0 or missing = any)}. driveHours: Map of hike id to hours; hikes without one pass the drive filter.
 * Returns non-empty bands in BAND_ORDER: [{band, items: [{hike, day, weather}]}].
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export function rank(hikes, forecasts, { dayIndex = 0, filters = {}, month = new Date().getMonth() + 1, driveHours = new Map() } = {}) {
  const groups = Object.fromEntries(BAND_ORDER.map(b => [b, []]));

  for (const hike of hikes.filter(h => matches(h, filters, month, driveHours.get(h.id)))) {
    const day = forecasts.get(hike.id)?.[dayIndex];
    const weather = day ? weatherScore(day) : undefined;
    groups[day ? bandFor(weather) : 'unknown'].push({ hike, day, weather });
  }

  return BAND_ORDER
    .map(band => ({ band, items: groups[band].sort((a, b) => a.hike.score - b.hike.score) }))
    .filter(g => g.items.length);
}

function matches(hike, { inSeason, access = [], country, tags = [], maxDriveHrs }, month, driveHrs) {
  if (inSeason && hike.months && !hike.months.includes(month)) return false;
  if (access.some(a => hike.access.includes(a))) return false;
  if (country && hike.country !== country) return false;
  if (tags.length && !tags.some(t => hike.tags.includes(t))) return false;
  if (maxDriveHrs && driveHrs > maxDriveHrs) return false;
  return true;
}

/**
 * Splits rank() output for display: good-weather items first, then every other item by Score alone
 * (band labels are not shown, so the rest must not look out of order). Items gain their `band`.
 * Once any drive time is known, hikes without one go to the bottom of the list, by Score.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export function goodFirst(bands, driveHours = new Map()) {
  const tagged = bands.flatMap(({ band, items }) => items.map(item => ({ ...item, band })));
  const noDrive = i => driveHours.size > 0 && !driveHours.has(i.hike.id);
  const byScore = (a, b) => a.hike.score - b.hike.score;
  return {
    good: tagged.filter(i => i.band === 'good' && !noDrive(i)),
    rest: [
      ...tagged.filter(i => i.band !== 'good' && !noDrive(i)).sort(byScore),
      ...tagged.filter(noDrive).sort(byScore),
    ],
  };
}
