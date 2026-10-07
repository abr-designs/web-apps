// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

import { SOURCE_LABEL } from "./catalog.js";

const COPY_FEEDBACK_MS = 2000;

/**
 * Full-screen list of recently played games over the feed. Tap a row to play it again; rows that
 * do not fit the orientation or are marked broken are greyed out. The Android back gesture closes it.
 * @created Claude (claude-opus-5-5) — 2026-10-05
 */
export class HistorySheet {
  #el;
  #list;
  #copyButton;
  #playLog;
  #catalog;
  #onPick;
  #onToggleBroken;
  #viewButtons;
  #view = "all"; // "all" | "favorites"

  /**
   * onPick(entry) plays a game; onToggleBroken(id, isBroken) changes a mark.
   * @created Claude (claude-opus-5-5) — 2026-10-05
   */
  constructor(el, playLog, catalog, { onPick, onToggleBroken }) {
    this.#el = el;
    this.#list = el.querySelector("#history-list");
    this.#copyButton = el.querySelector("#history-copy");
    this.#playLog = playLog;
    this.#catalog = catalog;
    this.#onPick = onPick;
    this.#onToggleBroken = onToggleBroken;
    el.querySelector("#history-close").addEventListener("click", () => this.close());
    this.#copyButton.addEventListener("click", () => this.#copyBroken());
    this.#viewButtons = [...el.querySelectorAll(".history__view")];
    this.#viewButtons.forEach((button) =>
      button.addEventListener("click", () => {
        this.#view = button.dataset.view;
        this.#viewButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        this.render();
      }),
    );
    // open() pushes a history entry, so back (button or gesture) lands here.
    window.addEventListener("popstate", () => (this.#el.hidden = true));
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  get isOpen() {
    return !this.#el.hidden;
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  open() {
    if (this.isOpen) return;
    this.render();
    this.#el.hidden = false;
    history.pushState({ historySheet: true }, "");
  }

  /** Goes back so the entry open() pushed is used up; popstate hides the sheet. @created Claude (claude-opus-5-5) — 2026-10-05 */
  close() {
    if (this.isOpen) history.back();
  }

  /**
   * All: rows from the play log. Favorites: every liked game by title, beyond the play log.
   * Ids the catalog no longer has are skipped.
   * @created Claude (claude-opus-5-5) — 2026-10-05
   */
  render() {
    const now = Date.now();
    const recent = this.#playLog.recent();
    const isFavorites = this.#view === "favorites";
    const source = isFavorites
      ? this.#playLog.likedIds().map((id) => ({ id, playedAt: recent.find((row) => row.id === id)?.playedAt ?? null }))
      : recent;
    const found = source.map((row) => ({ entry: this.#catalog.find(row.id), playedAt: row.playedAt })).filter((row) => row.entry);
    if (isFavorites) found.sort((a, b) => a.entry.title.localeCompare(b.entry.title));
    const rows = found.map(({ entry, playedAt }) => this.#renderRow(entry, playedAt === null ? null : now - playedAt));
    if (rows.length === 0) {
      const empty = document.createElement("li");
      empty.className = "history__empty";
      empty.textContent = isFavorites ? "No favorites yet. Tap ♥ on a game you like." : "Nothing played yet.";
      rows.push(empty);
    }
    this.#list.replaceChildren(...rows);
  }

  /** @created Claude (claude-opus-5-5) — 2026-10-05 */
  #renderRow(entry, ageMs) {
    // Mark and flag are for the current orientation; the sheet re-renders on rotation.
    const isBroken = this.#playLog.isBroken(entry.id, this.#catalog.orientation);
    const canPlay = !isBroken && this.#catalog.indexOf(entry) >= 0;
    const likes = this.#catalog.stats(entry.id).likes;
    const unplayable = isBroken ? " · broken" : !this.#catalog.fits(entry) ? " · other orientation" : " · reported broken";

    const row = document.createElement("li");
    row.className = "history__row";

    const play = document.createElement("button");
    play.type = "button";
    play.className = "history__play";
    play.disabled = !canPlay;
    play.addEventListener("click", () => {
      this.#onPick(entry);
      this.close();
    });
    const cover = Object.assign(document.createElement("img"), { className: "history__cover", alt: "", loading: "lazy" });
    if (entry.coverImage) cover.src = entry.coverImage;
    const text = document.createElement("span");
    text.className = "history__text";
    const title = Object.assign(document.createElement("span"), { className: "history__title", textContent: entry.title });
    const sub = Object.assign(document.createElement("span"), {
      className: "history__sub",
      textContent: [
        entry.author,
        ageMs === null ? null : timeAgo(ageMs),
        likes > 0 ? `♥ ${likes}` : null,
      ].filter(Boolean).join(" · ") + (canPlay ? "" : unplayable),
    });
    text.append(title, sub);
    play.append(cover, text);

    const flag = document.createElement("button");
    flag.type = "button";
    flag.className = "strip__button history__flag";
    flag.textContent = "⚑";
    flag.setAttribute("aria-pressed", String(isBroken));
    flag.setAttribute("aria-label", isBroken ? `Unmark ${entry.title} as broken` : `Mark ${entry.title} as broken`);
    flag.addEventListener("click", () => {
      this.#onToggleBroken(entry.id, !isBroken);
      this.render();
    });

    const link = Object.assign(document.createElement("a"), {
      className: "history__link",
      href: entry.pageUrl,
      target: "_blank",
      rel: "noopener",
      textContent: SOURCE_LABEL[entry.source],
    });

    row.append(play, flag, link);
    return row;
  }

  /** Ids one per line, ready to paste into tools/blocklist.txt. @created Claude (claude-opus-5-5) — 2026-10-05 */
  async #copyBroken() {
    const ids = this.#playLog.brokenIds();
    let label = "Nothing marked";
    if (ids.length > 0) {
      try {
        await navigator.clipboard.writeText(ids.join("\n") + "\n");
        label = `Copied ${ids.length}`;
      } catch {
        label = "Copy failed";
      }
    }
    this.#copyButton.textContent = label;
    setTimeout(() => (this.#copyButton.textContent = "Copy broken list"), COPY_FEEDBACK_MS);
  }
}

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
function timeAgo(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
