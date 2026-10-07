// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

import { config } from "./config.js";
import { GameCatalog } from "./catalog.js";
import { SlotPool } from "./slotPool.js";
import { FeedController } from "./feed.js";
import { attachSwipe } from "./swipe.js";
import { PlayLog } from "./playLog.js";
import { HistorySheet } from "./historySheet.js";
import { SharedStore } from "./sharedStore.js";

const feedEl = document.getElementById("feed");
const stripEl = document.getElementById("strip");
const toastEl = document.getElementById("toast");
const portraitQuery = matchMedia("(orientation: portrait)");

document.documentElement.style.setProperty("--transition-ms", `${config.transitionMs}ms`);

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
function showMessage(text) {
  const message = document.createElement("p");
  message.className = "feed__message";
  message.textContent = text;
  feedEl.replaceChildren(message);
}

const playLog = new PlayLog(config.historyMax);
const catalog = new GameCatalog(config.squareTolerance, playLog, config.reportHideCount);
const store = new SharedStore(config.supabaseUrl, config.supabaseAnonKey, config.connectTimeoutMs);
try {
  await catalog.load(config.gamesUrl);
  catalog.setOrientation(portraitQuery.matches);
} catch (err) {
  showMessage(`Couldn't load games (${err.message}).`);
  throw err;
}

let feed = null;

/** Builds the slots and starts the feed once at least one game fits. @created Claude (claude-opus-5-5) — 2026-10-05 */
function startFeed() {
  feedEl.replaceChildren();
  const pool = new SlotPool(feedEl, config.slotCount, config.loadTimeoutMs);
  feed = new FeedController(catalog, pool, {
    nowLink: document.getElementById("now-link"),
    nowAuthor: document.getElementById("now-author"),
    nextTitle: document.getElementById("next-title"),
  }, config, playLog, store);
  feed.start();
}

let undoMark = null; // { id, orientation } from markCurrentBroken()
let undoTimer = 0;

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
function hideToast() {
  clearTimeout(undoTimer);
  toastEl.hidden = true;
  undoMark = null;
}

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
function markBroken() {
  const mark = feed?.markCurrentBroken();
  if (!mark) return;
  hideToast();
  undoMark = mark;
  toastEl.hidden = false;
  undoTimer = setTimeout(hideToast, config.undoMs);
}

const historySheet = new HistorySheet(document.getElementById("history"), playLog, catalog, {
  onPick: (entry) => feed?.jumpTo(entry),
  onToggleBroken: (id, isBroken) => {
    const orientation = catalog.orientation;
    if (feed) feed.setBroken(id, orientation, isBroken);
    else {
      playLog.setBroken(id, orientation, isBroken);
      store.setReported(id, orientation, isBroken);
      catalog.refilter();
      if (catalog.size > 0) startFeed();
    }
  },
});

attachSwipe(stripEl, { onNext: () => feed?.next(), onPrev: () => feed?.prev(), thresholdPx: config.swipeThresholdPx });
document.getElementById("flag-button").addEventListener("click", markBroken);
document.getElementById("history-button").addEventListener("click", () => historySheet.open());
document.getElementById("toast-undo").addEventListener("click", () => {
  if (undoMark) feed?.setBroken(undoMark.id, undoMark.orientation, false);
  hideToast();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) feed?.suspend();
  else feed?.resume();
});
portraitQuery.addEventListener("change", () => {
  catalog.setOrientation(portraitQuery.matches);
  if (feed) feed.refreshAhead();
  else if (catalog.size > 0) startFeed();
  if (historySheet.isOpen) historySheet.render();
});

if (catalog.size > 0) startFeed();
else showMessage("No games fit this orientation. Try rotating your phone.");

// Starts from the bundled list above, then swaps in the shared one when Supabase answers.
const shared = await store.connect();
if (shared) {
  catalog.merge(shared.games, shared.stats, feed?.lastLoaded ?? null);
  if (feed) feed.refreshAhead();
  else if (catalog.size > 0) startFeed();
  if (historySheet.isOpen) historySheet.render();
  store.sync(playLog.brokenMarks());
}
