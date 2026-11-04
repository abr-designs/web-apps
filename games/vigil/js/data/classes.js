// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import { deepFreeze } from './freeze.js';

// Soldier templates. abilities holds ABILITIES ids. Utility items come from the loadout (RULES.loadout, js/sim/loadout.js), not the class.
export const CLASSES = deepFreeze({
  ranger: {
    name: 'Ranger', stats: { aim: 65, hp: 5, armor: 0, mobility: 6, sight: 14, defense: 0, dodge: 0, will: 50 },
    weapon: 'shotgun', abilities: ['standardShot', 'overwatch', 'hunker', 'reload', 'shootBarrel', 'slash', 'runAndGun'],
  },
  sharpshooter: {
    name: 'Sharpshooter', stats: { aim: 70, hp: 4, armor: 0, mobility: 6, sight: 14, defense: 0, dodge: 0, will: 50 },
    weapon: 'sniper', abilities: ['standardShot', 'overwatch', 'hunker', 'reload', 'shootBarrel', 'squadsight', 'deadeye', 'pistolShot'],
  },
  grenadier: {
    name: 'Grenadier', stats: { aim: 60, hp: 5, armor: 0, mobility: 6, sight: 14, defense: 0, dodge: 0, will: 50 },
    weapon: 'cannon', abilities: ['standardShot', 'overwatch', 'hunker', 'reload', 'shootBarrel', 'launchGrenade', 'shredder', 'hailOfBullets'],
  },
  specialist: {
    name: 'Specialist', stats: { aim: 65, hp: 4, armor: 0, mobility: 6, sight: 14, defense: 0, dodge: 0, will: 50 },
    weapon: 'rifle', abilities: ['standardShot', 'overwatch', 'hunker', 'reload', 'shootBarrel', 'medicalProtocol', 'aidProtocol', 'combatProtocol'],
  },
});
