// ===================== MAIN: input, scenes, game loop =====================
const cv = document.getElementById('screen'), ctx = cv.getContext('2d');
const low = mkCanvas(VW, VH), g = low.getContext('2d');
const app = document.getElementById('app'), stage = document.getElementById('stage'), touchEl = document.getElementById('touch'), bPause = document.getElementById('bPause');
let S = 1;

// ---------- save ----------
const SAVE_KEY = 'emberwick.save.v1';
function defaultSave() { return { unlocked: 0, lv: {}, deaths: 0, playTime: 0, music: true, sfx: true, cursor: 0, cleared: false }; }
let SAVE = defaultSave();
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') SAVE = Object.assign(defaultSave(), s); } catch (e) { } }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } }

// ---------- state ----------
const G = {
  scene: 'title', overlay: null, overlayT: 0, touch: false, t: 0, click: null, lastInput: 'kb', menu: 0, eraseArm: false,
  world: 0, idx: 0, L: null, P: null, ents: [], projs: [], parts: [], amb: [], hp: 3, inv: 0, pstate: 'alive', pt: 0,
  embers: 0, embersTotal: 0, starsGot: [false, false, false], prevStars: [false, false, false], checkpoint: null, safe: null,
  time: 0, deaths: 0, boss: null, camX: 0, camLook: 0, lastCam: 0, shake: 0, hitstop: 0, flash: 0, banner: 0, toast: null,
  wind: 0, darkBoost: 0, bgs: [], trail: [], ab: abilitiesFor(0), results: null, sel: 0, mapT: 0,
};

// ---------- input ----------
const ACTS = ['left', 'right', 'up', 'down', 'jump', 'dash', 'fire', 'pause', 'confirm', 'mute'];
const kb = {}, tc = {}, gp = {}, latch = {}, prev = {}, kraw = {};
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', KeyZ: 'jump', Space: 'jump', KeyK: 'jump', KeyX: 'fire', KeyJ: 'fire', KeyF: 'fire', ShiftLeft: 'dash', ShiftRight: 'dash', KeyC: 'dash', KeyL: 'dash', Escape: 'pause', KeyP: 'pause', Enter: 'confirm', KeyM: 'mute' };
addEventListener('keydown', e => {
  kraw[e.code] = true;
  if (G.mode === 'fp' && (e.code === 'KeyQ' || e.code === 'KeyE')) e.preventDefault();
  const a = KEYS[e.code]; if (!a) return;
  e.preventDefault(); if (!kb[a]) latch[a] = true; kb[a] = true; audioInit(); G.lastInput = 'kb';
});
addEventListener('keyup', e => { kraw[e.code] = false; const a = KEYS[e.code]; if (a) kb[a] = false; });
addEventListener('blur', () => { for (const k in kb) kb[k] = false; for (const k in kraw) kraw[k] = false; for (const k in tc) tc[k] = false; if (G.scene === 'play' && !G.overlay) openPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.scene === 'play' && !G.overlay) openPause(); });
function setT(a, v) { if (v && !tc[a]) latch[a] = true; tc[a] = v; }
function setupTouch() {
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid = null;
  const upd = e => {
    const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy, m = Math.hypot(dx, dy), R = r.width * 0.32, k = m > R ? R / m : 1;
    knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    const dz = r.width * 0.11, vz = r.width * 0.2;
    setT('left', dx < -dz && Math.abs(dx) > Math.abs(dy) * 0.45);
    setT('right', dx > dz && Math.abs(dx) > Math.abs(dy) * 0.45);
    setT('up', dy < -vz && Math.abs(dy) > Math.abs(dx) * 0.45);
    setT('down', dy > vz && Math.abs(dy) > Math.abs(dx) * 0.45);
  };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); sid = e.pointerId; try { stick.setPointerCapture(sid); } catch (_) { } upd(e); audioInit(); G.lastInput = 'touch'; });
  stick.addEventListener('pointermove', e => { if (e.pointerId === sid) upd(e); });
  const end = e => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; for (const a of ['left', 'right', 'up', 'down']) setT(a, false); };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end); stick.addEventListener('lostpointercapture', end);
  for (const [id, a] of [['bJump', 'jump'], ['bDash', 'dash'], ['bFire', 'fire']]) {
    const b = document.getElementById(id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { } setT(a, true); b.classList.add('on'); audioInit(); G.lastInput = 'touch'; });
    const up = () => { setT(a, false); b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
  bPause.addEventListener('pointerdown', e => { e.preventDefault(); latch.pause = true; audioInit(); });
}
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let p = null; for (const q of pads) if (q) { p = q; break; }
  if (!p) return;
  const b = i => p.buttons[i] && p.buttons[i].pressed, ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  const st = { left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), up: ay < -0.5 || b(12), down: ay > 0.5 || b(13), jump: b(0) || b(3), fire: b(2) || b(1) || b(7), dash: b(5) || b(4) || b(6), pause: b(9) };
  const lx = p.axes[2] || 0, ly = p.axes[3] || 0;
  G.padLookX = Math.abs(lx) > 0.18 ? lx : 0; G.padLookY = Math.abs(ly) > 0.18 ? ly : 0;
  if (G.padLookY) G.lookIdle = 0;
  let any = false;
  for (const a in st) { if (st[a] && !gp[a]) latch[a] = true; gp[a] = !!st[a]; any = any || st[a]; }
  if (any) G.lastInput = 'pad';
}
function readInput() {
  const h = {}, p = {};
  for (const a of ACTS) { h[a] = !!(kb[a] || tc[a] || gp[a]); p[a] = !!(latch[a] || (h[a] && !prev[a])); latch[a] = false; prev[a] = h[a]; }
  return { left: h.left, right: h.right, up: h.up, down: h.down, jump: h.jump, dash: h.dash, fire: h.fire || G.mouseFire, jumpPressed: p.jump, dashPressed: p.dash, P: p };
}
const btn = a => {
  const m = G.lastInput;
  if (a === 'jump') return m === 'touch' ? 'JUMP' : m === 'pad' ? 'A' : 'Z';
  if (a === 'dash') return m === 'touch' ? 'DASH' : m === 'pad' ? 'RB' : 'Shift';
  if (a === 'fire') return m === 'touch' ? 'FIRE' : m === 'pad' ? 'X' : 'X';
  if (a === 'pause') return m === 'touch' ? '❚❚' : m === 'pad' ? 'START' : 'ESC';
  return a;
};
cv.addEventListener('pointerdown', e => {
  audioInit();
  const r = cv.getBoundingClientRect();
  G.click = { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH };
  if (e.pointerType === 'touch') { G.lastInput = 'touch'; if (!G.touch) { G.touch = true; layout(); } }
  if (G.scene === 'play' && !G.overlay && e.pointerType === 'mouse') {
    G.mouseFire = true;
    if (G.mode === 'fp' && document.pointerLockElement !== cv && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (_) { } }
  }
  if (G.scene === 'play' && G.mode === 'fp' && e.pointerType !== 'mouse') { G.dragId = e.pointerId; G.dragX = e.clientX; G.dragY = e.clientY; }
});
cv.addEventListener('pointermove', e => {
  if (G.mode !== 'fp' || G.scene !== 'play' || G.overlay) return;
  const r = cv.getBoundingClientRect(), k = VW / r.width;
  if (e.pointerType === 'mouse') {
    if (document.pointerLockElement === cv || (e.buttons & 1)) { G.lookDX = (G.lookDX || 0) + (e.movementX || 0) * 0.0042; G.lookDY = (G.lookDY || 0) + (e.movementY || 0) * 0.0032; G.lookIdle = 0; }
  } else if (e.pointerId === G.dragId) {
    G.lookDX = (G.lookDX || 0) + (e.clientX - G.dragX) * k * 0.012; G.lookDY = (G.lookDY || 0) + (e.clientY - G.dragY) * k * 0.009;
    G.dragX = e.clientX; G.dragY = e.clientY; G.lookIdle = 0;
  }
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === cv && G.mode === 'fp' && e.target !== cv) { G.lookDX = (G.lookDX || 0) + (e.movementX || 0) * 0.0042; G.lookDY = (G.lookDY || 0) + (e.movementY || 0) * 0.0032; G.lookIdle = 0; }
});
cv.addEventListener('pointerup', e => { if (e.pointerId === G.dragId) G.dragId = null; });
cv.addEventListener('pointercancel', e => { if (e.pointerId === G.dragId) G.dragId = null; });
function releaseLock() { try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (_) { } }
addEventListener('pointerup', () => { G.mouseFire = false; });
addEventListener('touchstart', () => { if (!G.touch) { G.touch = true; G.lastInput = 'touch'; layout(); } }, { passive: true });

// ---------- layout ----------
function layout() {
  const W = innerWidth, H = innerHeight;
  const portrait = G.touch && H > W * 1.05;
  app.classList.toggle('portrait', portrait);
  app.classList.toggle('touch', G.touch);
  touchEl.hidden = !G.touch; bPause.hidden = !G.touch;
  stage.style.height = '';
  let cw, ch;
  const r = stage.getBoundingClientRect();
  if (portrait) { cw = r.width; ch = cw * VH / VW; stage.style.height = ch + 'px'; }
  else { const s = Math.min(r.width / VW, r.height / VH); cw = VW * s; ch = VH * s; }
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  const dpr = Math.min(3, devicePixelRatio || 1);
  cv.width = Math.max(VW, Math.round(cw * dpr)); cv.height = Math.max(VH, Math.round(ch * dpr));
  S = cv.width / VW;
}
addEventListener('resize', layout);

