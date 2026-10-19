const STATES = Object.freeze({
  STANDBY: "standby",
  OBSERVING: "observing",
  FLASHING: "flashing",
  HUNTING: "hunting",
  RESULT: "result",
  GAME_OVER: "gameOver",
});

const CAMERA_MODES = Object.freeze({
  FIRST_PERSON: "firstPerson",
  ISOMETRIC: "isometric",
});

const ROOM = Object.freeze({ halfWidth: 7, halfDepth: 5, height: 4 });
const PLAYER = Object.freeze({ height: 1.68, speed: 3.15, radius: 0.35 });

const ui = {
  viewport: document.querySelector("#viewport"),
  hud: document.querySelector("#hud"),
  intro: document.querySelector("#intro"),
  pause: document.querySelector("#pause"),
  ending: document.querySelector("#ending"),
  webglError: document.querySelector("#webgl-error"),
  startButton: document.querySelector("#start-button"),
  resumeButton: document.querySelector("#resume-button"),
  restartButton: document.querySelector("#restart-button"),
  phaseLabel: document.querySelector("#phase-label"),
  cameraLabel: document.querySelector("#camera-label"),
  status: document.querySelector(".status"),
  score: document.querySelector("#score"),
  strikes: document.querySelector("#strikes"),
  objective: document.querySelector("#objective"),
  reticle: document.querySelector("#reticle"),
  targetLabel: document.querySelector("#target-label"),
  flash: document.querySelector("#flash"),
  photoViewer: document.querySelector("#photo-viewer"),
  photo: document.querySelector("#captured-photo"),
  photoIndicator: document.querySelector("#photo-indicator"),
  toast: document.querySelector("#toast"),
  debugPanel: document.querySelector("#debug-panel"),
  debugClose: document.querySelector("#debug-close"),
  roomBrightness: document.querySelector("#room-brightness"),
  roomBrightnessValue: document.querySelector("#room-brightness-value"),
  flashBrightness: document.querySelector("#flash-brightness"),
  flashBrightnessValue: document.querySelector("#flash-brightness-value"),
  endingKicker: document.querySelector("#ending-kicker"),
  endingTitle: document.querySelector("#ending-title"),
  endingCopy: document.querySelector("#ending-copy"),
};

let renderer;
let scene;
let camera;
let firstPersonCamera;
let isometricCamera;
let controls;
let clock;
let flashLight;
let flashFillLight;
let isometricFillLight;
let ceiling;
let state = STATES.STANDBY;
let cameraMode = CAMERA_MODES.FIRST_PERSON;
let suppressNextUnlock = false;
let debugOpen = false;
let discardNextLookEvent = false;
let score = 0;
let strikes = 0;
let targetProp = null;
let lastTargetId = null;
let hoveredProp = null;
let toastTimer = null;
let audioContext = null;
let hasStarted = false;

const keys = new Set();
const props = [];
const isometricHiddenObjects = [];
const roomLights = [];
const lightingSettings = {
  roomBrightness: 1,
  flashBrightness: 0.1,
};
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const lookEuler = new THREE.Euler(0, 0, 0, "YXZ");

function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

// r169 converts authored CSS/hex colors from sRGB into the linear working space
// automatically. The classic r128 build predates that default, so do it here.
function displayColor(value) {
  return new THREE.Color(value).convertSRGBToLinear();
}

function material(color, roughness = 0.82, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color: displayColor(color), roughness, metalness });
}

function mesh(geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function box(size, color, position, rotation, roughness, metalness) {
  return mesh(new THREE.BoxGeometry(...size), material(color, roughness, metalness), position, rotation);
}

function cylinder(radiusTop, radiusBottom, height, segments, color, position, rotation) {
  return mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material(color),
    position,
    rotation,
  );
}

function markInteractive(group, definition) {
  const prop = {
    id: definition.id,
    name: definition.name,
    group,
    basePosition: group.position.clone(),
    baseRotation: group.rotation.clone(),
    alternatePositions: definition.alternatePositions.map((position) => new THREE.Vector3(...position)),
    allowed: definition.allowed ?? ["move", "rotate"],
    rotationAmount: definition.rotationAmount ?? Math.PI / 2,
    activeAnomaly: null,
  };

  group.traverse((child) => {
    if (child.isMesh) {
      child.userData.prop = prop;
      child.material = child.material.clone();
      if ("emissive" in child.material) child.material.emissive.setHex(0x000000);
    }
  });

  props.push(prop);
  scene.add(group);
  return prop;
}

