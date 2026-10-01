// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28
// Tiny element builder shared by the ui modules.

/** @created Claude (claude-opus-5-5) - 2026-09-28 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter(c => c !== undefined && c !== null && c !== false));
  return node;
}
