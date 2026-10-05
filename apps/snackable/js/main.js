// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05

import { config } from "./config.js";
import { GameCatalog } from "./catalog.js";
import { SlotPool } from "./slotPool.js";
import { FeedController } from "./feed.js";
import { attachSwipe } from "./swipe.js";

const feedEl = document.getElementById("feed");
const stripEl = document.getElementById("strip");
const portraitQuery = matchMedia("(orientation: portrait)");

document.documentElement.style.setProperty("--transition-ms", `${config.transitionMs}ms`);

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
function showMessage(text) {
  const message = document.createElement("p");
  message.className = "feed__message";
  message.textContent = text;
  feedEl.replaceChildren(message);
}

const catalog = new GameCatalog(config.squareTolerance);
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
  }, config);
  feed.start();
}

attachSwipe(stripEl, { onNext: () => feed?.next(), onPrev: () => feed?.prev(), thresholdPx: config.swipeThresholdPx });
portraitQuery.addEventListener("change", () => {
  catalog.setOrientation(portraitQuery.matches);
  if (feed) feed.refreshAhead();
  else if (catalog.size > 0) startFeed();
});

if (catalog.size > 0) startFeed();
else showMessage("No games fit this orientation. Try rotating your phone.");
