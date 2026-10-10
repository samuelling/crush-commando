// All drawing. World-space functions assume ctx is already translated by the camera.
import { T, ROWS, SPIKE, CRACK, LEVEL_BOTTOM } from './level.js';
import { hash2, hexToRgb, mixRgb, rgbStr, roundRect, clamp, lerp } from './util.js';

// ---- themes -----------------------------------------------------------------
const THEME_DEFS = {
  genre: { top: '#3f8fdc', bot: '#aee0ff', far: '#7aa6d6', near: '#4e7fb3', hill: '#3f9a52', cloud: '#ffffff', sun: 1, mountains: 1 },
  noir: {
    top: '#070a16', bot: '#262b45', far: '#1a1f35', near: '#11152a', hill: '#0c0f1f', cloud: '#2b3150', cloudA: 0.55,
    stars: 0.12, moon: 0.7, noirCity: 1, rain: 1, tail: 1, window: '#ffd27a',
  },
  brooklyn: {
    top: '#4f74c9', bot: '#ffcf96', far: '#c58f7c', near: '#9c5c48', hill: '#6f3d30', cloud: '#fff1dc',
    sun: 0.9, brown: 1, comic: 1, window: '#ffd98a',
  },
  flight: {
    top: '#2a69d6', bot: '#c6ebff', far: '#b8907f', near: '#93604f', hill: '#6c3e32', cloud: '#ffffff',
    sun: 1, brown: 1, comic: 0.5, window: '#ffe2a0',
  },
  dream: {
    top: '#33246a', bot: '#ff9fcf', far: '#79d3c6', near: '#9a7fd6', hill: '#4fb59f', cloud: '#ffe0f4', cloudA: 0.75,
    stars: 0.7, moon: 1, bigMoon: 1, mountains: 1, islands: 1,
  },
  lack: {
    top: '#170d2e', bot: '#f08a4b', far: '#5a3550', near: '#3a2240', hill: '#2a1830', cloud: '#ffb38a', cloudA: 0.35,
    stars: 0.55, sun: 0.55, mountains: 0.3, lab: 1,
  },
  gray: {
    top: '#5b6168', bot: '#9ba2aa', far: '#7b8189', near: '#5f656c', hill: '#4c5157', cloud: '#b9bec4', cloudA: 0.45,
    towers: 1, fog: 0.3, window: '#e8e2c8',
  },
  arrest: {
    top: '#c7c1b2', bot: '#efe7d2', far: '#b8b1a0', near: '#a29b8a', hill: '#8e8973', cloud: '#f6f1e3', cloudA: 0.6,
    sun: 0.3, mountains: 1, frozen: 1,
  },
  collage: { top: '#3f8fdc', bot: '#aee0ff', far: '#7aa6d6', near: '#4e7fb3', hill: '#3f9a52', cloud: '#ffffff', collage: 1 },
};
const DEFAULTS = {
  stars: 0, sun: 0, moon: 0, bigMoon: 0, cloudA: 0.85, mountains: 0, brown: 0, noirCity: 0, towers: 0, islands: 0,
  lab: 0, rain: 0, fog: 0, comic: 0, tail: 0, frozen: 0, collage: 0, fogColor: '#a9afb6', window: '#ffd98a',
};
export const THEMES = {};
for (const [k, d] of Object.entries(THEME_DEFS)) {
  const o = { ...DEFAULTS, ...d };
  for (const f in o) if (typeof o[f] === 'string') o[f] = hexToRgb(o[f]);
  THEMES[k] = o;
}
export function blendThemes(a, b, t) {
  if (!b || t <= 0) return a;
  if (t >= 1) return b;
  const o = {};
  for (const k in a) o[k] = Array.isArray(a[k]) ? mixRgb(a[k], b[k], t) : lerp(a[k], b[k], t);
  return o;
}

function ridge(x, s) {
  return Math.sin(x * 0.0041 * s) * 42 + Math.sin(x * 0.0113 * s + 1.3) * 22 + Math.sin(x * 0.029 * s + 0.7) * 9;
}
const horizonOf = (cam, VH) => VH * 0.66 - (cam.y - (LEVEL_BOTTOM + 64 - VH)) * 0.25;

// ---- background -------------------------------------------------------------
export function drawBackground(ctx, cam, VW, VH, p, time) {
  if (p.collage > 0.5) drawCollage(ctx, cam, VW, VH, time);
  else drawSky(ctx, cam, VW, VH, p, time);
}

const COLLAGE = ['genre', 'noir', 'brooklyn', 'dream', 'lack', 'gray', 'arrest'];
function drawCollage(ctx, cam, VW, VH, time) {
  const n = 4, shift = Math.floor(cam.x / 1400);
  const edge = (j, y) => (j <= 0 ? -20 : j >= n ? VW + 20 : (j * VW) / n + (hash2(j + shift * 7, Math.floor(y / 18)) - 0.5) * 14);
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.beginPath();
    for (let y = 0; y <= VH + 18; y += 18) ctx.lineTo(edge(i, y), y);
    for (let y = Math.ceil(VH / 18) * 18 + 18; y >= 0; y -= 18) ctx.lineTo(edge(i + 1, y), y);
    ctx.closePath();
    ctx.clip();
    drawSky(ctx, cam, VW, VH, THEMES[COLLAGE[(i + shift) % COLLAGE.length]], time, (i * VW) / n - 12, ((i + 1) * VW) / n + 12);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,252,240,0.9)';
  ctx.lineWidth = 3;
  for (let j = 1; j < n; j++) {
    ctx.beginPath();
    for (let y = 0; y <= VH + 18; y += 18) ctx.lineTo(edge(j, y), y);
    ctx.stroke();
  }
}

