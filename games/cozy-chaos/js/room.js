// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
//
// Builds the isometric bedroom from primitive shapes and returns the parts the events animate.
// Floor spans x and z from -5 to 5 at y = 0. The left wall sits at x = -5, the back wall at z = -5.

import * as THREE from '../vendor/three.module.min.js';

const C = {
  wall: 0xd24a64, slab: 0x3f4660, floorA: 0xc98a4b, floorB: 0xbb7c3f,
  cream: 0xfbf3e6, white: 0xfffaf2, coral: 0xff6b6b, coralDark: 0xe2525c, lavender: 0xb9a2e8,
  teal: 0x6fd3e0, pink: 0xf4b6c6, rose: 0xf29bb5, sky: 0xcfe3f7, babyBlue: 0xbfe3f0, wood: 0x8a5a3b,
  soil: 0x6b4a33, leaf: 0x6bbf59, leafDark: 0x4e9f45, orange: 0xf7a35c, yellow: 0xffd166,
  mouse: 0x9a9aa6, ink: 0x2a1a24,
};

const HIT_MAT = new THREE.MeshBasicMaterial();

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function mat(color, extra) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function mesh(geo, material) {
  const m = new THREE.Mesh(geo, material instanceof THREE.Material ? material : mat(material));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function box(w, h, d, color) {
  return mesh(new THREE.BoxGeometry(w, h, d), color);
}

/** Box with every edge rounded by radius r, built as a bevelled extrusion. @created Claude (claude-opus-5-5) 2026-10-16 */
function rbox(w, h, d, r, color) {
  r = Math.min(r, w / 2 - 0.005, h / 2 - 0.005, d / 2 - 0.005);
  const x = w / 2 - r;
  const y = h / 2 - r;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(x, -y);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.lineTo(-x, -y);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 4,
  });
  geo.center();
  return mesh(geo, color);
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function cyl(rTop, rBottom, h, color, seg = 20) {
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color);
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function sphere(r, color) {
  return mesh(new THREE.SphereGeometry(r, 16, 12), color);
}

