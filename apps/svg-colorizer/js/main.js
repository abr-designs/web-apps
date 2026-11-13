// Created by Claude (claude-opus-5-5)
// Date: 2026-11-13
// Wires the toolbar, preview and sheets panel to the photo-to-sheets pipeline.

import { components, imageToLab, kmeans, labelPixels, mergeSmallPieces, modeFilter, rgbToLab } from './quantize.js';
import { applyBridges, applyCuts, eraseIslands, findIslands, segDist2, sheetMasks, snapToMask, strokePixels } from './sheets.js';
import { maskToPath } from './trace.js';

const MAX_DIM = 600;
const MM_PER_UNIT = { in: 25.4, cm: 10 };
const STORE_KEY = 'svg-colorizer:settings';
const MIN_WIDTH = 1; // matches the width input's min
const MIN_FRAME = 0.05; // matches the frame width input's min
const MIN_BRIDGE = 0.01; // matches the bridge width input's min
const MAX_COLORS = 20; // automatic plus added colors
const PICK_NEW = -2; // `picking` value while the eyedropper chooses an added color
const DRAG_PX = 4; // pointer travel that turns a click into a brush stroke
const ISLAND_RGBA = [214, 51, 108, 190];
const BRIDGE_START_RGBA = [46, 140, 140, 200];
const HOLE_VEIL_RGBA = [43, 42, 40, 140];
const FOCUS_RGBA = [232, 179, 58, 150];
const STROKE_STYLE = { cut: 'rgba(43, 42, 40, 0.55)', restore: 'rgba(46, 140, 140, 0.55)', focus: 'rgba(232, 179, 58, 0.6)' };

const ICONS = {
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/></svg>',
  bridge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="3"/><circle cx="19" cy="12" r="3"/><path d="M8 12h8"/></svg>',
  eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H9l-5-5a2 2 0 0 1 0-2.8L12.2 4a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L11 20"/><path d="M8 9l7 7"/></svg>',
  remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  handle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h14"/></svg>',
  pipette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 7l6 6M4 20l1-4 9.5-9.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M15 5l2-2a2.1 2.1 0 0 1 3 3l-2 2"/></svg>',
};

const $ = (id) => document.getElementById(id);

const DEFAULTS = { count: 5, minPieceMm: 3, smooth: 2, frameOn: true, frameWidth: 0.5, bridgeWidth: 0.08, brush: 12, width: 12, unit: 'in' };
const settings = sanitizeSettings(loadSettings());
let photo = null; // { name, w, h, rgba, lab }
let palette = []; // RGB triples
let autoCount = 0; // palette[0, autoCount) were chosen automatically; the rest were added by eyedropper
let order = []; // palette indices, back to front
let labels = null;
let sheets = []; // { color, mask, islandMask, islands, d, empty, bridgeSegs }, back to front
let bridges = []; // { color, ax, ay, bx, by }: two clicked points in photo pixels
let bridging = -1; // palette index whose sheet is in bridge mode
let bridgeStart = null; // { x, y } first click of a bridge in progress
let cuts = []; // { color, r, pts, restore }: brush strokes in photo pixels
let erased = []; // { color, p }: one pixel index on each erased island
let erasing = -1; // palette index whose sheet is in erase mode
let focus = null; // Uint8Array, 1 on photo pixels inside a focus area
let focusing = false;
let focusDirty = false; // the focus area changed since the automatic colors were last picked
let stroke = null; // brush stroke in progress: { pts, restore, moved, sx, sy, base }
const hidden = new Set(); // palette indices hidden in the preview
let highlight = -1; // palette index whose islands are drawn
let picking = -1; // palette index waiting for an eyedropper click, or PICK_NEW
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
  if (Number.isInteger(saved.count) && inRange(saved.count, 2, 20)) s.count = saved.count;
  if (inRange(saved.minPieceMm, 0, 12)) s.minPieceMm = saved.minPieceMm;
  if (Number.isInteger(saved.smooth) && inRange(saved.smooth, 0, 8)) s.smooth = saved.smooth;
  if (typeof saved.frameOn === 'boolean') s.frameOn = saved.frameOn;
  if (inRange(saved.frameWidth, MIN_FRAME, 1000)) s.frameWidth = saved.frameWidth;
  if (inRange(saved.bridgeWidth, MIN_BRIDGE, 1000)) s.bridgeWidth = saved.bridgeWidth;
  if (inRange(saved.width, MIN_WIDTH, 10000)) s.width = saved.width;
  if (Number.isInteger(saved.brush) && inRange(saved.brush, 2, 40)) s.brush = saved.brush;
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
  palette = [];
  autoCount = 0;
  focus = null;
  focusDirty = false;
  sheets = [];
  highlight = -1;
  setMode(null);
  setView('sheets');
  fitStage();
  quantize();
}

