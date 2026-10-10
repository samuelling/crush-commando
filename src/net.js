// ===================== NET: portals + multiplayer, via the combined page =====================
// Active only inside the "Crush Commando x Hollow Dash" hub (../index.html), which loads this game
// in an iframe with ?hub. The hub owns the network connection; this file reports where the player
// is, draws friends, fires their guns, and shares kills, boss damage and trooper spawns.
const HUB = new URLSearchParams(location.search).has('hub') && window.parent !== window;
const PLAYER_COLS = ['#ff5d8a', '#4fc3f7', '#ffd54f', '#81c784', '#ba68c8', '#ff8a50', '#4dd0e1', '#e0e0e0'];
const HD_TITLES = ['Prologue: Genre', 'Chapter One: The Tail', 'Chapter Three: Flight, Then Less', 'Chapter Six: The Gray', 'Chapter Five: The Lack'];
const NET = { me: null, n: 0, peers: new Map(), loc: null, sendT: 0, killed: new Set(), asleep: false, quiet: false, runK: 0, gunSfx: 0 };

function hubPost(m) { try { window.parent.postMessage(Object.assign({ hub: 1 }, m), '*'); } catch (_) { } }
function netEv(e) { if (HUB && NET.loc && !NET.quiet) hubPost({ t: 'ev', e: Object.assign({ loc: NET.loc }, e) }); }

if (HUB) {
  addEventListener('message', e => {
    if (e.source !== window.parent || !e.data || e.data.hub !== 1) return;
    const m = e.data;
    switch (m.t) {
      case 'me': NET.me = m.id; NET.n = m.n; break;
      case 'sleep': netSleep(); break;
      case 'wake': netWake(); break;
      case 'enter': netWake(); netArrive(m.id, m.held); break;
      case 'goto': netWake(); netGoto(m); break;
      case 'peer': {
        let q = NET.peers.get(m.p.id);
        if (!q) { q = { id: m.p.id, rx: 0, ry: 0, fresh: true, fireCD: 0 }; NET.peers.set(m.p.id, q); }
        q.n = m.p.n; q.name = m.p.name; q.col = m.p.col | 0;
        if (m.p.s) q.s = m.p.s, q.age = 0;
        break;
      }
      case 'gone': NET.peers.delete(m.id); break;
      case 'ev': netOnEvent(m.from, m.e); break;
    }
  });
  addEventListener('keydown', e => { if (e.code === 'KeyG' && !e.repeat) hubPost({ t: 'join' }); });
  setTimeout(() => hubPost({ t: 'ready', game: 'cc' }), 0);
}

function netClearInput() { for (const k in kb) kb[k] = false; for (const k in kraw) kraw[k] = false; for (const k in tc) tc[k] = false; G.mouseFire = false; }
function netSleep() {
  NET.asleep = true; releaseLock(); netClearInput();
  if (AU.ctx && AU.ctx.state === 'running') AU.ctx.suspend();
}
function netWake() {
  if (!NET.asleep) return;
  NET.asleep = false; netClearInput();
  audioInit();
  last = performance.now(); acc = 0;
}
function netHold(held) {
  for (const code of held || []) { const a = KEYS[code]; if (a === 'left' || a === 'right') { kb[a] = true; kraw[code] = true; } }
}

