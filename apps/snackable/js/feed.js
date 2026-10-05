// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

/**
 * Tracks the current index and coordinates catalog, slot pool and strip.
 * The slot at pool position p holds catalog index (index + p - 1).
 * @created Claude (claude-opus-5-5) — 2026-10-05
 */
export class FeedController {
  #catalog;
  #pool;
  #strip;
  #config;
  #index = 0;
  #busy = false;

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  constructor(catalog, pool, strip, config) {
    this.#catalog = catalog;
    this.#pool = pool;
    this.#strip = strip;
    this.#config = config;
  }

  /** prev stays empty at index 0. @created Claude (claude-opus-5-5) — 2026-10-05 */
  start() {
    this.#pool.slots.forEach((slot, p) => {
      if (p > 0) slot.load(this.#catalog.get(p - 1), this.#config.preloadMode);
    });
    this.#pool.current.activate();
    this.#updateStrip();
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  next() {
    if (this.#busy || this.#catalog.size === 0) return;
    this.#lock();
    this.#index++;
    this.#pool.current.deactivate();
    const recycled = this.#pool.rotateForward();
    this.#pool.current.activate();
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
    this.#pool.current.deactivate();
    const recycled = this.#pool.rotateBack();
    this.#pool.current.activate();
    if (this.#index > 0) recycled.load(this.#catalog.get(this.#index - 1), this.#config.preloadMode);
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
    this.#strip.nowLink.href = now?.itchPageUrl ?? "#";
    this.#strip.nowAuthor.textContent = now ? `by ${now.author} · itch.io` : "";
    this.#strip.nextTitle.textContent = next?.title ?? (this.#catalog.size === 0 ? "None fit this orientation" : "");
  }
}