function createRoom() {
  const floorMat = material(0x281711, 0.88);
  const walnut = 0x2b160f;
  const walnutHighlight = 0x4a2719;
  const wallpaper = 0x6f2d2a;
  const wallpaperShadow = 0x4b1e1d;
  const agedGold = 0x967044;
  const curtainRed = 0x43171b;

  const floor = mesh(new THREE.PlaneGeometry(14, 10), floorMat, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(box([14, 4, 0.18], wallpaper, [0, 2, -5]));
  scene.add(box([0.18, 4, 10], 0x74312e, [-7, 2, 0]));
  const nearRightWall = box([0.18, 4, 10], 0x74312e, [7, 2, 0]);
  scene.add(nearRightWall);
  isometricHiddenObjects.push(nearRightWall);
  ceiling = box([14, 0.15, 10], 0x121817, [0, 4, 0]);
  scene.add(ceiling);

  // Dark floorboards with a subtle alternating grain.
  for (let x = -6.75, index = 0; x < 7; x += 0.5, index += 1) {
    const plank = box([0.025, 0.012, 9.72], index % 2 ? 0x4b2b1c : 0x382015, [x, 0.014, 0]);
    plank.castShadow = false;
    scene.add(plank);
  }

  // Heavy Victorian baseboards, chair rails, and crown molding.
  scene.add(box([13.8, 0.28, 0.18], walnut, [0, 0.16, -4.84]));
  scene.add(box([13.8, 0.16, 0.2], walnutHighlight, [0, 1.0, -4.83]));
  scene.add(box([13.8, 0.24, 0.24], walnut, [0, 3.75, -4.8]));
  scene.add(box([0.18, 0.28, 9.8], walnut, [-6.84, 0.16, 0]));
  scene.add(box([0.2, 0.16, 9.8], walnutHighlight, [-6.83, 1.0, 0]));
  scene.add(box([0.24, 0.24, 9.8], walnut, [-6.8, 3.75, 0]));

  const nearRightBaseboard = box([0.18, 0.28, 9.8], walnut, [6.84, 0.16, 0]);
  const nearRightRail = box([0.2, 0.16, 9.8], walnutHighlight, [6.83, 1.0, 0]);
  const nearRightCrown = box([0.24, 0.24, 9.8], walnut, [6.8, 3.75, 0]);
  scene.add(nearRightBaseboard);
  scene.add(nearRightRail);
  scene.add(nearRightCrown);
  isometricHiddenObjects.push(nearRightBaseboard, nearRightRail, nearRightCrown);

  // A sparse damask-like wallpaper pattern made from raised diamond motifs.
  for (const x of [-6.2, -5.25, -4.3, -3.35, -2.4, -1.45, -0.5, 0.45, 1.4, 2.35, 3.3, 4.25, 5.2, 6.15]) {
    for (const y of [1.55, 2.25, 2.95, 3.55]) {
      const motif = box([0.16, 0.16, 0.025], y % 1 > 0.5 ? agedGold : wallpaperShadow, [x, y, -4.87], [0, 0, Math.PI / 4]);
      motif.castShadow = false;
      scene.add(motif);
    }
  }

  for (const z of [-4.3, -3.2, -2.1, -1.0, 0.1, 1.2, 2.3, 3.4, 4.5]) {
    const leftMotif = box([0.025, 0.17, 0.17], wallpaperShadow, [-6.87, 2.55, z], [Math.PI / 4, 0, 0]);
    scene.add(leftMotif);
    const rightMotif = box([0.025, 0.17, 0.17], wallpaperShadow, [6.87, 2.55, z], [Math.PI / 4, 0, 0]);
    scene.add(rightMotif);
    isometricHiddenObjects.push(rightMotif);
  }

  // Three tall curtained window bays across the far wall.
  const curtainMaterial = material(curtainRed, 0.92);
  const laceMaterial = new THREE.MeshStandardMaterial({
    color: displayColor(0xc7b995),
    roughness: 0.95,
    transparent: true,
    opacity: 0.72,
  });

  for (const windowX of [-4.25, 0, 4.25]) {
    const bay = new THREE.Group();
    bay.add(box([2.25, 2.75, 0.08], 0x171817, [0, 2.15, 0]));
    bay.add(mesh(new THREE.PlaneGeometry(1.82, 2.38), laceMaterial.clone(), [0, 2.12, 0.08]));
    bay.add(box([1.95, 0.09, 0.12], walnut, [0, 3.42, 0.14]));
    bay.add(box([1.95, 0.09, 0.12], walnut, [0, 0.84, 0.14]));
    bay.add(box([0.09, 2.66, 0.12], walnut, [-0.98, 2.13, 0.14]));
    bay.add(box([0.09, 2.66, 0.12], walnut, [0.98, 2.13, 0.14]));
    bay.add(box([0.055, 2.45, 0.1], walnutHighlight, [0, 2.13, 0.16]));
    bay.add(box([1.85, 0.055, 0.1], walnutHighlight, [0, 2.16, 0.16]));

    for (const side of [-1, 1]) {
      const drape = mesh(new THREE.SphereGeometry(0.54, 12, 10), curtainMaterial.clone(), [side * 0.92, 2.24, 0.32]);
      drape.scale.set(0.68, 2.5, 0.46);
      drape.rotation.z = side * -0.08;
      bay.add(drape);
      bay.add(cylinder(0.06, 0.04, 0.52, 10, agedGold, [side * 0.7, 1.85, 0.58]));
    }

    bay.add(box([2.45, 0.32, 0.42], curtainRed, [0, 3.55, 0.31]));
    bay.add(cylinder(0.055, 0.055, 2.75, 12, agedGold, [0, 3.75, 0.3], [0, 0, Math.PI / 2]));
    bay.position.set(windowX, 0, -4.72);
    scene.add(bay);
  }

  // Left writing desk with drawers and turned-looking legs.
  const desk = new THREE.Group();
  desk.add(box([3.0, 0.2, 1.15], walnutHighlight, [0, 1.02, 0]));
  desk.add(box([2.75, 0.38, 0.96], walnut, [0, 0.82, 0]));
  for (const x of [-0.88, 0, 0.88]) {
    desk.add(box([0.72, 0.2, 0.05], 0x5a3020, [x, 0.83, 0.5]));
    desk.add(cylinder(0.035, 0.035, 0.06, 10, agedGold, [x, 0.83, 0.55], [Math.PI / 2, 0, 0]));
  }
  for (const x of [-1.24, 1.24]) {
    for (const z of [-0.38, 0.38]) desk.add(cylinder(0.08, 0.11, 0.8, 10, walnut, [x, 0.4, z]));
  }
  desk.position.set(-4.25, 0, -3.55);
  scene.add(desk);

  // Central lace-covered occasional table.
  const centerTable = new THREE.Group();
  centerTable.add(box([2.0, 0.12, 1.0], 0xd0bd91, [0, 0.95, 0]));
  centerTable.add(box([1.82, 0.28, 0.86], 0xa28b66, [0, 0.82, 0]));
  centerTable.add(cylinder(0.1, 0.16, 0.82, 10, walnut, [-0.68, 0.42, -0.3]));
  centerTable.add(cylinder(0.1, 0.16, 0.82, 10, walnut, [0.68, 0.42, -0.3]));
  centerTable.add(cylinder(0.1, 0.16, 0.82, 10, walnut, [-0.68, 0.42, 0.3]));
  centerTable.add(cylinder(0.1, 0.16, 0.82, 10, walnut, [0.68, 0.42, 0.3]));
  centerTable.position.set(0, 0, -2.9);
  scene.add(centerTable);

  // Deep red velvet settee on the right, with tuft buttons and patterned cushions.
  const settee = new THREE.Group();
  settee.add(box([3.4, 0.52, 1.15], 0x6b2026, [0, 0.52, 0]));
  settee.add(box([3.35, 1.2, 0.34], 0x55191f, [0, 1.18, -0.47], [-0.08, 0, 0]));
  settee.add(box([0.35, 0.82, 1.15], 0x4a151a, [-1.65, 0.78, 0]));
  settee.add(box([0.35, 0.82, 1.15], 0x4a151a, [1.65, 0.78, 0]));
  for (const x of [-1.1, -0.55, 0, 0.55, 1.1]) {
    for (const y of [0.92, 1.25]) {
      settee.add(cylinder(0.045, 0.045, 0.04, 10, 0x2c0d11, [x, y, -0.66], [Math.PI / 2, 0, 0]));
    }
  }
  settee.add(box([0.66, 0.6, 0.18], 0x9b6a3d, [-0.95, 0.93, 0.48], [0.12, 0.12, 0.04]));
  settee.add(box([0.66, 0.6, 0.18], 0x41533b, [0.95, 0.93, 0.48], [0.12, -0.12, -0.04]));
  settee.position.set(4.65, 0, -1.65);
  settee.rotation.y = -0.22;
  scene.add(settee);

  // Layered oriental rug with a geometric center pattern.
  const rug = new THREE.Group();
  rug.add(mesh(new THREE.PlaneGeometry(7.2, 5.3), material(0x5d2921, 1), [0, 0.018, 0], [-Math.PI / 2, 0, 0]));
  rug.add(mesh(new THREE.RingGeometry(2.0, 2.15, 4), material(0xb08352, 1), [0, 0.026, 0], [-Math.PI / 2, 0, Math.PI / 4]));
  for (const x of [-2.7, -1.8, -0.9, 0, 0.9, 1.8, 2.7]) {
    const motif = box([0.42, 0.015, 0.42], (Math.round(x * 10) % 2) ? 0x27423e : 0xa87845, [x, 0.032, 0], [0, Math.PI / 4, 0]);
    motif.castShadow = false;
    rug.add(motif);
  }
  rug.position.set(0, 0, 1.2);
  scene.add(rug);

  // Small framed portraits and a right-wall sconce backing plate.
  scene.add(box([1.05, 1.3, 0.12], agedGold, [-5.8, 2.45, -4.72], [0, 0, -0.08]));
  scene.add(box([0.8, 1.05, 0.13], 0x252719, [-5.8, 2.45, -4.62], [0, 0, -0.08]));
  const sconcePlate = box([0.08, 0.72, 0.5], agedGold, [6.78, 2.45, -0.3]);
  scene.add(sconcePlate);
  isometricHiddenObjects.push(sconcePlate);

}

function createArmchair() {
  const group = new THREE.Group();
  const upholstery = 0x34483b;
  group.add(box([1.2, 0.35, 1.05], upholstery, [0, 0.55, 0]));
  group.add(box([1.2, 1.05, 0.3], 0x2b3c32, [0, 1.05, -0.4], [-0.12, 0, 0]));
  group.add(box([0.25, 0.58, 1.0], 0x28392f, [-0.62, 0.73, 0]));
  group.add(box([0.25, 0.58, 1.0], 0x28392f, [0.62, 0.73, 0]));
  group.add(box([0.68, 0.45, 0.18], 0x9a6940, [0, 0.87, 0.48], [0.12, 0, 0]));
  for (const x of [-0.48, 0.48]) {
    group.add(cylinder(0.07, 0.1, 0.38, 10, 0x342016, [x, 0.19, -0.32]));
    group.add(cylinder(0.07, 0.1, 0.38, 10, 0x342016, [x, 0.19, 0.32]));
  }
  group.position.set(-2.7, 0, -1.55);
  group.rotation.y = 0.35;
  markInteractive(group, {
    id: "armchair",
    name: "GREEN ARMCHAIR",
    alternatePositions: [[-1.1, 0, -1.9]],
    rotationAmount: Math.PI / 3,
  });
}

function createRadio() {
  const group = new THREE.Group();
  group.add(box([0.85, 0.5, 0.34], 0x4a3424, [0, 0, 0]));
  group.add(box([0.36, 0.3, 0.02], 0x1b1915, [-0.18, 0.02, 0.18]));
  group.add(cylinder(0.06, 0.06, 0.035, 16, 0xb38b46, [0.25, 0.08, 0.2], [Math.PI / 2, 0, 0]));
  group.add(cylinder(0.045, 0.045, 0.035, 16, 0xb38b46, [0.25, -0.1, 0.2], [Math.PI / 2, 0, 0]));
  group.add(box([0.52, 0.045, 0.04], 0xa99a70, [0, 0.27, 0], [0, 0, -0.35]));
  group.position.set(-4.45, 1.34, -3.5);
  markInteractive(group, {
    id: "radio",
    name: "RADIO",
    alternatePositions: [[-3.55, 1.34, -3.5]],
    rotationAmount: Math.PI / 2,
  });
}

function createClock() {
  const group = new THREE.Group();
  group.add(cylinder(0.47, 0.47, 0.12, 24, 0x292723, [0, 0, 0], [Math.PI / 2, 0, 0]));
  group.add(cylinder(0.39, 0.39, 0.128, 24, 0xd0c8aa, [0, 0, 0.01], [Math.PI / 2, 0, 0]));
  group.add(box([0.035, 0.28, 0.025], 0x1e1d1a, [0, 0.1, 0.08], [0, 0, 0.18]));
  group.add(box([0.22, 0.025, 0.025], 0x1e1d1a, [0.09, 0, 0.08], [0, 0, -0.45]));
  group.position.set(6.02, 2.62, -4.72);
  markInteractive(group, {
    id: "clock",
    name: "WALL CLOCK",
    alternatePositions: [[6.02, 2.62, -4.72]],
    allowed: ["rotate"],
    rotationAmount: Math.PI / 2,
  });
}

function createFloorLamp() {
  const group = new THREE.Group();
  group.add(cylinder(0.36, 0.36, 0.08, 18, 0x2d2a25, [0, 0.04, 0]));
  group.add(cylinder(0.035, 0.035, 2.25, 10, 0x8b7854, [0, 1.15, 0]));
  group.add(mesh(new THREE.ConeGeometry(0.48, 0.7, 20, 1, true), material(0xc1ad7d), [0, 2.15, 0], [Math.PI, 0, 0]));
  group.position.set(5.35, 0, -3.45);
  markInteractive(group, {
    id: "lamp",
    name: "FLOOR LAMP",
    alternatePositions: [[3.8, 0, 1.85]],
    rotationAmount: Math.PI / 2,
  });
}

function createPlant() {
  const group = new THREE.Group();
  group.add(cylinder(0.4, 0.3, 0.6, 12, 0x5b3a28, [0, 0.3, 0]));
  group.add(cylinder(0.06, 0.08, 1.15, 8, 0x3e4f2d, [0, 1.0, 0]));
  const leafMat = material(0x425d35);
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const leaf = mesh(new THREE.SphereGeometry(0.18, 8, 6), leafMat.clone(), [Math.cos(angle) * 0.28, 1.35 + (i % 2) * 0.2, Math.sin(angle) * 0.28]);
    leaf.scale.set(0.65, 1.8, 0.65);
    leaf.rotation.z = Math.cos(angle) * 0.55;
    leaf.rotation.x = Math.sin(angle) * 0.55;
    group.add(leaf);
  }
  group.position.set(2.65, 0, -3.4);
  markInteractive(group, {
    id: "plant",
    name: "POTTED PLANT",
    alternatePositions: [[2.9, 0, -0.8]],
    rotationAmount: Math.PI / 2,
  });
}

