// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Photo requests and matching. Pure: no three.js, no DOM.

import { isInFrame, scoreSubject, starsFor } from './photo/scoring.js';

// Each need is satisfied by a distinct in-frame subject. `count` repeats a need.
const RULES = [
  { id: 'rocket-sign', text: 'The rocket sign', needs: [{ type: 'rocket-sign' }] },
  { id: 'diner-door', text: "The diner's front door", needs: [{ type: 'diner-door' }] },
  { id: 'fountain-tower', text: 'Fountain and tower together', needs: [{ type: 'fountain' }, { type: 'tower' }] },
  { id: 'fish-leap', text: 'A bubble fish leaping', needs: [{ type: 'bubble-fish', action: 'leaping' }] },
  { id: 'sparrow-rocket', text: 'A sparrow on the rocket', needs: [{ type: 'chrome-sparrow', action: 'perched-rocket' }] },
  { id: 'jelly-glow', text: 'A glowing jelly drone', needs: [{ type: 'jelly-drone', action: 'glowing' }] },
  { id: 'sheep-sleep', text: 'A sleeping cloud sheep', needs: [{ type: 'cloud-sheep', action: 'sleeping' }] },
  { id: 'diner-golden', text: 'The diner at golden hour', needs: [{ type: 'diner' }], phase: 'golden' },
  { id: 'two-critters', text: 'Two critters in one photo', needs: [{ kind: 'critter', count: 2 }] },
  { id: 'favorite', text: 'Your favorite shot', needs: null },
];

export const REQUESTS = RULES.map(({ id, text }) => ({ id, text }));

function fits(s, need) {
  return (!need.type || s.type === need.type)
    && (!need.kind || s.kind === need.kind)
    && (!need.action || s.action === need.action);
}

// Lowest score among the subjects picked for the rule, or null when a need is unmet.
function ruleScore(rule, scored) {
  const used = new Set();
  let lowest = Infinity;
  for (const need of rule.needs) {
    for (let i = 0; i < (need.count ?? 1); i++) {
      const best = scored.find((e) => !used.has(e.s.id) && fits(e.s, need));
      if (!best) return null;
      used.add(best.s.id);
      lowest = Math.min(lowest, best.score);
    }
  }
  return lowest;
}

/**
 * @param {{ subjects: import('./photo/scoring.js').SubjectResult[], phase: string }} shot
 * @returns {{ requestId: string, score: number, stars: number }[]}
 */
export function matchRequests(shot) {
  const scored = shot.subjects
    .filter(isInFrame)
    .map((s) => ({ s, score: scoreSubject(s) }))
    .sort((a, b) => b.score - a.score);
  const results = [];
  for (const rule of RULES) {
    if (!rule.needs) continue;
    if (rule.phase && rule.phase !== shot.phase) continue;
    const score = ruleScore(rule, scored);
    if (score !== null) results.push({ requestId: rule.id, score, stars: starsFor(score) });
  }
  return results;
}
