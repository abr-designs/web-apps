// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

const STATUS_TEXT = {
  Loading: "Loading…",
  Failed: "Couldn't load. Swipe to skip.",
};

/** One game iframe plus its cover and status. States: Empty, Loading, Ready, Playing, Failed. @created Claude (claude-opus-5-5) — 2026-10-05 */
export class GameSlot {
  entry = null;
  state = "Empty";
  el;
  #frame;
  #cover;
  #status;
  #prefetch = null;
  #timeoutId = 0;
  #started = false;
  #isCurrent = false;
  #loadTimeoutMs;

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  constructor(parent, loadTimeoutMs) {
    this.#loadTimeoutMs = loadTimeoutMs;
    this.el = document.createElement("section");
    this.el.className = "slot";
    this.#frame = document.createElement("iframe");
    this.#frame.className = "slot__frame";
    this.#frame.allow = "autoplay; fullscreen; gamepad; accelerometer; gyroscope";
    this.#frame.setAttribute("scrolling", "no");
    this.#frame.addEventListener("load", () => this.#onFrameLoad());
    this.#cover = document.createElement("img");
    this.#cover.className = "slot__cover";
    this.#cover.alt = "";
    this.#cover.hidden = true;
    this.#status = document.createElement("div");
    this.#status.className = "slot__status";
    this.el.append(this.#frame, this.#cover, this.#status);
    parent.append(this.el);
    this.setState("Empty");
  }

  /**
   * live: starts the game now (it runs hidden until activated).
   * light: shows the cover and prefetches the embed page; the game starts on activate().
   * @created Claude (claude-opus-5-5) — 2026-10-05
   */
  load(entry, mode) {
    this.clear();
    if (!entry) return;
    this.entry = entry;
    this.el.setAttribute("aria-label", entry.title);
    if (entry.coverImage) {
      this.#cover.src = entry.coverImage;
      this.#cover.hidden = false;
    }
    if (mode === "live") {
      this.#start();
    } else {
      this.#prefetch = Object.assign(document.createElement("link"), { rel: "prefetch", href: entry.embedUrl });
      document.head.append(this.#prefetch);
    }
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  activate() {
    this.#isCurrent = true;
    if (this.entry && !this.#started) this.#start();
    else if (this.state === "Ready") this.setState("Playing");
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  deactivate() {
    this.#isCurrent = false;
    if (this.state === "Playing") this.setState("Ready");
  }

  /** Stops the game and frees the iframe. @created Claude (claude-opus-5-5) — 2026-10-05 */
  clear() {
    clearTimeout(this.#timeoutId);
    if (this.#started) this.#frame.src = "about:blank";
    this.#prefetch?.remove();
    this.#prefetch = null;
    this.#started = false;
    this.#isCurrent = false;
    this.entry = null;
    this.#cover.hidden = true;
    this.#cover.removeAttribute("src");
    this.el.removeAttribute("aria-label");
    this.setState("Empty");
  }

  /** Moves the slot to a screen offset (-1 above, 0 visible, 1+ below). @created Claude (claude-opus-5-5) — 2026-10-05 */
  setOffset(offset, instant = false) {
    this.el.classList.toggle("slot--instant", instant);
    this.el.style.transform = `translateY(${offset * 100}%)`;
    this.el.inert = offset !== 0;
    if (instant) {
      void this.el.offsetHeight; // apply the jump before re-enabling transitions
      this.el.classList.remove("slot--instant");
    }
  }

  /** The only place state changes; drives the cover and status UI. @created Claude (claude-opus-5-5) — 2026-10-05 */
  setState(state) {
    this.state = state;
    this.el.dataset.state = state;
    this.#status.textContent = STATUS_TEXT[state] ?? "";
    if (state === "Ready" || state === "Playing") this.#cover.hidden = true;
    if (this.entry) console.debug(`[slot] ${this.entry.title}: ${state}`);
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  #start() {
    this.#started = true;
    this.setState("Loading");
    this.#timeoutId = setTimeout(() => {
      if (this.state === "Loading") this.setState("Failed");
    }, this.#loadTimeoutMs);
    this.#frame.src = this.entry.embedUrl;
  }

  /**
   * about:blank is same-origin and readable; a loaded itch.io page is cross-origin and throws.
   * This also catches a late load event from the about:blank set by clear().
   * @created Claude (claude-opus-5-5) — 2026-10-05
   */
  #isBlank() {
    try {
      return this.#frame.contentWindow.location.href === "about:blank";
    } catch {
      return false;
    }
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  #onFrameLoad() {
    if (!this.#started || this.#isBlank()) return;
    clearTimeout(this.#timeoutId);
    this.setState(this.#isCurrent ? "Playing" : "Ready");
  }
}

/** Fixed set of slots, ordered [prev, current, ...ahead], recycled for the life of the page. @created Claude (claude-opus-5-5) — 2026-10-05 */
export class SlotPool {
  slots;

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  constructor(parent, count, loadTimeoutMs) {
    this.slots = Array.from({ length: count }, () => new GameSlot(parent, loadTimeoutMs));
    this.#layout();
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  get prev() {
    return this.slots[0];
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  get current() {
    return this.slots[1];
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  get ahead() {
    return this.slots.slice(2);
  }

  /** prev is cleared and becomes the last ahead slot. @created Claude (claude-opus-5-5) — 2026-10-05 */
  rotateForward() {
    const recycled = this.slots.shift();
    recycled.clear();
    this.slots.push(recycled);
    this.#layout(recycled);
    return recycled;
  }

  /** Last ahead slot is cleared and becomes prev. @created Claude (claude-opus-5-5) — 2026-10-05 */
  rotateBack() {
    const recycled = this.slots.pop();
    recycled.clear();
    this.slots.unshift(recycled);
    this.#layout(recycled);
    return recycled;
  }

  /** The recycled slot jumps without animating so it never crosses the screen. @created Claude (claude-opus-5-5) — 2026-10-05 */
  #layout(instantSlot = null) {
    this.slots.forEach((slot, i) => slot.setOffset(i - 1, slot === instantSlot));
  }
}