// ---------- stage lifecycle ----------
function startStage(w, i) {
  const arena = i === 3;
  const L = arena ? buildArena(w) : buildLevel(w, i);
  prerender(L);
  L.onBreak = (tx, ty) => { sfx('break'); shake(G, 3); burst(G, tx * 16 + 8, ty * 16 + 8, 10, THEMES[G.world].body, 120, 500); burst(G, tx * 16 + 8, ty * 16 + 8, 4, THEMES[G.world].topHi, 80, 500); };
  if (!G.bgs[w]) G.bgs[w] = makeBG(w);
  Object.assign(G, {
    scene: 'play', overlay: null, world: w, idx: i, L, ents: spawnEntities(L), projs: [], parts: [], trail: [], hp: MAXHP, inv: 0, pstate: 'alive', pt: 0,
    embers: 0, starsGot: [false, false, false], time: 0, deaths: 0, boss: arena ? makeBoss(w) : null, shake: 0, hitstop: 0, flash: 0,
    banner: 3.2, toast: null, wind: 0, darkBoost: 0, results: null, lavaRise: 0,
  });
  G.yaw = 0; G.pitch = 0; G.mode = 'side'; G.bolts = []; G.fpTurn = 0; G.fpFace = 1; G.fpCD = 0; G.fpSeen = false; G.weapon = 'N'; G.fireCD = 0; G.aim = [1, 0]; G.runT = 3; G.podT = 6; G.escape = null; G.muzzle = 0;
  G.podPlan = arena ? [] : planPods(L, w * 31 + i * 7 + 5);
  G.lanes = null; G.laneSeen = false;
  if (L.fpZones.length) {
    const r = buildLanes(L, w * 977 + i * 31 + 1); G.lanes = r.lanes;
    for (const d of r.extra) { const e = d.type === 'wpn' ? { type: 'wpn', x: d.x, y: d.y, w: 12, h: 10, vx: 0, vy: 0, letter: d.letter, t: 0, life: 1e9 } : makeEnt(d); if (e) { e.lane = d.lane; G.ents.push(e); } }
  }
  if (i === 0 && !(SAVE.brief || {})[w]) { G.overlay = 'brief'; G.overlayT = 0.6; }
  G.embersTotal = G.ents.filter(e => e.type === 'ember').length;
  const rec = SAVE.lv[w + '-' + i];
  G.prevStars = rec ? rec.stars.slice() : [false, false, false];
  G.P = newPlayer(L.start.x, L.start.y); G.P.sx = 1; G.P.sy = 1;
  G.checkpoint = { x: L.start.x, y: L.start.y }; G.safe = { x: L.start.x, y: L.start.y };
  G.ab = abilitiesFor(Math.min(4, Math.max(w, Math.floor(SAVE.unlocked / 4))));
  G.camX = 0; G.camLook = 0; G.lastCam = 0;
  initAmbient(); G.fade = 1;
  playSong(arena ? (w === 4 ? 'final' : 'boss') : 'w' + w);
}
function respawn() {
  if (G.idx === 3) {
    const d = G.deaths, t = G.time, ob = G.boss;
    startStage(G.world, 3); G.deaths = d; G.time = t; G.banner = 0; G.inv = 1.5;
    if (ob.dead) { G.boss.hp = 0; G.boss.dead = true; G.boss.dying = 0.01; }
    else if (ob.hp < G.boss.maxHp) { G.boss.hp = ob.hp; if (G.boss.enableLava && ob.hp <= 2) G.boss.enableLava(G); G.toast = { text: 'The guardian is still wounded', t: 2.5 }; }
    return;
  }
  G.bolts = []; G.weapon = 'N'; if (G.mode === 'fp') { G.mode = 'side'; releaseLock(); }
  const P = newPlayer(G.checkpoint.x, G.checkpoint.y); P.sx = 1; P.sy = 1;
  G.P = P; G.hp = MAXHP; G.inv = 1.0; G.pstate = 'alive'; G.projs = []; G.safe = { x: P.x, y: P.y };
}
function die() {
  if (G.pstate !== 'alive') return;
  G.pstate = 'dead'; G.pt = 1.3; G.hp = 0; G.deaths++; SAVE.deaths++;
  sfx('die'); shake(G, 6); G.hitstop = 6;
  for (let i = 0; i < 18; i++) G.parts.push(part(G.P.x + 5, G.P.y + 4, (Math.random() - 0.5) * 60, -30 - Math.random() * 60, 1 + Math.random(), '#3a3530', 3));
}
function hurtPlayer(srcX) {
  if (G.inv > 0 || G.pstate !== 'alive') return;
  const P = G.P;
  G.hp--; G.inv = 1.7; G.hurtT = 0.45; P.dashT = 0; P.gliding = false;
  const d = (P.x + 5 < srcX) ? -1 : 1;
  P.vx = d * 170; P.vy = -260; P.onGround = false;
  shake(G, 5); G.hitstop = 5; sfx('hurt');
  burst(G, P.x + 5, P.y - 4, 10, '#f3e6c8', 90, 300);
  if (G.hp <= 0) die();
}
function hazardHurt(kind) {
  if (G.pstate !== 'alive') return;
  const P = G.P;
  if (G.inv <= 0 || kind === 2) {
    G.hp--; sfx('hurt'); shake(G, 5);
    if (G.hp <= 0) { die(); return; }
  }
  for (let i = 0; i < 12; i++) G.parts.push(part(P.x + 5, P.y + 6, (Math.random() - 0.5) * 80, -Math.random() * 80, 0.6, '#57504a', 3));
  G.pstate = 'warp'; G.pt = 0.5;
}
function bossHit(stomp = true) {
  const B = G.boss, P = G.P;
  B.hp--; B.flash = 0.6; G.hitstop = 9; shake(G, 9); sfx('bosshit'); G.flash = 0.12;
  const bc = B.weak ? B.weak.x + B.weak.w / 2 : 240;
  if (stomp) { P.dashT = 0; P.vy = -400; P.vx = (P.x + 5 < bc ? -1 : 1) * 150; P.jumping = true; P.canDJ = G.ab.dj; P.dashAvail = true; P.glideArmed = false; P.onGround = false; burst(G, P.x + 5, P.y + 10, 20, '#ffd27a', 160, 0, true); }
  B.weak = null; G.inv = Math.max(G.inv, 0.7);
  if (B.hp <= 0) { B.dead = true; B.dying = 2.4; B.hits = []; sfx('boom'); G.projs = []; for (const h of (B.hands || [])) h.st = 'idle'; }
  else {
    B.onHit(G);
    if (G.hp < MAXHP) G.ents.push({ type: 'heart', x: 120 + Math.random() * 240, y: 196, oy: 196, t: 0 });
  }
}

// ---------- FX hooks for physics ----------
const FX = {
  jump(P) { sfx('jump'); P.sy = 1.3; P.sx = 0.75; dustAt(P.x + 5, P.y + 14, 4); },
  dj(P) { sfx('dj'); P.sy = 1.35; P.sx = 0.7; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; G.parts.push(part(P.x + 5, P.y + 13, Math.cos(a) * 70, Math.sin(a) * 18 + 30, 0.35, '#ffcf6a', 1, 0, true)); } },
  dash(P) { sfx('dash'); shake(G, 2); for (let i = 0; i < 8; i++) G.parts.push(part(P.x + 5, P.y + 7, -P.dashVX * 0.2 + (Math.random() - 0.5) * 60, -P.dashVY * 0.2 + (Math.random() - 0.5) * 60, 0.3, '#ff9a3a', 2, 0, true)); },
  land(P, v) { if (v > 200) { sfx('land'); P.sy = 0.7; P.sx = 1.3; dustAt(P.x + 5, P.y + 14, v > 380 ? 8 : 4); } },
  wallJump(P) { sfx('wall'); P.sy = 1.2; P.sx = 0.8; dustAt(P.x + (P.face > 0 ? 0 : 10), P.y + 8, 5); },
  spring(P, s) { sfx('spring'); P.sy = 1.45; P.sx = 0.65; },
};
function dustAt(x, y, n) { for (let i = 0; i < n; i++) G.parts.push(part(x + (Math.random() - 0.5) * 8, y, (Math.random() - 0.5) * 70, -Math.random() * 40, 0.35 + Math.random() * 0.2, '#cfc6b8', 1)); }

