// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUpdated, renderList, tabLabel } from '../directory.js';

test('formatUpdated shows month and day in UTC', () => {
  assert.equal(formatUpdated('2026-09-28T18:00:00-07:00'), 'Updated Sep 29');
});

test('formatUpdated is empty for uncommitted apps', () => {
  assert.equal(formatUpdated(null), '');
});

function fakeNode(tagName) {
  return {
    tagName, className: '', textContent: '', href: '', children: [], attrs: {},
    append(...nodes) { this.children.push(...nodes); },
    setAttribute(name, value) { this.attrs[name] = value; },
  };
}

const fakeDoc = () => ({ createElement: fakeNode, createElementNS: (_ns, tag) => fakeNode(tag) });
const texts = (node) => [node.textContent, ...node.children.flatMap(texts)].filter(Boolean);

const devEntry = {
  slug: 'x', name: 'X', description: 'd', icon: null, color: 'gray', updated: '2026-10-03T12:00:00Z',
  url: 'dev/pr-7/x/', pr: { number: 7, title: '<b>Try</b>', url: 'https://github.com/abr-designs/web-apps/pull/7' },
};

test('tabLabel shows the dev count', () => {
  assert.equal(tabLabel(2), 'In Development (2)');
});

test('renderList dev row shows PR line, preview link and a separate PR link', () => {
  const li = renderList([devEntry], fakeDoc()).children[0];
  const [row, prLink] = li.children;
  assert.equal(li.children.length, 2);
  assert.equal(row.href, 'dev/pr-7/x/');
  assert.ok(texts(row).includes('PR #7 · <b>Try</b>'));
  assert.ok(!texts(row).includes('d'));
  assert.equal(prLink.tagName, 'a');
  assert.equal(prLink.href, devEntry.pr.url);
  assert.equal(prLink.textContent, '#7');
});

test('renderList published row has no PR link', () => {
  const { pr, ...published } = devEntry;
  const li = renderList([{ ...published, url: 'x/' }], fakeDoc()).children[0];
  assert.equal(li.children.length, 1);
  assert.ok(texts(li).includes('d'));
});
