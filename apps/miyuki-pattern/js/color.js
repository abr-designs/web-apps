// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
// sRGB to CIELAB (D65) and CIEDE2000 colour difference.

const WHITE = [0.95047, 1, 1.08883];

/** Parses '#RRGGBB' into [r, g, b] in 0 to 255. */
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Undoes sRGB gamma for one 0 to 255 channel. */
function linear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Lab companding function. */
function f(t) {
  return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
}

/** Converts [r, g, b] (0 to 255) to [L, a, b]. */
export function rgbToLab([r, g, b]) {
  const R = linear(r), G = linear(g), B = linear(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / WHITE[0];
  const y = (0.2126729 * R + 0.7151522 * G + 0.0721750 * B) / WHITE[1];
  const z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / WHITE[2];
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Converts '#RRGGBB' to [L, a, b]. */
export function hexToLab(hex) {
  return rgbToLab(hexToRgb(hex));
}

const DEG = Math.PI / 180;

/** CIEDE2000 difference between two Lab colours (kL = kC = kH = 1). */
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b, a) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / DEG;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * DEG);

  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbp /= 2;
    else hbp = h1p + h2p < 360 ? (hbp + 360) / 2 : (hbp - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((hbp - 30) * DEG)
    + 0.24 * Math.cos(2 * hbp * DEG)
    + 0.32 * Math.cos((3 * hbp + 6) * DEG)
    - 0.20 * Math.cos((4 * hbp - 63) * DEG);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Cbp7 = Cbp ** 7;
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * DEG) * Rc;

  const l = dLp / Sl, c = dCp / Sc, h = dHp / Sh;
  return Math.sqrt(l * l + c * c + h * h + Rt * c * h);
}

/** Black text on light beads, white on dark ones. */
export function textColorFor([L]) {
  return L > 55 ? '#000000' : '#FFFFFF';
}