/**
 * Picks fresh automatic colors, keeps added ones, and stacks sheets by area, largest at the back.
 * Sheet edits are keyed by palette color, so they reset here.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
function quantize() {
  const added = palette.slice(autoCount);
  const auto = kmeans(photo.lab, photo.rgba, settings.count, 1, focus);
  autoCount = auto.length;
  palette = auto.concat(added);
  hidden.clear();
  highlight = -1;
  bridges = [];
  cuts = [];
  erased = [];
  sheets = [];
  focusDirty = false;
  setMode(focusing ? 'focus' : null);
  if (picking !== -1) {
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
  // An erased island is remembered by one pixel, which may sit in another piece once pixels are re-labelled.
  erased = [];
  labels = labelPixels(lab, palette.map((c) => rgbToLab(...c)));
  labels = modeFilter(labels, w, h, palette.length, settings.smooth, focus);
  const d = settings.minPieceMm * pxPerMm();
  const minArea = Math.round((Math.PI / 4) * d * d);
  // Inside a focus area a piece only needs a quarter of the Min piece size across (a sixteenth of the area).
  mergeSmallPieces(labels, w, h, minArea, focus, Math.round(minArea / 16));
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
  const bridgePx = settings.bridgeWidth * MM_PER_UNIT[settings.unit] * pxPerMm();
  sheets = sheetMasks(labels, w, h, order, framePx).map((mask, i) => {
    // The back sheet is uncut, so it takes no bridges or erasing.
    const mine = (list) => list.filter((e) => e.color === order[i]);
    let bridgeSegs = [];
    let isl = { islandMask: null, count: 0, seeds: [] };
    if (i > 0) {
      bridgeSegs = applyBridges(mask, w, h, mine(bridges), bridgePx);
      applyCuts(mask, w, h, mine(cuts));
      eraseIslands(mask, w, h, mine(erased).map((e) => e.p), framePx);
      isl = findIslands(mask, w, h, framePx);
    }
    return {
      color: order[i],
      mask,
      islandMask: isl.islandMask,
      islands: isl.count,
      seeds: isl.seeds,
      d: maskToPath(mask, w, h, settings.smooth),
      // Empty: no pixel of this sheet's own color survived cleanup, so its shape would duplicate the next sheet.
      empty: used[order[i]] === 0,
      bridgeSegs,
    };
  });
  // A sheet reordered to the back is uncut, so its edit mode ends.
  if ((bridging >= 0 && sheets[0].color === bridging) || (erasing >= 0 && sheets[0].color === erasing)) setMode(null);
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
  renderPaint();
  renderLayers();
  renderStatus();
  updateReadouts();
}

/**
 * Paints the highlighted sheet's islands over the preview. In bridge or erase mode it paints the edited
 * sheet instead: holes veiled, islands marked, and the piece picked by a first bridge click tinted.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
function renderIslands() {
  const canvas = $('islands-view');
  const editing = bridging >= 0 ? bridging : erasing;
  const sheet = sheets.find((s) => s.color === (editing >= 0 ? editing : highlight));
  canvas.hidden = view !== 'sheets' || !sheet || (editing < 0 && !sheet.islands);
  if (canvas.hidden) return;
  const { w, h } = photo;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  let startComp = null;
  if (bridging >= 0 && bridgeStart) {
    const p = snapToMask(sheet.mask, w, h, bridgeStart.x, bridgeStart.y);
    if (p >= 0) {
      const { comp } = components(sheet.mask, w, h);
      startComp = { comp, id: comp[p] };
    }
  }
  for (let p = 0; p < sheet.mask.length; p++) {
    if (startComp && startComp.comp[p] === startComp.id) img.data.set(BRIDGE_START_RGBA, p * 4);
    else if (sheet.islandMask?.[p]) img.data.set(ISLAND_RGBA, p * 4);
    else if (editing >= 0 && !sheet.mask[p]) img.data.set(HOLE_VEIL_RGBA, p * 4);
  }
  ctx.putImageData(img, 0, 0);
}

/** Paints the focus area while focus mode is on. @created Claude (claude-opus-5-5) 2026-11-13 */
function renderPaint() {
  const canvas = $('paint-view');
  canvas.hidden = !photo || !(focusing || stroke);
  if (canvas.hidden) return;
  const { w, h } = photo;
  canvas.width = w;
  canvas.height = h;
  if (!focusing || !focus) return;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let p = 0; p < focus.length; p++) if (focus[p]) img.data.set(FOCUS_RGBA, p * 4);
  ctx.putImageData(img, 0, 0);
}

