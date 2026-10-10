// ===================== FIRST-PERSON: THE HIDDEN 3D WORLD =====================
// The side-scroller is one slice (lane 0) of a wider canyon. In first person the hero can step
// sideways into parallel lanes. Every lane is an ordinary 2D tile grid, so the same physics runs everywhere.
const FP_F = 170, FP_NEAR = 6, FP_COLS = 28, LW = 64, NL = 4;

function hexRGB(h) { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const FP_COL = {};
function fpCols(w) {
  if (FP_COL[w]) return FP_COL[w];
  const th = THEMES[w], c = {};
  for (const k of ['body', 'deep', 'top', 'topHi', 'edge', 'plat', 'platHi', 'spike']) c[k] = hexRGB(th[k]);
  c.fog = hexRGB(th.sky[1]);
  c.min = [0.22, 0.1, 0.25, 0.4, 0.2][w];
  return (FP_COL[w] = c);
}
function shadeRGB(rgb, s, fog) {
  return `rgb(${Math.round(rgb[0] * s + fog[0] * (1 - s) * 0.35)},${Math.round(rgb[1] * s + fog[1] * (1 - s) * 0.35)},${Math.round(rgb[2] * s + fog[2] * (1 - s) * 0.35)})`;
}
function fpZoneAt(L, x) { for (const z of L.fpZones) if (x >= z[0] && x < z[1]) return true; return false; }
function solidLike(L, tx, ty) {
  const t = tileAt(L, tx, ty);
  if (t === T.SOLID || t === T.ICE || t === T.VENT) return true;
  if (t === T.CRUMBLE) { const c = L.crumble.get(ty * L.w + tx); return !c || c.s < 2; }
  if (t === T.BREAK) return !L.broken.has(ty * L.w + tx);
  return false;
}

// ---------- lanes ----------
function laneL(k) { if (!k) return G.L; return G.lanes ? G.lanes[k] || null : null; }
function laneSolid(k, tx, ty) { const L = laneL(k); return L ? solidLike(L, tx, ty) : true; }
function buildLanes(L, seed) {
  const lanes = {}, extra = [];
  for (let k = -NL; k <= NL; k++) {
    if (!k) continue;
    lanes[k] = { w: L.w, h: L.h, grid: new Uint8Array(L.w * L.h).fill(T.SOLID), crumble: new Map(), broken: new Set(), plats: [], springs: [], updrafts: [], saws: [], lane: k, ground: {} };
  }
  const R = rng(seed);
  for (const [zx0, zx1] of L.fpZones) {
    const t0 = Math.floor(zx0 / 16) + 1, t1 = Math.floor(zx1 / 16) - 1;
    for (const side of [-1, 1]) for (let a = 1; a < NL; a++) {
      const k = side * a, Lk = lanes[k], Gk = Lk.grid;
      let g = a === 1 ? 14 : a === 2 ? 13 : 11, run = 2;
      for (let tx = t0; tx <= t1; tx++) {
        if (--run <= 0) { run = 3 + Math.floor(R() * 4); g = clamp(g + Math.floor(R() * 5) - 2, a === 1 ? 12 : a === 2 ? 10 : 8, 14); }
        const pit = tx > t0 + 3 && tx < t1 - 3 && R() < (a === 1 ? 0.04 : 0.07);
        for (let ty = 0; ty < L.h; ty++) Gk[ty * L.w + tx] = T.AIR;
        if (pit) { Lk.ground[tx] = null; continue; }
        for (let ty = g; ty < L.h; ty++) Gk[ty * L.w + tx] = T.SOLID;
        Lk.ground[tx] = g;
        if (R() < 0.05 && tx > t0 + 4 && tx < t1 - 4) for (let ty = g - 2; ty < g; ty++) Gk[ty * L.w + tx] = T.SOLID;
        else if (a === 2 && tx % 4 === 0) extra.push({ type: 'ember', x: tx * 16 + 8, y: (g - 2) * 16 + 8, lane: k });
      }
      const pickGround = (lo, hi) => { for (let n = 0; n < 12; n++) { const tx = lo + Math.floor(R() * Math.max(1, hi - lo)); const gg = Lk.ground[tx]; if (gg && Gk[(gg - 1) * L.w + tx] === T.AIR) return [tx, gg]; } return null; };
      if (a === 2) for (let n = 0; n < 2; n++) { const p = pickGround(t0 + 6, t1 - 6); if (p) extra.push({ type: 'w', x: p[0] * 16, y: (p[1] - 1) * 16, lane: k }); }
      if (a === 3) {
        const p = pickGround(t1 - 14, t1 - 4);
        if (p) {
          const [tx, gg] = p;
          extra.push({ type: 'wpn', x: tx * 16 + 2, y: (gg - 1) * 16 + 4, letter: 'SMLF'[Math.floor(R() * 4)], lane: k });
          extra.push({ type: 'heart', x: tx * 16 - 10, y: (gg - 1) * 16 + 2, lane: k });
          for (let i = 0; i < 5; i++) extra.push({ type: 'ember', x: tx * 16 + 8 + (i - 2) * 12, y: (gg - 3) * 16 + 8, lane: k });
        }
        const q = pickGround(t0 + 5, t0 + 16); if (q) extra.push({ type: 't', x: q[0] * 16, y: (q[1] - 1) * 16, lane: k });
      }
    }
  }
  return { lanes, extra };
}
function fpStrafe(P, s, dt) {
  const target = s * (G.fpFace || 1) * 135;
  P.vz = (P.vz || 0) + (target - (P.vz || 0)) * Math.min(1, 12 * dt);
  let nz = (P.z || 0) + P.vz * dt;
  const nl = Math.round(nz / LW);
  if (nl !== (P.lane || 0)) {
    const Lt = laneL(nl);
    if (Lt && Math.abs(nl) < NL && !solidRect(Lt, P.x, P.y, PH.pw, PH.ph)) {
      P.lane = nl; P.plat = null;
      if (!G.laneSeen && nl) { G.laneSeen = true; G.toast = { text: 'The world was never flat.', t: 2.5 }; sfx('portal'); }
    } else { nz = (P.lane || 0) * LW + Math.sign(nl - (P.lane || 0)) * (LW / 2 - 0.5); P.vz = 0; }
  }
  P.z = nz;
}

// ---------- projection ----------
const FPV = { eyeX: 0, eyeY: 0, camZ: 0, face: 1, hz: 120, cx: VW / 2 };
const fpY = (wy, d) => FPV.hz + (wy - FPV.eyeY) * FP_F / d;
const fpX = (z, d) => FPV.cx + (z - FPV.camZ) * FPV.face * FP_F / d;
function fpLight(d, C) { return clamp(1.25 - d / (230 + G.hp / MAXHP * 80), C.min, 1); }
function fpQuad(g, d0, d1, wy, za, zb, col) {
  const y0 = fpY(wy, d0), y1 = fpY(wy, d1);
  g.fillStyle = col; g.beginPath(); g.moveTo(fpX(za, d0), y0); g.lineTo(fpX(zb, d0), y0); g.lineTo(fpX(zb, d1), y1); g.lineTo(fpX(za, d1), y1); g.closePath(); g.fill();
}
function fpFront(g, d, za, zb, wy0, wy1, col, edge) {
  const y0 = fpY(wy0, d), y1 = fpY(wy1, d), xa = fpX(za, d), xb = fpX(zb, d), x = Math.min(xa, xb), w = Math.abs(xb - xa);
  g.fillStyle = col; g.fillRect(x, y0, w, y1 - y0);
  if (edge && y1 - y0 > 6) { g.fillStyle = edge; g.fillRect(x, y0, w, Math.max(1, (y1 - y0) * 0.06)); }
}
function fpSide(g, zs, d0, d1, top, bot, col) {
  g.fillStyle = col; g.beginPath();
  g.moveTo(fpX(zs, d0), fpY(top, d0)); g.lineTo(fpX(zs, d1), fpY(top, d1)); g.lineTo(fpX(zs, d1), fpY(bot, d1)); g.lineTo(fpX(zs, d0), fpY(bot, d0));
  g.closePath(); g.fill();
}

function drawFP(g) {
  const L = G.L, P = G.P, w = G.world, C = fpCols(w);
  const face = G.fpFace || 1;
  const bob = P.onGround && (Math.abs(P.vx) > 20 || Math.abs(P.vz || 0) > 20) ? Math.sin(G.t * 14) * 1.5 : 0;
  FPV.face = face; FPV.eyeX = P.x + 5 - face * 4; FPV.eyeY = P.y + 1 + bob; FPV.camZ = P.z || 0; FPV.hz = VH * 0.44;
  // backdrop
  drawSky(g, w);
  const bg = G.bgs[w] || (G.bgs[w] = makeBG(w));
  const off = -((((P.x * 0.05) + (face < 0 ? 512 : 0) - FPV.camZ * 0.3 * face) % 1024) + 1024) % 1024;
  g.drawImage(bg.far, Math.round(off), -30); g.drawImage(bg.far, Math.round(off) + 1024, -30);
  g.fillStyle = `rgba(${C.fog[0] * 0.3 | 0},${C.fog[1] * 0.3 | 0},${C.fog[2] * 0.3 | 0},0.55)`; g.fillRect(0, 0, VW, VH);
  // bucket objects by (column, lane)
  const etx = Math.floor(FPV.eyeX / 16), buckets = new Map();
  const depth = x => (x - FPV.eyeX) * face;
  const add = (o, x, lane) => {
    const k = (Math.floor(x / 16) - etx) * face;
    if (k < 0 || k > FP_COLS) return;
    const key = k * 32 + lane + 16; let b = buckets.get(key); if (!b) buckets.set(key, b = []); b.push(o);
  };
  for (const e of G.ents) {
    if (e.dead) continue;
    let ax, ay;
    if (e.type === 'ember' || e.type === 'star' || e.type === 'heart') { ax = e.x; ay = e.y; }
    else if (e.w) { ax = e.x + e.w / 2; ay = e.y + e.h; }
    else { ax = e.x; ay = e.y; }
    const d = depth(ax), ln = e.lane || 0;
    if (d > 10) add({ d, kind: 'ent', e, ax, ay, z: ln * LW }, ax, ln);
  }
  for (const p of L.plats) if (!p.gone) { const dn = Math.min(depth(p.x), depth(p.x + p.w)); if (dn + p.w > FP_NEAR) add({ d: Math.max(dn, FP_NEAR) + 0.01, kind: 'plat', p, dn }, face > 0 ? Math.max(p.x, FPV.eyeX) : Math.min(p.x + p.w - 1, FPV.eyeX), 0); }
  for (const s of L.springs) { const d = depth(s.x + 8); if (d > 10) add({ d, kind: 'spring', s, z: 0 }, s.x + 8, 0); }
  for (const s of L.saws) { const d = depth(s.x); if (d > 10) add({ d, kind: 'saw', s, z: 0 }, s.x, 0); }
  for (const p of G.projs) { const d = depth(p.x); if (d > 10 && !(p.delay > 0)) add({ d, kind: 'proj', p, z: (p.lane || 0) * LW }, p.x, p.lane || 0); }
  for (const b of G.bolts) { const d = depth(b.x); if (d > 8) add({ d, kind: 'bolt', b, z: b.z || 0 }, b.x, b.lane || 0); }
  const laneOrder = [];
  for (let k = -NL; k <= NL; k++) laneOrder.push(k);
  laneOrder.sort((a, b) => Math.abs(b * LW - FPV.camZ) - Math.abs(a * LW - FPV.camZ));
  for (let k = FP_COLS; k >= 0; k--) {
    const tx = etx + k * face;
    let d0 = face > 0 ? tx * 16 - FPV.eyeX : FPV.eyeX - (tx * 16 + 16), d1 = d0 + 16;
    if (d1 <= FP_NEAR) continue;
    d0 = Math.max(d0, FP_NEAR);
    for (const ln of laneOrder) {
      const za = ln * LW - LW / 2, zb = ln * LW + LW / 2;
      const xs = [fpX(za, d0), fpX(zb, d0), fpX(za, d1), fpX(zb, d1)];
      if (Math.max(...xs) < -2 || Math.min(...xs) > VW + 2) continue;
      drawLaneColumn(g, ln, tx, d0, d1, za, zb, C, 0);
      const b = buckets.get(k * 32 + ln + 16);
      if (b) { b.sort((p, q) => q.d - p.d); for (const o of b) drawFPObj(g, o, C); }
      drawLaneColumn(g, ln, tx, d0, d1, za, zb, C, 1);
    }
  }
  // held rifle
  const sway = Math.sin(G.t * 7) * (Math.abs(P.vx) > 20 ? 4 : 1), kick = (G.fpKick || 0) * 6, gy0 = VH + (P.onGround ? 0 : -4) + kick;
  const gx = VW / 2 + 60 + sway;
  g.fillStyle = '#2a2c32'; g.beginPath(); g.moveTo(gx - 10, gy0); g.lineTo(gx - 2, gy0 - 62); g.lineTo(gx + 8, gy0 - 62); g.lineTo(gx + 26, gy0); g.fill();
  g.fillStyle = '#3e4148'; g.beginPath(); g.moveTo(gx - 2, gy0 - 62); g.lineTo(gx + 1, gy0 - 82); g.lineTo(gx + 6, gy0 - 82); g.lineTo(gx + 8, gy0 - 62); g.fill();
  rect(g, gx - 6, gy0 - 40, 26, 10, '#d9a070'); rect(g, gx - 6, gy0 - 40, 26, 2, '#e8b888');
  rect(g, gx + 24, gy0 - 34, 12, 34, '#d9a070');
  if (G.muzzle > 0) { g.globalCompositeOperation = 'lighter'; warmGlow(g, gx + 3, gy0 - 88, 40, 0.8); g.globalCompositeOperation = 'source-over'; circ(g, gx + 3, gy0 - 88, 7, '#fff2a0'); }
  rect(g, VW / 2 - 4, FPV.hz - 1, 3, 2, 'rgba(255,230,190,0.7)'); rect(g, VW / 2 + 2, FPV.hz - 1, 3, 2, 'rgba(255,230,190,0.7)');
  // vignette
  const vg = g.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
  drawLaneMap(g);
  if (G.hurtT > 0) { g.fillStyle = `rgba(170,20,10,${G.hurtT})`; g.fillRect(0, 0, VW, VH); }
}

function drawLaneColumn(g, k, tx, d0, d1, za, zb, C, pass) {
  const Lk = laneL(k), fog = C.fog, ey = FPV.eyeY, face = FPV.face;
  const s0 = fpLight(d0 + Math.abs(k * LW - FPV.camZ) * 0.6, C);
  const S = (ty) => Lk ? solidLike(Lk, tx, ty) : true;
  const Tt = (ty) => Lk ? tileAt(Lk, tx, ty) : T.SOLID;
  if (pass === 0) {
    // tops & undersides
    for (let ty = 0; ty < 17; ty++) {
      const t = Tt(ty), solid = S(ty), top = ty * 16, bot = top + 16;
      if (solid) {
        if (top > ey && !S(ty - 1)) {
          const col = t === T.ICE ? [210, 235, 250] : t === T.BREAK ? C.topHi : C.top;
          fpQuad(g, d0, d1, top, za, zb, shadeRGB(col, s0, fog));
          if (d1 - d0 > 8 && (tx & 1)) fpQuad(g, d0, d0 + 1.5, top, za, zb, shadeRGB(C.topHi, s0, fog));
        }
        if (bot < ey && ty < 16 && !S(ty + 1)) fpQuad(g, d0, d1, bot, za, zb, shadeRGB(C.deep, s0 * 0.8, fog));
      } else if (t === T.ONEWAY && top > ey) fpQuad(g, d0, d1, top, za, zb, shadeRGB(C.plat, s0, fog));
      else if (t === T.LAVA && Tt(ty - 1) !== T.LAVA && top + 6 > ey)
        fpQuad(g, d0, d1, top + 6, za, zb, `rgb(${220 + Math.sin(G.t * 4 + tx) * 30 | 0},${80 + Math.sin(G.t * 3 + tx * 0.7) * 30 | 0},30)`);
    }
    // side walls facing the camera (merged vertical runs)
    for (const dir of [1, -1]) {
      const zs = dir > 0 ? zb : za;
      if (!(dir > 0 ? FPV.camZ > zs : FPV.camZ < zs)) continue;
      let start = -1;
      const col = shadeRGB(C.body, s0 * 0.7, fog);
      for (let ty = 0; ty <= 17; ty++) {
        const vis = ty < 17 && S(ty) && !laneSolid(k + dir, tx, ty);
        if (vis && start < 0) start = ty;
        if (!vis && start >= 0) { fpSide(g, zs, d0, d1, start * 16, ty * 16, col); fpSide(g, zs, d0, d1, start * 16, start * 16 + 2, shadeRGB(C.top, s0 * 0.8, fog)); start = -1; }
      }
    }
    return;
  }
  // fronts (merged runs of plain solid)
  const nearSolid = ty => Lk ? solidLike(Lk, tx - face, ty) : true;
  let start = -1;
  const bodyCol = shadeRGB(C.body, s0 * 0.85, fog), edgeCol = shadeRGB(C.top, s0, fog);
  for (let ty = 0; ty <= 17; ty++) {
    const t = ty < 17 ? Tt(ty) : -1, plain = ty < 17 && t === T.SOLID && S(ty) && !nearSolid(ty);
    if (plain && start < 0) start = ty;
    if (!plain && start >= 0) { fpFront(g, d0, za, zb, start * 16, ty * 16, bodyCol, edgeCol); start = -1; }
    if (ty >= 17 || !Lk) continue;
    const top = ty * 16, bot = top + 16, nT = tileAt(Lk, tx - face, ty);
    if ((t === T.ICE || t === T.BREAK || t === T.VENT || t === T.CRUMBLE) && S(ty) && !nearSolid(ty)) {
      fpFront(g, d0, za, zb, top, bot, shadeRGB(t === T.BREAK ? C.deep : t === T.ICE ? [150, 195, 230] : C.plat, s0 * 0.85, fog), shadeRGB(t === T.ICE ? [240, 250, 255] : C.top, s0, fog));
      if (t === T.BREAK) { const y0 = fpY(top, d0), y1 = fpY(bot, d0), xa = fpX(za, d0), xb = fpX(zb, d0); g.strokeStyle = shadeRGB(C.topHi, s0, fog); g.lineWidth = 1; g.beginPath(); g.moveTo(xa * 0.8 + xb * 0.2, y0); g.lineTo((xa + xb) / 2, (y0 + y1) / 2); g.lineTo(xa * 0.6 + xb * 0.4, y1); g.stroke(); }
    } else if (t === T.ONEWAY && nT !== T.ONEWAY) fpFront(g, d0, za, zb, top, top + 5, shadeRGB(C.platHi, s0, fog));
    else if (t === T.LAVA && nT !== T.LAVA && Tt(ty - 1) !== T.LAVA) fpFront(g, d0, za, zb, top + 6, bot, 'rgb(216,64,26)');
    else if (t === T.SPIKEUP || t === T.SPIKEDN) {
      const d = d0 + 8, y0 = fpY(top, d), y1 = fpY(bot, d), xa = Math.min(fpX(za, d), fpX(zb, d)), xw = Math.abs(fpX(zb, d) - fpX(za, d));
      g.fillStyle = shadeRGB(C.spike, fpLight(d, C), fog);
      for (let i = 0; i < 6; i++) {
        const xl = xa + i * xw / 6, xr = xl + xw / 6;
        g.beginPath();
        if (t === T.SPIKEUP) { g.moveTo(xl, y1); g.lineTo((xl + xr) / 2, y0 + (y1 - y0) * 0.4); g.lineTo(xr, y1); }
        else { g.moveTo(xl, y0); g.lineTo((xl + xr) / 2, y1 - (y1 - y0) * 0.4); g.lineTo(xr, y0); }
        g.fill();
      }
    }
  }
  if (Lk && k === 0) for (const u of Lk.updrafts) if (u.x === tx * 16) {
    const d = (d0 + d1) / 2, y0 = fpY(u.y, d), y1 = fpY(u.y + u.h, d), xa = fpX(za + 8, d), xb = fpX(zb - 8, d);
    g.globalAlpha = 0.12; g.fillStyle = '#ffd9a0'; g.fillRect(Math.min(xa, xb), y0, Math.abs(xb - xa), y1 - y0); g.globalAlpha = 1;
  }
}

function fpBillboard(g, ax, ay, d, z, fn) {
  const k = FP_F / d, sx = fpX(z, d), sy = fpY(ay, d);
  g.save(); g.translate(sx, sy); g.scale(k * (FPV.face < 0 ? -1 : 1), k); g.translate(-ax, -ay); fn(); g.restore();
}
function drawFPObj(g, o, C) {
  const a = clamp(fpLight(o.d + Math.abs((o.z || 0) - FPV.camZ) * 0.6, C) * 1.4, 0.15, 1);
  if (o.kind === 'ent') {
    const e = o.e, glow = e.type === 'ember' || e.type === 'star' || e.type === 'check' || e.type === 'beacon' || e.type === 'gate' || e.type === 'wpn';
    g.globalAlpha = glow ? 1 : a;
    if (glow) {
      const k = FP_F / o.d, sy = fpY(o.ay - (e.type === 'gate' ? 24 : e.type === 'check' ? 28 : 0), o.d);
      g.globalCompositeOperation = 'lighter'; warmGlow(g, fpX(o.z, o.d), sy, Math.min(200, (e.type === 'ember' ? 10 : e.type === 'gate' ? 50 : 30) * k), e.type === 'gate' ? 0.35 : 0.4, e.type === 'gate' ? '255,200,120' : undefined); g.globalCompositeOperation = 'source-over';
    }
    fpBillboard(g, o.ax, o.ay, o.d, o.z, () => drawEnt(g, e, G));
    g.globalAlpha = 1;
  } else if (o.kind === 'plat') {
    const p = o.p, n = Math.max(FP_NEAR, o.dn), f = o.dn + p.w, s = fpLight(n, C);
    if (p.y > FPV.eyeY) fpQuad(g, n, f, p.y, -LW / 2, LW / 2, shadeRGB(C.platHi, s, C.fog));
    else fpQuad(g, n, f, p.y + 8, -LW / 2, LW / 2, shadeRGB(C.deep, s, C.fog));
    if (o.dn >= FP_NEAR) fpFront(g, n, -LW / 2, LW / 2, p.y, p.y + 8, shadeRGB(C.plat, s, C.fog));
  } else if (o.kind === 'spring') fpBillboard(g, o.s.x + 8, o.s.y + 16, o.d, 0, () => drawSpring(g, o.s, G));
  else if (o.kind === 'saw') fpBillboard(g, o.s.x, o.s.y + o.s.r, o.d, 0, () => drawSaw(g, o.s, G.t));
  else if (o.kind === 'proj') fpBillboard(g, o.p.x, o.p.y, o.d, o.z, () => drawProj(g, o.p));
  else if (o.kind === 'bolt') {
    const k = FP_F / o.d, sx = fpX(o.z, o.d), sy = fpY(o.b.y, o.d), r = Math.max(1.5, (o.b.flame ? 5 : 2.5) * k), c = WCOL[o.b.w] || '#fff1c0';
    g.globalCompositeOperation = 'lighter'; warmGlow(g, sx, sy, r * 4, 0.6); g.globalCompositeOperation = 'source-over';
    circ(g, sx, sy, r, c);
  }
}

// top-down strip map of the lanes around you
function drawLaneMap(g) {
  if (!G.lanes) return;
  const P = G.P, face = G.fpFace || 1, etx = Math.floor((P.x + 5) / 16), prow = Math.floor((P.y + 7) / 16);
  const cols = 44, x0 = VW - cols * 2 - 6, y0 = 28, lanes = NL - 1;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x0 - 2, y0 - 2, cols * 2 + 4, (lanes * 2 + 1) * 3 + 4);
  for (let ln = -lanes; ln <= lanes; ln++) {
    const Lk = laneL(ln), row = (ln * face + lanes);
    for (let i = 0; i < cols; i++) {
      const tx = etx + (i - 8) * face;
      let c;
      if (!Lk || solidLike(Lk, tx, prow)) c = 'rgba(150,130,120,0.55)';
      else { let fl = false; for (let ty = prow + 1; ty < 17; ty++) if (solidLike(Lk, tx, ty) || tileAt(Lk, tx, ty) === T.ONEWAY) { fl = true; break; } c = fl ? 'rgba(60,52,58,0.9)' : 'rgba(0,0,0,0.9)'; }
      g.fillStyle = c; g.fillRect(x0 + i * 2, y0 + row * 3, 2, 3);
    }
  }
  for (const e of G.ents) {
    if (e.dead) continue;
    const i = Math.floor((Math.floor((e.x + (e.w || 0) / 2) / 16) - etx) * face) + 8;
    if (i < 0 || i >= cols) continue;
    const ln = e.lane || 0, row = ln * face + lanes;
    const c = e.enemy ? '#ff5a4a' : e.type === 'wpn' ? '#8be3ff' : e.type === 'ember' ? '#ffb347' : e.type === 'heart' ? '#ff8aa0' : e.type === 'star' ? '#ffd84a' : e.type === 'gate' ? '#ffe2a0' : null;
    if (c) { g.fillStyle = c; g.fillRect(x0 + i * 2, y0 + row * 3 + 1, 2, 1); }
  }
  g.fillStyle = '#ffffff'; g.fillRect(x0 + 8 * 2, y0 + Math.round((P.z || 0) / LW * face + lanes) * 3, 2, 3);
}

