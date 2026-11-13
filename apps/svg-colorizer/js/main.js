// Created by Claude (claude-opus-5-5)
// Date: 2026-11-13
// Wires the toolbar, preview and sheets panel to the photo-to-sheets pipeline.

import { imageToLab, kmeans, labelPixels, mergeSmallPieces, modeFilter, rgbToLab } from './quantize.js';
import { findIslands, sheetMasks } from './sheets.js';
import { maskToPath } from './trace.js';

const MAX_DIM = 600;
const MM_PER_UNIT = { in: 25.4, cm: 10 };
const STORE_KEY = 'svg-colorizer:settings';
const MIN_WIDTH = 1; // matches the width input's min
const MIN_FRAME = 0.05; // matches the frame width input's min
const ISLAND_RGBA = [214, 51, 108, 190];

const ICONS = {
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/></svg>',
  pipette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 7l6 6M4 20l1-4 9.5-9.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M15 5l2-2a2.1 2.1 0 0 1 3 3l-2 2"/></svg>',
};

const $ = (id) => document.getElementById(id);

const DEFAULTS = { count: 5, minPieceMm: 3, smooth: 2, frameOn: true, frameWidth: 0.5, width: 12, unit: 'in' };
const settings = sanitizeSettings(loadSettings());
let photo = null; // { name, w, h, rgba, lab }
let palette = []; // RGB triples
let order = []; // palette indices, back to front
let labels = null;
let sheets = []; // { color, mask, islandMask, islands, d, empty }, back to front
const hidden = new Set(); // palette indices hidden in the preview
let highlight = -1; // palette index whose islands are drawn
let picking = -1; // palette index waiting for an eyedropper click
let view = 'sheets';
let loadId = 0; // bumps per photo load so an older, slower decode is discarded

/** Reads saved settings, ignoring storage errors. @created Claude (claude-opus-5-5) 2026-11-13 */
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

/** Keeps only saved values that are in range, falling back to defaults. @created Claude (claude-opus-5-5) 2026-11-13 */
function sanitizeSettings(saved) {
  const s = { ...DEFAULTS };
  const inRange = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  if (Object.hasOwn(MM_PER_UNIT, saved.unit)) s.unit = saved.unit;
  if (Number.isInteger(saved.count) && inRange(saved.count, 2, 10)) s.count = saved.count;
  if (inRange(saved.minPieceMm, 0, 12)) s.minPieceMm = saved.minPieceMm;
  if (Number.isInteger(saved.smooth) && inRange(saved.smooth, 0, 8)) s.smooth = saved.smooth;
  if (typeof saved.frameOn === 'boolean') s.frameOn = saved.frameOn;
  if (inRange(saved.frameWidth, MIN_FRAME, 1000)) s.frameWidth = saved.frameWidth;
  if (inRange(saved.width, MIN_WIDTH, 10000)) s.width = saved.width;
  return s;
}

/** Saves settings, ignoring storage errors. @created Claude (claude-opus-5-5) 2026-11-13 */
function saveSettings() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  } catch { /* storage unavailable: settings last for this visit only */ }
}

const round = (v, places = 2) => Math.round(v * 10 ** places) / 10 ** places;
const toHex = ([r, g, b]) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
const fromHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const pxPerMm = () => photo.w / (settings.width * MM_PER_UNIT[settings.unit]);

// ---------- Pipeline ----------

/** Loads a photo file, downscales it and starts the pipeline. @created Claude (claude-opus-5-5) 2026-11-13 */
async function loadPhoto(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus("That file isn't an image. Choose a JPG, PNG or WebP.", true);
    return;
  }
  const id = ++loadId;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (id === loadId) setStatus("That image couldn't be read. Try another file.", true);
    return;
  }
  if (id !== loadId) return; // a newer photo was chosen while this one decoded
  clearTimeout(timer);
  pending = 0;
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = $('photo-view');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  photo = { name: file.name.replace(/\.[^.]+$/, '') || 'photo', w, h, rgba, lab: imageToLab(rgba) };
  $('empty').hidden = true;
  $('stage').hidden = false;
  picking = -1;
  setView('sheets');
  fitStage();
  quantize();
}