// Put the player down at (feet x, feet y) in the current stage, in first person if that spot is in a 3D zone.
function netPlace(fx, fy, lane) {
  const P = G.P, L = G.L;
  Object.assign(P, { x: fx - 5, y: fy - PH.ph, vx: 0, vy: 0, dashT: 0, gliding: false, plat: null, onGround: false, wallLock: 0, lane: lane || 0, z: (lane || 0) * LW, vz: 0 });
  G.pstate = 'alive'; G.inv = Math.max(G.inv, 1.2); G.overlay = null;
  G.safe = { x: P.x, y: P.y, lane: lane || 0 }; G.checkpoint = { x: P.x, y: P.y };
  const want = fpZoneAt(L, P.x + 5) ? 'fp' : 'side';
  if (want !== G.mode) { G.mode = want; if (want === 'fp') { G.yaw = P.face > 0 ? 0 : Math.PI; G.pitch = 0; G.fpFace = P.face; } else releaseLock(); }
  if (want === 'side') { P.lane = 0; P.z = 0; }
  G.camX = clamp(P.x + 5 - VW / 2, 0, L.w * 16 - VW); G.camLook = 0; G.lastCam = G.camX;
  G.fade = 0.8; initAmbient();
}
function netExit(id) {
  sfx('portal'); G.flash = 0.5;
  const held = Object.keys(kraw).filter(k => kraw[k]);
  netClearInput();
  hubPost({ t: 'portal', id, held });
}
function netArrive(id, held) {
  if (!(G.scene === 'play' && G.world === id && G.idx === 0)) { startStage(id, 0); G.overlay = null; }
  const r = G.ents.find(e => e.type === 'rift');
  if (r) netPlace(r.x + 14, r.y, 0);
  G.overlay = null;
  G.toast = { text: `Out of Hollow Dash · ${HD_TITLES[id]}`, t: 2.6 };
  netHold(held);
}
function netGoto(m) {
  const mm = /^cc:(\d)-(\d)$/.exec(m.loc || '');
  if (!mm) return;
  const w = +mm[1], i = +mm[2];
  if (!(G.scene === 'play' && G.world === w && G.idx === i)) startStage(w, i);
  G.overlay = null;
  netPlace(m.x + 5 - 18, m.y + PH.ph, m.lane || 0);
  G.toast = { text: `With ${m.name || 'your friend'}`, t: 2 };
}

function netState() {
  if (G.scene !== 'play' || !G.L) {
    const label = { map: 'On the mission map', title: 'On the title screen', ending: 'Watching the ending', intro: 'Reading the intro' }[G.scene] || 'Getting ready';
    return { g: 'cc', loc: null, label };
  }
  const P = G.P, w = G.world, i = G.idx;
  return {
    g: 'cc', loc: `cc:${w}-${i}`, label: (i === 3 ? WORLDS[w].boss : WORLDS[w].levels[i]) + ' · ' + WORLDS[w].name,
    x: Math.round(P.x), y: Math.round(P.y), vx: Math.round(P.vx), vy: Math.round(P.vy), f: P.face, gr: P.onGround ? 1 : 0, cr: P.crouch ? 1 : 0,
    d: P.dashT > 0 ? 1 : 0, fp: G.mode === 'fp' ? 1 : 0, ln: P.lane || 0, z: Math.round(P.z || 0), yw: Math.round((G.yaw || 0) * 100) / 100, pt: Math.round((G.pitch || 0) * 100) / 100,
    ax: Math.round(G.aim[0] * 100) / 100, ay: Math.round(G.aim[1] * 100) / 100, w: G.weapon || 'N', fi: G.netFiring ? 1 : 0, hp: G.hp,
    al: (G.pstate === 'alive' || G.pstate === 'goal') ? 1 : 0,
  };
}

function netHere() {
  const out = [];
  if (!NET.loc) return out;
  for (const q of NET.peers.values()) if (q.s && q.s.loc === NET.loc && q.age < 5 && q.s.al) out.push(q);
  return out;
}
// The earliest joiner among the players in this stage runs the shared troopers.
function netIsHost() {
  for (const q of NET.peers.values()) if (q.s && q.s.loc === NET.loc && q.age < 3 && q.n < NET.n) return false;
  return true;
}

