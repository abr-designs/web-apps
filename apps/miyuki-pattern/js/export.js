// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
// Draws the lettered pattern to a canvas, saves it as PNG, and fills the print page.

import { textColorFor } from './color.js';

export const COLOR_NOTE = 'Screen colours are approximate, especially for metallic, galvanized, AB and lined finishes. Colour data: craft-color-codes by MakeBead (makebead.com), CC BY 4.0.';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const LEGEND_ROW = 22;

/** Formats a CAD amount. */
export const money = (v) => `$${v.toFixed(2)}`;

/**
 * Draws the pattern. cellPx is the bead width; aspect is bead height over width.
 * Returns the drawn size in CSS pixels.
 */
export function renderPattern(canvas, pattern, { cellPx, aspect, letters, numbers, legend, scale = 1 }) {
  const { columns, rows, cells } = pattern;
  const cw = cellPx, ch = cellPx * aspect;
  const left = numbers ? Math.max(28, cw * 1.4) : 0;
  const top = numbers ? Math.max(18, cw * 0.9) : 0;
  const gridW = columns * cw;
  const gridH = (rows + 0.5) * ch;
  const legendH = legend ? 24 + pattern.legend.length * LEGEND_ROW : 0;
  const width = Math.ceil(left + gridW + (numbers ? 8 : 0));
  const height = Math.ceil(top + gridH + legendH + (numbers ? 8 : 0));

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const inset = Math.min(1, cw * 0.06);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${Math.round(Math.min(cw, ch) * 0.55)}px ${FONT}`;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const entry = pattern.legend[cells[row * columns + col]];
      const x = left + col * cw;
      const y = top + (row + (col % 2) * 0.5) * ch;
      ctx.fillStyle = entry.hex;
      ctx.fillRect(x + inset, y + inset, cw - inset * 2, ch - inset * 2);
      if (letters) {
        ctx.fillStyle = textColorFor(entry.lab);
        ctx.fillText(entry.letter, x + cw / 2, y + ch / 2 + 0.5);
      }
    }
  }

  if (numbers) {
    ctx.fillStyle = '#6F6A78';
    ctx.font = `${Math.round(Math.max(9, Math.min(12, cw * 0.45)))}px ${FONT}`;
    ctx.textAlign = 'right';
    for (let row = 0; row < rows; row++) ctx.fillText(String(row + 1), left - 6, top + (row + 0.5) * ch);
    ctx.textAlign = 'center';
    for (let col = 0; col < columns; col++) {
      if (cw >= 14 || (col + 1) % 5 === 0 || col === 0) ctx.fillText(String(col + 1), left + (col + 0.5) * cw, top / 2);
    }
  }

  if (legend) {
    let y = top + gridH + 24;
    ctx.textAlign = 'left';
    ctx.font = `13px ${FONT}`;
    for (const e of pattern.legend) {
      ctx.fillStyle = e.hex;
      ctx.fillRect(left, y - 8, 22, 16);
      ctx.fillStyle = textColorFor(e.lab);
      ctx.textAlign = 'center';
      ctx.fillText(e.letter, left + 11, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#2B2A33';
      ctx.fillText(`${e.code}  ${e.name}  ${e.count} beads`, left + 30, y);
      y += LEGEND_ROW;
    }
  }
  return { width, height };
}

const MAX_CANVAS_PIXELS = 16e6;

/** Bead width for exports: 24 px, smaller for big grids so the canvas stays under the iOS area limit. */
export function exportCellPx(columns, rows, aspect) {
  const fit = Math.sqrt(MAX_CANVAS_PIXELS / (columns * (rows + 0.5) * aspect)) * 0.9;
  return Math.max(8, Math.min(24, Math.floor(fit)));
}

/** Renders the full-size PNG with letters, numbers, and legend, and downloads it. onError gets a message on failure. */
export function downloadPng(pattern, aspect, onError) {
  const canvas = document.createElement('canvas');
  const cellPx = exportCellPx(pattern.columns, pattern.rows, aspect);
  renderPattern(canvas, pattern, { cellPx, aspect, letters: true, numbers: true, legend: true });
  canvas.toBlob((blob) => {
    if (!blob) { onError('This pattern is too large to export on this device. Try fewer rows or columns.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `miyuki-pattern-${pattern.columns}x${pattern.rows}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

/** Legend table markup shared by the screen and the print page. */
export function legendTable(pattern) {
  const rows = pattern.legend.map((e) => `
    <tr>
      <td>${e.letter}</td>
      <td><span class="swatch" style="background:${e.hex}"></span></td>
      <td>${e.code}</td>
      <td>${e.name}</td>
      <td class="num">${e.count}</td>
      <td class="num">${e.grams.toFixed(1)}</td>
      <td class="num">${e.packs}</td>
      <td class="num">${money(e.cost)}</td>
    </tr>`).join('');
  const t = pattern.totals;
  return `
    <table class="legend-table">
      <thead><tr><th>Letter</th><th></th><th>Code</th><th>Name</th><th class="num">Beads</th><th class="num">Grams</th><th class="num">Packs</th><th class="num">Cost</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="num">${t.count}</td><td class="num">${t.grams.toFixed(1)}</td><td class="num">${t.packs}</td><td class="num">${money(t.cost)}</td></tr></tfoot>
    </table>`;
}

/** One word-chart line per row, e.g. 'Row 3 (←): A 12, C 9, B 15'. */
export function rowLine({ row, direction, counts }) {
  return `Row ${row} (${direction}): ${counts.map((c) => `${c.letter} ${c.count}`).join(', ')}`;
}

/** Fills the print section: diagram, legend, colour note, then per-row quantities. */
export function fillPrintPage(section, pattern, aspect) {
  const canvas = document.createElement('canvas');
  const cellPx = exportCellPx(pattern.columns, pattern.rows, aspect);
  renderPattern(canvas, pattern, { cellPx, aspect, letters: true, numbers: true, legend: false });
  section.innerHTML = `
    <h2>Miyuki Delica 11/0 peyote pattern, ${pattern.columns} × ${pattern.rows}</h2>
    <img src="${canvas.toDataURL('image/png')}" alt="Lettered bead pattern">
    ${legendTable(pattern)}
    <p>${COLOR_NOTE}</p>
    <div class="print-rows">
      <h2>Beads per row</h2>
      ${pattern.rowCounts.map((r) => `<p>${rowLine(r)}</p>`).join('')}
    </div>`;
}
