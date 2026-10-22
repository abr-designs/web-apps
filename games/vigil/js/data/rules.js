// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import { deepFreeze } from './freeze.js';

export const RULES = deepFreeze({
  apPerTurn: 2,
  coverDefense: { none: 0, half: 20, full: 40 },  // hunkered doubles it
  highGroundAim: 20,                              // attacker terrain height > target terrain height
  flankCrit: 40,
  overwatchAimMult: 0.7,
  grazeBand: 10,                                  // total width centred on the hit threshold
  squadsightAimPerTile: -2,
  strayCoverHitChance: 0.35,                      // missed shot damages the cover it hit
  hearingRadius: 6,                               // shots within this many tiles reveal Unaware pods
  engagedCap: 6,                                  // noise never wakes a pod that would push living engaged aliens past this
  diagonalCost: 1.5,
  climbCost: 1,                                   // extra cost per height level climbed
  maxClimb: 1,                                    // larger height steps are impassable
  eyeHeight: 1.6,
  bodyHeight: 1.0,
  // Aim modifier by tile distance: index = distance in tiles, distances past the end use the last entry.
  rangeTables: {
    rifle:   [0, 38, 35, 32, 29, 26, 23, 20, 17, 14, 11, 8, 5, 2, 0],
    shotgun: [0, 40, 35, 30, 25, 20, 16, 12, 8, 4, 0, -4, -8, -12, -16, -20, -25, -30, -35, -40],
    sniper:  [0, -30, -27, -24, -21, -18, -15, -12, -9, -6, -3, 0],
    cannon:  [0, 30, 27, 24, 21, 18, 15, 12, 9, 6, 3, 0, -2, -4, -6, -8, -10, -12, -14, -16],
    pistol:  [0, 30, 26, 22, 18, 14, 10, 6, 2, 0, 0, 0, -3, -6, -9, -12, -15, -18, -21, -24],
  },
  // Utility items a soldier picks on the loadout screen (plan 0002): one per soldier, caps limit an item per squad.
  loadout: { items: ['fragGrenade', 'rocket'], caps: { rocket: 1 }, defaultItem: 'fragGrenade' },
});
