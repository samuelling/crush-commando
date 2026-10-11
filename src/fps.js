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
function fpMoveZ(P, target, dt) {
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
// first-person movement & look: returns the x-axis input for the 2D physics
function fpControl(P, inp, dt) {
  const look = (kraw.ArrowRight || kraw.KeyE ? 1 : 0) - (kraw.ArrowLeft || kraw.KeyQ ? 1 : 0);
  G.yaw += look * 2.6 * dt + (G.lookDX || 0) + (G.padLookX || 0) * 3.0 * dt;
  G.pitch = clamp(G.pitch - (G.lookDY || 0) - (G.padLookY || 0) * 2.0 * dt, -0.65, 0.65);
  G.lookDX = 0; G.lookDY = 0;
  if (!look && !G.padLookX && Math.abs(G.pitch) > 0 && G.lookIdle > 1.2) G.pitch *= Math.pow(0.2, dt);
  const fwd = (inp.up ? 1 : 0) - (inp.down ? 1 : 0);
  const str = ((kraw.KeyD || tc.right || gp.right) ? 1 : 0) - ((kraw.KeyA || tc.left || gp.left) ? 1 : 0);
  const cy = Math.cos(G.yaw), sy = Math.sin(G.yaw);
  let mx = fwd * cy - str * sy, mz = fwd * sy + str * cy;
  const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; }
  fpMoveZ(P, mz * 140, dt);
  G.fpFace = cy >= 0 ? 1 : -1;
  return { right: mx > 0.3, left: mx < -0.3 };
}