function createSuitcase() {
  const group = new THREE.Group();
  group.add(box([1.05, 0.62, 0.32], 0x5a4330, [0, 0.36, 0]));
  group.add(box([0.32, 0.2, 0.08], 0x241f1a, [0, 0.78, 0]));
  group.add(box([0.06, 0.64, 0.36], 0x2d251e, [-0.37, 0.36, 0]));
  group.add(box([0.06, 0.64, 0.36], 0x2d251e, [0.37, 0.36, 0]));
  group.position.set(5.05, 0, 2.55);
  group.rotation.y = -0.18;
  markInteractive(group, {
    id: "suitcase",
    name: "SUITCASE",
    alternatePositions: [[3.2, 0, 3.55]],
    rotationAmount: Math.PI / 2,
  });
}

function createBooks() {
  const group = new THREE.Group();
  const colors = [0x753a2e, 0x344d51, 0x726340];
  for (let i = 0; i < 3; i += 1) {
    group.add(box([0.5 + i * 0.08, 0.11, 0.38], colors[i], [0.02 * i, i * 0.12, 0], [0, 0.05 * i, 0.03 * (i - 1)]));
  }
  group.position.set(-3.15, 0.12, -3.2);
  markInteractive(group, {
    id: "books",
    name: "BOOK STACK",
    alternatePositions: [[-3.75, 1.22, -3.5]],
    rotationAmount: Math.PI / 2,
  });
}

