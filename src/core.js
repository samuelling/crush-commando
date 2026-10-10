'use strict';
// ===================== CORE: constants, rng, physics =====================
const TILE = 16, VW = 480, VH = 272, ROWS = 17, MAXHP = 5;
const T = { AIR: 0, SOLID: 1, ONEWAY: 2, SPIKEUP: 3, SPIKEDN: 4, LAVA: 5, CRUMBLE: 6, BREAK: 7, ICE: 8, VENT: 9 };
const PH = {
  runMax: 150, accG: 1500, decG: 1900, accA: 1100, decA: 600, iceAcc: 380, iceDec: 170,
  jumpV: 420, djV: 360, gHold: 1150, gFall: 1600, gCut: 2700, maxFall: 470,
  coyote: 0.15, buffer: 0.17,
  dashV: 400, dashT: 0.16,
  wallSlide: 60, wjVX: 175, wjVY: 390, wallLock: 0.14,
  glideFall: 42, springV: 560,
  pw: 10, ph: 14,
};

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tileAt(L, tx, ty) {
  if (tx < 0 || tx >= L.w) return T.SOLID;
  if (ty < 0) return L.grid[tx] === T.SOLID ? T.SOLID : T.AIR;
  if (ty >= L.h) return T.AIR;
  return L.grid[ty * L.w + tx];
}
function isSolidT(L, tx, ty) {
  const t = tileAt(L, tx, ty);
  if (t === T.SOLID || t === T.ICE || t === T.VENT) return true;
  if (t === T.CRUMBLE) { const c = L.crumble.get(ty * L.w + tx); return !c || c.s < 2; }
  if (t === T.BREAK) return !(L.breakAll || L.broken.has(ty * L.w + tx));
  return false;
}
function solidRect(L, x, y, w, h, P) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (isSolidT(L, tx, ty)) {
      if (P && P.dashT > 0 && tileAt(L, tx, ty) === T.BREAK) {
        L.broken.add(ty * L.w + tx);
        if (L.onBreak) L.onBreak(tx, ty);
        continue;
      }
      return true;
    }
  }
  return false;
}
function onewayTop(L, x, w, prevBottom, newBottom) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const ty = Math.floor((newBottom - 0.01) / TILE), top = ty * TILE;
  if (prevBottom > top + 0.5) return null;
  for (let tx = x0; tx <= x1; tx++) if (tileAt(L, tx, ty) === T.ONEWAY) return top;
  return null;
}
function hazardHit(L, x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileAt(L, tx, ty);
    let rx, ry, rw, rh;
    if (t === T.SPIKEUP) { rx = tx * 16 + 2; ry = ty * 16 + 9; rw = 12; rh = 7; }
    else if (t === T.SPIKEDN) { rx = tx * 16 + 2; ry = ty * 16; rw = 12; rh = 7; }
    else if (t === T.LAVA) { rx = tx * 16; ry = ty * 16 + 6; rw = 16; rh = 10; }
    else continue;
    if (x < rx + rw && x + w > rx && y < ry + rh && y + h > ry) return true;
  }
  for (const s of L.saws) {
    const cx = Math.max(x, Math.min(s.x, x + w)), cy = Math.max(y, Math.min(s.y, y + h));
    const dx = s.x - cx, dy = s.y - cy, r = s.r - 2;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

function newPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, onGround: true, onOneway: false, groundIce: false, coyote: 0, buffer: 0,
    jumping: false, spring: false, canDJ: false, dashAvail: true, dashT: 0, dashCD: 0, dashVX: 0, dashVY: 0,
    wall: 0, wallLock: 0, lockDir: 0, sliding: false, gliding: false, glideArmed: false, inDraft: false,
    face: 1, plat: null, dropT: 0, z: 0, vz: 0, lane: 0,
  };
}

