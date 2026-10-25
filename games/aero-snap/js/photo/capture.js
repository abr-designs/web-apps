// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Renders the aim camera's view at 640x360 through the full post stack and copies it to a 2D canvas.

export const PHOTO_WIDTH = 640;
export const PHOTO_HEIGHT = 360;

/**
 * Must run inside a frame, before the normal render: it temporarily resizes the composer, so the
 * caller renders the regular frame right after and the screen never shows the photo-sized buffer.
 * @returns {{ canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera }} The photo and the exact
 *   16:9 camera it was taken with, for analysis.
 */
export function capturePhoto({ renderer, composer, renderPass, camera, hidden = [] }) {
  const photoCam = camera.clone();
  photoCam.aspect = PHOTO_WIDTH / PHOTO_HEIGHT;
  photoCam.updateProjectionMatrix();
  photoCam.updateMatrixWorld();

  const pixelRatio = renderer.getPixelRatio();
  const width = window.innerWidth;
  const height = window.innerHeight;
  hidden.forEach((o) => { o.visible = false; });
  renderer.setPixelRatio(1);
  renderer.setSize(PHOTO_WIDTH, PHOTO_HEIGHT, false);
  composer.setPixelRatio(1);
  composer.setSize(PHOTO_WIDTH, PHOTO_HEIGHT);
  renderPass.camera = photoCam;
  composer.render(0);

  // drawImage right after rendering, in the same task, reads the WebGL buffer before it is cleared.
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_WIDTH;
  canvas.height = PHOTO_HEIGHT;
  canvas.getContext('2d').drawImage(renderer.domElement, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);

  renderPass.camera = camera;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  hidden.forEach((o) => { o.visible = true; });
  return { canvas, camera: photoCam };
}

export function toJpeg(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}