/**
 * Switches the preview's edit mode: 'bridge' or 'erase' for the sheet of palette color `color`, 'focus',
 * or null for none. Only one mode is on at a time. Leaving focus mode after painting re-picks the
 * automatic colors.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
function setMode(mode, color = -1) {
  const applyFocus = focusing && mode !== 'focus' && focusDirty;
  bridging = mode === 'bridge' ? color : -1;
  erasing = mode === 'erase' ? color : -1;
  focusing = mode === 'focus';
  bridgeStart = null;
  stroke = null;
  const stage = $('stage');
  stage.classList.toggle('bridging', bridging >= 0);
  stage.classList.toggle('painting', erasing >= 0 || focusing);
  $('focus').setAttribute('aria-pressed', String(focusing));
  $('brush').disabled = !(erasing >= 0 || focusing);
  if (!(erasing >= 0 || focusing)) $('brush-cursor').hidden = true;
  if (applyFocus && photo) {
    quantize();
    return;
  }
  if (!photo || !sheets.length) return;
  renderIslands();
  renderPaint();
  renderLayers();
  renderStatus();
}

/** Converts a pointer event to photo pixel coordinates, plus screen pixels per photo pixel. @created Claude (claude-opus-5-5) 2026-11-13 */
function stagePoint(e) {
  const rect = $('stage').getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * photo.w, y: ((e.clientY - rect.top) / rect.height) * photo.h, scale: rect.width / photo.w };
}

/** Redraws the brush stroke in progress over the paint canvas. @created Claude (claude-opus-5-5) 2026-11-13 */
function drawStroke() {
  const ctx = $('paint-view').getContext('2d');
  ctx.putImageData(stroke.base, 0, 0);
  const { pts } = stroke;
  ctx.save();
  if (focusing && stroke.restore) ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = focusing ? (stroke.restore ? '#000' : STROKE_STYLE.focus) : STROKE_STYLE[stroke.restore ? 'restore' : 'cut'];
  ctx.lineWidth = settings.brush;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  // A single point still needs a visible dot.
  if (pts.length === 2) ctx.lineTo(pts[0] + 0.01, pts[1]);
  ctx.stroke();
  ctx.restore();
}

/**
 * Commits a finished brush stroke. In erase mode a click on an island removes it, and a drag cuts (or,
 * with Shift, restores) paper. In focus mode the stroke adds to (or, with Shift, removes from) the focus
 * area, which is applied when focus mode ends.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
function finishStroke(s) {
  const { w, h } = photo;
  const r = settings.brush / 2;
  if (focusing) {
    focus ||= new Uint8Array(w * h);
    strokePixels(w, h, s.pts, r, (p) => { focus[p] = s.restore ? 0 : 1; });
    if (!focus.some((v) => v)) focus = null;
    focusDirty = true;
    renderPaint();
    updateReadouts();
    return;
  }
  const sheet = sheets.find((sh) => sh.color === erasing);
  if (!sheet) return;
  // A plain click only ever removes an island; cutting paper takes a drag, so a mis-click cuts nothing.
  if (!s.moved) {
    const p = snapToMask(sheet.mask, w, h, s.pts[0], s.pts[1]);
    if (!s.restore && p >= 0 && sheet.islandMask?.[p]) {
      erased.push({ color: erasing, p });
      buildSheets();
      return;
    }
    renderPaint();
    setStatus('No island there. Drag to cut paper away.', true);
    return;
  }
  cuts.push({ color: erasing, r, pts: s.pts, restore: s.restore });
  buildSheets();
}

/** Adds the picked color as a new front sheet, or replaces the color being picked. @created Claude (claude-opus-5-5) 2026-11-13 */
function applyPick(rgb) {
  if (picking === PICK_NEW) {
    palette.push(rgb);
    order.push(palette.length - 1);
  } else {
    palette[picking] = rgb;
  }
  picking = -1;
  setView('sheets');
  cleanup();
}

