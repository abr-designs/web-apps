// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
// Peyote grid geometry. Units are bead units unless a name says cm or mm.

export const DEFAULTS = Object.freeze({
  widthCm: 5,
  heightCm: 16.5,
  columns: 36,
  rows: 94,
  pitchXmm: 50 / 36,
  pitchYmm: 165 / 94,
});

const LIMITS = { columns: [2, 200], rows: [2, 400] };

/** Clamps a count to its range, falling back to the default when not a finite number. */
function clampOne(value, key) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULTS[key];
  const [min, max] = LIMITS[key];
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Returns integer column and row counts inside the supported range. */
export function clampCounts({ columns, rows }) {
  return { columns: clampOne(columns, 'columns'), rows: clampOne(rows, 'rows') };
}

/** Converts a piece size in cm to bead counts using the bead pitch in mm. */
export function countsFromSize(widthCm, heightCm, pitchXmm, pitchYmm) {
  return clampCounts({
    columns: (widthCm * 10) / pitchXmm,
    rows: (heightCm * 10) / pitchYmm,
  });
}

/** Converts bead counts to the beaded size in cm. */
export function sizeFromCounts(columns, rows, pitchXmm, pitchYmm) {
  return { widthCm: (columns * pitchXmm) / 10, heightCm: (rows * pitchYmm) / 10 };
}

/** Returns 'even' or 'odd' for a column count. */
export function parityOf(columns) {
  return columns % 2 === 0 ? 'even' : 'odd';
}

/** Adds one column when the count does not match the requested parity. */
export function applyParity(columns, parity) {
  return parityOf(columns) === parity ? columns : columns + 1;
}

/** Size of the whole chart in bead units, including the half-bead drop of odd columns. */
export function frameSize(columns, rows) {
  return { w: columns, h: rows + 0.5 };
}

/** Bead centres in row-major order; odd columns sit half a bead lower. */
export function beadCells(columns, rows) {
  const cells = new Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      cells[row * columns + col] = { col, row, x: col + 0.5, y: row + 0.5 + (col % 2) * 0.5 };
    }
  }
  return cells;
}

/** Sampling rect centred on a bead: full bead at detail 0, 30% of its side at detail 100. */
export function footprint(cell, detail) {
  const s = 1 - (0.7 * detail) / 100;
  return { x: cell.x - s / 2, y: cell.y - s / 2, w: s, h: s };
}