// ---------- overlap ----------
function overlapRect(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function hitShape(s, box) {
  if (s.w !== undefined) {
    const r = s.cx !== undefined ? s : (s.kind ? { x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h } : s);
    return overlapRect(r, box);
  }
  const cx = s.cx !== undefined ? s.cx : s.x, cy = s.cy !== undefined ? s.cy : s.y;
  const nx = clamp(cx, box.x, box.x + box.w), ny = clamp(cy, box.y, box.y + box.h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < s.r * s.r;
}

// ---------- play update ----------
function updatePlay(dt, inp) {
  const L = G.L, P = G.P;
  if (G.hitstop > 0) { G.hitstop--; return; }
  if (G.pstate === 'alive' || G.pstate === 'goal') G.time += G.pstate === 'alive' ? dt : 0;
  if (G.banner > 0) G.banner -= dt;
  if (G.toast) { G.toast.t -= dt; if (G.toast.t <= 0) G.toast = null; }
  if (G.flash > 0) G.flash -= dt;
  if (G.inv > 0) G.inv -= dt;
  if (G.hurtT > 0) G.hurtT -= dt;
  G.shake = Math.max(0, G.shake - dt * 30);
  // platforms
  for (const p of L.plats) {
    p.ox = p.x; p.oy = p.y; p.t += dt;
    if (p.kind === 'h') p.x = p.x0 + Math.sin(p.t * 1.1) * p.range;
    else if (p.kind === 'v') p.y = p.y0 - (1 - Math.cos(p.t * 0.9)) / 2 * p.range;
    else {
      if (p.st === 0 && P.plat === p) { p.st = 1; p.ft = 0.6; sfx('crumble'); }
      else if (p.st === 1) { p.ft -= dt; if (p.ft <= 0) { p.st = 2; p.fv = 0; } }
      else if (p.st === 2) { p.fv += 900 * dt; p.y += p.fv * dt; if (p.y > L.h * 16) { p.gone = true; p.st = 3; p.ft = 2.4; } }
      else if (p.st === 3) { p.ft -= dt; if (p.ft <= 0) { p.gone = false; p.st = 0; p.x = p.x0; p.y = p.y0; p.ox = p.x; p.oy = p.y; } }
    }
    p.vx = (p.x - p.ox) / dt; p.vy = (p.y - p.oy) / dt;
  }
  // crumble tiles
  for (const [k, c] of L.crumble) {
    c.t -= dt;
    if (c.s === 1 && c.t <= 0) { c.s = 2; c.t = 3; const tx = k % L.w, ty = Math.floor(k / L.w); burst(G, tx * 16 + 8, ty * 16 + 8, 6, THEMES[G.world].top, 50, 400); }
    else if (c.s === 2 && c.t <= 0) {
      const tx = k % L.w, ty = Math.floor(k / L.w);
      if (!overlapRect({ x: P.x, y: P.y, w: PH.pw, h: PH.ph }, { x: tx * 16, y: ty * 16, w: 16, h: 16 })) L.crumble.delete(k);
    }
  }
  for (const s of L.springs) if (s.t > 0) s.t -= dt;
  // player
  G.wind = 0;
  if (G.boss && !G.boss.dead) G.boss.update(dt * 0.78, G);
  if (G.pstate === 'alive') {
    if (P.plat && !P.plat.gone) { P.x += P.plat.x - P.plat.ox; P.y += P.plat.y - P.plat.oy; }
    if (G.wind && P.dashT <= 0) P.vx += G.wind * dt;
    let pin = inp;
    P.crouch = !!(inp.down && P.onGround && !inp.left && !inp.right && !inp.jumpPressed && P.dashT <= 0);
    if (G.mode === 'fp') {
      P.crouch = false;
      G.lookIdle = (G.lookIdle || 0) + dt;
      const mv = fpControl(P, inp, dt);
      pin = Object.assign({}, inp, { left: mv.left, right: mv.right, up: false, down: false });
    }
    G.aim = aimVec(inp, P);
    if (P.crouch && G.mode !== 'fp') G.aim = [P.face, 0];
    G.fireCD -= dt;
    if (inp.fire && G.fireCD <= 0) { fireWeapon(); G.fireCD = (WEAPONS[G.weapon] || WEAPONS.N).rate; }
    const PL = laneL(P.lane || 0) || L;
    const res = stepPlayer(P, pin, PL, dt, G.ab, FX);
    if (G.mode !== 'fp') G.fpFace = P.face;
    const want = fpZoneAt(L, P.x + 5) ? 'fp' : 'side';
    if (want !== G.mode) {
      G.mode = want; G.fade = 0.7; G.fpFace = P.face; G.fpTurn = 0; P.z = 0; P.vz = 0; P.lane = 0; sfx('portal'); setFireLabel(want === 'fp');
      if (want === 'fp') { G.yaw = P.face > 0 ? 0 : Math.PI; G.pitch = 0; } else { P.face = Math.cos(G.yaw) >= 0 ? 1 : -1; releaseLock(); }
      if (want === 'side') G.camX = clamp(P.x + 5 - VW / 2 + P.face * 34, 0, L.w * 16 - VW);
      if (want === 'fp' && !G.fpSeen) { G.fpSeen = true; G.toast = { text: fpHint(), t: 4.5 }; }
    }
    if (P.onGround) {
      const ty = Math.floor((P.y + PH.ph + 1) / 16);
      for (let tx = Math.floor(P.x / 16); tx <= Math.floor((P.x + PH.pw - 0.01) / 16); tx++) {
        const k = ty * L.w + tx;
        if (tileAt(PL, tx, ty) === T.CRUMBLE && !PL.crumble.has(k)) { PL.crumble.set(k, { s: 1, t: 0.6 }); sfx('crumble'); }
      }
      // safe spot
      if (!P.plat && P.dashT <= 0) {
        const ok = [P.x + 1, P.x + PH.pw - 1].every(x => { const t = tileAt(PL, Math.floor(x / 16), ty); return t === T.SOLID || t === T.ICE || t === T.ONEWAY; })
          && !hazardHit(PL, P.x - 14, P.y - 6, PH.pw + 28, PH.ph + 12);
        if (ok) G.safe = { x: P.x, y: P.y, lane: P.lane || 0 };
      }
    }
    if (res) hazardHurt(res);
    // trail & particles
    if (P.dashT > 0) G.trail.push({ x: P.x, y: P.y, a: 0.7, face: P.face });
    if (P.sliding && Math.random() < 0.5) G.parts.push(part(P.x + (P.wall > 0 ? 10 : 0), P.y + 10, -P.wall * 20, -10, 0.3, '#cfc6b8', 1));
    if (P.gliding && Math.random() < 0.4) G.parts.push(part(P.x + 5 + (Math.random() - 0.5) * 16, P.y - 8, (Math.random() - 0.5) * 20, 30, 0.6, '#ffb84a', 1, 0, true));
    if (P.inDraft && Math.random() < 0.3) G.parts.push(part(P.x + 5, P.y + 14, 0, -60, 0.4, '#ffd9a0', 1));
  } else if (G.pstate === 'warp') {
    G.pt -= dt;
    if (G.pt <= 0) {
      Object.assign(P, { x: G.safe.x, y: G.safe.y, vx: 0, vy: 0, dashT: 0, gliding: false, plat: null, onGround: true, wallLock: 0, lane: G.safe.lane || 0, z: (G.safe.lane || 0) * LW, vz: 0 });
      G.pstate = 'alive'; G.inv = Math.max(G.inv, 1.0);
      burst(G, P.x + 5, P.y + 7, 12, '#ffcf6a', 60, 0, true);
    }
  } else if (G.pstate === 'dead') {
    G.pt -= dt; if (G.pt <= 0) respawn();
  } else if (G.pstate === 'goal') {
    G.pt -= dt;
    const ge = G.goalEnt;
    if (ge && !ge.lit) { if (Math.floor(G.pt * 6) !== Math.floor((G.pt + dt) * 6)) sfx('beep'); if (G.pt < 1.5) blowShrine(ge); }
    if (ge) { ge.litT = (ge.litT || 0) + dt; }
    P.vx *= 0.9; P.vy = Math.min(P.vy + 1200 * dt, 300);
    stepPlayer(P, {}, L, dt, G.ab, null);
    if (G.pt <= 0 && !G.overlay) finishStage();
  }
  P.sx += (1 - P.sx) * Math.min(1, 12 * dt); P.sy += (1 - P.sy) * Math.min(1, 12 * dt);
  for (const t of G.trail) t.a -= dt * 3;
  G.trail = G.trail.filter(t => t.a > 0);

  // entities
  const pbox = { x: P.x + 1, y: P.y + 1, w: PH.pw - 2, h: PH.ph - 2 };
  const alive = G.pstate === 'alive';
  G.signText = null;
  for (const e of G.ents) {
    if (e.dead) continue;
    if (Math.abs(e.x - P.x) > 520 && e.type !== 'stal') { if (e.type !== 'moth') continue; }
    const el = e.lane || 0;
    if (el) { const sv = G.L; G.L = laneL(el) || sv; updateEnt(e, dt, G); G.L = sv; } else updateEnt(e, dt, G);
    if (!alive) continue;
    if (el !== (P.lane || 0)) continue;
    switch (e.type) {
      case 'ember': {
        const dx = P.x + 5 - e.x, dy = P.y + 7 - e.y, d = Math.hypot(dx, dy);
        if (d < 30) { e.x += dx / d * 140 * dt; e.oy += dy / d * 140 * dt; }
        if (d < 10) { e.dead = true; G.embers++; sfx('ember'); for (let i = 0; i < 5; i++) G.parts.push(part(e.x, e.y, (Math.random() - 0.5) * 60, -Math.random() * 60, 0.4, '#ffd36a', 1, 0, true)); }
        break;
      }
      case 'heart':
        if (Math.hypot(P.x + 5 - e.x, P.y + 7 - e.y) < 12 && G.hp < MAXHP) { e.dead = true; G.hp++; sfx('heart'); burst(G, e.x, e.y, 10, '#fff4dc', 60, 0, true); }
        break;
      case 'star':
        if (Math.hypot(P.x + 5 - e.x, P.y + 7 - e.y) < 14) {
          e.dead = true; G.starsGot[e.i] = true; sfx('star'); G.flash = 0.08;
          burst(G, e.x, e.y, 24, '#ffe27a', 140, 0, true);
          const n = G.starsGot.filter(Boolean).length;
          G.toast = { text: `Mixtape ${n} of 3`, t: 2.2 };
        }
        break;
      case 'check':
        if (!e.lit && Math.abs(P.x + 5 - e.x) < 14 && Math.abs(P.y + 7 - (e.y - 12)) < 22) {
          e.lit = true; G.checkpoint = { x: e.x - 5, y: e.y - PH.ph }; G.hp = MAXHP; sfx('check');
          burst(G, e.x, e.y - 28, 16, '#ffcf6a', 90, 0, true); G.toast = { text: 'Checkpoint · health restored', t: 1.8 };
        }
        break;
      case 'beacon':
        if (!e.lit && !e.planted && Math.abs(P.x + 5 - e.x) < 16 && P.y + PH.ph > e.y - 30) startGoal(e);
        break;
      case 'wpn':
        if (overlapRect(pbox, e)) { e.dead = true; G.weapon = e.letter; sfx('powerup'); G.toast = { text: WEAPONS[e.letter].name.toUpperCase() + '!', t: 1.6 }; burst(G, e.x + 6, e.y + 5, 14, WCOL[e.letter], 90, 0, true); }
        break;
      case 'pod': break;
      case 'sign':
        if (Math.abs(P.x + 5 - e.x) < 64 && G.L.tutorial !== undefined) G.signText = tutorialText(G.L.tutorial);
        break;
      case 'stal':
        if ((e.st === 'fall' || e.st === 'hang' || e.st === 'shake') && overlapRect(pbox, { x: e.x + 2, y: e.y, w: e.w - 4, h: e.h - 2 })) hurtPlayer(e.x + 5);
        break;
      default:
        if (e.enemy && overlapRect(pbox, e)) {
          const prevB = P.y + PH.ph - P.vy * dt;
          if (P.dashT > 0) killEnemy(e, false);
          else if (P.vy > 0 && prevB <= e.y + 11) {
            if (e.stomp) { killEnemy(e, true); P.vy = inp.jump ? -430 : -280; P.jumping = true; P.canDJ = G.ab.dj; P.dashAvail = true; P.glideArmed = false; P.sy = 1.3; P.sx = 0.8; }
            else { P.vy = -300; hurtPlayer(e.x + e.w / 2); }
          } else hurtPlayer(e.x + e.w / 2);
        }
    }
  }
  if (G.ents.length > 50 && Math.random() < 0.02) G.ents = G.ents.filter(e => !e.dead);

  updateBolts(dt);
  if (G.pstate === 'alive') spawnersUpdate(dt);
  updateEscape(dt);
  // projectiles
  for (const p of G.projs) {
    const pdt = G.boss ? dt * 0.78 : dt;
    if (p.delay > 0) { p.delay -= pdt; continue; }
    p.vy += (p.g || 0) * pdt; p.x += p.vx * pdt; p.y += p.vy * pdt; p.life -= pdt;
    if (p.kind === 'smoke') {
      const dx = P.x + 5 - p.x, dy = P.y + 7 - p.y, d = Math.hypot(dx, dy) || 1, sp = 75 + 12 * (G.boss ? G.boss.maxHp - G.boss.hp : 0);
      p.vx += (dx / d * sp - p.vx) * 1.6 * pdt; p.vy += (dy / d * sp - p.vy) * 1.6 * pdt;
    }
    if (p.kind === 'gear') p.rot = (p.rot || 0) + p.vx * dt * 0.15;
    const PLp = laneL(p.lane || 0) || L;
    if (p.solid) {
      const below = isSolidT(PLp, Math.floor(p.x / 16), Math.floor((p.y + p.r) / 16));
      const side = isSolidT(PLp, Math.floor((p.x + Math.sign(p.vx) * p.r) / 16), Math.floor(p.y / 16));
      if (p.kind === 'gear') {
        if (below && p.vy > 0) { p.y = Math.floor((p.y + p.r) / 16) * 16 - p.r; if (p.bounce > 0) { p.vy = -p.vy * 0.55 - 60; p.bounce--; } else { p.vy = 0; p.g = 0; } }
        if (side) p.life = 0;
      } else if (p.kind === 'wave') { if (side) p.life = 0; }
      else if (below || side || isSolidT(PLp, Math.floor(p.x / 16), Math.floor(p.y / 16))) {
        p.life = 0;
        burst(G, p.x, p.y, 6, p.kind === 'orb' ? '#ff8a8a' : p.kind === 'seed' ? '#8a6a48' : p.kind === 'ice' ? '#e8f6ff' : p.kind === 'rock' ? '#7a7066' : '#8be3ff', 60);
      }
    }
    if (p.kind === 'dwave' && (p.x < 10 || p.x > 470)) p.life = 0;
    if (p.life > 0 && alive && (p.lane || 0) === (P.lane || 0) && hitShape(p, P.crouch ? { x: pbox.x, y: pbox.y + 7, w: pbox.w, h: pbox.h - 7 } : pbox)) {
      if (p.kind === 'smoke' && P.dashT > 0) { p.life = 0; burst(G, p.x, p.y, 10, '#2a1a2e', 80); sfx('stomp'); }
      else { hurtPlayer(p.x); if (p.kind !== 'wave' && p.kind !== 'dwave' && p.kind !== 'gear') p.life = 0; }
    }
    if (p.kind === 'wave' && Math.random() < 0.5) G.parts.push(part(p.x, FLOOR - 2, -p.vx * 0.1, -40, 0.3, THEMES[G.world].top, 2));
  }
  G.projs = G.projs.filter(p => p.life > 0 && p.y < L.h * 16 + 40);

  // boss interactions
  const B = G.boss;
  if (B) {
    if (!B.dead && alive) {
      if (B.weak && overlapRect(pbox, B.weak)) {
        const prevB = P.y + PH.ph - P.vy * dt;
        if (P.dashT > 0 || (P.vy > 0 && prevB <= B.weak.y + 10)) bossHit();
      }
      if (G.inv <= 0) for (const s of B.hits) if (hitShape(s, pbox)) { hurtPlayer(s.cx !== undefined ? s.cx : s.x + s.w / 2); break; }
    }
    if (B.dead && B.dying > 0) {
      B.dying -= dt; B.flash = 0.3;
      if (Math.random() < 0.4) { sfx('boom'); shake(G, 5); }
      const bx = B.cx || B.hx || (B.x + (B.w ? B.w / 2 : 0)), by = B.cy || B.hy || (B.y + (B.h ? B.h / 2 : 0));
      burst(G, bx + (Math.random() - 0.5) * 40, by + (Math.random() - 0.5) * 30, 6, '#ffcf6a', 140, 0, true);
      if (B.dying <= 0) {
        G.flash = 0.6; G.darkBoost = -0.1; sfx('beacon');
        G.ents.push({ type: 'beacon', x: 240, y: FLOOR, lit: false, t: 0, final: G.world === 4 });
        if (G.world === 4) {
          const Lr = G.L; for (let x = 1; x < Lr.w - 1; x++) for (let y = 14; y < 17; y++) Lr.grid[y * Lr.w + x] = T.SOLID;
          Lr.updrafts = []; Lr.lavaTops = []; prerender(Lr);
          G.toast = { text: 'The core is exposed. Plant the charge!', t: 3.5 };
        } else G.toast = { text: 'Plant a charge on the memory', t: 3 };
        playSong('');
      }
    }
  }

  // particles
  for (const q of G.parts) { q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  G.parts = G.parts.filter(q => q.life > 0);
  if (G.parts.length > 500) G.parts.splice(0, G.parts.length - 500);

  // camera
  if (L.arena) G.camX = 0;
  else {
    G.camLook += (P.face * 34 - G.camLook) * Math.min(1, 1.6 * dt);
    const target = P.x + 5 - VW / 2 + G.camLook;
    G.camX += (target - G.camX) * Math.min(1, 7 * dt);
    G.camX = clamp(G.camX, 0, L.w * 16 - VW);
  }
  updateAmbient(dt);
}
function killEnemy(e, stomp) {
  e.dead = true; sfx('stomp'); G.hitstop = 3;
  const col = ENEMY_COL[G.world];
  burst(G, e.x + e.w / 2, e.y + e.h / 2, 12, e.type === 'runner' ? '#5a2a50' : col.b, 100, 300);
  burst(G, e.x + e.w / 2, e.y + e.h / 2, 4, '#ff5a8a', 70, 0, true);
  burst(G, e.x + e.w / 2, e.y + e.h / 2, 5, '#ffcf6a', 60, 0, true);
}
function startGoal(e) {
  e.planted = true; G.goalEnt = e; sfx('beep');
  if (e.final) {
    G.escape = { t: 10 }; G.toast = { text: 'CHARGE PLANTED. GET OUT! Run for the exit on the left!', t: 3.5 };
    playSong('final'); return;
  }
  G.pstate = 'goal'; G.pt = 2.4; G.toast = { text: 'Charge planted. Stand back...', t: 1.2 };
  playSong('');
}
function blowShrine(e) {
  e.lit = true; sfx('bigboom'); shake(G, 14); G.flash = 0.5; G.boomT = 1; G.boomX = e.x; G.boomY = e.y - 24;
  for (let i = 0; i < 4; i++) burst(G, e.x + (Math.random() - 0.5) * 30, e.y - 24 + (Math.random() - 0.5) * 20, 18, i % 2 ? '#ffcf6a' : '#ff5a2a', 220, 200, true);
  burst(G, e.x, e.y - 24, 20, '#e8507a', 160, 300);
  G.toast = { text: 'MEMORY ERASED', t: 1.6 };
}
function updateEscape(dt) {
  const E = G.escape; if (!E || G.pstate !== 'alive') return;
  const prevT = E.t; E.t -= dt;
  if (Math.floor(prevT) !== Math.floor(E.t)) sfx('alarm');
  if (Math.random() < 0.3) { shake(G, 3); burst(G, 40 + Math.random() * 400, 30, 3, '#ff6a2a', 60, 400, true); }
  if (G.P.x < 40 || E.t <= 0) {
    G.escape = null; const ge = G.goalEnt; blowShrine(ge); G.pstate = 'goal'; G.pt = 2.2; G.flash = 1.2;
    G.toast = { text: E.t > 0 ? 'He walks out. He does not look back.' : 'Too manly to need the door.', t: 2 };
  }
}
function finishStage() {
  const w = G.world, i = G.idx, id = w + '-' + i;
  const rec = SAVE.lv[id] || { done: false, stars: [false, false, false], emb: 0, best: 0 };
  const newBest = !rec.best || G.time < rec.best;
  rec.done = true; rec.stars = rec.stars.map((s, k) => s || G.starsGot[k]); rec.emb = Math.max(rec.emb, G.embers); rec.best = newBest ? G.time : rec.best;
  SAVE.lv[id] = rec;
  const node = w * 4 + i;
  SAVE.unlocked = Math.min(20, Math.max(SAVE.unlocked, node + 1));
  SAVE.cursor = Math.min(19, node + 1);
  if (node === 19) SAVE.cleared = true;
  writeSave();
  G.results = { time: G.time, newBest, embers: G.embers, total: G.embersTotal, stars: G.starsGot.slice(), deaths: G.deaths };
  G.overlay = i === 3 ? (w === 4 ? 'endingIntro' : 'ability') : 'results'; G.overlayT = 0.7; G.menu = 0;
  if (G.overlay === 'endingIntro') { G.scene = 'ending'; G.overlay = null; G.endT = 0; playSong('end'); }
  else playSong('map');
}
function openPause() { releaseLock(); G.overlay = 'pause'; G.menu = 0; G.overlayT = 0.15; }

const TUT = [
  { kb: 'Arrows move. Z jumps. Hold X to fire: aim with ↑ and ↓, crouch with ↓. Shoot the flying pods for new guns. 3 Mixtapes hide in every mission.', touch: 'Pad moves and aims (↓ crouches). JUMP jumps, hold FIRE to shoot. Shoot the flying pods for new guns. 3 Mixtapes per mission.' },
  { kb: 'New move: SECOND WIND. Press jump again in midair to double jump.', touch: 'New move: SECOND WIND. Tap JUMP again in midair to double jump.' },
  { kb: 'New move: SMOOTH MOVE. Shift dashes in any direction, even up. Dashes smash cracked stone and memories.', touch: 'New move: SMOOTH MOVE. DASH bursts in the pad\'s direction, even up. Dashes smash cracked stone and memories.' },
  { kb: 'New move: NOTHING STOPS ME. Hold toward a wall to slide, then jump off it. Climb a single wall this way.', touch: 'New move: NOTHING STOPS ME. Push toward a wall to slide, then JUMP off it.' },
  { kb: 'New move: COOL HEAD. After a double jump, keep holding jump to glide. Hot vents lift you.', touch: 'New move: COOL HEAD. After a double jump, keep holding JUMP to glide. Hot vents lift you.' },
];
function tutorialText(w) { const t = TUT[w]; return G.lastInput === 'touch' ? t.touch : t.kb; }
const POWERS = [
  { name: 'Second Wind', desc: 'Double jump. When life knocks you down, you jump again, in midair.' },
  { name: 'Smooth Move', desc: 'Dash in any direction, even straight up. Smashes cracked stone and any memory in the way.' },
  { name: 'Nothing Stops Me', desc: 'Wall jump. Slide down walls and kick off them. Climb a single wall by kicking back and forth.' },
  { name: 'Cool Head', desc: 'Glide. After a double jump, keep holding jump to float. Ride hot vents upward.' },
];

// ---------- ambient particles ----------
function initAmbient() {
  G.amb = [];
  const n = [26, 30, 18, 70, 50][G.world];
  for (let i = 0; i < n; i++) G.amb.push(newAmb(true));
}
function newAmb(anyY) {
  const w = G.world, a = { x: Math.random() * VW, y: anyY ? Math.random() * VH : -4, t: Math.random() * 10 };
  if (w === 0) { a.vx = 0; a.vy = 0; }
  else if (w === 1) { a.vx = (Math.random() - 0.5) * 6; a.vy = -2 - Math.random() * 4; }
  else if (w === 2) { a.vx = (Math.random() - 0.5) * 20; a.vy = 30 + Math.random() * 40; }
  else if (w === 3) { a.vx = -10 - Math.random() * 15; a.vy = 25 + Math.random() * 30; a.s = Math.random() < 0.3 ? 2 : 1; }
  else { a.ember = Math.random() < 0.35; a.vx = (Math.random() - 0.5) * 10; a.vy = a.ember ? -20 - Math.random() * 30 : 15 + Math.random() * 20; if (a.ember && !anyY) a.y = VH + 4; }
  return a;
}
function updateAmbient(dt) {
  const dc = G.camX - G.lastCam; G.lastCam = G.camX;
  for (const a of G.amb) {
    a.t += dt;
    if (G.world === 0) { a.x += Math.sin(a.t * 0.7) * 8 * dt; a.y += Math.cos(a.t * 0.9) * 6 * dt; }
    a.x += (a.vx + G.wind * 0.3) * dt - dc * 0.7; a.y += a.vy * dt;
    if (a.x < -8) a.x += VW + 16; if (a.x > VW + 8) a.x -= VW + 16;
    if (a.y > VH + 6 || a.y < -10) Object.assign(a, newAmb(false));
  }
}
function drawAmbient(g) {
  const w = G.world;
  for (const a of G.amb) {
    const x = Math.round(a.x), y = Math.round(a.y);
    if (w === 0) { const on = Math.sin(a.t * 2) > -0.2; if (on) { warmGlow(g, a.x, a.y, 6, 0.35, '190,255,120'); rect(g, x, y, 1, 1, '#e8ff9a'); } }
    else if (w === 1) rect(g, x, y, 1, 1, Math.sin(a.t * 3) > 0 ? '#8be3ff' : '#c98bff');
    else if (w === 2) { if (Math.sin(a.t * 5) > 0.3) rect(g, x, y, 1, 2, '#ffcf6a'); }
    else if (w === 3) rect(g, x, y, a.s, a.s, '#ffffff');
    else rect(g, x, y, 1, 1, a.ember ? '#ff8a3a' : '#7a6e6a');
  }
}

// ---------- drawing: play ----------
const skyCache = {};
function drawSky(g, w) {
  if (!skyCache[w]) {
    const c = mkCanvas(VW, VH), s = c.getContext('2d'), th = THEMES[w];
    const gr = s.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
    s.fillStyle = gr; s.fillRect(0, 0, VW, VH);
    const R = rng(w + 1);
    if (w !== 1) for (let i = 0; i < 60; i++) rect(s, Math.floor(R() * VW), Math.floor(R() * 150), 1, 1, `rgba(255,255,255,${0.2 + R() * 0.5})`);
    if (w === 0) { circ(s, 380, 52, 18, '#e8f0d8'); circ(s, 386, 48, 16, th.sky[0] + '00'); circ(s, 374, 46, 3, '#cfd8c0'); circ(s, 384, 60, 2, '#cfd8c0'); }
    if (w === 2) { const sg = s.createRadialGradient(330, 210, 0, 330, 210, 120); sg.addColorStop(0, 'rgba(255,190,90,0.7)'); sg.addColorStop(1, 'rgba(255,120,40,0)'); s.fillStyle = sg; s.fillRect(0, 0, VW, VH); circ(s, 330, 205, 26, '#ffcf7a'); }
    if (w === 4) { const sg = s.createLinearGradient(0, 150, 0, VH); sg.addColorStop(0, 'rgba(255,70,20,0)'); sg.addColorStop(1, 'rgba(255,70,20,0.35)'); s.fillStyle = sg; s.fillRect(0, 150, VW, VH - 150); }
    skyCache[w] = c;
  }
  g.drawImage(skyCache[w], 0, 0);
  if (w === 3) {
    g.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 3; b++) {
      g.fillStyle = b === 1 ? 'rgba(120,255,200,0.06)' : 'rgba(90,200,255,0.05)';
      for (let x = 0; x < VW; x += 4) { const y = 40 + b * 18 + Math.sin(x * 0.012 + G.t * 0.4 + b) * 16 + Math.sin(x * 0.03 - G.t * 0.7) * 6; g.fillRect(x, y, 4, 30 + Math.sin(x * 0.02 + b) * 10); }
    }
    g.globalCompositeOperation = 'source-over';
  }
}
function drawBG(g, w, cam) {
  const bg = G.bgs[w] || (G.bgs[w] = makeBG(w));
  drawSky(g, w);
  const fo = -(((cam * 0.15) % 1024) + 1024) % 1024;
  g.drawImage(bg.far, Math.round(fo), 0); g.drawImage(bg.far, Math.round(fo) + 1024, 0);
  if (w === 2) {
    const gears = [[120, 120, 60, 1], [420, 90, 44, -1.4], [700, 150, 70, 0.8], [930, 80, 40, -1.6]];
    for (const [gx, gy, r, sp] of gears) {
      const x = ((gx - cam * 0.28) % 1024 + 1024) % 1024 - 60;
      drawGearShape(g, x, gy, r, G.t * sp * 0.3, '#2e1c11');
    }
  }
  const mo = -(((cam * 0.4) % 1024) + 1024) % 1024;
  g.drawImage(bg.mid, Math.round(mo), 0); g.drawImage(bg.mid, Math.round(mo) + 1024, 0);
}
function drawGearShape(g, x, y, r, rot, c) {
  g.fillStyle = c; g.beginPath();
  const n = Math.max(8, Math.floor(r / 5));
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rr = i % 2 ? r : r - 6; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  g.globalCompositeOperation = 'destination-out'; circ(g, x, y, r * 0.3, '#000'); g.globalCompositeOperation = 'source-over';
}
function drawPlayer(g) {
  const P = G.P;
  if (G.pstate === 'warp') return;
  if (G.pstate === 'dead' && G.pt < 0.9) return;
  const blink = G.inv > 0 && G.pstate === 'alive' && Math.floor(G.inv * 16) % 2;
  for (const t of G.trail) { g.globalAlpha = t.a * 0.6; rect(g, Math.round(t.x), Math.round(t.y + 2), 10, 12, '#ff9a3a'); }
  g.globalAlpha = 1;
  if (blink) return;
  const hp = Math.max(1, G.hp), bodyH = 6 + Math.round(hp / MAXHP * 6);
  const fx = Math.round(P.x + 5), fy = Math.round(P.y + PH.ph);
  g.save(); g.translate(fx, fy); g.scale(P.sx, P.sy);
  const run = P.onGround && Math.abs(P.vx) > 20, st = Math.floor(G.t * 12) % 2;
  rect(g, -4, -2 - (run && st ? 1 : 0), 3, 2, '#c9b48c'); rect(g, 1, -2 - (run && !st ? 1 : 0), 3, 2, '#c9b48c');
  const top = -2 - bodyH;
  rect(g, -5, top, 10, bodyH, '#f3e6c8'); rect(g, 2, top + 1, 3, bodyH - 1, '#dccaa2'); rect(g, -5, top, 10, 1, '#fffaf0');
  rect(g, -4, top + 1, 1, 3, '#fffaf0'); rect(g, 3, top + 1, 1, 2 + Math.round(hp / 2), '#e9d9b4');
  const ex = P.face, bl = (G.t % 3.4) < 0.09 || G.pstate === 'dead';
  const ey = top + 3;
  rect(g, -3 + ex, ey, 1, bl ? 1 : 2, '#2a1d14'); rect(g, 1 + ex, ey, 1, bl ? 1 : 2, '#2a1d14');
  if (P.dashT > 0 || G.inv > 0.9) { rect(g, -4 + ex, ey + 3, 1, 1, '#f2a090'); rect(g, 3 + ex, ey + 3, 1, 1, '#f2a090'); }
  rect(g, 0, top - 2, 1, 2, '#3a2a1c');
  g.restore();
  const flameY = fy - (2 + bodyH) * P.sy - 2;
  if (G.pstate === 'dead') { if (Math.random() < 0.3) G.parts.push(part(fx, flameY, (Math.random() - 0.5) * 10, -30, 0.8, '#5a524a', 2)); return; }
  const lean = clamp(-P.vx / 320, -0.6, 0.6);
  if (P.gliding) {
    g.fillStyle = 'rgba(255,170,70,0.9)'; g.beginPath(); g.ellipse(fx, flameY - 10, 12, 5, 0, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(255,230,140,0.9)'; g.beginPath(); g.ellipse(fx, flameY - 10, 7, 3, 0, Math.PI, 0); g.fill();
    g.strokeStyle = 'rgba(255,180,90,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(fx - 11, flameY - 10); g.lineTo(fx, flameY); g.lineTo(fx + 11, flameY - 10); g.stroke();
    drawFlame(g, fx, flameY, 0.6, G.t, 0);
  } else drawFlame(g, fx, flameY, 0.7 + hp / MAXHP * 0.33 + (P.dashT > 0 ? 0.35 : 0), G.t, lean);
}
function drawProj(g, p) {
  if (p.delay > 0) {
    const a = 0.4 + Math.sin(G.t * 20) * 0.3;
    g.fillStyle = `rgba(255,220,120,${a})`; g.beginPath(); g.moveTo(p.x - 5, 18); g.lineTo(p.x + 5, 18); g.lineTo(p.x, 26); g.fill();
    return;
  }
  const x = p.x, y = p.y;
  switch (p.kind) {
    case 'orb': circ(g, x, y, p.r + 1, '#5a1420'); circ(g, x, y, p.r, '#e04a4a'); circ(g, x - 1, y - 1, 1.5, '#ffd0c0'); break;
    case 'seed': circ(g, x, y, p.r, '#6b4a2a'); g.fillStyle = '#cdb68a'; for (let i = 0; i < 4; i++) { const a = G.t * 8 + i * Math.PI / 2; g.fillRect(x + Math.cos(a) * 5 - 1, y + Math.sin(a) * 5 - 1, 2, 2); } break;
    case 'gear': drawGearShape(g, x, y, p.r + 2, p.rot || 0, '#c79a4a'); circ(g, x, y, 2, '#5a4630'); break;
    case 'wave': { const c = THEMES[G.world].accent; g.globalAlpha = 0.85; g.fillStyle = c; g.beginPath(); g.moveTo(x - 8, FLOOR); g.quadraticCurveTo(x, FLOOR - 22, x + 8, FLOOR); g.fill(); g.globalAlpha = 1; break; }
    case 'ice': case 'shard': { g.fillStyle = p.kind === 'ice' ? '#e8f6ff' : '#8be3ff'; g.beginPath(); g.moveTo(x - 3, y - 5); g.lineTo(x + 3, y - 5); g.lineTo(x, y + 6); g.fill(); break; }
    case 'rock': circ(g, x, y, p.r, '#6e655c'); circ(g, x - 2, y - 2, 2, '#8e857a'); break;
    case 'smoke': circ(g, x, y, p.r + 2, '#1a0f1c'); circ(g, x, y, p.r, '#0b060d'); rect(g, Math.round(x - 3), Math.round(y - 1), 2, 1, '#e8e0ff'); rect(g, Math.round(x + 1), Math.round(y - 1), 2, 1, '#e8e0ff'); break;
    case 'dwave': {
      for (let i = 0; i < 6; i++) circ(g, x + Math.sin(G.t * 10 + i) * 3, y + p.h / 2 - i * 5, 9 - i * 0.6, i % 2 ? '#120a14' : '#1d1222');
      break;
    }
  }
}
function drawPlay(g) {
  const L = G.L, th = THEMES[G.world];
  const sx = G.shake > 0 ? (Math.random() * 2 - 1) * G.shake : 0, sy = G.shake > 0 ? (Math.random() * 2 - 1) * G.shake * 0.6 : 0;
  const cam = Math.round(G.camX);
  drawBG(g, G.world, cam);
  g.save(); g.translate(-cam + Math.round(sx), Math.round(sy));
  // tiles
  const srcX = clamp(cam, 0, L.canvas.width - VW);
  g.drawImage(L.canvas, srcX, 0, VW, VH, srcX, 0, VW, VH);
  const tx0 = Math.max(0, Math.floor(cam / 16) - 1), tx1 = Math.min(L.w - 1, tx0 + 32);
  for (let ty = 0; ty < L.h; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = L.grid[ty * L.w + tx], px = tx * 16, py = ty * 16;
    if (t === T.CRUMBLE) {
      const c = L.crumble.get(ty * L.w + tx);
      if (c && c.s === 2) continue;
      const j = c && c.s === 1 ? Math.round(Math.random() * 2 - 1) : 0;
      rect(g, px + j, py, 16, 10, th.plat); rect(g, px + j, py, 16, 1, th.platHi); rect(g, px + j + 5, py + 1, 1, 8, th.edge); rect(g, px + j + 11, py + 2, 1, 6, th.edge); rect(g, px + j, py + 10, 16, 2, th.edge);
    } else if (t === T.BREAK) {
      if (L.broken.has(ty * L.w + tx)) continue;
      rect(g, px, py, 16, 16, th.body); rect(g, px + 1, py + 1, 14, 14, th.deep);
      g.strokeStyle = th.topHi; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 3, py + 2); g.lineTo(px + 8, py + 7); g.lineTo(px + 6, py + 11); g.lineTo(px + 12, py + 14); g.moveTo(px + 8, py + 7); g.lineTo(px + 13, py + 5); g.stroke();
      if (Math.sin(G.t * 3 + tx) > 0.6) rect(g, px + 8, py + 7, 1, 1, '#ffffff');
    } else if (t === T.LAVA) {
      const top = tileAt(L, tx, ty - 1) !== T.LAVA;
      rect(g, px, py + (top ? 5 : 0), 16, top ? 11 : 16, '#d8401a');
      if (top) { for (let i = 0; i < 16; i += 2) { const h = 2 + Math.sin(G.t * 4 + (px + i) * 0.3) * 1.5; rect(g, px + i, py + 6 - h, 2, h + 1, '#ff8a2a'); } rect(g, px, py + 6, 16, 1, '#ffd36a'); }
      if (Math.sin(G.t * 2 + px * 0.7 + py) > 0.95) rect(g, px + 6, py + 9, 2, 2, '#ffb34a');
    }
  }
  for (const u of L.updrafts) if (u.x > cam - 20 && u.x < cam + VW + 20) for (let i = 0; i < 3; i++) { const yy = u.y + u.h - ((G.t * 90 + i * 37 + u.x) % u.h); g.globalAlpha = 0.35; rect(g, u.x + 4 + ((i * 5 + Math.floor(G.t * 3)) % 8), Math.round(yy), 1, 5, '#ffd9a0'); g.globalAlpha = 1; }
  for (const s of L.springs) drawSpring(g, s, G);
  for (const s of L.saws) drawSaw(g, s, G.t);
  for (const p of L.plats) drawPlat(g, p, G);
  for (const e of G.ents) if (!e.dead && !e.lane && e.x > cam - 40 && e.x < cam + VW + 40) drawEnt(g, e, G);
  if (G.boss && !(G.boss.dead && G.boss.dying <= 0)) G.boss.draw(g);
  drawCommando(g);
  for (const b of G.bolts) drawBolt(g, b);
  for (const p of G.projs) drawProj(g, p);
  for (const q of G.parts) {
    if (q.glow) continue;
    g.globalAlpha = Math.min(1, q.life / q.max * 1.5); rect(g, Math.round(q.x), Math.round(q.y), q.s, q.s, q.c);
  }
  g.globalAlpha = 1;
  g.restore();
  // lighting
  drawLighting(g, G.world, buildLights(), cam - Math.round(sx), G.darkBoost);
  g.save(); g.translate(-cam + Math.round(sx), Math.round(sy));
  g.globalCompositeOperation = 'lighter';
  const P = G.P;
  if (G.pstate === 'alive' || G.pstate === 'goal') warmGlow(g, P.x + 5, P.y + 2, 22, 0.12);
  for (const e of G.ents) if (!e.dead && (e.type === 'beacon' && e.lit) && Math.abs(e.x - cam - 240) < 400) warmGlow(g, e.x, e.y - 20, 70, 0.3);
  if (G.boomT > 0) { G.boomT -= 1 / 60; warmGlow(g, G.boomX, G.boomY, 220 * (1 - G.boomT), G.boomT * 0.8, '255,170,90'); }
  for (const q of G.parts) if (q.glow) { g.globalAlpha = Math.min(1, q.life / q.max * 1.5); rect(g, Math.round(q.x), Math.round(q.y), q.s, q.s, q.c); }
  g.globalAlpha = 1;
  for (const [tx, ty] of L.lavaTops) { const x = tx * 16 + 8; if (x > cam - 30 && x < cam + VW + 30 && tx % 2 === 0) warmGlow(g, x, ty * 16 + 6, 26, 0.12, '255,90,30'); }
  g.globalCompositeOperation = 'source-over';
  g.restore();
  drawAmbient(g);
  if (G.flash > 0) { g.fillStyle = `rgba(255,240,210,${Math.min(0.8, G.flash * 2)})`; g.fillRect(0, 0, VW, VH); }
  if (G.pstate === 'dead' && G.pt < 0.5) { g.fillStyle = `rgba(0,0,0,${1 - G.pt / 0.5})`; g.fillRect(0, 0, VW, VH); }
}
function buildLights() {
  const L = G.L, P = G.P, ls = L.lights.slice();
  if (G.pstate === 'alive' || G.pstate === 'goal' || (G.pstate === 'dead' && G.pt > 0.9)) {
    const fl = Math.sin(G.t * 13) * 3 + Math.sin(G.t * 29) * 2;
    ls.push({ x: P.x + 5, y: P.y - 2, r: 56 + G.hp / MAXHP * 30 + fl + (P.dashT > 0 ? 16 : 0) });
  }
  for (const e of G.ents) {
    if (e.dead || e.lane) continue;
    if (e.type === 'ember') ls.push({ x: e.x, y: e.y, r: 15, a: 0.8 });
    else if (e.type === 'star') ls.push({ x: e.x, y: e.y, r: 34 });
    else if (e.type === 'heart') ls.push({ x: e.x, y: e.y, r: 18, a: 0.7 });
    else if (e.type === 'check') ls.push({ x: e.x, y: e.y - 28, r: e.lit ? 76 : 20, a: e.lit ? 1 : 0.6 });
    else if (e.type === 'beacon') ls.push({ x: e.x, y: e.y - 24, r: e.lit ? 90 : 46 });
    else if (e.type === 'wpn') ls.push({ x: e.x + 6, y: e.y + 5, r: 26 });
    else if (e.type === 'gate') ls.push({ x: e.x, y: e.y - 30, r: 70 });
    else if (e.type === 'turret' && e.fire > 0) ls.push({ x: e.x + 7, y: e.y + 8, r: 24 });
  }
  for (const p of G.projs) if (!(p.delay > 0) && p.kind !== 'smoke' && p.kind !== 'dwave') ls.push({ x: p.x, y: p.y, r: p.kind === 'orb' ? 22 : 14, a: 0.8 });
  for (let k = 0; k < G.bolts.length; k += 2) ls.push({ x: G.bolts[k].x, y: G.bolts[k].y, r: 16, a: 0.7 });
  if (G.muzzle > 0) ls.push({ x: P.x + 5 + G.aim[0] * 12, y: P.y + 4 + G.aim[1] * 12, r: 50 });
  for (const [tx, ty] of L.lavaTops) if (tx % 2 === 0) ls.push({ x: tx * 16 + 8, y: ty * 16 + 6, r: 34, a: 0.8 });
  for (const u of L.updrafts) ls.push({ x: u.x + 8, y: u.y + u.h, r: 24, a: 0.6 });
  if (G.boss && !G.boss.dead) for (const l of G.boss.lights()) ls.push(l);
  return ls;
}

// ---------- crisp UI helpers (display canvas, virtual coords) ----------
const FD = "'Pixelify Sans', 'Trebuchet MS', sans-serif", FU = "Silkscreen, 'Courier New', monospace";
function txt(c, s, x, y, size, col, align, font, base) {
  c.font = `${size}px ${font || FU}`; c.textAlign = align || 'left'; c.textBaseline = base || 'alphabetic'; c.fillStyle = col || '#f4e9d4'; c.fillText(s, x, y);
}
function panel(c, x, y, w, h, a) {
  c.fillStyle = `rgba(14,10,12,${a || 0.82})`; rr(c, x, y, w, h, 6); c.fill();
  c.strokeStyle = 'rgba(255,190,120,0.35)'; c.lineWidth = 1; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, 6); c.stroke();
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function wrap(c, s, maxW, size, font) {
  c.font = `${size}px ${font || FU}`; const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function starIcon(c, x, y, r, fill, stroke) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
}
function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; }

function drawHUD(c) {
  for (let i = 0; i < MAXHP; i++) heartIcon(c, 12 + i * 12, 17, 4.5, i < G.hp ? '#ff4a6a' : 'rgba(60,40,48,0.9)', i < G.hp ? '#ffd0d8' : null);
  circ(c, 78, 17, 4, '#ff7a2a'); circ(c, 78, 17, 2.2, '#ffd36a');
  txt(c, `${G.embers}/${G.embersTotal}`, 86, 21, 9, '#ffe6c4');
  for (let i = 0; i < 3; i++) tapeIcon(c, 150 + i * 16, 17, G.starsGot[i]);
  const wl = G.weapon || 'N';
  c.fillStyle = 'rgba(14,10,12,0.75)'; rr(c, 8, 28, 88, 14, 4); c.fill();
  c.fillStyle = WCOL[wl]; c.beginPath(); c.arc(16, 35, 5, 0, 7); c.fill();
  txt(c, wl === 'N' ? '·' : wl, 16, 38, 8, '#1a0a0a', 'center');
  txt(c, WEAPONS[wl].name, 25, 38, 7, '#ffe6c4');
  const tx = G.touch ? VW - 34 : VW - 10;
  txt(c, fmtTime(G.time), tx, 21, 9, '#ffe6c4', 'right');
  if (G.escape) { const s = Math.max(0, G.escape.t); txt(c, `ESCAPE ${s.toFixed(1)}`, VW / 2, 92, 18, Math.sin(G.t * 12) > 0 ? '#ff4a3a' : '#ffe0a0', 'center', FD); }
  if (G.banner > 0 && G.overlay !== 'brief') {
    const a = Math.min(1, G.banner, (3.2 - G.banner) * 3);
    c.globalAlpha = a;
    const code = G.idx === 3 ? `Mission ${G.world + 1} · Memory Boss` : `Mission ${G.world + 1}-${G.idx + 1}`;
    const name = G.idx === 3 ? WORLDS[G.world].boss : WORLDS[G.world].levels[G.idx];
    txt(c, code.toUpperCase(), VW / 2, 66, 8, '#ff8aa0', 'center');
    txt(c, name, VW / 2, 90, 22, '#fff4e2', 'center', FD);
    txt(c, WORLDS[G.world].name, VW / 2, 104, 8, 'rgba(255,230,200,0.7)', 'center');
    c.globalAlpha = 1;
  }
  if (G.boss && !G.boss.dead && G.banner < 2.6) {
    const B = G.boss, w = 200, x = (VW - w) / 2, y = VH - 22;
    txt(c, B.name.toUpperCase(), VW / 2, y - 4, 8, '#ffe0c0', 'center');
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - 1, y - 1, w + 2, 7);
    const f = Math.max(0, (B.hp - (B.chip || 0) / 16) / B.maxHp); c.fillStyle = B.flash > 0 ? '#ffffff' : '#ff4a6a'; c.fillRect(x, y, w * f, 5);
    for (let i = 1; i < B.maxHp; i++) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x + w * i / B.maxHp, y, 1, 5); }
  }
  if (G.signText) {
    const lines = wrap(c, G.signText, 300, 8);
    const h = 14 + lines.length * 12, y = VH - h - (G.touch && !app.classList.contains('portrait') ? 70 : 10);
    panel(c, (VW - 324) / 2, y, 324, h);
    lines.forEach((l, i) => txt(c, l, VW / 2, y + 15 + i * 12, 8, '#fff1dc', 'center'));
  }
  if (G.toast) {
    const a = Math.min(1, G.toast.t * 2);
    c.font = `8px ${FU}`; const tw = Math.min(VW - 20, Math.max(220, c.measureText(G.toast.text).width + 24));
    const ty = G.mode === 'fp' ? VH - 62 : 46;
    c.globalAlpha = a; panel(c, VW / 2 - tw / 2, ty, tw, 22, 0.75); txt(c, G.toast.text, VW / 2, ty + 15, 8, '#ffe6b0', 'center'); c.globalAlpha = 1;
  }
}
function drawBrief(c) {
  c.fillStyle = 'rgba(4,2,6,0.82)'; c.fillRect(0, 0, VW, VH);
  panel(c, 50, 40, VW - 100, 190, 0.9);
  txt(c, 'MISSION BRIEFING', VW / 2, 64, 8, '#ff8aa0', 'center');
  txt(c, WORLDS[G.world].name, VW / 2, 88, 20, '#fff4e2', 'center', FD);
  const lines = wrap(c, BRIEFS[G.world], VW - 140, 8);
  lines.forEach((l, i) => txt(c, l, VW / 2, 114 + i * 13, 8, '#f0e2d0', 'center'));
  heartIcon(c, VW / 2, 190, 9, '#e8507a'); c.strokeStyle = '#2a0a14'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(VW / 2 - 1, 183); c.lineTo(VW / 2 + 2, 189); c.lineTo(VW / 2 - 2, 193); c.lineTo(VW / 2 + 1, 198); c.stroke();
  if (G.overlayT <= 0 && Math.sin(G.t * 5) > -0.3) txt(c, `${btn('jump')} to deploy`, VW / 2, 218, 8, '#ffcf8a', 'center');
}

