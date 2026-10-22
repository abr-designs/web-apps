// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// Screen point to unit or tile. Raycasts the renderer's pickable objects; a unit wins unless a prop or terrain hit is clearly in front of it.

import * as THREE from '../../vendor/three.module.min.js';

const OCCLUSION_EPSILON = 0.05; // world units a tile hit may sit in front of a unit hit before it hides the unit

export class Picker {
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  constructor(renderer, camera, domElement) {
    this.renderer = renderer;
    this.camera = camera;
    this.domElement = domElement;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
  }

  /** @returns {{ unitId: string } | { tile: number } | null} @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  pick(clientX, clientY) {
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;

    this.ndc.set(x * 2 - 1, -(y * 2 - 1));
    this.renderer.scene.updateMatrixWorld();
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const unitHit = this.raycaster.intersectObjects(this.renderer.pickableUnits(), true)[0] ?? null;
    const tileHit = this.raycaster.intersectObjects(this.renderer.pickableTiles(), true)[0] ?? null;

    if (unitHit && (!tileHit || unitHit.distance <= tileHit.distance + OCCLUSION_EPSILON)) {
      const unitId = this.renderer.unitIdFromHit(unitHit);
      if (unitId !== null) return { unitId };
    }
    if (tileHit) {
      const tile = this.renderer.tileFromHit(tileHit);
      if (tile !== -1) return { tile };
    }
    return null;
  }
}