function createTelephone() {
  const group = new THREE.Group();
  group.add(box([0.68, 0.22, 0.45], 0x23251f, [0, 0, 0]));
  group.add(cylinder(0.15, 0.15, 0.045, 20, 0xb4a980, [0, 0.13, 0.08], [Math.PI / 2, 0, 0]));
  group.add(box([0.76, 0.11, 0.17], 0x171815, [0, 0.25, 0], [0, 0, 0.02]));
  group.add(cylinder(0.11, 0.08, 0.16, 12, 0x171815, [-0.35, 0.25, 0], [0, 0, Math.PI / 2]));
  group.add(cylinder(0.11, 0.08, 0.16, 12, 0x171815, [0.35, 0.25, 0], [0, 0, Math.PI / 2]));
  group.position.set(-5.25, 1.22, -3.45);
  markInteractive(group, {
    id: "telephone",
    name: "TELEPHONE",
    alternatePositions: [[-3.65, 1.22, -3.45]],
    rotationAmount: Math.PI * 0.72,
  });
}

function createPainting() {
  const group = new THREE.Group();
  group.add(box([0.1, 1.55, 1.2], 0x9a7442, [0, 0, 0]));
  group.add(box([0.07, 1.28, 0.93], 0x273027, [-0.065, 0, 0]));
  group.add(mesh(new THREE.CircleGeometry(0.27, 16), material(0xb1a46d), [-0.11, 0.24, 0], [0, -Math.PI / 2, 0]));
  group.position.set(-6.84, 2.12, -0.55);
  markInteractive(group, {
    id: "painting",
    name: "LANDSCAPE PAINTING",
    alternatePositions: [[-6.84, 2.12, 1.15]],
    allowed: ["rotate"],
    rotationAmount: 0.24,
  });
}

