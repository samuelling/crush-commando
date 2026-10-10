// ===================== COMBAT: weapons, bullets, troopers, weapon pods, hero =====================
const WEAPONS = {
  N: { name: 'Rifle', rate: 0.13, speed: 340, dmg: 1, n: 1, life: 0.85 },
  S: { name: 'Spread Gun', rate: 0.2, speed: 300, dmg: 1, n: 5, spread: 0.2, life: 0.7 },
  M: { name: 'Machine Gun', rate: 0.065, speed: 400, dmg: 1, n: 1, jitter: 0.07, life: 0.8 },
  L: { name: 'Laser', rate: 0.28, speed: 560, dmg: 4, n: 1, pierce: true, life: 0.7 },
  F: { name: 'Flamethrower', rate: 0.1, speed: 230, dmg: 2, n: 1, life: 0.5, flame: true },
};
const WCOL = { N: '#ffe9a8', S: '#ff8a5a', M: '#ffd84a', L: '#8be3ff', F: '#ff6a2a' };
const ENEMY_HP = { spiky: 2, turret: 3, charger: 3, hopper: 1, walker: 1, moth: 1, runner: 1 };

function aimVec(inp, P) {
  if (G.mode === 'fp') return [G.fpFace || P.face, 0];
  const hor = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  let ax = hor, ay = inp.up ? -1 : (inp.down && !P.onGround ? 1 : 0);
  if (P.wall && P.sliding) ax = -P.wall;
  if (ax === 0 && ay === 0) ax = P.face;
  const m = Math.hypot(ax, ay);
  return [ax / m, ay / m];
}
function fireWeapon() {
  const P = G.P;
  shootFrom({ x: P.x, y: P.y, crouch: P.crouch, aim: G.aim, fp: G.mode === 'fp', yaw: G.yaw, pitch: G.pitch, z: P.z || 0, lane: P.lane || 0, weapon: G.weapon }, false);
  G.muzzle = 0.06; G.fpKick = 1;
  sfx('gun' + G.weapon);
}
// Spawn one trigger pull's bullets from shooter s. Ghost bullets are a friend's, fired on this screen.
function shootFrom(s, ghost) {
  const W = WEAPONS[s.weapon] || WEAPONS.N, wl = WEAPONS[s.weapon] ? s.weapon : 'N';
  const [ax, ay] = s.aim;
  if (s.fp) {
    const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
    for (let i = 0; i < W.n; i++) {
      const off = W.n > 1 ? (i - (W.n - 1) / 2) * W.spread : 0;
      const a = s.yaw + off + (W.jitter ? (Math.random() - 0.5) * W.jitter : 0);
      const dx = Math.cos(a) * cp, dz = Math.sin(a) * cp, dy = -sp;
      const z = (s.z || 0) + dz * 6;
      G.bolts.push({ ghost, lane: Math.round(z / LW), z, vz: dz * W.speed, x: s.x + 5 + dx * 6, y: s.y + 3 + dy * 6, vx: dx * W.speed, vy: dy * W.speed, life: W.life, dmg: W.dmg, pierce: !!W.pierce, flame: !!W.flame, w: wl, hit: W.pierce ? new Set() : null, t: 0 });
    }
    return;
  }
  const ox = s.x + 5 + ax * 9, oy = (s.crouch ? s.y + 10 : s.y + 4) + ay * 8;
  const base = Math.atan2(ay, ax);
  for (let i = 0; i < W.n; i++) {
    const off = W.n > 1 ? (i - (W.n - 1) / 2) * W.spread : 0;
    const a = base + off + (W.jitter ? (Math.random() - 0.5) * W.jitter : 0);
    G.bolts.push({ ghost, lane: s.lane || 0, z: s.z || 0, x: ox, y: oy, vx: Math.cos(a) * W.speed, vy: Math.sin(a) * W.speed, life: W.life, dmg: W.dmg, pierce: !!W.pierce, flame: !!W.flame, w: wl, hit: W.pierce ? new Set() : null, t: 0 });
  }
}
function damageEnt(e, b) {
  if (e.hp === undefined) e.hp = ENEMY_HP[e.type] || 1;
  e.hp -= b.dmg; e.flash = 0.1;
  if (e.type === 'stal') { e.st = 'gone'; e.st_t = 3; burst(G, e.x + 5, e.y + 7, 8, '#ffffff', 80); sfx('crumble'); return; }
  if (e.type === 'pod') {
    if (e.hp <= 0) {
      netKillEnt(e, true);
      if (e.uid) netEv({ k: 'kill', uid: e.uid });
    } else sfx('tink');
    return;
  }
  if (e.hp <= 0) killEnemy(e); else sfx('tink');
}
function updateBolts(dt) {
  const L = G.L, B = G.boss;
  for (const b of G.bolts) {
    b.t += dt;
    if (b.flame) b.vy += Math.sin(b.t * 28) * 30;
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.vz) { b.z += b.vz * dt; b.lane = Math.round(b.z / LW); if (Math.abs(b.lane) >= NL) { b.life = 0; continue; } }
    if (isSolidT(laneL(b.lane || 0) || L, Math.floor(b.x / 16), Math.floor(b.y / 16))) { b.life = 0; burst(G, b.x, b.y, 4, WCOL[b.w], 60, 0, true); continue; }
    const box = { x: b.x - 3, y: b.y - 3, w: 6, h: 6 };
    for (const e of G.ents) {
      if (e.dead) continue;
      if (e.type !== 'pod' && (e.lane || 0) !== (b.lane || 0)) continue;
      let r;
      if (e.type === 'pod') r = { x: e.x - 10, y: e.y - 6, w: 20, h: 12 };
      else if (e.enemy || (e.type === 'stal' && e.st !== 'gone')) r = { x: e.x, y: e.y, w: e.w || 10, h: e.h || 14 };
      else continue;
      if (b.hit && b.hit.has(e)) continue;
      if (overlapRect(box, r)) {
        NET.quiet = !!b.ghost; damageEnt(e, b); NET.quiet = false;
        if (b.hit) b.hit.add(e); else { b.life = 0; break; }
      }
    }
    if (b.life <= 0) continue;
    for (const p of G.projs) if ((p.lane || 0) === (b.lane || 0) && (p.kind === 'orb' || p.kind === 'bullet' || p.kind === 'smoke' || p.kind === 'seed' || p.kind === 'shard' || p.kind === 'ice') && !(p.delay > 0) && Math.abs(p.x - b.x) < 7 && Math.abs(p.y - b.y) < 7) {
      p.life = 0; burst(G, p.x, p.y, 5, '#ffb0a0', 60); if (!b.pierce) { b.life = 0; break; }
    }
    if (b.life <= 0 || !B || B.dead || b.ghost) continue;
    let dmg = 0;
    if (B.weak && overlapRect(box, B.weak)) dmg = b.dmg * 2;
    else for (const s of B.hits) if (hitShape(s, box)) { dmg = b.dmg; break; }
    if (dmg) {
      if (!(b.hit && b.hit.has(B))) {
        B.chip = (B.chip || 0) + dmg; B.flash = Math.max(B.flash, 0.05); sfx('tink');
        if (b.hit) b.hit.add(B);
        burst(G, b.x, b.y, 3, '#ffffff', 50);
      }
      if (!b.pierce) b.life = 0;
      if (B.chip >= 16) { B.chip -= 16; bossHit(false); }
    }
  }
  G.bolts = G.bolts.filter(b => b.life > 0);
  if (G.fpKick > 0) G.fpKick = Math.max(0, G.fpKick - dt * 6);
  if (G.muzzle > 0) G.muzzle -= dt;
}

