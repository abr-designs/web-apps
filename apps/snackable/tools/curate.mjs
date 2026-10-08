// Created by Claude (claude-opus-5-5)
// Date: 2026-10-05
//
// Builds data/games.json from itch.io listings and hand-picked Lexaloffle BBS PICO-8 posts.
// Usage: node tools/curate.mjs [--pages N] [--refresh] [--push] [listingUrl ...]
//   --pages N   RSS pages to read per listing (36 games per page, default 3)
//   --refresh   refetch every game, including ones already in data/games.json
//   --push      then upsert every game into the Supabase games table; needs the SUPABASE_URL
//               and SUPABASE_SERVICE_KEY environment variables. Never sends status, never deletes.
// Reads each listing's RSS feed (listing URL + ".xml?page=N"). If no feed can be read
// (429 / Cloudflare), falls back to tools/sources.txt. Each new game page is then fetched
// to find its HTML5 upload. PICO-8 post URLs come from tools/sources-pico8.txt.

import { readFile, writeFile } from "node:fs/promises";

const DEFAULT_LISTINGS = [
  "https://itch.io/games/duration-seconds/html5/input-touchscreen/platform-android",
  "https://itch.io/games/duration-seconds/html5/input-touchscreen",
  "https://itch.io/games/duration-seconds/html5/tag-pico-8",
];
const DEFAULT_PAGES = 3;
const SOURCES_PATH = new URL("./sources.txt", import.meta.url);
const PICO8_SOURCES_PATH = new URL("./sources-pico8.txt", import.meta.url);
const PICO8_SIZE = 128;
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
  const args = { pages: DEFAULT_PAGES, refresh: false, push: false, listings: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--pages") args.pages = Number(argv[++i]);
    else if (argv[i] === "--refresh") args.refresh = true;
    else if (argv[i] === "--push") args.push = true;
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
  return readLines(SOURCES_PATH);
}

/** Non-empty, non-# lines; [] when the file is missing. @created Claude (claude-opus-5-5) — 2026-10-05 */
async function readLines(path) {
  try {
    const text = await readFile(path, "utf8");
    return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  } catch {
    return [];
  }
}

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
async function loadExisting() {
  try {
    const games = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    return new Map(games.map((g) => [g.pageUrl, g]));
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
    source: "itch",
    title: data.title,
    author: data.authors?.[0]?.name ?? new URL(pageUrl).hostname.split(".")[0],
    embedUrl: `https://itch.io/embed-upload/${uploadId}?color=111111`,
    pageUrl,
    coverImage: data.cover_image ?? "",
    width,
    height,
  };
}

/**
 * A Lexaloffle BBS post (?tid= or ?pid=). The cart id comes from the post's snippet.php link and
 * the game is played through Lexaloffle's own widget. null when the post has no cart.
 * @created Claude (claude-opus-5-5) — 2026-10-05
 */
async function curatePico8(postUrl) {
  const html = await fetchText(postUrl);
  const cartId = html.match(/snippet\.php\?cart_id=([\w-]+)/)?.[1];
  if (!cartId) return null;
  const decode = (s) =>
    s
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .trim();
  return {
    id: `pico8:${cartId}`,
    source: "pico8",
    title: decode(html.match(/<title>([^<]+)/)?.[1] ?? cartId),
    // The first post's author name is the first bold profile link on the page.
    author: decode(html.match(/<a href="\/bbs\/\?uid=\d+"><b[^>]*>([^<]+)/)?.[1] ?? "unknown"),
    embedUrl: `https://www.lexaloffle.com/bbs/widget.php?pid=${cartId}`,
    pageUrl: postUrl,
    coverImage: html.match(/og:image" content="([^"]+)"/)?.[1] ?? "",
    width: PICO8_SIZE,
    height: PICO8_SIZE,
  };
}

/** @created Claude (claude-opus-5-5) — 2026-10-05 */
function orientationOf(game) {
  if (!game.width || !game.height) return "square";
  const ratio = game.width / game.height;
  if (ratio < SQUARE_TOLERANCE && ratio > 1 / SQUARE_TOLERANCE) return "square";
  return ratio < 1 ? "portrait" : "landscape";
}

/**
 * Upserts games into the Supabase games table with the service key. Leaves status and added_at
 * untouched, so dashboard overrides survive a re-curate.
 * @created Claude (claude-opus-5-5) — 2026-10-07
 */
async function pushGames(games) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const rows = games.map((g) => ({
    id: g.id,
    source: g.source,
    title: g.title,
    author: g.author,
    embed_url: g.embedUrl,
    page_url: g.pageUrl,
    cover_image: g.coverImage,
    width: g.width,
    height: g.height,
  }));
  const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/games`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`push failed: ${res.status} ${await res.text()}`);
  console.log(`Pushed ${rows.length} games to Supabase`);
}

const args = parseArgs(process.argv.slice(2));
if (args.push && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)) {
  throw new Error("--push needs SUPABASE_URL and SUPABASE_SERVICE_KEY");
}
const itchUrls = await getSourceUrls(args.listings, args.pages);
const pico8Urls = await readLines(PICO8_SOURCES_PATH);
const existing = args.refresh ? new Map() : await loadExisting();
const games = [];
const sources = [
  ...itchUrls.map((url) => ({ url, curate: curateGame, skipReason: "no HTML5 embed on page" })),
  ...pico8Urls.map((url) => ({ url, curate: curatePico8, skipReason: "no cart in post" })),
];
console.log(`${pico8Urls.length} PICO-8 posts from sources-pico8.txt`);

for (const { url, curate, skipReason } of sources) {
  if (games.some((g) => g.pageUrl === url)) continue; // listed twice
  const cached = existing.get(url);
  if (cached) {
    games.push(cached);
    continue;
  }
  try {
    const game = await curate(url);
    if (game) {
      games.push(game);
      console.log(`  ok    ${orientationOf(game).padEnd(9)} ${game.title}`);
    } else {
      console.log(`  skip  ${url} (${skipReason})`);
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
if (args.push) await pushGames(games);