// x0/x1 bound the drawing when only a strip of the screen is visible (the collage).
function drawSky(ctx, cam, VW, VH, p, time, x0 = 0, x1 = VW) {
  const strip = x1 - x0 < VW;
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, rgbStr(p.top));
  g.addColorStop(1, rgbStr(p.bot));
  ctx.fillStyle = g;
  ctx.fillRect(x0, 0, x1 - x0, VH);
  const horizon = horizonOf(cam, VH);

  if (p.stars > 0.02 && !strip) {
    for (let i = 0; i < 90; i++) {
      const hx = hash2(i, 1), hy = hash2(i, 2);
      const x = ((hx * VW * 1.6 - cam.x * 0.04) % (VW * 1.6) + VW * 1.6) % (VW * 1.6) - VW * 0.3;
      const y = hy * horizon * 0.85;
      const tw = 0.5 + 0.5 * Math.sin(time * (1 + hash2(i, 3) * 2) + i);
      const r = 0.8 + hash2(i, 4) * 1.4;
      ctx.fillStyle = `rgba(255,255,255,${p.stars * (0.4 + 0.6 * tw)})`;
      ctx.fillRect(x, y, r, r);
    }
  }

  const sunX = VW * 0.78, sunY = horizon * 0.35;
  if (p.sun > 0.02) {
    const sg = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 120);
    sg.addColorStop(0, `rgba(255,240,180,${0.9 * p.sun})`);
    sg.addColorStop(0.3, `rgba(255,220,140,${0.35 * p.sun})`);
    sg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
    ctx.fillStyle = `rgba(255,245,200,${p.sun})`;
    ctx.beginPath(); ctx.arc(sunX, sunY, 28, 0, Math.PI * 2); ctx.fill();
  }
  if (p.moon > 0.02) {
    const mx = VW * 0.25, my = horizon * 0.3, mr = 22 + 34 * p.bigMoon;
    ctx.fillStyle = `rgba(235,240,255,${p.moon})`;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    if (p.bigMoon > 0.5) {
      ctx.fillStyle = `rgba(190,190,225,${0.5 * p.moon})`;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(mx + (hash2(k, 31) - 0.5) * mr * 1.2, my + (hash2(k, 32) - 0.5) * mr * 1.2, 3 + hash2(k, 33) * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = rgbStr(p.top, p.moon);
      ctx.beginPath(); ctx.arc(mx + 10, my - 6, mr * 0.85, 0, Math.PI * 2); ctx.fill();
    }
  }

  for (let i = 0; i < (strip ? 0 : 9); i++) {
    const h1 = hash2(i, 11), h2 = hash2(i, 12), h3 = hash2(i, 13);
    const span = VW + 500;
    const x = ((h1 * span + time * (6 + h3 * 10) - cam.x * (0.12 + h2 * 0.12)) % span + span) % span - 250;
    const y = 30 + h2 * horizon * 0.5;
    const s = 0.7 + h3 * 0.9;
    ctx.fillStyle = rgbStr(p.cloud, p.cloudA);
    ctx.beginPath();
    ctx.arc(x, y, 26 * s, 0, Math.PI * 2);
    ctx.arc(x + 30 * s, y - 10 * s, 32 * s, 0, Math.PI * 2);
    ctx.arc(x + 64 * s, y, 24 * s, 0, Math.PI * 2);
    ctx.arc(x + 32 * s, y + 10 * s, 26 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  if (p.lab > 0.02) drawLab(ctx, cam, VW, horizon, p, time);
  if (p.mountains > 0.02) {
    const layers = [
      { f: 0.15, base: horizon - 20, amp: 1.6, s: 1.0, col: p.far, off: 0 },
      { f: 0.3, base: horizon + 30, amp: 1.1, s: 1.7, col: p.near, off: 400 },
      { f: 0.55, base: horizon + 95, amp: 0.5, s: 2.6, col: p.hill, off: 900 },
    ];
    ctx.globalAlpha = p.mountains;
    for (const L of layers) {
      ctx.fillStyle = rgbStr(L.col);
      ctx.beginPath();
      const sx0 = Math.floor(x0 / 16) * 16 - 16, sx1 = x1 + 16;
      ctx.moveTo(sx0, VH);
      for (let sx = sx0; sx <= sx1; sx += 16) {
        const wx = sx + cam.x * L.f + L.off;
        ctx.lineTo(sx, L.base - Math.max(0, ridge(wx, L.s) * L.amp + 40 * L.amp));
      }
      ctx.lineTo(sx1, VH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (p.islands > 0.02) drawIslands(ctx, cam, VW, horizon, p, time);
  if (p.towers > 0.02) {
    skyline(ctx, cam, VW, VH, horizon, { f: 0.14, slot: 74, hMin: 130, hMax: 260, base: -60, color: p.far, win: p.window, lit: 0.06, alpha: p.towers, style: 'tower', seed: 300, x0, x1 });
    fogVeil(ctx, VW, VH, horizon, p, p.fog * 0.9, x0, x1);
  }
  if (p.noirCity > 0.02) {
    skyline(ctx, cam, VW, VH, horizon, { f: 0.12, slot: 66, hMin: 110, hMax: 220, base: -70, color: p.far, win: p.window, lit: 0.08, alpha: p.noirCity * 0.9, style: 'tower', seed: 100, x0, x1 });
    skyline(ctx, cam, VW, VH, horizon, { f: 0.3, slot: 60, hMin: 70, hMax: 170, base: -40, color: p.near, win: p.window, lit: 0.2, alpha: p.noirCity, style: 'tower', seed: 140, x0, x1 });
  }
  if (p.brown > 0.02) {
    skyline(ctx, cam, VW, VH, horizon, { f: 0.2, slot: 70, hMin: 80, hMax: 130, base: -70, color: p.far, trim: p.near, win: p.window, lit: 0.12, alpha: p.brown * 0.8, style: 'brown', seed: 200, x0, x1 });
    skyline(ctx, cam, VW, VH, horizon, { f: 0.36, slot: 78, hMin: 60, hMax: 110, base: -40, color: p.near, trim: p.hill, win: p.window, lit: 0.22, alpha: p.brown, style: 'brown', seed: 240, x0, x1 });
  }
  if (p.towers > 0.02) {
    skyline(ctx, cam, VW, VH, horizon, { f: 0.3, slot: 82, hMin: 80, hMax: 180, base: -40, color: p.near, win: p.window, lit: 0.1, alpha: p.towers, style: 'tower', seed: 340, x0, x1 });
  }
  if (p.fog > 0.02) fogVeil(ctx, VW, VH, horizon, p, p.fog * 0.55, x0, x1);
  if (p.tail > 0.02) drawTail(ctx, VW, horizon, p, time);
}

function skyline(ctx, cam, VW, VH, horizon, o) {
  const wx = cam.x * o.f;
  const i0 = Math.floor((wx + (o.x0 ?? 0) - 160) / o.slot), i1 = Math.ceil((wx + (o.x1 ?? VW) + 20) / o.slot);
  ctx.globalAlpha = o.alpha;
  const brown = o.style === 'brown';
  for (let i = i0; i <= i1; i++) {
    const w = o.slot * (0.72 + hash2(i, o.seed) * 0.28);
    const x = i * o.slot - wx + (o.slot - w) * hash2(i, o.seed + 1);
    const h = o.hMin + (o.hMax - o.hMin) * hash2(i, o.seed + 2);
    const top = horizon + o.base - h;
    ctx.fillStyle = rgbStr(o.color);
    ctx.fillRect(x, top, w, VH - top + 2);
    if (brown) {
      ctx.fillStyle = rgbStr(o.trim);
      ctx.fillRect(x - 3, top, w + 6, 7);
      ctx.fillRect(x - 1, top + 9, w + 2, 2);
    } else if (hash2(i, o.seed + 3) < 0.3) {
      ctx.fillStyle = rgbStr(o.color);
      ctx.fillRect(x + w / 2 - 1, top - 18, 2, 18);
    }
    const ww = brown ? 8 : 5, wh = brown ? 13 : 7, gx = brown ? 16 : 10, gy = brown ? 22 : 13;
    ctx.fillStyle = rgbStr(o.win, 0.9);
    let row = 0;
    for (let yy = top + 16; yy < top + h + 30 && yy < VH; yy += gy, row++) {
      let col = 0;
      for (let xx = x + 6; xx < x + w - ww - 3; xx += gx, col++) {
        if (hash2(i * 31 + col, row + o.seed * 7) < o.lit) ctx.fillRect(xx, yy, ww, wh);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function fogVeil(ctx, VW, VH, horizon, p, a, x0 = 0, x1 = VW) {
  if (a <= 0.01) return;
  ctx.fillStyle = rgbStr(p.fogColor, a * 0.85);
  ctx.fillRect(x0, 0, x1 - x0, VH);
}

function drawTail(ctx, VW, horizon, p, time) {
  // A figure on a rooftop at the left edge of the frame, keeping pace with you.
  const a = p.tail;
  const bx = VW * 0.015, bw = VW * 0.11, top = horizon - 150;
  ctx.fillStyle = rgbStr(p.hill, a);
  ctx.fillRect(bx, top, bw, 400);
  ctx.fillRect(bx - 4, top, bw + 8, 5);
  const x = bx + bw * 0.62 + Math.sin(time * 0.5) * 3, y = top;
  ctx.fillStyle = `rgba(3,4,9,${0.95 * a})`;
  ctx.beginPath();
  ctx.moveTo(x - 8, y); ctx.lineTo(x - 6, y - 30); ctx.lineTo(x + 6, y - 30); ctx.lineTo(x + 9, y);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y - 35, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x - 10, y - 40, 20, 3);
  ctx.fillRect(x - 6, y - 47, 12, 8);
  if (Math.sin(time * 0.9) > 0.92) {
    ctx.fillStyle = `rgba(255,190,90,${a})`;
    ctx.fillRect(x + 6, y - 33, 2, 2);
  }
}

function drawIslands(ctx, cam, VW, horizon, p, time) {
  const f = 0.18, slot = 260, wx = cam.x * f;
  ctx.globalAlpha = p.islands;
  for (let i = Math.floor((wx - 200) / slot); i <= Math.ceil((wx + VW + 200) / slot); i++) {
    if (hash2(i, 401) < 0.45) continue;
    const x = i * slot - wx + hash2(i, 402) * 120;
    const y = horizon * 0.42 + hash2(i, 403) * 70 + Math.sin(time * 0.6 + i) * 6;
    const w = 50 + hash2(i, 404) * 60;
    ctx.fillStyle = rgbStr(p.near);
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w * 0.1, y + w * 0.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgbStr(p.hill);
    ctx.beginPath(); ctx.ellipse(x, y, w / 2 + 4, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLab(ctx, cam, VW, horizon, p, time) {
  const f = 0.08, slot = 1100, wx = cam.x * f;
  ctx.globalAlpha = p.lab;
  for (let i = Math.floor((wx - 400) / slot); i <= Math.ceil((wx + VW + 400) / slot); i++) {
    const x = i * slot - wx + 200, y = horizon - 70;
    ctx.strokeStyle = rgbStr(p.far);
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x + 130, y + 6, 150, 26, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = rgbStr(p.far);
    ctx.fillRect(x, y - 22, 260, 30);
    ctx.beginPath(); ctx.arc(x + 70, y - 22, 26, Math.PI, 0); ctx.fill();
    ctx.fillRect(x + 190, y - 60, 6, 40);
    if (Math.sin(time * 3 + i) > 0) {
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      ctx.beginPath(); ctx.arc(x + 193, y - 62, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---- screen overlays --------------------------------------------------------
export function drawRain(ctx, VW, VH, amt, time) {
  if (amt <= 0.02) return;
  ctx.strokeStyle = `rgba(175,195,255,${0.35 * amt})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const n = Math.floor(130 * amt);
  for (let i = 0; i < n; i++) {
    const sp = 520 + hash2(i, 61) * 260;
    const x = ((hash2(i, 62) * (VW + 120) - time * 90) % (VW + 120) + VW + 120) % (VW + 120) - 60;
    const y = ((hash2(i, 63) * (VH + 60) + time * sp) % (VH + 60)) - 30;
    ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16);
  }
  ctx.stroke();
}

export function drawFogWorld(ctx, VW, VH, p) {
  if (p.fog <= 0.02) return;
  ctx.fillStyle = rgbStr(p.fogColor, p.fog * 0.16);
  ctx.fillRect(0, 0, VW, VH * 0.55);
}

export function drawComic(ctx, VW, VH, amt) {
  if (amt <= 0.03) return;
  ctx.fillStyle = `rgba(0,0,0,${0.16 * amt})`;
  const sp = 9;
  for (const [cx, cy] of [[0, 0], [VW, 0], [0, VH], [VW, VH]]) {
    for (let gx = 0; gx < 110; gx += sp) {
      for (let gy = 0; gy < 110; gy += sp) {
        const r = (1 - Math.hypot(gx, gy) / 120) * 3.2;
        if (r <= 0.3) continue;
        ctx.beginPath();
        ctx.arc(cx === 0 ? gx + 6 : VW - gx - 6, cy === 0 ? gy + 6 : VH - gy - 6, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.lineWidth = 7;
  ctx.strokeStyle = `rgba(255,252,240,${0.9 * amt})`;
  ctx.strokeRect(3.5, 3.5, VW - 7, VH - 7);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(15,15,20,${0.85 * amt})`;
  ctx.strokeRect(8, 8, VW - 16, VH - 16);
}

const RULE_TINT = { moon: 'rgba(150,180,255,0.10)', sunday: 'rgba(255,196,120,0.13)', small: 'rgba(120,255,170,0.08)', wind: 'rgba(255,255,255,0.05)' };
export function drawRegion(ctx, VW, VH, rule, time) {
  if (!rule) return;
  ctx.fillStyle = RULE_TINT[rule];
  ctx.fillRect(0, 0, VW, VH);
  if (rule === 'wind') {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const x = ((hash2(i, 71) * (VW + 200) + time * 700) % (VW + 200)) - 100;
      const y = hash2(i, 72) * VH;
      ctx.moveTo(x, y); ctx.lineTo(x + 40 + hash2(i, 73) * 40, y);
    }
    ctx.stroke();
  }
}

// ---- tiles ------------------------------------------------------------------
const SK = {
  grass: { top: [86, 184, 86], topDark: [56, 140, 66], body: [118, 78, 50], deep: [84, 56, 38], blades: [56, 140, 66], pebbles: true },
  street: { top: [128, 131, 140], topDark: [70, 72, 80], body: [44, 47, 58], deep: [34, 36, 45], curb: true, lamps: true, float: 'iron', spike: 'glass' },
  brownstone: { top: [184, 177, 166], topDark: [128, 120, 110], body: [138, 74, 55], deep: [112, 59, 44], slabs: true, brick: true, windows: true, graffiti: true, float: 'iron', spike: 'glass' },
  dream: { top: [255, 209, 236], topDark: [226, 150, 205], body: [142, 127, 224], deep: [120, 105, 206], wavy: true, sparkle: true, float: 'cloud', spike: 'crystal' },
  salt: { top: [246, 243, 236], topDark: [214, 206, 192], body: [217, 199, 167], deep: [194, 174, 142], saltCracks: true, pebbles: true, float: 'salt', spike: 'salt' },
  gray: { top: [154, 158, 164], topDark: [104, 108, 114], body: [92, 96, 102], deep: [74, 78, 84], slabs: true, graffiti: true, float: 'iron', spike: 'glass' },
  plain: { top: [205, 191, 143], topDark: [160, 146, 104], body: [155, 139, 116], deep: [131, 117, 96], blades: [150, 135, 90], pebbles: true },
};
const TAGS = ['ZEN 2', 'KAPOW', 'BLUE 99', 'MOONS', 'REV 7', 'TINY', 'OK!', 'JET 13', 'SLOW', 'NOVA'];
const TAG_COLORS = ['#ff4f8b', '#4fd1ff', '#ffe14f', '#7dff6a', '#ff8a3d', '#c77dff'];
const shade = (c, v) => `rgb(${(c[0] + v) | 0},${(c[1] + v) | 0},${(c[2] + v) | 0})`;

export function drawTiles(ctx, level, cam, VW, VH, time) {
  const c0 = Math.floor(cam.x / T) - 1, c1 = Math.ceil((cam.x + VW) / T) + 1;
  const r0 = Math.max(0, Math.floor(cam.y / T) - 1), r1 = Math.min(ROWS - 1, Math.ceil((cam.y + VH) / T) + 1);
  for (let cx = c0; cx <= c1; cx++) {
    const S = SK[level.skinAt(cx)] || SK.grass;
    for (let cy = r0; cy <= r1; cy++) {
      const t = level.get(cx, cy);
      if (!t) continue;
      const x = cx * T, y = cy * T;
      if (t === SPIKE) { drawSpike(ctx, x, y, S.spike || 'metal'); continue; }
      const floating = cy < ROWS - 1 && !level.isSolid(cx, cy + 1);
      if (floating && S.float) drawFloatTile(ctx, level, cx, cy, x, y, S.float);
      else drawGroundTile(ctx, level, cx, cy, x, y, S, t === CRACK, time);
    }
  }
  // decoration pass: street lamps and graffiti sit on top of neighboring tiles
  for (let cx = c0; cx <= c1; cx++) {
    const S = SK[level.skinAt(cx)] || SK.grass;
    if (!S.lamps && !S.graffiti) continue;
    for (let cy = Math.max(1, r0); cy <= r1; cy++) {
      if (!level.isSolid(cx, cy) || level.isSolid(cx, cy - 1)) continue;
      if (cy < ROWS - 1 && !level.isSolid(cx, cy + 1)) break;
      if (S.lamps && hash2(cx, 77) < 0.12) drawLamp(ctx, cx * T + T / 2, cy * T);
      if (S.graffiti && cy + 1 < ROWS && hash2(cx, 55) < 0.13) {
        const tag = TAGS[Math.floor(hash2(cx, 56) * TAGS.length)];
        ctx.save();
        ctx.translate(cx * T + 4, (cy + 1) * T + 26);
        ctx.rotate(-0.1);
        ctx.font = 'italic 900 13px system-ui, sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(10,10,10,0.7)';
        ctx.strokeText(tag, 0, 0);
        ctx.fillStyle = TAG_COLORS[Math.floor(hash2(cx, 57) * TAG_COLORS.length)];
        ctx.fillText(tag, 0, 0);
        ctx.restore();
      }
      break;
    }
  }
}

function drawGroundTile(ctx, level, cx, cy, x, y, S, crack, time) {
  const above = !level.isSolid(cx, cy - 1);
  const deep = !above && level.isSolid(cx, cy - 2);
  const v = (hash2(cx, cy) - 0.5) * 14;
  ctx.fillStyle = shade(deep ? S.deep : S.body, v);
  ctx.fillRect(x, y, T, T);
  if (S.brick) {
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < 4; k++) {
      ctx.moveTo(x, y + k * 12 + 0.5); ctx.lineTo(x + T, y + k * 12 + 0.5);
      const off = k % 2 ? 12 : 0;
      for (let bx = off; bx < T; bx += 24) { ctx.moveTo(x + bx + 0.5, y + (k - 1) * 12); ctx.lineTo(x + bx + 0.5, y + k * 12); }
    }
    ctx.stroke();
  }
  if (S.windows && !above && hash2(cx, cy + 40) < 0.2) {
    ctx.fillStyle = '#e9dcc6';
    ctx.fillRect(x + 11, y + 6, 26, 34);
    ctx.fillStyle = hash2(cx, cy + 41) < 0.4 ? '#ffd98a' : '#3a4152';
    ctx.fillRect(x + 14, y + 9, 20, 28);
    ctx.fillStyle = '#e9dcc6';
    ctx.fillRect(x + 23, y + 9, 2, 28);
  }
  if (S.sparkle && hash2(cx, cy + 60) < 0.35) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x + 8 + hash2(cx, cy + 61) * 30, y + 10 + hash2(cx, cy + 62) * 28, 2, 2);
  }
  if (S.pebbles && hash2(cx, cy + 100) < 0.35) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(x + 8 + hash2(cx, cy + 200) * 28, y + 12 + hash2(cx, cy + 300) * 24, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!level.isSolid(cx - 1, cy)) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y, 3, T); }
  if (!level.isSolid(cx + 1, cy)) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + T - 3, y, 3, T); }
  if (!level.isSolid(cx, cy + 1)) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + T - 4, T, 4); }
  if (above) {
    const gv = (hash2(cx, 7) - 0.5) * 16;
    ctx.fillStyle = shade(S.top, gv);
    if (S.wavy) {
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + T, y - 3);
      ctx.lineTo(x + T, y + 8);
      for (let k = 4; k >= 0; k--) ctx.quadraticCurveTo(x + k * 12 + 6, y + 16, x + k * 12, y + 8);
      ctx.closePath();
      ctx.fill();
    } else {
      roundRect(ctx, x - 1, y - 3, T + 2, 14, 4);
      ctx.fill();
      ctx.fillStyle = rgbStr(S.topDark);
      ctx.fillRect(x, y + 10, T, 3);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 2, y - 2, T - 4, 2);
    if (S.curb) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x + 6 + hash2(cx, 8) * 20, y + 3, 14, 2);
    }
    if (S.slabs) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 23, y - 2, 2, 12);
    }
    if (S.saltCracks) {
      ctx.strokeStyle = 'rgba(150,140,120,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + 18, y + 7); ctx.lineTo(x + 30, y + 2); ctx.lineTo(x + 44, y + 6);
      ctx.stroke();
    }
    if (S.blades) {
      ctx.strokeStyle = rgbStr(S.blades);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const h = hash2(cx * 3 + k, 9);
        if (h < 0.55) continue;
        const bx = x + 6 + h * 36;
        ctx.moveTo(bx, y - 2);
        ctx.lineTo(bx + (h - 0.5) * 8, y - 9 - h * 5);
      }
      ctx.stroke();
    }
  }
  if (crack) {
    const j = Math.sin(time * 40 + cx) * 0.6;
    ctx.strokeStyle = 'rgba(20,16,12,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y - 2 + j); ctx.lineTo(x + 14, y + 10); ctx.lineTo(x + 10, y + 22); ctx.lineTo(x + 22, y + 34);
    ctx.moveTo(x + 30, y - 2); ctx.lineTo(x + 26, y + 12); ctx.lineTo(x + 38, y + 20); ctx.lineTo(x + 34, y + 40);
    ctx.moveTo(x + 14, y + 10); ctx.lineTo(x + 26, y + 12);
    ctx.stroke();
  }
}

