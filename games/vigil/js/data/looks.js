// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22

import { deepFreeze } from './freeze.js';

// Unit looks (plan 0004). Every model and clip in assets/models shares the KayKit Rig_Medium skeleton, so the names below are
// that rig's own. Logical names map to asset names only here, so swapping packs edits this file alone.

// Logical clip -> clip name in assets/models/clips.glb. A look's clips entry overrides any of these for that unit type.
export const CLIPS = deepFreeze({
  idle: 'Idle_A',
  walk: 'Running_HoldingRifle',
  aim: 'Ranged_2H_Aiming',
  fire: 'Ranged_2H_Shoot',
  pistol: 'Ranged_1H_Shoot',
  reload: 'Ranged_2H_Reload',
  cast: 'Ranged_Magic_Shoot',
  melee: 'Melee_1H_Attack_Chop',
  stab: 'Melee_2H_Attack_Stab',
  hit: 'Hit_A',
  crouch: 'Crouching',
  throw: 'Throw',
  death: 'Death_A',
});

// Logical socket -> bone name as three.js names it: GLTFLoader strips the dots (hand.r becomes handr). slotR is the skeletons'
// weapon bone (handslot.r); the mannequin has none, so its gear goes on handR with HAND_SLOT's offset, where handslot.r would be.
export const SOCKETS = deepFreeze({
  handR: 'handr',
  handL: 'handl',
  slotR: 'handslotr',
  chest: 'chest',
  head: 'head',
  hips: 'hips',
});

// handslot.r relative to hand.r on Rig_Medium (0.096 up the hand, 0.0575 back, a quarter turn about z).
const HAND_SLOT = { offset: [0, 0.096, -0.0575], rotation: [0, 0, Math.PI / 2] };
// In the aim and fire clips the hand slot's +x points at the target; the crossbow model runs along +z, so it turns a quarter.
const CROSSBOW = { asset: 'crossbow', socket: 'slotR', rotation: [0, Math.PI / 2, 0], muzzle: true };

// glb material name -> tint role. The mannequin has one textured material, so its slot colour tints the whole body.
export const MATERIAL_ROLES = deepFreeze({
  Character_Material: 'trim',
  skeleton: 'body',
  Glow: 'visor',
});

// Files under games/vigil, loaded by AssetLibrary (js/view/assets.js). characters keys are look models, gear keys are gear assets.
export const MODEL_FILES = deepFreeze({
  clips: 'assets/models/clips.glb',
  characters: {
    mannequin: 'assets/models/mannequin.glb',
    warrior: 'assets/models/skeleton-warrior.glb',
    minion: 'assets/models/skeleton-minion.glb',
    rogue: 'assets/models/skeleton-rogue.glb',
    mage: 'assets/models/skeleton-mage.glb',
  },
  gear: {
    crossbow: 'assets/models/gear/crossbow.glb',
    blade: 'assets/models/gear/blade.glb',
    staff: 'assets/models/gear/staff.glb',
  },
});

// Gear UnitModel builds in code (no file): the squad's guns, the Ranger's sword and the Specialist's drone.
export const CODE_GEAR = deepFreeze(['rifle', 'shotgun', 'sniper', 'cannon', 'pistol', 'sword', 'drone']);

// Rig_Medium models stand about 2.2 units tall; this brings them to about 1.05, the height of RULES.bodyHeight.
const SCALE = 0.48;
const SKELETON_CLIPS = { idle: 'Skeletons_Idle', walk: 'Skeletons_Walking' };

// Shape: { model, scale, clips?: { [logical]: asset clip }, tints: { body?, trim?, visor? },
//          gear: [{ asset | mesh, socket, offset?: [x, y, z], rotation?: [x, y, z], muzzle?: true }] }
// model is a MODEL_FILES.characters key; asset is a MODEL_FILES.gear key; mesh is a CODE_GEAR id. tints name renderer palette
// keys; a soldier's trim is replaced by its roster slot colour. Offsets are in model units (before scale).
export const UNIT_LOOKS = deepFreeze({
  ranger: {
    model: 'mannequin', scale: SCALE, tints: { trim: 'xcom' },
    gear: [
      { mesh: 'shotgun', socket: 'handR', ...HAND_SLOT, muzzle: true },
      { mesh: 'sword', socket: 'chest', offset: [0.15, 0.1, -0.35], rotation: [0, 0, 0.6] },
    ],
  },
  sharpshooter: {
    model: 'mannequin', scale: SCALE, tints: { trim: 'xcom' },
    gear: [{ mesh: 'sniper', socket: 'handR', ...HAND_SLOT, muzzle: true }],
  },
  grenadier: {
    model: 'mannequin', scale: SCALE, tints: { trim: 'xcom' },
    gear: [{ mesh: 'cannon', socket: 'handR', ...HAND_SLOT, muzzle: true }],
  },
  specialist: {
    model: 'mannequin', scale: SCALE, tints: { trim: 'xcom' },
    gear: [
      { mesh: 'rifle', socket: 'handR', ...HAND_SLOT, muzzle: true },
      { mesh: 'drone', socket: 'chest', offset: [0.7, 0.9, -0.2] },
    ],
  },
  trooper: {
    model: 'minion', scale: SCALE, clips: SKELETON_CLIPS, tints: { visor: 'alien' },
    gear: [CROSSBOW],
  },
  officer: {
    model: 'warrior', scale: SCALE, clips: SKELETON_CLIPS, tints: { visor: 'alien' },
    gear: [CROSSBOW],
  },
  stunLancer: {
    model: 'rogue', scale: SCALE, clips: SKELETON_CLIPS, tints: { visor: 'alien' },
    gear: [{ asset: 'blade', socket: 'slotR' }],
  },
  sectoid: {
    model: 'mage', scale: SCALE, clips: { ...SKELETON_CLIPS, fire: CLIPS.cast }, tints: { visor: 'alien' },
    gear: [{ asset: 'staff', socket: 'slotR', muzzle: true }],
  },
});

/** The look for a class or enemy id; unknown ids draw as a trooper. @created Claude (claude-opus-5-5) - 2026-10-22 */
export function lookFor(defId) {
  return UNIT_LOOKS[defId] ?? UNIT_LOOKS.trooper;
}

/** Asset clip name a look plays for a logical clip, or null when the clip is unknown. @created Claude (claude-opus-5-5) - 2026-10-22 */
export function clipName(look, logical) {
  return look.clips?.[logical] ?? CLIPS[logical] ?? null;
}
