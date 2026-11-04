// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import { deepFreeze } from './freeze.js';

// damage is [min, max] inclusive. ammo null means unlimited; melee weapons have no range table.
export const WEAPONS = deepFreeze({
  rifle:     { name: 'Assault Rifle', damage: [3, 5], crit: 10, critDamage: 2, ammo: 4,    rangeTable: 'rifle',   shred: 0 },
  shotgun:   { name: 'Shotgun',       damage: [4, 6], crit: 20, critDamage: 2, ammo: 4,    rangeTable: 'shotgun', shred: 0 },
  sniper:    { name: 'Sniper Rifle',  damage: [4, 6], crit: 10, critDamage: 2, ammo: 3,    rangeTable: 'sniper',  shred: 0 },
  cannon:    { name: 'Cannon',        damage: [4, 6], crit: 0,  critDamage: 2, ammo: 3,    rangeTable: 'cannon',  shred: 0 },
  pistol:    { name: 'Pistol',        damage: [1, 3], crit: 0,  critDamage: 1, ammo: null, rangeTable: 'pistol',  shred: 0 },
  sword:     { name: 'Sword',         damage: [3, 5], crit: 10, critDamage: 2, ammo: null, rangeTable: null,      shred: 0 },
  stunBaton: { name: 'Stun Baton',    damage: [2, 4], crit: 0,  critDamage: 1, ammo: null, rangeTable: null,      shred: 0 },
});
