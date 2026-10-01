// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Drive hours from the origin to every hike via one OSRM table request, cached per origin.

import { OSRM_URL, ROUTE_TTL_MS } from './config.js';
import { cacheGet, cacheSet } from './cache.js';

/**
 * Resolves to Map<hikeId, hours>. Unroutable hikes are left out.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export async function getDriveHours(origin, hikes) {
  const located = hikes.filter(h => Number.isFinite(h.lat) && Number.isFinite(h.lon));
  if (!located.length) return new Map();

  const cacheKey = `route:${origin.lat.toFixed(2)},${origin.lon.toFixed(2)}:${located.map(h => h.id).join(',')}`;
  let byId = cacheGet(cacheKey);

  if (!byId) {
    const coords = [origin, ...located].map(p => `${p.lon},${p.lat}`).join(';');
    const res = await fetch(`${OSRM_URL}/${coords}?sources=0&annotations=duration`);
    if (!res.ok) throw new Error(`Route request failed (${res.status})`);
    const { durations } = await res.json();
    byId = {};
    located.forEach((h, i) => {
      const seconds = durations[0][i + 1];
      if (seconds != null) byId[h.id] = seconds / 3600;
    });
    cacheSet(cacheKey, byId, ROUTE_TTL_MS);
  }
  return new Map(Object.entries(byId));
}