function drawFloatTile(ctx, level, cx, cy, x, y, kind) {
  if (kind === 'iron') {
    ctx.fillStyle = 'rgba(30,32,38,0.92)';
    ctx.fillRect(x + 1, y + 6, T - 2, T - 10);
    ctx.strokeStyle = 'rgba(95,100,112,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -T; k < T; k += 8) { ctx.moveTo(x + 1 + Math.max(0, k), y + 6 + Math.max(0, -k)); ctx.lineTo(x + 1 + Math.min(T - 2, k + T - 10), y + 6 + Math.min(T - 10, T - 10 - k)); }
    ctx.stroke();
    ctx.fillStyle = '#4a4e59';
    ctx.fillRect(x, y, T, 7);
    ctx.fillStyle = '#6b7080';
    ctx.fillRect(x, y, T, 2);
    if (!level.isSolid(cx - 1, cy)) { ctx.fillStyle = '#4a4e59'; ctx.fillRect(x, y - 16, 3, 16); }
    if (!level.isSolid(cx + 1, cy)) { ctx.fillStyle = '#4a4e59'; ctx.fillRect(x + T - 3, y - 16, 3, 16); }
    ctx.fillStyle = '#4a4e59';
    ctx.fillRect(x, y - 16, T, 2);
  } else if (kind === 'cloud') {
    ctx.fillStyle = 'rgba(190,160,230,0.6)';
    ctx.beginPath(); ctx.ellipse(x + T / 2, y + T - 8, T / 2, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4fb';
    ctx.beginPath();
    ctx.arc(x + 12, y + 22, 14, 0, Math.PI * 2);
    ctx.arc(x + 26, y + 14, 16, 0, Math.PI * 2);
    ctx.arc(x + 38, y + 22, 13, 0, Math.PI * 2);
    ctx.rect(x + 2, y + 18, T - 4, 20);
    ctx.fill();
  } else {
    ctx.fillStyle = '#efe9dd';
    roundRect(ctx, x + 1, y, T - 2, T - 4, 6);
    ctx.fill();
    ctx.fillStyle = '#d7cdb9';
    ctx.fillRect(x + 4, y + T - 14, T - 8, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x + 6, y + 4, T - 12, 3);
  }
}

function drawSpike(ctx, x, y, kind) {
  if (kind === 'glass') {
    const shards = [[4, 14, 22, 0.35, 'rgba(110,190,130,0.9)'], [17, 25, 33, 0.22, 'rgba(160,104,60,0.9)'], [29, 37, 45, 0.4, 'rgba(110,190,130,0.9)']];
    for (const [a, b, c, h, col] of shards) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x + a, y + T - 3); ctx.lineTo(x + b, y + T * h); ctx.lineTo(x + c, y + T - 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + b, y + T * h + 3); ctx.lineTo(x + b - 2, y + T - 8); ctx.stroke();
    }
    return;
  }
  const crystal = kind === 'crystal', salt = kind === 'salt';
  ctx.fillStyle = crystal ? '#5b3f8f' : salt ? '#cdbf9f' : '#2b2f3a';
  ctx.fillRect(x, y + T - 6, T, 6);
  for (let k = 0; k < 2; k++) {
    const sx = x + k * (T / 2);
    ctx.fillStyle = crystal ? '#ff9fe0' : salt ? '#ffffff' : '#d9dee8';
    ctx.beginPath(); ctx.moveTo(sx + 2, y + T - 5); ctx.lineTo(sx + T / 4, y + T * 0.3); ctx.lineTo(sx + T / 2 - 2, y + T - 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = crystal ? '#c46bd6' : salt ? '#e6dcc8' : '#8e97a8';
    ctx.beginPath(); ctx.moveTo(sx + T / 4, y + T * 0.3); ctx.lineTo(sx + T / 2 - 2, y + T - 5); ctx.lineTo(sx + T / 4 + 2, y + T - 5); ctx.closePath(); ctx.fill();
  }
}

