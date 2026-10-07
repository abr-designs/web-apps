// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

import { SOURCE_LABEL } from "./catalog.js";

/**
 * Tracks the current index and coordinates catalog, slot pool, play log and strip.
 * The slot at pool position p holds catalog index (index + p - 1).
 * Only the current slot runs a game: a game leaving the screen is parked.
 * @created Claude (claude-opus-5-5) — 2026-10-05
 */
export class FeedController {
  #catalog;
  #pool;
  #strip;
  #config;
  #playLog;
  #index = 0;
  #busy = false;

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  constructor(catalog, pool, strip, config, playLog) {
    this.#catalog = catalog;
    this.#pool = pool;
    this.#strip = strip;
    this.#config = config;
    this.#playLog = playLog;
  }

  /** prev stays empty at index 0. @created Claude (claude-opus-5-5) — 2026-10-05 */
  start() {
    this.#pool.slots.forEach((slot, p) => {
      if (p > 0) slot.load(this.#catalog.get(p - 1), this.#config.preloadMode);
    });
    this.#pool.current.activate();
    this.#playLog.record(this.#pool.current.entry);
    this.#updateStrip();
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  next() {
    if (this.#busy || this.#catalog.size === 0) return;
    this.#lock();
    this.#index++;
    this.#pool.current.park();
    const recycled = this.#pool.rotateForward();
    this.#pool.current.activate();
    this.#playLog.record(this.#pool.current.entry);
    recycled.load(this.#catalog.get(this.#index + this.#pool.slots.length - 2), this.#config.preloadMode);
    this.#updateStrip();
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  prev() {
    if (this.#busy || this.#catalog.size === 0) return;
    this.#lock();
    if (!this.#pool.prev.entry) {
      this.#pool.current.el.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(48px)" }, { transform: "translateY(0)" }],
        { duration: this.#config.transitionMs, easing: "ease-out" },
      );
      return;
    }
    this.#index--;
    this.#pool.current.park();
    const recycled = this.#pool.rotateBack();
    this.#pool.current.activate();
    this.#playLog.record(this.#pool.current.entry);
    // "light" leaves the new prev slot Parked (cover only) so no hidden game runs behind the current one.
    if (this.#index > 0) recycled.load(this.#catalog.get(this.#index - 1), "light");
    this.#updateStrip();
  }

  /**
   * After the catalog is refiltered for a new orientation: the current and previous games keep
   * running, the index is re-anchored to the current game's position in the new list, and ahead
   * slots are reloaded wherever they differ from what follows it.
   * @created Claude (claude-opus-5-5) — 2026-10-05
   */
  refreshAhead() {
    const position = this.#catalog.indexOf(this.#pool.current.entry);
    if (position >= 0) this.#index = position;
    this.#pool.ahead.forEach((slot, k) => {
      const wanted = this.#catalog.get(this.#index + k + 1);
      if (slot.entry !== wanted) slot.load(wanted, this.#config.preloadMode);
    });
    this.#updateStrip();
  }

  /**
   * Plays a game picked from History in the current slot. Only called with an entry that is in the
   * filtered list, so the index can re-anchor to it. The previous slot is left as it was.
   * @created Claude (claude-opus-5-5) — 2026-10-05
   */
  jumpTo(entry) {
    if (this.#busy) return;
    this.#pool.current.load(entry, "live");
    this.#pool.current.activate();
    this.#playLog.record(entry);
    this.refreshAhead();
  }

  /**
   * Marks the current game broken and moves on. Returns its id for the Undo toast, or null when
   * nothing happened. If it was the last game that fits, it stays on screen.
   * @created Claude (claude-opus-5-5) — 2026-10-05
   */
  markCurrentBroken() {
    const entry = this.#pool.current.entry;
    if (this.#busy || !entry) return null;
    this.#playLog.setBroken(entry.id, true);
    this.#catalog.refilter();
    this.next();
    this.refreshAhead();
    return entry.id;
  }

  /** Used by Undo and History's flag toggle; a game marked here keeps playing if it is current. @created Claude (claude-opus-5-5) — 2026-10-05 */
  setBroken(id, isBroken) {
    this.#playLog.setBroken(id, isBroken);
    this.#catalog.refilter();
    this.refreshAhead();
  }

  /**
   * Stops the current game while the page is hidden, since a cross-origin game cannot be muted.
   * The preloaded next game is left running.
   * @created Claude (claude-opus-5-5) — 2026-10-07
   */
  suspend() {
    this.#pool.current.park();
  }

  /** Restarts the current game when the page is shown again. @created Claude (claude-opus-5-5) — 2026-10-07 */
  resume() {
    this.#pool.current.activate();
  }

  /** Ignores input until the slide animation ends. @created Claude (claude-opus-5-5) — 2026-10-05 */
  #lock() {
    this.#busy = true;
    setTimeout(() => (this.#busy = false), this.#config.transitionMs);
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  #updateStrip() {
    const now = this.#pool.current.entry;
    const next = this.#pool.ahead[0]?.entry;
    this.#strip.nowLink.textContent = now?.title ?? "";
    this.#strip.nowLink.href = now?.pageUrl ?? "#";
    this.#strip.nowAuthor.textContent = now ? `by ${now.author} · ${SOURCE_LABEL[now.source]}` : "";
    this.#strip.nextTitle.textContent = next?.title ?? (this.#catalog.size === 0 ? "None fit this orientation" : "");
  }
}