function createStool() {
  const group = new THREE.Group();
  group.add(cylinder(0.64, 0.64, 0.1, 24, 0x8f7042, [0, 0.78, 0]));
  group.add(cylinder(0.11, 0.14, 0.72, 12, 0x4a2c1d, [0, 0.39, 0]));
  group.add(cylinder(0.42, 0.52, 0.08, 20, 0x372117, [0, 0.05, 0]));
  group.position.set(1.65, 0, 1.0);
  markInteractive(group, {
    id: "stool",
    name: "BRASS TEA TABLE",
    alternatePositions: [[0.1, 0, 1.7]],
    rotationAmount: Math.PI / 2,
  });
}

function createCamera() {
  const group = new THREE.Group();
  group.add(box([0.72, 0.48, 0.36], 0x2b2b28, [0, 0, 0], [0, 0, 0], 0.45, 0.2));
  group.add(cylinder(0.19, 0.24, 0.25, 16, 0x181917, [0, 0, 0.28], [Math.PI / 2, 0, 0]));
  group.add(cylinder(0.12, 0.12, 0.27, 16, 0x0c0d0c, [0, 0, 0.35], [Math.PI / 2, 0, 0]));
  group.add(box([0.27, 0.2, 0.14], 0xd4d0b7, [0.18, 0.26, 0.08]));
  group.position.set(0, 1.27, -2.9);
  markInteractive(group, {
    id: "camera",
    name: "BOX CAMERA",
    alternatePositions: [[0.62, 1.27, -2.9]],
    rotationAmount: Math.PI,
  });
}

function createLighting() {
  const trackRoomLight = (light) => {
    light.userData.baseIntensity = light.intensity;
    roomLights.push(light);
    return light;
  };

  scene.add(trackRoomLight(new THREE.HemisphereLight(displayColor(0x8d8d7d), displayColor(0x2d251d), 1.08)));
  scene.add(trackRoomLight(new THREE.AmbientLight(displayColor(0xb4b09f), 0.3)));

  const ceilingLight = trackRoomLight(new THREE.PointLight(displayColor(0xffd7a0), 36, 16, 2));
  ceilingLight.position.set(0, 3.25, 0.15);
  ceilingLight.castShadow = true;
  ceilingLight.shadow.mapSize.set(1024, 1024);
  ceilingLight.shadow.bias = -0.002;
  scene.add(ceilingLight);

  const chandelier = new THREE.Group();
  chandelier.add(cylinder(0.045, 0.045, 0.72, 12, 0xa9814b, [0, 3.64, 0]));
  chandelier.add(mesh(new THREE.TorusGeometry(0.48, 0.035, 8, 24), material(0xa9814b, 0.35, 0.55), [0, 3.3, 0], [Math.PI / 2, 0, 0]));
  chandelier.add(cylinder(0.24, 0.42, 0.38, 16, 0xe1d2ad, [0, 3.12, 0]));
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    chandelier.add(cylinder(0.025, 0.025, 0.6, 8, 0xa9814b, [Math.cos(angle) * 0.28, 3.22, Math.sin(angle) * 0.28], [Math.sin(angle) * 0.5, 0, Math.cos(angle) * 0.5]));
    chandelier.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), material(0xffe0a8), [Math.cos(angle) * 0.52, 3.2, Math.sin(angle) * 0.52]));
  }
  scene.add(chandelier);

  const deskGlow = trackRoomLight(new THREE.PointLight(displayColor(0xbd7542), 8, 6, 2));
  deskGlow.position.set(-4.35, 1.7, -3.2);
  scene.add(deskGlow);

  const windowGlow = trackRoomLight(new THREE.PointLight(displayColor(0xe5aa72), 18, 7, 2));
  windowGlow.position.set(0, 2.0, -4.35);
  scene.add(windowGlow);

  const sconceGlow = trackRoomLight(new THREE.PointLight(displayColor(0xffb468), 11, 5, 2));
  sconceGlow.position.set(6.3, 2.48, -0.3);
  scene.add(sconceGlow);

  isometricFillLight = new THREE.DirectionalLight(displayColor(0xd8d3bd), 1.15);
  isometricFillLight.position.set(6, 12, 7);
  isometricFillLight.target.position.set(0, 0, 0);
  isometricFillLight.visible = false;
  scene.add(isometricFillLight);
  scene.add(isometricFillLight.target);
  trackRoomLight(isometricFillLight);

  flashFillLight = new THREE.AmbientLight(displayColor(0xf8f3df), 0);
  scene.add(flashFillLight);

  flashLight = new THREE.SpotLight(displayColor(0xf5f1de), 0, 35, Math.PI / 3.1, 0.35, 1.2);
  flashLight.castShadow = true;
  scene.add(flashLight);
  scene.add(flashLight.target);
  applyLightingSettings();
}

function applyLightingSettings() {
  roomLights.forEach((light) => {
    light.intensity = light.userData.baseIntensity * lightingSettings.roomBrightness;
  });

  ui.roomBrightnessValue.textContent = `${Math.round(lightingSettings.roomBrightness * 100)}%`;
  ui.flashBrightnessValue.textContent = `${Math.round(lightingSettings.flashBrightness * 100)}%`;
  document.documentElement.style.setProperty(
    "--flash-overlay-opacity",
    String(Math.min(0.95, 0.18 + lightingSettings.flashBrightness * 0.5)),
  );

  if (state === STATES.FLASHING) setFlashLighting(true);
}

function resetProp(prop) {
  prop.group.position.copy(prop.basePosition);
  prop.group.rotation.copy(prop.baseRotation);
  prop.activeAnomaly = null;
}

function resetAllProps() {
  props.forEach(resetProp);
  targetProp = null;
  setHoveredProp(null);
  clearCapturedPhoto();
}

