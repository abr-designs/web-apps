// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// The Add hike form shown in the modal. A place search fills in the coordinates.

import { el } from './dom.js';
import { icon } from './icons.js';
import { tagLabel, TAG_ICONS, DIFFICULTY, QUALITY } from './card.js';
import { searchPlaces } from '../origin.js';
import { buildHike } from '../customHikes.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ACCESS = ['Ferry', '4x4', 'Kayak'];
const REACH = ['Easy to reach', 'Short detour', 'Long drive', 'Remote', 'Expedition'];

/**
 * takenIds: ids already in use. onSave(hike) returns false when the hike could not be stored.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export function renderHikeForm({ takenIds, onSave }) {
  const picked = { months: new Set(), tags: new Set(), access: new Set() };
  const toggle = (set, value) => e => {
    set.has(value) ? set.delete(value) : set.add(value);
    e.currentTarget.setAttribute('aria-pressed', String(set.has(value)));
  };
  const chip = (label, set, value, iconName) =>
    el('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: toggle(set, value) }, iconName && icon(iconName), label);
  const input = (name, label, attrs = {}) =>
    el('label', { class: 'field' }, el('span', {}, label), el('input', { name, ...attrs }));
  const select = (name, label, options) =>
    el('label', { class: 'field' }, el('span', {}, label),
      el('select', { name }, options.map(([value, text]) => el('option', { value }, text))));
  const scale = labels => [['', 'Choose...'], ...labels.map((text, i) => [String(i + 1), `${i + 1} ${text}`])];
  const group = (label, ...children) => el('fieldset', { class: 'field-group' }, el('legend', {}, label), ...children);

  const error = el('p', { class: 'form-error', role: 'alert' });
  const placeStatus = el('p', { class: 'form-hint', role: 'status' });
  const places = el('div', { class: 'places-found' });

  const form = el('form', { class: 'hike-form', novalidate: true },
    el('h3', {}, 'Add a hike'),
    input('name', 'Name', { required: true, autocomplete: 'off' }),
    group('Location',
      el('div', { class: 'field-search' },
        el('input', { name: 'place', type: 'search', placeholder: 'Trailhead, park or town', 'aria-label': 'Search for the location' }),
        el('button', { type: 'button', class: 'chip icon-only', 'aria-label': 'Search', title: 'Search', onclick: () => findPlace() }, icon('search'))),
      places, placeStatus,
      el('div', { class: 'field-row' },
        input('lat', 'Latitude', { inputmode: 'decimal' }),
        input('lon', 'Longitude', { inputmode: 'decimal' })),
      el('p', { class: 'form-hint' }, 'Optional. Without coordinates the hike gets no weather or drive time.')),
    el('div', { class: 'field-row' },
      input('lengthKm', 'Length (km)', { inputmode: 'decimal' }),
      input('timeHrs', 'Time (h)', { inputmode: 'decimal' }),
      input('gainM', 'Elevation gain (m)', { inputmode: 'numeric' })),
    el('div', { class: 'field-row' },
      select('difficulty', 'Difficulty', scale(DIFFICULTY)),
      select('quality', 'Quality', scale(QUALITY)),
      select('accessibility', 'Accessibility', scale(REACH))),
    group('Season', el('div', { class: 'chips-row' }, MONTHS.map((m, i) => chip(m, picked.months, i + 1))),
      el('p', { class: 'form-hint' }, 'Leave empty when unknown.')),
    group('Tags', el('div', { class: 'chips-row' }, Object.keys(TAG_ICONS).map(t => chip(tagLabel(t), picked.tags, t, TAG_ICONS[t])))),
    group('Access needs', el('div', { class: 'chips-row' }, ACCESS.map(a => chip(a, picked.access, a, 'alert')))),
    el('div', { class: 'field-row' },
      select('country', 'Country', [['CA', 'Canada'], ['US', 'USA']]),
      input('allTrails', 'AllTrails link', { type: 'url', placeholder: 'https://www.alltrails.com/...' })),
    input('notes', 'Notes', { placeholder: 'When to visit, permits...' }),
    error,
    el('div', { class: 'form-actions' },
      el('button', { type: 'submit', class: 'action' }, 'Add hike')));

  const field = name => form.elements.namedItem(name);
  // Separate from the other lookups: a slow search result must not replace a newer one.
  let search = 0;

  async function findPlace() {
    const query = field('place').value.trim() || field('name').value.trim();
    if (!query) return;
    // "lat, lon" pasted from a map fills the fields directly.
    const coords = query.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coords) {
      [field('lat').value, field('lon').value] = [coords[1], coords[2]];
      return;
    }
    const id = ++search;
    places.replaceChildren();
    placeStatus.textContent = 'Searching...';
    try {
      const found = await searchPlaces(query);
      if (id !== search) return;
      placeStatus.textContent = found.length ? '' : `No place called "${query}". Enter the coordinates instead.`;
      places.replaceChildren(...found.map(p => el('button', {
        type: 'button', class: 'chip', onclick: () => {
          field('lat').value = p.lat.toFixed(4);
          field('lon').value = p.lon.toFixed(4);
          places.replaceChildren();
          placeStatus.textContent = `Using ${p.name}.`;
        },
      }, p.name)));
    } catch {
      if (id === search) placeStatus.textContent = 'Place search is unavailable. Enter the coordinates instead.';
    }
  }

  field('place').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    findPlace();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(form));
    let hike;
    try {
      hike = buildHike({ ...fields, months: [...picked.months], tags: [...picked.tags], access: [...picked.access] }, takenIds);
    } catch (err) {
      error.textContent = err.message;
      return;
    }
    if (onSave(hike) === false) error.textContent = 'Could not save: browser storage is off or full.';
  });

  return form;
}
