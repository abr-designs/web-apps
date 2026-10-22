// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex, placeProp, rebuildAllEdgeCover } from '../js/sim/grid.js';
import { createUnit } from '../js/sim/state.js';
import { CLASSES } from '../js/data/classes.js';
import { ENEMIES } from '../js/data/enemies.js';
import { ABILITIES } from '../js/data/abilities.js';
import { RULES } from '../js/data/rules.js';
import { compute, grazeWindow } from '../js/sim/hit.js';

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function makeState(width, depth, props = []) {
  const grid = createGrid(width, depth);
  for (const [x, z, kind] of props) placeProp(grid, toIndex(grid, x, z), kind);
  rebuildAllEdgeCover(grid);
  return { grid, units: {}, rngState: 1 };
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function addUnit(state, id, defId, x, z) {
  const team = CLASSES[defId] ? 'xcom' : 'alien';
  const def = CLASSES[defId] ?? ENEMIES[defId];
  const unit = createUnit(id, team, defId, def, toIndex(state.grid, x, z));
  state.units[id] = unit;
  return unit;
}

const at = (state, x, z) => toIndex(state.grid, x, z);
const mod = (b, label, stat = 'hit') => b.modifiers.find((m) => m.label === label && m.stat === stat);
const hitSum = (b) => b.modifiers.filter((m) => m.stat === 'hit').reduce((s, m) => s + m.value, 0);

// Ranger (aim 65, shotgun) at (8,4) shooting a trooper (defense 0) at (4,4): distance 4, shotgun range table 25 -> 90.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function duel(props = []) {
  const s = makeState(12, 9, props);
  const ranger = addUnit(s, 'x1', 'ranger', 8, 4);
  const trooper = addUnit(s, 'a01', 'trooper', 4, 4);
  return { s, ranger, trooper };
}

test('open ground: aim plus range, no cover, base crit', () => {
  const { s, ranger, trooper } = duel();
  const b = compute(s, ranger, trooper, 'standardShot');
  assert.equal(b.hit, 90);
  assert.equal(b.crit, 20);
  assert.equal(b.dodge, 0);
  assert.equal(b.cover, 'none');
  assert.equal(b.flanked, false);
  assert.equal(b.guaranteed, false);
  assert.deepEqual(mod(b, 'Aim'), { label: 'Aim', value: 65, stat: 'hit' });
  assert.deepEqual(mod(b, 'Range'), { label: 'Range', value: 25, stat: 'hit' });
  assert.equal(hitSum(b), b.hit);
});

test('accepts an ability def as well as an id', () => {
  const { s, ranger, trooper } = duel();
  assert.deepEqual(compute(s, ranger, trooper, ABILITIES.standardShot), compute(s, ranger, trooper, 'standardShot'));
});

test('half and full cover subtract their defense and name the cover tile', () => {
  const half = duel([[5, 4, 'crate']]);
  const bh = compute(half.s, half.ranger, half.trooper, 'standardShot');
  assert.equal(bh.hit, 70);
  assert.equal(bh.cover, 'half');
  assert.equal(bh.coverTile, at(half.s, 5, 4));
  assert.equal(mod(bh, 'Cover (half)').value, -20);

  const full = duel([[5, 4, 'rock']]);
  const bf = compute(full.s, full.ranger, full.trooper, 'standardShot');
  assert.equal(bf.hit, 50);
  assert.equal(bf.cover, 'full');
  assert.equal(mod(bf, 'Cover (full)').value, -40);
});

test('hunkered doubles the cover defense as its own modifier', () => {
  const half = duel([[5, 4, 'crate']]);
  half.trooper.statuses.push({ id: 'hunkered', turns: null });
  const bh = compute(half.s, half.ranger, half.trooper, 'standardShot');
  assert.equal(bh.hit, 50);
  assert.equal(mod(bh, 'Hunkered').value, -20);

  const full = duel([[5, 4, 'rock']]);
  full.trooper.statuses.push({ id: 'hunkered', turns: null });
  const bf = compute(full.s, full.ranger, full.trooper, 'standardShot');
  assert.equal(bf.hit, 10);
  assert.equal(mod(bf, 'Hunkered').value, -40);
});

