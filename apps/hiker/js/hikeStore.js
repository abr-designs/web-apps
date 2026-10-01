// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Loads data/hikes.json, validates it and attaches the computed Score.

import { hikeScore } from './hikeScore.js';

const REQUIRED = ['id', 'name', 'lengthKm', 'timeHrs', 'gainM', 'difficulty', 'quality', 'accessibility'];

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function prepareHikes(raw) {
  if (!Array.isArray(raw)) throw new Error('hikes.json must be an array of hikes');
  return raw.map((hike, i) => {
    const missing = REQUIRED.filter(f => hike[f] === undefined || hike[f] === '' || hike[f] === null);
    if (missing.length) throw new Error(`Hike "${hike.name ?? `#${i}`}" is missing: ${missing.join(', ')}`);
    return { ...hike, tags: hike.tags ?? [], access: hike.access ?? [], score: hikeScore(hike) };
  });
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export async function loadHikes(url = 'data/hikes.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return prepareHikes(await res.json());
}
