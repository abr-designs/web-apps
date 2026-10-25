// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16
// Synthesized sounds: the camera shutter and a soft ambient pad. No audio files.

let ctx = null;
let master = null;

function ensure() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  return ctx;
}

/** Browsers only start audio after a user gesture; call from one. */
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function playShutter() {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.08), c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = noise;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const ng = c.createGain();
  ng.gain.value = 0.35;
  src.connect(hp).connect(ng).connect(master);
  src.start(t);

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800, t + 0.02);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + 0.2);
}

let ambientStarted = false;
export function startAmbient() {
  const c = ensure();
  if (!c || ambientStarted) return;
  ambientStarted = true;
  const pad = c.createGain();
  pad.gain.value = 0.04;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(pad).connect(master);
  for (const [f, detune] of [[220, -6], [277.2, 5], [329.6, 0]]) {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.detune.value = detune;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.08 + f / 10000;
    const depth = c.createGain();
    depth.gain.value = 0.4;
    const g = c.createGain();
    g.gain.value = 0.5;
    lfo.connect(depth).connect(g.gain);
    o.connect(g).connect(lp);
    o.start();
    lfo.start();
  }
}
