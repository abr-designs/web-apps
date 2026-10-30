// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
// Wires controls, state, the pattern pipeline, and saving.

import {
  DEFAULTS, clampCounts, countsFromSize, sizeFromCounts, parityOf, applyParity, beadCells,
} from './peyote-grid.js';
import { matchPalette, dropColors } from './quantize.js';
import { buildPattern } from './pattern.js';
import { loadCatalog, filterAvailable, openPicker } from './catalog.js';
import { createStage } from './image-stage.js';
import { renderPattern, downloadPng, fillPrintPage, legendTable, COLOR_NOTE } from './export.js';
import { saveState, loadState } from './persist.js';

const $ = (id) => document.getElementById(id);
const DEBOUNCE_MS = 150;
const SAMPLING_MODES = ['average', 'majority', 'nearest'];

/** localStorage, or null when the browser blocks it. */
function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const saved = loadState(storage());
const state = {
  settings: {
    widthCm: DEFAULTS.widthCm,
    heightCm: DEFAULTS.heightCm,
    columns: DEFAULTS.columns,
    rows: DEFAULTS.rows,
    pitchX: DEFAULTS.pitchXmm,
    pitchY: DEFAULTS.pitchYmm,
    detail: 50,
    sampling: 'average',
    maxColors: 12,
    pack: { beads: 1000, grams: 5, price: 10 },
    ...saved?.settings,
  },
  transform: saved?.transform ?? { offsetX: 0, offsetY: 0, scale: 1 },
  available: new Set(saved?.available ?? []),
  removed: new Set(saved?.removed ?? []),
  photo: saved?.photo ?? null,
};
const s = state.settings;
if (!SAMPLING_MODES.includes(s.sampling)) s.sampling = 'average';

let catalog = null;
let pattern = null;

const stage = createStage($('stage-canvas'), { onChange: () => schedule() });

