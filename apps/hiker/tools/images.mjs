// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Finds a candidate photo per hike and writes data/images.json. Entry shapes:
//   {url, page, credit, title}  a photo (checked by eye before committing)
//   {rejected: [page, ...]}     wrong photos turned down by hand; lookups skip these pages
//   null                        nothing found
// Sources, most specific first: Commons (name near the hike), Flickr (name within FLICKR_RADIUS_KM, optional: needs
// FLICKR_API_KEY in the environment or .env.local), Wikidata places near the hike (their chosen image), Commons
// categories of those places or named after the hike (a geotagged member near the hike), Wikipedia articles near
// the hike, then Openverse (name plus province or state; it has no location, so name alone found too many namesakes).
// Run from the repo root: node tools/images.mjs   (add --retry-misses to look up null and rejected entries again)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const WIKIPEDIA = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA = 'https://query.wikidata.org/sparql';
const FLICKR = 'https://api.flickr.com/services/rest/';
const OPENVERSE = 'https://api.openverse.org/v1/images/';
const HEADERS = { 'User-Agent': 'Hiker/1.0 (personal static app; one-off image import)' };
const PACE_MS = 4000;
const BACKOFF_MS = 60000;
const ATTEMPTS = 5;
const FLICKR_RADIUS_KM = 5;
const NEAR_KM = 15;
const OUT = new URL('../data/images.json', import.meta.url);

// Flickr licence ids that allow sharing with attribution (all Creative Commons, CC0 and public domain).
const FLICKR_LICENCES = {
  1: 'CC BY-NC-SA 2.0', 2: 'CC BY-NC 2.0', 3: 'CC BY-NC-ND 2.0', 4: 'CC BY 2.0', 5: 'CC BY-SA 2.0', 6: 'CC BY-ND 2.0',
  9: 'CC0', 10: 'Public domain', 11: 'CC BY 4.0', 12: 'CC BY-SA 4.0', 13: 'CC BY-ND 4.0', 14: 'CC BY-NC 4.0',
  15: 'CC BY-NC-SA 4.0', 16: 'CC BY-NC-ND 4.0',
};

// Words that say nothing about which hike a photo shows.
const GENERIC = new Set(['mount', 'mountain', 'mt', 'lake', 'lakes', 'peak', 'trail', 'ridge', 'creek', 'canyon', 'pass',
  'falls', 'hill', 'loop', 'the', 'and', 'of', 'summit', 'park', 'provincial', 'tarn', 'meadows', 'glacier', 'river']);

// An Openverse photo has no location, so its title or tags must also say it is outdoors or in the region.
const SCENIC = ['mountain', 'mount', 'lake', 'trail', 'hike', 'hiking', 'peak', 'summit', 'ridge', 'view', 'landscape',
  'forest', 'park', 'island', 'canada', 'british columbia', 'britishcolumbia', 'bc', 'washington', 'cascades', 'glacier', 'alpine'];

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Lowercase text with every non-alphanumeric run turned into one space, padded for whole-word checks. @created Claude (claude-opus-5-5) - 2026-09-28 */
const words = text => ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** Distinctive lowercase words of a hike name; a photo title must contain all of them. @created Claude (claude-opus-5-5) - 2026-09-28 */
export const keyWords = name => words(name).trim().split(' ').filter(w => w.length > 2 && !GENERIC.has(w));

/** True when `title` contains every key word as a whole word. @created Claude (claude-opus-5-5) - 2026-09-28 */
export const titleMatches = (title, keys) => {
  const t = words(title);
  return keys.every(k => t.includes(` ${k} `));
};

/** True when title or tags mention a scenic or regional term. @created Claude (claude-opus-5-5) - 2026-09-28 */
export const looksScenic = (title, tags = []) => {
  const t = words(`${title} ${tags.join(' ')}`);
  return SCENIC.some(s => t.includes(` ${s} `));
};

/** Text of an HTML fragment (Commons Artist is HTML). @created Claude (claude-opus-5-5) - 2026-09-28 */
const plain = html => html?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || undefined;

