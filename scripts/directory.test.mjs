// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUpdated } from '../directory.js';

test('formatUpdated shows month and day in UTC', () => {
  assert.equal(formatUpdated('2026-09-28T18:00:00-07:00'), 'Updated Sep 29');
});

test('formatUpdated is empty for uncommitted apps', () => {
  assert.equal(formatUpdated(null), '');
});