// ---------- menus ----------
function menuNav(inp, n) {
  if (inp.P.up) { G.menu = (G.menu + n - 1) % n; sfx('ui'); }
  if (inp.P.down) { G.menu = (G.menu + 1) % n; sfx('ui'); }
}
function menuClick(items, x0, y0, dy, w) {
  if (!G.click) return -1;
  for (let i = 0; i < items.length; i++) { const y = y0 + i * dy; if (Math.abs(G.click.x - x0) < w / 2 && G.click.y > y - dy / 2 - 2 && G.click.y < y + dy / 2 - 2) return i; }
  return -1;
}
function pauseItems() { return ['Resume', 'Restart stage', 'Back to map', `Music: ${SAVE.music ? 'on' : 'off'}`, `Sound: ${SAVE.sfx ? 'on' : 'off'}`]; }
function updPause(inp) {
  const items = pauseItems();
  menuNav(inp, items.length);
  let pick = -1;
  if (inp.P.jump || inp.P.confirm) pick = G.menu;
  const ci = menuClick(items, VW / 2, 110, 20, 180); if (ci >= 0) { G.menu = ci; pick = ci; }
  if (inp.P.pause && G.overlayT <= 0) { G.overlay = null; return; }
  if (pick < 0) return;
  sfx('ok');
  if (pick === 0) G.overlay = null;
  else if (pick === 1) startStage(G.world, G.idx);
  else if (pick === 2) { G.scene = 'map'; G.overlay = null; G.sel = G.world * 4 + G.idx; playSong('map'); }
  else if (pick === 3) { SAVE.music = !SAVE.music; setMusicOn(SAVE.music); writeSave(); }
  else if (pick === 4) { SAVE.sfx = !SAVE.sfx; setSfxOn(SAVE.sfx); writeSave(); }
}
function drawPause(c) {
  c.fillStyle = 'rgba(6,4,8,0.6)'; c.fillRect(0, 0, VW, VH);
  panel(c, VW / 2 - 100, 56, 200, 166);
  txt(c, 'Paused', VW / 2, 84, 18, '#fff1dc', 'center', FD);
  pauseItems().forEach((s, i) => {
    const y = 110 + i * 20, on = i === G.menu;
    if (on) { c.fillStyle = 'rgba(255,150,60,0.18)'; rr(c, VW / 2 - 84, y - 12, 168, 17, 4); c.fill(); }
    txt(c, s, VW / 2, y, 9, on ? '#ffcf8a' : '#d8cbbb', 'center');
  });
}
function updResults(inp) {
  if (G.overlayT > 0) return;
  if (inp.P.jump || inp.P.confirm || G.click) { sfx('ok'); G.scene = 'map'; G.overlay = null; G.sel = SAVE.cursor; }
}
function drawResults(c) {
  const R = G.results;
  c.fillStyle = 'rgba(6,4,8,0.45)'; c.fillRect(0, 0, VW, VH);
  panel(c, VW / 2 - 120, 46, 240, 186);
  txt(c, 'MEMORY ERASED', VW / 2, 70, 8, '#ff8aa0', 'center');
  txt(c, WORLDS[G.world].levels[G.idx], VW / 2, 92, 18, '#fff4e2', 'center', FD);
  const rows = [['Time', fmtTime(R.time) + (R.newBest ? '  best!' : '')], ['Confidence', `${R.embers} / ${R.total}`], ['Setbacks', String(R.deaths)]];
  rows.forEach(([k, v], i) => { const y = 120 + i * 18; txt(c, k, VW / 2 - 96, y, 9, '#bfb2a2'); txt(c, v, VW / 2 + 96, y, 9, '#fff1dc', 'right'); });
  txt(c, 'Mixtapes', VW / 2 - 96, 174, 9, '#bfb2a2');
  for (let i = 0; i < 3; i++) tapeIcon(c, VW / 2 + 58 + i * 17, 170, R.stars[i]);
  if (G.overlayT <= 0 && Math.sin(G.t * 5) > -0.3) txt(c, `${btn('jump')} to continue`, VW / 2, 214, 8, '#ffcf8a', 'center');
}
function updAbility(inp) {
  if (G.overlayT > 0) return;
  if (inp.P.jump || inp.P.confirm || G.click) { sfx('ok'); G.scene = 'map'; G.overlay = null; G.sel = SAVE.cursor; }
}
function drawAbility(c) {
  const p = POWERS[G.world];
  c.fillStyle = 'rgba(6,4,8,0.55)'; c.fillRect(0, 0, VW, VH);
  panel(c, VW / 2 - 140, 50, 280, 172);
  txt(c, `${WORLDS[G.world].boss.toUpperCase()} · DESTROYED`, VW / 2, 74, 8, '#ff8aa0', 'center');
  txt(c, 'New move unlocked', VW / 2, 98, 10, '#d8cbbb', 'center');
  txt(c, p.name, VW / 2, 126, 26, '#fff4e2', 'center', FD);
  wrap(c, p.desc, 230, 8).forEach((l, i) => txt(c, l, VW / 2, 152 + i * 12, 8, '#e8dccb', 'center'));
  if (G.overlayT <= 0 && Math.sin(G.t * 5) > -0.3) txt(c, `${btn('jump')} to continue`, VW / 2, 208, 8, '#ffcf8a', 'center');
}