/** Picks a fresh palette and stacks sheets by area, largest at the back. @created Claude (claude-opus-5-5) 2026-11-13 */
function quantize() {
  palette = kmeans(photo.lab, photo.rgba, settings.count);
  hidden.clear();
  highlight = -1;
  if (picking >= 0) {
    // The color being picked may no longer exist in the new palette.
    picking = -1;
    setView('sheets');
  }
  const counts = new Array(palette.length).fill(0);
  for (const l of labelPixels(photo.lab, palette.map((c) => rgbToLab(...c)))) counts[l]++;
  order = palette.map((_, i) => i).sort((a, b) => counts[b] - counts[a]);
  cleanup();
}

/** Re-labels pixels to the current palette, then smooths and merges small pieces. @created Claude (claude-opus-5-5) 2026-11-13 */
function cleanup() {
  const { w, h, lab } = photo;
  labels = labelPixels(lab, palette.map((c) => rgbToLab(...c)));
  labels = modeFilter(labels, w, h, palette.length, settings.smooth);
  const d = settings.minPieceMm * pxPerMm();
  mergeSmallPieces(labels, w, h, Math.round((Math.PI / 4) * d * d));
  buildSheets();
}

/** Builds every sheet's shape, islands and path from the label map. @created Claude (claude-opus-5-5) 2026-11-13 */
function buildSheets() {
  const { w, h } = photo;
  // A frame is capped at a quarter of the short side so every sheet keeps an opening.
  const framePx = settings.frameOn
    ? Math.min(
      Math.max(1, Math.round(settings.frameWidth * MM_PER_UNIT[settings.unit] * pxPerMm())),
      Math.max(1, Math.floor(Math.min(w, h) / 4)),
    )
    : 0;
  const used = new Int32Array(palette.length);
  for (let p = 0; p < labels.length; p++) used[labels[p]]++;
  sheets = sheetMasks(labels, w, h, order, framePx).map((mask, i) => {
    const isl = i === 0 ? { islandMask: null, count: 0 } : findIslands(mask, w, h, framePx);
    return {
      color: order[i],
      mask,
      islandMask: isl.islandMask,
      islands: isl.count,
      d: maskToPath(mask, w, h, settings.smooth),
      // Empty: no pixel of this sheet's own color survived cleanup, so its shape would duplicate the next sheet.
      empty: used[order[i]] === 0,
    };
  });
  render();
}

// ---------- SVG ----------