test('hunkered without cover changes nothing', () => {
  const { s, ranger, trooper } = duel();
  trooper.statuses.push({ id: 'hunkered', turns: null });
  const b = compute(s, ranger, trooper, 'standardShot');
  assert.equal(b.hit, 90);
  assert.equal(mod(b, 'Hunkered'), undefined);
});

test('high ground adds aim only when the attacker stands higher', () => {
  const up = duel();
  up.s.grid.heights[up.ranger.tile] = 1;
  const bu = compute(up.s, up.ranger, up.trooper, 'standardShot');
  assert.equal(mod(bu, 'High ground').value, RULES.highGroundAim);
  assert.equal(bu.hit, 100);

  const level = duel();
  level.s.grid.heights[level.ranger.tile] = 1;
  level.s.grid.heights[level.trooper.tile] = 1;
  assert.equal(mod(compute(level.s, level.ranger, level.trooper, 'standardShot'), 'High ground'), undefined);

  const down = duel();
  down.s.grid.heights[down.trooper.tile] = 1;
  const bd = compute(down.s, down.ranger, down.trooper, 'standardShot');
  assert.equal(mod(bd, 'High ground'), undefined);
});

test('flanking adds crit when the target has cover elsewhere', () => {
  // Wall north of the target; the shooter stands east, so the wall does not count.
  const { s, ranger, trooper } = duel([[4, 3, 'wall']]);
  const b = compute(s, ranger, trooper, 'standardShot');
  assert.equal(b.flanked, true);
  assert.equal(b.cover, 'none');
  assert.equal(b.crit, 20 + RULES.flankCrit);
  assert.equal(mod(b, 'Flanked', 'crit').value, RULES.flankCrit);
  // Same shot from the far side of the wall is covered, not flanked.
  const covered = compute(s, ranger, trooper, 'standardShot', { fromTile: at(s, 4, 0) });
  assert.equal(covered.flanked, false);
  assert.equal(covered.cover, 'full');
  assert.equal(covered.crit, 20);
});

test('fromTile previews a hypothetical position', () => {
  const { s, ranger, trooper } = duel([[5, 4, 'crate']]);
  const actual = compute(s, ranger, trooper, 'standardShot');
  assert.equal(actual.cover, 'half');
  // From (4,0) the crate east of the target does not count: shooter is north of it.
  const moved = compute(s, ranger, trooper, 'standardShot', { fromTile: at(s, 4, 0) });
  assert.equal(moved.cover, 'none');
  assert.equal(moved.flanked, true);
});

test('overwatch scales the clamped chance and labels the loss', () => {
  const { s, ranger, trooper } = duel();
  const b = compute(s, ranger, trooper, 'standardShot', { overwatch: true });
  assert.equal(b.hit, Math.round(90 * RULES.overwatchAimMult));
  assert.equal(b.overwatch, true);
  assert.equal(mod(b, 'Overwatch').value, b.hit - 90);
  assert.equal(hitSum(b), b.hit);
});

test('hit clamps to 0..100', () => {
  const { s, ranger, trooper } = duel();
  ranger.stats.aim = 200;
  assert.equal(compute(s, ranger, trooper, 'standardShot').hit, 100);
  ranger.stats.aim = 0;
  trooper.stats.defense = 500;
  assert.equal(compute(s, ranger, trooper, 'standardShot').hit, 0);
  // Overwatch of a clamped 100 uses the clamped value.
  ranger.stats.aim = 200;
  trooper.stats.defense = 0;
  assert.equal(compute(s, ranger, trooper, 'standardShot', { overwatch: true }).hit, Math.round(100 * RULES.overwatchAimMult));
});

test('crit clamps to 100 and adds weapon, ability and flank terms', () => {
  const { s, ranger, trooper } = duel([[4, 3, 'wall']]);
  assert.equal(compute(s, ranger, trooper, 'standardShot').crit, 20 + RULES.flankCrit);
  // Pistol has crit 0, so only the flank term remains.
  assert.equal(compute(s, ranger, trooper, 'pistolShot').crit, RULES.flankCrit);
  ranger.defId = 'sharpshooter';
  const wide = compute(s, ranger, trooper, 'standardShot');
  assert.equal(wide.crit, 10 + RULES.flankCrit);
});