/** Invisible mesh that only exists to make a small object easier to click. @created Claude (claude-opus-5-5) 2026-10-16 */
function hitBox(geo) {
  const m = new THREE.Mesh(geo, HIT_MAT);
  m.visible = false;
  return m;
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function put(parent, obj, x, y, z) {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function plant(scale, potColor) {
  const g = new THREE.Group();
  put(g, cyl(0.35, 0.27, 0.6, potColor), 0, 0.3, 0);
  put(g, cyl(0.31, 0.31, 0.04, C.soil), 0, 0.6, 0);
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.ConeGeometry(0.11, 1.1 + (i % 3) * 0.2, 6);
    geo.translate(0, (1.1 + (i % 3) * 0.2) / 2, 0);
    const leaf = put(g, mesh(geo, i % 2 ? C.leaf : C.leafDark), 0, 0.6, 0);
    leaf.rotation.set(0, i * 0.8, 0.25 + (i % 3) * 0.18);
  }
  g.scale.setScalar(scale);
  return g;
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function curtain() {
  const geo = new THREE.PlaneGeometry(0.9, 2.9, 14, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 14) * 0.06);
  geo.computeVertexNormals();
  geo.translate(0, -1.45, 0);
  return mesh(geo, mat(C.cream, { side: THREE.DoubleSide }));
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfff1e6, 0x8e2440, 1.5));
  const sun = new THREE.DirectionalLight(0xfff4e8, 2.2);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildShell(room) {
  put(room, box(10.3, 0.6, 10.3, C.slab), -0.15, -0.34, -0.15);
  const rows = 12;
  const rowW = 10 / rows;
  for (let i = 0; i < rows; i++) {
    const z = -5 + (i + 0.5) * rowW;
    const split = -3.5 + ((i * 3.7) % 7);
    [[-5, split], [split, 5]].forEach(([a, b], j) => {
      put(room, box(b - a - 0.03, 0.08, rowW - 0.03, (i + j) % 2 ? C.floorA : C.floorB), (a + b) / 2, -0.04, z).castShadow = false;
    });
  }

  const wallMat = mat(C.wall);
  put(room, mesh(new THREE.BoxGeometry(0.3, 6, 10.3), wallMat), -5.15, 3, -0.15);
  put(room, mesh(new THREE.BoxGeometry(10, 6, 0.3), wallMat), 0, 3, -5.15);
  put(room, box(0.08, 0.35, 10, C.cream), -4.96, 0.175, 0);
  put(room, box(10, 0.35, 0.08, C.cream), 0, 0.175, -4.96);
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildMouseHole(room, z) {
  const arch = new THREE.Shape();
  arch.moveTo(-0.32, 0);
  arch.lineTo(-0.32, 0.22);
  arch.absarc(0, 0.22, 0.32, Math.PI, 0, true);
  arch.lineTo(0.32, 0);
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(arch), mat(C.ink));
  hole.rotation.y = Math.PI / 2;
  put(room, hole, -4.91, 0.001, z);
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildWindow(room) {
  const x0 = 0.4;
  const w = 2.4;
  const h = 2.2;
  const cy = 3.4;
  const cx = x0 + w / 2;

  put(room, mesh(new THREE.PlaneGeometry(w, h), mat(C.sky, { emissive: C.sky, emissiveIntensity: 0.4 })), cx, cy, -4.995);
  put(room, box(w + 0.3, 0.15, 0.2, C.cream), cx, cy + h / 2 + 0.075, -4.92);
  put(room, box(w + 0.3, 0.15, 0.2, C.cream), cx, cy - h / 2 - 0.075, -4.92);
  put(room, box(0.15, h, 0.2, C.cream), x0 - 0.075, cy, -4.92);
  put(room, box(0.15, h, 0.2, C.cream), x0 + w + 0.075, cy, -4.92);
  put(room, rbox(w + 0.6, 0.12, 0.45, 0.04, C.cream), cx, cy - h / 2 - 0.2, -4.78);

  // Sash hinges on its left edge; rotation.y = -angle swings it into the room.
  const pivot = put(room, new THREE.Group(), x0, cy, -4.93);
  const bar = (bw, bh, x, y) => put(pivot, box(bw, bh, 0.08, C.white), x, y, 0);
  bar(w, 0.1, w / 2, h / 2 - 0.05);
  bar(w, 0.1, w / 2, -h / 2 + 0.05);
  bar(0.1, h, 0.05, 0);
  bar(0.1, h, w - 0.05, 0);
  bar(0.06, h, w / 2, 0);
  bar(w, 0.06, w / 2, 0);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0.3, roughness: 0.1, side: THREE.DoubleSide }),
  );
  put(pivot, glass, w / 2, 0, 0);
  put(pivot, hitBox(new THREE.BoxGeometry(w, h, 0.4)), w / 2, 0, 0);

  const rod = put(room, cyl(0.05, 0.05, w + 1.4, C.wood, 10), cx, cy + h / 2 + 0.45, -4.7);
  rod.rotation.z = Math.PI / 2;
  const curtains = [
    put(room, curtain(), x0 - 0.3, cy + h / 2 + 0.42, -4.7),
    put(room, curtain(), x0 + w + 0.3, cy + h / 2 + 0.42, -4.7),
  ];
  return { pivot, curtains };
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildShelvesAndBooks(room) {
  const shelfX = -3.3;
  put(room, rbox(2.4, 0.14, 0.6, 0.05, C.lavender), shelfX, 3.0, -4.7);
  put(room, rbox(2.4, 0.14, 0.6, 0.05, C.lavender), shelfX, 4.3, -4.7);
  put(room, plant(0.45, C.cream), shelfX + 0.6, 4.37, -4.7);

  const colors = [C.coral, C.yellow, 0x9ed9a0, 0x7fb8e6, C.lavender, C.rose, C.orange];
  return colors.map((color, i) => {
    const h = 0.6 + (i % 3) * 0.07;
    const book = put(room, rbox(0.18, h, 0.45, 0.03, color), shelfX - 1.0 + i * 0.22, 3.07 + h / 2, -4.7);
    book.add(hitBox(new THREE.BoxGeometry(0.7, h + 0.4, 0.9)));
    return { mesh: book, home: book.position.clone() };
  });
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildDesk(room) {
  const desk = put(room, new THREE.Group(), -3.2, 0, -4.35);
  put(desk, rbox(2.4, 0.12, 1.2, 0.05, C.pink), 0, 1.4, 0);
  for (const sx of [-1.1, 1.1]) for (const sz of [-0.5, 0.5]) put(desk, cyl(0.05, 0.05, 1.34, C.white, 8), sx, 0.67, sz);
  const sheet = put(desk, new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.95), mat(C.white, { map: homeworkTexture() })), -0.1, 1.465, 0.15);
  sheet.rotation.set(-Math.PI / 2, 0, 0.15);
  sheet.receiveShadow = true;
  const pencil = put(desk, cyl(0.025, 0.025, 0.6, C.yellow, 8), 0.4, 1.49, 0.3);
  pencil.rotation.set(0, 0.5, Math.PI / 2);
  const hit = put(desk, hitBox(new THREE.BoxGeometry(1.2, 0.5, 1.2)), -0.1, 1.5, 0.15);
  put(desk, cyl(0.3, 0.3, 0.05, C.wood), 0.75, 1.48, -0.2);
  put(desk, cyl(0.08, 0.08, 0.32, C.white, 12), 0.65, 1.66, -0.2);
  put(desk, cyl(0.08, 0.08, 0.26, C.white, 12), 0.85, 1.63, -0.2);
  put(desk, plant(0.4, 0x7fb8e6), -0.8, 1.46, -0.2);

  const chair = put(room, new THREE.Group(), -3.0, 0, -3.3);
  put(chair, rbox(0.8, 0.1, 0.8, 0.04, C.babyBlue), 0, 0.8, 0);
  put(chair, rbox(0.8, 0.7, 0.08, 0.04, C.babyBlue), 0, 1.2, 0.38);
  for (const sx of [-0.33, 0.33]) for (const sz of [-0.33, 0.33]) put(chair, cyl(0.04, 0.04, 0.78, C.rose, 8), sx, 0.39, sz);

  desk.updateMatrixWorld(true);
  return { hit, focus: sheet.getWorldPosition(new THREE.Vector3()) };
}

