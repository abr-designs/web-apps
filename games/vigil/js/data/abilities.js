// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import { deepFreeze } from './freeze.js';

// Shape: { name, description, apCost, endsTurn, usesAmmo, charges?, cooldown?, targeting, range?, radius?, aim?, crit?,
//          guaranteedHit?, breaksConcealment, passive?, hidden?, alsoTargets?, effects: [...] }
// Targeting: self, enemyLos, enemySquadsight (any enemy the squad sees), ally, allyAny, tile, melee,
//   prop (a burstable prop the unit can see, by tile).
// hidden abilities get no rail button; alsoTargets names a hidden ability whose targets join this one's target cycle.
// A unit with the squadsight passive treats enemyLos as enemySquadsight.
// Effects:
//   weaponDamage { weapon?, damageMult? }       weapon defaults to the unit's own
//   flatDamage   { damage: [min, max] }         no hit roll
//   shred        { amount }
//   destroyCover { damage? }                    uses the ability's radius; damage defaults to EXPLOSION_PROP_DAMAGE
//   destroyProp  {}                             destroys the prop on the target tile (a barrel bursts)
//   heal         { amount }
//   applyStatus  { status, turns, onHit? }      onHit: only when the preceding weaponDamage hit
//   modifyStat   { status, stat, amount, turns } timed stat change shown as a status
//   setOverwatch {}, hunker {}, reload {}
//   grantAp      { amount }
//   moveThenAct  { effects: [...] }             move to a tile adjacent to the target, then run effects
const FRAG_EFFECTS = [
  { type: 'destroyCover' },
  { type: 'flatDamage', damage: [3, 4] },
  { type: 'shred', amount: 1 },
];

