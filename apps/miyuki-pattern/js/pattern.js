// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
// Turns colour assignments into a lettered pattern with totals and per-row quantities.

/** 0 → 'A' ... 25 → 'Z'. */
export function letterFor(i) {
  return String.fromCharCode(65 + i);
}

const round = (v, places) => Math.round(v * 10 ** places) / 10 ** places;

/** Builds the legend (sorted by count), remapped cells, totals, and per-row counts. */
export function buildPattern({ columns, rows, assignments, colors, pack }) {
  const counts = new Array(colors.length).fill(0);
  for (const a of assignments) counts[a]++;

  const order = colors.map((_, i) => i).filter((i) => counts[i] > 0).sort((a, b) => counts[b] - counts[a]);
  const toLegend = new Int32Array(colors.length).fill(-1);
  order.forEach((colorIndex, legendIndex) => { toLegend[colorIndex] = legendIndex; });

  const legend = order.map((colorIndex, legendIndex) => {
    const count = counts[colorIndex];
    const packs = Math.ceil(count / pack.beads);
    const { code, name, hex, lab } = colors[colorIndex];
    return {
      letter: letterFor(legendIndex),
      code, name, hex, lab, count,
      grams: round((count / pack.beads) * pack.grams, 1),
      packs,
      cost: round(packs * pack.price, 2),
    };
  });

  const cells = new Uint8Array(assignments.length);
  for (let i = 0; i < assignments.length; i++) cells[i] = toLegend[assignments[i]];

  const rowCounts = [];
  for (let row = 0; row < rows; row++) {
    const tally = new Array(legend.length).fill(0);
    for (let col = 0; col < columns; col++) tally[cells[row * columns + col]]++;
    rowCounts.push({
      row: row + 1,
      direction: row % 2 === 0 ? '→' : '←',
      counts: tally.flatMap((count, i) => (count ? [{ letter: legend[i].letter, count }] : [])),
    });
  }

  const totals = legend.reduce(
    (t, e) => ({ count: t.count + e.count, grams: t.grams + e.grams, packs: t.packs + e.packs, cost: t.cost + e.cost }),
    { count: 0, grams: 0, packs: 0, cost: 0 },
  );
  totals.grams = round(totals.grams, 1);
  totals.cost = round(totals.cost, 2);

  return { columns, rows, cells, legend, totals, rowCounts };
}
