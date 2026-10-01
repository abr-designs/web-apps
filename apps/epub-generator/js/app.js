// Created by Claude (claude-opus-5-5)
// Date: 2026-09-23

'use strict';

const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const OPS_NS = 'http://www.idpf.org/2007/ops';

// ===== Parsers =====

const FRONT_MATTER_KEYS = {
  title: 'title', author: 'author', lang: 'lang', language: 'lang',
  series: 'series', series_index: 'seriesIndex', seriesindex: 'seriesIndex',
};

/**
 * Reads flat `key: value` lines from a leading YAML front matter block.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function splitFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_]+)\s*:\s*(.*)$/.exec(line);
    const key = kv && FRONT_MATTER_KEYS[kv[1].toLowerCase()];
    if (key) meta[key] = kv[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return { meta, body: text.slice(m[0].length) };
}

// EPUB 3 core media types for images.
const IMAGE_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
};

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function imageMediaType(fileName) {
  return IMAGE_TYPES[fileName.split('.').pop().toLowerCase()] || '';
}

/**
 * Joins a base directory and a relative path, collapsing "." and ".." segments.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function resolvePath(baseDir, src) {
  const parts = [];
  for (const seg of `${baseDir}${src}`.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

/**
 * Finds a Markdown image in the pool (full relative path first, then bare filename) and
 * registers it in `images` under a unique, EPUB-safe name. Returns { name } or { warning }.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function embedImage(src, baseDir, imagePool, images) {
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) return { warning: `Skipped remote image: ${src}` };
  let path = src.replace(/[?#].*$/, '');
  try { path = decodeURI(path); } catch { /* keep the raw path */ }
  path = resolvePath(baseDir, path);
  const file = imagePool.byPath.get(path) || imagePool.byName.get(path.split('/').pop().toLowerCase());
  if (!file) return { warning: `Image not found: ${src}` };

  const existing = images.find((img) => img.data === file);
  if (existing) return { name: existing.name };

  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const dot = safe.lastIndexOf('.');
  let name = safe;
  for (let n = 2; images.some((img) => img.name === name); n++) {
    name = `${safe.slice(0, dot)}-${n}${safe.slice(dot)}`;
  }
  images.push({ name, mediaType: imageMediaType(file.name), data: file });
  return { name };
}

// GFM footnotes ([^1]); notes are emitted as a trailing <section data-footnotes> list.
marked.use(markedFootnote());

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
async function parseMarkdown(file, { imagePool }) {
  const { meta, body } = splitFrontMatter(await file.text());
  const doc = new DOMParser().parseFromString(marked.parse(body), 'text/html');
  const baseDir = file.webkitRelativePath.replace(/[^/]*$/, '');
  const images = [];
  const warnings = [];

  for (const img of [...doc.querySelectorAll('img')]) {
    const result = embedImage(img.getAttribute('src') || '', baseDir, imagePool, images);
    if (result.name) {
      // Chapters live in OEBPS/text/, images in OEBPS/images/.
      img.setAttribute('src', `../images/${result.name}`);
    } else {
      warnings.push(result.warning);
      img.replaceWith(img.alt);
    }
  }

  const firstH1 = doc.querySelector('h1');
  meta.title = meta.title || firstH1?.textContent.trim() || file.name.replace(/\.[^.]+$/, '');
  return { html: doc.body.innerHTML, meta, images, warnings };
}

// Case-insensitive. A chapter word must be followed by a number so prose like "Part of me..." is not a heading.
const DEFAULT_CHAPTER_PATTERN = '^(chapter|part|book)\\s+(\\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight'
  + '|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty'
  + '|forty|fifty)\\b|^(prologue|epilogue|introduction|preface|foreword|afterword)\\b';