// ---------- troopers (memories charging in) ----------
function spawnRunner() {
  const L = G.L, P = G.P, fp = G.mode === 'fp', dir = fp ? (G.fpFace || 1) : 1;
  const sx = fp ? P.x + dir * 240 : G.camX + VW + 6;
  const tx = Math.floor(sx / 16);
  if (tx < 12 || tx > L.w - 20) return;
  const lane = fp && G.lanes ? [0, 0, 0, -1, 1, -2, 2][Math.floor(Math.random() * 7)] : 0;
  const Lk = laneL(lane) || L;
  for (let ty = 3; ty < L.h; ty++) {
    if (isSolidT(Lk, tx, ty) && tileAt(Lk, tx, ty - 1) === T.AIR && tileAt(Lk, tx, ty - 2) === T.AIR) {
      const e = { lane, type: 'runner', x: tx * 16 + 3, y: ty * 16 - 14, w: 10, h: 14, vx: -dir * 70, vy: 0, enemy: true, stomp: true, hp: 1, t: Math.random() * 5, shooter: Math.random() < 0.3 + G.world * 0.08, cd: 0.8 + Math.random(), aimT: 0 };
      G.ents.push(e);
      return e;
    }
  }
}
function updateRunner(e, dt, G) {
  const L = G.L, P = G.P, pcx = P.x + 5, pcy = P.y + 7;
  if (e.onGround && e.hitWall) e.vy = -340;
  else if (e.onGround && ledgeAhead(e, L)) e.vy = -330;
  if (e.shooter) {
    e.cd -= dt; if (e.aimT > 0) e.aimT -= dt;
    const dx = pcx - (e.x + 5), dy = pcy - (e.y + 5), d = Math.hypot(dx, dy);
    if (e.cd <= 0 && d < 250 && Math.sign(dx) === Math.sign(e.vx) && G.pstate === 'alive') {
      e.cd = 1.9;
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      G.projs.push({ lane: e.lane || 0, x: e.x + 5, y: e.y + 4, vx: Math.cos(a) * 125, vy: Math.sin(a) * 125, r: 2.5, g: 0, life: 3, kind: 'bullet', solid: true });
      e.aimT = 0.25; sfx('shoot');
    }
  }
  entMove(e, dt, L);
  if (Math.abs(e.x - P.x) > 460) e.dead = true;
}
function updatePod(e, dt, G) {
  e.x += e.vx * dt; e.y = e.oy + Math.sin(e.t * 3) * 14;
  if (Math.abs(e.x - G.P.x) > 520) e.dead = true;
}
function updateWpn(e, dt, G) {
  e.life -= dt; if (e.life <= 0) e.dead = true;
  entMove(e, dt, G.L);
}
function spawnersUpdate(dt) {
  const L = G.L, P = G.P;
  if (L.arena) {
    G.podT = (G.podT || 6) - dt;
    if (G.podT <= 0 && G.boss && !G.boss.dead) { G.podT = 22; G.ents.push(makePod(500, 50, 'SMLF'[Math.floor(Math.random() * 4)])); }
    return;
  }
  const edge = G.mode === 'fp' ? P.x + (G.fpFace || 1) * 260 : G.camX + VW;
  while (G.podPlan.length && G.podPlan[0].x < edge && G.podPlan[0].x > P.x) {
    const p = G.podPlan.shift();
    const pod = makePod(G.mode === 'fp' ? edge : G.camX + VW + 20, 40 + Math.random() * 60, p.letter);
    pod.uid = 'p' + p.i;
    if (!NET.killed.has(pod.uid)) G.ents.push(pod);
  }
  while (G.podPlan.length && G.podPlan[0].x <= P.x - 200) G.podPlan.shift();
  G.runT -= dt;
  if (G.runT <= 0 && G.pstate === 'alive') {
    G.runT = Math.max(1.4, 3.2 - G.world * 0.3) + Math.random() * 1.6;
    const near = G.ents.filter(e => e.type === 'runner' && !e.dead).length;
    if (near < 3 + Math.floor(G.world / 2) && (!HUB || netIsHost())) netSpawned(spawnRunner());
  }
}
function makePod(x, y, letter) { return { type: 'pod', x, y, oy: y, vx: -58, hp: 2, letter, t: 0 }; }
function planPods(L, seed) {
  const R = rng(seed), out = [], letters = ['S', 'M', 'L', 'F'];
  for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
  let k = 0;
  for (let x = 22 * 16; x < (L.w - 24) * 16; x += 58 * 16) { out.push({ x, letter: letters[k % 4], i: k }); k++; }
  return out;
}