/** Lined worksheet drawn onto a canvas for the homework sheet on the desk. @created Claude (claude-opus-5-5) 2026-10-16 */
function homeworkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fffaf2';
  g.fillRect(0, 0, 256, 320);
  g.lineWidth = 3;
  g.strokeStyle = '#9cc3e6';
  for (let y = 70; y < 320; y += 30) {
    g.beginPath();
    g.moveTo(16, y);
    g.lineTo(240, y);
    g.stroke();
  }
  g.strokeStyle = '#ff6b6b';
  g.beginPath();
  g.moveTo(40, 0);
  g.lineTo(40, 320);
  g.stroke();
  g.fillStyle = '#3f4660';
  g.font = 'bold 34px sans-serif';
  g.fillText('Homework', 52, 48);
  g.font = '26px sans-serif';
  ['7 + 5 =', '9 - 4 =', '3 × 6 ='].forEach((t, i) => g.fillText(t, 52, 94 + i * 60));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildBed(room) {
  const bed = put(room, new THREE.Group(), -3.25, 0, 2.3);
  put(bed, rbox(0.18, 1.9, 2.5, 0.06, C.lavender), -1.62, 0.95, 0);
  put(bed, rbox(0.18, 1.3, 2.5, 0.06, C.lavender), 1.62, 0.65, 0);
  for (const x of [-1.62, 1.62]) for (const z of [-1.25, 1.25]) {
    put(bed, rbox(0.26, 0.26, 0.26, 0.05, C.lavender), x, x < 0 ? 1.95 : 1.35, z);
  }
  put(bed, rbox(3.2, 0.3, 0.12, 0.04, C.lavender), 0, 0.5, 1.19);
  put(bed, rbox(3.2, 0.3, 0.12, 0.04, C.lavender), 0, 0.5, -1.19);
  put(bed, rbox(3.1, 0.45, 2.3, 0.12, C.white), 0, 0.85, 0);
  put(bed, rbox(2.0, 0.14, 2.4, 0.07, C.white), 0.55, 1.1, 0);
  for (let k = 0; k < 4; k++) put(bed, rbox(0.26, 0.16, 2.42, 0.06, C.lavender), -0.25 + k * 0.5, 1.1, 0);
  const pillow = put(bed, rbox(0.7, 0.28, 1.6, 0.14, C.rose), -1.1, 1.2, 0);
  pillow.rotation.z = 0.15;
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildNightstandAndPhone(room) {
  const stand = put(room, new THREE.Group(), -4.4, 0, -0.1);
  for (const sx of [-0.38, 0.38]) for (const sz of [-0.38, 0.38]) put(stand, cyl(0.05, 0.05, 0.14, C.teal, 8), sx, 0.07, sz);
  put(stand, rbox(1.0, 1.0, 1.0, 0.08, C.teal), 0, 0.62, 0);
  put(stand, rbox(0.06, 0.35, 0.8, 0.03, C.cream), 0.51, 0.62, 0);
  put(stand, sphere(0.06, C.yellow), 0.56, 0.62, 0);

  const phone = put(stand, new THREE.Group(), 0, 1.12, 0);
  put(phone, rbox(0.55, 0.22, 0.5, 0.06, C.coral), 0, 0.11, 0);
  const dial = put(phone, cyl(0.12, 0.12, 0.03, C.cream), 0.12, 0.23, 0);
  dial.rotation.z = -0.3;
  const handset = put(phone, new THREE.Group(), -0.08, 0.3, 0);
  const grip = put(handset, mesh(new THREE.CapsuleGeometry(0.06, 0.4, 4, 10), C.coralDark), 0, 0, 0);
  grip.rotation.x = Math.PI / 2;
  put(handset, sphere(0.1, C.coralDark), 0, -0.02, 0.26);
  put(handset, sphere(0.1, C.coralDark), 0, -0.02, -0.26);
  const hit = put(phone, hitBox(new THREE.SphereGeometry(0.8, 8, 6)), 0, 0.3, 0);

  const sconce = put(room, new THREE.Group(), -4.8, 3.0, -0.1);
  put(sconce, box(0.3, 0.06, 0.06, C.cream), 0.05, 0, 0);
  put(sconce, mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.4, 16), mat(C.white, { emissive: 0xffe2b8, emissiveIntensity: 0.9 })), 0.3, 0.05, 0);
  const glow = new THREE.PointLight(0xffc98a, 7, 8, 2);
  put(room, glow, -4.2, 2.8, -0.1);

  return { group: phone, handset, hit };
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildDecor(room) {
  const frame = (x, y, z, w, h, art, onLeftWall) => {
    const f = onLeftWall ? rbox(0.08, h, w, 0.03, C.cream) : rbox(w, h, 0.08, 0.03, C.cream);
    put(room, f, x, y, z);
    const a = onLeftWall ? box(0.02, h - 0.2, w - 0.2, art) : box(w - 0.2, h - 0.2, 0.02, art);
    put(room, a, onLeftWall ? x + 0.045 : x, y, onLeftWall ? z : z + 0.045);
  };
  frame(-4.96, 4.0, 1.4, 0.9, 1.2, C.orange, true);
  frame(-4.96, 4.4, 3.2, 0.8, 0.9, C.yellow, true);
  frame(-1.0, 4.1, -4.96, 0.8, 1.1, C.teal, false);

  const rug = put(room, new THREE.Group(), 1.4, 0, 1.9);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const petal = put(rug, cyl(0.7, 0.7, 0.03, 0xfff4ea, 28), Math.cos(a) * 0.85, 0.015, Math.sin(a) * 0.85);
    petal.castShadow = false;
  }
  put(rug, cyl(0.55, 0.55, 0.04, C.orange, 28), 0, 0.02, 0).castShadow = false;

  put(room, plant(1.3, C.coral), 3.9, 0, -3.9);
  put(room, plant(0.9, C.lavender), 3.7, 0, 3.6);
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildMouse(scene) {
  const g = new THREE.Group();
  const body = put(g, sphere(0.22, C.mouse), 0, 0.2, 0);
  body.scale.set(1.5, 0.9, 1);
  put(g, sphere(0.14, C.mouse), 0.3, 0.24, 0).scale.set(1.2, 1, 1);
  for (const s of [-1, 1]) {
    const ear = put(g, cyl(0.09, 0.09, 0.02, C.rose, 14), 0.28, 0.4, s * 0.11);
    ear.rotation.z = Math.PI / 2;
    put(g, sphere(0.025, C.ink), 0.43, 0.29, s * 0.06);
  }
  put(g, sphere(0.035, C.rose), 0.48, 0.24, 0);
  const tail = put(g, cyl(0.015, 0.025, 0.55, C.rose, 6), -0.5, 0.14, 0);
  tail.rotation.z = Math.PI / 2 + 0.35;
  g.visible = false;
  scene.add(g);
  return g;
}

