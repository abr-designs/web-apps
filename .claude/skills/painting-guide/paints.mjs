// Created by Claude (claude-opus-5-5)
// Date: 2026-10-25
//
// Paint lookups for painting guides, over Paint Rack's catalogue (apps/warhammer-paint/paints.js).
//
//   node paints.mjs projects <backup.json>
//       Lists the Paint Rack projects in a backup, with their paints.
//   node paints.mjs match [--to <Brand>] [--from <Brand>] [--backup <backup.json>] [--project <name>] [--in <file>] [names...]
//       Resolves paint names (one per argument or per line of --in, or every paint in --project) to catalogue paints.
//       With --to, converts each to the closest paint of the same type in that brand by CIEDE2000, the way Paint Rack's
//       "Convert brand" does: metallics only match metallics, washes/shades/inks only match each other, and
//       contrast/speedpaint only match each other. No same-type paint in the brand keeps the original and flags it.
//       With --backup, tags each final paint owned or not. Prints JSON to stdout and a readable table to stderr.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(here, "..", "..", "..", "apps", "warhammer-paint", "paints.js");
const WEAK = 10; // deltaE above this is a visibly different colour; flagged for review

// ---------- Catalogue (mirrors Paint Rack's parsing so ids match its backups) ----------
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = s => s.toLowerCase().replace(/colour/g, "color").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const hexToRgb = h => [0, 2, 4].map(i => parseInt(h.replace("#", "").slice(i, i + 2), 16));

