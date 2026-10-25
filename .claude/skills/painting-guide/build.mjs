// Created by Claude (claude-opus-5-5)
// Date: 2026-10-25
//
// Builds a painting guide page from a guide JSON file.
//   node build.mjs <guide.json> <outDir>
// Writes <outDir>/<id>.html (template + store.js + the guide data) and <outDir>/logo/senor_claude.png.
// Phase ids ("step1" ...) and sub-step ids ("1.1", "1.2", "2.1" ...) are assigned here by position and double as image keys.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const TOKENS = ["bg", "surface", "text", "muted", "accent", "line", "accentSoft", "warn", "warnSoft", "onAccent"];
const SLOTS = ["TITLE", "PALETTE", "STORE", "GUIDE"];
const SRCS = ["project", "owned", "need"];
const HEX = /^[0-9A-Fa-f]{6}$/;

const [guidePath, outDir] = process.argv.slice(2);
if (!guidePath || !outDir) { console.error("Usage: node build.mjs <guide.json> <outDir>"); process.exit(1); }
const g = JSON.parse(readFileSync(guidePath, "utf8"));

const errors = [];
const need = (ok, msg) => { if (!ok) errors.push(msg); };
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const str = v => typeof v === "string" && v.trim() !== "";
const optStr = v => v == null || typeof v === "string";
const optSec = v => v == null || (Number.isInteger(v) && v >= 0);
const hex = v => typeof v === "string" && HEX.test(v.replace("#", ""));
const strList = v => v == null || (Array.isArray(v) && v.every(str));

need(/^[a-z0-9-]+$/.test(g.id || ""), "id: lowercase letters, digits and dashes");
need(str(g.title), "title is required");
need(optStr(g.eyebrow), "eyebrow: text");

