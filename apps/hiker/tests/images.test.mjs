// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyWords, titleMatches, looksScenic } from '../tools/images.mjs';

test('keyWords drops generic and short words', () => {
  assert.deepEqual(keyWords('Three Brothers Mountain'), ['three', 'brothers']);
  assert.deepEqual(keyWords('Mount Seymour'), ['seymour']);
  assert.deepEqual(keyWords('Lake Ann'), ['ann']);
});

test('titleMatches needs every key word as a whole word', () => {
  assert.ok(titleMatches('File:Middle_Joffre_Lake_Nicolas_May.jpg', keyWords('Joffre Lakes')));
  assert.ok(!titleMatches('Joanna at the annual fair', keyWords('Lake Ann')));
  assert.ok(!titleMatches('Brothers in arms', keyWords('Three Brothers Mountain')));
  assert.ok(titleMatches('Three Brothers from the ridge', keyWords('Three Brothers Mountain')));
});

test('looksScenic rejects a flower photo and accepts a regional one', () => {
  assert.ok(!looksScenic('Chelone glabra - White Turtlehead', ['flower', 'macro']));
  assert.ok(looksScenic('Yak Peak', ['britishcolumbia']));
});
