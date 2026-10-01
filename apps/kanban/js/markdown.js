// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30

// Markdown to DOM for task descriptions and comments. Builds nodes with el() and text
// nodes only, so HTML in the source shows as text. Links allow http(s) and mailto.
window.Kanban = window.Kanban || {};

(function (K) {
  'use strict';

  const { el } = K.util;

  // ---------- Code highlighting ----------

  const kw = (s) => new Set(s.split(' '));
  const LINE = { slash: '//[^\\n]*', hash: '#[^\\n]*', dash: '--[^\\n]*' };
  const BLOCK = { c: '/\\*[\\s\\S]*?(?:\\*/|$)', html: '<!--[\\s\\S]*?(?:-->|$)' };

  const FAMILIES = {
    js: { com: [LINE.slash, BLOCK.c], tpl: true, kw: kw('async await break case catch class const continue default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of private protected public readonly return static super switch this throw true try type typeof undefined var void while yield') },
    cs: { com: [LINE.slash, BLOCK.c], kw: kw('abstract as async await base bool boolean break byte case catch char class const continue decimal default do double else enum event extends false final finally float for foreach get if implements import in int interface internal is long namespace new null object out override package private protected public readonly ref return sealed set short static string struct switch this throw true try typeof uint using var virtual void while') },
    c: { com: [LINE.slash, BLOCK.c], kw: kw('auto break case chan char class const continue default defer define do double else enum extern false fn float for func go goto if impl import include int let long loop map match mod mut namespace nil null package pub range return self Self short signed sizeof static struct switch template trait true type typedef typename union unsigned use var virtual void while') },
    py: { com: [LINE.hash], triple: true, kw: kw('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return self True try while with yield') },
    sh: { com: [LINE.hash], kw: kw('case do done echo elif else esac exit export false fi for foreach function if in local null param return then true while') },
    sql: { com: [LINE.dash, BLOCK.c], ci: true, kw: kw('and as by create delete drop from group having in inner insert into is join key left limit not null on or order outer primary right select set table update values where') },
    lua: { com: [LINE.dash], kw: kw('and break do else elseif end false for function if in local nil not or repeat return then true until while') },
    css: { com: [BLOCK.c], kw: kw('') },
    html: { com: [BLOCK.html], kw: kw('') },
    data: { com: [LINE.hash], kw: kw('true false null yes no') },
    other: { com: [LINE.slash, LINE.hash, BLOCK.c], kw: kw('') },
  };

  const ALIASES = {
    js: 'js', javascript: 'js', jsx: 'js', mjs: 'js', ts: 'js', typescript: 'js', tsx: 'js',
    cs: 'cs', csharp: 'cs', 'c#': 'cs', java: 'cs', kotlin: 'cs',
    c: 'c', h: 'c', cpp: 'c', 'c++': 'c', hpp: 'c', go: 'c', rust: 'c', rs: 'c',
    py: 'py', python: 'py',
    sh: 'sh', bash: 'sh', zsh: 'sh', shell: 'sh', console: 'sh', ps1: 'sh', powershell: 'sh', pwsh: 'sh', ps: 'sh',
    sql: 'sql', lua: 'lua', css: 'css', scss: 'css', html: 'html', xml: 'html', svg: 'html',
    json: 'data', yaml: 'data', yml: 'data', toml: 'data', ini: 'data',
  };

  const patternCache = new Map();

  // One regex per family: comment | string | number | word.
  function pattern(name) {
    if (patternCache.has(name)) return patternCache.get(name);
    const f = FAMILIES[name];
    const strings = [
      f.triple && '"""[\\s\\S]*?(?:"""|$)|\'\'\'[\\s\\S]*?(?:\'\'\'|$)',
      '"(?:\\\\.|[^"\\\\\\n])*"?',
      '\'(?:\\\\.|[^\'\\\\\\n])*\'?',
      f.tpl && '`(?:\\\\.|[^`\\\\])*`?',
    ].filter(Boolean).join('|');
    const re = new RegExp('(' + f.com.join('|') + ')|(' + strings + ')|(\\b(?:0x[\\da-fA-F]+|\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b)|([A-Za-z_$][\\w$]*)', 'g');
    patternCache.set(name, re);
    return re;
  }

  // Returns text nodes and token spans for code in the given language.
  function highlight(code, lang) {
    const name = ALIASES[String(lang || '').toLowerCase()] || 'other';
    const f = FAMILIES[name];
    const re = pattern(name);
    const out = [];
    let last = 0;
    re.lastIndex = 0;
    for (let m; (m = re.exec(code));) {
      if (!m[0]) { re.lastIndex++; continue; }
      const cls = m[1] ? 'tok-com' : m[2] ? 'tok-str' : m[3] ? 'tok-num' : f.kw.has(f.ci ? m[4].toLowerCase() : m[4]) ? 'tok-kw' : '';
      if (!cls) continue;
      if (m.index > last) out.push(document.createTextNode(code.slice(last, m.index)));
      out.push(el('span', { class: cls, text: m[0] }));
      last = m.index + m[0].length;
    }
    if (last < code.length) out.push(document.createTextNode(code.slice(last)));
    return out;
  }

  function copyText(button, text) {
    const done = () => { button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy'; }, 1200); };
    const fallback = () => {
      const code = button.closest('.code-block').querySelector('code');
      const range = document.createRange();
      range.selectNodeContents(code);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  function codeBlock(text, lang) {
    return el('div', { class: 'code-block' },
      el('div', { class: 'code-head' },
        el('span', { text: lang || 'code' }),
        el('button', { type: 'button', class: 'linklike', text: 'Copy', onclick: (e) => { e.stopPropagation(); copyText(e.currentTarget, text); } })),
      el('pre', {}, el('code', {}, highlight(text, lang))));
  }

  // ---------- Inline ----------

  // 1 escape | 2,3 code span | 4,5 link | 6 autolink | 7,8 bold | 9 strike | 10,11 italic | newline
  const INLINE = new RegExp([
    '\\\\([!-/:-@[-`{-~])',
    '(`+)(?!`)([\\s\\S]*?[^`])\\2(?!`)',
    '\\[([^\\]\\n]*)\\]\\(\\s*([^()\\s]+)(?:\\s+"[^"]*")?\\s*\\)',
    '(https?://[^\\s<>]*[^\\s<>.,:;"\'!?)\\]*_~])',
    '\\*\\*(?=\\S)([\\s\\S]*?\\S)\\*\\*',
    '(?<!\\w)__(?=\\S)([\\s\\S]*?\\S)__(?!\\w)',
    '~~(?=\\S)([\\s\\S]*?\\S)~~',
    '\\*(?=[^\\s*])([\\s\\S]*?[^\\s*])\\*',
    '(?<!\\w)_(?=[^\\s_])([\\s\\S]*?[^\\s_])_(?!\\w)',
    '\\n',
  ].join('|'), 'g');

  const safeUrl = (url) => /^(https?:|mailto:)/i.test(url);
  const link = (href, children) => el('a', { href, target: '_blank', rel: 'noopener' }, children);

  function inline(text) {
    const out = [];
    const re = new RegExp(INLINE.source, 'g'); // own lastIndex per call, since this recurses
    let last = 0;
    for (let m; (m = re.exec(text));) {
      if (m.index > last) out.push(text.slice(last, m.index));
      last = m.index + m[0].length;
      if (m[1] !== undefined) out.push(m[1]);
      else if (m[2] !== undefined) out.push(el('code', { text: m[3].replace(/^ (.*) $/s, '$1') }));
      else if (m[4] !== undefined) out.push(safeUrl(m[5]) ? link(m[5], inline(m[4])) : m[0]);
      else if (m[6] !== undefined) out.push(link(m[6], m[6]));
      else if (m[7] !== undefined || m[8] !== undefined) out.push(el('strong', {}, inline(m[7] !== undefined ? m[7] : m[8])));
      else if (m[9] !== undefined) out.push(el('del', {}, inline(m[9])));
      else if (m[10] !== undefined || m[11] !== undefined) out.push(el('em', {}, inline(m[10] !== undefined ? m[10] : m[11])));
      else out.push(el('br'));
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  // ---------- Blocks ----------

  const RE = {
    fence: /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/,
    heading: /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/,
    hr: /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/,
    quote: /^ {0,3}> ?/,
    item: /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/,
  };

  const indentOf = (line) => line.match(/^\s*/)[0].replace(/\t/g, '    ').length;
  const isBlank = (line) => !line.trim();
  const startsBlock = (line) => RE.fence.test(line) || RE.heading.test(line) || RE.hr.test(line) || RE.quote.test(line) || RE.item.test(line);

  // Removes up to n columns of leading spaces.
  function dedent(line, n) {
    let i = 0;
    while (i < n && line[i] === ' ') i++;
    return line.slice(i);
  }

  function blocks(lines) {
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      let m;
      if (isBlank(line)) { i++; continue; }

      if ((m = RE.fence.exec(line))) {
        const close = new RegExp('^ {0,3}' + m[1][0] + '{' + m[1].length + ',}\\s*$');
        const body = [];
        for (i++; i < lines.length && !close.test(lines[i]); i++) body.push(lines[i]);
        i++; // skip the closing fence (or step past the end when unclosed)
        out.push(codeBlock(body.join('\n'), m[2]));
      } else if ((m = RE.heading.exec(line))) {
        out.push(el('h' + Math.min(m[1].length + 3, 6), {}, inline(m[2] || '')));
        i++;
      } else if (RE.hr.test(line)) {
        out.push(el('hr'));
        i++;
      } else if (RE.quote.test(line)) {
        const body = [];
        for (; i < lines.length && RE.quote.test(lines[i]); i++) body.push(lines[i].replace(RE.quote, ''));
        out.push(el('blockquote', {}, blocks(body)));
      } else if (RE.item.test(line)) {
        i = list(lines, i, out);
      } else {
        const body = [];
        for (; i < lines.length && !isBlank(lines[i]) && (!body.length || !startsBlock(lines[i])); i++) body.push(lines[i].trim());
        out.push(el('p', {}, inline(body.join('\n'))));
      }
    }
    return out;
  }

  // Parses a list starting at lines[i] into out; returns the index after it.
  function list(lines, i, out) {
    const first = RE.item.exec(lines[i]);
    const base = indentOf(first[1]);
    const ordered = /\d/.test(first[2]);
    const items = [];
    let current = null;
    while (i < lines.length) {
      const line = lines[i];
      const m = RE.item.exec(line);
      if (m && indentOf(m[1]) === base && /\d/.test(m[2]) === ordered) {
        current = { lines: [m[3]], indent: line.length - m[3].length };
        items.push(current);
        i++;
      } else if (isBlank(line)) {
        // A blank line continues the list only when indented content or another item follows.
        let j = i + 1;
        while (j < lines.length && isBlank(lines[j])) j++;
        const next = lines[j];
        const nm = next !== undefined && RE.item.exec(next);
        const continues = next !== undefined && (indentOf(next) > base || (nm && indentOf(nm[1]) === base && /\d/.test(nm[2]) === ordered));
        if (!continues) break;
        current.lines.push('');
        i++;
      } else if (indentOf(line) > base || !startsBlock(line)) {
        current.lines.push(dedent(line, current.indent));
        i++;
      } else break;
    }
    const start = ordered ? parseInt(first[2], 10) : 1;
    out.push(el(ordered ? 'ol' : 'ul', { start: ordered && start !== 1 ? String(start) : null }, items.map(listItem)));
    return i;
  }

  function listItem(item) {
    const task = /^\[([ xX])\]\s+/.exec(item.lines[0]);
    if (task) item.lines[0] = item.lines[0].slice(task[0].length);
    const li = el('li', { class: task ? 'task-item' : null }, blocks(item.lines));
    if (task) li.prepend(el('input', { type: 'checkbox', disabled: true, checked: task[1] !== ' ' }));
    return li;
  }

  // Markdown string to a DocumentFragment.
  function render(md) {
    const frag = document.createDocumentFragment();
    frag.append(...blocks(String(md || '').replace(/\r\n?/g, '\n').split('\n')));
    return frag;
  }

  K.markdown = { render, highlight };
})(window.Kanban);
