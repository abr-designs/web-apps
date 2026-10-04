// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Composition root: load hikes, show them by Score, then add weather and drive times.
// States: loading -> hikes (Score only) -> ranked, or error.

import { DAYS } from './config.js';
import { loadHikes, prepareHikes } from './hikeStore.js';
import { loadCustomHikes, saveCustomHikes, exportHikesJson } from './customHikes.js';
import { getForecasts } from './weatherClient.js';
import { getDriveHours } from './routeClient.js';
import { getOrigin, saveHome } from './origin.js';
import { rank } from './recommender.js';
import { createStore } from './state.js';
import { renderList } from './ui/list.js';
import { renderControls } from './ui/controls.js';
import { openModal, closeModal } from './ui/modal.js';
import { renderHikeForm } from './ui/hikeForm.js';

const $list = document.getElementById('list');
const $controls = document.getElementById('controls');
const $notice = document.getElementById('notice');

const store = createStore({
  dayIndex: 0,
  filters: { inSeason: false, access: [], country: '', tags: [], maxDriveHrs: 0 },
  home: null,
  query: '',
});

let baseHikes = [];
let hikes = [];
let forecasts = new Map();
let driveHours = new Map();
let days = [];
let images = {};
let notes = [];
let origin;

function render() {
  const { dayIndex, filters, query } = store.get();
  const bands = rank(hikes, forecasts, { dayIndex, filters, driveHours, query });
  renderList($list, bands, {
    forecasts, dayIndex, driveHours, images, day: days[dayIndex], onRemove: removeHike, query, view: JSON.stringify({ dayIndex, filters, query }),
  });
  renderControls($controls, store, days, { added: addedHikes().length, onAdd: openHikeForm, onDownload: downloadHikes });
}

function notice(text, isError = false) {
  $notice.textContent = text;
  $notice.classList.toggle('error', isError);
}

async function fetchDriveTimes(from) {
  try {
    return await getDriveHours(from, hikes);
  } catch {
    notes.push('drive times unavailable');
    return new Map();
  }
}

/**
 * Hikes saved in this browser. Once an exported hikes.json holding them is committed, the file's copy wins.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
function addedHikes() {
  const ids = new Set(baseHikes.map(h => h.id));
  return loadCustomHikes().filter(h => !ids.has(h.id));
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
function combineHikes() {
  let added = [];
  try {
    added = prepareHikes(addedHikes()).map(h => ({ ...h, custom: true }));
  } catch {
    notes.push('hikes added in this browser could not be read');
  }
  hikes = [...baseHikes, ...added];
}

/**
 * Weather and drive times for the current hike list. The batched requests are keyed on every hike,
 * so a changed list fetches again.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
async function loadConditions() {
  const from = origin;
  const [weather, drives] = await Promise.allSettled([getForecasts(hikes, DAYS), fetchDriveTimes(from)]);
  if (weather.status === 'fulfilled') {
    forecasts = weather.value;
    days = forecasts.values().next().value?.map(d => d.date) ?? [];
  } else {
    notes.unshift('weather unavailable, sorted by Score only');
  }
  // A home picked meanwhile loads its own drive times.
  if (from === origin) driveHours = drives.value;
  showStatus();
  render();
}

function showStatus() {
  notice(notes.length ? `Offline: ${notes.join('; ')}.` : `Drive times from ${origin.name ?? originLabel(origin.source)}.`, notes.length > 0);
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
function openHikeForm() {
  const form = renderHikeForm({
    takenIds: new Set(hikes.map(h => h.id)),
    onSave: hike => {
      if (!saveCustomHikes([...addedHikes(), hike])) return false;
      closeModal();
      changeHikes(`Added ${hike.name}.`);
      return true;
    },
  });
  openModal(form, 'Add a hike', () => $controls.querySelector('[data-focus="Add hike"]')?.focus());
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
function removeHike(hike) {
  if (!confirm(`Remove ${hike.name}?`)) return;
  saveCustomHikes(addedHikes().filter(h => h.id !== hike.id));
  closeModal();
  changeHikes(`Removed ${hike.name}.`);
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
function changeHikes(message) {
  notes = [];
  combineHikes();
  render();
  notice(`${message} Loading weather...`);
  loadConditions();
}

/**
 * The whole list as a drop-in data/hikes.json, so added hikes can be committed.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
function downloadHikes() {
  const url = URL.createObjectURL(new Blob([exportHikesJson(hikes)], { type: 'application/json' }));
  Object.assign(document.createElement('a'), { href: url, download: 'hikes.json' }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function start() {
  try {
    baseHikes = await loadHikes();
  } catch (err) {
    notice('Could not load hikes.', true);
    $list.replaceChildren(Object.assign(document.createElement('div'), { className: 'error-box', textContent: err.message }));
    return;
  }
  combineHikes();

  images = await loadImages();
  render();
  notice('Loading weather and drive times...');

  origin = await getOrigin();
  if (origin.source === 'home') store.set({ home: { lat: origin.lat, lon: origin.lon, name: origin.name } });

  await loadConditions();

  let lastHome = store.get().home;
  store.subscribe(async state => {
    render();
    if (state.home === lastHome) return;
    const home = lastHome = state.home;
    origin = { ...home, source: 'home' };
    saveHome(home);
    notes = [];
    const hours = await fetchDriveTimes(origin);
    // A newer home was picked while this one loaded: its own request will finish the job.
    if (home !== lastHome) return;
    driveHours = hours;
    showStatus();
    render();
  });
}

/**
 * Photos are optional: a missing or broken images.json just means cards use the fallback art.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
async function loadImages() {
  try {
    const res = await fetch('data/images.json', { cache: 'no-cache' });
    const body = res.ok ? await res.json() : null;
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

function originLabel(source) {
  return { home: 'home', geolocation: 'your location', default: 'Vancouver (set a home above)' }[source];
}

start();