function netTick(dt) {
  if (!HUB) return;
  const s = netState(), loc = s.loc;
  if (loc !== NET.loc) { NET.loc = loc; NET.killed.clear(); if (loc) hubPost({ t: 'ev', e: { k: 'killq', loc } }); }
  NET.gunSfx -= dt;
  for (const q of NET.peers.values()) {
    if (!q.s) continue;
    q.age = (q.age || 0) + dt;
    const p = q.s, lead = Math.min(q.age, 0.12);
    const tx = (p.x || 0) + (p.vx || 0) * lead, ty = (p.y || 0) + (p.vy || 0) * lead * 0.5, tz = p.fp ? (p.z || 0) : (p.ln || 0) * LW;
    if (q.fresh || Math.abs(tx - q.rx) > 160 || Math.abs(ty - q.ry) > 120) { q.rx = tx; q.ry = ty; q.rz = tz; q.fresh = false; }
    const k = Math.min(1, dt * 14);
    q.rx += (tx - q.rx) * k; q.ry += (ty - q.ry) * k; q.rz = (q.rz || 0) + (tz - (q.rz || 0)) * k;
    // their gun, fired here so their shots hit what's in front of them on your screen too
    if (!NET.asleep && G.scene === 'play' && p.loc === NET.loc && p.fi && p.al && q.age < 1) {
      q.fireCD -= dt;
      if (q.fireCD <= 0) {
        const W = WEAPONS[p.w] || WEAPONS.N;
        q.fireCD = W.rate;
        shootFrom({ x: q.rx, y: q.ry, crouch: !!p.cr, aim: [p.ax || p.f || 1, p.ay || 0], fp: !!p.fp, yaw: p.yw || 0, pitch: p.pt || 0, z: q.rz, lane: p.ln || 0, weapon: p.w || 'N' }, true);
        if (NET.gunSfx <= 0 && Math.abs(q.rx - G.P.x) < 300) { sfx('gun' + (p.w || 'N')); NET.gunSfx = 0.22; }
      }
    } else q.fireCD = 0;
  }
  NET.sendT -= dt;
  if (NET.sendT <= 0) { NET.sendT = loc && !NET.asleep ? 1 / 15 : 1; hubPost({ t: 'state', s }); }
}

function netOnEvent(from, e) {
  if (!e || e.loc !== NET.loc || G.scene !== 'play') return;
  switch (e.k) {
    case 'kill': {
      NET.killed.add(e.uid);
      const en = G.ents.find(q => q.uid === e.uid && !q.dead);
      if (en) { NET.quiet = true; netKillEnt(en, true); NET.quiet = false; }
      break;
    }
    case 'killq': hubPost({ t: 'ev', to: from, e: { k: 'kills', loc: NET.loc, uids: [...NET.killed].slice(-300) } }); break;
    case 'kills':
      if (Array.isArray(e.uids)) for (const u of e.uids) { NET.killed.add(u); const en = G.ents.find(q => q.uid === u); if (en) en.dead = true; }
      break;
    case 'bhit':
      if (G.boss && !G.boss.dead) { NET.quiet = true; bossHit(false); NET.quiet = false; }
      break;
    case 'spawn':
      if (e.t === 'runner' && !NET.killed.has(e.uid) && !G.ents.some(q => q.uid === e.uid)) {
        G.ents.push({ uid: e.uid, lane: e.lane | 0, type: 'runner', x: +e.x, y: +e.y, w: 10, h: 14, vx: +e.vx, vy: 0, enemy: true, stomp: true, hp: 1, t: Math.random() * 5, shooter: !!e.sh, cd: 0.8 + Math.random(), aimT: 0 });
      }
      break;
  }
}
function netKillEnt(en, fx) {
  if (en.uid) NET.killed.add(en.uid);
  if (en.type === 'pod') {
    en.dead = true;
    if (fx) { sfx('stomp'); burst(G, en.x, en.y, 14, '#ffd27a', 120, 0, true); }
    G.ents.push({ type: 'wpn', x: en.x - 6, y: en.y - 5, w: 12, h: 10, vx: 0, vy: -200, letter: en.letter, t: 0, life: 18 });
  } else if (en.enemy) killEnemy(en, false);
  else en.dead = true;
}
function netSpawned(e) {
  if (!HUB || !e) return;
  e.uid = `r${NET.me || 'x'}-${NET.runK++}`;
  netEv({ k: 'spawn', t: 'runner', uid: e.uid, x: Math.round(e.x), y: Math.round(e.y), vx: e.vx, lane: e.lane || 0, sh: e.shooter ? 1 : 0 });
}

