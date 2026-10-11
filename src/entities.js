// ===================== ENTITIES =====================
const ENEMY_COL = [
  { b: '#1d1714', d: '#0e0b09', h: '#4a3a30', e: '#ffb347' },
  { b: '#3b3170', d: '#221b45', h: '#7ff0ff', e: '#e9fbff' },
  { b: '#7d5e33', d: '#4a3519', h: '#e2b866', e: '#2a1a0a' },
  { b: '#d9e6f5', d: '#8fa9c8', h: '#ffffff', e: '#24508a' },
  { b: '#3a1612', d: '#1e0a08', h: '#ff7a2a', e: '#ffd27a' },
];

function makeEnt(d) {
  const r = Math.random() * 10;
  switch (d.type) {
    case 'ember': return { type: 'ember', x: d.x, y: d.y, oy: d.y, t: r };
    case 'heart': return { type: 'heart', x: d.x, y: d.y, oy: d.y, t: r };
    case 'w': return { type: 'walker', x: d.x + 1, y: d.y + 4, w: 14, h: 12, vx: -32, vy: 0, enemy: true, stomp: true, t: r };
    case 'k': return { type: 'spiky', x: d.x + 1, y: d.y + 4, w: 14, h: 12, vx: -24, vy: 0, enemy: true, stomp: false, t: r };
    case 'h': return { type: 'hopper', x: d.x + 1, y: d.y + 4, w: 14, h: 12, vx: 0, vy: 0, enemy: true, stomp: true, cd: 0.6 + Math.random(), t: r };
    case 'f': return { type: 'moth', x: d.x + 2, y: d.y + 3, hx: d.x + 2, hy: d.y + 3, w: 12, h: 10, vx: 0, vy: 0, enemy: true, stomp: true, t: r };
    case 't': return { type: 'turret', x: d.x + 1, y: d.y + 2, w: 14, h: 14, enemy: true, stomp: true, cd: 1.2, face: -1, t: r };
    case 'c': return { type: 'charger', x: d.x, y: d.y + 4, w: 18, h: 12, vx: -28, vy: 0, enemy: true, stomp: true, st: 'patrol', st_t: 0, face: -1, t: r };
    case 'V': return { type: 'stal', x: d.x + 3, y: d.y, ox: d.x + 3, oy: d.y, w: 10, h: 14, vy: 0, st: 'hang', st_t: 0, t: r };
    case 'C': return { type: 'check', x: d.x + 8, y: d.y + 16, lit: false, t: r };
    case 'Z': return { type: 'beacon', x: d.x + 8, y: d.y + 16, lit: false, t: r };
    case 'i': return { type: 'sign', x: d.x + 8, y: d.y + 16, t: r };
    case 'Y': return { type: 'gate', x: d.x + 8, y: d.y + 16, t: r };
    case 'R': return { type: 'rift', x: d.x + 8, y: d.y + 16, t: r, armed: true, id: 0 };
  }
  return null;
}
function spawnEntities(L) {
  const out = [];
  for (const d of L.ents) { const e = makeEnt(d); if (e) { if (e.type === 'rift') e.id = L.world; out.push(e); } }
  L.stars.forEach((s, i) => out.push({ type: 'star', x: s.x, y: s.y, oy: s.y, i, t: i }));
  L.plats = L.platDefs.map(d => ({ kind: d.kind, x: d.x, y: d.y, w: d.w, h: d.h, x0: d.x, y0: d.y, ox: d.x, oy: d.y, range: d.range, vx: 0, vy: 0, t: d.x * 0.01, st: 0, gone: false }));
  return out;
}

function entMove(e, dt, L) {
  e.vy = Math.min(e.vy + 1200 * dt, 500);
  e.x += e.vx * dt;
  e.hitWall = false;
  if (solidRect(L, e.x, e.y, e.w, e.h)) { e.x -= e.vx * dt; e.hitWall = true; }
  const pb = e.y + e.h;
  e.y += e.vy * dt; e.onGround = false;
  if (e.vy > 0) {
    if (solidRect(L, e.x, e.y, e.w, e.h)) { e.y = Math.floor((e.y + e.h) / 16) * 16 - e.h; e.vy = 0; e.onGround = true; }
    else { const t = onewayTop(L, e.x, e.w, pb, e.y + e.h); if (t !== null) { e.y = t - e.h; e.vy = 0; e.onGround = true; } }
  } else if (e.vy < 0 && solidRect(L, e.x, e.y, e.w, e.h)) { e.y -= e.vy * dt; e.vy = 0; }
  if (e.y > L.h * 16 + 20) e.dead = true;
}
function ledgeAhead(e, L) {
  const fx = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
  const tx = Math.floor(fx / 16), ty = Math.floor((e.y + e.h + 2) / 16), ty2 = Math.floor((e.y + e.h - 2) / 16);
  const t = tileAt(L, tx, ty), t2 = tileAt(L, tx, ty2);
  if (t2 === T.SPIKEUP || t2 === T.LAVA) return true;
  return !(isSolidT(L, tx, ty) || t === T.ONEWAY);
}

