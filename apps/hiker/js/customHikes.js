// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Hikes added in the app: validated from form fields, kept in localStorage until exported into data/hikes.json.

const KEY = 'hiker:customHikes';
const TAGS = ['WATERFALLS', 'BIG_TREES', 'WILDFLOWERS', 'SWIMMING', 'COASTAL_VIEWS', 'MOUNTAIN_VIEWS', 'HISTORY', 'GEOLOGY'];
const ACCESS = ['Ferry', '4x4', 'Kayak'];

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function loadCustomHikes() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function saveCustomHikes(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function slug(name) {
  return name.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Form fields (strings, plus arrays for months, tags and access) -> a hikes.json entry.
 * Throws an Error listing every problem. takenIds: ids already in use; a name that maps to one is a duplicate.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export function buildHike(fields, takenIds = new Set()) {
  const problems = [];
  const text = k => String(fields[k] ?? '').trim();
  const number = (k, label, ok) => {
    const v = text(k) === '' ? NaN : Number(text(k));
    if (!ok(v)) problems.push(label);
    return v;
  };
  const rating = (k, label) => number(k, `${label} from 1 to 5`, v => Number.isInteger(v) && v >= 1 && v <= 5);

  const name = text('name');
  const id = slug(name);
  if (!id) problems.push('a name');
  else if (takenIds.has(id)) problems.push(`a name other than "${name}", which is already in the list`);
  const lengthKm = number('lengthKm', 'a length above 0 km', v => v > 0);
  const timeHrs = number('timeHrs', 'a time above 0 hours', v => v > 0);
  const gainM = number('gainM', 'an elevation gain of 0 m or more', v => v >= 0);
  const difficulty = rating('difficulty', 'Difficulty');
  const quality = rating('quality', 'Quality');
  const accessibility = rating('accessibility', 'Accessibility');

  let lat, lon;
  if (text('lat') !== '' || text('lon') !== '') {
    lat = number('lat', 'a latitude from -90 to 90', v => v >= -90 && v <= 90);
    lon = number('lon', 'a longitude from -180 to 180', v => v >= -180 && v <= 180);
  }

  // The link becomes an href on the card, so only web addresses get through.
  const allTrails = text('allTrails') || undefined;
  if (allTrails && !/^https?:\/\//i.test(allTrails)) problems.push('a link starting with http:// or https://');

  if (problems.length) throw new Error(`Needs ${problems.join(', ')}.`);

  const months = [...new Set(fields.months ?? [])].map(Number).filter(m => m >= 1 && m <= 12).sort((a, b) => a - b);

  return {
    id, name, allTrails, lat, lon, lengthKm, timeHrs, gainM, difficulty, quality, accessibility,
    months: months.length ? months : undefined,
    tags: TAGS.filter(t => fields.tags?.includes(t)),
    access: ACCESS.filter(a => fields.access?.includes(a)),
    country: fields.country === 'US' ? 'US' : 'CA',
    notes: text('notes') || undefined,
  };
}

/**
 * The full data/hikes.json after adding the custom hikes: the computed score and the in-app marker are dropped.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export function exportHikesJson(hikes) {
  return JSON.stringify(hikes.map(({ score, custom, ...hike }) => hike), null, 2) + '\n';
}
