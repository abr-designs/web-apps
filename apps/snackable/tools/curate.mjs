// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05
//
// Builds data/games.json from one or more itch.io listings.
// Usage: node tools/curate.mjs [--pages N] [--refresh] [listingUrl ...]
//   --pages N   RSS pages to read per listing (36 games per page, default 3)
//   --refresh   refetch every game, including ones already in data/games.json
// Reads each listing's RSS feed (listing URL + ".xml?page=N"). If no feed can be read
// (429 / Cloudflare), falls back to tools/sources.txt. Each new game page is then fetched
// to find its HTML5 upload.

import { readFile, writeFile } from "node:fs/promises";

const DEFAULT_LISTINGS = [
  "https://itch.io/games/duration-seconds/html5/input-touchscreen/platform-android",
  "https://itch.io/games/duration-seconds/html5/input-touchscreen",
];
const DEFAULT_PAGES = 3;
const SOURCES_PATH = new URL("./sources.txt", import.meta.url);
const OUTPUT_PATH = new URL("../data/games.json", import.meta.url);
const REQUEST_DELAY_MS = 600;
const RETRY_DELAY_MS = 5000;
// Keep in sync with squareTolerance in js/config.js and SQUARE_TOLERANCE in spike.html; only used for the summary here.
const SQUARE_TOLERANCE = 1.15;
const HEADERS = { "User-Agent": "Mozilla/5.0 (Snackable prototype curation script)" };

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
async function fetchText(url, retries = 2) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429 && retries > 0) {
    await sleep(RETRY_DELAY_MS);
    return fetchText(url, retries - 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
function parseArgs(argv) {
  const args = { pages: DEFAULT_PAGES, refresh: false, listings: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--pages") args.pages = Number(argv[++i]);
    else if (argv[i] === "--refresh") args.refresh = true;
    else args.listings.push(argv[i]);
  }
  if (args.listings.length === 0) args.listings = DEFAULT_LISTINGS;
  return args;
}

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
async function getSourceUrls(listings, pages) {
  const urls = new Set();
  for (const listing of listings) {
    for (let page = 1; page <= pages; page++) {
      try {
        const xml = await fetchText(`${listing}.xml?page=${page}`);
        const links = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((m) => m[1].trim());
        links.forEach((l) => urls.add(l));
        console.log(`RSS page ${page}: ${links.length} games from ${listing}`);
        if (links.length === 0) break;
      } catch (err) {
        console.warn(`RSS page ${page} unavailable (${err.message})`);
        break;
      }
      await sleep(REQUEST_DELAY_MS);
    }
  }

  if (urls.size > 0) {
    const header =
      "# Created by Claude (claude-opus-5-5)\n# Date: 2026-10-05\n" +
      `# Game page URLs, one per line. Refreshed from:\n${listings.map((l) => `#   ${l}\n`).join("")}`;
    await writeFile(SOURCES_PATH, header + [...urls].join("\n") + "\n");
    console.log(`${urls.size} unique games (sources.txt updated)`);
    return [...urls];
  }

  console.warn("No RSS feed readable, using sources.txt");
  const text = await readFile(SOURCES_PATH, "utf8");
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
}

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
async function loadExisting() {
  try {
    const games = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    return new Map(games.map((g) => [g.itchPageUrl, g]));
  } catch {
    return new Map();
  }
}

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
async function curateGame(pageUrl) {
  const html = (await fetchText(pageUrl)).replaceAll("\\/", "/").replaceAll("&quot;", '"');
  // The raw html-classic.itch.zone URL shows itch.io's anti-hotlink page when framed elsewhere,
  // so only its upload id is kept and the game is played through itch.io's official embed page.
  const uploadId = html.match(/https:\/\/html-classic\.itch\.zone\/html\/(\d+)\//)?.[1];
  if (!uploadId) return null;

  const data = JSON.parse(await fetchText(`${pageUrl}/data.json`));
  const width = Number(html.match(/data-width="(\d+)"/)?.[1] ?? 0);
  const height = Number(html.match(/data-height="(\d+)"/)?.[1] ?? 0);

  return {
    id: String(data.id),
    title: data.title,
    author: data.authors?.[0]?.name ?? new URL(pageUrl).hostname.split(".")[0],
    embedUrl: `https://itch.io/embed-upload/${uploadId}?color=111111`,
    itchPageUrl: pageUrl,
    coverImage: data.cover_image ?? "",
    width,
    height,
  };
}

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
function orientationOf(game) {
  if (!game.width || !game.height) return "square";
  const ratio = game.width / game.height;
  if (ratio < SQUARE_TOLERANCE && ratio > 1 / SQUARE_TOLERANCE) return "square";
  return ratio < 1 ? "portrait" : "landscape";
}

const args = parseArgs(process.argv.slice(2));
const urls = await getSourceUrls(args.listings, args.pages);
const existing = args.refresh ? new Map() : await loadExisting();
const games = [];

for (const url of urls) {
  const cached = existing.get(url);
  if (cached) {
    games.push(cached);
    continue;
  }
  try {
    const game = await curateGame(url);
    if (game) {
      games.push(game);
      console.log(`  ok    ${orientationOf(game).padEnd(9)} ${game.title}`);
    } else {
      console.log(`  skip  ${url} (no HTML5 embed on page)`);
    }
  } catch (err) {
    console.log(`  fail  ${url} (${err.message})`);
  }
  await sleep(REQUEST_DELAY_MS);
}

await writeFile(OUTPUT_PATH, JSON.stringify(games, null, 2) + "\n");
const counts = { portrait: 0, square: 0, landscape: 0 };
games.forEach((g) => counts[orientationOf(g)]++);
console.log(
  `Wrote ${games.length} games to data/games.json ` +
    `(portrait ${counts.portrait}, square ${counts.square}, landscape ${counts.landscape})`,
);