// ---------- drawing ----------
function drawRunner(g, e) {
  const x = Math.round(e.x), y = Math.round(e.y), f = Math.sign(e.vx) || -1, st = Math.floor(e.t * 10) % 2;
  const body = e.flash > 0 ? '#ffffff' : '#2a1630';
  rect(g, x + 2 + (st ? 0 : 2), y + 10, 2, 4, body); rect(g, x + 6 - (st ? 0 : 2), y + 10, 2, 4, body);
  rect(g, x + 1, y + 4, 8, 7, body); rect(g, x + 2, y, 6, 5, body);
  rect(g, x + (f > 0 ? 4 : 2), y + 2, 4, 1, '#ff5a8a');
  g.fillStyle = '#ff5a8a'; g.beginPath(); const hx = x + 5, hy = y + 6; g.moveTo(hx, hy + 2); g.lineTo(hx - 2, hy); g.lineTo(hx - 1, hy - 1); g.lineTo(hx, hy); g.lineTo(hx + 1, hy - 1); g.lineTo(hx + 2, hy); g.fill();
  rect(g, x + 4, y + 5, 1, 2, '#1a0a14');
  if (e.shooter) rect(g, f > 0 ? x + 8 : x - 4, y + 5, 6, 2, e.aimT > 0 ? '#ffe08a' : '#4a4a52');
}
function drawPod(g, e) {
  const x = e.x, y = e.y, fl = Math.sin(e.t * 20) > 0;
  g.fillStyle = e.flash > 0 ? '#ffffff' : '#9aa0aa'; g.beginPath(); g.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2); g.fill();
  rect(g, Math.round(x) - 6, Math.round(y) - 1, 12, 2, '#d0302a');
  g.fillStyle = '#d8dce4'; g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x - 9, y - (fl ? 10 : 5)); g.lineTo(x + 1, y - 4); g.fill();
  g.beginPath(); g.moveTo(x + 3, y - 3); g.lineTo(x + 9, y - (fl ? 10 : 5)); g.lineTo(x - 1, y - 4); g.fill();
}
function drawWpn(g, e) {
  if (e.life < 4 && Math.floor(e.life * 8) % 2) return;
  const x = Math.round(e.x + 6), y = Math.round(e.y + 5 + Math.sin(e.t * 5));
  g.fillStyle = WCOL[e.letter]; g.beginPath(); g.moveTo(x, y + 6); g.quadraticCurveTo(x - 9, y - 1, x - 4, y - 5); g.quadraticCurveTo(x, y - 6, x, y - 2); g.quadraticCurveTo(x, y - 6, x + 4, y - 5); g.quadraticCurveTo(x + 9, y - 1, x, y + 6); g.fill();
  g.fillStyle = '#1a0a0a'; g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e.letter, x, y);
}
function drawBolt(g, b) {
  const c = WCOL[b.w];
  if (b.w === 'L') { g.strokeStyle = c; g.lineWidth = 2; const m = Math.hypot(b.vx, b.vy); g.beginPath(); g.moveTo(b.x - b.vx / m * 12, b.y - b.vy / m * 12); g.lineTo(b.x, b.y); g.stroke(); return; }
  if (b.flame) { const r = 2 + b.t * 10; g.globalAlpha = Math.max(0, 1 - b.t * 2); circ(g, b.x, b.y, r, b.t < 0.15 ? '#ffe08a' : '#ff6a2a'); g.globalAlpha = 1; return; }
  circ(g, b.x, b.y, b.w === 'S' ? 2.5 : 2, c); rect(g, Math.round(b.x) - 1, Math.round(b.y) - 1, 1, 1, '#ffffff');
}
function heroBody(g, o) {
  // o: {crouch, air, run, st, t, glasses}; drawn facing right, feet at (0,0)
  const pal = o.pal || {}, pants = pal.pants || '#2a3a6a', pants2 = pal.pants2 || '#22305a', boot = '#3a2a1c', skin = '#d9a070', skin2 = '#b8804f';
  if (o.crouch) { rect(g, -5, -4, 10, 3, pants); rect(g, -6, -1, 5, 1, boot); rect(g, 1, -1, 5, 1, boot); }
  else if (o.air) { rect(g, -4, -6, 3, 4, pants); rect(g, 1, -5, 3, 3, pants2); rect(g, -4, -2, 3, 1, boot); rect(g, 1, -2, 3, 1, boot); }
  else {
    const a = o.run ? [-4, -2, 0, -2][o.st] : -3, b = o.run ? [1, -1, -3, -1][o.st] : 1;
    rect(g, a, -6, 3, 5, pants); rect(g, b, -6, 3, 5, pants2); rect(g, a, -1, 3, 1, boot); rect(g, b, -1, 3, 1, boot);
  }
  const ty = o.crouch ? -10 : -13;
  rect(g, -4, ty, 8, 7, skin); rect(g, -4, ty, 2, 7, skin2); rect(g, -2, ty + 2, 5, 1, skin2); rect(g, 0, ty + 4, 1, 2, skin2); rect(g, -4, ty + 6, 8, 1, '#5a3a1c');
  const hy = ty - 6;
  rect(g, -3, hy, 6, 6, '#e2a878'); rect(g, -3, hy - 1, 6, 2, '#2a1a10'); rect(g, 3, hy + 4, 1, 2, '#c08858');
  rect(g, -3, hy + 1, 6, 1, pal.band || '#d0302a');
  const wv = Math.sin(o.t * 14) > 0 ? 1 : 0;
  rect(g, -5, hy + 1 + wv, 2, 1, pal.band || '#d0302a'); rect(g, -7, hy + 2, 2, 1, pal.band2 || '#b02020');
  if (o.glasses) rect(g, 0, hy + 2, 4, 1, '#0a0a0a'); else rect(g, 1, hy + 3, 1, 1, '#1a1010');
}
function drawCommando(g) {
  const P = G.P;
  if (G.pstate === 'warp') return;
  if (G.pstate === 'dead' && G.pt < 0.9) return;
  for (const t of G.trail) { g.globalAlpha = t.a * 0.5; rect(g, Math.round(t.x), Math.round(t.y), 10, 14, '#ff5a8a'); }
  g.globalAlpha = 1;
  if (G.inv > 0 && G.pstate === 'alive' && Math.floor(G.inv * 16) % 2) return;
  const fx = Math.round(P.x + 5), fy = Math.round(P.y + PH.ph);
  const run = P.onGround && Math.abs(P.vx) > 20, st = Math.floor(G.t * 12) % 4;
  const [ax, ay] = G.aim || [P.face, 0];
  const face = ax !== 0 ? Math.sign(ax) : P.face;
  g.save(); g.translate(fx, fy); g.scale(P.sx * face, P.sy);
  heroBody(g, { crouch: P.crouch, air: !P.onGround, run, st, t: G.t, glasses: G.world === 4 });
  g.restore();
  const gy = fy + (P.crouch ? -8 : -10);
  g.strokeStyle = '#d9a070'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, gy); g.lineTo(fx + ax * 4, gy + ay * 4); g.stroke();
  g.strokeStyle = '#3a3d44'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx + ax * 2, gy + ay * 2); g.lineTo(fx + ax * 10, gy + ay * 10); g.stroke();
  rect(g, Math.round(fx + ax * 5) - 1, Math.round(gy + ay * 5), 2, 2, '#2a2c32');
  if (G.muzzle > 0) { circ(g, fx + ax * 12, gy + ay * 12, 3.5, '#ff9a3a'); circ(g, fx + ax * 12, gy + ay * 12, 2, '#fff2a0'); }
  if (G.pstate === 'dead') { if (Math.random() < 0.3) G.parts.push(part(fx, fy - 16, (Math.random() - 0.5) * 10, -30, 0.8, '#5a524a', 2)); }
}
function heartIcon(c, x, y, s, fill, stroke) {
  c.beginPath(); c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
}
function tapeIcon(c, x, y, fill) {
  c.fillStyle = fill ? '#ffd84a' : 'rgba(0,0,0,0.35)'; rr(c, x - 6, y - 4, 12, 8, 1.5); c.fill();
  c.strokeStyle = fill ? '#7a5a10' : 'rgba(255,216,74,0.6)'; c.lineWidth = 1; rr(c, x - 6 + 0.5, y - 4 + 0.5, 11, 7, 1.5); c.stroke();
  c.fillStyle = fill ? '#3a2a10' : 'rgba(255,216,74,0.5)'; c.beginPath(); c.arc(x - 2.5, y - 0.5, 1.4, 0, 7); c.arc(x + 2.5, y - 0.5, 1.4, 0, 7); c.fill();
}
function drawShrine(g, e) {
  const x = e.x, y = e.y;
  rect(g, x - 14, y - 6, 28, 6, '#4a3f37'); rect(g, x - 10, y - 14, 20, 8, '#5a4d43'); rect(g, x - 14, y - 6, 28, 1, '#8a7a6a');
  if (e.lit) {
    for (let i = 0; i < 6; i++) rect(g, x - 12 + i * 4, y - 16 - (i % 3) * 2, 3, 2, '#3a302a');
    drawFlame(g, x - 4, y - 14, 1.2, e.t, 0); drawFlame(g, x + 5, y - 14, 0.9, e.t + 1, 0);
    return;
  }
  const by = y - 32 + Math.sin(e.t * 2) * 2;
  g.globalCompositeOperation = 'lighter'; warmGlow(g, x, by, 26, 0.35, '255,90,140'); g.globalCompositeOperation = 'source-over';
  heartIcon(g, x, by, 9, '#e8507a');
  g.strokeStyle = '#4a0a20'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 1, by - 4); g.lineTo(x + 2, by); g.lineTo(x - 2, by + 3); g.lineTo(x + 1, by + 6); g.stroke();
  if (e.planted) {
    rect(g, x - 5, y - 20, 10, 6, '#3a3d44'); rect(g, x - 5, y - 20, 10, 1, '#6a6d74');
    if (Math.floor(e.t * 8) % 2) rect(g, x + 2, y - 19, 2, 2, '#ff2a2a');
    rect(g, x - 3, y - 18, 3, 3, '#c0302a');
  }
}
