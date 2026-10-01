// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Where drive times start from: saved home, else geolocation, else DEFAULT_HOME.

import { DEFAULT_HOME, GEOCODE_URL } from './config.js';

const HOME_KEY = 'hiker:home';

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export async function getOrigin() {
  const home = loadHome();
  if (home) return { ...home, source: 'home' };
  const here = await locate().catch(() => null);
  if (here) return { ...here, source: 'geolocation' };
  return { ...DEFAULT_HOME, source: 'default' };
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function saveHome({ lat, lon, name }) {
  try {
    localStorage.setItem(HOME_KEY, JSON.stringify({ lat, lon, name }));
  } catch {
    // Storage disabled: home lasts for this page only.
  }
}

function loadHome() {
  try {
    const home = JSON.parse(localStorage.getItem(HOME_KEY));
    return Number.isFinite(home?.lat) && Number.isFinite(home?.lon) ? home : null;
  } catch {
    return null;
  }
}

/**
 * Town or place name -> up to 5 {name, lat, lon} matches from Open-Meteo geocoding (no key).
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export async function searchPlaces(query) {
  const url = `${GEOCODE_URL}?${new URLSearchParams({ name: query, count: 5, language: 'en', format: 'json' })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const { results = [] } = await res.json();
  return results.map(r => ({
    name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { timeout: 8000, maximumAge: 60 * 60 * 1000 },
    );
  });
}
