// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHike, exportHikesJson } from '../js/customHikes.js';
import { prepareHikes } from '../js/hikeStore.js';

const fields = over => ({
  name: ' Mount Seymour ', lat: '49.3663', lon: '-122.9486', lengthKm: '8', timeHrs: '4', gainM: '450',
  difficulty: '2', quality: '4', accessibility: '2', country: 'CA', allTrails: '', notes: '',
  months: [7, 6, 6], tags: ['MOUNTAIN_VIEWS', 'NOT_A_TAG'], access: [], ...over,
});

test('buildHike turns form strings into a valid hikes.json entry', () => {
  const hike = buildHike(fields());
  assert.equal(hike.id, 'mount-seymour');
  assert.equal(hike.name, 'Mount Seymour');
  assert.equal(hike.lengthKm, 8);
  assert.equal(hike.lat, 49.3663);
  assert.deepEqual(hike.months, [6, 7]);
  assert.deepEqual(hike.tags, ['MOUNTAIN_VIEWS']);
  assert.equal(hike.allTrails, undefined);
  assert.doesNotThrow(() => prepareHikes([hike]));
});

test('buildHike rejects a hike already in the list', () => {
  assert.throws(() => buildHike(fields({ name: 'mount  SEYMOUR' }), new Set(['mount-seymour'])), /already in the list/);
});

test('buildHike lists every problem', () => {
  assert.throws(() => buildHike(fields({ name: '', lengthKm: '0', quality: '6', lat: '', lon: '200' })),
    /a name, a length above 0 km, Quality from 1 to 5, a latitude from -90 to 90, a longitude from -180 to 180/);
});

test('buildHike accepts no coordinates and rejects script links', () => {
  const hike = buildHike(fields({ lat: '', lon: '' }));
  assert.equal(hike.lat, undefined);
  assert.throws(() => buildHike(fields({ allTrails: 'javascript:alert(1)' })), /http/);
});

test('exportHikesJson drops the computed score and the in-app marker', () => {
  const [prepared] = prepareHikes([buildHike(fields())]);
  const [out] = JSON.parse(exportHikesJson([{ ...prepared, custom: true }]));
  assert.equal(out.score, undefined);
  assert.equal(out.custom, undefined);
  assert.equal(out.id, 'mount-seymour');
});