function chooseAnomaly() {
  const candidates = props.filter((prop) => prop.id !== lastTargetId);
  targetProp = candidates[Math.floor(Math.random() * candidates.length)];
  const types = targetProp.allowed.filter((type) => type !== "move" || targetProp.alternatePositions.length > 0);
  const type = types[Math.floor(Math.random() * types.length)];

  if (type === "move") {
    const position = targetProp.alternatePositions[Math.floor(Math.random() * targetProp.alternatePositions.length)];
    targetProp.group.position.copy(position);
  } else {
    targetProp.group.rotation.y += targetProp.rotationAmount;
    if (targetProp.id === "painting") targetProp.group.rotation.x += targetProp.rotationAmount;
  }

  targetProp.activeAnomaly = type;
  lastTargetId = targetProp.id;
}

function setState(nextState) {
  state = nextState;
  if (nextState !== STATES.HUNTING && nextState !== STATES.RESULT) setPhotoVisible(false);
  ui.status.classList.toggle("hunting", nextState === STATES.HUNTING);

  const copy = {
    [STATES.STANDBY]: ["STANDBY", "Awaiting investigator."],
    [STATES.OBSERVING]: ["OBSERVING", "Inspect the room. Press SPACE when you are ready to flash."],
    [STATES.FLASHING]: ["EXPOSING", "Hold still…"],
    [STATES.HUNTING]: ["ANOMALY ACTIVE", "Something changed. Hold Q to compare the photo, then aim and click to report."],
    [STATES.RESULT]: ["PROCESSING", "Logging observation…"],
    [STATES.GAME_OVER]: ["CASE CLOSED", "Survey complete."],
  };

  ui.phaseLabel.textContent = copy[nextState][0];
  ui.objective.textContent = copy[nextState][1];
}

function canInteractWithRoom() {
  return cameraMode === CAMERA_MODES.ISOMETRIC || controls.isLocked;
}

function setNearWallVisibility(visible) {
  isometricHiddenObjects.forEach((object) => {
    object.visible = visible;
  });
}

function updateIsometricProjection() {
  if (!isometricCamera) return;
  const aspect = window.innerWidth / window.innerHeight;
  const viewHeight = Math.max(12, 16 / aspect);
  isometricCamera.left = -(viewHeight * aspect) / 2;
  isometricCamera.right = (viewHeight * aspect) / 2;
  isometricCamera.top = viewHeight / 2;
  isometricCamera.bottom = -viewHeight / 2;
  isometricCamera.updateProjectionMatrix();
}

function setCameraMode(nextMode, announce = true) {
  if (cameraMode === nextMode || state === STATES.FLASHING || state === STATES.GAME_OVER) return;

  keys.clear();
  setPhotoVisible(false);

  if (nextMode === CAMERA_MODES.ISOMETRIC) {
    cameraMode = CAMERA_MODES.ISOMETRIC;
    camera = isometricCamera;
    ui.cameraLabel.textContent = "ISOMETRIC";
    ui.reticle.classList.add("isometric");
    ceiling.visible = false;
    setNearWallVisibility(false);
    isometricFillLight.visible = true;

    if (controls.isLocked) {
      suppressNextUnlock = true;
      controls.unlock();
    }

    if (announce) showToast("ISOMETRIC SURVEY VIEW");
    return;
  }

  cameraMode = CAMERA_MODES.FIRST_PERSON;
  camera = firstPersonCamera;
  ui.cameraLabel.textContent = "FIRST PERSON";
  ui.reticle.classList.remove("isometric");
  ui.reticle.style.left = "";
  ui.reticle.style.top = "";
  ceiling.visible = true;
  setNearWallVisibility(true);
  isometricFillLight.visible = false;
  controls.lock();
  if (announce) showToast("FIRST-PERSON SURVEY VIEW");
}

function toggleCameraMode() {
  const nextMode = cameraMode === CAMERA_MODES.FIRST_PERSON
    ? CAMERA_MODES.ISOMETRIC
    : CAMERA_MODES.FIRST_PERSON;
  setCameraMode(nextMode);
}

function updateCounters() {
  ui.score.textContent = String(score);
  ui.strikes.textContent = [0, 1, 2].map((index) => (index < strikes ? "●" : "○")).join(" ");
  ui.strikes.classList.toggle("danger", strikes > 0);
}

function showToast(message, tone = "") {
  window.clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.className = tone ? `show ${tone}` : "show";
  toastTimer = window.setTimeout(() => {
    ui.toast.className = "";
  }, 1150);
}

function ensureAudio() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
}

function soundPulse(frequency, duration, volume, type = "sine", delay = 0) {
  if (!audioContext) return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.55), start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playFlashSound() {
  soundPulse(115, 0.08, 0.22, "square");
  soundPulse(1450, 0.12, 0.08, "sawtooth", 0.055);
}

function playResultSound(correct) {
  if (correct) {
    soundPulse(420, 0.18, 0.09, "sine");
    soundPulse(630, 0.24, 0.07, "sine", 0.11);
  } else {
    soundPulse(160, 0.3, 0.12, "square");
  }
}

function setFlashLighting(active) {
  if (!active) {
    flashLight.intensity = 0;
    flashFillLight.intensity = 0;
    return;
  }

  const strength = lightingSettings.flashBrightness;
  flashLight.intensity = (cameraMode === CAMERA_MODES.ISOMETRIC ? 3200 : 850) * strength;
  flashFillLight.intensity = (cameraMode === CAMERA_MODES.ISOMETRIC ? 1.25 : 0.72) * strength;
}

function setDebugOpen(open) {
  debugOpen = open;
  ui.debugPanel.classList.toggle("active", open);

  if (open) {
    keys.clear();
    setPhotoVisible(false);
    if (cameraMode === CAMERA_MODES.FIRST_PERSON && controls.isLocked) {
      suppressNextUnlock = true;
      controls.unlock();
    }
    return;
  }

  if (cameraMode === CAMERA_MODES.FIRST_PERSON && hasStarted && state !== STATES.GAME_OVER) {
    controls.lock();
  }
}