// ---------- title ----------
function titleItems() { return [SAVE.unlocked > 0 ? 'Continue' : 'Begin', `Music: ${SAVE.music ? 'on' : 'off'}`, G.eraseArm ? 'Press again to erase' : 'Erase progress']; }
function updTitle(inp) {
  const items = titleItems();
  menuNav(inp, items.length);
  if (G.menu !== 2) G.eraseArm = false;
  let pick = (inp.P.jump || inp.P.confirm) ? G.menu : -1;
  const ci = menuClick(items, VW / 2, 138, 18, 200); if (ci >= 0) { G.menu = ci; pick = ci; }
  if (pick < 0) return;
  sfx('ok');
  if (pick === 0) { if (!SAVE.introSeen) { G.scene = 'intro'; G.introT = 0; } else { G.scene = 'map'; G.sel = Math.min(SAVE.cursor, SAVE.unlocked); playSong('map'); } }
  else if (pick === 1) { SAVE.music = !SAVE.music; setMusicOn(SAVE.music); writeSave(); }
  else if (pick === 2) {
    if (G.eraseArm) { const m = SAVE.music, s = SAVE.sfx; SAVE = defaultSave(); SAVE.music = m; SAVE.sfx = s; writeSave(); G.eraseArm = false; G.menu = 0; }
    else G.eraseArm = true;
  }
}
function drawTitleScene(g) {
  const cam = G.t * 14;
  G.world = 0; drawBG(g, 0, cam);
  rect(g, 0, 214, VW, 58, '#1a120d'); rect(g, 0, 212, VW, 3, '#4a8236'); rect(g, 0, 212, VW, 1, '#93cc5c');
  const x = 240, y = 212;
  g.save(); g.translate(x, y); g.scale(2, 2); heroBody(g, { t: G.t }); g.restore();
  g.strokeStyle = '#3a3d44'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 18, y - 26); g.stroke();
  for (let i = 0; i < 4; i++) { const hx = 160 + i * 55 + Math.sin(G.t + i) * 10, hy = 60 + ((G.t * 12 + i * 40) % 140); heartIcon(g, hx, hy, 4, 'rgba(232,80,122,0.5)'); }
  drawLighting(g, 0, [{ x: x, y: y - 20, r: 110 + Math.sin(G.t * 13) * 3 }, { x: 380, y: 52, r: 50, a: 0.5 }], 0, 0.15);
  g.globalCompositeOperation = 'lighter'; warmGlow(g, x, y - 20, 50, 0.25); g.globalCompositeOperation = 'source-over';
  if (!G.amb.length) { G.world = 0; initAmbient(); }
  updateAmbient(1 / 60); drawAmbient(g);
}
function drawTitleUI(c) {
  c.save();
  c.shadowColor = 'rgba(255,140,40,0.6)'; c.shadowBlur = 18;
  c.shadowColor = 'rgba(255,60,100,0.7)';
  txt(c, 'Crush Commando', VW / 2, 80, 46, '#ffe2d0', 'center', FD);
  c.restore();
  txt(c, 'Every rejection is coming back. Lock and load.', VW / 2, 102, 8, 'rgba(255,220,210,0.8)', 'center');
  titleItems().forEach((s, i) => {
    const y = 138 + i * 18, on = i === G.menu;
    txt(c, (on ? '› ' : '') + s + (on ? ' ‹' : ''), VW / 2, y, 9, on ? '#ffcf8a' : 'rgba(230,215,195,0.7)', 'center');
  });
  const hint = G.lastInput === 'touch' ? 'Pad to choose · JUMP to select' : G.lastInput === 'pad' ? 'D-pad to choose · A to select' : '↑↓ choose · Z / Space select · M mutes music';
  txt(c, hint, VW / 2, VH - 10, 7, 'rgba(230,215,195,0.5)', 'center');
}