// returns 0 ok, 1 hazard, 2 pit
function stepPlayer(P, inp, L, dt, ab, fx) {
  const pw = PH.pw, ph = PH.ph;
  const hor = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (inp.jumpPressed) P.buffer = PH.buffer; else if (P.buffer > 0) P.buffer -= dt;
  if (P.onGround) P.coyote = PH.coyote; else if (P.coyote > 0) P.coyote -= dt;
  if (P.wallLock > 0) P.wallLock -= dt;
  if (P.dashCD > 0) P.dashCD -= dt;
  if (P.dropT > 0) P.dropT -= dt;

  function jump(v) {
    P.vy = -v;
    if (P.plat) { P.vx += (P.plat.vx || 0) * 0.6; P.vy += Math.min(0, P.plat.vy || 0); }
    P.onGround = false; P.coyote = 0; P.buffer = 0; P.jumping = true; P.canDJ = ab.dj; P.spring = false;
    fx && fx.jump && fx.jump(P);
  }

  if (inp.dashPressed && ab.dash && P.dashAvail && P.dashT <= 0 && P.dashCD <= 0) {
    let dx = hor, dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (P.onGround && dy > 0) dy = 0;
    if (dx === 0 && dy === 0) dx = P.face;
    const m = Math.hypot(dx, dy);
    P.dashVX = dx / m * PH.dashV; P.dashVY = dy / m * PH.dashV;
    P.dashT = PH.dashT; P.dashAvail = false; P.dashCD = 0.22;
    P.gliding = false; P.jumping = false; P.spring = false; P.wallLock = 0;
    if (dx) P.face = dx > 0 ? 1 : -1;
    fx && fx.dash && fx.dash(P);
  }

  let maxF = PH.maxFall;
  if (P.dashT > 0) {
    P.dashT -= dt; P.vx = P.dashVX; P.vy = P.dashVY;
    if (P.buffer > 0 && P.coyote > 0 && P.dashVY >= 0) {
      P.dashT = 0; const keep = P.dashVX * 0.85; jump(PH.jumpV); P.vx = keep;
    } else if (P.dashT <= 0) { P.vx = P.dashVX * 0.6; P.vy = P.dashVY * 0.35; }
  } else {
    const ice = P.onGround && P.groundIce;
    const acc = P.onGround ? (ice ? PH.iceAcc : PH.accG) : PH.accA;
    const dec = P.onGround ? (ice ? PH.iceDec : PH.decG) : PH.decA;
    const h = P.wallLock > 0 ? P.lockDir : hor;
    if (h !== 0) {
      if (P.vx * h < 0) P.vx += h * (acc + dec) * dt;
      else if (Math.abs(P.vx) <= PH.runMax) { P.vx += h * acc * dt; if (P.vx * h > PH.runMax) P.vx = h * PH.runMax; }
      else { P.vx -= h * (P.onGround ? dec : PH.decA * 0.4) * dt; if (P.vx * h < PH.runMax) P.vx = h * PH.runMax; }
      if (P.wallLock <= 0) P.face = h;
    } else {
      const d = dec * dt; P.vx = Math.abs(P.vx) <= d ? 0 : P.vx - Math.sign(P.vx) * d;
    }
    P.wall = 0;
    if (ab.wall && !P.onGround) {
      if (solidRect(L, P.x + pw, P.y + 3, 3, ph - 6)) P.wall = 1;
      else if (solidRect(L, P.x - 3, P.y + 3, 3, ph - 6)) P.wall = -1;
    }
    if (P.buffer > 0) {
      if (P.onGround && P.onOneway && inp.down) { P.dropT = 0.25; P.buffer = 0; P.onGround = false; P.coyote = 0; P.y += 2; }
      else if (P.onGround || P.coyote > 0) jump(PH.jumpV);
      else if (P.wall !== 0) {
        P.vx = -P.wall * PH.wjVX; P.vy = -PH.wjVY; P.wallLock = PH.wallLock; P.lockDir = -P.wall; P.face = -P.wall;
        P.buffer = 0; P.jumping = true; P.canDJ = ab.dj; fx && fx.wallJump && fx.wallJump(P);
      } else if (ab.dj && P.canDJ) {
        P.vy = -PH.djV; P.canDJ = false; P.buffer = 0; P.jumping = true; P.glideArmed = true; fx && fx.dj && fx.dj(P);
      } else if (ab.glide && inp.jumpPressed) { P.glideArmed = true; P.buffer = 0; }
    }
    // updraft
    P.inDraft = false;
    for (const u of L.updrafts) if (P.x + pw > u.x && P.x < u.x + u.w && P.y + ph > u.y && P.y < u.y + u.h) { P.inDraft = true; break; }
    const wantGlide = ab.glide && !P.onGround && P.glideArmed && inp.jump;
    if (wantGlide && P.inDraft) {
      P.gliding = true; P.vy -= 1300 * dt; if (P.vy < -240) P.vy = -240;
    } else {
      let g;
      if (P.vy < 0) g = (P.spring || (P.jumping && inp.jump)) ? PH.gHold : PH.gCut;
      else { g = PH.gFall; P.jumping = false; P.spring = false; }
      if (Math.abs(P.vy) < 40 && inp.jump && !P.onGround) g *= 0.5;
      P.vy += g * dt;
      P.sliding = P.wall !== 0 && hor === P.wall && P.vy > 0;
      if (P.sliding) maxF = PH.wallSlide;
      P.gliding = wantGlide && P.vy > 0 && !P.sliding;
      if (P.gliding) maxF = PH.glideFall;
      else if (P.inDraft) maxF = 160;
    }
    if (P.vy > maxF) P.vy = Math.max(maxF, P.vy - 2400 * dt);
  }

  // ---- move X
  const prevBottom = P.y + ph;
  P.x += P.vx * dt;
  if (solidRect(L, P.x, P.y, pw, ph, P)) {
    let nudged = false;
    if (P.dashT > 0 && P.dashVY === 0) {
      for (let s = 1; s <= 6; s++) if (!solidRect(L, P.x, P.y - s, pw, ph)) { P.y -= s; nudged = true; break; }
    }
    if (!nudged) {
      if (P.vx > 0) P.x = Math.floor((P.x + pw) / TILE) * TILE - pw - 0.01;
      else if (P.vx < 0) P.x = (Math.floor(P.x / TILE) + 1) * TILE;
      P.vx = 0;
    }
  }
  // ---- move Y
  P.y += P.vy * dt;
  const wasGround = P.onGround;
  P.onGround = false;
  const lastPlat = P.plat; P.plat = null;
  if (P.vy < 0) {
    if (solidRect(L, P.x, P.y, pw, ph, P)) {
      let fixed = false;
      for (let s = 1; s <= 5 && !fixed; s++) for (const d of [1, -1]) {
        if (!solidRect(L, P.x + d * s, P.y, pw, ph)) { P.x += d * s; fixed = true; break; }
      }
      if (!fixed) {
        P.y = (Math.floor(P.y / TILE) + 1) * TILE; P.vy = 0;
        if (P.dashT > 0) P.dashT = 0;
        fx && fx.bonk && fx.bonk(P);
      }
    }
  } else {
    let landY = null, one = false;
    if (solidRect(L, P.x, P.y, pw, ph, P)) landY = Math.floor((P.y + ph) / TILE) * TILE;
    if (landY === null && P.dropT <= 0) {
      const t = onewayTop(L, P.x, pw, prevBottom, P.y + ph);
      if (t !== null) { landY = t; one = true; }
    }
    if (landY === null && P.dropT <= 0) {
      for (const p of L.plats) {
        if (p.gone) continue;
        const pb = (lastPlat === p) ? p.y : prevBottom;
        if (P.x + pw > p.x && P.x < p.x + p.w && Math.min(prevBottom, pb) <= p.y + 3 && P.y + ph >= p.y) {
          landY = p.y; P.plat = p; one = true; break;
        }
      }
    }
    if (landY === null && P.vy === 0 && solidRect(L, P.x, P.y + ph, pw, 1)) { P.onGround = true; P.onOneway = false; }
    if (landY !== null) {
      P.y = landY - ph;
      if (!wasGround && fx && fx.land) fx.land(P, P.vy);
      P.vy = 0; P.onGround = true; P.onOneway = one;
      P.canDJ = ab.dj; P.dashAvail = true; P.glideArmed = false; P.jumping = false; P.spring = false;
      if (P.dashT > 0 && P.dashVY > 0) P.dashT = 0;
      const cx = Math.floor((P.x + pw / 2) / TILE), cy = Math.floor((landY + 1) / TILE);
      P.groundIce = tileAt(L, cx, cy) === T.ICE;
    }
  }
  // ---- springs
  for (const s of L.springs) {
    if (P.vy >= 0 && P.x + pw > s.x + 2 && P.x < s.x + 14 && P.y + ph > s.y + 8 && P.y + ph <= s.y + 17) {
      P.vy = -PH.springV; P.spring = true; P.jumping = false; P.onGround = false; P.coyote = 0;
      P.canDJ = ab.dj; P.dashAvail = true; P.glideArmed = false; P.dashT = 0;
      s.t = 0.3; fx && fx.spring && fx.spring(P, s);
    }
  }
  if (P.y > L.h * TILE + 8) return 2;
  if (hazardHit(L, P.x + 1, P.y + 1, pw - 2, ph - 2)) return 1;
  return 0;
}