function capturePhoto() {
  updateFlashLight();
  setFlashLighting(true);
  renderer.render(scene, camera);

  try {
    const source = renderer.domElement;
    const scale = Math.min(1, 960 / source.width);
    const snapshot = document.createElement("canvas");
    snapshot.width = Math.round(source.width * scale);
    snapshot.height = Math.round(source.height * scale);
    snapshot.getContext("2d").drawImage(source, 0, 0, snapshot.width, snapshot.height);
    ui.photo.src = snapshot.toDataURL("image/jpeg", 0.88);
    ui.photoIndicator.classList.add("ready");
  } catch {
    ui.photo.removeAttribute("src");
    ui.photoIndicator.classList.remove("ready");
  }
}

function clearCapturedPhoto() {
  setPhotoVisible(false);
  ui.photo.removeAttribute("src");
  ui.photoIndicator.classList.remove("ready");
}

function setPhotoVisible(visible) {
  const canView = Boolean(ui.photo.getAttribute("src")) && (state === STATES.HUNTING || state === STATES.RESULT);
  const shouldShow = visible && canView;
  ui.photoViewer.classList.toggle("visible", shouldShow);
  ui.photoViewer.setAttribute("aria-hidden", String(!shouldShow));
}

function fireFlash() {
  if (state !== STATES.OBSERVING || !canInteractWithRoom()) return;
  capturePhoto();
  setState(STATES.FLASHING);
  playFlashSound();
  setFlashLighting(true);
  ui.flash.className = "burst";

  window.setTimeout(() => {
    setFlashLighting(false);
    ui.flash.className = "blackout";
  }, 95);

  window.setTimeout(() => {
    chooseAnomaly();
  }, 260);

  window.setTimeout(() => {
    ui.flash.className = "recover";
    setState(STATES.HUNTING);
  }, 470);

  window.setTimeout(() => {
    ui.flash.className = "";
  }, 930);
}

function getAimedProp() {
  const aimPoint = cameraMode === CAMERA_MODES.ISOMETRIC ? pointer : new THREE.Vector2(0, 0);
  raycaster.far = cameraMode === CAMERA_MODES.ISOMETRIC ? 30 : 8;
  raycaster.setFromCamera(aimPoint, camera);
  const meshes = props.flatMap((prop) => prop.group.children).filter((child) => child.isMesh);
  const hits = raycaster.intersectObjects(meshes, true);
  return hits[0]?.object?.userData?.prop ?? null;
}

function setHoveredProp(prop) {
  if (hoveredProp === prop) return;

  if (hoveredProp) {
    hoveredProp.group.traverse((child) => {
      if (child.isMesh && "emissiveIntensity" in child.material) child.material.emissiveIntensity = 0;
    });
  }

  hoveredProp = prop;

  if (hoveredProp) {
    hoveredProp.group.traverse((child) => {
      if (child.isMesh && "emissive" in child.material) {
        child.material.emissive.copy(displayColor(0xb07b2f));
        child.material.emissiveIntensity = 0.28;
      }
    });
  }

  ui.reticle.classList.toggle("targeting", Boolean(prop));
  ui.targetLabel.textContent = prop ? prop.name : "";
}

function reportAimedObject() {
  if (state !== STATES.HUNTING || !canInteractWithRoom()) return;
  const accused = getAimedProp();
  if (!accused) {
    showToast("NO OBJECT IN FOCUS");
    return;
  }

  setState(STATES.RESULT);
  const correct = accused === targetProp;
  playResultSound(correct);

  if (correct) {
    score += 1;
    updateCounters();
    const action = targetProp.activeAnomaly === "move" ? "RELOCATED" : "ROTATED";
    showToast(`CONFIRMED — ${targetProp.name} ${action}`, "correct");

    if (score >= 5) {
      window.setTimeout(() => endGame(true), 1200);
      return;
    }

    window.setTimeout(() => {
      resetAllProps();
      setState(STATES.OBSERVING);
      showToast(`ROUND ${score + 1} — STUDY THE ROOM`);
    }, 1350);
  } else {
    strikes += 1;
    updateCounters();
    showToast(`FALSE REPORT — ${accused.name}`, "wrong");

    if (strikes >= 3) {
      window.setTimeout(() => endGame(false), 1150);
      return;
    }

    window.setTimeout(() => {
      setState(STATES.HUNTING);
      showToast("ANOMALY STILL ACTIVE");
    }, 1050);
  }
}

function endGame(won) {
  setState(STATES.GAME_OVER);
  controls.unlock();
  ui.pause.classList.remove("active");
  ui.endingKicker.textContent = won ? "CASE CLOSED" : "CASE COMPROMISED";
  ui.endingTitle.textContent = won ? "Room cleared." : "The room wins.";
  ui.endingCopy.textContent = won
    ? "Five disturbances documented. Whatever is here knows you saw it."
    : `Three false reports filed. ${targetProp?.name ?? "The anomaly"} remains out of place.`;
  ui.ending.classList.add("active");
}

function restartGame() {
  score = 0;
  strikes = 0;
  lastTargetId = null;
  resetAllProps();
  updateCounters();
  cameraMode = CAMERA_MODES.FIRST_PERSON;
  camera = firstPersonCamera;
  ui.cameraLabel.textContent = "FIRST PERSON";
  ui.reticle.classList.remove("isometric");
  ui.reticle.style.left = "";
  ui.reticle.style.top = "";
  ceiling.visible = true;
  setNearWallVisibility(true);
  isometricFillLight.visible = false;
  camera.position.set(0, PLAYER.height, 3.6);
  camera.rotation.set(0, 0, 0);
  camera.updateProjectionMatrix();
  ui.ending.classList.remove("active");
  setState(STATES.OBSERVING);
  controls.lock();
}