// ---------- map ----------
function nodePos(k) { return { x: 84 + k * 104, y: 150 + (k % 2 ? -18 : 14) }; }
function updMap(inp, dt) {
  G.mapT += dt;
  const maxSel = Math.min(19, SAVE.unlocked);
  const old = G.sel;
  if (inp.P.right) G.sel = Math.min(maxSel, G.sel + 1);
  if (inp.P.left) G.sel = Math.max(0, G.sel - 1);
  if (inp.P.down) G.sel = Math.min(maxSel, G.sel + 4);
  if (inp.P.up) G.sel = Math.max(0, G.sel - 4);
  let go = inp.P.jump || inp.P.confirm;
  if (G.click) {
    const w = Math.floor(G.sel / 4);
    for (let k = 0; k < 4; k++) { const n = nodePos(k), idx = w * 4 + k; if (Math.hypot(G.click.x - n.x, G.click.y - n.y) < 22 && idx <= maxSel) { if (idx === G.sel) go = true; else G.sel = idx; } }
    if (G.click.x < 40 && G.click.y > 110 && G.click.y < 190 && w > 0) G.sel = Math.max(0, w * 4 - 4);
    if (G.click.x > VW - 40 && G.click.y > 110 && G.click.y < 190 && (w + 1) * 4 <= maxSel) G.sel = (w + 1) * 4;
  }
  if (G.sel !== old) { sfx('ui'); G.mapT = 0; SAVE.cursor = G.sel; }
  if (inp.P.pause) { G.scene = 'title'; G.menu = 0; playSong('title'); return; }
  if (go) { sfx('ok'); SAVE.cursor = G.sel; writeSave(); startStage(Math.floor(G.sel / 4), G.sel % 4); }
}
function drawMapScene(g) {
  const w = Math.floor(G.sel / 4);
  G.world = w;
  drawBG(g, w, G.t * 8);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, VW, VH);
  // ground strip
  const th = THEMES[w];
  rect(g, 0, 196, VW, 76, th.deep); rect(g, 0, 194, VW, 3, th.top); rect(g, 0, 194, VW, 1, th.topHi);
  // path
  for (let k = 0; k < 3; k++) {
    const a = nodePos(k), b = nodePos(k + 1);
    for (let s = 0.1; s < 0.92; s += 0.08) { const x = a.x + (b.x - a.x) * s, y = a.y + (b.y - a.y) * s - Math.sin(s * Math.PI) * 10; rect(g, Math.round(x), Math.round(y), 2, 2, w * 4 + k + 1 <= SAVE.unlocked ? '#ffcf8a' : 'rgba(255,255,255,0.18)'); }
  }
  const lights = [];
  for (let k = 0; k < 4; k++) {
    const n = nodePos(k), idx = w * 4 + k, rec = SAVE.lv[w + '-' + k], open = idx <= SAVE.unlocked, boss = k === 3;
    const bw = boss ? 30 : 22;
    rect(g, n.x - bw / 2, n.y + 2, bw, 6, '#4a3f37'); rect(g, n.x - bw / 2, n.y + 2, bw, 1, '#8a7a6a'); rect(g, n.x - 4, n.y + 8, 8, 8, '#3a302a');
    if (rec && rec.done) { drawFlame(g, n.x, n.y + 2, boss ? 1.6 : 1.1, G.t + k, 0); lights.push({ x: n.x, y: n.y - 6, r: boss ? 70 : 50 }); }
    else if (open) { if (Math.sin(G.t * 3 + k) > -0.5) rect(g, n.x - 1, n.y - 1, 2, 2, '#ff8a3a'); lights.push({ x: n.x, y: n.y, r: 26, a: 0.7 }); }
    else { rect(g, n.x - 3, n.y - 2, 6, 3, '#2a2420'); }
    if (boss) { g.fillStyle = open ? '#d8cbbb' : '#5a524a'; g.beginPath(); g.moveTo(n.x - 18, n.y + 2); g.lineTo(n.x - 22, n.y - 10); g.lineTo(n.x - 14, n.y + 2); g.fill(); g.beginPath(); g.moveTo(n.x + 18, n.y + 2); g.lineTo(n.x + 22, n.y - 10); g.lineTo(n.x + 14, n.y + 2); g.fill(); }
  }
  // cursor candle
  const n = nodePos(G.sel % 4), hop = Math.abs(Math.sin(G.mapT * 6)) * (G.mapT < 0.4 ? 6 : 2), cx = n.x, cy = n.y - 22 - hop;
  g.save(); g.translate(cx, cy + 14); heroBody(g, { t: G.t }); g.restore();
  lights.push({ x: cx, y: cy, r: 60 });
  drawLighting(g, w, lights, 0, -0.05);
}
function drawMapUI(c) {
  const w = Math.floor(G.sel / 4), k = G.sel % 4, rec = SAVE.lv[w + '-' + k];
  txt(c, `MISSION ${w + 1} OF 5`, 16, 26, 8, '#ff8aa0');
  txt(c, WORLDS[w].name, 16, 50, 22, '#fff4e2', 'left', FD);
  let total = 0; for (const key in SAVE.lv) total += SAVE.lv[key].stars.filter(Boolean).length;
  tapeIcon(c, VW - 70, 22, 1); txt(c, `${total} / 45`, VW - 14, 26, 9, '#ffe6c4', 'right');
  const ab = abilitiesFor(Math.min(4, Math.floor(SAVE.unlocked / 4)));
  const owned = POWERS.filter((p, i) => [ab.dj, ab.dash, ab.wall, ab.glide][i]).map(p => p.name);
  txt(c, owned.length ? owned.join(' · ') : 'No moves unlocked yet', VW - 14, 42, 7, 'rgba(255,230,200,0.65)', 'right');
  if (w > 0) txt(c, '‹', 16, 158, 22, 'rgba(255,220,180,0.7)', 'center', FD);
  if ((w + 1) * 4 <= Math.min(19, SAVE.unlocked)) txt(c, '›', VW - 16, 158, 22, 'rgba(255,220,180,0.7)', 'center', FD);
  // info panel
  const name = k === 3 ? WORLDS[w].boss : WORLDS[w].levels[k];
  panel(c, 60, 206, VW - 120, 52, 0.78);
  txt(c, k === 3 ? `MEMORY BOSS · ${w + 1}-B` : `MISSION ${w + 1}-${k + 1}`, 74, 222, 7, '#ff8aa0');
  txt(c, name, 74, 242, 15, '#fff4e2', 'left', FD);
  if (k < 3) for (let i = 0; i < 3; i++) tapeIcon(c, VW - 130 + i * 16, 222, rec && rec.stars[i]);
  txt(c, rec && rec.best ? `Best ${fmtTime(rec.best)}` : 'Not yet erased', VW - 74, 246, 8, '#d8cbbb', 'right');
  const hint = G.lastInput === 'touch' ? 'Tap a mission, tap again to deploy' : G.lastInput === 'pad' ? 'A play · ←→ stage · ↑↓ world · START title' : 'Z play · ←→ stage · ↑↓ world · Esc title';
  txt(c, hint, VW / 2, VH - 4, 7, 'rgba(230,215,195,0.5)', 'center');
}