const aspect = () => s.pitchY / s.pitchX;
const round1 = (v) => Math.round(v * 10) / 10;
const numberFrom = (el, fallback) => {
  const n = parseFloat(el.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Shows or hides the one-line notice. */
function notice(text) {
  $('notice').textContent = text ?? '';
  $('notice').hidden = !text;
}

/** Copies settings into every control. */
function syncInputs() {
  $('width-cm').value = round1(s.widthCm);
  $('height-cm').value = round1(s.heightCm);
  $('columns').value = s.columns;
  $('rows').value = s.rows;
  const parity = parityOf(s.columns);
  $('parity-even').setAttribute('aria-pressed', String(parity === 'even'));
  $('parity-odd').setAttribute('aria-pressed', String(parity === 'odd'));
  $('size-readout').textContent = `Beaded size about ${round1(s.widthCm)} × ${round1(s.heightCm)} cm, ${s.columns * s.rows} beads`;
  for (const mode of SAMPLING_MODES) $(`sample-${mode}`).setAttribute('aria-pressed', String(s.sampling === mode));
  $('detail').value = s.detail;
  $('detail').disabled = s.sampling === 'nearest';
  $('zoom').value = stage.getTransform().scale;
  $('max-colors').value = s.maxColors;
  $('max-colors-out').textContent = s.maxColors;
  $('pitch-x').value = Math.round(s.pitchX * 1000) / 1000;
  $('pitch-y').value = Math.round(s.pitchY * 1000) / 1000;
  $('pack-beads').value = s.pack.beads;
  $('pack-grams').value = s.pack.grams;
  $('pack-price').value = s.pack.price;
  $('available-btn').textContent = state.available.size ? `${state.available.size} colours available` : 'All colours';
}

/** Applies new counts, keeps cm in step, and reshapes the crop frame. */
function setCounts(columns, rows) {
  Object.assign(s, clampCounts({ columns, rows }, { columns: s.columns, rows: s.rows }));
  const size = sizeFromCounts(s.columns, s.rows, s.pitchX, s.pitchY);
  s.widthCm = size.widthCm;
  s.heightCm = size.heightCm;
  stage.setFrame(s.columns, s.rows, s.pitchX, s.pitchY);
  syncInputs();
  schedule();
}

let timer = 0;
/** Debounces the pattern pipeline. */
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(update, DEBOUNCE_MS);
}

/** Sample, quantize, build, render, save. */
function update() {
  $('zoom').value = stage.getTransform().scale;
  if (!catalog) return;
  const cells = beadCells(s.columns, s.rows);
  const labs = stage.sampleCells(cells, s.detail, s.sampling);
  if (labs) {
    const palette = filterAvailable(catalog, state.available);
    const matched = matchPalette(labs, s.maxColors, palette);
    const { colors, assignments } = dropColors(labs, matched.colors, matched.assignments, state.removed);
    pattern = buildPattern({ columns: s.columns, rows: s.rows, assignments, colors, pack: s.pack });
    $('pattern-status').textContent = `${pattern.legend.length} colours`;
  } else {
    pattern = null;
    $('pattern-status').textContent = '';
  }
  renderPreview();
  renderLegend();
  save();
}

/** Fits the pattern preview into its pane. */
function renderPreview() {
  const canvas = $('pattern-canvas');
  const wrap = canvas.parentElement;
  if (!pattern) {
    canvas.width = 0;
    canvas.height = 0;
    canvas.style.width = '0';
    return;
  }
  const pad = 12;
  const cellPx = Math.max(1, Math.min(
    (wrap.clientWidth - pad * 2) / s.columns,
    (wrap.clientHeight - pad * 2) / ((s.rows + 0.5) * aspect()),
  ));
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = renderPattern(canvas, pattern, {
    cellPx, aspect: aspect(), letters: cellPx >= 14, numbers: false, legend: false, scale: dpr,
  });
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

/** Removed colours as restore buttons, or nothing when none are removed. */
function removedList() {
  if (!state.removed.size) return '';
  const names = new Map((catalog ?? []).map((c) => [c.code, c.name]));
  const chips = [...state.removed].map((code) => `<button type="button" class="btn btn-small" data-restore="${code}" title="Restore ${code}">${code} ${names.get(code) ?? ''} ↺</button>`).join('');
  return `<div class="removed-row"><span class="muted">Removed</span>${chips}<button type="button" class="btn btn-small" data-restore-all>Restore all</button></div>`;
}

/** Legend table under the panes. */
function renderLegend() {
  $('legend').innerHTML = pattern
    ? `<div class="legend-scroll">${legendTable(pattern, { removable: true })}</div>${removedList()}<p class="muted">${COLOR_NOTE}</p>`
    : '<p class="muted">Upload a photo to see the colours, bead counts, and cost.</p>';
}

let photoUrl = state.photo;
/** Saves the project; the photo is dropped when it does not fit. */
function save() {
  const { photoSaved } = saveState(storage(), {
    settings: s,
    transform: stage.getTransform(),
    available: [...state.available],
    removed: [...state.removed],
    photo: photoUrl,
  });
  if (!photoSaved && photoUrl) notice('Your photo is too large to save in this browser. Settings are saved; upload the photo again after a reload.');
}

/* Size controls */
$('width-cm').addEventListener('change', () => {
  s.widthCm = numberFrom($('width-cm'), s.widthCm);
  const { columns, rows } = countsFromSize(s.widthCm, s.heightCm, s.pitchX, s.pitchY);
  setCounts(applyParity(columns, parityOf(s.columns)), rows);
});
$('height-cm').addEventListener('change', () => {
  s.heightCm = numberFrom($('height-cm'), s.heightCm);
  const { rows } = countsFromSize(s.widthCm, s.heightCm, s.pitchX, s.pitchY);
  setCounts(s.columns, rows);
});
$('columns').addEventListener('change', () => setCounts($('columns').value, s.rows));
$('rows').addEventListener('change', () => setCounts(s.columns, $('rows').value));
$('parity-even').addEventListener('click', () => setCounts(applyParity(s.columns, 'even'), s.rows));
$('parity-odd').addEventListener('click', () => setCounts(applyParity(s.columns, 'odd'), s.rows));
$('pitch-x').addEventListener('change', () => { s.pitchX = numberFrom($('pitch-x'), s.pitchX); setCounts(s.columns, s.rows); });
$('pitch-y').addEventListener('change', () => { s.pitchY = numberFrom($('pitch-y'), s.pitchY); setCounts(s.columns, s.rows); });

/* Image controls */
for (const mode of SAMPLING_MODES) {
  $(`sample-${mode}`).addEventListener('click', () => { s.sampling = mode; syncInputs(); schedule(); });
}
$('detail').addEventListener('input', () => { s.detail = Number($('detail').value); schedule(); });
$('zoom').addEventListener('input', () => stage.setTransform({ scale: Number($('zoom').value) }));
$('fit-btn').addEventListener('click', () => stage.fit());
$('nudge-left').addEventListener('click', () => stage.nudge(-1, 0));
$('nudge-right').addEventListener('click', () => stage.nudge(1, 0));
$('nudge-up').addEventListener('click', () => stage.nudge(0, -1));
$('nudge-down').addEventListener('click', () => stage.nudge(0, 1));

/* Colour and cost controls */
$('max-colors').addEventListener('input', () => {
  s.maxColors = Number($('max-colors').value);
  $('max-colors-out').textContent = s.maxColors;
  schedule();
});
for (const [id, key] of [['pack-beads', 'beads'], ['pack-grams', 'grams'], ['pack-price', 'price']]) {
  $(id).addEventListener('change', () => {
    s.pack[key] = key === 'price' ? Math.max(0, parseFloat($(id).value) || 0) : numberFrom($(id), s.pack[key]);
    schedule();
  });
}
$('available-btn').addEventListener('click', () => {
  if (!catalog) return;
  openPicker($('picker-dialog'), catalog, state.available, (codes) => {
    state.available = codes;
    syncInputs();
    schedule();
  });
});

$('legend').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.remove) state.removed.add(btn.dataset.remove);
  else if (btn.dataset.restore) state.removed.delete(btn.dataset.restore);
  else if ('restoreAll' in btn.dataset) state.removed.clear();
  else return;
  update();
});

