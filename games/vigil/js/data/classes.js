// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import { deepFreeze } from './freeze.js';

// Soldier templates. abilities and utility hold ABILITIES ids; utility items are charge-limited abilities.
export const CLASSES = deepFreeze({
  ranger: {
    name: 'Ranger', stats: { aim: 65, hp: 5, armor: 0, mobility: 6, sight: 14, defense: 0, dodge: 0, will: 50 },
    weapon: 'shotgun', abilities: ['standardShot', 'overwatch', 'hunker', 'reload', 'slash', 'runAndGun'], utility: ['fragGrenade'],
  },
  sharpshooter: {
    name: 'Sharpshooter', stats: { aim: 70, hp: 4, armor: 0, mobility: 6, sight: 14, defense: 0, dodge: 0, will: 50 },
    weapon: 'sniper', abilities: ['standardShot', 'overwatch', 'hunker', 'reload', 'squadsight', 'deadeye', 'pistolShot'], utility: ['fragGrenade'],
  },
  grenadier: {
    name: 'Grenadier', stats: { aim: 60, hp: 5, armor: 0, mobility: 6, sight: 14, defense: 0, dodge: 0, will: 50 },
    weapon: 'cannon', abilities: ['standardShot', 'overwatch', 'hunker', 'reload', 'launchGrenade', 'shredder', 'hailOfBullets'], utility: ['fragGrenade'],
  },
  specialist: {
    name: 'Specialist', stats: { aim: 65, hp: 4, armor: 0, mobility: 6, sight: 14, defense: 0, dodge: 0, will: 50 },
    weapon: 'rifle', abilities: ['standardShot', 'overwatch', 'hunker', 'reload', 'medicalProtocol', 'aidProtocol', 'combatProtocol'], utility: ['fragGrenade'],
  },
});
