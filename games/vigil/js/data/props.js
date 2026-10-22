// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import { deepFreeze } from './freeze.js';

// height is in terrain levels. rubble names the prop left behind when this one is destroyed (null leaves open ground).
export const PROPS = deepFreeze({
  crate:   { cover: 'half', height: 1, hp: 3, blocksLos: false, rubble: null },
  barrier: { cover: 'half', height: 1, hp: 4, blocksLos: false, rubble: null },
  wall:    { cover: 'full', height: 3, hp: 8, blocksLos: true,  rubble: 'rubble' },
  rock:    { cover: 'full', height: 2, hp: Infinity, blocksLos: true, rubble: null },
  rubble:  { cover: 'half', height: 1, hp: 2, blocksLos: false, rubble: null },
});
