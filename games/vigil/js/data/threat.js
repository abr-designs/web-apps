// Created by Claude (claude-opus-5-5)
// Date: 2026-10-23
// Threat levels: how strong, accurate and smart the aliens of one mission are. A new player starts at THREAT.start; a victory
// raises the level by 1 and a defeat or forfeit lowers it by 1, within THREAT.min..THREAT.max. THREAT.baseline is the level
// whose numbers match ENEMIES, the pod defaults and AI_PROFILES exactly (the game as tuned before threat levels).
// Per level:
//   pods, podSize [min, max]  pod count and aliens per pod
//   pool                      enemy ids drawn per alien (repeat an id to weight it)
//   stats                     added to every alien's base stats (each result at least 1)
//   damage                    added to every alien weapon hit before graze and crit (at least 1 damage)
//   scale                     alien model size in the view
//   ai                        multipliers on the AI_PROFILES weights: cover (w1), flank (w3), exposure (w4); minHit null keeps
//                             the profile's; overwatch false makes engaged aliens close in instead; debuffs false skips Mark
//                             Target and Mindspin

import { deepFreeze } from './freeze.js';

export const THREAT = deepFreeze({
  min: 1,
  max: 5,
  start: 1,
  baseline: 4,
  levels: {
    1: {
      name: 'Stragglers', pods: 2, podSize: [2, 2], pool: ['trooper'],
      stats: { hp: -1, aim: -20, detection: -1 }, damage: -1, scale: 0.75,
      ai: { cover: 0, flank: 0, exposure: 0, minHit: 1, overwatch: false, debuffs: false },
    },
    2: {
      name: 'Patrols', pods: 3, podSize: [2, 2], pool: ['trooper', 'trooper', 'trooper', 'officer'],
      stats: { hp: -1, aim: -12 }, damage: -1, scale: 0.85,
      ai: { cover: 0.5, flank: 0, exposure: 0.5, minHit: null, overwatch: false, debuffs: false },
    },
    3: {
      name: 'Garrison', pods: 3, podSize: [2, 2], pool: ['trooper', 'trooper', 'officer', 'stunLancer'],
      stats: { aim: -6 }, damage: 0, scale: 0.95,
      ai: { cover: 1, flank: 0.5, exposure: 1, minHit: null, overwatch: true, debuffs: true },
    },
    4: {
      name: 'Strike force', pods: 3, podSize: [2, 3], pool: ['trooper', 'trooper', 'trooper', 'officer', 'stunLancer', 'sectoid'],
      stats: {}, damage: 0, scale: 1,
      ai: { cover: 1, flank: 1, exposure: 1, minHit: null, overwatch: true, debuffs: true },
    },
    5: {
      name: 'Vanguard', pods: 3, podSize: [3, 3], pool: ['trooper', 'officer', 'stunLancer', 'sectoid'],
      stats: { hp: 1, aim: 5 }, damage: 0, scale: 1.1,
      ai: { cover: 1, flank: 1.5, exposure: 1.3, minHit: null, overwatch: true, debuffs: true },
    },
  },
});

// -> the level clamped to THREAT.min..max; anything not a number (an old save, a hand-built test state) reads as THREAT.baseline.
/** @created Claude (claude-opus-5-5) - 2026-10-23 */
export function threatLevel(level) {
  if (!Number.isFinite(level)) return THREAT.baseline;
  return Math.min(THREAT.max, Math.max(THREAT.min, Math.round(level)));
}

/** -> the THREAT.levels entry for a level (see threatLevel). @created Claude (claude-opus-5-5) - 2026-10-23 */
export function threatOf(level) {
  return THREAT.levels[threatLevel(level)];
}

/** -> the level after a mission with this outcome: victory +1, defeat or forfeit -1, clamped. @created Claude (claude-opus-5-5) - 2026-10-23 */
export function nextThreat(level, outcome) {
  const step = outcome === 'victory' ? 1 : outcome === 'defeat' || outcome === 'forfeit' ? -1 : 0;
  return threatLevel(threatLevel(level) + step);
}
