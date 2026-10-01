// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// App-wide constants. Tune BANDS after a week of real forecasts.

export const DAYS = 7;

// Cards shown at first, and added by each "Show more".
export const PAGE_SIZE = 6;

// Upper bound (inclusive) of each weather score band. Infinity is always nogo.
export const BANDS = { good: 25, fair: 100 };

export const WEATHER_TTL_MS = 3 * 60 * 60 * 1000;
export const ROUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
export const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const OSRM_URL = 'https://router.project-osrm.org/table/v1/driving';

// Vancouver
export const DEFAULT_HOME = { lat: 49.2827, lon: -123.1207 };
