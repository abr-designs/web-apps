// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

/**
 * Loads the game list, shuffles it once, and serves it filtered to the device orientation.
 * Call setOrientation() after load() to fill the filtered list.
 * @created Claude (claude-opus-5-5) — 2026-10-05
 */
export class GameCatalog {
  #all = [];
  #games = [];
  #isPortrait = true;
  #squareTolerance;

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  constructor(squareTolerance) {
    this.#squareTolerance = squareTolerance;
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    this.#all = shuffle(await res.json());
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  setOrientation(isPortrait) {
    this.#isPortrait = isPortrait;
    this.#games = this.#all.filter((g) => this.fits(g));
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  fits(game) {
    if (!game.width || !game.height) return true;
    const ratio = game.width / game.height;
    if (ratio < this.#squareTolerance && ratio > 1 / this.#squareTolerance) return true;
    return this.#isPortrait ? ratio < 1 : ratio > 1;
  }

  /** Wraps in both directions so the feed loops. @created Claude (claude-opus-5-5) — 2026-10-05 */
  get(index) {
    const n = this.#games.length;
    return n === 0 ? null : this.#games[((index % n) + n) % n];
  }

  /** -1 when the entry is not in the filtered list. @created Claude (claude-opus-5-5) — 2026-10-05 */
  indexOf(entry) {
    return this.#games.indexOf(entry);
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  get size() {
    return this.#games.length;
  }
}

/** Fisher-Yates shuffle, returns a new array. @created Claude (claude-opus-5-5) — 2026-10-05 */
function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