function updateEnt(e, dt, G) {
  const L = G.L, P = G.P;
  e.t += dt; if (e.flash > 0) e.flash -= dt;
  const pcx = P.x + 5, pcy = P.y + 7;
  switch (e.type) {
    case 'ember': case 'heart': case 'star': e.y = e.oy + Math.sin(e.t * 3) * 1.5; break;
    case 'runner': updateRunner(e, dt, G); break;
    case 'pod': updatePod(e, dt, G); break;
    case 'wpn': updateWpn(e, dt, G); break;
    case 'walker': case 'spiky':
      if (e.onGround && (e.hitWall || ledgeAhead(e, L))) e.vx = -e.vx;
      entMove(e, dt, L); break;
    case 'hopper':
      if (e.onGround) {
        e.vx = 0; e.cd -= dt;
        if (e.cd <= 0 && Math.abs(pcx - e.x) < 200) { e.vy = -330; e.vx = Math.sign(pcx - e.x - 7) * 70 || 70; e.cd = 1.0 + Math.random() * 0.6; }
      } else if (e.hitWall) e.vx = -e.vx * 0.5;
      entMove(e, dt, L); break;
    case 'moth': {
      const dx = pcx - (e.x + 6), dy = pcy - (e.y + 5), dist = Math.hypot(dx, dy);
      let tx, ty;
      if (dist < 120 && G.hp > 0) { tx = dx / dist * 32; ty = dy / dist * 32; }
      else { tx = (e.hx - e.x) * 1.5; ty = (e.hy - e.y) * 1.5; }
      e.vx += (tx - e.vx) * 2 * dt; e.vy += (ty - e.vy) * 2 * dt;
      e.x += e.vx * dt; e.y += e.vy * dt + Math.sin(e.t * 9) * 0.5;
      break;
    }
    case 'turret': {
      e.face = pcx < e.x + 7 ? -1 : 1;
      e.cd -= dt;
      const dx = pcx - (e.x + 7), dy = pcy - (e.y + 7);
      if (e.cd <= 0 && Math.abs(dx) < 230 && Math.abs(dy) < 90) {
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        G.projs.push({ lane: e.lane || 0, x: e.x + 7 + e.face * 8, y: e.y + 6, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, r: 3.5, g: 0, life: 4, kind: 'orb', solid: true, seen: true });
        e.cd = 3.2; e.fire = 0.2;
        if (Math.abs(dx) < 260) sfx('shoot');
      }
      if (e.fire > 0) e.fire -= dt;
      break;
    }
    case 'charger': {
      e.st_t -= dt;
      if (e.st === 'patrol') {
        if (e.onGround && (e.hitWall || ledgeAhead(e, L))) e.vx = -e.vx;
        e.face = Math.sign(e.vx) || e.face;
        if (Math.abs(pcy - (e.y + 6)) < 22 && Math.abs(pcx - e.x) < 150 && Math.sign(pcx - e.x - 9) === e.face) { e.st = 'wind'; e.st_t = 0.65; e.vx = 0; }
      } else if (e.st === 'wind') {
        if (e.st_t <= 0) { e.st = 'charge'; e.vx = e.face * 175; }
      } else if (e.st === 'charge') {
        if (Math.random() < 0.5) G.parts.push(part(e.x + 9 - e.face * 9, e.y + 12, -e.face * 20, -20, 0.4, THEMES[G.world].top, 2));
        if (e.hitWall || (e.onGround && ledgeAhead(e, L))) { e.st = 'stun'; e.st_t = 0.8; e.vx = 0; }
      } else if (e.st === 'stun' && e.st_t <= 0) { e.st = 'patrol'; e.vx = e.face * 28; }
      entMove(e, dt, L); break;
    }
    case 'stal':
      if (e.st === 'hang') {
        if (Math.abs(pcx - (e.x + 5)) < 14 && P.y > e.y && P.y - e.y < 150) { e.st = 'shake'; e.st_t = 0.55; sfx('crumble'); }
      } else if (e.st === 'shake') { e.st_t -= dt; if (e.st_t <= 0) { e.st = 'fall'; e.vy = 0; } }
      else if (e.st === 'fall') {
        e.vy = Math.min(e.vy + 1100 * dt, 520); e.y += e.vy * dt;
        if (solidRect(L, e.x, e.y + 4, e.w, e.h - 4) || e.y > L.h * 16) {
          burst(G, e.x + 5, e.y + e.h, 8, THEMES[G.world].spike, 90); sfx('crumble');
          e.st = 'gone'; e.st_t = 3;
        }
      } else if (e.st === 'gone') { e.st_t -= dt; if (e.st_t <= 0) { e.st = 'hang'; e.y = e.oy; } }
      break;
  }
}