/** "Author, Licence (Source)". @created Claude (claude-opus-5-5) - 2026-09-28 */
function credit(author, licenceName, source) {
  return `${author ?? 'Unknown author'}, ${licenceName ?? 'licence on source page'} (${source})`;
}

/** FLICKR_API_KEY from the environment, else from an untracked .env.local line. @created Claude (claude-opus-5-5) - 2026-09-28 */
function flickrKey() {
  if (process.env.FLICKR_API_KEY) return process.env.FLICKR_API_KEY;
  const file = new URL('../.env.local', import.meta.url);
  if (!existsSync(file)) return undefined;
  return readFileSync(file, 'utf8').match(/^FLICKR_API_KEY=(.+)$/m)?.[1].trim();
}

/**
 * GET JSON with retries. 429, 5xx, non-JSON bodies and API error objects are retried after BACKOFF_MS;
 * after ATTEMPTS it throws, so the caller skips the hike instead of saving a false miss.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
async function getJson(url) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let reason;
    try {
      const res = await fetch(url, { headers: HEADERS });
      const text = await res.text();
      if (res.ok) {
        const body = JSON.parse(text);
        if (!body.error) {
          await sleep(PACE_MS);
          return body;
        }
        reason = `API error ${body.error.code ?? ''}`;
      } else reason = `HTTP ${res.status}`;
    } catch (err) {
      reason = err.message;
    }
    console.log(`  ${reason}; waiting ${BACKOFF_MS / 1000}s (attempt ${attempt}/${ATTEMPTS})`);
    await sleep(BACKOFF_MS);
  }
  throw new Error(`gave up on ${new URL(url).host}`);
}

/** Commons imageinfo page -> entry, or null when it has no image. @created Claude (claude-opus-5-5) - 2026-09-28 */
function commonsEntry(page) {
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  return {
    url: info.thumburl ?? info.url,
    page: info.descriptionurl,
    credit: credit(plain(meta.Artist?.value), plain(meta.LicenseShortName?.value), 'Wikimedia Commons'),
    title: page.title.replace(/^File:/, ''),
  };
}

const IMAGEINFO = { prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '900', iiextmetadatafilter: 'Artist|LicenseShortName' };

/** First Commons search hit (in search order) whose title has all `keys` and is not in `skip`. @created Claude (claude-opus-5-5) - 2026-09-28 */
async function commons(query, keys, skip) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', maxlag: '5', generator: 'search', gsrnamespace: '6', gsrlimit: '10',
    gsrsearch: `${query} filetype:bitmap`, ...IMAGEINFO,
  });
  const body = await getJson(`${COMMONS}?${params}`);
  return Object.values(body.query?.pages ?? {})
    .sort((a, b) => a.index - b.index)
    .filter(p => titleMatches(p.title, keys))
    .map(commonsEntry)
    .find(e => e && !skip.has(e.page)) ?? null;
}

