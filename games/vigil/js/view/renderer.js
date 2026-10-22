// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// three.js scene built from a BattleState grid, plus the world-space overlays (move range, cover shields, detection, target line).
// World scale: 1 unit per tile horizontally, HEIGHT_STEP (0.5) per height level. Tile i = z * width + x occupies [x, x+1] x [z, z+1]
// (x east, z south), so grid coordinates and world coordinates line up and the map spans (0,0) to (width, depth).
// tileCenter(tile) is the middle of the tile on its terrain top surface; props and units stand on that point.

import * as THREE from '../../vendor/three.module.min.js';
import { PROPS } from '../data/props.js';
import { toXZ, toIndex, DIRS } from '../sim/grid.js';

export const HEIGHT_STEP = 0.5;
const BASE_DEPTH = 0.5;         // slab thickness below height 0, so cliffs show a face
const TILE_GAP = 0.97;          // terrain boxes are slightly narrower than a tile, which draws the grid lines
const UNIT_RADIUS = 0.25;
const UNIT_BODY = 1.0;          // matches RULES.bodyHeight
const MARKER_WIDTH = 0.07;      // outline strip width in world units
const FOG_OPACITY = 0.55;       // dim over tiles outside squad sight
const PATH_WIDTH = 0.09;        // move path line width (plan 0003 Layout B)
const PATH_LIFT = 0.05;         // path height above the terrain top
const SELECT_PULSE = 4;         // selection ring pulse speed, radians per second
const FALLBACK_PALETTE = {
  bg: '#0B1118', surface: '#121C26', surfaceRaised: '#1B2834', text: '#E6EEF4', textMuted: '#8A9BAA', accent: '#3FD0E8',
  xcom: '#4AA8FF', alien: '#E5484D', moveBlue: '#2F8CFF', moveYellow: '#F2C94C', danger: '#FF3B3B',
  halfCover: '#6E9BB8', fullCover: '#43C4F0', crit: '#FFB13B',
};
const TOKEN_NAMES = {
  bg: '--bg', surface: '--surface', surfaceRaised: '--surface-raised', text: '--text', textMuted: '--text-muted', accent: '--accent',
  xcom: '--xcom', alien: '--alien', moveBlue: '--move-blue', moveYellow: '--move-yellow', danger: '--danger',
  halfCover: '--half-cover', fullCover: '--full-cover', crit: '--crit',
};
// Footprint (fraction of a tile) and colour mix for each prop kind.
const PROP_LOOK = {
  crate: { footprint: 0.78, color: 'halfCover', shade: 0.75 },
  barrier: { footprint: 0.96, color: 'halfCover', shade: 0.55 },
  wall: { footprint: 0.98, color: 'textMuted', shade: 0.55 },
  rock: { footprint: 0.9, color: 'textMuted', shade: 0.85 },
  barrel: { footprint: 0.5, color: 'danger', shade: 0.7 },
};

