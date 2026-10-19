// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUpdated, renderList, tabLabel, parseHash, formatHash, allTags, filterByTags, renderChips, renderGames } from '../directory.js';

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

// [Claude 2026-10-19 start]
test('parseHash reads tabs and tags, defaulting to apps', () => {
  assert.deepEqual(parseHash(''), { tab: 'apps', tags: [] });
  assert.deepEqual(parseHash('#dev'), { tab: 'dev', tags: [] });
  assert.deepEqual(parseHash('#games'), { tab: 'games', tags: [] });
  assert.deepEqual(parseHash('#games/puzzle,arcade'), { tab: 'games', tags: ['puzzle', 'arcade'] });
  assert.deepEqual(parseHash('#games/%E0'), { tab: 'games', tags: [] });
  assert.deepEqual(parseHash('#games/Puzzle,puzzle,arcade'), { tab: 'games', tags: ['puzzle', 'arcade'] });
  assert.deepEqual(parseHash('#gamesx'), { tab: 'apps', tags: [] });
});

test('formatHash inverts parseHash', () => {
  assert.equal(formatHash('apps', []), '');
  assert.equal(formatHash('dev', []), '#dev');
  assert.equal(formatHash('games', []), '#games');
  assert.equal(formatHash('games', ['puzzle', 'arcade']), '#games/puzzle,arcade');
});

const game = (slug, tags, extra = {}) => ({ slug, kind: 'game', name: slug, description: 'd', icon: null, color: 'gray', updated: null, url: `games/${slug}/`, tags, ...extra });

test('allTags is the sorted union', () => {
  assert.deepEqual(allTags([game('a', ['puzzle', 'arcade']), game('b', ['arcade', 'short']), { slug: 'c' }]), ['arcade', 'puzzle', 'short']);
});

test('filterByTags matches any selected tag', () => {
  const list = [game('a', ['puzzle']), game('b', ['arcade']), game('c', ['short'])];
  assert.deepEqual(filterByTags(list, []).map((g) => g.slug), ['a', 'b', 'c']);
  assert.deepEqual(filterByTags(list, ['puzzle', 'arcade']).map((g) => g.slug), ['a', 'b']);
});

test('renderChips marks selected chips and adds Clear only when something is selected', () => {
  const bar = renderChips(['arcade', 'puzzle'], ['puzzle'], fakeDoc());
  assert.deepEqual(bar.children.map((c) => [c.textContent, c.attrs['aria-pressed']]), [['arcade', 'false'], ['puzzle', 'true'], ['Clear', undefined]]);
  assert.equal(renderChips(['arcade'], [], fakeDoc()).children.length, 1);
});

test('renderList shows display-only tags on game rows', () => {
  const row = renderList([game('a', ['arcade', 'puzzle'])], fakeDoc()).children[0].children[0];
  const tags = row.children[1].children.find((c) => c.className === 'tags');
  assert.deepEqual(tags.children.map((t) => [t.tagName, t.textContent]), [['span', 'arcade'], ['span', 'puzzle']]);
});

test('renderGames filters published and dev games and labels the dev section', () => {
  const pr = { number: 9, title: 'T', url: 'u' };
  const panel = renderGames([game('a', ['puzzle']), game('b', ['arcade'])], [game('c', ['puzzle'], { pr })], ['puzzle'], fakeDoc());
  const [chips, list, heading, devList] = panel.children;
  assert.equal(chips.className, 'chips');
  assert.equal(list.children.length, 1);
  assert.equal(heading.textContent, 'In development');
  assert.equal(devList.children.length, 1);
});

test('renderGames shows a no-match message and hides an empty dev section', () => {
  const panel = renderGames([game('a', ['puzzle'])], [game('c', ['puzzle'], { pr: { number: 9, title: 'T', url: 'u' } })], ['arcade'], fakeDoc());
  assert.equal(panel.children.length, 2);
  assert.equal(panel.children[1].textContent, 'No games match these tags.');
});
// [Claude 2026-10-19 end]
