// Created by Claude (claude-opus-5-5)
// Date: 2026-10-14

// Loaded as classic scripts so index.html also works when opened from disk.
const { heicTo, isHeic } = window.HeicTo;

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const formatSelect = document.getElementById('format');
const qualityField = document.getElementById('quality-field');
const qualityInput = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const summary = document.getElementById('summary');
const progress = document.getElementById('progress');
const reconvertButton = document.getElementById('reconvert');
const clearButton = document.getElementById('clear');
const downloadAllButton = document.getElementById('download-all');
const list = document.getElementById('files');

/** @type {{ file: File, status: string, error?: string, blob?: Blob, url?: string, outName?: string, el: HTMLLIElement }[]} */
let items = [];
let queue = Promise.resolve();
let zipping = false;

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
function currentSettings() {
  return { type: formatSelect.value, quality: Number(qualityInput.value) };
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
function outputName(file, type) {
  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.${EXTENSIONS[type]}`;
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
async function convertOther(file, type, quality) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (type === 'image/jpeg') {
    // JPEG has no alpha; flatten onto white instead of black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), type, quality);
  });
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
async function convert(item) {
  const { type, quality } = currentSettings();
  item.status = 'converting';
  item.error = undefined;
  render(item);
  try {
    const blob = (await isHeic(item.file))
      ? await heicTo({ blob: item.file, type, quality })
      : await convertOther(item.file, type, quality);
    // Removed while converting: drop the result instead of leaking a URL.
    if (!items.includes(item)) return;
    if (item.url) URL.revokeObjectURL(item.url);
    item.blob = blob;
    item.url = URL.createObjectURL(blob);
    item.outName = outputName(item.file, type);
    item.status = 'done';
  } catch (err) {
    item.status = 'error';
    item.error = err?.message || 'Unsupported or corrupt image';
  }
  render(item);
  updateToolbar();
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
function enqueue(item) {
  item.status = 'queued';
  render(item);
  // One at a time: HEIC decoding is memory heavy.
  queue = queue.then(() => (items.includes(item) ? convert(item) : undefined));
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
function render(item) {
  const { el } = item;
  el.replaceChildren();

  const thumb = document.createElement(item.url ? 'img' : 'div');
  thumb.className = 'thumb';
  if (item.url) {
    thumb.src = item.url;
    thumb.alt = '';
  }

  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = item.file.name;
  name.title = item.file.name;
  const status = document.createElement('div');
  status.className = `status ${item.status}`;
  status.textContent = {
    queued: 'Queued',
    converting: 'Converting...',
    done: `${item.outName} · ${formatSize(item.file.size)} → ${formatSize(item.blob?.size ?? 0)}`,
    error: `Failed: ${item.error}`,
  }[item.status];
  meta.append(name, status);

  el.append(thumb, meta);

  if (item.status === 'done') {
    const link = document.createElement('a');
    link.className = 'button';
    link.href = item.url;
    link.download = item.outName;
    link.textContent = 'Download';
    el.append(link);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '✕';
  remove.title = 'Remove';
  remove.setAttribute('aria-label', `Remove ${item.file.name}`);
  remove.addEventListener('click', () => removeItem(item));
  el.append(remove);
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
function removeItem(item) {
  if (item.url) URL.revokeObjectURL(item.url);
  item.el.remove();
  items = items.filter((i) => i !== item);
  updateToolbar();
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
function updateToolbar() {
  const done = items.filter((i) => i.status === 'done').length;
  const failed = items.filter((i) => i.status === 'error').length;
  const busy = items.some((i) => i.status === 'queued' || i.status === 'converting');
  summary.textContent = items.length
    ? `${done} of ${items.length} converted${failed ? `, ${failed} failed` : ''}`
    : '';
  progress.hidden = !busy;
  progress.max = items.length || 1;
  progress.value = done + failed;
  clearButton.hidden = items.length === 0;
  reconvertButton.hidden = items.length === 0;
  reconvertButton.disabled = busy;
  downloadAllButton.hidden = done < 2;
  downloadAllButton.disabled = busy || zipping;
  downloadAllButton.textContent = `Download all (${done}) as .zip`;
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
function addFiles(fileList) {
  for (const file of fileList) {
    const el = document.createElement('li');
    list.append(el);
    const item = { file, status: 'queued', el };
    items.push(item);
    enqueue(item);
  }
  updateToolbar();
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
async function downloadAll() {
  const zip = new JSZip();
  const used = new Set();
  for (const item of items) {
    if (item.status !== 'done') continue;
    let name = item.outName;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      name = item.outName.replace(/(\.[^.]+)$/, ` (${n})$1`);
    }
    used.add(name.toLowerCase());
    zip.file(name, item.blob);
  }
  zipping = true;
  updateToolbar();
  try {
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted-images.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    alert(`Could not build the zip: ${err?.message || err}`);
  } finally {
    zipping = false;
    updateToolbar();
  }
}

/** @created Claude (claude-opus-5-5) — 2026-10-14 */
function syncQualityField() {
  qualityField.hidden = formatSelect.value === 'image/png';
  qualityValue.textContent = qualityInput.value;
}

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('over');
});
dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('over');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('over');
  addFiles(e.dataTransfer.files);
});
// Stop near-miss drops from navigating away and losing converted files.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());
fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});

formatSelect.addEventListener('change', syncQualityField);
qualityInput.addEventListener('input', syncQualityField);

reconvertButton.addEventListener('click', () => {
  items.forEach(enqueue);
  updateToolbar();
});
clearButton.addEventListener('click', () => [...items].forEach(removeItem));
downloadAllButton.addEventListener('click', downloadAll);

syncQualityField();