/** Reads the palette tokens from style.css; falls back to the plan's Command Cyan hexes. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function readPalette(root = document.documentElement) {
  const style = getComputedStyle(root);
  const palette = {};
  for (const [key, cssName] of Object.entries(TOKEN_NAMES)) {
    palette[key] = style.getPropertyValue(cssName).trim() || FALLBACK_PALETTE[key];
  }
  return palette;
}

export class Renderer {
  /** palette is an object keyed like FALLBACK_PALETTE; omitted, it is read from the page's CSS tokens. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  constructor(canvas, palette = readPalette()) {
    this.canvas = canvas;
    this.palette = palette;
    this.grid = null;
    this.colors = {};
    for (const key of Object.keys(FALLBACK_PALETTE)) this.colors[key] = new THREE.Color(palette[key] ?? FALLBACK_PALETTE[key]);

    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.background = this.colors.bg;
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.5, 300);

    this.scene.add(new THREE.HemisphereLight(0xdcecff, 0x2a3440, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-10, 24, 14);
    this.scene.add(sun);

    this.terrainGroup = new THREE.Group();
    this.propGroup = new THREE.Group();
    this.unitGroup = new THREE.Group();
    this.overlayGroup = new THREE.Group();
    this.scene.add(this.terrainGroup, this.propGroup, this.unitGroup, this.overlayGroup);

    this.terrainMeshes = [];
    this.propObjects = new Map(); // tile -> Group
    this.unitObjects = new Map(); // unit id -> Group
    this.layers = {};
    for (const name of ['fog', 'move', 'path', 'cover', 'detection', 'target']) {
      this.layers[name] = new THREE.Group();
      this.layers[name].renderOrder = 2;
      this.overlayGroup.add(this.layers[name]);
    }

    this.unitRingMaterials = new Map(); // unit id -> its own ring material (soldier slot colours)
    this.selectRing = null;             // pulsing ring parented to the selected soldier's Group
    this._fogTiles = null;              // visible set the fog layer was last drawn for
    this._clock = new THREE.Clock();

    this._makeSharedResources();
    this._onResize = () => this._resize();
    this._resizeObserver = new ResizeObserver(this._onResize);
    this._resizeObserver.observe(canvas);
    this._resize();
  }

  /** Rebuilds terrain, props and units from a BattleState. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  build(state) {
    this.clearOverlays();
    this._clearLayer('fog');
    this._fogTiles = null;
    this.setSelected(null);
    this._disposeGroup(this.terrainGroup);
    this._disposeGroup(this.propGroup);
    this._disposeGroup(this.unitGroup);
    this.terrainMeshes = [];
    this.propObjects.clear();
    this.unitObjects.clear();
    for (const material of this.unitRingMaterials.values()) material.dispose();
    this.unitRingMaterials.clear();
    this.grid = state.grid;

    this._buildTerrain();
    this.grid.props.forEach((prop, tile) => { if (prop) this._addProp(tile, prop.kind); });
    for (const id of Object.keys(state.units).sort()) this._addUnit(state.units[id]);
  }

  /** The unit's Group (origin at its feet). Hidden when dead. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  unitObject(unitId) {
    return this.unitObjects.get(unitId);
  }

  /** Snaps every unit object to its state tile and visibility (after load, or when tweens finish). @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  syncUnits(state) {
    for (const unit of Object.values(state.units)) {
      const object = this.unitObjects.get(unit.id);
      if (!object) continue;
      this.tileCenter(unit.tile, object.position);
      object.visible = unit.hp > 0;
    }
  }

  /** Middle of the tile on its terrain top surface. Pass target to avoid an allocation. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  tileCenter(tile, target = new THREE.Vector3()) {
    const [x, z] = toXZ(this.grid, tile);
    return target.set(x + 0.5, this.grid.heights[tile] * HEIGHT_STEP, z + 0.5);
  }

  /** reachMap is the pathfinder's Map<tile, { apCost }>. Blue marks apCost <= 1, yellow marks apCost 2; yellow outlines the whole dash area. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  showMoveRange(reachMap) {
    const layer = this._clearLayer('move');
    const blue = new Set();
    const all = new Set();
    for (const [tile, info] of reachMap) {
      all.add(tile);
      if (info.apCost <= 1) blue.add(tile);
    }
    const yellowOnly = [...all].filter((tile) => !blue.has(tile));

    this._addQuads(layer, this._tileRects(yellowOnly, 0.012, 0.03), this.colors.moveYellow, 0.16);
    this._addQuads(layer, this._tileRects([...blue], 0.016, 0.03), this.colors.moveBlue, 0.2);
    this._addQuads(layer, this._perimeterRects(all, 0.03), this.colors.moveYellow, 1);
    this._addQuads(layer, this._perimeterRects(blue, 0.04), this.colors.moveBlue, 1);
  }

  /** Reticle brackets plus a shield on each covered edge; tile -1 clears. flanked lists edge indices (0 n, 1 e, 2 s, 3 w) drawn yellow. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  showCoverShields(state, tile, flanked = []) {
    const layer = this._clearLayer('cover');
    if (tile === -1) return;
    const [x, z] = toXZ(this.grid, tile);
    const top = this.grid.heights[tile] * HEIGHT_STEP;

    const brackets = [];
    const len = 0.28;
    const w = MARKER_WIDTH * 0.8;
    for (const [cx, cz] of [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]]) {
      const sx = cx === x ? 1 : -1;
      const sz = cz === z ? 1 : -1;
      const y = top + 0.05;
      brackets.push({ x0: Math.min(cx - w / 2, cx + sx * len), x1: Math.max(cx + w / 2, cx + sx * len), z0: cz - w / 2, z1: cz + w / 2, y });
      brackets.push({ x0: cx - w / 2, x1: cx + w / 2, z0: Math.min(cz - w / 2, cz + sz * len), z1: Math.max(cz + w / 2, cz + sz * len), y });
    }
    this._addQuads(layer, brackets, this.colors.accent, 1);

    const edges = this.grid.edgeCover[tile];
    for (let k = 0; k < 4; k++) {
      if (edges[k] === 'none') continue;
      const color = flanked.includes(k) ? this.colors.moveYellow : edges[k] === 'full' ? this.colors.fullCover : this.colors.halfCover;
      const material = this._shieldMaterial(color);
      const mesh = new THREE.Mesh(edges[k] === 'full' ? this.shieldSolid : this.shieldOutline, material);
      mesh.position.set(x + 0.5 + DIRS[k][0] * 0.4, top + 0.75, z + 0.5 + DIRS[k][1] * 0.4);
      mesh.scale.setScalar(1.3);
      mesh.userData.isShield = true;
      layer.add(mesh);
    }
  }

  /**
   * Hatched red tiles inside a living alien's detection radius, shown only while the squad is concealed.
   * alienIds limits them to those aliens (the ones the fog shows); null draws every alien's.
   * @created Claude (claude-sonnet-5-5) - 2026-10-21
   * @modified Claude (claude-opus-5-5) - 2026-10-22 - alienIds
   */
  showDetection(state, alienIds = null) {
    const layer = this._clearLayer('detection');
    if (!state.squadConcealed) return;
    const tiles = new Set();
    for (const unit of Object.values(state.units)) {
      if (unit.team !== 'alien' || unit.hp <= 0) continue;
      if (alienIds && !alienIds.has(unit.id)) continue;
      const radius = unit.stats.detection;
      const [ux, uz] = toXZ(this.grid, unit.tile);
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dz * dz > radius * radius) continue;
          const t = toIndex(this.grid, ux + dx, uz + dz);
          if (t !== -1 && this.grid.props[t] === null) tiles.add(t);
        }
      }
    }
    this._addQuads(layer, this._tileRects([...tiles], 0.02, 0.02), this.colors.danger, 0.7, this.hatchTexture);
  }

  /**
   * Move path (plan 0003 Layout B): a solid line through the tile centres, an arrowhead into the last tile and a dot on it.
   * tiles starts at the soldier's own tile; fewer than 2 tiles clears.
   * @created Claude (claude-opus-5-5) - 2026-10-22
   */
  showPath(tiles, color = this.colors.accent) {
    const layer = this._clearLayer('path');
    if (tiles.length < 2) return;
    const points = tiles.map((t) => this.tileCenter(t).setY(this.grid.heights[t] * HEIGHT_STEP + PATH_LIFT));
    const end = points[points.length - 1];
    const lastDir = end.clone().sub(points[points.length - 2]).setY(0).normalize();
    // The line stops where the arrowhead starts.
    points[points.length - 1] = end.clone().addScaledVector(lastDir, -0.32);
    const triangles = [];
    const quad = (a, b, w) => {
      const side = new THREE.Vector3(b.z - a.z, 0, a.x - b.x).normalize().multiplyScalar(w / 2);
      const p = [a.clone().add(side), b.clone().add(side), b.clone().sub(side), a.clone().sub(side)];
      triangles.push(p[0], p[1], p[2], p[0], p[2], p[3]);
    };
    for (let k = 1; k < points.length; k++) {
      const a = points[k - 1];
      const b = points[k];
      // Each segment runs half a width past both ends so the corners close.
      const dir = b.clone().sub(a).setY(0).normalize().multiplyScalar(PATH_WIDTH / 2);
      quad(a.clone().sub(dir), b.clone().add(dir), PATH_WIDTH);
    }
    const base = points[points.length - 1];
    const tip = end.clone().addScaledVector(lastDir, -0.1);
    const wing = new THREE.Vector3(lastDir.z, 0, -lastDir.x).multiplyScalar(0.16);
    triangles.push(base.clone().add(wing), tip, base.clone().sub(wing));
    for (let k = 0; k < 16; k++) {
      const a0 = (k / 16) * Math.PI * 2;
      const a1 = ((k + 1) / 16) * Math.PI * 2;
      triangles.push(end, end.clone().add(new THREE.Vector3(Math.cos(a1) * 0.1, 0, Math.sin(a1) * 0.1)),
        end.clone().add(new THREE.Vector3(Math.cos(a0) * 0.1, 0, Math.sin(a0) * 0.1)));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(triangles);
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 3;
    mesh.raycast = () => {};
    layer.add(mesh);
  }

  /** Gives one unit its own ring colour (soldier slot colours from the Roster). @created Claude (claude-opus-5-5) - 2026-10-22 */
  setUnitColor(unitId, color) {
    const object = this.unitObjects.get(unitId);
    if (!object || !color) return;
    let material = this.unitRingMaterials.get(unitId);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      this.unitRingMaterials.set(unitId, material);
    }
    material.color.set(color);
    object.userData.ring.material = material;
  }

  /** Larger pulsing ring in the unit's ring colour under the selected soldier; null clears. @created Claude (claude-opus-5-5) - 2026-10-22 */
  setSelected(unitId) {
    if (this.selectRing && unitId && this.selectRing.parent === this.unitObjects.get(unitId)) return;
    if (this.selectRing) {
      this.selectRing.parent?.remove(this.selectRing);
      this.selectRing.material.dispose();
      this.selectRing = null;
    }
    const object = unitId ? this.unitObjects.get(unitId) : null;
    if (!object) return;
    const material = new THREE.MeshBasicMaterial({ color: object.userData.ring.material.color, side: THREE.DoubleSide, transparent: true, depthWrite: false });
    this.selectRing = new THREE.Mesh(this.selectGeometry, material);
    this.selectRing.rotation.x = -Math.PI / 2;
    this.selectRing.position.y = 0.03;
    this.selectRing.raycast = () => {};
    object.add(this.selectRing);
  }

  /** Thin line from one tile's unit centre to another's. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  showTargetLine(fromTile, toTile, color = this.colors.crit) {
    const layer = this._clearLayer('target');
    const from = this.tileCenter(fromTile);
    const to = this.tileCenter(toTile);
    from.y += UNIT_BODY * 0.8;
    to.y += UNIT_BODY * 0.8;
    const dir = to.clone().sub(from);
    const length = dir.length();
    if (length === 0) return;
    const geometry = new THREE.CylinderGeometry(0.025, 0.025, length, 6);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true }));
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.renderOrder = 3;
    layer.add(mesh);
  }

  /**
   * Dark quads over every tile outside visibleTiles (plan 0003 fog). Lives in its own layer, which clearOverlays leaves alone.
   * Skips the rebuild when the set matches the last one drawn, since the fog refreshes on every playback step.
   * @created Claude (claude-opus-5-5) - 2026-10-22
   */
  showFog(visibleTiles) {
    const last = this._fogTiles;
    if (last && last.size === visibleTiles.size && [...visibleTiles].every((t) => last.has(t))) return;
    this._fogTiles = new Set(visibleTiles);
    const layer = this._clearLayer('fog');
    const hidden = [];
    for (let tile = 0; tile < this.grid.heights.length; tile++) if (!visibleTiles.has(tile)) hidden.push(tile);
    this._addQuads(layer, this._tileRects(hidden, 0.008, 0), this.colors.bg, FOG_OPACITY);
  }

  /** Shows or hides a unit for the fog. syncUnits resets visibility to hp > 0, so the fog refreshes after it. @created Claude (claude-opus-5-5) - 2026-10-22 */
  setUnitShown(unitId, shown) {
    const object = this.unitObjects.get(unitId);
    if (object) object.visible = shown;
  }

  /**
   * Every overlay layer except the fog.
   * @created Claude (claude-sonnet-5-5) - 2026-10-21
   * @modified Claude (claude-opus-5-5) - 2026-10-22 - fog layer kept
   */
  clearOverlays() {
    for (const name of Object.keys(this.layers)) if (name !== 'fog') this._clearLayer(name);
  }

  /** Removes the prop on tile (CoverDestroyed) and puts a rubbleKind prop there when given. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  removeProp(tile, rubbleKind = null) {
    const old = this.propObjects.get(tile);
    if (old) {
      this.propGroup.remove(old);
      this._disposeObject(old);
      this.propObjects.delete(tile);
    }
    if (rubbleKind) this._addProp(tile, rubbleKind);
  }

  /** Draws one frame. @created Claude (claude-sonnet-5-5) - 2026-10-21 @modified Claude (claude-opus-5-5) - 2026-10-22 - selection pulse */
  render() {
    if (this.selectRing) {
      const wave = Math.sin(this._clock.getElapsedTime() * SELECT_PULSE);
      this.selectRing.scale.setScalar(1 + 0.08 * wave);
      this.selectRing.material.opacity = 0.75 + 0.25 * wave;
    }
    // Shield icons turn to face the camera so they never read edge-on.
    const cam = this.camera.position;
    for (const shield of this.layers.cover.children) {
      if (shield.userData.isShield) shield.rotation.y = Math.atan2(cam.x - shield.position.x, cam.z - shield.position.z);
    }
    this.webgl.render(this.scene, this.camera);
  }

  /** Visible unit Groups, for the picker. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  pickableUnits() {
    return this.unitGroup.children.filter((object) => object.visible);
  }

  /** Terrain meshes and prop Groups, for the picker. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  pickableTiles() {
    return [...this.terrainMeshes, ...this.propGroup.children];
  }

  /** Unit id for a raycast hit on a unit Group, else null. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  unitIdFromHit(hit) {
    for (let o = hit.object; o; o = o.parent) if (o.userData.unitId !== undefined) return o.userData.unitId;
    return null;
  }

  /** Tile index for a raycast hit on terrain or a prop, else -1. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  tileFromHit(hit) {
    if (hit.instanceId !== undefined && hit.object.userData.tiles) return hit.object.userData.tiles[hit.instanceId];
    for (let o = hit.object; o; o = o.parent) if (o.userData.tile !== undefined) return o.userData.tile;
    return -1;
  }

  /** Releases GPU resources and the resize observer. @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  dispose() {
    this._resizeObserver.disconnect();
    this.clearOverlays();
    this._clearLayer('fog');
    this.setSelected(null);
    this._disposeGroup(this.terrainGroup);
    this._disposeGroup(this.propGroup);
    this._disposeGroup(this.unitGroup);
    for (const material of this.unitRingMaterials.values()) material.dispose();
    this.webgl.dispose();
  }

  // Geometry and materials reused across builds.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _makeSharedResources() {
    this.shared = [];
    const keep = (resource) => { this.shared.push(resource); return resource; };

    this.unitGeometry = keep(new THREE.CapsuleGeometry(UNIT_RADIUS, UNIT_BODY - UNIT_RADIUS * 2, 4, 12));
    this.ringGeometry = keep(new THREE.RingGeometry(0.3, 0.42, 28));
    this.selectGeometry = keep(new THREE.RingGeometry(0.46, 0.56, 36));
    this.unitMaterials = {
      xcom: keep(new THREE.MeshLambertMaterial({ color: this.colors.xcom })),
      alien: keep(new THREE.MeshLambertMaterial({ color: this.colors.alien })),
    };
    this.ringMaterials = {
      xcom: keep(new THREE.MeshBasicMaterial({ color: this.colors.xcom, side: THREE.DoubleSide })),
      alien: keep(new THREE.MeshBasicMaterial({ color: this.colors.alien, side: THREE.DoubleSide })),
    };

    this.propMaterials = {};
    this.propGeometries = {};
    this.propEdgeMaterial = keep(new THREE.LineBasicMaterial({ color: this.colors.bg }));
    for (const [kind, look] of Object.entries(PROP_LOOK)) {
      this.propMaterials[kind] = keep(new THREE.MeshLambertMaterial({ color: this.colors[look.color].clone().multiplyScalar(look.shade) }));
      const box = keep(new THREE.BoxGeometry(look.footprint, PROPS[kind].height * HEIGHT_STEP, look.footprint));
      this.propGeometries[kind] = { box, edges: keep(new THREE.EdgesGeometry(box)) };
    }

    // Shield icon (R10): solid for full cover, outline for half cover.
    const outer = new THREE.Shape();
    this._shieldPath(outer, 1);
    const hole = new THREE.Path();
    this._shieldPath(hole, 0.62);
    outer.holes.push(hole);
    this.shieldOutline = keep(new THREE.ShapeGeometry(outer));
    const solid = new THREE.Shape();
    this._shieldPath(solid, 0.86);
    this.shieldSolid = keep(new THREE.ShapeGeometry(solid));
    this.shieldMaterials = new Map();

    // Diagonal hatch for danger tiles (R11).
    const hatch = document.createElement('canvas');
    hatch.width = hatch.height = 32;
    const ctx = hatch.getContext('2d');
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    for (let k = -32; k <= 64; k += 16) {
      ctx.beginPath();
      ctx.moveTo(k, 32);
      ctx.lineTo(k + 32, 0);
      ctx.stroke();
    }
    this.hatchTexture = keep(new THREE.CanvasTexture(hatch));
    this.hatchTexture.colorSpace = THREE.SRGBColorSpace;
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _shieldPath(path, scale) {
    const s = scale;
    path.moveTo(-0.2 * s, 0.23 * s);
    path.lineTo(0.2 * s, 0.23 * s);
    path.lineTo(0.2 * s, -0.02 * s);
    path.quadraticCurveTo(0.2 * s, -0.17 * s, 0, -0.25 * s);
    path.quadraticCurveTo(-0.2 * s, -0.17 * s, -0.2 * s, -0.02 * s);
    path.closePath();
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _shieldMaterial(color) {
    const key = color.getHex();
    if (!this.shieldMaterials.has(key)) {
      const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
      this.shared.push(material);
      this.shieldMaterials.set(key, material);
    }
    return this.shieldMaterials.get(key);
  }

  // One InstancedMesh per height level; the instance colour carries a faint checker so tiles read apart.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _buildTerrain() {
    const { heights, width } = this.grid;
    const byLevel = new Map();
    heights.forEach((h, tile) => {
      if (!byLevel.has(h)) byLevel.set(h, []);
      byLevel.get(h).push(tile);
    });

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (const [level, tiles] of [...byLevel].sort((a, b) => a[0] - b[0])) {
      const top = level * HEIGHT_STEP;
      const geometry = new THREE.BoxGeometry(TILE_GAP, top + BASE_DEPTH, TILE_GAP);
      const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ color: 0xffffff }), tiles.length);
      const base = this.colors.surfaceRaised.clone().lerp(this.colors.textMuted, 0.2 * level);
      tiles.forEach((tile, k) => {
        const x = tile % width;
        const z = Math.floor(tile / width);
        matrix.makeTranslation(x + 0.5, (top - BASE_DEPTH) / 2, z + 0.5);
        mesh.setMatrixAt(k, matrix);
        mesh.setColorAt(k, color.copy(base).multiplyScalar((x + z) % 2 === 0 ? 1.07 : 0.93));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.userData.tiles = tiles;
      mesh.userData.level = level;
      this.terrainGroup.add(mesh);
      this.terrainMeshes.push(mesh);
    }
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _addProp(tile, kind) {
    const geometry = this.propGeometries[kind];
    const group = new THREE.Group();
    group.userData.tile = tile;
    group.add(new THREE.Mesh(geometry.box, this.propMaterials[kind]));
    const edges = new THREE.LineSegments(geometry.edges, this.propEdgeMaterial);
    edges.raycast = () => {};
    group.add(edges);
    const p = this.tileCenter(tile);
    group.position.set(p.x, p.y + PROPS[kind].height * HEIGHT_STEP / 2, p.z);
    this.propGroup.add(group);
    this.propObjects.set(tile, group);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _addUnit(unit) {
    const group = new THREE.Group();
    group.userData.unitId = unit.id;
    const body = new THREE.Mesh(this.unitGeometry, this.unitMaterials[unit.team]);
    body.position.y = UNIT_BODY / 2;
    const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterials[unit.team]);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(body, ring);
    group.userData.ring = ring;
    this.tileCenter(unit.tile, group.position);
    group.visible = unit.hp > 0;
    this.unitGroup.add(group);
    this.unitObjects.set(unit.id, group);
  }

  // Rects are { x0, x1, z0, z1, y } flat quads in world space.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _tileRects(tiles, lift, inset) {
    return tiles.map((tile) => {
      const [x, z] = toXZ(this.grid, tile);
      return { x0: x + inset, x1: x + 1 - inset, z0: z + inset, z1: z + 1 - inset, y: this.grid.heights[tile] * HEIGHT_STEP + lift };
    });
  }

  // Strips along every tile edge whose neighbour is outside the set, extended half a width at each end so corners join.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _perimeterRects(set, lift) {
    const rects = [];
    const h = MARKER_WIDTH / 2;
    for (const tile of set) {
      const [x, z] = toXZ(this.grid, tile);
      const y = this.grid.heights[tile] * HEIGHT_STEP + lift;
      DIRS.forEach(([dx, dz], k) => {
        const n = toIndex(this.grid, x + dx, z + dz);
        if (n !== -1 && set.has(n)) return;
        if (k === 0) rects.push({ x0: x - h, x1: x + 1 + h, z0: z - h, z1: z + h, y });
        else if (k === 2) rects.push({ x0: x - h, x1: x + 1 + h, z0: z + 1 - h, z1: z + 1 + h, y });
        else if (k === 1) rects.push({ x0: x + 1 - h, x1: x + 1 + h, z0: z - h, z1: z + 1 + h, y });
        else rects.push({ x0: x - h, x1: x + h, z0: z - h, z1: z + 1 + h, y });
      });
    }
    return rects;
  }

  // Merges rects into one mesh with a flat-colour (optionally textured) material.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _addQuads(layer, rects, color, opacity, map = null) {
    if (rects.length === 0) return;
    const positions = new Float32Array(rects.length * 12);
    const uvs = new Float32Array(rects.length * 8);
    const indices = new Uint32Array(rects.length * 6);
    rects.forEach((r, k) => {
      positions.set([r.x0, r.y, r.z0, r.x1, r.y, r.z0, r.x1, r.y, r.z1, r.x0, r.y, r.z1], k * 12);
      uvs.set([0, 0, 1, 0, 1, 1, 0, 1], k * 8);
      indices.set([k * 4, k * 4 + 2, k * 4 + 1, k * 4, k * 4 + 3, k * 4 + 2], k * 6);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const material = new THREE.MeshBasicMaterial({
      color, map, opacity, transparent: opacity < 1 || map !== null, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.raycast = () => {};
    layer.add(mesh);
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _clearLayer(name) {
    const layer = this.layers[name];
    for (const child of [...layer.children]) {
      layer.remove(child);
      // Shield meshes share geometry and material; everything else in a layer owns its own.
      if (child.geometry && !this.shared.includes(child.geometry)) child.geometry.dispose();
      if (child.material && !this.shared.includes(child.material)) child.material.dispose();
    }
    return layer;
  }

  // Disposes owned geometry and materials only; shared resources live until dispose().
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _disposeGroup(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      this._disposeObject(child);
    }
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _disposeObject(object) {
    object.traverse((o) => {
      if (o.isInstancedMesh) {
        o.geometry.dispose();
        o.material.dispose();
        o.dispose();
      }
    });
  }

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  _resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    this.webgl.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
