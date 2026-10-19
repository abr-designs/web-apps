// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Always-on overlay: compass strip, aim viewfinder and the start hint. Writes to the DOM only on change.

export function createHud(root) {
  root.innerHTML = `
    <div class="hud__compass" aria-live="polite"><span class="hud__arrow">◂</span><span class="hud__name"></span><span class="hud__arrow">▸</span></div>
    <div class="hud__aim" aria-hidden="true">
      <span class="hud__corner hud__corner--tl"></span><span class="hud__corner hud__corner--tr"></span>
      <span class="hud__corner hud__corner--bl"></span><span class="hud__corner hud__corner--br"></span>
      <span class="hud__reticle"></span>
      <span class="hud__zoom"></span>
    </div>
    <div class="hud__hint"></div>
    <div class="hud__tab">Tab · gadget</div>`;
  const name = root.querySelector('.hud__name');
  const aim = root.querySelector('.hud__aim');
  const zoom = root.querySelector('.hud__zoom');
  const hint = root.querySelector('.hud__hint');
  let lastName = null;
  let lastZoom = null;
  let lastHint = null;

  return {
    setCompass(text) {
      if (text === lastName) return;
      lastName = text;
      name.textContent = text || '· · ·';
    },
    setAim(on, z) {
      aim.classList.toggle('is-on', on);
      const label = on ? `Aiming · zoom ${z.toFixed(1)}x` : '';
      if (label !== lastZoom) {
        lastZoom = label;
        zoom.textContent = label;
      }
    },
    setHint(text) {
      if (text === lastHint) return;
      lastHint = text;
      hint.textContent = text ?? '';
      hint.classList.toggle('is-on', Boolean(text));
    },
    setVisible(on) {
      root.classList.toggle('is-hidden', !on);
    },
  };
}
