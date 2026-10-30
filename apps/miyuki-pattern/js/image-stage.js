// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
// Photo stage: upload, pan, zoom, crop frame overlay, and per-bead colour sampling.
// The transform is stored in frame-width units so it survives canvas resizes:
// offsetX/offsetY move the photo centre from the frame centre, scale multiplies the cover fit.

import { frameSize, footprint } from './peyote-grid.js';
import { rgbToLab, dominantRgb } from './color.js';

const MAX_SIDE = 1600;
const PADDING = 16;
const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

/** Decodes a file or URL into an image element, rejecting anything that is not an image. */
function decode(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Choose an image file'));
    img.src = src;
  });
}

/** Creates the stage on a canvas; onChange fires after the photo or transform changes. */
export function createStage(canvas, { onChange }) {
  const ctx = canvas.getContext('2d');
  const work = document.createElement('canvas');
  const workCtx = work.getContext('2d', { willReadFrequently: true });
  let pixels = null;
  let grid = { columns: 36, rows: 94, pitchX: 1, pitchY: 1 };
  let t = { offsetX: 0, offsetY: 0, scale: 1 };
  let cssW = 0, cssH = 0;

  /** Frame height divided by frame width, from the physical bead pitch. */
  const frameRatio = () => {
    const { w, h } = frameSize(grid.columns, grid.rows);
    return (h * grid.pitchY) / (w * grid.pitchX);
  };

  /** Frame rect in CSS pixels, fitted inside the canvas. */
  const frameRect = () => {
    const ratio = frameRatio();
    const availW = Math.max(1, cssW - PADDING * 2);
    const availH = Math.max(1, cssH - PADDING * 2);
    const w = Math.min(availW, availH / ratio);
    const h = w * ratio;
    return { x: (cssW - w) / 2, y: (cssH - h) / 2, w, h };
  };

  /** Photo width in frame widths at scale 1, so the photo just covers the frame. */
  const coverWidth = () => (pixels ? Math.max(1, frameRatio() * (work.width / work.height)) : 1);

  /** Maps a point in frame-width units (frame centre is 0,0) to photo pixels. */
  const toPhoto = (u, v) => {
    const k = work.width / (coverWidth() * t.scale);
    return [(u - t.offsetX) * k + work.width / 2, (v - t.offsetY) * k + work.height / 2];
  };

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const f = frameRect();

    if (pixels) {
      const w = coverWidth() * t.scale * f.w;
      const h = (w * work.height) / work.width;
      const cx = f.x + f.w / 2 + t.offsetX * f.w;
      const cy = f.y + f.h / 2 + t.offsetY * f.w;
      ctx.drawImage(work, cx - w / 2, cy - h / 2, w, h);
      ctx.fillStyle = 'rgba(247, 243, 236, 0.75)';
      ctx.beginPath();
      ctx.rect(0, 0, cssW, cssH);
      ctx.rect(f.x, f.y, f.w, f.h);
      ctx.fill('evenodd');
    } else {
      ctx.fillStyle = '#6F6A78';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Upload a photo to start', cssW / 2, cssH / 2);
    }

    const { w: bw, h: bh } = frameSize(grid.columns, grid.rows);
    const sx = f.w / bw, sy = f.h / bh;
    ctx.strokeStyle = 'rgba(59, 76, 155, 0.35)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let c = 0; c < grid.columns; c++) {
      ctx.rect(f.x + c * sx, f.y + (c % 2) * 0.5 * sy, sx, grid.rows * sy);
    }
    ctx.stroke();
    ctx.strokeStyle = '#3B4C9B';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(f.x, f.y, f.w, f.h);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cssW = rect.width;
    cssH = rect.height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    draw();
  }
  new ResizeObserver(resize).observe(canvas);

  const changed = () => { draw(); onChange(); };

  async function useImage(src) {
    const img = await decode(src);
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    work.width = Math.max(1, Math.round(img.naturalWidth * k));
    work.height = Math.max(1, Math.round(img.naturalHeight * k));
    // Transparent areas read as black in ImageData; flatten onto white like the area outside the photo.
    workCtx.fillStyle = '#FFFFFF';
    workCtx.fillRect(0, 0, work.width, work.height);
    workCtx.drawImage(img, 0, 0, work.width, work.height);
    pixels = workCtx.getImageData(0, 0, work.width, work.height).data;
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!pixels) return;
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const fw = frameRect().w;
    t.offsetX += (e.clientX - drag.x) / fw;
    t.offsetY += (e.clientY - drag.y) / fw;
    drag = { x: e.clientX, y: e.clientY };
    changed();
  });
  const endDrag = () => { drag = null; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    if (!pixels) return;
    e.preventDefault();
    t.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * Math.exp(-e.deltaY * 0.001)));
    changed();
  }, { passive: false });

  return {
    /** Loads an uploaded file. */
    async loadFile(file) {
      if (!file || !file.type.startsWith('image/')) throw new Error('Choose an image file');
      const url = URL.createObjectURL(file);
      try { await useImage(url); } finally { URL.revokeObjectURL(url); }
      t = { offsetX: 0, offsetY: 0, scale: 1 };
      changed();
    },
    /** Restores a saved photo without resetting the transform. */
    async loadDataUrl(url) {
      await useImage(url);
      draw();
    },
    hasPhoto: () => pixels !== null,
    /** Sets the bead grid that shapes the crop frame. */
    setFrame(columns, rows, pitchX, pitchY) {
      grid = { columns, rows, pitchX, pitchY };
      draw();
    },
    getTransform: () => ({ ...t }),
    setTransform(next) {
      t = { ...t, ...next };
      t.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale));
      changed();
    },
    /** Centres the photo so it just covers the frame. */
    fit() {
      t = { offsetX: 0, offsetY: 0, scale: 1 };
      changed();
    },
    /** Moves the photo by whole beads. */
    nudge(dx, dy) {
      const { w, h } = frameSize(grid.columns, grid.rows);
      t.offsetX += dx / w;
      t.offsetY += (dy * frameRatio()) / h;
      changed();
    },
    /**
     * Lab colour per bead from up to 8 x 8 photo samples under the bead footprint.
     * mode 'average' blends them, 'majority' takes the most common colour, 'nearest' reads only the centre pixel.
     */
    sampleCells(cells, detail, mode = 'average') {
      if (!pixels) return null;
      const { w: bw, h: bh } = frameSize(grid.columns, grid.rows);
      const ratio = frameRatio();
      const W = work.width, H = work.height;
      // Off-photo samples read as white, like the area around the photo.
      const pixel = (px, py) => {
        if (px < 0 || py < 0 || px >= W || py >= H) return [255, 255, 255];
        const o = (py * W + px) * 4;
        return [pixels[o], pixels[o + 1], pixels[o + 2]];
      };
      return cells.map((cell) => {
        const fp = footprint(cell, detail);
        const [x0, y0] = toPhoto(fp.x / bw - 0.5, (fp.y / bh - 0.5) * ratio);
        const [x1, y1] = toPhoto((fp.x + fp.w) / bw - 0.5, ((fp.y + fp.h) / bh - 0.5) * ratio);
        if (mode === 'nearest') return rgbToLab(pixel(Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2)));
        const nx = Math.max(1, Math.min(8, Math.ceil(x1 - x0)));
        const ny = Math.max(1, Math.min(8, Math.ceil(y1 - y0)));
        const samples = [];
        for (let j = 0; j < ny; j++) {
          const py = Math.floor(y0 + ((j + 0.5) * (y1 - y0)) / ny);
          for (let i = 0; i < nx; i++) samples.push(pixel(Math.floor(x0 + ((i + 0.5) * (x1 - x0)) / nx), py));
        }
        if (mode === 'majority') return rgbToLab(dominantRgb(samples));
        const sum = samples.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]);
        return rgbToLab(sum.map((v) => v / samples.length));
      });
    },
    /** The working photo as a JPEG data URL (longest side 1600 px). */
    exportPhoto: () => (pixels ? work.toDataURL('image/jpeg', 0.85) : null),
  };
}
