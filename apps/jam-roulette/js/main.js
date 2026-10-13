// Created by Claude (claude-opus-5-5)
// Date: 2026-10-13

import { REELS } from "./reels.js";
import { PALETTES } from "./palettes.js";
import { LINKS } from "./links.js";

const STORE_KEY = "jam-roulette:v1";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const reels = [...REELS, { id: "palette", label: "Palette", palette: true }];
const BUILT_IN = ["mechanic", "art", "input", "character", "setting"];
const state = { active: {}, locked: {}, maxColors: 16, result: {}, view: "prompt" };
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
const promptEl = document.getElementById("prompt");
const copyPromptButton = document.getElementById("copy-prompt");
const viewPromptButton = document.getElementById("view-prompt");
const viewPitchButton = document.getElementById("view-pitch");

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
function referenceLink(reel, game) {
  const a = el("a", "", game);
  a.href = reel.visual || !LINKS[game]
    ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${game} game`)}`
    : LINKS[game];
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
    name.href = paletteUrl(item);
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
      line.append(referenceLink(reel, game));
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
function midSentence(name) {
  // Lowercase a leading word like "Gravity" or "The" but keep names such as "ASCII", "PS1" or "Game Boy".
  const words = name.split(" ");
  const article = ["A", "An", "The"].includes(words[0]);
  const keep = !article && (/[A-Z]/.test(words[0].slice(1)) || /^[A-Z]/.test(words[1] || ""));
  return keep ? name : name[0].toLowerCase() + name.slice(1);
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function rolledItem(id) {
  return state.active[id] && findItem(reels.find((r) => r.id === id), state.result[id]);
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function extraReels() {
  return REELS.filter((r) => !BUILT_IN.includes(r.id));
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function buildPrompt() {
  const like = (refs) => (refs.length ? ` (like ${refs.join(" or ")})` : "");
  const [mechanic, art, input, character, setting, palette] = [...BUILT_IN, "palette"].map(rolledItem);
  const lines = [];

  if (mechanic || art) {
    const parts = [];
    if (mechanic) parts.push(`where the core mechanic is ${midSentence(mechanic[0])}${like(mechanic.slice(1))}`);
    if (art) parts.push(`with ${midSentence(art[0])} visuals${like(art.slice(1))}`);
    lines.push(`Make a game ${parts.join(", ")}.`);
  }
  if (input) lines.push(`Input: ${midSentence(input[0])}${like(input.slice(1))}.`);
  if (character) lines.push(`Character: ${midSentence(character[0])}${like(character.slice(1))}.`);
  if (setting) lines.push(`Setting: ${midSentence(setting[0])}${like(setting.slice(1))}.`);
  for (const reel of extraReels()) {
    const item = rolledItem(reel.id);
    if (item) lines.push(`${reel.label}: ${midSentence(item[0])}${like(item.slice(1))}.`);
  }
  if (palette) {
    const by = palette.author ? ` by ${palette.author}` : "";
    lines.push(`Use only the ${palette.name} palette${by} (${palette.colors.length} colors):`);
    lines.push(...palette.colors.map((hex) => `- #${hex.toUpperCase()}`));
  }
  return lines.join("\n");
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function buildPitch() {
  const [mechanic, art, input, character, setting] = BUILT_IN.map(rolledItem);
  const extras = extraReels().map((reel) => [reel, rolledItem(reel.id)]).filter(([, item]) => item);
  if (![mechanic, art, input, character, setting].some(Boolean) && !extras.length) return "";
  const sentences = [];

  let opening = art ? `${/^[aeiou]/i.test(art[0]) ? "An" : "A"} ${midSentence(art[0])} game` : "A game";
  if (mechanic) opening += ` built around ${midSentence(mechanic[0])}`;
  if (setting) {
    const place = midSentence(setting[0]);
    opening += /^(inside|in|on|underwater)\b/.test(place) ? `, set ${place}` : `, set in ${place}`;
  }
  sentences.push(`${opening}.`);

  const refs = [...new Set([mechanic, art, character].filter(Boolean).map((item) => item[1]).filter(Boolean))];
  if (refs.length) sentences.push(`Think ${refs.slice(0, 2).join(" meets ")}.`);
  if (character) sentences.push(`${character[0]}.`);
  if (input) sentences.push(`The catch: ${midSentence(input[0])}.`);
  for (const [reel, item] of extras) sentences.push(`${reel.label}: ${midSentence(item[0])}.`);
  return sentences.join(" ");
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function paletteUrl(palette) {
  return `https://lospec.com/palette-list/${palette.slug}`;
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function renderPitch() {
  const palette = rolledItem("palette");
  const pitch = buildPitch();
  const nodes = pitch ? [el("p", "", pitch)] : [];
  if (!palette) return nodes;

  const line = el("p", "", `Everything is drawn in the ${palette.colors.length}-color `);
  const link = el("a", "", palette.name);
  link.href = paletteUrl(palette);
  link.target = "_blank";
  link.rel = "noopener";
  line.append(link, " palette:");

  const list = el("ul", "hex-list");
  for (const hex of palette.colors) {
    const item = el("li");
    const swatch = el("span", "hex-list__swatch");
    swatch.style.background = `#${hex}`;
    item.append(swatch, `#${hex.toUpperCase()}`);
    list.append(item);
  }
  return [...nodes, line, list];
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function pitchText() {
  const palette = rolledItem("palette");
  const parts = [buildPitch()];
  if (palette) {
    const colors = palette.colors.map((hex) => `- #${hex.toUpperCase()}`).join("\n");
    parts.push(`Everything is drawn in the ${palette.colors.length}-color ${palette.name} palette (${paletteUrl(palette)}):\n${colors}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
function renderText() {
  const pitch = state.view === "pitch";
  viewPromptButton.setAttribute("aria-pressed", String(!pitch));
  viewPitchButton.setAttribute("aria-pressed", String(pitch));
  // Results are set when a spin starts, so the text waits for the reels to stop.
  if (spinning) return;
  promptEl.classList.toggle("prompt__text--plain", !pitch);
  if (pitch) promptEl.replaceChildren(...renderPitch());
  else promptEl.textContent = buildPrompt();
}

/** @created Claude (claude-opus-5-5) 2026-10-13 */
async function spin() {
  if (spinning) return;
  const targets = reels.filter((r) => state.active[r.id] && (!state.locked[r.id] || !findItem(r, state.result[r.id])));
  if (!targets.length) return;
  spinning = true;
  spinButton.disabled = true;
  copyPromptButton.disabled = true;
  await Promise.all(targets.map((reel, i) => spinReel(reel, i)));
  spinning = false;
  spinButton.disabled = false;
  copyPromptButton.disabled = false;
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
  renderText();
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
      if (saved.view === "pitch") state.view = "pitch";
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
/** @created Claude (claude-opus-5-5) 2026-10-13 */
async function copyText(button, text) {
  // Keep the original label so a second click within the timeout restores it, not "Copied!".
  button.dataset.label ??= button.textContent;
  const label = button.dataset.label;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied!";
  } catch {
    button.textContent = "Copy failed";
  }
  setTimeout(() => { button.textContent = label; }, 1500);
}

copyButton.addEventListener("click", () => copyText(copyButton, location.href));
copyPromptButton.addEventListener("click", () =>
  copyText(copyPromptButton, state.view === "pitch" ? pitchText() : buildPrompt()));
for (const [button, view] of [[viewPromptButton, "prompt"], [viewPitchButton, "pitch"]]) {
  button.addEventListener("click", () => {
    state.view = view;
    save();
  });
}
addEventListener("hashchange", () => location.reload());
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) {
    e.preventDefault();
    spin();
  }
});