if (g.source != null) {
  need(isObj(g.source) && str(g.source.credit) && str(g.source.title), "source needs credit and title");
  need(g.source.url == null || /^https?:\/\//i.test(g.source.url), "source.url must start with http:// or https://");
  need(!g.source.timecodes || str(g.source.url), "source.timecodes needs source.url");
  need(optStr(g.source.length), "source.length: text such as 10:29");
}
const timed = !!(g.source && g.source.timecodes);

for (const mode of ["light", "dark"]) for (const t of TOKENS) need(hex(g.palette?.[mode]?.[t]), `palette.${mode}.${t}: 6-digit hex`);

need(isObj(g.paints) && Object.keys(g.paints).length, "paints: at least one paint");
for (const [k, p] of Object.entries(isObj(g.paints) ? g.paints : {})) {
  if (!isObj(p)) { errors.push(`paints.${k}: must be an object`); continue; }
  need(str(p.name) && HEX.test(p.hex || ""), `paints.${k}: name and 6-digit hex without #`);
  need(SRCS.includes(p.src), `paints.${k}.src: ${SRCS.join(", ")}`);
  need(optStr(p.code) && optStr(p.was) && optStr(p.swap), `paints.${k}: code, was and swap are text`);
}

const pl = g.paintList;
need(isObj(pl) && str(pl.summary) && Array.isArray(pl.groups), "paintList needs summary and groups");
const groups = isObj(pl) && Array.isArray(pl.groups) ? pl.groups : [];
groups.forEach((gr, n) => need(isObj(gr) && SRCS.includes(gr.src) && str(gr.title) && str(gr.blurb), `paintList.groups[${n}]: src (${SRCS.join(", ")}), title and blurb`));
for (const [k, p] of Object.entries(isObj(g.paints) ? g.paints : {})) {
  if (isObj(p) && SRCS.includes(p.src)) need(groups.some(gr => isObj(gr) && gr.src === p.src), `paints.${k}: no paintList group has src "${p.src}", so it would be missing from the paint list`);
}

need(Array.isArray(g.steps) && g.steps.length, "steps: at least one phase");
const used = new Set();
(Array.isArray(g.steps) ? g.steps : []).forEach((s, pi) => {
  if (!isObj(s)) { errors.push(`steps[${pi}]: must be an object`); return; }
  s.id = `step${pi + 1}`;
  need(str(s.short) && str(s.title) && str(s.summary), `steps[${pi}]: short, title and summary`);
  need(optSec(s.start) && optSec(s.end), `steps[${pi}]: start and end are whole seconds`);
  need(timed || (s.start == null && s.end == null), `steps[${pi}]: start/end need source.timecodes`);
  need(s.general == null || (Array.isArray(s.general) && s.general.every(t => isObj(t) && str(t.n) && str(t.p) && optSec(t.t))), `steps[${pi}].general: list of {n, p, t?}`);
  need(Array.isArray(s.subs) && s.subs.length, `steps[${pi}]: at least one sub-step`);
  (Array.isArray(s.subs) ? s.subs : []).forEach((x, si) => {
    const id = `${pi + 1}.${si + 1}`;
    if (!isObj(x)) { errors.push(`sub ${id}: must be an object`); return; }
    x.id = id;
    need(str(x.title) && str(x.area) && Array.isArray(x.paints), `sub ${id}: title, area and paints`);
    need(optSec(x.t) && (timed || x.t == null), `sub ${id}: t is whole seconds and needs source.timecodes`);
    need(strList(x.tips), `sub ${id}: tips is a list of text`);
    need(optStr(x.note), `sub ${id}: note is text`);
    (Array.isArray(x.paints) ? x.paints : []).forEach(k => { need(isObj(g.paints) && isObj(g.paints[k]), `sub ${id}: unknown paint "${k}"`); used.add(k); });
  });
});
for (const k of Object.keys(isObj(g.paints) ? g.paints : {})) if (!used.has(k)) console.warn(`warning: paint "${k}" is not used by any sub-step`);
if (errors.length) { console.error(errors.map(e => "error: " + e).join("\n")); process.exit(1); }

const kebab = t => t.replace(/[A-Z]/g, c => "-" + c.toLowerCase());
const vars = mode => TOKENS.map(t => `--${kebab(t)}: #${g.palette[mode][t].replace("#", "")};`).join(" ");
const palette = `:root { ${vars("light")} }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${vars("dark")} color-scheme: dark; } }
:root[data-theme="dark"] { ${vars("dark")} color-scheme: dark; }`;

// The data sits inside <script>, so escape "<" to keep "</script>" in any text from closing it.
const data = JSON.stringify({ ...g, palette: undefined }).replace(/</g, "\\u003c");
const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const template = readFileSync(join(here, "template.html"), "utf8");
for (const s of SLOTS) if (!template.includes(`{{${s}}}`)) { console.error(`error: template.html is missing the {{${s}}} slot`); process.exit(1); }
// One pass, so text inside a filled slot is never treated as another slot.
const fill = { TITLE: esc(g.title), PALETTE: palette, STORE: readFileSync(join(here, "store.js"), "utf8"), GUIDE: data };
const html = template.replace(new RegExp(`\\{\\{(${SLOTS.join("|")})\\}\\}`, "g"), (m, k) => fill[k]);

// Binary assets are in Git LFS; a checkout without them holds a small text pointer instead of the image.
const logo = join(repo, "assets", "logo", "senor_claude.png");
if (readFileSync(logo).subarray(0, 8).toString() === "version ") { console.error("error: assets/logo/senor_claude.png is a Git LFS pointer. Run: git lfs pull"); process.exit(1); }

mkdirSync(join(outDir, "logo"), { recursive: true });
writeFileSync(join(outDir, g.id + ".html"), html);
copyFileSync(logo, join(outDir, "logo", "senor_claude.png"));
const subs = g.steps.reduce((n, s) => n + s.subs.length, 0);
console.log(`Built ${join(outDir, g.id + ".html")}: ${g.steps.length} phases, ${subs} sub-steps, ${Object.keys(g.paints).length} paints`);