function rgbToLab([r, g, b]) {
  const lin = c => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 colour difference, copied from Paint Rack. */
function deltaE([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b, a) => { if (!a && !b) return 0; const v = Math.atan2(b, a) * deg; return v < 0 ? v + 360 : v; };
  const h1p = h(b1, a1p), h2p = h(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2 * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p) { hbp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * (Lbp - 50) ** 2 / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

/** Same grouping as Paint Rack's paintType. */
function paintType(p) {
  const r = p.range.toLowerCase();
  const kind = /wash|shade|ink/.test(r) ? "wash" : /contrast|speedpaint/.test(r) ? "contrast" : "standard";
  return (p.metal ? "metallic " : "") + kind;
}

function makePaint(brand, range, name, hex, metal, code) {
  const p = { id: slug(`${brand}-${range}-${code || ""}-${name}`), brand, range, name, code: code || "", hex: hex.replace("#", "").toUpperCase(), metal: !!metal };
  p.type = paintType(p);
  p.lab = rgbToLab(hexToRgb(p.hex));
  p.n = norm(name);
  return p;
}

function loadCatalog(backup) {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(catalogPath, "utf8"), ctx);
  const paints = [];
  for (const col of ctx.window.PAINT_COLLECTIONS) {
    for (const t of col.paints.split("\n").map(s => s.trim()).filter(Boolean)) {
      const [left, hex, flag] = t.split("|");
      if (!hex) continue;
      const m = left.match(/^([^:]+):(.+)$/);
      paints.push(makePaint(col.brand, col.range, m ? m[2].trim() : left.trim(), hex, flag === "m", m ? m[1].trim() : ""));
    }
  }
  // Custom paints keep their stored id, as Paint Rack does, so backup projects and owned lists still point at them.
  for (const c of backup?.custom || []) {
    if (!c || !c.name || !/^#?[0-9a-f]{6}$/i.test(c.hex || "")) continue;
    const p = makePaint(c.brand || "Custom", c.range || "Custom", c.name, c.hex, c.metal, c.code);
    p.id = String(c.id || "custom-" + slug(`${p.brand}-${p.range}-${p.name}`));
    paints.push(p);
  }
  return paints;
}

// ---------- Name matching ----------
const ALIASES = { Citadel: ["games workshop", "gw"], "Army Painter": ["the army painter", "ap"], AK: ["ak interactive"] };
const wordsOf = p => new Set([...norm(p.brand).split(" "), ...(ALIASES[p.brand] || []).flatMap(a => a.split(" ")), ...norm(p.range).split(" ")]);
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Resolves one line ("Nuln Oil", "Citadel Shade Nuln Oil", "70.965 Prussian Blue") to a catalogue paint or null. */
function resolve(line, pool, fromBrand) {
  const code = line.match(/^(\d{2}\.\d{3}|AK\d+)\b/i);
  if (code) { const hit = pool.find(p => p.code.toLowerCase() === code[1].toLowerCase()); if (hit) return { p: hit, guess: false }; }
  const L = norm(line), words = L.split(" ");
  const prefixOk = (p, size) => { const w = wordsOf(p); return words.slice(0, Math.max(0, words.length - size)).every(x => w.has(x)); };
  const rank = (a, b) => b.n.length - a.n.length || (b.p.brand === fromBrand) - (a.p.brand === fromBrand);
  const cands = pool.map(p => ({ p, n: p.n }));
  let hits = cands.filter(c => (L === c.n || L.endsWith(" " + c.n)) && prefixOk(c.p, c.n.split(" ").length));
  if (hits.length) return { p: hits.sort(rank)[0].p, guess: false };
  hits = cands.map(c => {
    const size = c.n.split(" ").length;
    return { ...c, d: c.n.length >= 6 && prefixOk(c.p, size) ? editDistance(words.slice(-size).join(" "), c.n) : 99 };
  }).filter(c => c.d <= 2);
  if (hits.length) return { p: hits.sort((a, b) => a.d - b.d || rank(a, b))[0].p, guess: true };
  return null;
}

// ---------- CLI ----------
const args = process.argv.slice(2);
const cmd = args.shift();
const fail = msg => { console.error(msg); process.exit(1); };
const opt = name => {
  const i = args.indexOf("--" + name);
  if (i < 0) return null;
  const v = args[i + 1];
  if (v == null || v.startsWith("--")) fail(`--${name} needs a value`);
  args.splice(i, 2);
  return v;
};
const readJson = (path, what) => {
  if (!path) fail(`Missing ${what} path`);
  try { return JSON.parse(readFileSync(path, "utf8")); } catch (e) { fail(`Can't read ${what} "${path}": ${e.message}`); }
};
const short = p => ({ id: p.id, brand: p.brand, range: p.range, name: p.name, code: p.code, hex: p.hex, metal: p.metal, type: p.type });
const label = p => `${p.brand} ${p.range} ${p.name}${p.code ? " " + p.code : ""}`;
// Paint Rack's "Paste a list" accepts a code with its name, or brand + range + name.
const pasteLine = p => p.code ? `${p.code} ${p.name}` : `${p.brand} ${p.range} ${p.name}`;

if (cmd === "projects") {
  const backup = readJson(args[0], "backup");
  const byId = new Map(loadCatalog(backup).map(p => [p.id, p]));
  for (const pr of backup.projects || []) {
    const items = pr.items || [];
    console.log(`${pr.name} (${items.length} paints)`);
    for (const id of items) console.log("  " + (byId.has(id) ? label(byId.get(id)) : id + " (not in catalogue)"));
  }
} else if (cmd === "match") {
  const to = opt("to"), from = opt("from"), backupPath = opt("backup"), project = opt("project"), inFile = opt("in");
  const unknown = args.find(a => a.startsWith("--"));
  if (unknown) fail(`Unknown option ${unknown}. Options: --to, --from, --backup, --project, --in`);
  const backup = backupPath ? readJson(backupPath, "backup") : null;
  const pool = loadCatalog(backup);
  const byId = new Map(pool.map(p => [p.id, p]));
  if (to && !pool.some(p => p.brand === to)) { console.error(`Unknown brand "${to}". Brands: ${[...new Set(pool.map(p => p.brand))].join(", ")}`); process.exit(1); }
  const owned = new Set(backup?.owned || []);

  let inputs;
  if (project) {
    const pr = (backup?.projects || []).find(x => norm(x.name) === norm(project));
    if (!pr) { console.error(`No project "${project}" in the backup. Run: node paints.mjs projects <backup.json>`); process.exit(1); }
    inputs = (pr.items || []).map(id => ({ line: id, hit: byId.has(id) ? { p: byId.get(id), guess: false } : null }));
  } else {
    const lines = inFile ? readFileSync(inFile, "utf8").split(/\r?\n/) : args;
    inputs = lines.map(s => s.trim()).filter(Boolean).map(line => ({ line, hit: resolve(line, pool, from) }));
  }

  const out = inputs.map(({ line, hit }) => {
    if (!hit) return { input: line, from: null, to: null, final: null, flag: "not found" };
    const src = hit.p;
    const r = { input: line, from: short(src), to: null, deltaE: null, guess: hit.guess || undefined, flag: null };
    if (to && src.brand !== to) {
      const same = pool.filter(p => p.brand === to && p.type === src.type);
      if (!same.length) r.flag = `no ${to} ${src.type} paint, kept original`;
      else {
        const best = same.map(p => ({ p, d: deltaE(src.lab, p.lab) })).sort((a, b) => a.d - b.d)[0];
        r.to = short(best.p);
        r.deltaE = Math.round(best.d * 10) / 10;
        if (best.d > WEAK) r.flag = `weak match (deltaE ${r.deltaE})`;
      }
    }
    const fin = r.to || r.from;
    r.final = { ...fin, owned: backup ? owned.has(fin.id) : undefined };
    return r;
  });

  const finals = [...new Map(out.filter(r => r.final).map(r => [r.final.id, r.final])).values()];
  console.log(JSON.stringify({ to: to || null, paints: out, pasteList: finals.map(pasteLine).join("\n") }, null, 2));
  for (const r of out) {
    const left = r.from ? label(r.from) + (r.guess ? " (guessed)" : "") : `"${r.input}"`;
    const right = r.to ? `-> ${label(r.to)}  dE ${r.deltaE}` : "";
    const own = r.final && backup ? (r.final.owned ? "  [owned]" : "  [to buy]") : "";
    console.error(`${left}  ${right}${own}${r.flag ? "  ! " + r.flag : ""}`);
  }
} else {
  console.error("Usage: node paints.mjs projects <backup.json> | match [--to Brand] [--from Brand] [--backup file] [--project name] [--in file] [names...]");
  process.exit(1);
}
