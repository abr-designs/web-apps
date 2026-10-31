// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCode, parseCodes, withLab, filterAvailable, packPrice } from '../js/catalog.js';

const data = JSON.parse(readFileSync(new URL('../data/delica.json', import.meta.url), 'utf8'));
const catalog = withLab(data.colors);

test('delica.json shape', () => {
  assert.ok(data.source && data.license);
  assert.ok(data.colors.length >= 800);
  assert.equal(new Set(data.colors.map((c) => c.code)).size, data.colors.length);
  assert.ok(data.colors.every((c) => /^#[0-9A-F]{6}$/i.test(c.hex)));
  assert.ok(data.colors.some((c) => c.code === 'DB-651'));
  assert.equal(catalog[0].lab.length, 3);
});

test('normalizeCode accepts common spellings', () => {
  assert.equal(normalizeCode('db651'), 'DB-651');
  assert.equal(normalizeCode('DB-0651'), 'DB-651');
  assert.equal(normalizeCode('DB 651'), 'DB-651');
  assert.equal(normalizeCode('DB0022L'), 'DB-22L');
  assert.equal(normalizeCode('foo'), null);
});

test('parseCodes splits, dedupes and reports unknown codes', () => {
  const { codes, unknown } = parseCodes('db651, DB-0010\nDB 999999 foo, DB651', catalog);
  assert.deepEqual(codes, ['DB-651', 'DB-10']);
  assert.deepEqual(unknown, ['DB-999999', 'foo']);
});

test('filterAvailable', () => {
  const buyable = filterAvailable(catalog, new Set());
  assert.equal(buyable.length, catalog.filter((c) => !c.discontinued).length);
  assert.deepEqual(filterAvailable(catalog, new Set(['DB-651'])).map((c) => c.code), ['DB-651']);
});

test('stale ticked codes fall back to colours in production', () => {
  const buyable = catalog.filter((c) => !c.discontinued).length;
  assert.equal(filterAvailable(catalog, new Set(['DB-999999'])).length, buyable);
});

test('packPrice picks the first matching finish tier', () => {
  assert.equal(packPrice('Gold Plated Gold'), 25);
  assert.equal(packPrice('Matte Palladium Plated Silver'), 12.5);
  assert.equal(packPrice('Duracoat Galvanized Gold'), 7);
  assert.equal(packPrice('Galvanized Silver'), 6.75);
  assert.equal(packPrice('Metallic Gray'), 6);
  assert.equal(packPrice('Opaque Duracoat Dyed Red'), 4.75);
  assert.equal(packPrice('Silver-Lined Transparent Blue'), 4);
  assert.equal(packPrice('Transparent Crystal AB'), 4);
  assert.equal(packPrice('Opaque Black'), 3.5);
  assert.equal(packPrice('Alabaster White'), 3.5);
  assert.ok(catalog.every((c) => c.price >= 3.5 && c.price <= 25));
});
