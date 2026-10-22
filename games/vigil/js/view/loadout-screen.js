// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22
// LoadoutScreen (plan 0002): the pre-mission overlay, Layout A Briefing card in palette 2 Slot Tinted
// (docs/mockups/loadout-layout.html#a, docs/mockups/loadout-palette.html). One row per squad slot with a button per
// RULES.loadout item; an item another slot holds at its cap is disabled. Launch (button or Enter) saves the draft to the
// Roster, closes and hands the draft to onLaunch. There is no cancel: nothing is saved before Launch.

import { RULES } from '../data/rules.js';
import { ABILITIES } from '../data/abilities.js';
import { unitDef } from '../sim/hit.js';
import { SQUAD_SLOTS, itemAllowed } from '../sim/loadout.js';
import { esc } from './hud.js';

export class LoadoutScreen {
  /** root is the #loadout overlay element. @created Claude (claude-opus-5-5) - 2026-10-22 */
  constructor(root, roster) {
    this.root = root;
    this.roster = roster;
    this.draft = null;
    this._battle = null;
    this._onLaunch = null;
    this._onKey = (e) => {
      if (e.key !== 'Enter') return;
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea, select')) return; // a rename field keeps its Enter
      e.preventDefault(); // stops a focused item button from also taking the Enter as a click
      e.stopPropagation();
      this._launch();
    };
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled || !this.draft) return;
      if (btn.dataset.launch !== undefined) this._launch();
      else if (btn.dataset.slot) {
        const { slot, item } = btn.dataset;
        this.draft[slot] = item;
        this._render();
        this.root.querySelector(`[data-slot="${slot}"][data-item="${item}"]`)?.focus();
      }
    });
  }

  /** Shows the overlay over `battle` (the preview mission, for class names), prefilled with the roster's loadout. @created Claude (claude-opus-5-5) - 2026-10-22 */
  open(battle, onLaunch) {
    this.draft = this.roster.loadout();
    this._battle = battle;
    this._onLaunch = onLaunch;
    this._render();
    this.root.hidden = false;
    document.addEventListener('keydown', this._onKey, true);
    this.root.querySelector('[data-launch]')?.focus();
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  close() {
    document.removeEventListener('keydown', this._onKey, true);
    this.root.hidden = true;
    this.root.innerHTML = '';
    this.draft = null;
    this._battle = null;
    this._onLaunch = null;
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _launch() {
    if (!this.draft) return;
    const onLaunch = this._onLaunch;
    const loadout = this.roster.setLoadout(this.draft);
    this.close();
    onLaunch?.(loadout);
  }

  /** Rebuilds the card from the draft. @created Claude (claude-opus-5-5) - 2026-10-22 */
  _render() {
    const rows = SQUAD_SLOTS.map((id, k) => {
      const items = RULES.loadout.items.map((itemId) => {
        const on = this.draft[id] === itemId;
        const allowed = itemAllowed(this.draft, id, itemId);
        return `<button type="button" class="lo-item${on ? ' on' : ''}" data-slot="${id}" data-item="${itemId}" aria-pressed="${on}"${allowed ? '' : ' disabled'}>${esc(ABILITIES[itemId].name)}</button>`;
      }).join('');
      const unit = this._battle.units[id];
      const cls = unit ? unitDef(unit).name : '';
      return `<div class="lo-slot" style="--c: var(--slot-${k + 1})"><div class="lo-who"><span class="lo-name">${esc(this.roster.slots[id].name)}</span> <span class="lo-cls">${esc(cls)}</span></div>${items}</div>`;
    }).join('');
    const capped = Object.entries(RULES.loadout.caps).map(([itemId, n]) => `${n} ${ABILITIES[itemId].name} per squad`).join(' · ');
    this.root.innerHTML = `<div class="panel lo-card" role="dialog" aria-modal="true" aria-labelledby="lo-title">
      <div class="label">Pre-mission</div>
      <h1 id="lo-title">Loadout</h1>
      ${rows}
      <div class="lo-foot"><span class="lo-cls">${capped}</span><button type="button" class="lo-launch" data-launch>Launch <kbd>Enter</kbd></button></div>
    </div>`;
  }
}