/* Upload and outputs */
$('upload-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  $('upload-error').textContent = '';
  try {
    await stage.loadFile(file);
    photoUrl = stage.exportPhoto();
    notice(null);
    schedule();
  } catch (err) {
    $('upload-error').textContent = err.message;
  }
});
$('export-png').addEventListener('click', () => {
  if (!pattern) { notice('Upload a photo first.'); return; }
  downloadPng(pattern, aspect(), notice);
});
$('print-btn').addEventListener('click', async () => {
  if (!pattern) { notice('Upload a photo first.'); return; }
  try {
    await fillPrintPage($('print-page'), pattern, aspect());
  } catch {
    notice('This pattern is too large to print on this device. Try fewer rows or columns.');
    return;
  }
  window.print();
});

new ResizeObserver(() => renderPreview()).observe($('pattern-canvas').parentElement);

/** Restores the saved photo and loads the catalog. */
async function init() {
  stage.setFrame(s.columns, s.rows, s.pitchX, s.pitchY);
  syncInputs();
  renderLegend();
  if (state.photo) {
    try {
      await stage.loadDataUrl(state.photo);
      stage.setTransform(state.transform);
    } catch {
      photoUrl = null;
    }
  }
  try {
    catalog = await loadCatalog();
  } catch {
    $('pattern-status').textContent = 'Could not load the bead catalog. Reload to try again.';
    return;
  }
  syncInputs();
  update();
}

init();