function drawLamp(ctx, x, groundY) {
  const hx = x + 12, hy = groundY - 118;
  const g = ctx.createLinearGradient(0, hy, 0, groundY);
  g.addColorStop(0, 'rgba(255,214,130,0.28)');
  g.addColorStop(1, 'rgba(255,214,130,0.04)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(hx - 5, hy); ctx.lineTo(hx + 5, hy); ctx.lineTo(hx + 44, groundY); ctx.lineTo(hx - 44, groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1c1f28';
  ctx.fillRect(x - 2, groundY - 124, 4, 124);
  ctx.fillRect(x - 2, groundY - 126, 18, 4);
  ctx.fillStyle = '#ffe2a0';
  ctx.fillRect(hx - 5, hy - 2, 10, 4);
}

// ---- world entities ---------------------------------------------------------
export function drawPlatform(ctx, p) {
  if (p.style === 'cloud') {
    ctx.fillStyle = '#fff4fb';
    ctx.beginPath();
    for (let k = 0; k <= p.w; k += 24) ctx.arc(p.x + k, p.y + 8, 13, 0, Math.PI * 2);
    ctx.rect(p.x - 6, p.y + 6, p.w + 12, p.h - 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,160,230,0.5)';
    ctx.fillRect(p.x - 4, p.y + p.h - 4, p.w + 8, 4);
    return;
  }
  const steel = p.style === 'steel';
  ctx.fillStyle = steel ? '#3d424d' : '#9a5f33';
  roundRect(ctx, p.x, p.y, p.w, p.h, steel ? 3 : 6);
  ctx.fill();
  ctx.fillStyle = steel ? '#6b7180' : '#c98a4f';
  roundRect(ctx, p.x + 2, p.y + 2, p.w - 4, 6, 3);
  ctx.fill();
  ctx.fillStyle = steel ? '#2a2e36' : '#5e3a1f';
  for (let i = 1; i < p.w / T; i++) ctx.fillRect(p.x + i * T - 1, p.y + 3, 2, p.h - 6);
  ctx.fillStyle = steel ? '#9aa1b0' : '#3c3f4a';
  ctx.beginPath();
  ctx.arc(p.x + 8, p.y + p.h / 2 + 2, 2.5, 0, Math.PI * 2);
  ctx.arc(p.x + p.w - 8, p.y + p.h / 2 + 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

export function drawCoin(ctx, c, time) {
  const bob = Math.sin(time * 3 + c.x * 0.02) * 3;
  const sx = Math.abs(Math.cos(time * 4 + c.x * 0.03));
  const y = c.y + bob;
  ctx.fillStyle = '#d6931a';
  ctx.beginPath(); ctx.ellipse(c.x, y, 11 * sx + 1.5, 12.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.ellipse(c.x, y, 10 * sx, 11, 0, 0, Math.PI * 2); ctx.fill();
  if (sx > 0.35) {
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.ellipse(c.x - 3 * sx, y - 4, 3 * sx, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d6931a';
    ctx.fillRect(c.x - 1.5 * sx, y - 5, 3 * sx, 10);
  }
}

export function drawHeartShape(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.2, y + s * 0.1, x - s * 0.9, y - s * 0.9, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 0.9, x + s * 1.2, y + s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

export function drawItem(ctx, it, time) {
  const x = it.x + it.w / 2;
  if (it.type === 'heart') {
    const y = it.y + it.h / 2 + Math.sin(time * 3) * 3;
    ctx.fillStyle = 'rgba(255,90,110,0.25)';
    ctx.beginPath(); ctx.arc(x, y, 22 + Math.sin(time * 5) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8364f';
    drawHeartShape(ctx, x, y, 13);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(x - 5, y - 4, 3, 2, -0.6, 0, Math.PI * 2); ctx.fill();
  } else if (it.type === 'ring') {
    const y = it.y + it.h / 2 + Math.sin(time * 2.5) * 4;
    const g = ctx.createRadialGradient(x, y, 2, x, y, 34);
    g.addColorStop(0, 'rgba(255,230,140,0.55)');
    g.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 36, y - 36, 72, 72);
    const sx = Math.abs(Math.cos(time * 2)) * 10 + 2;
    ctx.strokeStyle = '#e8b63a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x, y, sx, 10, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#9ef0ff';
    ctx.beginPath(); ctx.arc(x, y - 11, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (it.type === 'vase') {
    const a = 0.16 + 0.12 * Math.sin(time * 2.3) + (Math.sin(time * 7.1) > 0.97 ? 0.4 : 0);
    const y = it.y + it.h;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = '#dbe8ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 34); ctx.lineTo(x + 6, y - 34);
    ctx.quadraticCurveTo(x + 4, y - 26, x + 12, y - 16);
    ctx.quadraticCurveTo(x + 14, y - 4, x + 6, y);
    ctx.lineTo(x - 6, y);
    ctx.quadraticCurveTo(x - 14, y - 4, x - 12, y - 16);
    ctx.quadraticCurveTo(x - 4, y - 26, x - 6, y - 34);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function drawFlag(ctx, f, time) {
  const x = f.x, base = f.y;
  if (f.tag) drawPlayerTag(ctx, x, base);
  if (f.gate != null) {
    ctx.fillStyle = '#3b3f4b';
    ctx.fillRect(x - 12, base - 4, 24, 4);
    ctx.fillStyle = '#d9d2c3';
    ctx.fillRect(x - 2, base - 140, 4, 136);
    ctx.fillRect(x - 16, base - 142, 32, 4);
    const sway = Math.sin(time * 2 + x) * 2;
    ctx.fillStyle = f.active ? '#ffcf4a' : '#c0392b';
    ctx.beginPath();
    ctx.moveTo(x - 12, base - 138); ctx.lineTo(x + 12, base - 138);
    ctx.lineTo(x + 12 + sway, base - 72); ctx.lineTo(x + sway, base - 84); ctx.lineTo(x - 12 + sway, base - 72);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = f.active ? '#5a3b00' : '#fff3e0';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.label || '', x + sway * 0.4, base - 116);
    return;
  }
  ctx.fillStyle = '#3b3f4b';
  ctx.fillRect(x - 10, base - 4, 20, 4);
  ctx.fillStyle = '#c9ced9';
  ctx.fillRect(x - 2, base - 100, 4, 96);
  ctx.beginPath(); ctx.arc(x, base - 102, 4, 0, Math.PI * 2); ctx.fill();
  const w = Math.sin(time * 6 + x) * 3;
  ctx.fillStyle = f.active ? '#4cd964' : '#8a8f9c';
  ctx.beginPath();
  ctx.moveTo(x + 2, base - 98);
  ctx.quadraticCurveTo(x + 20, base - 92 + w, x + 36, base - 84 - w);
  ctx.lineTo(x + 2, base - 68);
  ctx.closePath();
  ctx.fill();
  if (f.active) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(x + 16, base - 84, 4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayerTag(ctx, x, base) {
  ctx.save();
  ctx.translate(x - 30, base + 32);
  ctx.rotate(-0.08);
  ctx.font = 'italic 900 19px system-ui, sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#141018';
  ctx.strokeText('DASH', 0, 0);
  ctx.fillStyle = '#ff5d5d';
  ctx.fillText('DASH', 0, 0);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('*', 58, -10);
  ctx.restore();
}

const WALKER_STYLES = {
  blob: { body: '#8c5cff', light: '#a983ff', feet: '#4b2d8a' },
  hat: { body: '#4b5675', light: '#64709a', feet: '#232a3d' },
  cap: { body: '#3bb36a', light: '#62d08c', feet: '#1f6b3d' },
  dream: { body: '#4fd1c5', light: '#93f1e8', feet: '#2a8a80' },
  shadow: { body: '#241b30', light: '#3a2d4c', feet: '#120d1a' },
  plain: { body: '#a59b84', light: '#bdb39b', feet: '#7a715f' },
};

export function drawWalker(ctx, e) {
  const S = WALKER_STYLES[e.style] || WALKER_STYLES.blob;
  const cx = e.x + e.w / 2, by = e.y + e.h;
  const sq = 1 + Math.sin(e.anim * 10) * 0.06;
  const h = e.h;
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(e.dir > 0 ? 1 : -1, 1);
  ctx.scale(1 / sq, sq);
  ctx.fillStyle = S.feet;
  const f = Math.sin(e.anim * 10) * 5;
  ctx.beginPath(); ctx.ellipse(-10 + f, -3, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10 - f, -3, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = S.body;
  ctx.beginPath(); ctx.ellipse(0, -h / 2 - 1, e.w / 2, h / 2 - 1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = S.light;
  ctx.beginPath(); ctx.ellipse(-4, -h / 2 - 7, e.w / 4, h / 5, -0.3, 0, Math.PI * 2); ctx.fill();
  if (e.style === 'hat') {
    ctx.fillStyle = '#2a3045';
    ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-4, -h * 0.55); ctx.lineTo(4, -6); ctx.closePath(); ctx.fill();
  }
  const eyeCol = e.style === 'shadow' ? '#f4f0ff' : '#fff';
  ctx.fillStyle = eyeCol;
  ctx.beginPath(); ctx.ellipse(6, -h / 2 - 2, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16, -h / 2 - 3, 5, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (e.style !== 'shadow') {
    ctx.fillStyle = '#1b1430';
    ctx.beginPath(); ctx.arc(8, -h / 2 - 2, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(17.5, -h / 2 - 3, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  if (e.style === 'blob' || e.style === 'cap' || e.style === 'hat') {
    ctx.strokeStyle = '#1b1430';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(1, -h / 2 - 10); ctx.lineTo(11, -h / 2 - 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -h / 2 - 10); ctx.lineTo(21, -h / 2 - 7); ctx.stroke();
  }
  if (e.style === 'hat') {
    ctx.fillStyle = '#14161f';
    ctx.beginPath(); ctx.ellipse(0, -h + 1, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
    roundRect(ctx, -12, -h - 11, 24, 12, 4); ctx.fill();
    ctx.fillStyle = '#8a3030';
    ctx.fillRect(-12, -h - 3, 24, 3);
  } else if (e.style === 'cap') {
    ctx.fillStyle = '#e0453a';
    ctx.beginPath(); ctx.arc(0, -h + 6, 14, Math.PI, 0); ctx.fill();
    ctx.fillRect(-26, -h + 3, 14, 4);
  } else if (e.style === 'dream') {
    ctx.strokeStyle = '#2a8a80';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -h + 2); ctx.lineTo(4, -h - 10); ctx.stroke();
    ctx.fillStyle = '#ffe14f';
    ctx.beginPath(); ctx.arc(4, -h - 12, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawBat(ctx, b, time) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (b.style === 'pigeon') {
    const flap = Math.sin(time * 18 + b.phase);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(b.face < 0 ? -1 : 1, 1);
    ctx.fillStyle = '#8d93a3';
    ctx.beginPath(); ctx.ellipse(0, 2, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6f7585';
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-2, -14 * flap - 4, 10, -2 - 10 * flap); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5e8f7e';
    ctx.beginPath(); ctx.ellipse(10, -3, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8d93a3';
    ctx.beginPath(); ctx.arc(14, -7, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath(); ctx.arc(15.5, -8, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9c7a0';
    ctx.beginPath(); ctx.moveTo(18, -7); ctx.lineTo(23, -5); ctx.lineTo(18, -5); ctx.fill();
    ctx.fillStyle = '#4d5260';
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-22, -2); ctx.lineTo(-20, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    return;
  }
  const flap = Math.sin(time * 16 + b.phase) * 0.7;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#2d2148';
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    ctx.rotate(-flap * 0.6);
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.quadraticCurveTo(18, -14 - flap * 8, 30, -4 - flap * 8);
    ctx.quadraticCurveTo(24, 2, 22, 6);
    ctx.quadraticCurveTo(16, 2, 12, 8);
    ctx.quadraticCurveTo(8, 4, 4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#3d2c63';
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(-4, -13); ctx.lineTo(-1, -6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(7, -6); ctx.lineTo(4, -13); ctx.lineTo(1, -6); ctx.fill();
  ctx.fillStyle = '#ff5a5a';
  ctx.beginPath(); ctx.arc(-3.5, -1, 2, 0, Math.PI * 2); ctx.arc(3.5, -1, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawBall(ctx, b) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  const sh = clamp(1 - b.h / 140, 0.3, 1);
  ctx.beginPath(); ctx.ellipse(b.x, b.base - 2, 12 * sh, 3 * sh, 0, 0, Math.PI * 2); ctx.fill();
  const y = b.base - b.r - b.h;
  ctx.save();
  ctx.translate(b.x, y + b.r * (1 - b.sq));
  ctx.scale(2 - b.sq, b.sq);
  ctx.fillStyle = '#ff8fb8';
  ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffc1d8';
  ctx.beginPath(); ctx.arc(-4, -5, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawVoid(ctx, v, time) {
  for (let k = 0; k < 3; k++) {
    const ph = (time * 0.5 + k / 3) % 1;
    ctx.strokeStyle = `rgba(255,232,205,${(1 - ph) * 0.35})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(v.x, v.y, v.r + 6 + (1 - ph) * 42, 0, Math.PI * 2); ctx.stroke();
  }
  const g = ctx.createRadialGradient(v.x, v.y, v.r * 0.8, v.x, v.y, v.r * 1.8);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(v.x, v.y, v.r * 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,220,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2); ctx.stroke();
}

function wrapLines(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawSign(ctx, s, text) {
  const x = s.x, gy = s.y, bw = 4 * T, bh = 52, by = gy - 120;
  ctx.fillStyle = '#7a5235';
  ctx.fillRect(x + 20, by + bh, 6, gy - by - bh);
  ctx.fillRect(x + bw - 26, by + bh, 6, gy - by - bh);
  ctx.fillStyle = '#fff3c4';
  roundRect(ctx, x, by, bw, bh, 6); ctx.fill();
  ctx.strokeStyle = '#8a5a3c';
  ctx.lineWidth = 3;
  roundRect(ctx, x, by, bw, bh, 6); ctx.stroke();
  ctx.fillStyle = '#4a2f6b';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapLines(ctx, text, bw - 14).slice(0, 3);
  lines.forEach((l, i) => ctx.fillText(l, x + bw / 2, by + bh / 2 + (i - (lines.length - 1) / 2) * 13));
}

export function drawBillboard(ctx, b, text) {
  const x = b.x, gy = b.y, bw = 4.6 * T, bh = 70, by = gy - 3.8 * T;
  ctx.fillStyle = '#3a3e46';
  ctx.fillRect(x + 22, by + bh, 6, gy - by - bh);
  ctx.fillRect(x + bw - 28, by + bh, 6, gy - by - bh);
  ctx.fillStyle = '#efe9da';
  ctx.fillRect(x, by, bw, bh);
  ctx.strokeStyle = '#26282d';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, by, bw, bh);
  ctx.fillStyle = '#b3261e';
  ctx.font = 'bold 9px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('LATE EDITION', x + 8, by + 6);
  ctx.fillStyle = '#1d1d1d';
  ctx.fillRect(x + 8, by + 17, bw - 16, 1);
  ctx.font = '900 15px Georgia, serif';
  const lines = wrapLines(ctx, text, bw - 16).slice(0, 2);
  lines.forEach((l, i) => ctx.fillText(l, x + 8, by + 22 + i * 18));
}

// Dreamed Country's door into the mind: a door standing alone in a field, ajar, words spilling out.
const DOOR_WORDS = ['maybe', 'what if', 'draft', 'margin', 'someday', 'chapter', 'almost', 'footnote'];
export function drawMindDoor(ctx, o, time) {
  const x = o.x, gy = o.y, w = 46, h = 92;
  // sign
  const sx = x + 2.2 * T;
  ctx.fillStyle = '#7a5235';
  ctx.fillRect(sx + 10, gy - 112, 6, 112);
  ctx.fillStyle = '#fff3c4';
  roundRect(ctx, sx - 34, gy - 146, 150, 46, 6); ctx.fill();
  ctx.strokeStyle = '#8a5a3c'; ctx.lineWidth = 3;
  roundRect(ctx, sx - 34, gy - 146, 150, 46, 6); ctx.stroke();
  ctx.fillStyle = '#4a2f6b'; ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('A DOOR INTO', sx + 41, gy - 131);
  ctx.fillText('THE MIND', sx + 41, gy - 115);
  // light and words spilling out of the gap
  const g = ctx.createRadialGradient(x + w, gy - h / 2, 4, x + w, gy - h / 2, 90);
  g.addColorStop(0, 'rgba(255,240,190,0.55)');
  g.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 60, gy - h - 60, 220, h + 60);
  ctx.font = 'italic 11px Georgia, serif';
  for (let i = 0; i < DOOR_WORDS.length; i++) {
    const t = (time * 0.35 + i / DOOR_WORDS.length) % 1;
    ctx.fillStyle = `rgba(255,248,225,${(1 - t) * 0.9})`;
    ctx.fillText(DOOR_WORDS[i], x + w + 10 + t * 70, gy - h * 0.7 + Math.sin(time + i * 2) * 16 - t * 40);
  }
  // frame, the dark inside, and the door swung open
  ctx.fillStyle = '#5a3e2b';
  ctx.fillRect(x - 6, gy - h - 6, w + 12, h + 6);
  ctx.fillStyle = '#12101c';
  ctx.fillRect(x, gy - h, w, h);
  ctx.fillStyle = 'rgba(255,240,190,0.85)';
  ctx.fillRect(x + w - 8, gy - h, 8, h);
  ctx.fillStyle = '#8c5a3a';
  ctx.beginPath(); ctx.moveTo(x, gy - h); ctx.lineTo(x + w * 0.55, gy - h - 6); ctx.lineTo(x + w * 0.55, gy + 4); ctx.lineTo(x, gy); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(x + w * 0.45, gy - h / 2, 2.5, 0, Math.PI * 2); ctx.fill();
}

export function drawGlimpse(ctx, g) {
  const a = clamp(Math.min(g.t, g.life - g.t) / 0.25, 0, 1);
  ctx.save();
  ctx.beginPath(); ctx.rect(g.x0, g.y, g.w, 3 * T); ctx.clip();
  ctx.globalAlpha = a;
  const bx = g.x0 - 100 + (g.t / g.life) * (g.w + 200), by = g.y + T * 0.8;
  ctx.fillStyle = '#e8892b';
  roundRect(ctx, bx, by, 96, 32, 14); ctx.fill();
  ctx.beginPath(); ctx.arc(bx + 96, by + 12, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a120c';
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(bx + 12 + k * 14, by); ctx.lineTo(bx + 18 + k * 14, by + 14); ctx.lineTo(bx + 10 + k * 14, by + 32); ctx.lineTo(bx + 6 + k * 14, by); ctx.fill(); }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(bx + 102, by + 8, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawPlayer(ctx, p, time) {
  if (p.trail.length > 2) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = p.trail.length - 1; i > 0; i--) {
      const a = p.trail[i], b = p.trail[i - 1];
      ctx.lineWidth = (2 + (i / p.trail.length) * 6) * p.scale;
      const base = ctx.globalAlpha;
      ctx.globalAlpha = base * (0.3 + 0.7 * (i / p.trail.length));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.globalAlpha = base;
    }
  }
  const cx = p.x + p.w / 2, by = p.y + p.h;
  if (p.flying) {
    const g = ctx.createRadialGradient(cx, by - p.h / 2, 4, cx, by - p.h / 2, 46);
    g.addColorStop(0, 'rgba(255,230,140,0.5)');
    g.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 48, by - p.h / 2 - 48, 96, 96);
  }
  ctx.save();
  ctx.translate(cx, by);
  ctx.rotate(p.spin * p.facing);
  ctx.scale(p.facing * p.sx * p.scale, p.sy * p.scale);
  const h = 42, w = 30;
  ctx.fillStyle = '#c93a3a';
  if (p.grounded && Math.abs(p.vx) > 20) {
    const s = Math.sin(p.runPhase);
    ctx.beginPath(); ctx.ellipse(-6 + s * 7, -3, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6 - s * 7, -3, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  } else if (p.grounded) {
    ctx.beginPath(); ctx.ellipse(-7, -3, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -3, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(-6, -6, 6, 4.5, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -8, 6, 4.5, -0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ff5d5d';
  roundRect(ctx, -w / 2, -h, w, h - 4, 11);
  ctx.fill();
  ctx.fillStyle = '#ff8c8c';
  roundRect(ctx, -w / 2 + 5, -h + 18, w - 10, h - 28, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  roundRect(ctx, -w / 2 + 3, -h + 3, w - 6, 8, 4);
  ctx.fill();
  const look = Math.max(-1, Math.min(1, p.vy / 600));
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(3, -h + 15, 5.5, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(11, -h + 15, 4.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#23182b';
  ctx.beginPath(); ctx.arc(4.5, -h + 15 + look * 2.5, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(12, -h + 15 + look * 2.5, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.ellipse(8, -h + 24, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
  if (p.ring) {
    ctx.strokeStyle = '#e8b63a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(13, -12, 3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

export function drawAbyss(ctx, cam, VW) {
  const g = ctx.createLinearGradient(0, LEVEL_BOTTOM, 0, LEVEL_BOTTOM + 260);
  g.addColorStop(0, 'rgba(10,8,20,0)');
  g.addColorStop(1, 'rgba(10,8,20,1)');
  ctx.fillStyle = g;
  ctx.fillRect(cam.x - 100, LEVEL_BOTTOM - 1, VW + 200, 1400);
}

export function drawParticles(ctx, parts) {
  for (const q of parts) {
    const a = Math.max(0, q.life / q.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = q.color;
    const s = q.size * (0.5 + 0.5 * a);
    if (q.shape === 'rect') ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    else { ctx.beginPath(); ctx.arc(q.x, q.y, s / 2, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

export function drawTexts(ctx, texts) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of texts) {
    const a = clamp(t.life / 0.3, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(t.x, t.y);
    if (t.rot) ctx.rotate(t.rot);
    ctx.font = t.comic ? '900 26px system-ui, sans-serif' : 'bold 18px system-ui, sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = t.comic ? 6 : 4;
    ctx.strokeStyle = t.comic ? '#140c1c' : 'rgba(0,0,0,0.5)';
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color || '#fff';
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
}

export function drawTouchHints(ctx, zones, W, H, active) {
  if (!active) return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y = H - 70;
  const draw = (x, label, on) => {
    ctx.fillStyle = on ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(label, x, y + 1);
  };
  draw(W * 0.15, '◀', zones.left);
  draw(W * 0.425, '▶', zones.right);
  draw(W * 0.8, '▲', zones.jump);
}