// ---------- raycast renderer ----------
const FPV = { ex: 0, ey: 0, ez: 0, yaw: 0, hz: 120, cx: VW / 2 };
const FP_PLANE = (VW / 2) / FP_F;
function fpLight(d, C) { return clamp(1.25 - d / ((230 + G.hp / MAXHP * 80) * (1 - (WXV.off ? 0 : WXV.fog) * 0.45)), C.min, 1); }
let FPBUF = null;
function fpBuffers() {
  if (!FPBUF) {
    const c = mkCanvas(VW, VH), x = c.getContext('2d'), img = x.createImageData(VW, VH);
    FPBUF = { c, x, img, px: new Uint32Array(img.data.buffer), depth: new Float32Array(VW * VH), mask: new Uint8Array(VH), spr: mkCanvas(64, 80) };
    FPBUF.sx = FPBUF.spr.getContext('2d');
  }
  return FPBUF;
}
const pack = (r, g, b) => (255 << 24) | (Math.max(0, Math.min(255, b)) << 16) | (Math.max(0, Math.min(255, g)) << 8) | Math.max(0, Math.min(255, r));
function shadePack(rgb, s, fog) { return pack(rgb[0] * s + fog[0] * (1 - s) * 0.35 | 0, rgb[1] * s + fog[1] * (1 - s) * 0.35 | 0, rgb[2] * s + fog[2] * (1 - s) * 0.35 | 0); }
// vertical solid runs of one (lane, column), in world y
function cellRuns(k, tx, cache) {
  const key = (k + 8) * 100000 + tx;
  let r = cache.get(key); if (r) return r;
  r = [];
  const Lk = laneL(k);
  if (!Lk || Math.abs(k) >= NL) { r.push([-400, 300, 'wall']); cache.set(key, r); return r; }
  let start = -1;
  for (let ty = 0; ty <= 17; ty++) {
    const t = ty < 17 ? tileAt(Lk, tx, ty) : -1, sol = ty < 17 && solidLike(Lk, tx, ty) && t !== T.BREAK && t !== T.ICE;
    if (sol && start < 0) start = ty;
    if (!sol && start >= 0) { r.push([start === 0 ? -400 : start * 16, ty * 16, 'solid']); start = -1; }
    if (ty >= 17) break;
    if (t === T.ICE && solidLike(Lk, tx, ty)) r.push([ty * 16, ty * 16 + 16, 'ice']);
    else if (t === T.BREAK && solidLike(Lk, tx, ty)) r.push([ty * 16, ty * 16 + 16, 'break']);
    else if (t === T.ONEWAY) r.push([ty * 16, ty * 16 + 5, 'plat']);
    else if (t === T.LAVA && tileAt(Lk, tx, ty - 1) !== T.LAVA) r.push([ty * 16 + 6, ty * 16 + 16, 'lava']);
    else if (t === T.LAVA) r.push([ty * 16, ty * 16 + 16, 'lava']);
    else if (t === T.SPIKEUP) r.push([ty * 16 + 9, ty * 16 + 16, 'spike']);
    else if (t === T.SPIKEDN) r.push([ty * 16, ty * 16 + 7, 'spike']);
  }
  if (!k) for (const p of Lk.plats) if (!p.gone && p.x < tx * 16 + 16 && p.x + p.w > tx * 16) r.push([p.y, p.y + 8, 'mplat']);
  cache.set(key, r);
  return r;
}
function drawFP(g) {
  const L = G.L, P = G.P, w = G.world, C = fpCols(w), B = fpBuffers();
  const bob = P.onGround && (Math.abs(P.vx) > 20 || Math.abs(P.vz || 0) > 20) ? Math.sin(G.t * 14) * 1.5 : 0;
  const ex = P.x + 5, ey = P.y + 2 + bob, ez = P.z || 0, yaw = G.yaw, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const hz = VH * 0.44 + Math.tan(G.pitch) * FP_F;
  Object.assign(FPV, { ex, ey, ez, yaw, hz });
  // backdrop: sky + distant layer scrolls with yaw
  drawSky(g, w);
  const bg = G.bgs[w] || (G.bgs[w] = makeBG(w));
  const off = -((((yaw / (Math.PI * 2)) * 2048 + P.x * 0.05) % 1024) + 1024) % 1024;
  g.drawImage(bg.far, Math.round(off), Math.round(hz - VH * 0.44 - 30)); g.drawImage(bg.far, Math.round(off) + 1024, Math.round(hz - VH * 0.44 - 30));
  wxSkyTint(g, w);
  g.fillStyle = `rgba(${C.fog[0] * 0.3 | 0},${C.fog[1] * 0.3 | 0},${C.fog[2] * 0.3 | 0},0.55)`; g.fillRect(0, 0, VW, VH);
  // colours
  const fog = C.fog;
  const COLS = {
    solid: [C.body, C.top, C.deep], wall: [C.body, C.top, C.deep], ice: [[150, 195, 230], [215, 238, 250], [120, 160, 200]],
    break: [C.deep, C.topHi, C.deep], plat: [C.platHi, C.plat, C.deep], mplat: [C.platHi, C.platHi, C.deep], spike: [C.spike, C.spike, C.spike],
  };
  const { px, depth, mask } = B;
  px.fill(0); depth.fill(1e9);
  const t0 = performance.now(), ST = G.fpStep || 2;
  const cache = new Map(), W2 = Math.ceil(VW / ST), MAXD = 520;
  const lavaCol = pack(225 + Math.sin(G.t * 4) * 25 | 0, 85, 30);
  for (let c = 0; c < W2; c++) {
    const camX = 2 * (c + 0.5) / W2 - 1;
    const rdx = cy - sy * FP_PLANE * camX, rdz = sy + cy * FP_PLANE * camX;
    mask.fill(0); let covered = 0;
    let cx = Math.floor(ex / 16), ck = Math.floor((ez + 32) / 64);
    const stepX = rdx > 0 ? 1 : -1, stepK = rdz > 0 ? 1 : -1;
    const dX = Math.abs(16 / rdx), dK = Math.abs(64 / rdz);
    let tX = rdx !== 0 ? ((stepX > 0 ? (cx + 1) * 16 : cx * 16) - ex) / rdx : 1e9;
    let tK = rdz !== 0 ? ((stepK > 0 ? (ck + 1) * 64 - 32 : ck * 64 - 32) - ez) / rdz : 1e9;
    let tIn = 0, sideK = false;
    const x0 = c * ST;
    const span = (y0, y1, col, d, seam, seamCol) => {
      let a = Math.max(0, Math.ceil(y0)), b = Math.min(VH, Math.ceil(y1));
      for (let y = a; y < b; y++) {
        if (mask[y]) continue;
        mask[y] = 1; covered++;
        let cc = col;
        if (seam) { const wy = ey + (y - hz) * d / FP_F; if ((wy & 15) === 0 || ((wy + 0.5) & 15) === 0) cc = seamCol; }
        const i = y * VW + x0; for (let q = 0; q < ST && x0 + q < VW; q++) px[i + q] = cc; depth[y * W2 + c] = d;
      }
    };
    const floorSpan = (y0, y1, wy, rgb, s0, lava) => {
      let a = Math.max(0, Math.ceil(y0)), b = Math.min(VH, Math.ceil(y1));
      for (let y = a; y < b; y++) {
        if (mask[y]) continue;
        const d = (wy - ey) * FP_F / (y - hz + 0.0001);
        if (!(d > 0)) continue;
        mask[y] = 1; covered++;
        let cc;
        if (lava) cc = lavaCol;
        else {
          const s = fpLight(d, C), wx = ex + rdx * d, wz = ez + rdz * d;
          const edge = ((wx & 15) < 1) || (((wz + 32) % 64 + 64) % 64 < 1.2);
          cc = shadePack(rgb, edge ? s * 0.72 : s, fog);
        }
        const i = y * VW + x0; for (let q = 0; q < ST && x0 + q < VW; q++) px[i + q] = cc; depth[y * W2 + c] = d;
      }
    };
    for (let n = 0; n < 90 && covered < VH; n++) {
      const tOut = Math.min(tX, tK);
      const dIn = Math.max(tIn, FP_NEAR);
      if (dIn > MAXD) break;
      if (tOut > FP_NEAR) {
        const runs = cellRuns(ck, cx, cache);
        const sIn = fpLight(dIn, C) * (sideK ? 0.78 : 1);
        // faces at the entry boundary first (nearest), then tops/undersides inside the cell
        if (tIn > FP_NEAR) for (const [y0, y1, kind] of runs) {
          const yA = hz + (y0 - ey) * FP_F / dIn, yB = hz + (y1 - ey) * FP_F / dIn;
          if (kind === 'lava') span(yA, yB, lavaCol, dIn);
          else { const cs = COLS[kind]; span(yA, yB, shadePack(cs[0], sIn * 0.9, fog), dIn, kind === 'solid' || kind === 'wall', shadePack(cs[2], sIn * 0.8, fog)); }
        }
        const dO = Math.min(tOut, MAXD);
        for (const [y0, y1, kind] of runs) {
          const cs = COLS[kind];
          if (y0 > ey) floorSpan(hz + (y0 - ey) * FP_F / dO, hz + (y0 - ey) * FP_F / dIn, y0, kind === 'lava' ? null : cs[1], 1, kind === 'lava');
          if (y1 < ey) floorSpan(hz + (y1 - ey) * FP_F / dIn, hz + (y1 - ey) * FP_F / dO, y1, kind === 'lava' ? null : cs[2], 1, kind === 'lava');
        }
      }
      tIn = tOut;
      if (tX < tK) { cx += stepX; tX += dX; sideK = false; } else { ck += stepK; tK += dK; sideK = true; }
    }
  }
  B.x.putImageData(B.img, 0, 0);
  B.W2 = W2; B.ST = ST;
  const ms = performance.now() - t0; G.fpMs = (G.fpMs || ms) * 0.95 + ms * 0.05;
  if (G.fpMs > 11 && ST < 4) { G.fpStep = ST + 1; G.fpMs = 8; } else if (G.fpMs < 4 && ST > 2) { G.fpStep = ST - 1; G.fpMs = 8; }
  g.drawImage(B.c, 0, 0);
  // sprites
  const sprites = [];
  const pushS = (o, ax, ay, az) => {
    const dx = ax - ex, dz = az - ez, d = dx * cy + dz * sy, u = -dx * sy + dz * cy;
    if (d < 10 || d > MAXD) return;
    o.d = d; o.sx = VW / 2 + u * FP_F / d; o.ay = ay; o.ax = ax; sprites.push(o);
  };
  for (const e of G.ents) {
    if (e.dead) continue;
    let ax, ay;
    if (e.type === 'ember' || e.type === 'star' || e.type === 'heart') { ax = e.x; ay = e.y; }
    else if (e.w) { ax = e.x + e.w / 2; ay = e.y + e.h; }
    else { ax = e.x; ay = e.y; }
    pushS({ kind: 'ent', e }, ax, ay, (e.lane || 0) * LW);
  }
  for (const s of L.springs) pushS({ kind: 'spring', s }, s.x + 8, s.y + 16, 0);
  for (const s of L.saws) pushS({ kind: 'saw', s }, s.x, s.y + s.r, 0);
  for (const p of G.projs) if (!(p.delay > 0)) pushS({ kind: 'proj', p }, p.x, p.y, (p.lane || 0) * LW);
  for (const b of G.bolts) pushS({ kind: 'bolt', b }, b.x, b.y, b.z || 0);
  if (HUB) for (const q of netHere()) pushS({ kind: 'ghost', q }, q.rx + 5, q.ry + PH.ph, q.rz || 0);
  sprites.sort((a, b) => b.d - a.d);
  for (const o of sprites) drawFPSprite(g, o, C, B);
  // held rifle
  const sway = Math.sin(G.t * 7) * (Math.abs(P.vx) > 20 || Math.abs(P.vz || 0) > 20 ? 4 : 1), kick = (G.fpKick || 0) * 6, gy0 = VH + (P.onGround ? 0 : -4) + kick;
  const gx = VW / 2 + 60 + sway;
  g.fillStyle = '#2a2c32'; g.beginPath(); g.moveTo(gx - 10, gy0); g.lineTo(gx - 2, gy0 - 62); g.lineTo(gx + 8, gy0 - 62); g.lineTo(gx + 26, gy0); g.fill();
  g.fillStyle = '#3e4148'; g.beginPath(); g.moveTo(gx - 2, gy0 - 62); g.lineTo(gx + 1, gy0 - 82); g.lineTo(gx + 6, gy0 - 82); g.lineTo(gx + 8, gy0 - 62); g.fill();
  rect(g, gx - 6, gy0 - 40, 26, 10, '#d9a070'); rect(g, gx - 6, gy0 - 40, 26, 2, '#e8b888');
  rect(g, gx + 24, gy0 - 34, 12, 34, '#d9a070');
  if (G.muzzle > 0) { g.globalCompositeOperation = 'lighter'; warmGlow(g, gx + 3, gy0 - 88, 40, 0.8); g.globalCompositeOperation = 'source-over'; circ(g, gx + 3, gy0 - 88, 7, '#fff2a0'); }
  rect(g, VW / 2 - 5, VH / 2 - 1, 3, 2, 'rgba(255,230,190,0.75)'); rect(g, VW / 2 + 3, VH / 2 - 1, 3, 2, 'rgba(255,230,190,0.75)');
  rect(g, VW / 2 - 1, VH / 2 - 5, 2, 3, 'rgba(255,230,190,0.75)'); rect(g, VW / 2 - 1, VH / 2 + 3, 2, 3, 'rgba(255,230,190,0.75)');
  const vg = g.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
  if (!WXV.off && WXV.day >= 0 && WXV.day < 1) { g.fillStyle = `rgba(8,10,30,${(1 - WXV.day) * 0.22})`; g.fillRect(0, 0, VW, VH); }
  { let dy = (G.yaw - (WXP.lastYaw || 0)) * 260; WXP.lastYaw = G.yaw; if (Math.abs(dy) > 60) dy = 0; wxDrawFront(g, dy, true); }
  drawLaneMap(g);
  if (G.hurtT > 0) { g.fillStyle = `rgba(170,20,10,${G.hurtT})`; g.fillRect(0, 0, VW, VH); }
}
function drawFPSprite(g, o, C, B) {
  const k = FP_F / o.d, sy = FPV.hz + (o.ay - FPV.ey) * k, W2 = B.W2;
  const vis = (x, y) => { const c = Math.floor(x / B.ST), r = Math.floor(y); if (c < 0 || c >= W2) return false; if (r < 0 || r >= VH) return true; return B.depth[r * W2 + c] > o.d - 4; };
  if (o.kind === 'bolt' || o.kind === 'proj' && (o.p.kind === 'orb' || o.p.kind === 'bullet')) {
    if (!vis(o.sx, sy)) return;
    const r = Math.max(1.5, (o.kind === 'bolt' ? (o.b.flame ? 5 : 2.5) : 3.5) * k), c = o.kind === 'bolt' ? WCOL[o.b.w] || '#fff1c0' : '#ff5a6a';
    g.globalCompositeOperation = 'lighter'; warmGlow(g, o.sx, sy, r * 4, 0.6, o.kind === 'bolt' ? undefined : '255,60,80'); g.globalCompositeOperation = 'source-over';
    circ(g, o.sx, sy, r, c);
    return;
  }
  // render the sprite at native size, then blit visible vertical strips
  const S = B.sx; S.setTransform(1, 0, 0, 1, 0, 0); S.clearRect(0, 0, 64, 80);
  S.save(); S.translate(32 - o.ax, 72 - o.ay);
  if (o.kind === 'ent') drawEnt(S, o.e, G);
  else if (o.kind === 'spring') drawSpring(S, o.s, G);
  else if (o.kind === 'saw') drawSaw(S, o.s, G.t);
  else if (o.kind === 'proj') drawProj(S, o.p);
  else if (o.kind === 'ghost') drawPeerBody(S, o.q);
  S.restore();
  if (o.kind === 'ghost') o.q.scr = { x: o.sx, y: sy - 20 * k };
  const left = o.sx - 32 * k, top = sy - 72 * k, wpx = 64 * k;
  if (left > VW || left + wpx < 0) return;
  const e = o.e, glow = e && (e.type === 'ember' || e.type === 'star' || e.type === 'check' || e.type === 'beacon' || e.type === 'gate' || e.type === 'wpn' || e.type === 'rift');
  const midY = sy - 8 * k;
  if (glow && vis(o.sx, midY)) { g.globalCompositeOperation = 'lighter'; warmGlow(g, o.sx, midY, Math.min(160, (e.type === 'ember' ? 10 : e.type === 'gate' ? 50 : 26) * k), 0.4); g.globalCompositeOperation = 'source-over'; }
  g.globalAlpha = glow ? 1 : clamp(fpLight(o.d, C) * 1.4, 0.2, 1);
  const step = Math.max(1, Math.min(4, Math.round(wpx / 32)));
  for (let x = Math.max(0, Math.floor(left)); x < Math.min(VW, left + wpx); x += step) {
    if (!vis(x, midY)) continue;
    const srcX = Math.floor((x - left) / wpx * 64);
    g.drawImage(B.spr, srcX, 0, 1, 80, x, top, step, 80 * k);
  }
  g.globalAlpha = 1;
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
  const px0 = x0 + 8 * 2 + 1, py0 = y0 + ((P.z || 0) / LW * face + lanes) * 3 + 1.5;
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px0, py0); g.lineTo(px0 + Math.cos(G.yaw) * face * 7, py0 + Math.sin(G.yaw) * face * 7 * (3 / 2 / 4)); g.stroke();
  g.fillStyle = '#ffffff'; g.fillRect(px0 - 1, py0 - 1.5, 2, 3);
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
  return G.lastInput === 'touch' ? 'First person. Drag the screen to look around. Pad walks and strafes' :
    G.lastInput === 'pad' ? 'First person. Right stick looks around, left stick walks and strafes' :
      'First person. Mouse or ←→ to look, W/S or ↑↓ to walk, A/D to strafe. Click to grab the mouse';
}
