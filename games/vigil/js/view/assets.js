// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22
// Loads every unit model, gear piece and clip once (plan 0004) and hands out clones. Character clones get their own skeleton
// (SkeletonUtils.clone) and their own copies of the tintable materials; geometry, textures and clips stay shared.

import * as THREE from '../../vendor/three.module.min.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import * as SkeletonUtils from '../../vendor/SkeletonUtils.js';
import { MODEL_FILES, MATERIAL_ROLES } from '../data/looks.js';

const BASE = new URL('../../', import.meta.url); // games/vigil/, which MODEL_FILES paths are relative to

export class AssetLibrary {
  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  constructor({ loader = new GLTFLoader() } = {}) {
    this.loader = loader;
    this.characters = new Map(); // model key -> gltf scene
    this.gear = new Map();       // gear key -> gltf scene
    this.clips = new Map();      // asset clip name -> AnimationClip
    this._fitted = new Map();    // 'model/clip' -> AnimationClip limited to that model's bones
    this._boneNames = new Map(); // model key -> Set of bone names
    this._ready = null;
  }

  /** Loads every file in parallel; rejects when any fails. Repeat calls return the same promise. @created Claude (claude-opus-5-5) - 2026-10-22 */
  load() {
    this._ready ??= Promise.all([
      this._fetch(MODEL_FILES.clips).then((gltf) => { for (const clip of gltf.animations) this.clips.set(clip.name, clip); }),
      ...Object.entries(MODEL_FILES.characters).map(([key, path]) => this._fetch(path).then((gltf) => this.characters.set(key, gltf.scene))),
      ...Object.entries(MODEL_FILES.gear).map(([key, path]) => this._fetch(path).then((gltf) => this.gear.set(key, gltf.scene))),
    ]).then(() => this._greyTrim());
    return this._ready;
  }

  /** Skinned clone of a MODEL_FILES.characters model with its own tintable materials. Throws on an unknown key. @created Claude (claude-opus-5-5) - 2026-10-22 */
  cloneRig(model) {
    const source = this.characters.get(model);
    if (!source) throw new Error(`AssetLibrary: no character "${model}"`);
    const rig = SkeletonUtils.clone(source);
    rig.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map(cloneTintable) : cloneTintable(o.material);
    });
    return rig;
  }

  /** Clone of one gear piece; its materials are shared. Throws on an unknown key. @created Claude (claude-opus-5-5) - 2026-10-22 */
  cloneGear(id) {
    const source = this.gear.get(id);
    if (!source) throw new Error(`AssetLibrary: no gear "${id}"`);
    return source.clone();
  }

  // The mannequin lacks the skeletons' handslot bones, and three warns for every track with no target, so each model gets
  // its own copy of a clip holding only the tracks for bones it has. Copies share the keyframe arrays.
  /** An AnimationClip by its name in clips.glb, fitted to a characters model, or null. Looks resolve logical names first (clipName in looks.js). @created Claude (claude-opus-5-5) - 2026-10-22 */
  clip(name, model) {
    const source = this.clips.get(name);
    if (!source) return null;
    const key = `${model}/${name}`;
    if (!this._fitted.has(key)) {
      const bones = this._bones(model);
      const tracks = source.tracks.filter((track) => bones.has(track.name.slice(0, track.name.lastIndexOf('.'))));
      this._fitted.set(key, new THREE.AnimationClip(source.name, source.duration, tracks));
    }
    return this._fitted.get(key);
  }

  /** Frees the geometry, materials and textures of every loaded scene. Clones must not be drawn afterwards. @created Claude (claude-opus-5-5) - 2026-10-22 */
  dispose() {
    const textures = new Set();
    for (const scene of [...this.characters.values(), ...this.gear.values()]) {
      scene.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        for (const material of [o.material].flat()) {
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
          material.dispose();
        }
      });
    }
    for (const texture of textures) texture.dispose();
    this.characters.clear();
    this.gear.clear();
    this.clips.clear();
    this._fitted.clear();
    this._boneNames.clear();
    this._ready = null;
  }

  // The mannequin's texture is a colour atlas (left limbs green, right limbs orange), so a slot tint multiplied over it turns
  // muddy. Trim materials get a greyscale copy of their map once at load: the tint then sets the hue, the map keeps the shading and face.
  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _greyTrim() {
    const greyed = new Map(); // source texture -> greyscale copy
    for (const scene of this.characters.values()) {
      scene.traverse((o) => {
        if (!o.isMesh) return;
        for (const material of [o.material].flat()) {
          if (MATERIAL_ROLES[material.name] !== 'trim' || !material.map?.image) continue;
          if (!greyed.has(material.map)) greyed.set(material.map, greyscale(material.map));
          material.map = greyed.get(material.map);
        }
      });
    }
  }

  /** Bone names of a characters model, cached. @created Claude (claude-opus-5-5) - 2026-10-22 */
  _bones(model) {
    if (!this._boneNames.has(model)) {
      const names = new Set();
      this.characters.get(model)?.traverse((o) => { if (o.isBone) names.add(o.name); });
      this._boneNames.set(model, names);
    }
    return this._boneNames.get(model);
  }

  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  _fetch(path) {
    return this.loader.loadAsync(new URL(path, BASE).href);
  }
}

// A copy of a texture with its pixels reduced to luminance, keeping the source's sampling settings (flipY, colour space, wrap).
/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function greyscale(texture) {
  const { image } = texture;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = pixels.data;
  for (let k = 0; k < d.length; k += 4) d[k] = d[k + 1] = d[k + 2] = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
  ctx.putImageData(pixels, 0, 0);
  const copy = texture.clone();
  copy.image = canvas;
  copy.needsUpdate = true;
  return copy;
}

// Only materials with a tint role are copied per unit; the rest stay shared across clones.
/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function cloneTintable(material) {
  return MATERIAL_ROLES[material.name] ? material.clone() : material;
}
