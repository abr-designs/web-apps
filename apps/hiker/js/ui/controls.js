// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Filter and day controls. They only call store.set; main reacts to the store.

import { el } from './dom.js';
import { icon } from './icons.js';
import { tagLabel, dayLabel, TAG_ICONS } from './card.js';
import { searchPlaces, locate } from '../origin.js';

const ACCESS = ['Ferry', '4x4', 'Kayak'];
const TAGS = Object.keys(TAG_ICONS);
const DRIVE = [[0, 'Any drive'], [1, 'Up to 1 h'], [2, 'Up to 2 h'], [3, 'Up to 3 h'], [4, 'Up to 4 h'], [6, 'Up to 6 h']];

// Controls re-render on every store change, so view-only state lives here.
let filtersOpen = false;
let homeQuery = '';
let places = [];
let homeStatus = '';
// Bumped by every search, locate and pick, so only the latest request may change the Home state.
let homeRequest = 0;

/**
 * days: forecast date strings (empty when there is no forecast).
 * hikes: {added, onAdd, onDownload}; added counts hikes saved in this browser only.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
export function renderControls(root, store, days, hikes) {
  const { dayIndex, filters, home, query } = store.get();
  const refresh = () => renderControls(root, store, days, hikes);
  const setFilters = patch => store.set({ filters: { ...filters, ...patch } });
  const toggle = (list, value) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  const chip = (label, pressed, onclick, { title, iconName } = {}) =>
    el('button', { type: 'button', class: 'chip', 'aria-pressed': pressed === null ? undefined : String(pressed), onclick, title, 'data-focus': label },
      iconName && icon(iconName), label);
  const row = (label, ...children) => el('div', { class: 'control-row' }, el('span', { class: 'label' }, label), ...children);

  const setHome = place => {
    homeRequest++;
    homeQuery = '';
    places = [];
    homeStatus = '';
    store.set({ home: place });
  };
  const status = text => {
    homeStatus = text;
    refresh();
  };

  const searchInput = el('input', {
    type: 'search', placeholder: 'Hike name', 'aria-label': 'Search hikes by name', 'data-focus': 'search', value: query,
  });
  searchInput.addEventListener('input', () => store.set({ query: searchInput.value }));

  const homeInput = el('input', {
    type: 'search', placeholder: 'Town, park or lat, lon', 'aria-label': 'Find a home location', 'data-focus': 'home', value: homeQuery,
  });
  homeInput.addEventListener('input', () => { homeQuery = homeInput.value; });
  const findHome = async () => {
    const query = homeInput.value.trim();
    if (!query) return;
    const [lat, lon] = query.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return setHome({ lat, lon, name: `${lat.toFixed(3)}, ${lon.toFixed(3)}` });
    const id = ++homeRequest;
    status('Searching...');
    try {
      const found = await searchPlaces(query);
      if (id !== homeRequest) return;
      places = found;
      status(places.length ? '' : `No place called "${query}"`);
    } catch {
      if (id !== homeRequest) return;
      places = [];
      status('Place search is unavailable');
    }
  };
  homeInput.addEventListener('keydown', e => e.key === 'Enter' && findHome());
  const useLocation = async () => {
    const id = ++homeRequest;
    status('Locating...');
    try {
      const here = await locate();
      if (id === homeRequest) setHome({ ...here, name: 'your location' });
    } catch {
      if (id === homeRequest) status('Location is unavailable or blocked');
    }
  };

  const active = (filters.inSeason ? 1 : 0) + (filters.country ? 1 : 0) + (filters.maxDriveHrs ? 1 : 0) + filters.access.length + filters.tags.length;

  // Every store change rebuilds the controls; put keyboard focus back on the same control afterwards.
  // Typing in a search box rebuilds it too, so the caret position comes back with the focus.
  const was = root.contains(document.activeElement) ? document.activeElement : undefined;
  const focused = was?.dataset.focus;
  const caret = was?.tagName === 'INPUT' ? [was.selectionStart, was.selectionEnd] : undefined;

  root.replaceChildren(...[
    row('Search', searchInput,
      query.trim() && el('span', { class: 'home-status' }, 'Searching all hikes, filters off')),
    days.length > 0 && row('Day', days.map((date, i) =>
      chip(dayLabel(date, i), i === dayIndex, () => store.set({ dayIndex: i }), { title: date }))),
    el('div', { class: 'control-row home' },
      el('span', { class: 'label' }, 'Home'),
      el('span', { class: 'home-now' }, icon('home'), home ? (home.name ?? `${home.lat.toFixed(3)}, ${home.lon.toFixed(3)}`) : 'Not set'),
      el('span', { class: 'home-find' }, homeInput,
        el('button', { type: 'button', class: 'chip icon-only', 'aria-label': 'Search', title: 'Search', onclick: findHome, 'data-focus': 'home-search' }, icon('search')),
        el('button', { type: 'button', class: 'chip icon-only', 'aria-label': 'Use my location', title: 'Use my location', onclick: useLocation, 'data-focus': 'home-locate' }, icon('locate'))),
      homeStatus && el('span', { class: 'home-status', role: 'status' }, homeStatus),
      places.length > 0 && el('div', { class: 'places' }, places.map(p =>
        chip(p.name, null, () => setHome(p))))),
    el('details', { class: 'fold', open: filtersOpen, ontoggle: e => { filtersOpen = e.target.open; } },
      el('summary', { class: 'label', 'data-focus': 'filters' }, icon('sliders'), 'Filters',
        active > 0 && el('span', { class: 'fold-count' }, el('span', { class: 'sr-only' }, ', '), String(active), el('span', { class: 'sr-only' }, ' active'))),
      el('div', { class: 'fold-body' },
        row('Show',
          chip('In season', !!filters.inSeason, () => setFilters({ inSeason: !filters.inSeason }), { iconName: 'calendar' }),
          el('select', { 'aria-label': 'Country', 'data-focus': 'country', onchange: e => setFilters({ country: e.target.value }) },
            [['', 'Both countries'], ['CA', 'Canada'], ['US', 'USA']].map(([v, t]) =>
              el('option', { value: v, selected: filters.country === v }, t))),
          el('select', { 'aria-label': 'Drive time', 'data-focus': 'drive', onchange: e => setFilters({ maxDriveHrs: Number(e.target.value) }) },
            DRIVE.map(([v, t]) => el('option', { value: v, selected: (filters.maxDriveHrs ?? 0) === v }, t)))),
        row('Avoid', ACCESS.map(a =>
          chip(a, filters.access.includes(a), () => setFilters({ access: toggle(filters.access, a) }), { iconName: 'alert' }))),
        row('Tags', TAGS.map(t =>
          chip(tagLabel(t), filters.tags.includes(t), () => setFilters({ tags: toggle(filters.tags, t) }), { iconName: TAG_ICONS[t] }))))),
    hikes && row('Hikes',
      chip('Add hike', null, hikes.onAdd, { iconName: 'plus' }),
      hikes.added > 0 && chip(`Download hikes.json (${hikes.added} added)`, null, hikes.onDownload,
        { iconName: 'download', title: 'Replace data/hikes.json with this file to keep the added hikes' })),
  ].filter(Boolean));

  const target = focused && root.querySelector(`[data-focus="${CSS.escape(focused)}"]`);
  target?.focus();
  if (caret && target?.tagName === 'INPUT') target.setSelectionRange(...caret);
}