/** @created Claude (claude-opus-5-5) 2026-10-16 */
function buildSpider(scene) {
  const group = new THREE.Group();
  put(group, sphere(0.2, C.ink), 0, 0.08, 0);
  put(group, sphere(0.13, C.ink), 0, -0.17, 0.04);
  for (const s of [-1, 1]) put(group, sphere(0.035, C.white), s * 0.05, -0.15, 0.15);
  const legs = [];
  for (const side of [0, Math.PI]) {
    for (let k = 0; k < 4; k++) {
      const geo = new THREE.BoxGeometry(0.45, 0.03, 0.03);
      geo.translate(0.225, 0, 0);
      const leg = put(group, mesh(geo, C.ink), 0, 0, 0);
      leg.rotation.set(0, side + (k - 1.5) * 0.45, -0.45);
      legs.push(leg);
    }
  }
  const hit = put(group, hitBox(new THREE.SphereGeometry(0.6, 8, 6)), 0, 0, 0);
  const thread = new THREE.Line(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)),
    new THREE.LineBasicMaterial({ color: 0xf5e9ef }),
  );
  thread.frustumCulled = false;
  group.visible = thread.visible = false;
  scene.add(group, thread);
  return { group, thread, legs, hit };
}

/** Builds the whole room and returns handles for the events. @created Claude (claude-opus-5-5) 2026-10-16 */
export function buildRoom(scene) {
  buildLights(scene);
  const room = new THREE.Group();
  scene.add(room);

  const holeZ = -2.3;
  buildShell(room);
  buildMouseHole(room, holeZ);
  const windowParts = buildWindow(room);
  const books = buildShelvesAndBooks(room);
  const homework = buildDesk(room);
  buildBed(room);
  const phone = buildNightstandAndPhone(room);
  buildDecor(room);

  return {
    window: windowParts,
    books,
    homework,
    phone,
    mouse: buildMouse(scene),
    spider: buildSpider(scene),
    hole: { x: -4.5, z: holeZ },
    // Floor rectangles (x0, x1, z0, z1) the mouse cannot walk through.
    obstacles: [
      { x0: -5, x1: -1.5, z0: 1.0, z1: 3.6 },
      { x0: -5, x1: -3.8, z0: -0.65, z1: 0.45 },
      { x0: 3.3, x1: 4.5, z0: -4.5, z1: -3.3 },
      { x0: 3.2, x1: 4.2, z0: 3.1, z1: 4.1 },
    ],
  };
}
