// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

/** Shown next to the author and on source links. */
export const SOURCE_LABEL = { itch: "itch.io", pico8: "Lexaloffle" };

/**
 * Loads the game list, shuffles it once, and serves it filtered to the device orientation,
 * minus games marked broken. Call setOrientation() after load() to fill the filtered list.
 * @created Claude (claude-opus-5-5) — 2026-10-05
 */
export class GameCatalog {
  #all = [];
  #games = [];
  #isPortrait = true;
  #squareTolerance;
  #playLog;
  #stats = new Map();
  #reportHideCount;

  /**
   * reportHideCount: reports in one orientation that hide a game there for everyone unless its status is "keep".
   * @created Claude (claude-opus-5-5) — 2026-10-05
   */
  constructor(squareTolerance, playLog, reportHideCount) {
    this.#squareTolerance = squareTolerance;
    this.#playLog = playLog;
    this.#reportHideCount = reportHideCount;
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    this.#all = shuffle(await res.json());
  }

  /**
   * Swaps in the shared list. Order and entry objects are kept through lastLoaded (the last entry
   * already in a slot; null keeps nothing), so preloaded slots and indexOf() still match. Everything
   * after it is weighted-shuffled by likes. Games no longer listed drop out.
   * @created Claude (claude-opus-5-5) — 2026-10-07
   */
  merge(games, stats, lastLoaded) {
    this.#stats = stats;
    const listed = new Map(games.map((g) => [g.id, g]));
    const keepCount = lastLoaded ? this.#all.indexOf(lastLoaded) + 1 : 0;
    // Kept entries take the shared fields (status included) but stay the same objects.
    const kept = this.#all.slice(0, keepCount).filter((g) => listed.has(g.id));
    kept.forEach((g) => Object.assign(g, listed.get(g.id)));
    const keptIds = new Set(kept.map((g) => g.id));
    const rest = games.filter((g) => !keptIds.has(g.id));
    this.#all = [...kept, ...weightedShuffle(rest, (g) => 1 + this.stats(g.id).likes)];
    this.refilter();
  }

  /** { reportsPortrait, reportsLandscape, likes }; zeros for an unknown id. @created Claude (claude-opus-5-5) — 2026-10-07 */
  stats(id) {
    return this.#stats.get(id) ?? { reportsPortrait: 0, reportsLandscape: 0, likes: 0 };
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  setOrientation(isPortrait) {
    this.#isPortrait = isPortrait;
    this.refilter();
  }

  /** "portrait" | "landscape", from the last setOrientation(). @created Claude (claude-opus-5-5) — 2026-10-07 */
  get orientation() {
    return this.#isPortrait ? "portrait" : "landscape";
  }

  /** Rebuilds the filtered list after a broken mark changes. @created Claude (claude-opus-5-5) — 2026-10-05 */
  refilter() {
    this.#games = this.#all.filter((g) => this.fits(g) && !this.isHidden(g));
  }

  /**
   * True when the game is out of the feed in the current orientation: status "hidden", shared reports
   * at the threshold (unless status "keep"), or the player's own broken mark.
   * @created Claude (claude-opus-5-5) — 2026-10-07
   */
  isHidden(game) {
    if (game.status === "hidden" || this.#playLog.isBroken(game.id, this.orientation)) return true;
    const stats = this.stats(game.id);
    const reports = this.#isPortrait ? stats.reportsPortrait : stats.reportsLandscape;
    return reports >= this.#reportHideCount && game.status !== "keep";
  }

  /** Any entry by id, filtered or not; null when games.json no longer has it. @created Claude (claude-opus-5-5) — 2026-10-05 */
  find(id) {
    return this.#all.find((g) => g.id === id) ?? null;
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

/**
 * Each item gets the key random ** (1 / weight), highest first: heavier items tend to come earlier,
 * every item appears once, and equal weights give a plain shuffle. Returns a new array.
 * @created Claude (claude-opus-5-5) — 2026-10-07
 */
function weightedShuffle(items, weightOf) {
  return items
    .map((item) => ({ item, key: Math.random() ** (1 / weightOf(item)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}