/** Great-circle distance in km. @created Claude (claude-opus-5-5) - 2026-09-28 */
function distanceKm(a, b) {
  const rad = d => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * Wikidata places within NEAR_KM whose label has all `keys`: their image (P18) and Commons category (P373).
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
async function wikidataPlaces(hike, keys) {
  const query = `SELECT ?label ?image ?category WHERE {
    SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(${hike.lon} ${hike.lat})"^^geo:wktLiteral .
      bd:serviceParam wikibase:radius "${NEAR_KM}" . }
    ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
    OPTIONAL { ?item wdt:P18 ?image . }
    OPTIONAL { ?item wdt:P373 ?category . }
  }`;
  const body = await getJson(`${WIKIDATA}?${new URLSearchParams({ query, format: 'json' })}`);
  return body.results.bindings
    .filter(b => titleMatches(b.label.value, keys))
    .map(b => ({
      file: b.image && `File:${decodeURIComponent(b.image.value.split('/').pop())}`,
      category: b.category && `Category:${b.category.value}`,
    }));
}

/** Commons entry for the first of `files` not in `skip`. @created Claude (claude-opus-5-5) - 2026-09-28 */
async function commonsFiles(files, skip) {
  if (!files.length) return null;
  const body = await getJson(`${COMMONS}?${new URLSearchParams({ action: 'query', format: 'json', titles: files.join('|'), ...IMAGEINFO })}`);
  const byTitle = new Map(Object.values(body.query?.pages ?? {}).map(p => [p.title, p]));
  return files.map(f => commonsEntry(byTitle.get(f.replace(/_/g, ' ')))).find(e => e && !skip.has(e.page)) ?? null;
}

/**
 * A photo from a Commons category: the first landscape member geotagged within NEAR_KM of the hike.
 * Categories are curated per place, but a name can be shared, so the geotag is what confirms the place.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
async function categoryPhoto(category, hike, skip) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', maxlag: '5', generator: 'categorymembers', gcmtitle: category, gcmtype: 'file',
    gcmlimit: '50', ...IMAGEINFO, prop: 'imageinfo|coordinates', colimit: 'max',
  });
  const body = await getJson(`${COMMONS}?${params}`);
  return Object.values(body.query?.pages ?? {})
    .filter(p => p.coordinates?.[0] && distanceKm(hike, p.coordinates[0]) <= NEAR_KM)
    .filter(p => (p.imageinfo?.[0]?.width ?? 0) >= (p.imageinfo?.[0]?.height ?? 1))
    .map(commonsEntry)
    .find(e => e && !skip.has(e.page)) ?? null;
}

/** Commons categories whose title has all `keys`. @created Claude (claude-opus-5-5) - 2026-09-28 */
async function categoriesNamed(hike, keys) {
  const params = new URLSearchParams({ action: 'query', format: 'json', maxlag: '5', list: 'search', srnamespace: '14', srsearch: hike.name, srlimit: '10' });
  const body = await getJson(`${COMMONS}?${params}`);
  return (body.query?.search ?? []).map(r => r.title).filter(t => titleMatches(t, keys)).slice(0, 3);
}

/**
 * Wikidata image first, then photos from the matching places' categories and from categories named after the hike.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
async function curated(hike, keys, skip) {
  const places = await wikidataPlaces(hike, keys);
  const image = await commonsFiles(places.map(p => p.file).filter(Boolean), skip);
  if (image) return image;
  const categories = [...new Set([...places.map(p => p.category).filter(Boolean), ...await categoriesNamed(hike, keys)])];
  for (const category of categories) {
    const photo = await categoryPhoto(category, hike, skip);
    if (photo) return photo;
  }
  return null;
}

/**
 * Lead image of a Wikipedia article within 10 km whose title has all `keys`. Only Commons-hosted images
 * are used, so the licence and author can be read.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
async function wikipedia(hike, keys, skip) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', maxlag: '5', generator: 'geosearch', ggscoord: `${hike.lat}|${hike.lon}`,
    ggsradius: '10000', ggslimit: '30', prop: 'pageimages', piprop: 'name',
  });
  const body = await getJson(`${WIKIPEDIA}?${params}`);
  const files = Object.values(body.query?.pages ?? {})
    .filter(p => p.pageimage && titleMatches(p.title, keys))
    .map(p => `File:${p.pageimage}`);
  return commonsFiles(files, skip);
}

/**
 * Flickr text search limited to FLICKR_RADIUS_KM around the hike and to shareable licences.
 * The title or tags must still carry the key words (tags join words, so "yakpeak" counts).
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
async function flickr(hike, keys, skip, apiKey) {
  const params = new URLSearchParams({
    method: 'flickr.photos.search', format: 'json', nojsoncallback: '1', api_key: apiKey,
    text: hike.name, lat: String(hike.lat), lon: String(hike.lon), radius: String(FLICKR_RADIUS_KM), radius_units: 'km',
    license: Object.keys(FLICKR_LICENCES).join(','), content_types: '0', media: 'photos', sort: 'relevance',
    extras: 'url_l,url_c,owner_name,license,tags', per_page: '30',
  });
  const body = await getJson(`${FLICKR}?${params}`);
  if (body.stat !== 'ok') throw new Error(`Flickr: ${body.message}`);
  const joined = keys.join('');
  return body.photos.photo
    .filter(p => (p.url_l || p.url_c) && (titleMatches(`${p.title} ${p.tags}`, keys) || p.tags.split(' ').some(t => t.includes(joined))))
    .map(p => ({
      url: p.url_l ?? p.url_c,
      page: `https://www.flickr.com/photos/${p.owner}/${p.id}`,
      credit: credit(p.ownername, FLICKR_LICENCES[p.license], 'Flickr'),
      title: p.title,
    }))
    .find(e => !skip.has(e.page)) ?? null;
}

/**
 * Openverse, excluding Commons (searched already). All CC licences are accepted: this is a personal, non-commercial
 * app that shows photos unmodified, and the credit names the licence.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
async function openverse(query, keys, skip) {
  const params = new URLSearchParams({ q: query, page_size: '20', excluded_source: 'wikimedia' });
  const body = await getJson(`${OPENVERSE}?${params}`);
  const hit = (body.results ?? []).find(p =>
    p.title && titleMatches(p.title, keys) && looksScenic(p.title, (p.tags ?? []).map(t => t.name))
    && (p.width ?? 1) >= (p.height ?? 1) && !skip.has(p.foreign_landing_url));
  if (!hit) return null;
  return { url: hit.url, page: hit.foreign_landing_url, credit: credit(hit.creator, licence(hit), hit.source), title: hit.title };
}

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
function licence({ license, license_version: version }) {
  if (license === 'cc0') return 'CC0';
  if (license === 'pdm') return 'Public domain';
  return `CC ${license.toUpperCase()}${version ? ` ${version}` : ''}`;
}

/**
 * Most specific first. A nearby photo that does not name the hike is never used: it rarely shows the hike itself.
 * @created Claude (claude-opus-5-5) - 2026-09-28
 */
async function findImage(hike, skip, apiKey) {
  const located = Number.isFinite(hike.lat) && Number.isFinite(hike.lon);
  const region = hike.country === 'US' ? 'Washington' : 'British Columbia';
  const keys = keyWords(hike.name);
  return (located ? await commons(`${hike.name} nearcoord:15km,${hike.lat},${hike.lon}`, keys, skip) : await commons(`"${hike.name}"`, keys, skip))
    ?? (located && apiKey ? await flickr(hike, keys, skip, apiKey) : null)
    ?? (located ? await curated(hike, keys, skip) : null)
    ?? (located ? await wikipedia(hike, keys, skip) : null)
    ?? await openverse(`${hike.name} ${region}`, keys, skip);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const hikes = JSON.parse(readFileSync(new URL('../data/hikes.json', import.meta.url), 'utf8'));
  const images = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  const retryMisses = process.argv.includes('--retry-misses');
  const apiKey = flickrKey();
  if (!apiKey) console.log('No FLICKR_API_KEY: skipping Flickr.');
  let skipped = 0;

  for (const hike of hikes) {
    const entry = images[hike.id];
    if (hike.id in images && (entry?.url || !retryMisses)) continue;
    const rejected = entry?.rejected ?? [];
    let found;
    try {
      found = await findImage(hike, new Set(rejected), apiKey);
    } catch (err) {
      // Not saved, so the next run tries this hike again.
      skipped++;
      console.log(`${hike.name}: skipped (${err.message})`);
      continue;
    }
    images[hike.id] = found ? { ...found, ...(rejected.length && { rejected }) } : rejected.length ? { rejected } : null;
    console.log(`${hike.name}: ${found ? `${found.title} <${found.page}>` : 'no image'}`);
    writeFileSync(OUT, JSON.stringify(images, null, 2) + '\n');
  }
  const found = Object.values(images).filter(e => e?.url).length;
  console.log(`${found}/${hikes.length} hikes have an image${skipped ? `; ${skipped} skipped, run again to retry them` : ''}`);
}