function updateMovement(delta) {
  if (cameraMode !== CAMERA_MODES.FIRST_PERSON || !controls.isLocked || state === STATES.GAME_OVER) return;
  const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
  const right = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  if (!forward && !right) return;

  const length = Math.hypot(forward, right) || 1;
  controls.moveForward((forward / length) * PLAYER.speed * delta);
  controls.moveRight((right / length) * PLAYER.speed * delta);

  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ROOM.halfWidth + PLAYER.radius, ROOM.halfWidth - PLAYER.radius);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ROOM.halfDepth + PLAYER.radius, ROOM.halfDepth - PLAYER.radius);
  camera.position.y = PLAYER.height;
}

function updateFlashLight() {
  flashLight.position.copy(camera.position);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  flashLight.target.position.copy(camera.position).add(direction.multiplyScalar(5));
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  updateMovement(delta);
  updateFlashLight();

  if (state === STATES.HUNTING && canInteractWithRoom()) {
    setHoveredProp(getAimedProp());
  } else {
    setHoveredProp(null);
  }

  renderer.render(scene, camera);
}

function bindEvents() {
  ui.roomBrightness.addEventListener("input", () => {
    lightingSettings.roomBrightness = Number(ui.roomBrightness.value);
    applyLightingSettings();
  });

  ui.flashBrightness.addEventListener("input", () => {
    lightingSettings.flashBrightness = Number(ui.flashBrightness.value);
    applyLightingSettings();
  });

  ui.debugClose.addEventListener("click", () => setDebugOpen(false));

  ui.startButton.addEventListener("click", () => {
    ensureAudio();
    hasStarted = true;
    setState(STATES.OBSERVING);
    controls.lock();
  });

  ui.resumeButton.addEventListener("click", () => {
    ensureAudio();
    controls.lock();
  });

  ui.restartButton.addEventListener("click", () => {
    ensureAudio();
    restartGame();
  });

  controls.addEventListener("lock", () => {
    discardNextLookEvent = true;
    ui.intro.classList.remove("active");
    ui.pause.classList.remove("active");
    ui.hud.classList.add("visible");
  });

  controls.addEventListener("unlock", () => {
    keys.clear();
    setPhotoVisible(false);
    if (suppressNextUnlock) {
      suppressNextUnlock = false;
      return;
    }
    if (cameraMode === CAMERA_MODES.ISOMETRIC) return;
    if (hasStarted && state !== STATES.GAME_OVER) ui.pause.classList.add("active");
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "F2") {
      event.preventDefault();
      if (hasStarted) setDebugOpen(!debugOpen);
      return;
    }

    if (debugOpen) return;
    keys.add(event.code);
    if (event.code === "Space") {
      event.preventDefault();
      fireFlash();
    }
    if (event.code === "KeyQ") {
      event.preventDefault();
      setPhotoVisible(true);
    }
    if (event.code === "KeyC" && !event.repeat && (state === STATES.OBSERVING || state === STATES.HUNTING)) {
      event.preventDefault();
      toggleCameraMode();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
    if (event.code === "KeyQ") setPhotoVisible(false);
  });

  window.addEventListener("mousedown", (event) => {
    if (debugOpen || event.target.closest("#debug-panel")) return;
    if (event.button === 0) reportAimedObject();
  });

  // The classic pointer-lock controller applies raw browser deltas directly.
  // Handle rotation first so a stale or oversized delta cannot whip the camera.
  window.addEventListener("mousemove", (event) => {
    if (cameraMode !== CAMERA_MODES.FIRST_PERSON || !controls.isLocked || debugOpen) return;
    event.stopPropagation();

    if (discardNextLookEvent) {
      discardNextLookEvent = false;
      return;
    }

    const maxDelta = 120;
    const movementX = THREE.MathUtils.clamp(Number(event.movementX) || 0, -maxDelta, maxDelta);
    const movementY = THREE.MathUtils.clamp(Number(event.movementY) || 0, -maxDelta, maxDelta);
    lookEuler.setFromQuaternion(firstPersonCamera.quaternion);
    lookEuler.y -= movementX * 0.0015;
    lookEuler.x -= movementY * 0.0015;
    lookEuler.x = THREE.MathUtils.clamp(lookEuler.x, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    firstPersonCamera.quaternion.setFromEuler(lookEuler);
  }, true);

  window.addEventListener("mousemove", (event) => {
    if (cameraMode !== CAMERA_MODES.ISOMETRIC) return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    ui.reticle.style.left = `${event.clientX}px`;
    ui.reticle.style.top = `${event.clientY}px`;
  });

  window.addEventListener("blur", () => {
    keys.clear();
    setPhotoVisible(false);
  });
  window.addEventListener("resize", () => {
    firstPersonCamera.aspect = window.innerWidth / window.innerHeight;
    firstPersonCamera.updateProjectionMatrix();
    updateIsometricProjection();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
}

function init() {
  if (!canUseWebGL()) {
    ui.intro.classList.remove("active");
    ui.webglError.classList.add("active");
    return;
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The module-based r169 build uses physically correct light falloff by default.
  // Opt into the equivalent mode in the older classic build.
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  ui.viewport.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = displayColor(0x171812);
  scene.fog = new THREE.FogExp2(displayColor(0x171812), 0.022);

  firstPersonCamera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 40);
  firstPersonCamera.position.set(0, PLAYER.height, 3.6);

  isometricCamera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 50);
  isometricCamera.position.set(9.2, 10.5, 8.2);
  isometricCamera.lookAt(0, 0.8, -0.25);
  updateIsometricProjection();

  camera = firstPersonCamera;

  controls = new THREE.PointerLockControls(firstPersonCamera, document.body);

  clock = new THREE.Clock();
  createRoom();
  createArmchair();
  createRadio();
  createClock();
  createFloorLamp();
  createPlant();
  createSuitcase();
  createBooks();
  createTelephone();
  createPainting();
  createStool();
  createCamera();
  createLighting();
  bindEvents();
  updateCounters();
  setState(STATES.STANDBY);
  animate();
}

init();