/** Removes an added color and its sheet, renumbering the palette indices that follow it. @created Claude (claude-opus-5-5) 2026-11-13 */
function removeColor(c) {
  const shift = (x) => (x > c ? x - 1 : x);
  const remap = (list) => list.filter((e) => e.color !== c).map((e) => ({ ...e, color: shift(e.color) }));
  palette.splice(c, 1);
  order = order.filter((x) => x !== c).map(shift);
  bridges = remap(bridges);
  cuts = remap(cuts);
  erased = remap(erased);
  const stillHidden = [...hidden].filter((x) => x !== c).map(shift);
  hidden.clear();
  stillHidden.forEach((x) => hidden.add(x));
  highlight = -1;
  sheets = [];
  setMode(null);
  if (picking !== -1) {
    picking = -1;
    setView('sheets');
  }
  cleanup();
}

/**
 * Handles a preview click in bridge mode: removes a clicked bridge, or records the first piece, or joins
 * it to the second.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
function bridgeClick(e) {
  if (bridging < 0) return;
  const sheet = sheets.find((s) => s.color === bridging);
  if (!sheet) return;
  const { w, h } = photo;
  const { x, y } = stagePoint(e);
  const own = bridges.filter((b) => b.color === bridging);
  const reach = Math.max(0.75, (settings.bridgeWidth * MM_PER_UNIT[settings.unit] * pxPerMm()) / 2) + 2;
  const hit = sheet.bridgeSegs.findIndex((seg) => seg && segDist2(x, y, seg) <= reach * reach);
  if (hit >= 0) {
    bridges.splice(bridges.indexOf(own[hit]), 1);
    bridgeStart = null;
    buildSheets();
    return;
  }
  const p = snapToMask(sheet.mask, w, h, x, y);
  if (p < 0) {
    setStatus('Click on a piece of this sheet. Veiled areas are holes.', true);
    return;
  }
  if (!bridgeStart) {
    bridgeStart = { x, y };
    renderIslands();
    setStatus('Now click the piece to join it to.');
    return;
  }
  const { comp } = components(sheet.mask, w, h);
  if (comp[snapToMask(sheet.mask, w, h, bridgeStart.x, bridgeStart.y)] === comp[p]) {
    setStatus('That is the same piece. Click a different one.', true);
    return;
  }
  bridges.push({ color: bridging, ax: bridgeStart.x, ay: bridgeStart.y, bx: x, by: y });
  bridgeStart = null;
  buildSheets();
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
    li.dataset.index = String(i);
    li.dataset.color = String(s.color);
    const added = s.color >= autoCount;
    const bridgeCount = bridges.filter((b) => b.color === s.color).length;
    const bridgeInfo = bridgeCount
      ? ` · ${bridgeCount} bridge${bridgeCount > 1 ? 's' : ''} <button class="link" type="button" data-action="clear-bridges" aria-label="Clear bridges on sheet ${i + 1}">Clear</button>`
      : '';
    const eraseInfo = cuts.some((c) => c.color === s.color) || erased.some((e) => e.color === s.color)
      ? ` · erased <button class="link" type="button" data-action="clear-erase" aria-label="Undo erasing on sheet ${i + 1}">Clear</button>`
      : '';
    const islandBadge = s.islands
      ? `<span class="layer__islands"><button class="badge" type="button" data-action="islands" aria-pressed="${highlight === s.color}" title="Show islands on the preview">${s.islands} island${s.islands > 1 ? 's' : ''}</button><button class="link" type="button" data-action="erase-all" aria-label="Erase all islands on sheet ${i + 1}">Erase all</button></span>`
      : '';
    const removeBtn = added
      ? `<button class="icon" type="button" data-action="remove" aria-label="Remove added sheet ${i + 1}" title="Remove this added color">${ICONS.remove}</button>`
      : '';
    li.innerHTML = `
      <button class="icon" type="button" data-action="toggle" aria-pressed="${!off}" aria-label="Show sheet ${i + 1}" title="Show or hide in preview">${off ? ICONS.eyeOff : ICONS.eye}</button>
      <label class="swatch" style="background:${hex}" title="Change color"><input type="color" value="${hex}" data-action="color" aria-label="Color of sheet ${i + 1}"></label>
      <span class="layer__text">
        <span class="layer__name">Sheet ${i + 1}${i === 0 ? ' (back)' : ''}</span>
        <span class="layer__meta">${hex.toUpperCase()}${added ? ' · added' : ''}${s.empty ? ' · empty' : ''}${bridgeInfo}${eraseInfo}</span>
        ${islandBadge}
      </span>
      <button class="icon" type="button" data-action="bridge" aria-pressed="${bridging === s.color}" aria-label="Bridge pieces on sheet ${i + 1}" title="${i === 0 ? 'The back sheet is uncut and needs no bridges' : 'Bridge pieces: click two pieces on the preview'}" ${i === 0 ? 'disabled' : ''}>${ICONS.bridge}</button>
      <button class="icon" type="button" data-action="erase" aria-pressed="${erasing === s.color}" aria-label="Erase on sheet ${i + 1}" title="${i === 0 ? 'The back sheet is uncut and has nothing to erase' : 'Erase: click islands or brush paper away on the preview'}" ${i === 0 ? 'disabled' : ''}>${ICONS.eraser}</button>
      <button class="icon" type="button" data-action="pick" aria-label="Pick color for sheet ${i + 1} from the photo" title="Pick color from photo">${ICONS.pipette}</button>
      ${removeBtn}
      <button class="icon handle" type="button" aria-label="Reorder sheet ${i + 1}. Drag, or use the up and down arrow keys" title="Drag to reorder">${ICONS.handle}</button>`;
    rows.push(li);
  }
  $('layers').replaceChildren(...rows);
}

/** Shows the eyedropper hint or the island summary. @created Claude (claude-opus-5-5) 2026-11-13 */
function renderStatus() {
  if (picking !== -1) {
    setStatus(picking === PICK_NEW ? 'Click the photo to pick the new sheet\'s color. It goes to the front.' : 'Click the photo to pick this sheet\'s color.');
    return;
  }
  if (erasing >= 0) {
    const n = sheets.findIndex((s) => s.color === erasing) + 1;
    setStatus(`Erasing sheet ${n}: click an island to remove it, or drag to cut paper away. Shift+drag puts paper back. Esc when done.`);
    return;
  }
  if (focusing) {
    setStatus('Paint over details to keep, like an eye. Shift+drag removes focus. Press Esc or Focus to apply it.');
    return;
  }
  if (bridging >= 0) {
    const n = sheets.findIndex((s) => s.color === bridging) + 1;
    setStatus(bridgeStart
      ? 'Now click the piece to join it to.'
      : `Bridging sheet ${n}: click two pieces to join them, or click a bridge to remove it. Press Esc when done.`);
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
  document.querySelectorAll('.unit-label').forEach((el) => { el.textContent = unit; });
  $('height-out').textContent = photo ? `× ${round((settings.width * photo.h) / photo.w)} ${unit}` : '';
  $('brush-out').textContent = photo ? `${round(settings.brush / pxPerMm() / MM_PER_UNIT[unit])} ${unit}` : '';
  const addedCount = palette.length - autoCount;
  $('count').max = String(MAX_COLORS - addedCount);
  $('add-color').disabled = !photo || settings.count + addedCount >= MAX_COLORS;
  $('focus-clear').hidden = !focus;
}

/** Switches the preview between the sheet stack and the source photo. @created Claude (claude-opus-5-5) 2026-11-13 */
function setView(next) {
  view = next;
  $('view-sheets').setAttribute('aria-pressed', String(view === 'sheets'));
  $('view-photo').setAttribute('aria-pressed', String(view === 'photo'));
  $('sheets-view').hidden = view !== 'sheets';
  $('photo-view').hidden = view !== 'photo';
  $('stage').classList.toggle('picking', picking !== -1);
  if (photo && sheets.length) {
    renderIslands();
    renderPaint();
  }
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

/** Samples the photo color around (x, y), averaging a 3x3 block. @created Claude (claude-opus-5-5) 2026-11-13 */
function sampleColor(x, y) {
  const sum = [0, 0, 0];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = Math.min(photo.w - 1, Math.max(0, x + dx));
      const py = Math.min(photo.h - 1, Math.max(0, y + dy));
      for (let j = 0; j < 3; j++) sum[j] += photo.rgba[(py * photo.w + px) * 4 + j];
    }
  }
  return sum.map((v) => Math.round(v / 9));
}