// ---------- drawing friends ----------
function peerPal(q) {
  const c = PLAYER_COLS[q.col % PLAYER_COLS.length];
  return { band: c, band2: c, pants: c, pants2: c };
}
function drawPeerBody(g, q) {
  const p = q.s, fx = Math.round(q.rx + 5), fy = Math.round(q.ry + PH.ph);
  const run = p.gr && Math.abs(p.vx || 0) > 20, st = Math.floor(G.t * 12) % 4;
  const ax = p.fp ? (Math.cos(p.yw || 0) >= 0 ? 1 : -1) : (p.ax || p.f || 1), ay = p.fp ? 0 : (p.ay || 0);
  const face = ax !== 0 ? Math.sign(ax) : (p.f || 1);
  g.save(); g.translate(fx, fy); g.scale(face, 1);
  heroBody(g, { crouch: !!p.cr, air: !p.gr, run, st, t: G.t + q.n % 7, pal: peerPal(q) });
  g.restore();
  const gy = fy + (p.cr ? -8 : -10);
  g.strokeStyle = '#3a3d44'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx + ax * 2, gy + ay * 2); g.lineTo(fx + ax * 10, gy + ay * 10); g.stroke();
  if (p.d) { g.globalAlpha *= 0.5; rect(g, fx - 5 - face * 6, fy - 14, 10, 14, PLAYER_COLS[q.col % PLAYER_COLS.length]); }
}
function drawPeersSide(g) {
  for (const q of netHere()) {
    const off = q.s.fp && (q.s.ln || 0) !== 0;
    g.globalAlpha = off ? 0.35 : 1;
    drawPeerBody(g, q);
    g.globalAlpha = 1;
  }
}
// Name tags and off-screen pointers, on the crisp UI layer.
function netDrawTags(c) {
  if (!HUB) return;
  for (const q of netHere()) {
    const col = PLAYER_COLS[q.col % PLAYER_COLS.length], name = q.name || 'Friend';
    let x, y;
    if (G.mode === 'fp') { if (!q.scr) continue; x = q.scr.x; y = q.scr.y; q.scr = null; }
    else { x = q.rx + 5 - G.camX; y = q.ry - 6; }
    c.font = `7px ${FU}`; c.textAlign = 'center';
    if (x < 8 || x > VW - 8) {
      const side = x < 8 ? -1 : 1, ex = side < 0 ? 10 : VW - 10, ey = clamp(y, 30, VH - 30);
      c.fillStyle = col; c.beginPath(); c.moveTo(ex + side * 6, ey); c.lineTo(ex, ey - 5); c.lineTo(ex, ey + 5); c.fill();
      const m = Math.round(Math.abs(q.rx - G.P.x) / 16);
      txt(c, `${name} ${m}m`, ex - side * 4, ey + 14, 7, col, side < 0 ? 'left' : 'right');
      continue;
    }
    c.lineWidth = 3; c.strokeStyle = 'rgba(10,6,10,0.8)'; c.strokeText(name, x, y); txt(c, name, x, y, 7, col, 'center');
  }
}

// A rift into Hollow Dash: a tear in the page, night-blue and paper-gold, with words drifting out.
function drawRift(g, e) {
  const x = e.x, y = e.y, h = 34, cy = y - h / 2 - 1, t = e.t;
  const sx = Math.round(x - 26);
  rect(g, sx, y - 18, 2, 18, '#5a4632');
  rect(g, sx - 7, y - 27, 16, 10, '#fff3c4'); rect(g, sx - 7, y - 27, 16, 1, '#ffd166'); rect(g, sx, y - 26, 1, 8, '#8a6a48');
  for (let i = 0; i < 3; i++) { rect(g, sx - 5, y - 25 + i * 2, 4, 1, '#4a2f6b'); rect(g, sx + 2, y - 25 + i * 2, 4, 1, '#4a2f6b'); }
  const layers = ['#1c2752', '#3a4a8a', '#ffd166', '#fff3c4'];
  for (let i = 0; i < 4; i++) {
    const k = 1 - i * 0.18, wob = Math.sin(t * 3 + i) * 0.8;
    g.fillStyle = layers[i]; g.beginPath(); g.ellipse(x, cy, (9 + wob) * k, (h / 2 + wob) * k, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#0c1028'; g.beginPath(); g.ellipse(x, cy, 3.2, h * 0.34, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 6; i++) {
    const u = (t * 0.5 + i / 6) % 1;
    g.globalAlpha = 1 - u;
    rect(g, Math.round(x + (i % 2 ? 1 : -1) * (5 + u * 22)), Math.round(cy - 8 + i * 3 - u * 14), 2 + (i % 3), 1, '#fff3c4');
  }
  g.globalAlpha = 1;
  if (Math.sin(t * 0.9) > 0.6) { rect(g, Math.round(x) - 2, Math.round(cy) + 2, 4, 5, '#ff5d5d'); rect(g, Math.round(x), Math.round(cy) + 3, 1, 1, '#ffffff'); }
}