export const ABILITIES = deepFreeze({
  standardShot: {
    name: 'Shoot', description: 'Fire the primary weapon.',
    apCost: 1, endsTurn: true, usesAmmo: 1, targeting: 'enemyLos', aim: 0, breaksConcealment: true, alsoTargets: 'shootBarrel',
    effects: [{ type: 'weaponDamage' }],
  },
  shootBarrel: {
    name: 'Shoot barrel', description: 'Shoot an explosive barrel: it bursts, hurting everyone within 2 tiles and toppling walls.',
    apCost: 1, endsTurn: true, usesAmmo: 1, targeting: 'prop', guaranteedHit: true, breaksConcealment: true, hidden: true,
    effects: [{ type: 'destroyProp' }],
  },
  overwatch: {
    name: 'Overwatch', description: 'Shoot the first enemy that moves in sight, at reduced aim.',
    apCost: 1, endsTurn: true, usesAmmo: 0, targeting: 'self', breaksConcealment: false,
    effects: [{ type: 'setOverwatch' }],
  },
  hunker: {
    name: 'Hunker Down', description: 'Double cover defense until your next turn.',
    apCost: 1, endsTurn: true, usesAmmo: 0, targeting: 'self', breaksConcealment: false,
    effects: [{ type: 'hunker' }],
  },
  reload: {
    name: 'Reload', description: 'Refill the primary weapon.',
    apCost: 1, endsTurn: false, usesAmmo: 0, targeting: 'self', breaksConcealment: false,
    effects: [{ type: 'reload' }],
  },
  slash: {
    name: 'Slash', description: 'Move next to an enemy and strike with the sword. Ignores cover.',
    apCost: 1, endsTurn: true, usesAmmo: 0, targeting: 'melee', aim: 10, breaksConcealment: true,
    effects: [{ type: 'moveThenAct', effects: [{ type: 'weaponDamage', weapon: 'sword' }] }],
  },
  runAndGun: {
    name: 'Run and Gun', description: 'Gain an extra action this turn.',
    apCost: 0, endsTurn: false, usesAmmo: 0, cooldown: 4, targeting: 'self', breaksConcealment: false,
    effects: [{ type: 'grantAp', amount: 1 }],
  },
  squadsight: {
    name: 'Squadsight', description: 'Target enemies any squadmate can see, at -2 aim per tile beyond own sight.',
    apCost: 0, endsTurn: false, usesAmmo: 0, targeting: 'self', breaksConcealment: false, passive: true,
    effects: [],
  },
  deadeye: {
    name: 'Deadeye', description: 'A careful shot: -25 aim, +50% damage.',
    apCost: 1, endsTurn: true, usesAmmo: 1, cooldown: 3, targeting: 'enemyLos', aim: -25, breaksConcealment: true,
    effects: [{ type: 'weaponDamage', damageMult: 1.5 }],
  },
  pistolShot: {
    name: 'Pistol', description: 'Fire the sidearm. Never needs reloading.',
    apCost: 1, endsTurn: true, usesAmmo: 0, targeting: 'enemyLos', aim: 0, breaksConcealment: true,
    effects: [{ type: 'weaponDamage', weapon: 'pistol' }],
  },
  launchGrenade: {
    name: 'Launch Grenade', description: 'Launch a frag grenade further than it can be thrown.',
    apCost: 1, endsTurn: true, usesAmmo: 0, charges: 2, targeting: 'tile', range: 14, radius: 2, breaksConcealment: true,
    effects: FRAG_EFFECTS,
  },
  shredder: {
    name: 'Shredder', description: 'Weapon hits shred 1 armor.',
    apCost: 0, endsTurn: false, usesAmmo: 0, targeting: 'self', breaksConcealment: false, passive: true,
    shred: 1, effects: [],
  },
  hailOfBullets: {
    name: 'Hail of Bullets', description: 'A guaranteed hit that uses 3 ammo.',
    apCost: 1, endsTurn: true, usesAmmo: 3, cooldown: 5, targeting: 'enemyLos', guaranteedHit: true, breaksConcealment: true,
    effects: [{ type: 'weaponDamage' }],
  },
  medicalProtocol: {
    name: 'Medical Protocol', description: 'Send the drone to heal a squadmate for 4.',
    apCost: 1, endsTurn: false, usesAmmo: 0, charges: 1, targeting: 'allyAny', breaksConcealment: false,
    effects: [{ type: 'heal', amount: 4 }],
  },
  aidProtocol: {
    name: 'Aid Protocol', description: 'Send the drone to give a squadmate +20 defense.',
    apCost: 1, endsTurn: false, usesAmmo: 0, cooldown: 3, targeting: 'allyAny', breaksConcealment: false,
    effects: [{ type: 'modifyStat', status: 'aided', stat: 'defense', amount: 20, turns: 1 }],
  },
  combatProtocol: {
    name: 'Combat Protocol', description: 'The drone zaps any enemy the squad can see for 2.',
    apCost: 1, endsTurn: true, usesAmmo: 0, charges: 2, targeting: 'enemySquadsight', breaksConcealment: true,
    effects: [{ type: 'flatDamage', damage: [2, 2] }],
  },
  fragGrenade: {
    name: 'Frag Grenade', description: 'Damages, shreds armor and destroys cover in a radius.',
    apCost: 1, endsTurn: true, usesAmmo: 0, charges: 1, targeting: 'tile', range: 10, radius: 2, breaksConcealment: true,
    effects: FRAG_EFFECTS,
  },
  rocket: {
    name: 'Rocket', description: 'Fire a rocket: damages everyone in the blast and topples walls.',
    apCost: 1, endsTurn: true, usesAmmo: 0, charges: 1, targeting: 'tile', range: 12, radius: 1, breaksConcealment: true,
    effects: [{ type: 'destroyCover', damage: 8 }, { type: 'flatDamage', damage: [3, 5] }],
  },
  markTarget: {
    name: 'Mark Target', description: 'Marked soldier takes -15 defense for the rest of this alien turn and the next.',
    apCost: 1, endsTurn: true, usesAmmo: 0, cooldown: 2, targeting: 'enemyLos', guaranteedHit: true, breaksConcealment: false,
    effects: [{ type: 'modifyStat', status: 'marked', stat: 'defense', amount: -15, turns: 2 }],
  },
  stunLance: {
    name: 'Stun Lance', description: 'Charge in and strike; a hit stuns for a turn.',
    apCost: 1, endsTurn: true, usesAmmo: 0, targeting: 'melee', aim: 10, breaksConcealment: false,
    effects: [{ type: 'moveThenAct', effects: [
      { type: 'weaponDamage', weapon: 'stunBaton' },
      { type: 'applyStatus', status: 'stunned', turns: 1, onHit: true },
    ] }],
  },
  psiDisorient: {
    name: 'Mindspin', description: "Disorient a soldier: -20 aim on the soldier's next turn.",
    apCost: 1, endsTurn: true, usesAmmo: 0, cooldown: 3, targeting: 'enemyLos', guaranteedHit: true, breaksConcealment: false,
    effects: [{ type: 'modifyStat', status: 'disoriented', stat: 'aim', amount: -20, turns: 2 }],
  },
});