/**
 * Drags a sheet row by its handle. The row follows the pointer while the rows it passes slide aside, and
 * the stack order changes on release. The panel or page scrolls when the pointer nears its edge.
 * @created Claude (claude-opus-5-5) 2026-11-13
 */
function startRowDrag(e, handle) {
  const list = $('layers');
  const li = handle.closest('li');
  const rows = [...list.children];
  const from = rows.indexOf(li);
  const centers = rows.map((r) => r.offsetTop + r.offsetHeight / 2);
  const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
  const size = li.offsetHeight + gap;
  const panel = list.closest('.layers');
  const scroller = panel.scrollHeight > panel.clientHeight ? panel : document.scrollingElement;
  const startScroll = scroller.scrollTop;
  const startY = e.clientY;
  let to = from;
  handle.setPointerCapture(e.pointerId);
  li.classList.add('dragging');
  list.classList.add('sorting');

  const move = (ev) => {
    const box = scroller === panel ? panel.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    if (ev.clientY < box.top + 40) scroller.scrollTop -= 12;
    else if (ev.clientY > box.bottom - 40) scroller.scrollTop += 12;
    const dy = ev.clientY - startY + (scroller.scrollTop - startScroll);
    li.style.transform = `translateY(${dy}px)`;
    const c = centers[from] + dy;
    to = from;
    for (let k = 0; k < from; k++) {
      if (c < centers[k]) {
        to = k;
        break;
      }
    }
    for (let k = rows.length - 1; to === from && k > from; k--) if (c > centers[k]) to = k;
    rows.forEach((r, k) => {
      if (k === from) return;
      let shift = 0;
      if (k >= to && k < from) shift = size;
      else if (k <= to && k > from) shift = -size;
      r.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  };
  const end = (ev) => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    rows.forEach((r) => { r.style.transform = ''; });
    li.classList.remove('dragging');
    list.classList.remove('sorting');
    // Rows are listed front first, so list position k is stack position n - 1 - k.
    const n = rows.length;
    // The list was redrawn mid-drag (a slider update, say), so the drag's row positions no longer apply.
    if (!li.isConnected || sheets.length !== n) return;
    if (ev.type === 'pointerup' && to !== from) {
      const color = sheets[n - 1 - from].color;
      moveSheet(n - 1 - from, n - 1 - to);
      list.querySelector(`li[data-color="${color}"] .handle`)?.focus();
    }
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

/** Binds every control. @created Claude (claude-opus-5-5) 2026-11-13 */
function bind() {
  $('count').value = settings.count;
  $('min-piece').value = settings.minPieceMm;
  $('smooth').value = settings.smooth;
  $('frame-on').checked = settings.frameOn;
  $('frame-width').value = settings.frameWidth;
  $('bridge-width').value = settings.bridgeWidth;
  $('brush').value = settings.brush;
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
  $('bridge-width').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (v >= MIN_BRIDGE) { settings.bridgeWidth = v; schedule(1); }
  });
  $('brush').addEventListener('input', (e) => {
    settings.brush = Number(e.target.value);
    saveSettings();
    updateReadouts();
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
    settings.bridgeWidth = Math.max(MIN_BRIDGE, round(settings.bridgeWidth * factor, 3));
    $('width').value = settings.width;
    $('frame-width').value = settings.frameWidth;
    $('bridge-width').value = settings.bridgeWidth;
    saveSettings();
    if (photo) render();
    else updateReadouts();
  });
  $('export').addEventListener('click', exportSvg);
  $('view-sheets').addEventListener('click', () => { picking = -1; setView('sheets'); if (photo) renderStatus(); });
  $('view-photo').addEventListener('click', () => {
    if (bridging >= 0 || erasing >= 0) setMode(null);
    setView('photo');
  });
  $('focus').addEventListener('click', () => {
    if (!photo) {
      setStatus('Choose a photo first.', true);
      return;
    }
    picking = -1;
    // The photo shows the details a focus area is meant to keep.
    if (!focusing) setView('photo');
    setMode(focusing ? null : 'focus');
  });
  $('focus-clear').addEventListener('click', () => {
    focus = null;
    focusDirty = false;
    quantize();
  });
  $('add-color').addEventListener('click', () => {
    setMode(null);
    picking = PICK_NEW;
    setView('photo');
    renderStatus();
  });
  $('sheets-view').addEventListener('click', bridgeClick);
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (bridging >= 0 || erasing >= 0 || focusing) setMode(null);
    if (picking !== -1) {
      picking = -1;
      setView('sheets');
      renderStatus();
    }
  });

  $('photo-view').addEventListener('click', (e) => {
    if (picking === -1 || focusing) return;
    const canvas = e.currentTarget;
    applyPick(sampleColor(Math.floor((e.offsetX / canvas.clientWidth) * photo.w), Math.floor((e.offsetY / canvas.clientHeight) * photo.h)));
  });

  // Brush strokes for erase and focus modes.
  const stage = $('stage');
  const cursor = $('brush-cursor');
  stage.addEventListener('pointerdown', (e) => {
    if (!(erasing >= 0 || focusing) || e.button !== 0) return;
    e.preventDefault();
    stage.setPointerCapture(e.pointerId);
    const { x, y } = stagePoint(e);
    stroke = { pts: [x, y], restore: e.shiftKey, moved: false, sx: e.clientX, sy: e.clientY };
    // Sized to the photo, which also clears anything left from an earlier mode or photo.
    const canvas = $('paint-view');
    canvas.hidden = false;
    canvas.width = photo.w;
    canvas.height = photo.h;
    if (focusing) renderPaint();
    stroke.base = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    drawStroke();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!(erasing >= 0 || focusing)) return;
    const { x, y, scale } = stagePoint(e);
    const d = settings.brush * scale;
    cursor.hidden = false;
    cursor.style.width = `${d}px`;
    cursor.style.height = `${d}px`;
    cursor.style.left = `${x * scale - d / 2}px`;
    cursor.style.top = `${y * scale - d / 2}px`;
    if (!stroke) return;
    if (!stroke.moved && Math.hypot(e.clientX - stroke.sx, e.clientY - stroke.sy) < DRAG_PX) return;
    stroke.moved = true;
    stroke.pts.push(x, y);
    drawStroke();
  });
  stage.addEventListener('pointerup', () => {
    if (!stroke) return;
    const s = stroke;
    stroke = null;
    finishStroke(s);
  });
  stage.addEventListener('pointercancel', () => {
    stroke = null;
    renderPaint();
  });
  stage.addEventListener('pointerleave', () => { cursor.hidden = true; });

  const list = $('layers');
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const i = Number(btn.closest('li').dataset.index);
    const s = sheets[i];
    const c = s.color;
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
      case 'erase-all':
        erased.push(...s.seeds.map((p) => ({ color: c, p })));
        buildSheets();
        break;
      case 'bridge':
      case 'erase':
        if (view !== 'sheets') setView('sheets');
        picking = -1;
        setMode((btn.dataset.action === 'bridge' ? bridging : erasing) === c ? null : btn.dataset.action, c);
        break;
      case 'clear-bridges':
        bridges = bridges.filter((b) => b.color !== c);
        bridgeStart = null;
        buildSheets();
        break;
      case 'clear-erase':
        cuts = cuts.filter((x) => x.color !== c);
        erased = erased.filter((x) => x.color !== c);
        buildSheets();
        break;
      case 'pick':
        setMode(null);
        picking = c;
        setView('photo');
        renderStatus();
        break;
      case 'remove':
        removeColor(c);
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

  // Reorder sheets by their handles: drag, or arrow keys while a handle has focus.
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.handle');
    if (!handle || e.button !== 0) return;
    e.preventDefault();
    startRowDrag(e, handle);
  });
  list.addEventListener('keydown', (e) => {
    const handle = e.target.closest('.handle');
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const i = Number(handle.closest('li').dataset.index);
    const color = sheets[i].color;
    // The list shows the front first, so up moves a sheet forward.
    moveSheet(i, e.key === 'ArrowUp' ? i + 1 : i - 1);
    list.querySelector(`li[data-color="${color}"] .handle`)?.focus();
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
