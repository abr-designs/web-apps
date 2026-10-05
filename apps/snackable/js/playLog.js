// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

const HISTORY_KEY = "snackable.history";
const BROKEN_KEY = "snackable.broken";

/**
 * Remembers on this phone what was played and which games are marked broken. The only code that
 * touches localStorage; when storage throws (private window, blocked site data) it keeps working
 * in memory for the session.
 * @created Claude (claude-opus-5-5) — 2026-10-05
 */
export class PlayLog {
  #history = []; // [{ id, playedAt }] newest first
  #broken = new Set();
  #maxHistory;

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  constructor(maxHistory) {
    this.#maxHistory = maxHistory;
    const history = read(HISTORY_KEY);
    if (Array.isArray(history)) this.#history = history.filter((row) => typeof row?.id === "string");
    const broken = read(BROKEN_KEY);
    if (Array.isArray(broken)) this.#broken = new Set(broken.filter((id) => typeof id === "string"));
  }

  /** Moves the game to the top of the history. @created Claude (claude-opus-5-5) — 2026-10-05 */
  record(entry) {
    const older = this.#history.filter((row) => row.id !== entry.id);
    this.#history = [{ id: entry.id, playedAt: Date.now() }, ...older].slice(0, this.#maxHistory);
    write(HISTORY_KEY, this.#history);
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  recent() {
    return [...this.#history];
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  isBroken(id) {
    return this.#broken.has(id);
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  setBroken(id, isBroken) {
    if (isBroken) this.#broken.add(id);
    else this.#broken.delete(id);
    write(BROKEN_KEY, [...this.#broken]);
  }

  /** Sorted, for "Copy broken list". @created Claude (claude-opus-5-5) — 2026-10-05 */
  brokenIds() {
    return [...this.#broken].sort();
  }
}

/** null when the key is missing, unreadable or not JSON. @created Claude (claude-opus-5-5) — 2026-10-05 */
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked; the in-memory copy still serves this session
  }
}
