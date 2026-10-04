// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank, goodFirst } from '../js/recommender.js';

const hike = (id, score, over = {}) => ({ id, name: id, score, tags: [], access: [], country: 'CA', ...over });
const day = over => ({ date: '2026-09-28', highC: 18, lowC: 8, cloudPct: 0, popPct: 0, visKm: 30, ...over });
const ids = bands => bands.flatMap(b => b.items.map(i => i.hike.id));
const noWeather = new Map();

test('bands ordered good, fair, poor, nogo, unknown', () => {
  const hikes = [hike('u', 1), hike('n', 1), hike('p', 1), hike('f', 1), hike('g', 1)];
  const forecasts = new Map([
    ['g', [day()]],                               // 0.02
    ['f', [day({ cloudPct: 60 })]],               // 36.02
    ['p', [day({ cloudPct: 50, popPct: 30 })]],   // 121.02
    ['n', [day({ highC: 31 })]],                  // Infinity
  ]);
  const bands = rank(hikes, forecasts);
  assert.deepEqual(bands.map(b => b.band), ['good', 'fair', 'poor', 'nogo', 'unknown']);
  assert.deepEqual(ids(bands), ['g', 'f', 'p', 'n', 'u']);
});

test('within a band, lower hike Score first; empty bands omitted', () => {
  const hikes = [hike('b', 9), hike('a', 2), hike('c', 30)];
  const forecasts = new Map(hikes.map(h => [h.id, [day()]]));
  const bands = rank(hikes, forecasts);
  assert.deepEqual(bands.map(b => b.band), ['good']);
  assert.deepEqual(ids(bands), ['a', 'b', 'c']);
});

test('dayIndex picks the forecast day', () => {
  const forecasts = new Map([['a', [day(), day({ highC: 35 })]]]);
  assert.equal(rank([hike('a', 1)], forecasts, { dayIndex: 1 })[0].band, 'nogo');
});

test('inSeason keeps hikes with no months listed', () => {
  const hikes = [hike('sep', 1, { months: [9] }), hike('jul', 1, { months: [7] }), hike('any', 1)];
  assert.deepEqual(ids(rank(hikes, noWeather, { filters: { inSeason: true }, month: 9 })), ['sep', 'any']);
  assert.equal(ids(rank(hikes, noWeather, { month: 9 })).length, 3);
});

test('access excludes selected tags', () => {
  const hikes = [hike('ferry', 1, { access: ['Ferry'] }), hike('road', 2), hike('4x4', 3, { access: ['4x4', 'Kayak'] })];
  assert.deepEqual(ids(rank(hikes, noWeather, { filters: { access: ['Ferry', 'Kayak'] } })), ['road']);
});

test('country filter', () => {
  const hikes = [hike('ca', 1), hike('us', 2, { country: 'US' })];
  assert.deepEqual(ids(rank(hikes, noWeather, { filters: { country: 'US' } })), ['us']);
});

test('tags require any selected', () => {
  const hikes = [hike('w', 1, { tags: ['WATERFALLS'] }), hike('s', 2, { tags: ['SWIMMING', 'GEOLOGY'] }), hike('x', 3)];
  assert.deepEqual(ids(rank(hikes, noWeather, { filters: { tags: ['WATERFALLS', 'GEOLOGY'] } })), ['w', 's']);
});

test('drive filter keeps hikes within the limit and hikes with no drive time', () => {
  const hikes = [hike('near', 1), hike('far', 2), hike('unknown', 3)];
  const driveHours = new Map([['near', 1.5], ['far', 4.2]]);
  assert.deepEqual(ids(rank(hikes, noWeather, { filters: { maxDriveHrs: 2 }, driveHours })), ['near', 'unknown']);
  assert.equal(ids(rank(hikes, noWeather, { filters: { maxDriveHrs: 0 }, driveHours })).length, 3);
});

test('goodFirst: good items first, the rest by Score regardless of band', () => {
  const hikes = [hike('good', 5), hike('fairHigh', 9), hike('poorLow', 1), hike('unknown', 3)];
  const forecasts = new Map([
    ['good', [day()]],
    ['fairHigh', [day({ cloudPct: 60 })]],
    ['poorLow', [day({ cloudPct: 50, popPct: 30 })]],
  ]);
  const { good, rest } = goodFirst(rank(hikes, forecasts));
  assert.deepEqual(good.map(i => i.hike.id), ['good']);
  assert.deepEqual(rest.map(i => i.hike.id), ['poorLow', 'unknown', 'fairHigh']);
  assert.deepEqual(rest.map(i => i.band), ['poor', 'unknown', 'fair']);
});

test('goodFirst puts hikes without a drive time at the bottom once drive times are known', () => {
  const hikes = [hike('goodNoDrive', 1), hike('good', 5), hike('restNoDrive', 2), hike('rest', 9)];
  const forecasts = new Map([['goodNoDrive', [day()]], ['good', [day()]]]);
  const bands = rank(hikes, forecasts);
  const { good, rest } = goodFirst(bands, new Map([['good', 1], ['rest', 2]]));
  assert.deepEqual(good.map(i => i.hike.id), ['good']);
  assert.deepEqual(rest.map(i => i.hike.id), ['rest', 'goodNoDrive', 'restNoDrive']);
  assert.deepEqual(goodFirst(bands).good.map(i => i.hike.id), ['goodNoDrive', 'good']);
});

test('a name query searches every hike and ignores the filters', () => {
  const hikes = [hike('Eagle Mountain', 1, { country: 'US' }), hike('Dozer', 2), hike('Eagle Bluffs', 3)];
  assert.deepEqual(ids(rank(hikes, noWeather, { query: ' eagle ', filters: { country: 'CA' } })), ['Eagle Mountain', 'Eagle Bluffs']);
  assert.deepEqual(ids(rank(hikes, noWeather, { query: '  ', filters: { country: 'CA' } })), ['Dozer', 'Eagle Bluffs']);
});