/** Builds the stacked SVG. The preview adds shadows and hides toggled-off sheets; export omits both. @created Claude (claude-opus-5-5) 2026-11-13 */
function buildSvg(preview) {
  const { w, h } = photo;
  const { unit } = settings;
  const blur = round(Math.max(1, w / 220));
  const defs = preview
    ? `<defs><filter id="sheet-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="${round(blur * 0.6)}" stdDeviation="${blur}" flood-color="#000" flood-opacity="0.5"/></filter></defs>`
    : '';
  const groups = sheets.map((s, i) => {
    if (!preview && s.empty) return '';
    const hex = toHex(palette[s.color]);
    let attrs = '';
    if (preview && i > 0) attrs += ' filter="url(#sheet-shadow)"';
    if (preview && hidden.has(s.color)) attrs += ' display="none"';
    return `<g id="sheet-${i + 1}-${hex.slice(1)}"${attrs}><path fill="${hex}" fill-rule="evenodd" d="${s.d}"/></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${round(settings.width, 3)}${unit}" height="${round((settings.width * h) / w, 3)}${unit}" viewBox="0 0 ${w} ${h}">${defs}${groups}</svg>`;
}

/** Downloads the cut-ready SVG. @created Claude (claude-opus-5-5) 2026-11-13 */
function exportSvg() {
  if (!photo) {
    setStatus('Choose a photo first.', true);
    return;
  }
  const blob = new Blob([buildSvg(false)], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${photo.name}-sheets.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Rendering ----------

/** Redraws everything that depends on the sheets. @created Claude (claude-opus-5-5) 2026-11-13 */
function render() {
  $('sheets-view').innerHTML = buildSvg(true);
  renderIslands();
  renderLayers();
  renderStatus();
  updateReadouts();
}

/** Paints the highlighted sheet's islands over the preview. @created Claude (claude-opus-5-5) 2026-11-13 */
function renderIslands() {
  const canvas = $('islands-view');
  const sheet = sheets.find((s) => s.color === highlight);
  canvas.hidden = view !== 'sheets' || !sheet || !sheet.islands;
  if (canvas.hidden) return;
  const { w, h } = photo;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let p = 0; p < sheet.islandMask.length; p++) {
    if (sheet.islandMask[p]) img.data.set(ISLAND_RGBA, p * 4);
  }
  ctx.putImageData(img, 0, 0);
}

/** Rebuilds the sheets panel, front sheet first. @created Claude (claude-opus-5-5) 2026-11-13 */
function renderLayers() {
  const rows = [];
  for (let i = sheets.length - 1; i >= 0; i--) {
    const s = sheets[i];
    const hex = toHex(palette[s.color]);
    const off = hidden.has(s.color);
    const li = document.createElement('li');
    li.className = `layer${off ? ' layer--hidden' : ''}`;
    li.draggable = true;
    li.dataset.index = String(i);
    const islandBadge = s.islands
      ? `<button class="badge" type="button" data-action="islands" aria-pressed="${highlight === s.color}" title="Show islands on the preview">${s.islands} island${s.islands > 1 ? 's' : ''}</button>`
      : '';
    li.innerHTML = `
      <button class="icon" type="button" data-action="toggle" aria-pressed="${!off}" aria-label="Show sheet ${i + 1}" title="Show or hide in preview">${off ? ICONS.eyeOff : ICONS.eye}</button>
      <label class="swatch" style="background:${hex}" title="Change color"><input type="color" value="${hex}" data-action="color" aria-label="Color of sheet ${i + 1}"></label>
      <span class="layer__text">
        <span class="layer__name">Sheet ${i + 1}${i === 0 ? ' (back)' : ''}</span>
        <span class="layer__meta">${hex.toUpperCase()}${s.empty ? ' · empty' : ''}</span>
      </span>
      ${islandBadge}
      <button class="icon" type="button" data-action="pick" aria-label="Pick color for sheet ${i + 1} from the photo" title="Pick color from photo">${ICONS.pipette}</button>
      <span class="layer__move">
        <button class="icon" type="button" data-action="forward" aria-label="Move sheet ${i + 1} forward" ${i === sheets.length - 1 ? 'disabled' : ''}>&#9650;</button>
        <button class="icon" type="button" data-action="back" aria-label="Move sheet ${i + 1} back" ${i === 0 ? 'disabled' : ''}>&#9660;</button>
      </span>`;
    rows.push(li);
  }
  $('layers').replaceChildren(...rows);
}

/** Shows the eyedropper hint or the island summary. @created Claude (claude-opus-5-5) 2026-11-13 */
function renderStatus() {
  if (picking >= 0) {
    setStatus('Click the photo to pick this sheet\'s color.');
    return;
  }
  const total = sheets.reduce((sum, s) => sum + s.islands, 0);
  if (!total) {
    setStatus('No islands. Every sheet holds together.');
    return;
  }
  setStatus(`${total} island${total > 1 ? 's' : ''}: pieces that won't hold on their own. Glue them to the sheet behind, or select a badge to see them.`, true);
}

/** @created Claude (claude-opus-5-5) 2026-11-13 */
function setStatus(text, warn = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('status--warn', warn);
}

/** Updates slider and size readouts. @created Claude (claude-opus-5-5) 2026-11-13 */
function updateReadouts() {
  const { unit } = settings;
  $('count-out').textContent = settings.count;
  $('min-out').textContent = `${round(settings.minPieceMm / MM_PER_UNIT[unit])} ${unit}`;
  $('smooth-out').textContent = settings.smooth;
  document.querySelector('.unit-label').textContent = unit;
  $('height-out').textContent = photo ? `× ${round((settings.width * photo.h) / photo.w)} ${unit}` : '';
}

/** Switches the preview between the sheet stack and the source photo. @created Claude (claude-opus-5-5) 2026-11-13 */
function setView(next) {
  view = next;
  $('view-sheets').setAttribute('aria-pressed', String(view === 'sheets'));
  $('view-photo').setAttribute('aria-pressed', String(view === 'photo'));
  $('sheets-view').hidden = view !== 'sheets';
  $('photo-view').hidden = view !== 'photo';
  $('stage').classList.toggle('picking', picking >= 0);
  if (photo && sheets.length) renderIslands();
}

/** Sizes the stage to the largest box with the photo's aspect ratio that fits the preview area. @created Claude (claude-opus-5-5) 2026-11-13 */
function fitStage() {
  if (!photo) return;
  const area = $('area');
  const aw = area.clientWidth;
  const ah = area.clientHeight;
  const ratio = photo.w / photo.h;
  let sw = aw;
  let sh = aw / ratio;
  if (sh > ah) {
    sh = ah;
    sw = ah * ratio;
  }
  $('stage').style.width = `${Math.floor(sw)}px`;
  $('stage').style.height = `${Math.floor(sh)}px`;
}

// ---------- Scheduling ----------

// Levels: 1 rebuild sheets, 2 re-label and clean up, 3 new palette. The highest pending level wins.
let pending = 0;
let timer = 0;

/** Debounces pipeline reruns while sliders move. @created Claude (claude-opus-5-5) 2026-11-13 */
function schedule(level) {
  saveSettings();
  updateReadouts();
  pending = Math.max(pending, level);
  clearTimeout(timer);
  timer = setTimeout(() => {
    const l = pending;
    pending = 0;
    if (!photo) return;
    if (l >= 3) quantize();
    else if (l === 2) cleanup();
    else buildSheets();
  }, 120);
}

// ---------- Events ----------

/** Moves the sheet at stack position from to position to. @created Claude (claude-opus-5-5) 2026-11-13 */
function moveSheet(from, to) {
  if (to < 0 || to >= order.length || from === to) return;
  const [c] = order.splice(from, 1);
  order.splice(to, 0, c);
  buildSheets();
}

/** Binds every control. @created Claude (claude-opus-5-5) 2026-11-13 */
function bind() {
  $('count').value = settings.count;
  $('min-piece').value = settings.minPieceMm;
  $('smooth').value = settings.smooth;
  $('frame-on').checked = settings.frameOn;
  $('frame-width').value = settings.frameWidth;
  $('width').value = settings.width;
  $('unit').value = settings.unit;
  updateReadouts();

  $('file').addEventListener('change', (e) => {
    loadPhoto(e.target.files[0]);
    e.target.value = '';
  });
  $('count').addEventListener('input', (e) => { settings.count = Number(e.target.value); schedule(3); });
  $('min-piece').addEventListener('input', (e) => { settings.minPieceMm = Number(e.target.value); schedule(2); });
  $('smooth').addEventListener('input', (e) => { settings.smooth = Number(e.target.value); schedule(2); });
  $('frame-on').addEventListener('change', (e) => { settings.frameOn = e.target.checked; schedule(1); });
  $('frame-width').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (v >= MIN_FRAME) { settings.frameWidth = v; schedule(1); }
  });
  $('width').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (v >= MIN_WIDTH) { settings.width = v; schedule(2); }
  });
  $('unit').addEventListener('change', (e) => {
    const factor = MM_PER_UNIT[settings.unit] / MM_PER_UNIT[e.target.value];
    settings.unit = e.target.value;
    settings.width = round(settings.width * factor);
    settings.frameWidth = round(settings.frameWidth * factor);
    $('width').value = settings.width;
    $('frame-width').value = settings.frameWidth;
    saveSettings();
    if (photo) render();
    else updateReadouts();
  });
  $('export').addEventListener('click', exportSvg);
  $('view-sheets').addEventListener('click', () => { picking = -1; setView('sheets'); if (photo) renderStatus(); });
  $('view-photo').addEventListener('click', () => setView('photo'));

  $('photo-view').addEventListener('click', (e) => {
    if (picking < 0 || picking >= palette.length) return;
    const canvas = e.currentTarget;
    const x = Math.floor((e.offsetX / canvas.clientWidth) * photo.w);
    const y = Math.floor((e.offsetY / canvas.clientHeight) * photo.h);
    const sum = [0, 0, 0];
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = Math.min(photo.w - 1, Math.max(0, x + dx));
        const py = Math.min(photo.h - 1, Math.max(0, y + dy));
        for (let j = 0; j < 3; j++) sum[j] += photo.rgba[(py * photo.w + px) * 4 + j];
        n++;
      }
    }
    palette[picking] = sum.map((s) => Math.round(s / n));
    picking = -1;
    setView('sheets');
    cleanup();
  });

  const list = $('layers');
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const i = Number(btn.closest('li').dataset.index);
    const c = sheets[i].color;
    switch (btn.dataset.action) {
      case 'toggle':
        if (hidden.has(c)) hidden.delete(c);
        else hidden.add(c);
        render();
        break;
      case 'islands':
        highlight = highlight === c ? -1 : c;
        renderIslands();
        renderLayers();
        break;
      case 'pick':
        picking = c;
        setView('photo');
        renderStatus();
        break;
      case 'forward':
        moveSheet(i, i + 1);
        break;
      case 'back':
        moveSheet(i, i - 1);
        break;
      default:
        break;
    }
  });
  // While the picker is open, only the swatch updates; the rebuild waits for `change` so the
  // open picker's input is not replaced by renderLayers.
  list.addEventListener('input', (e) => {
    if (e.target.dataset.action !== 'color') return;
    e.target.parentElement.style.background = e.target.value;
  });
  list.addEventListener('change', (e) => {
    if (e.target.dataset.action !== 'color') return;
    const i = Number(e.target.closest('li').dataset.index);
    palette[sheets[i].color] = fromHex(e.target.value);
    schedule(2);
  });

  // Drag rows to reorder sheets.
  let dragFrom = -1;
  list.addEventListener('dragstart', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    dragFrom = Number(li.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.index);
  });
  list.addEventListener('dragover', (e) => {
    if (dragFrom < 0) return;
    e.preventDefault();
    list.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    e.target.closest('li')?.classList.add('drop-target');
  });
  list.addEventListener('drop', (e) => {
    if (dragFrom < 0) return;
    e.preventDefault();
    e.stopPropagation();
    const li = e.target.closest('li');
    if (li) moveSheet(dragFrom, Number(li.dataset.index));
    dragFrom = -1;
  });
  list.addEventListener('dragend', () => {
    dragFrom = -1;
    list.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
  });

  // Drop a photo anywhere on the page.
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    document.body.classList.add('dragging');
  });
  window.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) document.body.classList.remove('dragging');
  });
  window.addEventListener('drop', (e) => {
    document.body.classList.remove('dragging');
    if (!hasFiles(e)) return;
    e.preventDefault();
    loadPhoto(e.dataTransfer.files[0]);
  });

  new ResizeObserver(fitStage).observe($('area'));
}

bind();
