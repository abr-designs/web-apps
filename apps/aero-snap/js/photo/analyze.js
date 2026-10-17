// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Measures what a photo shows: per subject, how much is visible, how big and how centered it is.

import * as THREE from 'three';

const TOLERANCE = 0.05;
const MAX_DISTANCE = 160;

const ray = new THREE.Raycaster();
const world = new THREE.Vector3();
const ndc = new THREE.Vector3();
const dir = new THREE.Vector3();

function isWithin(object, root) {
  for (let o = object; o; o = o.parent) if (o === root) return true;
  return false;
}

/**
 * @param {THREE.PerspectiveCamera} camera  The exact camera the photo was taken with
 * @param {import('../subjects.js').Subject[]} subjects
 * @param {THREE.Object3D[]} occluders
 * @returns {import('./scoring.js').SubjectResult[]} Subjects with at least one point in frame
 */
export function analyzeShot(camera, subjects, occluders) {
  const results = [];
  const origin = camera.position;
  for (const s of subjects) {
    s.object3d.updateWorldMatrix(true, false);
    let visible = 0;
    let inFrame = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const local of s.samplePoints) {
      world.copy(local).applyMatrix4(s.object3d.matrixWorld);
      const dist = world.distanceTo(origin);
      ndc.copy(world).project(camera);
      if (ndc.z > 1 || ndc.z < -1 || dist > MAX_DISTANCE) continue;
      const x = THREE.MathUtils.clamp(ndc.x, -1, 1);
      const y = THREE.MathUtils.clamp(ndc.y, -1, 1);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) continue;
      inFrame++;
      ray.set(origin, dir.subVectors(world, origin).normalize());
      ray.far = dist - TOLERANCE;
      const blocked = ray.intersectObjects(occluders, true).some((hit) => !isWithin(hit.object, s.object3d));
      if (!blocked) visible++;
    }
    if (inFrame === 0) continue;
    results.push({
      id: s.id,
      type: s.type,
      kind: s.kind,
      visibleRatio: visible / s.samplePoints.length,
      heightRatio: (maxY - minY) / 2,
      centerOffset: Math.hypot((minX + maxX) / 2, (minY + maxY) / 2) / Math.SQRT2,
      action: s.getAction(),
    });
  }
  return results;
}
