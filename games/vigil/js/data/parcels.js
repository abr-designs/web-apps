// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import { deepFreeze } from './freeze.js';

// 8x8 blocks, row 0 is north. heights: '0'-'3' per tile (a climb of more than 1 level is impassable).
// props: '.' open, c crate, b barrier, w wall, r rock, x explosive barrel, S squad start, P pod anchor (S and P are open tiles).
// 'spawn' parcels hold exactly the squad's S tiles and no P anchors; every other parcel has at least one P.
// Borders stay at height 0 so parcels join in any rotation.
export const PROP_CODES = Object.freeze({ c: 'crate', b: 'barrier', w: 'wall', r: 'rock', x: 'barrel' });

export const PARCELS = deepFreeze([
  {
    id: 'yard', tags: ['spawn'],
    heights: ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000'],
    props: [
      '........',
      '.S.S....',
      '........',
      '.S.S..c.',
      '......c.',
      '..bb....',
      '........',
      '........',
    ],
  },
  {
    id: 'dropzone', tags: ['spawn'],
    heights: ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000'],
    props: [
      '........',
      '..w.....',
      '..w.S.S.',
      '........',
      '....S.S.',
      '.c......',
      '.c....r.',
      '........',
    ],
  },
  {
    id: 'warehouse', tags: [],
    heights: ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000'],
    props: [
      '........',
      '.ww.www.',
      '.wx...w.',
      '.w.P..w.',
      '......w.',
      '.w..c.w.',
      '.wwww.w.',
      '........',
    ],
  },
  {
    id: 'rooftop', tags: [],
    heights: ['00000000', '01111110', '01222210', '01233210', '01222210', '01111110', '00000000', '00000000'],
    props: [
      '........',
      '.c....b.',
      '........',
      '...P....',
      '........',
      '.b....c.',
      '........',
      '..cc....',
    ],
  },
  {
    id: 'street', tags: [],
    heights: ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000'],
    props: [
      '........',
      '.bb..bb.',
      '........',
      '..r..P..',
      '..r.....',
      '.....x..',
      '.cc..cc.',
      '........',
    ],
  },
  {
    id: 'plaza', tags: [],
    heights: ['00000000', '00000000', '00111100', '00111100', '00111100', '00111100', '00000000', '00000000'],
    props: [
      'r......r',
      '........',
      '..c..c..',
      '....P...',
      '...P....',
      '..c..c..',
      '........',
      'r......r',
    ],
  },
  {
    id: 'checkpoint', tags: [],
    heights: ['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000'],
    props: [
      '........',
      'www..www',
      '.....b..',
      '..P.....',
      '.....P..',
      '..b...x.',
      'www..www',
      '........',
    ],
  },
]);