// ---------- ending ----------
function updEnding(inp, dt) {
  G.endT += dt;
  if (G.endT > 4 && (inp.P.jump || inp.P.confirm || G.click)) { sfx('ok'); G.scene = 'map'; G.sel = 19; playSong('map'); }
}
function drawEndingScene(g) {
  const t = G.endT, k = Math.min(1, t / 8);
  const gr = g.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, `rgb(${Math.round(30 + 90 * k)},${Math.round(30 + 70 * k)},${Math.round(70 + 60 * k)})`);
  gr.addColorStop(0.7, `rgb(${Math.round(80 + 170 * k)},${Math.round(50 + 120 * k)},${Math.round(60 + 50 * k)})`);
  gr.addColorStop(1, `rgb(${Math.round(120 + 135 * k)},${Math.round(80 + 130 * k)},${Math.round(60 + 40 * k)})`);
  g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
  const ex = 90, ey = 190, f = Math.max(0, 1 - t / 7);
  for (let i = 0; i < 9; i++) { const a = i * 0.7 + t * 0.2, r = (30 + i * 6) * (0.6 + Math.min(1, t / 2) * 0.6); circ(g, ex + Math.cos(a) * 20, ey - 30 - i * 8 + Math.sin(a) * 8, r * 0.5, `rgba(255,${120 + i * 12},60,${0.25 * f + 0.05})`); }
  circ(g, ex, ey - 110, 40 * (0.5 + Math.min(1, t / 2) * 0.5), `rgba(255,190,120,${0.35 * f + 0.08})`);
  const R = rng(5);
  for (let layer = 0; layer < 2; layer++) {
    g.fillStyle = layer ? '#1a1418' : '#2c2228'; g.beginPath(); g.moveTo(0, VH);
    for (let x = 0; x <= VW; x += 20) g.lineTo(x, 200 + layer * 24 + Math.sin(x * 0.02 + layer * 2) * 8 + R() * 4);
    g.lineTo(VW, VH); g.fill();
  }
  const hx = 150 + Math.min(t, 10) * 18, hy = 222 + Math.sin(hx * 0.02 + 2) * 6;
  g.save(); g.translate(hx, hy); g.scale(3, 3); heroBody(g, { run: true, st: Math.floor(t * 6) % 4, t: G.t, glasses: true }); g.restore();
  for (let i = 0; i < 6; i++) { const bx = ((t * 20 + i * 90) % 560) - 40, by = 70 + i * 9 + Math.sin(t * 2 + i) * 4; rect(g, Math.round(bx), Math.round(by), 3, 1, '#1a1418'); rect(g, Math.round(bx) + 1, Math.round(by) - (Math.sin(t * 12 + i) > 0 ? 1 : 0), 1, 1, '#1a1418'); }
}
function drawEndingUI(c) {
  const t = G.endT;
  const a = x => Math.max(0, Math.min(1, (t - x) / 1.2));
  ENDING_LINES.forEach((l, i) => { c.globalAlpha = a(1 + i * 1.6); txt(c, l, VW / 2, 28 + i * 17 + (i === 4 ? 6 : 0), i === 4 ? 14 : 9, i === 4 ? '#fff4e2' : '#ffe6c4', 'center', i === 4 ? FD : FU); });
  let stars = 0; for (const key in SAVE.lv) stars += SAVE.lv[key].stars.filter(Boolean).length;
  c.globalAlpha = a(9.5);
  txt(c, 'MISSION COMPLETE', VW / 2, 138, 18, '#ff8aa0', 'center', FD);
  txt(c, `Time ${fmtTime(SAVE.playTime)}  ·  Setbacks ${SAVE.deaths}  ·  Mixtapes ${stars}/45`, VW / 2, 154, 8, '#fff1dc', 'center');
  c.globalAlpha = a(10.5) * (Math.sin(G.t * 5) > -0.3 ? 1 : 0); txt(c, `${btn('jump')} to return to the map`, VW / 2, 170, 8, '#3a1a10', 'center');
  c.globalAlpha = 1;
}
function updIntro(inp, dt) {
  G.introT += dt;
  if (G.introT > 1 && (inp.P.jump || inp.P.confirm || G.click)) {
    if (G.introT < INTRO.length * 1.8 + 1) G.introT = INTRO.length * 1.8 + 1;
    else { SAVE.introSeen = true; writeSave(); G.scene = 'map'; G.sel = Math.min(SAVE.cursor, SAVE.unlocked); playSong('map'); sfx('ok'); }
  }
}
function drawIntro(c) {
  const t = G.introT;
  INTRO.forEach((l, i) => { c.globalAlpha = Math.max(0, Math.min(1, (t - 0.4 - i * 1.8) / 1)); txt(c, l, VW / 2, 70 + i * 22, i === 4 ? 10 : 9, i === 4 ? '#ff8aa0' : '#f0e2d0', 'center'); });
  c.globalAlpha = Math.max(0, Math.min(1, t - INTRO.length * 1.8));
  heartIcon(c, VW / 2, 206, 12, '#e8507a'); c.strokeStyle = '#07040a'; c.lineWidth = 2; c.beginPath(); c.moveTo(VW / 2 - 1, 197); c.lineTo(VW / 2 + 3, 205); c.lineTo(VW / 2 - 2, 211); c.lineTo(VW / 2 + 1, 218); c.stroke();
  c.globalAlpha = Math.sin(G.t * 5) > -0.3 ? 0.8 : 0; txt(c, `${btn('jump')} to continue`, VW / 2, VH - 12, 8, '#ffcf8a', 'center');
  c.globalAlpha = 1;
}

