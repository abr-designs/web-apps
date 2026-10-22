// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// Hud: the DOM layer of layout C Tactical Rail (plan UI Reference). It fills the containers index.html already holds:
// #unit (R1, R7 as text), #abilities (R5 list), #breakdown (R13), #end-turn, #squad (R2), #turn, #concealed, #message,
// #objective (R4), #unit-bars (R8) and #outcome. It only draws and reports clicks; InputController decides what they mean.
// Ability rows are numbered 1..n in the order showUnit receives them, which is the order number keys use.

import { RULES } from '../data/rules.js';
import { WEAPONS } from '../data/weapons.js';
import { statValue } from '../sim/state.js';
import { unitDef } from '../sim/hit.js';

const MESSAGE_TIME = 2600; // ms a message stays up

// Line icons from docs/mockups/layout.html, injected once so every row can <use> them.
const SPRITE_ID = 'vigil-hud-icons';
const SPRITE = `
<symbol id="vi-shoot" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></symbol>
<symbol id="vi-overwatch" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="vi-hunker" viewBox="0 0 24 24"><path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/></symbol>
<symbol id="vi-reload" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"/></symbol>
<symbol id="vi-slash" viewBox="0 0 24 24"><path d="M5 19l3-3M6 13l5 5M9 16L20 5V4h-1L8 15"/></symbol>
<symbol id="vi-grenade" viewBox="0 0 24 24"><circle cx="11" cy="14" r="6"/><path d="M11 8V5h4M15 5l2-2"/></symbol>
<symbol id="vi-rungun" viewBox="0 0 24 24"><path d="M4 6l6 6-6 6M12 6l6 6-6 6"/></symbol>
<symbol id="vi-end" viewBox="0 0 24 24"><path d="M6 5l10 7-10 7zM19 5v14"/></symbol>
<symbol id="vi-drone" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M4 6h5M15 6h5M6.5 6l4 4M17.5 6l-4 4"/></symbol>
<symbol id="vi-pistol" viewBox="0 0 24 24"><path d="M3 8h16v4h-6l-1 2h-3l-1 5H5l1-7H3z"/></symbol>
<symbol id="vi-psi" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3a9 9 0 1 1-9 9M12 6.5a5.5 5.5 0 1 1-5.5 5.5"/></symbol>
`;
const ABILITY_ICON = {
  standardShot: 'shoot', deadeye: 'shoot', hailOfBullets: 'shoot', markTarget: 'shoot', pistolShot: 'pistol',
  overwatch: 'overwatch', hunker: 'hunker', reload: 'reload', slash: 'slash', stunLance: 'slash', runAndGun: 'rungun',
  launchGrenade: 'grenade', fragGrenade: 'grenade', medicalProtocol: 'drone', aidProtocol: 'drone', combatProtocol: 'drone',
  psiDisorient: 'psi',
};
const CLASS_ICON = { ranger: 'slash', sharpshooter: 'shoot', grenadier: 'grenade', specialist: 'drone' };
const STATUS_SHORT = { overwatch: 'OW', hunkered: 'HD', stunned: 'STN', aided: 'AID', marked: 'MRK', disoriented: 'DIS' };

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function esc(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function icon(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#vi-${name}"/></svg>`;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function actionsText(ap) {
  return ap <= 0 ? 'No actions' : plural(ap, 'action');
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function statusName(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

// hp segments (lost ones dimmed), then one armor segment per point of armor left.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function hpBars(unit) {
  let html = '';
  for (let k = 0; k < unit.stats.hp; k++) html += k < unit.hp ? '<i></i>' : '<i class="x"></i>';
  const armor = Math.max(0, unit.armor - unit.shred);
  for (let k = 0; k < armor; k++) html += '<i class="arm"></i>';
  return html;
}

// Second line of an ability row: cost and limits while usable, the reason otherwise.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function abilityLine(unit, { id, def, usable, reason }) {
  if (!usable) return reason || 'Unavailable';
  const parts = [def.apCost === 0 ? 'Free' : plural(def.apCost, 'action')];
  if (def.endsTurn) parts.push('ends turn');
  if (def.charges) parts.push(plural(unit.charges[id] ?? 0, 'charge'));
  if (def.cooldown) parts.push(`cooldown ${def.cooldown}`);
  return parts.join(' &middot; ');
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

export class Hud {
  /** root is the document (or a node holding the layout C containers). @created Claude (claude-opus-5-5) - 2026-10-21 */
  constructor(root = document) {
    const find = (id) => root.querySelector(`#${id}`);
    this.el = {
      unit: find('unit'), abilities: find('abilities'), breakdown: find('breakdown'), endTurn: find('end-turn'),
      squad: find('squad'), turn: find('turn'), concealed: find('concealed'), message: find('message'),
      objective: find('objective'), bars: find('unit-bars'), outcome: find('outcome'),
    };
    this.rail = this.el.abilities.closest('.rail');
    this._abilityCb = null;
    this._endTurnCb = null;
    this._selectCb = null;
    this._messageTimer = 0;
    this._barEls = new Map(); // unit id -> { el, sig }

    this._injectSprite();
    this.el.endTurn.innerHTML = `${icon('end')}<span>End turn</span>`;

    this.el.abilities.addEventListener('click', (e) => {
      const row = e.target.closest('[data-ability]');
      if (row) this._abilityCb?.(row.dataset.ability);
    });
    this.el.endTurn.addEventListener('click', () => this._endTurnCb?.());
    this.el.squad.addEventListener('click', (e) => {
      const row = e.target.closest('[data-unit]');
      if (row) this._selectCb?.(row.dataset.unit);
    });
    // Rail and squad buttons never take focus, so Enter and Space stay with the game keys.
    for (const el of [this.rail, this.el.squad]) {
      el.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    }
  }

  /** R1 name plate with hp, AP pips, weapon ammo and statuses, and the R5 ability list. unit null clears both. @created Claude (claude-opus-5-5) - 2026-10-21 */
  showUnit(state, unit, abilities = [], activeId = null) {
    if (!unit) {
      this.el.unit.innerHTML = '<div class="label">No soldier selected</div><div class="unit-hint">Click a soldier or press Tab</div>';
      this.el.abilities.innerHTML = '';
      return;
    }
    const def = unitDef(unit);
    const weapon = WEAPONS[def.weapon];
    const ammo = weapon.ammo === null ? weapon.name : `${weapon.name} ${unit.ammo}/${weapon.ammo}`;
    let pips = '';
    for (let k = 0; k < Math.max(RULES.apPerTurn, unit.ap); k++) pips += k < unit.ap ? '<i></i>' : '<i class="x"></i>';
    const statuses = unit.statuses.map((s) => {
      const turns = s.turns === null ? '' : ` ${s.turns}`;
      return `<span class="chip">${esc(statusName(s.id))}${turns}</span>`;
    }).join('');

    this.el.unit.innerHTML = `
      <div class="label">${unit.hp > 0 ? 'Selected' : 'Killed in action'}</div>
      <div class="unit-name">${esc(def.name)}</div>
      <div class="unit-sub">Aim ${statValue(unit, 'aim')} &middot; Mobility ${statValue(unit, 'mobility')} &middot; Defense ${statValue(unit, 'defense')}</div>
      <div class="bars">${hpBars(unit)}</div>
      <div class="ap">${pips}&nbsp;${actionsText(unit.ap)} &middot; ${esc(ammo)}</div>
      ${statuses ? `<div class="chips">${statuses}</div>` : ''}`;

    this.el.abilities.innerHTML = abilities.map((a, k) => {
      const look = a.usable ? (a.id === activeId ? 'on' : '') : 'off';
      return `<button type="button" class="abl ${look}" data-ability="${a.id}" aria-disabled="${!a.usable}" title="${esc(a.def.description)}">
        ${icon(ABILITY_ICON[a.id] ?? 'shoot')}<span class="nm">${esc(a.def.name)}<small>${abilityLine(unit, a)}</small></span>${k < 9 ? `<kbd>${k + 1}</kbd>` : '<span></span>'}
      </button>`;
    }).join('');
  }

  /** Marks the ability being targeted (or none) without rebuilding the list. @created Claude (claude-opus-5-5) - 2026-10-21 */
  setActiveAbility(abilityId) {
    for (const row of this.el.abilities.querySelectorAll('[data-ability]')) {
      row.classList.toggle('on', row.dataset.ability === abilityId && !row.classList.contains('off'));
    }
  }

  /** R2 vertical squad list: class, actions left, hp. Clicking a row reports its unit id to onSelectUnit. @created Claude (claude-opus-5-5) - 2026-10-21 */
  showSquad(state, selectedId) {
    const ids = Object.keys(state.units).sort().filter((id) => state.units[id].team === 'xcom');
    this.el.squad.innerHTML = ids.map((id) => {
      const u = state.units[id];
      const def = unitDef(u);
      const dead = u.hp <= 0;
      const chev = dead || u.ap <= 0 ? '' : `<span class="chev ${u.ap === 1 ? 'one' : ''}">${u.ap === 1 ? '&gt;' : '&gt;&gt;'}</span>`;
      const ow = u.statuses.some((s) => s.id === 'overwatch') ? ' &middot; overwatch' : '';
      const sub = dead ? 'Killed in action' : `${actionsText(u.ap)}${ow}`;
      const cls = `panel squadrow${id === selectedId ? ' sel' : ''}${dead ? ' dead' : ''}`;
      return `<button type="button" class="${cls}" data-unit="${id}">
        <span class="por">${icon(CLASS_ICON[u.defId] ?? 'shoot')}${chev}</span>
        <span class="who">${esc(def.name)}<small>${sub}</small><span class="bars">${hpBars(u)}</span></span>
      </button>`;
    }).join('');
  }

  /** R4 objective name, a sub line and the remaining count in a ring. @created Claude (claude-opus-5-5) - 2026-10-21 */
  showObjective(text, count, sub = 'Hostiles remaining') {
    this.el.objective.innerHTML = `<div><div class="obj-t">${esc(text)}</div><div class="obj-s">${esc(sub)}</div></div><div class="ring">${count}</div>`;
  }

  /** R8 overhead bars. project(unitId) -> canvas pixels { x, y } above the head, or null when off screen. Call every frame. @created Claude (claude-opus-5-5) - 2026-10-21 */
  updateUnitBars(state, project) {
    for (const [id, entry] of this._barEls) {
      if (!state.units[id]) {
        entry.el.remove();
        this._barEls.delete(id);
      }
    }
    for (const id of Object.keys(state.units)) {
      const u = state.units[id];
      let entry = this._barEls.get(id);
      if (!entry) {
        const el = document.createElement('div');
        el.className = `ubar ${u.team}`;
        this.el.bars.appendChild(el);
        entry = { el, sig: '' };
        this._barEls.set(id, entry);
      }
      const p = u.hp > 0 ? project(id) : null;
      if (!p) {
        entry.el.hidden = true;
        continue;
      }
      entry.el.hidden = false;
      const statuses = u.statuses.map((s) => s.id);
      const sig = `${u.hp}/${u.stats.hp}/${u.armor - u.shred}/${u.team === 'xcom' ? u.ap : ''}/${statuses.join(',')}`;
      if (sig !== entry.sig) {
        entry.sig = sig;
        const chev = u.team === 'xcom' && u.ap > 0 ? `<b class="${u.ap === 1 ? 'one' : ''}">${u.ap === 1 ? '&gt;' : '&gt;&gt;'}</b>` : '';
        const tags = statuses.map((s) => `<em>${STATUS_SHORT[s] ?? esc(s.slice(0, 3).toUpperCase())}</em>`).join('');
        entry.el.innerHTML = `<span class="segs">${hpBars(u)}</span>${chev}${tags}`;
      }
      entry.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  // breakdown is HitCalculator.compute output or null. info: { title, subtitle, hostile, lines: [{ label, value }], note }; hostile tints the subtitle.
  /** R13 readout: hit percentage, crit on a clean hit, each modifier, graze and dodge. Both null hides the panel. @created Claude (claude-opus-5-5) - 2026-10-21 */
  showBreakdown(breakdown, info = {}) {
    const el = this.el.breakdown;
    if (!breakdown && !info.title) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const pc = breakdown
      ? `<div class="pc">${breakdown.hit}%${breakdown.crit > 0 ? `<small>Crit ${breakdown.crit}% on hit</small>` : ''}</div>`
      : '';
    let rows = '';
    if (breakdown) {
      const hits = breakdown.modifiers.filter((m) => m.stat === 'hit');
      const crits = breakdown.modifiers.filter((m) => m.stat === 'crit');
      for (const m of hits) {
        const plain = m.label === 'Aim' || m.label === 'Guaranteed hit';
        rows += `<div class="r"><span>${esc(m.label)}</span><span class="${plain ? '' : m.value > 0 ? 'up' : 'dn'}">${plain ? m.value : signed(m.value)}</span></div>`;
      }
      rows += `<div class="r tot"><span>Hit chance</span><span>${breakdown.hit}</span></div>`;
      if (breakdown.graze > 0) rows += `<div class="r mut"><span>Graze band</span><span>${breakdown.graze}</span></div>`;
      if (breakdown.dodge > 0) rows += `<div class="r mut"><span>Dodge (hit to graze)</span><span>${breakdown.dodge}</span></div>`;
      for (const m of crits) {
        const label = /crit/i.test(m.label) ? m.label : `${m.label} crit`;
        rows += `<div class="r crit"><span>${esc(label)}</span><span>${signed(m.value)}</span></div>`;
      }
    }
    for (const line of info.lines ?? []) {
      rows += `<div class="r"><span>${esc(line.label)}</span><span>${esc(line.value ?? '')}</span></div>`;
    }
    el.innerHTML = `
      <div class="head"><div class="tgt">${esc(info.title ?? 'Target')}${info.subtitle ? `<small class="${info.hostile ? 'hostile' : ''}">${esc(info.subtitle)}</small>` : ''}</div>${pc}</div>
      ${rows}
      ${info.note ? `<div class="note">${esc(info.note)}</div>` : ''}`;
    el.hidden = false;
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  showTurn(side, turn) {
    this.el.turn.textContent = `${side === 'xcom' ? 'XCOM' : 'Alien'} turn ${turn}`;
    this.el.turn.dataset.side = side;
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  showConcealed(isConcealed) {
    this.el.concealed.hidden = !isConcealed;
  }

  /** Short-lived banner under the turn line (InvalidCommand reasons, flyover notes). null hides it. @created Claude (claude-opus-5-5) - 2026-10-21 */
  showMessage(text) {
    clearTimeout(this._messageTimer);
    const el = this.el.message;
    if (!text) {
      el.hidden = true;
      return;
    }
    el.textContent = text;
    el.hidden = false;
    this._messageTimer = setTimeout(() => { el.hidden = true; }, MESSAGE_TIME);
  }

  /** End-of-battle overlay with a New mission button; outcome null hides it. @created Claude (claude-opus-5-5) - 2026-10-21 */
  showOutcome(outcome, onNewMission) {
    const el = this.el.outcome;
    if (!outcome) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const win = outcome === 'victory';
    el.innerHTML = `<div class="panel outcome-card ${outcome}">
      <div class="label">Mission ${win ? 'complete' : 'failed'}</div>
      <h1>${win ? 'Area secured' : 'Squad lost'}</h1>
      <p>${win ? 'Every hostile in the area is down.' : 'No soldier made it out.'}</p>
      <button type="button" class="panel end-turn">New mission</button>
    </div>`;
    el.querySelector('button').addEventListener('click', () => onNewMission?.());
    el.hidden = false;
  }

  /** Greys out the rail and squad while events play or the aliens move. @created Claude (claude-opus-5-5) - 2026-10-21 */
  setLocked(locked) {
    this.rail.classList.toggle('locked', locked);
    this.el.squad.classList.toggle('locked', locked);
    this.el.endTurn.disabled = locked;
  }

  /** callback(abilityId) on an ability row click, usable or not. @created Claude (claude-opus-5-5) - 2026-10-21 */
  onAbility(callback) {
    this._abilityCb = callback;
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  onEndTurn(callback) {
    this._endTurnCb = callback;
  }

  /** callback(unitId) on a squad row click. @created Claude (claude-opus-5-5) - 2026-10-21 */
  onSelectUnit(callback) {
    this._selectCb = callback;
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-21 */
  _injectSprite() {
    if (document.getElementById(SPRITE_ID)) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = SPRITE_ID;
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML = SPRITE;
    document.body.appendChild(svg);
  }
}
