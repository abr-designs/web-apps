// Created by Claude (claude-opus-5-5)
// Date: 2026-10-13

import { REELS } from "./reels.js";
import { PALETTES } from "./palettes.js";

const STORE_KEY = "jam-roulette:v1";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const reels = [...REELS, { id: "palette", label: "Palette", palette: true }];
const state = { active: {}, locked: {}, maxColors: 16, result: {} };
const views = {};
let spinning = false;
// Reel on/off and locks from the user's own setup, kept aside while a shared link is shown.
let storedSetup = null;

const reelsEl = document.getElementById("reels");
const togglesEl = document.getElementById("toggles");
const spinButton = document.getElementById("spin");
const copyButton = document.getElementById("copy");
const slider = document.getElementById("max-colors");
const sliderOut = document.getElementById("max-colors-out");
const statusEl = document.getElementById("status");

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function slug(text) {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function candidates(reel) {
  return reel.palette ? PALETTES.filter((p) => p.colors.length <= state.maxColors) : reel.entries;
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function keyOf(reel, item) {
  return reel.palette ? item.slug : slug(item[0]);
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function findItem(reel, key) {
  const all = reel.palette ? PALETTES : reel.entries;
  return all.find((item) => keyOf(reel, item) === key) || null;
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function pick(list, avoid) {
  if (list.length > 1 && avoid) list = list.filter((item) => item !== avoid);
  return list[Math.floor(Math.random() * list.length)];
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function imageSearchLink(game) {
  const a = el("a", "", game);
  a.href = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${game} game`)}`;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function renderItem(reel, item) {
  const node = el("div", "item");
  if (!item) {
    node.append(el("div", "item__name item__name--empty", "?"));
    return node;
  }
  if (reel.palette) {
    const swatches = el("div", "swatches");
    swatches.style.gridTemplateColumns = `repeat(${Math.min(item.colors.length, 16)}, 1fr)`;
    for (const hex of item.colors) {
      const swatch = el("span");
      swatch.style.background = `#${hex}`;
      swatch.title = `#${hex}`;
      swatches.append(swatch);
    }
    const name = el("a", "item__name", item.name);
    name.href = `https://lospec.com/palette-list/${item.slug}`;
    name.target = "_blank";
    name.rel = "noopener";
    const meta = `${item.colors.length} colors${item.author ? ` · by ${item.author}` : ""}`;
    node.append(swatches, name, el("div", "item__refs", meta));
    return node;
  }
  const [name, ...refs] = item;
  node.append(el("div", "item__name", name));
  if (refs.length) {
    const line = el("div", "item__refs", "like ");
    refs.forEach((game, i) => {
      if (i) line.append(", ");
      line.append(imageSearchLink(game));
    });
    node.append(line);
  }
  return node;
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function showResult(reel) {
  const strip = views[reel.id].strip;
  strip.style.transition = "none";
  strip.style.transform = "";
  strip.replaceChildren(renderItem(reel, findItem(reel, state.result[reel.id])));
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function spinReel(reel, order) {
  const current = findItem(reel, state.result[reel.id]);
  const pool = candidates(reel);
  const final = pick(pool, current);
  state.result[reel.id] = keyOf(reel, final);

  if (reduceMotion.matches) {
    showResult(reel);
    return Promise.resolve();
  }

  const items = [current, ...Array.from({ length: 14 + order * 4 }, () => pick(pool)), final];
  const strip = views[reel.id].strip;
  strip.style.transition = "none";
  strip.style.transform = "translateY(0)";
  strip.replaceChildren(...items.map((item) => renderItem(reel, item)));
  void strip.offsetHeight;
  const seconds = 1.1 + order * 0.35;
  strip.style.transition = `transform ${seconds}s cubic-bezier(0.15, 0.85, 0.25, 1.04)`;
  strip.style.transform = `translateY(${(-100 * (items.length - 1)) / items.length}%)`;

  return new Promise((resolve) => {
    const done = (e) => {
      if (e && e.target !== strip) return;
      clearTimeout(timer);
      strip.removeEventListener("transitionend", done);
      showResult(reel);
      resolve();
    };
    const timer = setTimeout(done, seconds * 1000 + 200);
    strip.addEventListener("transitionend", done);
  });
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
async function spin() {
  if (spinning) return;
  const targets = reels.filter((r) => state.active[r.id] && (!state.locked[r.id] || !findItem(r, state.result[r.id])));
  if (!targets.length) return;
  spinning = true;
  spinButton.disabled = true;
  await Promise.all(targets.map((reel, i) => spinReel(reel, i)));
  spinning = false;
  spinButton.disabled = false;
  statusEl.textContent = reels.filter((r) => state.active[r.id]).map((r) => {
    const item = findItem(r, state.result[r.id]);
    return `${r.label}: ${r.palette ? item.name : item[0]}`;
  }).join(". ");
  save();
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function save() {
  const params = new URLSearchParams();
  for (const reel of reels) {
    if (state.active[reel.id] && state.result[reel.id]) params.set(reel.id, state.result[reel.id]);
  }
  history.replaceState(null, "", params.size ? `#${params}` : location.pathname + location.search);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, ...storedSetup }));
  } catch { /* storage unavailable: settings just won't persist */ }
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function load() {
  for (const reel of reels) state.active[reel.id] = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) {
      Object.assign(state.active, saved.active);
      Object.assign(state.locked, saved.locked);
      Object.assign(state.result, saved.result);
      if (Number.isInteger(saved.maxColors) && saved.maxColors >= 2 && saved.maxColors <= 64) state.maxColors = saved.maxColors;
    }
  } catch { /* ignore unreadable storage */ }

  const shared = new URLSearchParams(location.hash.slice(1));
  const sharedReels = reels.filter((r) => shared.has(r.id) && findItem(r, shared.get(r.id)));
  if (sharedReels.length) {
    storedSetup = { active: { ...state.active }, locked: { ...state.locked } };
    for (const reel of reels) {
      state.active[reel.id] = sharedReels.includes(reel);
      state.locked[reel.id] = false;
      state.result[reel.id] = shared.get(reel.id) || state.result[reel.id];
    }
  }
  for (const reel of reels) {
    if (!findItem(reel, state.result[reel.id])) delete state.result[reel.id];
  }
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function syncReel(reel) {
  const view = views[reel.id];
  view.section.hidden = !state.active[reel.id];
  view.toggle.setAttribute("aria-pressed", String(!!state.active[reel.id]));
  view.lock.setAttribute("aria-pressed", String(!!state.locked[reel.id]));
  view.lock.textContent = state.locked[reel.id] ? "🔒" : "🔓";
  view.section.classList.toggle("reel--locked", !!state.locked[reel.id]);
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function build() {
  for (const reel of reels) {
    const toggle = el("button", "chip", reel.label);
    toggle.type = "button";
    toggle.addEventListener("click", () => {
      state.active[reel.id] = !state.active[reel.id];
      storedSetup = null;
      syncReel(reel);
      save();
    });
    togglesEl.append(toggle);

    const section = el("section", "reel");
    const header = el("header", "reel__header");
    const lock = el("button", "reel__lock");
    lock.type = "button";
    lock.setAttribute("aria-label", `Lock ${reel.label}`);
    lock.addEventListener("click", () => {
      state.locked[reel.id] = !state.locked[reel.id];
      storedSetup = null;
      syncReel(reel);
      save();
    });
    header.append(el("h2", "", reel.label), lock);
    const win = el("div", "reel__window");
    const strip = el("div", "reel__strip");
    win.append(strip);
    section.append(header, win);
    reelsEl.append(section);

    views[reel.id] = { section, toggle, lock, strip };
    syncReel(reel);
    showResult(reel);
  }
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function syncSlider() {
  slider.value = state.maxColors;
  const count = PALETTES.filter((p) => p.colors.length <= state.maxColors).length;
  sliderOut.textContent = `${state.maxColors} (${count} palettes)`;
}

load();
build();
syncSlider();
save();

spinButton.addEventListener("click", spin);
slider.addEventListener("input", () => {
  state.maxColors = Number(slider.value);
  syncSlider();
  save();
});
copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    copyButton.textContent = "Copied!";
  } catch {
    copyButton.textContent = "Copy failed";
  }
  setTimeout(() => { copyButton.textContent = "Copy link"; }, 1500);
});
addEventListener("hashchange", () => location.reload());
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) {
    e.preventDefault();
    spin();
  }
});