/**
 * Decodes a text file as UTF-8, falling back to Windows-1252 when the bytes are not valid UTF-8.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
async function readText(file, warnings) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8;
  warnings.push('File is not valid UTF-8; read it as Windows-1252.');
  return new TextDecoder('windows-1252').decode(buf);
}

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function isCapsHeading(line) {
  return line.length <= 60
    && /\p{L}.*\p{L}/u.test(line)
    && line === line.toUpperCase()
    && line !== line.toLowerCase();
}

/**
 * Joins hard-wrapped lines into one escaped paragraph. A line ending in "letter-" joins without a space.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function joinLines(lines) {
  return escapeXml(lines.reduce((acc, line) => {
    if (!acc) return line;
    return /\p{L}-$/u.test(acc) ? acc + line : `${acc} ${line}`;
  }, ''));
}

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
async function parseTxt(file, { chapterRegex }) {
  const warnings = [];
  const text = (await readText(file, warnings)).replace(/\r\n?/g, '\n');
  const nonEmpty = text.split('\n').filter((l) => l.trim());

  // Hard-wrapped text keeps lines short. When many lines are long, each line is its own paragraph.
  const unwrapped = nonEmpty.filter((l) => l.length > 100).length >= nonEmpty.length * 0.1;
  const blocks = unwrapped
    ? nonEmpty.map((l) => [l.trim()])
    : text.split(/\n\s*\n/)
      .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
      .filter((b) => b.length);

  const html = [];
  for (const block of blocks) {
    const first = block[0];
    if (first.length <= 60 && chapterRegex.test(first)) {
      // "Chapter 1" followed by one short line reads as a subtitle: "Chapter 1: The Storm".
      const subtitle = block.length === 2 && block[1].length <= 60 ? block[1] : '';
      const heading = subtitle ? `${first}${/[.:!?]$/.test(first) ? ' ' : ': '}${subtitle}` : first;
      html.push(`<h1>${escapeXml(heading)}</h1>`);
      if (!subtitle && block.length > 1) html.push(`<p>${joinLines(block.slice(1))}</p>`);
    } else if (block.length === 1 && isCapsHeading(first)) {
      html.push(`<h1>${escapeXml(first)}</h1>`);
    } else {
      html.push(`<p>${joinLines(block)}</p>`);
    }
  }

  return {
    html: html.join('\n'),
    meta: { title: file.name.replace(/\.[^.]+$/, '') },
    images: [],
    warnings,
  };
}

const DC_NS = 'http://purl.org/dc/elements/1.1/';

/**
 * Reads title, author and language from the DOCX core properties (docProps/core.xml).
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
async function readDocxMeta(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('docProps/core.xml')?.async('string');
  if (!xml) return {};
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const read = (tag) => doc.getElementsByTagNameNS(DC_NS, tag)[0]?.textContent.trim() || '';
  const meta = {};
  if (read('title')) meta.title = read('title');
  if (read('creator')) meta.author = read('creator');
  if (read('language')) meta.lang = read('language');
  return meta;
}

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
async function parseDocx(file, { chapterRegex }) {
  const buffer = await file.arrayBuffer();
  const images = [];
  const warnings = [];
  const extByType = Object.fromEntries(Object.entries(IMAGE_TYPES).map(([ext, type]) => [type, ext]));

  const convertImage = mammoth.images.imgElement(async (image) => {
    const ext = extByType[image.contentType];
    // Word also embeds formats EPUB readers cannot show (EMF, WMF, TIFF); those are dropped below.
    if (!ext) return { src: `unsupported:${image.contentType}` };
    const name = `image${images.length + 1}.${ext}`;
    images.push({ name, mediaType: image.contentType, data: await image.readAsArrayBuffer() });
    return { src: `../images/${name}` };
  });
  let result;
  try {
    result = await mammoth.convertToHtml({ arrayBuffer: buffer }, { convertImage });
  } catch (err) {
    console.error(err);
    // Mammoth's errors for damaged files are zip internals ("end of central directory").
    throw new Error('not a valid Word (.docx) file. It may be damaged, or an older .doc file renamed.');
  }
  // Mammoth also flags browser-unfriendly images; the skip warning below already covers those.
  warnings.push(...new Set(result.messages.map((m) => m.message)
    .filter((m) => !m.includes('unlikely to display in web browsers'))));

  const doc = new DOMParser().parseFromString(result.value, 'text/html');
  for (const img of [...doc.querySelectorAll('img[src^="unsupported:"]')]) {
    warnings.push(`Skipped image in unsupported format: ${img.getAttribute('src').slice(12)}`);
    img.replaceWith(img.alt);
  }

  if (!doc.querySelector('h1, h2, h3')) {
    let found = 0;
    for (const p of [...doc.body.querySelectorAll(':scope > p')]) {
      const text = p.textContent.trim();
      if (text.length > 60 || !chapterRegex.test(text)) continue;
      const h1 = doc.createElement('h1');
      h1.append(...p.childNodes);
      p.replaceWith(h1);
      found++;
    }
    if (found) warnings.push('No Word heading styles found; chapters detected by pattern.');
  }

  const meta = await readDocxMeta(buffer);
  meta.title = meta.title || file.name.replace(/\.[^.]+$/, '');
  return { html: doc.body.innerHTML, meta, images, warnings };
}

// Strategy map: file extension -> parser(file, { imagePool, chapterRegex }).
const PARSERS = { md: parseMarkdown, markdown: parseMarkdown, txt: parseTxt, docx: parseDocx };

// ===== BookBuilder =====

const HEADING_RE = /^H([1-6])$/;

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function headingLevel(node) {
  const m = node.nodeType === Node.ELEMENT_NODE && HEADING_RE.exec(node.tagName);
  return m ? Number(m[1]) : 0;
}

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function hasContent(nodes) {
  return nodes.some((n) => n.textContent.trim()
    || (n.nodeType === Node.ELEMENT_NODE && (n.tagName === 'IMG' || n.querySelector('img'))));
}

/**
 * Nests headings by level into TOC entries: [{ title, href, level, children }].
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function nestHeadings(headings, fileName) {
  const root = { level: 0, children: [] };
  const stack = [root];
  for (const h of headings) {
    const level = headingLevel(h);
    while (stack[stack.length - 1].level >= level) stack.pop();
    const entry = { title: h.textContent.trim(), href: `${fileName}#${h.id}`, level, children: [] };
    stack[stack.length - 1].children.push(entry);
    stack.push(entry);
  }
  return root.children;
}

/**
 * Removes the note list that marked-footnote (<section data-footnotes>) or mammoth
 * (a top-level <ol> of li#footnote-N / li#endnote-N) appends, and returns a Map of note id -> li.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function extractNotes(body) {
  const notes = new Map();
  for (const el of [...body.children]) {
    let items = null;
    if (el.matches('section[data-footnotes]')) items = [...el.querySelectorAll('li[id]')];
    else if (el.tagName === 'OL' && el.children.length
      && [...el.children].every((li) => /^(footnote|endnote)-/.test(li.id))) items = [...el.children];
    if (!items) continue;
    for (const li of items) notes.set(li.id, li);
    el.remove();
  }
  return notes;
}

/**
 * Turns a note list item into <aside data-footnote> (epub:type is set when writing XHTML).
 * The parser's own back-links are replaced by the note number linking back to `ref`.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function buildNoteAside(li, ref) {
  const aside = li.ownerDocument.createElement('aside');
  aside.id = li.id;
  aside.setAttribute('data-footnote', '');
  li.querySelectorAll('a[data-footnote-backref], a[href^="#footnote-ref-"], a[href^="#endnote-ref-"]')
    .forEach((a) => a.remove());
  aside.append(...li.childNodes);
  if (ref) {
    const back = li.ownerDocument.createElement('a');
    back.href = `#${ref.id}`;
    back.textContent = ref.textContent.replace(/[[\]]/g, '');
    const first = aside.firstElementChild?.tagName === 'P' ? aside.firstElementChild : aside;
    first.prepend(back, '. ');
  }
  return aside;
}

/**
 * Prepares tables for small screens. 'stack' turns each row into a block: the first cell as a
 * bold line, then one "Header: value" line per other cell. 'grid' keeps the table as is.
 * Both move the obsolete align attribute into CSS.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function layoutTables(body, mode) {
  for (const cell of body.querySelectorAll('th[align], td[align]')) {
    cell.style.textAlign = cell.getAttribute('align');
    cell.removeAttribute('align');
  }
  if (mode !== 'stack') return;
  const doc = body.ownerDocument;
  // Innermost tables first, so a nested table is stacked before its parent moves its cells.
  for (const table of [...body.querySelectorAll('table')].reverse()) {
    const rows = [...table.rows];
    const headRow = rows.length && [...rows[0].cells].every((c) => c.tagName === 'TH') ? rows.shift() : null;
    const labels = headRow ? [...headRow.cells].map((c) => c.textContent.trim()) : [];
    const stack = doc.createElement('div');
    stack.className = 'table-stack';
    if (table.caption) {
      const caption = doc.createElement('div');
      caption.className = 'table-caption';
      caption.append(...table.caption.childNodes);
      stack.append(caption);
    }
    for (const row of rows) {
      const block = doc.createElement('div');
      block.className = 'table-row';
      [...row.cells].forEach((cell, i) => {
        if (i && !cell.textContent.trim() && !cell.querySelector('img')) return;
        const line = doc.createElement('div');
        line.className = i ? 'table-field' : 'table-title';
        if (i && labels[i]) {
          const label = doc.createElement('b');
          label.textContent = `${labels[i]}: `;
          line.append(label);
        }
        line.append(...cell.childNodes);
        block.append(line);
      });
      stack.append(block);
    }
    table.replaceWith(stack);
  }
}

/**
 * Splits book.parsed.html into chapters at the split heading level, applying book.renames.
 * Footnotes move to an aside at the end of the first chapter that references them.
 * Fills book.chapters and book.warnings.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function buildBook(book) {
  const body = new DOMParser().parseFromString(book.parsed.html, 'text/html').body;
  const warnings = [...book.parsed.warnings];
  layoutTables(body, book.opts.tables);
  const notes = extractNotes(body);
  const notePlaced = new Map(); // note id -> chapter file (relative to text/) holding its aside

  let n = 0;
  for (const h of body.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!h.id) h.id = `h${++n}`;
  }

  let level = book.opts.splitLevel;
  if (level === 'auto') level = body.querySelectorAll('h1').length > 1 ? 1 : 2;
  if (level !== 'none' && !body.querySelector(`h${level}`)) {
    warnings.push(body.querySelector('h1, h2, h3, h4, h5, h6')
      ? `No H${level} headings found; the book is a single chapter.`
      : 'No headings found; the book is a single chapter.');
  }

  // Group top-level nodes; each top-level split heading starts a new group.
  const groups = [[]];
  for (const node of [...body.childNodes]) {
    if (level !== 'none' && headingLevel(node) === level) groups.push([]);
    groups[groups.length - 1].push(node);
  }
  // Keep one group even for an empty document, so the EPUB always has a spine item.
  if (!hasContent(groups[0]) && groups.length > 1) groups.shift();

  book.chapters = groups.map((nodes, i) => {
    const fileName = `text/ch${String(i + 1).padStart(3, '0')}.xhtml`;
    const first = nodes.find((x) => x.nodeType === Node.ELEMENT_NODE);
    const titleEl = first && headingLevel(first) ? first : null;
    const originalTitle = titleEl ? titleEl.textContent.trim() : book.meta.title;
    const title = book.renames[originalTitle] || originalTitle;
    // A leading title-only page (e.g. a lone H1 before H2 chapters) is intentional, not empty.
    const isLead = i === 0 && (!titleEl || headingLevel(titleEl) !== level);
    if (!isLead && !hasContent(titleEl ? nodes.filter((x) => x !== titleEl) : nodes)) {
      warnings.push(`Chapter "${title}" is empty.`);
    }
    const subHeadings = nodes.flatMap((x) => {
      if (x === titleEl || x.nodeType !== Node.ELEMENT_NODE) return [];
      return headingLevel(x) ? [x] : [...x.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    });
    const toc = nestHeadings(subHeadings, fileName);

    const refs = nodes
      .flatMap((x) => (x.nodeType === Node.ELEMENT_NODE ? [...x.querySelectorAll('a[href^="#"]')] : []))
      .filter((a) => notes.has(a.getAttribute('href').slice(1)));
    for (const ref of refs) {
      const id = ref.getAttribute('href').slice(1);
      ref.removeAttribute('aria-describedby'); // pointed at the removed "Footnotes" heading
      ref.removeAttribute('data-footnote-ref');
      ref.setAttribute('data-noteref', '');
      if (!ref.id) ref.id = `ref-${id}`;
      if (notePlaced.has(id)) {
        ref.setAttribute('href', `${notePlaced.get(id)}#${id}`);
      } else {
        notePlaced.set(id, fileName.slice('text/'.length));
        nodes.push(buildNoteAside(notes.get(id), ref));
      }
    }

    return { title, originalTitle, fileName, nodes, headingEl: titleEl, toc };
  });

  const lastNodes = book.chapters[book.chapters.length - 1].nodes;
  for (const [id, li] of notes) {
    if (notePlaced.has(id)) continue;
    warnings.push(`Footnote "${id}" is never referenced; it was added to the end of the book.`);
    lastNodes.push(buildNoteAside(li, null));
  }

  book.warnings = warnings;
}

// ===== CoverGenerator =====

/**
 * Word-wraps text to maxWidth using the context's current font.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Draws a plain 1600x2400 title/author cover and returns it as a JPEG blob.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function generateCover(meta) {
  const W = 1600;
  const H = 2400;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f3e46';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f4efe6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Shrink the title until it fits in five lines.
  let size = 150;
  let lines;
  do {
    ctx.font = `bold ${size}px Georgia, serif`;
    lines = wrapText(ctx, meta.title || 'Untitled', W - 240);
    size -= 10;
  } while (lines.length > 5 && size > 60);
  const lineHeight = size * 1.25;
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 560 + i * lineHeight, W - 240));

  ctx.fillRect(W / 2 - 160, 560 + lines.length * lineHeight + 60, 320, 6);

  if (meta.author) {
    ctx.font = '80px Georgia, serif';
    ctx.fillText(meta.author, W / 2, H - 480, W - 240);
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

// ===== Kepubifier =====
// Ports kepubify's content transform (github.com/pgaskin/kepubify, kepub/transform.go).

// kepubify's sentence rule: text up to . ! or ?, an optional closing quote, then whitespace.
// Go's \s is ASCII-only, so the whitespace class is spelled out.
const KOBO_SENTENCE_RE = /[^]*?[.!?]['"”’“…]?[\t\n\f\r ]+/g;
const KOBO_SKIP = new Set(['script', 'style', 'pre', 'audio', 'video', 'svg', 'math']);
const KOBO_PARA = new Set(['p', 'ol', 'ul', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const KOBO_STYLE = 'div#book-inner { margin-top: 0; margin-bottom: 0;}';

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function splitSentences(text) {
  const sentences = text.match(KOBO_SENTENCE_RE) || [];
  const rest = text.slice(sentences.join('').length);
  if (rest || !sentences.length) sentences.push(rest);
  return sentences;
}

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function koboSpan(doc, state) {
  const span = doc.createElementNS(XHTML_NS, 'span');
  span.setAttribute('class', 'koboSpan');
  span.setAttribute('id', `kobo.${state.para}.${++state.seg}`);
  return span;
}

/**
 * Wraps each sentence and image under `el` in span.koboSpan#kobo.{para}.{seg}, depth first.
 * The paragraph number advances at the first span inside each p, list, table or heading.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function addKoboSpans(el, state) {
  const doc = el.ownerDocument;
  for (const node of [...el.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const sentence of splitSentences(node.data)) {
        // Whitespace is only wrapped directly under a <p>.
        if (!sentence.trim() && el.localName !== 'p') {
          el.insertBefore(doc.createTextNode(sentence), node);
          continue;
        }
        if (state.incParaNext) {
          state.para++;
          state.seg = 0;
          state.incParaNext = false;
        }
        const span = koboSpan(doc, state);
        span.textContent = sentence;
        el.insertBefore(span, node);
      }
      node.remove();
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.localName;
      if (tag === 'img') {
        state.para++;
        state.seg = 0;
        state.incParaNext = false;
        const span = koboSpan(doc, state);
        node.replaceWith(span);
        span.append(node);
      } else if (!KOBO_SKIP.has(tag)) {
        if (KOBO_PARA.has(tag)) state.incParaNext = true;
        addKoboSpans(node, state);
      }
    }
  }
}

/**
 * Applies kepubify's mandatory changes to a chapter: Kobo style tweak,
 * div#book-columns > div#book-inner wrappers, then koboSpans.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function kepubifyChapter(head, body) {
  const doc = body.ownerDocument;
  const style = doc.createElementNS(XHTML_NS, 'style');
  style.setAttribute('type', 'text/css');
  style.setAttribute('class', 'kobostylehacks');
  style.textContent = KOBO_STYLE;
  head.append(style);

  const inner = doc.createElementNS(XHTML_NS, 'div');
  inner.setAttribute('id', 'book-inner');
  inner.append(...body.childNodes);
  const columns = doc.createElementNS(XHTML_NS, 'div');
  columns.setAttribute('id', 'book-columns');
  columns.append(inner);
  body.append(columns);

  addKoboSpans(body, { para: 0, seg: 0, incParaNext: false });
}

// ===== EpubWriter =====

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function uuid() {
  // getRandomValues works on file://, where crypto.randomUUID may not.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Builds a well-formed XHTML chapter document from HTML body nodes.
 * When renamedHeading is given, its copy shows the chapter title instead of the original text.
 * With asKepub, the chapter gets kepubify's Kobo markup.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function buildChapterXhtml(title, lang, nodes, renamedHeading, asKepub) {
  const doc = document.implementation.createDocument(XHTML_NS, 'html', null);
  const root = doc.documentElement;
  root.setAttribute('lang', lang);
  root.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:lang', lang);
  root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:epub', OPS_NS);

  const head = doc.createElementNS(XHTML_NS, 'head');
  const titleEl = doc.createElementNS(XHTML_NS, 'title');
  titleEl.textContent = title;
  const link = doc.createElementNS(XHTML_NS, 'link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('type', 'text/css');
  link.setAttribute('href', '../style.css');
  head.append(titleEl, link);

  const body = doc.createElementNS(XHTML_NS, 'body');
  for (const node of nodes) {
    const copy = doc.importNode(node, true);
    if (node === renamedHeading) copy.textContent = title;
    body.appendChild(copy);
  }
  root.append(head, body);

  // buildBook marks notes with data attributes; epub:type needs a real namespace on an XML document.
  for (const [attr, type] of [['data-noteref', 'noteref'], ['data-footnote', 'footnote']]) {
    for (const el of body.querySelectorAll(`[${attr}]`)) {
      el.removeAttribute(attr);
      el.setAttributeNS(OPS_NS, 'epub:type', type);
    }
  }
  if (asKepub) kepubifyChapter(head, body);

  return '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n'
    + new XMLSerializer().serializeToString(doc);
}

const CONTAINER_XML = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const BOOK_CSS = `p { margin: 0; text-indent: 1.5em; }
h1 + p, h2 + p, h3 + p, h4 + p, h5 + p, h6 + p { text-indent: 0; }
h1, h2, h3, h4, h5, h6 { margin: 1.5em 0 0.75em; page-break-after: avoid; }
img { max-width: 100%; height: auto; }
pre { white-space: pre-wrap; }
blockquote { margin: 1em 1.5em; }
aside { margin-top: 1em; font-size: 0.9em; }
aside p { text-indent: 0; }
table { border-collapse: collapse; margin: 1em 0; font-size: 0.85em; }
th, td { border: 1px solid; padding: 0.2em 0.4em; vertical-align: top; }
th p, td p, .table-stack p { text-indent: 0; }
.table-caption, .table-title { font-weight: bold; }
.table-row { margin: 1em 0; }
.table-field { margin-left: 1em; }
`;

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function navList(entries, indent) {
  const items = entries.map((e) => {
    const sub = e.children.length ? `\n${navList(e.children, indent + '    ')}\n${indent}  ` : '';
    return `${indent}  <li><a href="${escapeXml(e.href)}">${escapeXml(e.title)}</a>${sub}</li>`;
  });
  return `${indent}<ol>\n${items.join('\n')}\n${indent}</ol>`;
}

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function ncxPoints(entries, indent, counter) {
  return entries.map((e) => {
    const order = ++counter.n;
    const sub = e.children.length ? `\n${ncxPoints(e.children, indent + '  ', counter)}` : '';
    return `${indent}<navPoint id="np${order}" playOrder="${order}">
${indent}  <navLabel><text>${escapeXml(e.title)}</text></navLabel>
${indent}  <content src="${escapeXml(e.href)}"/>${sub}
${indent}</navPoint>`;
  }).join('\n');
}

/**
 * Serialises a built book into an EPUB 3 zip with an EPUB 2 NCX fallback,
 * with Kobo markup in every chapter when asKepub is set.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
async function writeEpub(book, asKepub) {
  const { title, author, series, seriesIndex, uuid: id } = book.meta;
  // BCP 47 tags only use letters, digits and hyphens; stripping the rest keeps them XML-safe.
  const lang = (book.meta.lang || '').replace(/[^A-Za-z0-9-]/g, '') || 'en';
  const t = escapeXml(title);
  const toc = book.chapters.map((c) => ({ title: c.title, href: c.fileName, children: c.toc }));
  const extraMeta = [];
  if (author) extraMeta.push(`<dc:creator id="creator">${escapeXml(author)}</dc:creator>`);
  if (series) {
    const s = escapeXml(series);
    extraMeta.push(
      `<meta property="belongs-to-collection" id="series">${s}</meta>`,
      '<meta refines="#series" property="collection-type">series</meta>',
      `<meta name="calibre:series" content="${s}"/>`,
    );
    if (seriesIndex) {
      const idx = escapeXml(seriesIndex);
      extraMeta.push(
        `<meta refines="#series" property="group-position">${idx}</meta>`,
        `<meta name="calibre:series_index" content="${idx}"/>`,
      );
    }
  }
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const chapterId = (i) => `ch${String(i + 1).padStart(3, '0')}`;
  const manifestItems = book.chapters
    .map((c, i) => `    <item id="${chapterId(i)}" href="${c.fileName}" media-type="application/xhtml+xml"/>`)
    .join('\n');
  const spineItems = book.chapters.map((c, i) => `    <itemref idref="${chapterId(i)}"/>`).join('\n');
  const imageItems = book.parsed.images
    .map((img, i) => `    <item id="img${i + 1}" href="images/${escapeXml(img.name)}" media-type="${img.mediaType}"/>`)
    .join('\n');
  const cover = book.cover || await generateCover(book.meta);
  const coverFile = cover.type === 'image/png' ? 'cover.png' : 'cover.jpg';
  extraMeta.push('<meta name="cover" content="cover-img"/>');

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:${id}</dc:identifier>
    <dc:title>${t}</dc:title>
    <dc:language>${lang}</dc:language>
${extraMeta.map((line) => `    ${line}`).join('\n')}
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="cover-img" href="${coverFile}" media-type="${cover.type}" properties="cover-image"/>
${manifestItems}${imageItems ? `\n${imageItems}` : ''}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;

  const nav = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}">
<head><title>${t}</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
${navList(toc, '    ')}
  </nav>
</body>
</html>`;

  const ncx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:${id}"/></head>
  <docTitle><text>${t}</text></docTitle>
  <navMap>
${ncxPoints(toc, '    ', { n: 0 })}
  </navMap>
</ncx>`;

  const zip = new JSZip();
  // mimetype must be the first entry and stored uncompressed.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', CONTAINER_XML);
  zip.file('OEBPS/content.opf', opf);
  zip.file('OEBPS/nav.xhtml', nav);
  zip.file('OEBPS/toc.ncx', ncx);
  zip.file('OEBPS/style.css', BOOK_CSS);
  zip.file(`OEBPS/${coverFile}`, cover);
  for (const img of book.parsed.images) zip.file(`OEBPS/images/${img.name}`, img.data);
  for (const c of book.chapters) {
    const renamed = c.title !== c.originalTitle ? c.headingEl : null;
    zip.file(`OEBPS/${c.fileName}`, buildChapterXhtml(c.title, lang, c.nodes, renamed, asKepub));
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
  });
}

// ===== Downloader =====

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function safeFilename(title) {
  return title.replace(/[\\/:*?"<>|]/g, '').trim() || 'book';
}

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== App =====

const books = [];
// Dropped images, shared by all books. The latest file wins on a repeated path or name.
const imagePool = { byPath: new Map(), byName: new Map() };
const bookList = document.getElementById('book-list');
const rowTemplate = document.getElementById('book-row');
const pageStatus = document.getElementById('status');
const META_FIELDS = ['title', 'author', 'lang', 'series', 'seriesIndex'];
const STATUS_LABELS = { parsing: 'Parsing...', ready: 'Ready', writing: 'Building EPUB...' };
const kepubAll = document.getElementById('kepub-all');
const downloadAllButton = document.getElementById('download-all');
const regexInput = document.getElementById('chapter-regex');
const regexError = document.getElementById('regex-error');
// Shared context handed to every parser.
const parseContext = { imagePool, chapterRegex: new RegExp(DEFAULT_CHAPTER_PATTERN, 'i') };

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function parserFor(fileName) {
  return PARSERS[fileName.split('.').pop().toLowerCase()];
}

/**
 * Creates a book for one dropped document, parses and builds it, and renders its row.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
async function addBook(file) {
  const book = {
    sourceName: file.name,
    file,
    parser: parserFor(file.name),
    parsed: null,
    meta: { title: '', author: '', lang: 'en', series: '', seriesIndex: '', uuid: uuid() },
    opts: { splitLevel: 'auto', kepub: null, tables: 'stack' }, // kepub null follows the page checkbox
    renames: {},
    cover: null,
    chapters: [],
    warnings: [],
    status: 'parsing',
    error: '',
    row: null,
  };
  books.push(book);
  renderBookRow(book);
  try {
    book.parsed = await book.parser(file, parseContext);
    Object.assign(book.meta, book.parsed.meta);
    buildBook(book);
    book.status = 'ready';
  } catch (err) {
    book.status = 'failed';
    book.error = err.message;
    console.error(err);
  }
  renderBookRow(book);
}

/**
 * Renders (or replaces) the whole row for a book: metadata form, split level, then the chapter area.
 * Text inputs only write into book.meta so typing never re-renders and loses focus.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function renderBookRow(book) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector('.source').textContent = book.sourceName;

  for (const field of META_FIELDS) {
    const input = row.querySelector(`[name="${field}"]`);
    input.value = book.meta[field];
    input.addEventListener('input', () => { book.meta[field] = input.value; });
  }

  const split = row.querySelector('[name="splitLevel"]');
  split.value = String(book.opts.splitLevel);
  split.addEventListener('change', () => {
    book.opts.splitLevel = /^\d$/.test(split.value) ? Number(split.value) : split.value;
    buildBook(book);
    renderChapters(book);
  });

  const tables = row.querySelector('[name="tables"]');
  tables.value = book.opts.tables;
  tables.addEventListener('change', () => {
    book.opts.tables = tables.value;
    buildBook(book);
    renderChapters(book);
  });

  const format = row.querySelector('[name="format"]');
  format.value = book.opts.kepub === null ? '' : (book.opts.kepub ? 'kepub' : 'epub');
  format.addEventListener('change', () => {
    book.opts.kepub = format.value ? format.value === 'kepub' : null;
    renderChapters(book);
  });

  const coverInput = row.querySelector('[name="cover"]');
  coverInput.addEventListener('change', () => {
    const file = coverInput.files[0];
    coverInput.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      pageStatus.textContent = `Cover must be a JPEG or PNG image: ${file.name}`;
      return;
    }
    book.cover = file;
    renderCover(book);
  });
  row.querySelector('.cover-clear').addEventListener('click', () => {
    book.cover = null;
    renderCover(book);
  });

  row.querySelector('.download').addEventListener('click', () => onDownload(book));
  const remove = row.querySelector('.remove');
  remove.setAttribute('aria-label', `Remove ${book.sourceName}`);
  remove.addEventListener('click', () => removeBook(book));

  if (book.row) book.row.replaceWith(row);
  else bookList.append(row);
  book.row = row;
  renderCover(book);
  renderChapters(book);
}

/**
 * Shows the uploaded cover thumbnail, or a note that the cover will be generated.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function renderCover(book) {
  const preview = book.row.querySelector('.cover-preview');
  if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
  preview.hidden = !book.cover;
  if (book.cover) preview.src = URL.createObjectURL(book.cover);
  else preview.removeAttribute('src');
  book.row.querySelector('.cover-note').hidden = !!book.cover;
  book.row.querySelector('.cover-clear').hidden = !book.cover;
}

/**
 * Redraws the status, chapter list and warnings of a book's row.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function renderChapters(book) {
  const row = book.row;
  const fieldset = row.querySelector('fieldset');
  fieldset.disabled = book.status === 'parsing'
    || book.status === 'writing'
    || !book.parsed;
  // A file that could not be read has nothing to edit; only the error and Remove stay visible.
  fieldset.hidden = book.status === 'failed' && !book.parsed;
  row.querySelector('.remove').disabled = book.status === 'writing';

  const status = row.querySelector('.status');
  status.textContent = book.status === 'failed'
    ? `${book.parsed ? 'Download failed' : 'Could not read this file'}: ${book.error}`
    : STATUS_LABELS[book.status];
  status.dataset.status = book.status;

  const defaultFormat = row.querySelector('[name="format"] option[value=""]');
  defaultFormat.textContent = `Default (${kepubAll.checked ? 'KEPUB' : 'EPUB'})`;
  row.querySelector('.download').textContent = `Download ${isKepub(book) ? 'KEPUB' : 'EPUB'}`;

  row.querySelector('.chapter-count').textContent = `(${book.chapters.length})`;
  row.querySelector('.chapters').replaceChildren(...book.chapters.map((c) => {
    const input = document.createElement('input');
    input.value = c.title;
    input.placeholder = c.originalTitle;
    input.setAttribute('aria-label', `Chapter title, originally "${c.originalTitle}"`);
    // 'change' fires on blur or Enter, so a rename is committed once rather than per keystroke.
    input.addEventListener('change', () => {
      const value = input.value.trim();
      if (value && value !== c.originalTitle) book.renames[c.originalTitle] = value;
      else delete book.renames[c.originalTitle];
      c.title = value || c.originalTitle;
      input.value = c.title;
    });
    const li = document.createElement('li');
    li.append(input);
    return li;
  }));

  const warnings = row.querySelector('.warnings');
  warnings.replaceChildren(...book.warnings.map((w) => {
    const li = document.createElement('li');
    li.textContent = w;
    return li;
  }));
  warnings.hidden = !book.warnings.length;
  renderDownloadAll();
}

/**
 * Shows "Download all (N)" for the books that parsed, disabled while any book is busy.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function renderDownloadAll() {
  const count = books.filter((b) => b.parsed).length;
  downloadAllButton.hidden = count < 2;
  downloadAllButton.disabled = books.some((b) => b.status === 'parsing' || b.status === 'writing');
  downloadAllButton.textContent = `Download all (${count})`;
}

/**
 * Downloads every parsed book in turn. Awaiting each one keeps the browser's downloads in order.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
async function onDownloadAll() {
  for (const book of books.filter((b) => b.parsed)) {
    // Skip books removed while earlier ones were downloading.
    if (books.includes(book)) await onDownload(book);
  }
}

/**
 * Drops a book from the list and frees its cover preview.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function removeBook(book) {
  books.splice(books.indexOf(book), 1);
  const preview = book.row.querySelector('.cover-preview');
  if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
  book.row.remove();
  renderDownloadAll();
}

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
function isKepub(book) {
  return book.opts.kepub ?? kepubAll.checked;
}

/** @created Claude (claude-opus-5-5) - 2026-09-23 */
async function onDownload(book) {
  if (!book.meta.title.trim()) {
    book.meta.title = book.sourceName.replace(/\.[^.]+$/, '');
    book.row.querySelector('[name="title"]').value = book.meta.title;
  }
  book.status = 'writing';
  renderChapters(book);
  try {
    const asKepub = isKepub(book);
    const blob = await writeEpub(book, asKepub);
    download(blob, `${safeFilename(book.meta.title)}${asKepub ? '.kepub.epub' : '.epub'}`);
    book.status = 'ready';
  } catch (err) {
    book.status = 'failed';
    book.error = err.message;
    console.error(err);
  }
  renderChapters(book);
}

