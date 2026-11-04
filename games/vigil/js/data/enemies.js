// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import { deepFreeze } from './freeze.js';

// ai names an EnemyAI profile: rifleman, melee, caster.
export const ENEMIES = deepFreeze({
  trooper: {
    name: 'ADVENT Trooper', stats: { aim: 65, hp: 4, armor: 0, mobility: 6, sight: 14, detection: 4, defense: 0, dodge: 0 },
    weapon: 'rifle', abilities: ['standardShot', 'overwatch', 'reload'], ai: 'rifleman',
  },
  officer: {
    name: 'ADVENT Officer', stats: { aim: 70, hp: 5, armor: 0, mobility: 6, sight: 14, detection: 4, defense: 0, dodge: 0 },
    weapon: 'rifle', abilities: ['standardShot', 'overwatch', 'reload', 'markTarget'], ai: 'rifleman',
  },
  stunLancer: {
    name: 'ADVENT Stun Lancer', stats: { aim: 65, hp: 5, armor: 0, mobility: 7, sight: 14, detection: 4, defense: 0, dodge: 10 },
    weapon: 'rifle', abilities: ['standardShot', 'reload', 'stunLance'], ai: 'melee',
  },
  sectoid: {
    name: 'Sectoid', stats: { aim: 65, hp: 8, armor: 0, mobility: 5, sight: 14, detection: 4, defense: 10, dodge: 0 },
    weapon: 'pistol', abilities: ['standardShot', 'psiDisorient'], ai: 'caster',
  },
});
