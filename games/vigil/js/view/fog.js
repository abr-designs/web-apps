// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22
// Fog: what the player currently sees (plan 0003), shared by the renderer, hud bars, input and event player.
// XCOM 2 style: terrain and props are always drawn, tiles outside squad sight are dimmed, aliens no soldier canSee are hidden.
// No memory of explored tiles. During playback tileOf and alive come from EventPlayer, so the fog follows the drawn units.

import { squadSightTiles, canSee } from '../sim/visibility.js';

export class Fog {
  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  constructor({ renderer }) {
    this.renderer = renderer;
    this.visibleTiles = new Set();  // tiles from squadSightTiles('xcom')
    this.visibleAliens = new Set(); // living aliens some living soldier canSee, both at their drawn tiles
  }

  /** Recomputes both sets, then dims the unseen tiles and shows or hides every alien. @created Claude (claude-opus-5-5) - 2026-10-22 */
  refresh(state, tileOf = (u) => u.tile, alive = (u) => u.hp > 0) {
    const units = Object.values(state.units);
    const soldiers = units.filter((u) => u.team === 'xcom' && alive(u));
    this.visibleTiles = squadSightTiles(state, 'xcom', tileOf, alive);
    this.visibleAliens = new Set();
    for (const alien of units) {
      if (alien.team === 'xcom' || !alive(alien)) continue;
      const targetTile = tileOf(alien);
      if (soldiers.some((s) => canSee(state, s, alien, { fromTile: tileOf(s), targetTile }))) this.visibleAliens.add(alien.id);
    }
    this.renderer.showFog(this.visibleTiles);
    for (const unit of units) {
      if (unit.team !== 'xcom') this.renderer.setUnitShown(unit.id, this.visibleAliens.has(unit.id));
    }
  }

  /** -> true for soldiers, and for aliens the squad currently sees. @created Claude (claude-opus-5-5) - 2026-10-22 */
  shows(unit) {
    return unit.team === 'xcom' || this.visibleAliens.has(unit.id);
  }
}