test('guaranteed hit returns 100 through cover and dodge', () => {
  const { s, ranger, trooper } = duel([[5, 4, 'rock']]);
  ranger.defId = 'grenadier';
  trooper.stats.dodge = 50;
  trooper.stats.defense = 30;
  const b = compute(s, ranger, trooper, 'hailOfBullets');
  assert.equal(b.hit, 100);
  assert.equal(b.dodge, 0);
  assert.equal(b.guaranteed, true);
  assert.equal(b.graze, 0);
  assert.equal(hitSum(b), 100);
  assert.deepEqual(mod(b, 'Guaranteed hit'), { label: 'Guaranteed hit', value: 100, stat: 'hit' });
  // Overwatch does not dilute a guaranteed hit.
  assert.equal(compute(s, ranger, trooper, 'hailOfBullets', { overwatch: true }).hit, 100);
});

test('melee ignores cover and cannot flank', () => {
  const { s, ranger, trooper } = duel([[5, 4, 'rock'], [4, 3, 'wall']]);
  const shot = compute(s, ranger, trooper, 'standardShot');
  assert.equal(shot.cover, 'full');
  const slash = compute(s, ranger, trooper, 'slash');
  assert.equal(slash.cover, 'none');
  assert.equal(slash.coverTile, -1);
  assert.equal(slash.flanked, false);
  // Aim 65 + slash aim 10, no range term for a sword, sword crit 10.
  assert.equal(slash.hit, 75);
  assert.equal(mod(slash, 'Range'), undefined);
  assert.equal(mod(slash, 'Slash').value, 10);
  assert.equal(slash.crit, 10);
});

test('ability aim and weapon override feed the breakdown', () => {
  const s = makeState(24, 9);
  const sharp = addUnit(s, 'x1', 'sharpshooter', 8, 4);
  const trooper = addUnit(s, 'a01', 'trooper', 4, 4);
  const plain = compute(s, sharp, trooper, 'standardShot');
  // Sniper table at distance 4 is -21.
  assert.equal(mod(plain, 'Range').value, -21);
  assert.equal(plain.hit, 70 - 21);
  const deadeye = compute(s, sharp, trooper, 'deadeye');
  assert.equal(mod(deadeye, 'Deadeye').value, -25);
  assert.equal(deadeye.hit, plain.hit - 25);
  // pistolShot swaps in the pistol: table 18 at distance 4, crit 0.
  const pistol = compute(s, sharp, trooper, 'pistolShot');
  assert.equal(mod(pistol, 'Range').value, 18);
  assert.equal(pistol.crit, 0);
});

test('range index rounds the distance and clamps to the last entry', () => {
  const s = makeState(40, 5);
  const sharp = addUnit(s, 'x1', 'sharpshooter', 0, 2);
  const near = addUnit(s, 'a01', 'trooper', 3, 2);
  assert.equal(mod(compute(s, sharp, near, 'standardShot'), 'Range').value, -24);
  // Offset (3,2) is 3.61 tiles and rounds to 4.
  const diag = addUnit(s, 'a02', 'trooper', 3, 4);
  assert.equal(Math.round(Math.hypot(3, 2)), 4);
  assert.equal(mod(compute(s, sharp, diag, 'standardShot'), 'Range').value, -21);
  // Past the end of the sniper table (11 entries) the last entry applies.
  sharp.stats.sight = 40;
  const far = addUnit(s, 'a03', 'trooper', 30, 2);
  assert.equal(compute(s, sharp, far, 'standardShot').hit, 70);
  assert.equal(mod(compute(s, sharp, far, 'standardShot'), 'Range'), undefined);
});

test('defense and dodge include status modifiers', () => {
  const { s, ranger, trooper } = duel();
  trooper.stats.defense = 10;
  trooper.stats.dodge = 15;
  let b = compute(s, ranger, trooper, 'standardShot');
  assert.equal(b.hit, 80);
  assert.equal(mod(b, 'Defense').value, -10);
  assert.equal(b.dodge, 15);
  trooper.statuses.push({ id: 'marked', stat: 'defense', amount: -15, turns: 2 });
  b = compute(s, ranger, trooper, 'standardShot');
  assert.equal(b.hit, 95);
  ranger.statuses.push({ id: 'disoriented', stat: 'aim', amount: -20, turns: 2 });
  b = compute(s, ranger, trooper, 'standardShot');
  assert.equal(b.hit, 75);
  assert.equal(mod(b, 'Aim').value, 45);
});