/**
 * Re-parses books whose parser uses the chapter pattern, keeping metadata edits and renames.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
async function reparsePatternBooks() {
  // Copy: a book removed mid-loop must not shift the ones after it.
  for (const book of [...books]) {
    if ((book.parser !== parseTxt && book.parser !== parseDocx) || !book.parsed) continue;
    book.status = 'parsing';
    renderChapters(book);
    try {
      book.parsed = await book.parser(book.file, parseContext);
      buildBook(book);
      book.status = 'ready';
    } catch (err) {
      book.status = 'failed';
      book.error = err.message;
      console.error(err);
    }
    renderChapters(book);
  }
}

/**
 * Adds dropped images to the pool first, then creates a book per document,
 * so image order within one drop does not matter.
 * @created Claude (claude-opus-5-5) - 2026-09-23
 */
function intake(files) {
  const docs = [];
  const skipped = [];
  let imageCount = 0;
  for (const file of files) {
    if (imageMediaType(file.name)) {
      imagePool.byPath.set(file.webkitRelativePath || file.name, file);
      imagePool.byName.set(file.name.toLowerCase(), file);
      imageCount++;
    } else if (parserFor(file.name)) {
      docs.push(file);
    } else {
      skipped.push(file.name);
    }
  }
  docs.forEach(addBook);

  const messages = [];
  if (imageCount) messages.push(`Added ${imageCount} image${imageCount === 1 ? '' : 's'}.`);
  if (skipped.length) {
    const more = skipped.length > 5 ? ` and ${skipped.length - 5} more` : '';
    messages.push(`Skipped unsupported files: ${skipped.slice(0, 5).join(', ')}${more}.`);
  }
  pageStatus.textContent = messages.join(' ');
}

regexInput.value = DEFAULT_CHAPTER_PATTERN;
// 'change' fires on blur or Enter, so books are re-parsed once per edit, not per keystroke.
downloadAllButton.addEventListener('click', onDownloadAll);

kepubAll.addEventListener('change', () => {
  for (const book of books) renderChapters(book);
});

regexInput.addEventListener('change', () => {
  try {
    parseContext.chapterRegex = new RegExp(regexInput.value || DEFAULT_CHAPTER_PATTERN, 'i');
  } catch (err) {
    regexError.textContent = `Invalid pattern, still using the previous one: ${err.message}`;
    regexError.hidden = false;
    return;
  }
  regexError.hidden = true;
  if (!regexInput.value) regexInput.value = DEFAULT_CHAPTER_PATTERN;
  reparsePatternBooks();
});

const dropZone = document.getElementById('drop-zone');

for (const input of [document.getElementById('file-input'), document.getElementById('folder-input')]) {
  input.addEventListener('change', () => {
    intake([...input.files]);
    input.value = '';
  });
}
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('over');
  intake([...e.dataTransfer.files]);
});