// ---------- loop ----------
function update(dt) {
  G.t += dt;
  pollPad();
  const inp = readInput();
  if (inp.P.mute) { SAVE.music = !SAVE.music; setMusicOn(SAVE.music); writeSave(); }
  if (G.overlayT > 0) G.overlayT -= dt;
  if (G.fade > 0) G.fade -= dt * 2.2;
  const sc0 = G.scene;
  switch (G.scene) {
    case 'title': updTitle(inp); break;
    case 'map': updMap(inp, dt); break;
    case 'ending': updEnding(inp, dt); break;
    case 'intro': updIntro(inp, dt); break;
    case 'play':
      if (G.overlay === 'pause') updPause(inp);
      else if (G.overlay === 'brief') { if (G.overlayT <= 0 && (inp.P.jump || inp.P.confirm || G.click)) { SAVE.brief = SAVE.brief || {}; SAVE.brief[G.world] = true; writeSave(); G.overlay = null; G.banner = 3.2; sfx('ok'); } }
      else if (G.overlay === 'results') { updResults(inp); updatePlay(dt, {}); }
      else if (G.overlay === 'ability') { updAbility(inp); updatePlay(dt, {}); }
      else {
        if (inp.P.pause) { openPause(); sfx('ui'); break; }
        SAVE.playTime += dt;
        updatePlay(dt, inp);
      }
      break;
  }
  if (G.scene !== sc0 && G.scene !== 'play') G.fade = 1;
  G.click = null;
}
function render() {
  switch (G.scene) {
    case 'title': drawTitleScene(g); break;
    case 'map': drawMapScene(g); break;
    case 'play': if (G.mode === 'fp') drawFP(g); else drawPlay(g); break;
    case 'ending': drawEndingScene(g); break;
    case 'intro': g.fillStyle = '#07040a'; g.fillRect(0, 0, VW, VH); break;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, 0, 0, cv.width, cv.height);
  ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = true;
  switch (G.scene) {
    case 'title': drawTitleUI(ctx); break;
    case 'map': drawMapUI(ctx); break;
    case 'play':
      drawHUD(ctx);
      if (G.overlay === 'pause') drawPause(ctx);
      else if (G.overlay === 'brief') drawBrief(ctx);
      else if (G.overlay === 'results') drawResults(ctx);
      else if (G.overlay === 'ability') drawAbility(ctx);
      break;
    case 'ending': drawEndingUI(ctx); break;
    case 'intro': drawIntro(ctx); break;
  }
  if (G.fade > 0) { ctx.fillStyle = `rgba(6,4,6,${Math.min(1, G.fade)})`; ctx.fillRect(0, 0, VW, VH); }
}
let last = performance.now(), acc = 0;
function frame(now) {
  let d = (now - last) / 1000; last = now;
  if (d > 0.25) d = 0.25;
  acc += d;
  const STEP = 1 / 60;
  let n = 0;
  while (acc >= STEP && n < 6) { update(STEP); acc -= STEP; n++; }
  if (n >= 6) acc = 0;
  render();
  requestAnimationFrame(frame);
}

// ---------- boot ----------
loadSave();
AU.musicOn = SAVE.music; AU.sfxOn = SAVE.sfx;
G.sel = Math.min(SAVE.cursor, SAVE.unlocked);
G.touch = matchMedia('(pointer: coarse)').matches;
if (G.touch) G.lastInput = 'touch';
setupTouch();
layout();
playSong('title');
if (document.fonts && document.fonts.load) { document.fonts.load("16px 'Pixelify Sans'"); document.fonts.load('8px Silkscreen'); }
requestAnimationFrame(frame);