// ---------- gates ----------
function drawGate(g, e) {
  const x = e.x, y = e.y, a = 0.6 + Math.sin(e.t * 3) * 0.2;
  rect(g, x - 18, y - 46, 4, 46, '#4a3f37'); rect(g, x + 14, y - 46, 4, 46, '#4a3f37');
  g.strokeStyle = `rgba(255,190,110,${a})`; g.lineWidth = 3;
  g.beginPath(); g.arc(x, y - 46, 16, Math.PI, 0); g.stroke();
  g.strokeStyle = `rgba(255,240,200,${a * 0.6})`; g.lineWidth = 1;
  g.beginPath(); g.arc(x, y - 46, 12, Math.PI, 0); g.stroke();
  for (let i = 0; i < 5; i++) { const yy = y - ((e.t * 30 + i * 9) % 44); rect(g, x - 12 + ((i * 7) % 24), Math.round(yy), 1, 3, `rgba(255,210,150,${a * 0.6})`); }
  g.fillStyle = `rgba(255,200,120,${0.08 + 0.05 * Math.sin(e.t * 4)})`; g.fillRect(x - 14, y - 46, 28, 46);
}
function setFireLabel() { }
function fpHint() {
  return G.lastInput === 'touch' ? 'First person. Pad up/down walks, left/right steps sideways off the path' :
    G.lastInput === 'pad' ? 'First person. Stick up/down walks, left/right steps sideways off the path' :
      'First person. ↑↓ walk, ←→ step sideways off the path. There is more out there.';
}
