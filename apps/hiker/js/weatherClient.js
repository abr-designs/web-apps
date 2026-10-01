// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// One batched Open-Meteo request for every hike with coordinates, cached for WEATHER_TTL_MS.

import { OPEN_METEO_URL, WEATHER_TTL_MS } from './config.js';
import { cacheGet, cacheSet } from './cache.js';

const HOURLY = 'temperature_2m,precipitation_probability,weather_code';
const hourlyCache = new Map();
const DAILY ='temperature_2m_max,temperature_2m_min,cloud_cover_mean,precipitation_probability_max,visibility_mean,weather_code';

/**
 * Resolves to Map<hikeId, DayForecast[]> where DayForecast = {date, highC, lowC, cloudPct, popPct, visKm, code}.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export async function getForecasts(hikes, days) {
  const located = hikes.filter(h => Number.isFinite(h.lat) && Number.isFinite(h.lon));
  if (!located.length) return new Map();

  const lats = located.map(h => h.lat).join(',');
  const lons = located.map(h => h.lon).join(',');
  const cacheKey = `weather:${days}:${lats}:${lons}`;
  let byId = cacheGet(cacheKey);

  if (!byId) {
    const url = `${OPEN_METEO_URL}?latitude=${lats}&longitude=${lons}&daily=${DAILY}&forecast_days=${days}&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
    const body = await res.json();
    const locations = Array.isArray(body) ? body : [body];
    byId = Object.fromEntries(located.map((h, i) => [h.id, normalize(locations[i].daily)]));
    cacheSet(cacheKey, byId, WEATHER_TTL_MS);
  }
  return new Map(Object.entries(byId));
}

/**
 * One hike's hours for one date: [{hour, tempC, popPct, code}]. Cached in memory only: a key per hike and date
 * would pile up in localStorage, which never drops expired entries.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export async function getHourly(hike, date) {
  const cacheKey = `${hike.lat}:${hike.lon}:${date}`;
  const cached = hourlyCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.hours;

  const url = `${OPEN_METEO_URL}?latitude=${hike.lat}&longitude=${hike.lon}&hourly=${HOURLY}&start_date=${date}&end_date=${date}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hourly weather request failed (${res.status})`);
  const { hourly: h } = await res.json();
  const hours = h.time.map((time, i) => ({
    hour: Number(time.slice(11, 13)),
    tempC: h.temperature_2m[i],
    popPct: h.precipitation_probability[i],
    code: h.weather_code[i],
  }));
  hourlyCache.set(cacheKey, { hours, expires: Date.now() + WEATHER_TTL_MS });
  return hours;
}

function normalize(d) {
  return d.time.map((date, i) => ({
    date,
    highC: d.temperature_2m_max[i],
    lowC: d.temperature_2m_min[i],
    cloudPct: d.cloud_cover_mean[i],
    popPct: d.precipitation_probability_max[i],
    visKm: d.visibility_mean[i] / 1000,
    code: d.weather_code[i],
  }));
}