test('no line of sight returns null', () => {
  const { s, ranger, trooper } = duel([[6, 4, 'wall'], [6, 3, 'wall'], [6, 5, 'wall'], [6, 2, 'wall'], [6, 6, 'wall'],
    [6, 1, 'wall'], [6, 7, 'wall'], [6, 0, 'wall'], [6, 8, 'wall']]);
  assert.equal(compute(s, ranger, trooper, 'standardShot'), null);
});

test('outside own sight radius returns null without squadsight', () => {
  const s = makeState(40, 5);
  const ranger = addUnit(s, 'x1', 'ranger', 0, 2);
  const far = addUnit(s, 'a01', 'trooper', 20, 2);
  assert.equal(compute(s, ranger, far, 'standardShot'), null);
});

test('squadsight needs the passive and a squadmate who sees the target, and costs aim past own sight', () => {
  const s = makeState(40, 5);
  const sharp = addUnit(s, 'x1', 'sharpshooter', 0, 2);
  const mate = addUnit(s, 'x2', 'specialist', 14, 2);
  const far = addUnit(s, 'a01', 'trooper', 18, 2);
  // Sharpshooter distance 18, sight 14: 4 tiles beyond, -2 each. Sniper table is 0 out there.
  const b = compute(s, sharp, far, 'standardShot');
  assert.equal(b.hit, 70 - 8);
  assert.equal(mod(b, 'Squadsight').value, -8);
  // Without the squadmate nobody sees the target.
  mate.hp = 0;
  assert.equal(compute(s, sharp, far, 'standardShot'), null);
  mate.hp = 4;
  // Overwatch never uses squadsight.
  assert.equal(compute(s, sharp, far, 'standardShot', { overwatch: true }), null);
  // A soldier without the passive cannot.
  const ranger = addUnit(s, 'x3', 'ranger', 0, 4);
  assert.equal(compute(s, ranger, far, 'standardShot'), null);
});

test('squadsight inside own sight radius but without own LOS carries no penalty', () => {
  const s = makeState(24, 9, [[5, 4, 'wall']]);
  const sharp = addUnit(s, 'x1', 'sharpshooter', 2, 4);
  addUnit(s, 'x2', 'specialist', 8, 0);
  const t = addUnit(s, 'a01', 'trooper', 8, 4);
  const b = compute(s, sharp, t, 'standardShot');
  assert.notEqual(b, null);
  assert.equal(mod(b, 'Squadsight'), undefined);
});

test('graze band is centred on the hit chance and clipped to 0..100', () => {
  assert.deepEqual(grazeWindow(50), [45, 55]);
  assert.deepEqual(grazeWindow(2), [0, 7]);
  assert.deepEqual(grazeWindow(98), [93, 100]);
  assert.deepEqual(grazeWindow(0), [0, 0]);
  assert.deepEqual(grazeWindow(100), [100, 100]);
  const { s, ranger, trooper } = duel([[5, 4, 'crate']]);
  assert.equal(compute(s, ranger, trooper, 'standardShot').graze, RULES.grazeBand);
});

test('every modifier has a label and the hit modifiers sum to hit when unclamped', () => {
  const { s, ranger, trooper } = duel([[5, 4, 'crate']]);
  trooper.stats.defense = 5;
  trooper.statuses.push({ id: 'hunkered', turns: null });
  const b = compute(s, ranger, trooper, 'standardShot');
  for (const m of b.modifiers) {
    assert.equal(typeof m.label, 'string');
    assert.ok(m.label.length > 0);
    assert.ok(m.stat === 'hit' || m.stat === 'crit');
    assert.notEqual(m.value, 0);
  }
  assert.equal(hitSum(b), b.hit);
  assert.equal(b.hit, 90 - 5 - 20 - 20);
});

test('overwatch rounds exact .5 ties up despite float error', () => {
  const { s, ranger, trooper } = duel();
  // 0.7 is slightly below 0.7 in float64, so 45 * 0.7 and 85 * 0.7 sit just under .5.
  for (const [raw, scaled] of [[45, 32], [85, 60], [15, 11], [25, 18]]) {
    ranger.stats.aim = raw - 25;
    const b = compute(s, ranger, trooper, 'standardShot', { overwatch: true });
    assert.equal(b.hit, scaled, `raw ${raw}`);
  }
});
