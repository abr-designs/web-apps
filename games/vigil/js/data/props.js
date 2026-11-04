// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import { deepFreeze } from './freeze.js';

// height is in terrain levels. rubble names the prop left behind when this one is destroyed (null leaves open ground).
// hardness: a single hit that deals less than this does nothing (walls ignore grenades and stray shots).
// burst: the blast a prop sets off when destroyed { radius, damage: [min, max] to units, propDamage }; bursts chain.
export const PROPS = deepFreeze({
  crate:   { cover: 'half', height: 1, hp: 3, blocksLos: false, rubble: null, hardness: 0 },
  barrier: { cover: 'half', height: 1, hp: 4, blocksLos: false, rubble: null, hardness: 0 },
  wall:    { cover: 'full', height: 3, hp: 8, blocksLos: true,  rubble: null, hardness: 8 },
  rock:    { cover: 'full', height: 2, hp: Infinity, blocksLos: true, rubble: null, hardness: 0 },
  barrel:  { cover: 'half', height: 1, hp: 2, blocksLos: false, rubble: null, hardness: 0,
             burst: { radius: 2, damage: [3, 4], propDamage: 8 } },
});