// ---------- particles ----------
function part(x, y, vx, vy, life, c, s, g, glow) { return { x, y, vx, vy, life, max: life, c, s: s || 2, g: g || 0, glow }; }
function burst(G, x, y, n, c, sp, g, glow) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random() * 0.7) * (sp || 80); G.parts.push(part(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.3 + Math.random() * 0.4, c, Math.random() < 0.5 ? 1 : 2, g || 0, glow)); }
}

// ---------- drawing ----------
function drawBlob(g, x, y, w, h, col, face, t, fuzzy) {
  rect(g, x + 1, y + 2, w - 2, h - 3, col.b);
  rect(g, x, y + 3, w, h - 5, col.b);
  rect(g, x + 2, y + 1, w - 4, 1, col.b);
  rect(g, x + 2, y + h - 2, w - 4, 1, col.d);
  if (fuzzy) for (let i = 0; i < 4; i++) rect(g, x + ((i * 5 + Math.floor(t * 8)) % w), y + (i % 2 ? 0 : h - 1), 1, 1, col.b);
  const ex = x + w / 2 + face * 2 - 3;
  rect(g, ex, y + 4, 2, 3, col.e); rect(g, ex + 4, y + 4, 2, 3, col.e);
  const step = Math.floor(t * 8) % 2;
  rect(g, x + 2, y + h - 1, 3, 1, col.d); rect(g, x + w - 5, y + h - 1 - step, 3, 1, col.d);
}
function drawEnt(g, e, G) {
  const w = G.world, col = ENEMY_COL[w], th = THEMES[w], x = Math.round(e.x), y = Math.round(e.y);
  if (drawMemory(g, e)) return;
  switch (e.type) {
    case 'ember': {
      const tw = Math.sin(e.t * 6) > 0.6;
      circ(g, e.x, e.y, 3.5, '#ff7a2a'); circ(g, e.x, e.y, 2, '#ffd36a'); rect(g, Math.round(e.x) - (tw ? 1 : 0), Math.round(e.y) - 1, tw ? 2 : 1, tw ? 2 : 1, '#fffbe8');
      break;
    }
    case 'heart': {
      g.fillStyle = '#f5e9cf'; g.beginPath(); g.moveTo(e.x, e.y - 7); g.quadraticCurveTo(e.x + 6, e.y, e.x, e.y + 5); g.quadraticCurveTo(e.x - 6, e.y, e.x, e.y - 7); g.fill();
      rect(g, Math.round(e.x) - 2, Math.round(e.y) - 1, 1, 3, '#ffffff');
      if (Math.sin(e.t * 5) > 0.7) rect(g, Math.round(e.x) + 4, Math.round(e.y) - 6, 1, 1, '#ffffff');
      break;
    }
    case 'star': {
      const x = Math.round(e.x), y = Math.round(e.y);
      g.globalCompositeOperation = 'lighter'; warmGlow(g, x, y, 16, 0.35, '255,220,90'); g.globalCompositeOperation = 'source-over';
      rect(g, x - 7, y - 5, 14, 10, '#ffd84a'); rect(g, x - 6, y - 4, 12, 4, '#fff2b0'); rect(g, x - 4, y + 1, 8, 3, '#3a2a10');
      rect(g, x - 4, y - 3, 2, 2, '#3a2a10'); rect(g, x + 2, y - 3, 2, 2, '#3a2a10');
      if (Math.sin(e.t * 4) > 0.5) rect(g, x + 6, y - 7, 1, 1, '#ffffff');
      break;
    }
    case 'runner': drawRunner(g, e); break;
    case 'pod': drawPod(g, e); break;
    case 'wpn': drawWpn(g, e); break;
    case 'walker': drawBlob(g, x, y, e.w, e.h, col, Math.sign(e.vx), e.t, w === 0);
      if (w === 1) { rect(g, x + 3, y - 1, 2, 2, col.h); rect(g, x + 7, y - 2, 2, 3, col.h); rect(g, x + 11, y - 1, 2, 2, col.h); }
      if (w === 2) { circ(g, x + 7, y + 1, 3, col.h); circ(g, x + 7, y + 1, 1, col.d); }
      if (w === 4) { rect(g, x + 4, y + 8, 6, 1, col.h); rect(g, x + 7, y - 1, 1, 2, col.h); }
      break;
    case 'spiky':
      drawBlob(g, x, y, e.w, e.h, col, Math.sign(e.vx), e.t);
      g.fillStyle = th.spike;
      for (let i = 0; i < 4; i++) { g.beginPath(); const sx = x + 1 + i * 3.5; g.moveTo(sx, y + 3); g.lineTo(sx + 1.7, y - 3); g.lineTo(sx + 3.4, y + 3); g.fill(); }
      break;
    case 'hopper': {
      const air = !e.onGround;
      drawBlob(g, x, y + (air ? -1 : 1), e.w, e.h - (air ? 0 : 2), col, Math.sign(G.P.x - e.x) || 1, 0);
      rect(g, x - 1, y + e.h - (air ? 0 : 3), 3, air ? 3 : 2, col.d); rect(g, x + e.w - 2, y + e.h - (air ? 0 : 3), 3, air ? 3 : 2, col.d);
      break;
    }
    case 'moth': {
      const flap = Math.sin(e.t * 24) > 0, wc = w === 3 ? '#cfe6ff' : w === 1 ? '#b9a8ff' : '#d9cba0';
      g.fillStyle = wc; g.beginPath();
      if (flap) { g.moveTo(x + 6, y + 5); g.lineTo(x - 2, y - 3); g.lineTo(x, y + 7); g.moveTo(x + 6, y + 5); g.lineTo(x + 14, y - 3); g.lineTo(x + 12, y + 7); }
      else { g.moveTo(x + 6, y + 5); g.lineTo(x - 3, y + 6); g.lineTo(x + 1, y + 10); g.moveTo(x + 6, y + 5); g.lineTo(x + 15, y + 6); g.lineTo(x + 11, y + 10); }
      g.fill();
      rect(g, x + 4, y + 2, 4, 7, '#3b3226'); rect(g, x + 4, y, 1, 2, '#3b3226'); rect(g, x + 7, y, 1, 2, '#3b3226');
      rect(g, x + 4, y + 3, 1, 1, '#ffd27a'); rect(g, x + 7, y + 3, 1, 1, '#ffd27a');
      break;
    }
    case 'turret': {
      rect(g, x + 1, y + 4, 12, 10, col.d); rect(g, x, y + 6, 14, 6, col.b); rect(g, x + 3, y + 2, 8, 3, col.b);
      const mx = e.face > 0 ? x + 10 : x;
      rect(g, mx, y + 7, 4, 4, e.fire > 0 ? '#ffe08a' : '#0a0606');
      rect(g, x + 6, y + 4, 2, 2, col.e);
      break;
    }
    case 'charger': {
      const shake = e.st === 'wind' ? (Math.random() * 2 - 1) : 0;
      drawBlob(g, x + shake, y, e.w, e.h, col, e.face, e.st === 'charge' ? e.t * 2 : e.t);
      const hx = e.face > 0 ? x + e.w : x - 4;
      g.fillStyle = col.h; g.beginPath(); g.moveTo(hx + (e.face > 0 ? 0 : 4), y + 4); g.lineTo(hx + (e.face > 0 ? 5 : -1), y + 1); g.lineTo(hx + (e.face > 0 ? 0 : 4), y + 8); g.fill();
      if (e.st === 'stun') for (let i = 0; i < 3; i++) rect(g, Math.round(x + 9 + Math.cos(e.t * 6 + i * 2) * 7), Math.round(y - 4 + Math.sin(e.t * 6 + i * 2) * 2), 1, 1, '#fff6b0');
      break;
    }
    case 'stal': {
      if (e.st === 'gone') break;
      const sx = e.st === 'shake' ? Math.round(Math.random() * 2 - 1) : 0;
      g.fillStyle = w === 3 ? '#cfeaff' : th.spike; g.beginPath(); g.moveTo(x + sx, y); g.lineTo(x + 5 + sx, y + 14); g.lineTo(x + 10 + sx, y); g.fill();
      rect(g, x + 4 + sx, y + 1, 1, 8, '#ffffff');
      break;
    }
    case 'check': {
      rect(g, e.x - 1, e.y - 26, 2, 26, '#2a2018'); rect(g, e.x - 5, e.y - 2, 10, 2, '#2a2018');
      rect(g, e.x - 5, e.y - 34, 10, 10, '#1d1712'); rect(g, e.x - 4, e.y - 33, 8, 8, e.lit ? '#ffcf6a' : '#3a3a44');
      rect(g, e.x - 6, e.y - 35, 12, 2, '#2a2018'); rect(g, e.x - 2, e.y - 37, 4, 2, '#2a2018');
      if (e.lit) drawFlame(g, e.x, e.y - 26, 0.6, e.t, 0);
      break;
    }
    case 'beacon': drawShrine(g, e); break;
    case 'gate': drawGate(g, e); break;
    case 'rift': drawRift(g, e); break;
    case 'sign': {
      rect(g, e.x - 1, e.y - 12, 2, 12, '#3b2a1c'); rect(g, e.x - 8, e.y - 20, 16, 10, '#8a6440'); rect(g, e.x - 8, e.y - 20, 16, 1, '#b38a5e');
      for (let i = 0; i < 3; i++) rect(g, e.x - 5, e.y - 17 + i * 2, 6 + (i % 2) * 4, 1, '#4a3322');
      break;
    }
  }
}
function drawPlat(g, p, G) {
  if (p.gone) return;
  const th = THEMES[G.world], x = Math.round(p.x + (p.kind === 'f' && p.st === 1 ? Math.random() * 2 - 1 : 0)), y = Math.round(p.y);
  rect(g, x, y, p.w, 6, p.kind === 'f' ? th.plat : th.platHi); rect(g, x, y + 6, p.w, 2, th.edge); rect(g, x, y, p.w, 1, '#ffffff22');
  if (p.kind !== 'f') { rect(g, x + 3, y + 2, 2, 2, th.edge); rect(g, x + p.w - 5, y + 2, 2, 2, th.edge); rect(g, x + p.w / 2 - 4, y + 2, 8, 2, th.plat); }
  else { rect(g, x + 10, y + 1, 1, 5, th.edge); rect(g, x + 21, y + 2, 1, 4, th.edge); }
}
function drawSpring(g, s, G) {
  const x = s.x, y = s.y, k = s.t > 0 ? 1 : 0;
  if (G.world === 0) {
    rect(g, x + 6, y + 10 + k, 4, 6 - k, '#e9dcc0');
    g.fillStyle = '#d0402c'; g.beginPath(); g.ellipse(x + 8, y + 10 + k * 2, 8, 5 - k * 2, 0, Math.PI, 0); g.fill();
    rect(g, x + 4, y + 7 + k, 2, 1, '#ffe6d8'); rect(g, x + 10, y + 8 + k, 2, 1, '#ffe6d8');
  } else {
    const h = k ? 4 : 7;
    for (let i = 0; i < 3; i++) rect(g, x + 3, y + 16 - 2 - i * Math.floor(h / 3) - 1, 10, 1, '#9aa0aa');
    rect(g, x + 2, y + 16 - h - 3, 12, 3, '#d0402c'); rect(g, x + 2, y + 16 - h - 3, 12, 1, '#ff8a6a'); rect(g, x + 1, y + 14, 14, 2, '#4a4a52');
  }
}
function drawSaw(g, s, t) {
  const n = 10, rot = t * 9;
  g.fillStyle = '#b9bec8'; g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? s.r - 3 : s.r + 1; g.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r); }
  g.fill(); circ(g, s.x, s.y, s.r - 5, '#7d838e'); circ(g, s.x, s.y, 2, '#2b2d33');
}
