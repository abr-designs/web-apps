// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

const HISTORY_KEY = "snackable.history";
const BROKEN_KEY = "snackable.broken";
const LIKES_KEY = "snackable.likes";
const ORIENTATIONS = ["portrait", "landscape"];

/**
 * Remembers on this phone what was played, which games are marked broken and which are liked.
 * The only code that touches localStorage; when storage throws (private window, blocked site data)
 * it keeps working in memory for the session.
 * @created Claude (claude-opus-5-5) — 2026-10-05
 */
export class PlayLog {
  #history = []; // [{ id, playedAt }] newest first
  #broken = { portrait: new Set(), landscape: new Set() }; // ids per orientation
  #likes = new Set();
  #maxHistory;

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  constructor(maxHistory) {
    this.#maxHistory = maxHistory;
    const history = read(HISTORY_KEY);
    if (Array.isArray(history)) this.#history = history.filter((row) => typeof row?.id === "string");
    const broken = read(BROKEN_KEY);
    if (Array.isArray(broken)) {
      for (const mark of broken) {
        // Marks saved before reports were per orientation are plain ids and hide the game in both.
        if (typeof mark === "string") ORIENTATIONS.forEach((o) => this.#broken[o].add(mark));
        else if (typeof mark?.id === "string" && ORIENTATIONS.includes(mark.orientation)) this.#broken[mark.orientation].add(mark.id);
      }
    }
    const likes = read(LIKES_KEY);
    if (Array.isArray(likes)) this.#likes = new Set(likes.filter((id) => typeof id === "string"));
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

  /** True when the player marked this game broken in that orientation ("portrait" | "landscape"). @created Claude (claude-opus-5-5) — 2026-10-05 */
  isBroken(id, orientation) {
    return this.#broken[orientation].has(id);
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  setBroken(id, orientation, isBroken) {
    if (isBroken) this.#broken[orientation].add(id);
    else this.#broken[orientation].delete(id);
    write(BROKEN_KEY, this.brokenMarks());
  }

  /** [{ id, orientation }] sorted by id, for SharedStore.sync(). @created Claude (claude-opus-5-5) — 2026-10-07 */
  brokenMarks() {
    return ORIENTATIONS.flatMap((orientation) => [...this.#broken[orientation]].map((id) => ({ id, orientation })))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-07 */
  isLiked(id) {
    return this.#likes.has(id);
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-07 */
  setLiked(id, isLiked) {
    if (isLiked) this.#likes.add(id);
    else this.#likes.delete(id);
    write(LIKES_KEY, this.likedIds());
  }

  /** Sorted, for SharedStore.sync() and the Favorites list. @created Claude (claude-opus-5-5) — 2026-10-07 */
  likedIds() {
    return [...this.#likes].sort();
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
