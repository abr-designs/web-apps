// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22
// Modified by Claude (claude-opus-5-5) - 2026-10-23
// LoadoutScreen (plan 0002): the pre-mission overlay, Layout A Briefing card in palette 2 Slot Tinted
// (docs/mockups/loadout-layout.html#a, docs/mockups/loadout-palette.html). One row per squad slot with a name field, a colour
// row (SWATCHES plus a custom picker) and a button per RULES.loadout item; an item another slot holds at its cap, and a swatch
// another slot wears, is disabled. Launch (button or Enter) saves the draft names, colours and loadout to the Roster, closes and
// hands the loadout to onLaunch. There is no cancel: nothing is saved before Launch. Only the soldiers in the preview mission get
// a row, with their hp when wounded: after a victory the fallen sit out and their items count toward no cap.

import { RULES } from '../data/rules.js';
import { ABILITIES } from '../data/abilities.js';
import { unitDef } from '../sim/hit.js';
import { SQUAD_SLOTS, itemAllowed } from '../sim/loadout.js';
import { esc, threatLabel } from './hud.js';
import { NAME_MAX, SWATCHES, cleanColor } from './roster.js';

export class LoadoutScreen {
  /**
   * root is the #loadout overlay element.
   * @created Claude (claude-opus-5-5) - 2026-10-22
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - name and colour drafts
   */
  constructor(root, roster) {
    this.root = root;
    this.roster = roster;
    this.draft = null;
    this.names = null;
    this.colors = null;
    this._battle = null;
    this._onLaunch = null;
    this._onKey = (e) => {
      if (e.key !== 'Enter') return;
      if (e.target instanceof HTMLElement && e.target.matches('.lo-name')) { // Enter leaves the name field; the next Enter launches
        e.preventDefault();
        e.target.blur();
        return;
      }
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
      } else if (btn.dataset.colorSlot) {
        const { colorSlot, color } = btn.dataset;
        this.colors[colorSlot] = color;
        this._render();
        this.root.querySelector(`[data-color-slot="${colorSlot}"][data-color="${color}"]`)?.focus();
      }
    });
    // Typing and dragging the custom picker update the draft in place: a re-render would drop the caret or close the picker.
    root.addEventListener('input', (e) => {
      if (!this.draft) return;
      const { name, custom } = e.target.dataset;
      if (name) this.names[name] = e.target.value;
      else if (custom) {
        this.colors[custom] = cleanColor(e.target.value) ?? this.colors[custom];
        e.target.closest('.lo-slot')?.style.setProperty('--c', this.colors[custom]);
      }
    });
    root.addEventListener('change', (e) => {
      if (this.draft && e.target.dataset.custom) this._render(); // picker closed: refresh swatch states
    });
  }

  /** Shows the overlay over `battle` (the preview mission, for class names), prefilled with the roster's loadout. @created Claude (claude-opus-5-5) - 2026-10-22 */
  open(battle, onLaunch) {
    this.draft = this.roster.loadout();
    this.names = Object.fromEntries(SQUAD_SLOTS.map((id) => [id, this.roster.slots[id].name]));
    this.colors = Object.fromEntries(SQUAD_SLOTS.map((id) => [id, this.roster.slots[id].color]));
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
    this.names = null;
    this.colors = null;
    this._battle = null;
    this._onLaunch = null;
  }

  /**
   * @created Claude (claude-opus-5-5) - 2026-10-22
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - saves names and colours
   */
  _launch() {
    if (!this.draft) return;
    const onLaunch = this._onLaunch;
    for (const id of SQUAD_SLOTS) {
      this.roster.rename(id, this.names[id]);
      this.roster.recolor(id, this.colors[id]);
    }
    const loadout = this.roster.setLoadout(this.draft);
    this.close();
    onLaunch?.(loadout);
  }

  /**
   * Rebuilds the card from the drafts.
   * @created Claude (claude-opus-5-5) - 2026-10-22
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - name field and colour row
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - threat level
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - survivors only, with hp
   */
  _render() {
    const present = SQUAD_SLOTS.filter((id) => this._battle.units[id]);
    const fielded = Object.fromEntries(present.map((id) => [id, this.draft[id]]));
    const rows = present.map((id) => {
      const k = SQUAD_SLOTS.indexOf(id);
      const color = this.colors[id];
      const worn = SQUAD_SLOTS.filter((other) => other !== id).map((other) => this.colors[other]);
      const swatches = SWATCHES.map((hex) => {
        const on = color === hex;
        return `<button type="button" class="lo-swatch${on ? ' on' : ''}" style="--s: ${hex}" data-color-slot="${id}" data-color="${hex}" aria-label="Colour ${hex}" aria-pressed="${on}"${worn.includes(hex) && !on ? ' disabled' : ''}></button>`;
      }).join('');
      const custom = `<label class="lo-swatch lo-custom${SWATCHES.includes(color) ? '' : ' on'}" title="Custom colour"><input type="color" data-custom="${id}" value="${color}" aria-label="Custom colour"></label>`;
      const items = RULES.loadout.items.map((itemId) => {
        const on = this.draft[id] === itemId;
        const allowed = itemAllowed(fielded, id, itemId);
        return `<button type="button" class="lo-item${on ? ' on' : ''}" data-slot="${id}" data-item="${itemId}" aria-pressed="${on}"${allowed ? '' : ' disabled'}>${esc(ABILITIES[itemId].name)}</button>`;
      }).join('');
      const unit = this._battle.units[id];
      const cls = unit.hp < unit.stats.hp ? `${unitDef(unit).name} · ${unit.hp}/${unit.stats.hp} HP` : unitDef(unit).name;
      const name = `<input class="lo-name" data-name="${id}" value="${esc(this.names[id])}" maxlength="${NAME_MAX}" spellcheck="false" autocomplete="off" aria-label="Soldier ${k + 1} name">`;
      return `<div class="lo-slot" style="--c: ${color}"><div class="lo-who">${name} <span class="lo-cls">${esc(cls)}</span><div class="lo-colors">${swatches}${custom}</div></div>${items}</div>`;
    }).join('');
    const capped = Object.entries(RULES.loadout.caps).map(([itemId, n]) => `${n} ${ABILITIES[itemId].name} per squad`).join(' · ');
    this.root.innerHTML = `<div class="panel lo-card" role="dialog" aria-modal="true" aria-labelledby="lo-title">
      <div class="label">Pre-mission · ${esc(threatLabel(this._battle.threat))}</div>
      <h1 id="lo-title">Loadout</h1>
      ${rows}
      <div class="lo-foot"><span class="lo-cls">${capped}</span><button type="button" class="lo-launch" data-launch>Launch <kbd>Enter</kbd></button></div>
    </div>`;
  }
}
