// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Registry of everything the camera can photograph.

import * as THREE from 'three';

/**
 * @typedef {Object} Subject
 * @property {string} id
 * @property {string} type
 * @property {'landmark'|'critter'} kind
 * @property {THREE.Object3D} object3d
 * @property {THREE.Vector3[]} samplePoints  Local to object3d
 * @property {() => string|null} getAction
 */

const subjects = [];

export function registerSubject({ id, type, kind, object3d, samplePoints, getAction = () => null }) {
  subjects.push({ id, type, kind, object3d, samplePoints, getAction });
}

export function getSubjects() {
  return subjects;
}

/**
 * Spreads 12 sample points over an object's local bounding box: 8 inset corners, the center and
 * the centers of the top, front and back faces. Call before the object is posed in the world.
 */
export function samplePointsFor(object3d, inset = 0.7) {
  object3d.updateMatrixWorld(true);
  const inverse = object3d.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  object3d.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld).applyMatrix4(inverse);
    box.union(b);
  });
  const c = box.getCenter(new THREE.Vector3());
  const h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const points = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    points.push(new THREE.Vector3(c.x + sx * h.x * inset, c.y + sy * h.y * inset, c.z + sz * h.z * inset));
  }
  points.push(c.clone(), new THREE.Vector3(c.x, c.y + h.y * 0.9, c.z));
  points.push(new THREE.Vector3(c.x, c.y, c.z + h.z * 0.95), new THREE.Vector3(c.x, c.y, c.z - h.z * 0.95));
  return points;
}
